import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth";
import {
  generateInvoiceNumber,
  calculateInvoiceStatus,
} from "../../../lib/invoice-utils";
import { invalidateDashboard } from "../../../lib/cache-helpers";

export async function GET() {
  try {
    const user = await requireAuth();

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
      include: includeAny,
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json(serializedInvoices);
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
