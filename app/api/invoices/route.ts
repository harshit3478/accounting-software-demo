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

    // Build where clause
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { clientName: { contains: search } },
      ];
    }

    // Status filter
    if (status !== "all") {
      where.status = status;
    }

    // Type filter
    if (type === "layaway") {
      where.isLayaway = true;
    } else if (type === "cash") {
      where.isLayaway = false;
    }

    // Overdue Dates Logic (Layaway specific)
    if (overdueDates === "2") {
      where.isLayaway = true; // Implicitly layaway
      if (status === "all") {
         where.status = { not: "paid" }; // Only unpaid/partial/overdue
      }

      // Calculate cutoff date: Find the 2nd most recent 15th or 30th/End-of-Month
      const now = new Date();
      let datesFound = 0;
      let checkDate = new Date(now);
      
      // Go back day by day until we find 2 due dates
      while (datesFound < 2) {
        checkDate.setDate(checkDate.getDate() - 1);
        const day = checkDate.getDate();
        // Check if this date is a due date (15th or last day of month)
        const is15th = day === 15;
        
        const testDate = new Date(checkDate);
        testDate.setDate(testDate.getDate() + 1);
        const isLastDay = testDate.getDate() === 1; // If adding 1 day makes it 1st of next month, today is last day

        // User restriction: "15th/30th". We'll assume end of month for 30th/31st/28th
        if (is15th || isLastDay) {
           datesFound++;
        }
      }
      
      // Any invoice created BEFORE this checkDate has passed at least 2 due dates
      // We use start of day to be inclusive of the full checkDate? 
      // If created ON checkDate (e.g. 15th), it is due immediately? Usually next cycle.
      // Let's assume strict: if created BEFORE the 2nd payment date.
      where.createdAt = {
        lte: checkDate
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

    // cast include to any because Prisma client types may be out-of-date until prisma generate is run
    const includeAny: any = {
      payments: true,
      paymentMatches: true,
      terms: true,
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
