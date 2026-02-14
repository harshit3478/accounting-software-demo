import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth";
import {
  generateInvoiceNumber,
  calculateInvoiceStatus,
} from "../../../lib/invoice-utils";
import { invalidateDashboard } from "../../../lib/cache-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Filter params
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const overdueDates = searchParams.get("overdueDates"); // "2" for > 2 due dates logic
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const showInactive = searchParams.get("showInactive") === "true";
    const customerId = searchParams.get("customerId");

    // Build where clause
    const where: any = {};

    // By default, exclude inactive invoices unless explicitly requested
    if (status === "inactive") {
      where.status = "inactive";
    } else if (showInactive) {
      // Show all including inactive — no status filter applied here
    } else {
      // Default: exclude inactive
      where.status = { not: "inactive" };
    }

    // Search filter
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { clientName: { contains: search } },
      ];
    }

    // Status filter (applied on top of inactive exclusion)
    if (status !== "all" && status !== "inactive") {
      where.status = status;
    }

    // Customer filter — see all invoices for a specific client
    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    // Type filter
    if (type === "layaway") {
      where.isLayaway = true;
    } else if (type === "cash") {
      where.isLayaway = false;
    }

    // Overdue Dates Logic (Layaway specific) — uses LayawayInstallment table
    if (overdueDates === "2") {
      where.isLayaway = true;
      if (status === "all") {
        where.status = { not: "paid" };
      }
      // Find invoices that have overdue unpaid installments
      where.layawayPlan = {
        isCancelled: false,
        installments: {
          some: {
            isPaid: false,
            dueDate: { lt: new Date() },
          },
        },
      };
    }

    // Date range filter
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    // Get total count for pagination
    const total = await (prisma as any).invoice.count({ where });

    const includeAny: any = {
      payments: { include: { method: true } },
      paymentMatches: true,
      terms: true,
      customer: true,
      layawayPlan: { include: { installments: { orderBy: { dueDate: "asc" } } } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    };

    const invoices = await (prisma as any).invoice.findMany({
      where,
      include: includeAny,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    // Convert Decimal to number for JSON serialization
    const serializedInvoices = (invoices as any[]).map((invoice: any) => ({
      ...invoice,
      subtotal: invoice.subtotal?.toNumber
        ? invoice.subtotal.toNumber()
        : invoice.subtotal,
      tax: invoice.tax?.toNumber ? invoice.tax.toNumber() : invoice.tax,
      discount: invoice.discount?.toNumber
        ? invoice.discount.toNumber()
        : invoice.discount,
      amount: invoice.amount?.toNumber
        ? invoice.amount.toNumber()
        : invoice.amount,
      paidAmount: invoice.paidAmount?.toNumber
        ? invoice.paidAmount.toNumber()
        : invoice.paidAmount,
      termsSnapshot: invoice.termsSnapshot || null,
      payments: (invoice.payments || []).map((payment: any) => ({
        ...payment,
        amount: payment.amount?.toNumber
          ? payment.amount.toNumber()
          : payment.amount,
      })),
    }));

    return NextResponse.json({
      invoices: serializedInvoices,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const {
      clientName,
      customerId,
      externalInvoiceNumber,
      source,
      items,
      subtotal,
      tax,
      discount,
      dueDate,
      description,
      isLayaway,
      useDefaultTerms,
      termsId,
      newTerms,
    } = await request.json();

    // Generate unique invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Calculate total amount
    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const totalAmount =
      parseFloat(subtotal) + parseFloat(taxAmount) - parseFloat(discountAmount);

    // Handle terms: either attach default, attach existing terms by id, or create new terms
    let attachedTermsId: number | null = null;
    let termsSnapshot: any = null;

    if (useDefaultTerms) {
      const defaultTerm = await (prisma as any).term.findFirst({
        where: { isDefault: true },
        orderBy: { updatedAt: "desc" },
      });
      if (defaultTerm) {
        attachedTermsId = defaultTerm.id;
        termsSnapshot = defaultTerm.lines;
      }
    } else if (termsId) {
      const found = await (prisma as any).term.findUnique({
        where: { id: termsId },
      });
      if (found) {
        attachedTermsId = found.id;
        termsSnapshot = found.lines;
      }
    } else if (Array.isArray(newTerms) && newTerms.length > 0) {
      // enforce max 5 lines
      const lines = newTerms.slice(0, 5);
      const createdTerm = await (prisma as any).term.create({
        data: { lines, createdBy: user.id },
      });
      attachedTermsId = createdTerm.id;
      termsSnapshot = createdTerm.lines;
    }

    const invoice = await (prisma as any).invoice.create({
      data: {
        userId: user.id,
        invoiceNumber,
        clientName,
        items: items || null,
        subtotal: parseFloat(subtotal),
        tax: parseFloat(taxAmount),
        discount: parseFloat(discountAmount),
        amount: totalAmount,
        paidAmount: 0,
        dueDate: new Date(dueDate),
        status: "pending",
        isLayaway: isLayaway || false,
        description,
        customerId: customerId || null,
        externalInvoiceNumber: externalInvoiceNumber || null,
        source: source || "manual",
        termsId: attachedTermsId,
        termsSnapshot: termsSnapshot || null,
      },
    });

    // Convert Decimal to number for response
    const invAny: any = invoice;
    const serializedInvoice = {
      ...invAny,
      subtotal: invAny.subtotal?.toNumber
        ? invAny.subtotal.toNumber()
        : invAny.subtotal,
      tax: invAny.tax?.toNumber ? invAny.tax.toNumber() : invAny.tax,
      discount: invAny.discount?.toNumber
        ? invAny.discount.toNumber()
        : invAny.discount,
      amount: invAny.amount?.toNumber
        ? invAny.amount.toNumber()
        : invAny.amount,
      paidAmount: invAny.paidAmount?.toNumber
        ? invAny.paidAmount.toNumber()
        : invAny.paidAmount,
    };

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json(serializedInvoice);
  } catch (error: any) {
    console.error("Create invoice error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
