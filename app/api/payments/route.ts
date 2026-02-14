import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireAuth } from '../../../lib/auth';
import { updateInvoiceAfterPayment } from '../../../lib/invoice-utils';
import { invalidateDashboard } from '../../../lib/cache-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Filter params
    const invoiceId = searchParams.get('invoiceId');
    const search = searchParams.get("search") || "";
    const method = searchParams.get("method") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let where: any = {};
    
    // Filter by invoiceId if provided
    if (invoiceId) {
      where.invoiceId = parseInt(invoiceId);
    }

    // Search filter
    if (search) {
      where.OR = [
        { notes: { contains: search } },
        { 
          invoice: { 
            OR: [
              { invoiceNumber: { contains: search } },
              { clientName: { contains: search } }
            ]
          } 
        }
      ];
    }

    // Method filter (now by methodId)
    if (method !== "all") {
      const methodId = parseInt(method);
      if (!isNaN(methodId)) {
        where.methodId = methodId;
      }
    }

    // Date range filter
    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    // Get total count
    const total = await prisma.payment.count({ where });

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: true,
        method: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        paymentMatches: {
          include: {
            invoice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
    });

    // Convert Decimal to number for JSON serialization
    const serializedPayments = payments.map(payment => ({
      ...payment,
      amount: payment.amount.toNumber(),
      invoice: payment.invoice ? {
        ...payment.invoice,
        amount: payment.invoice.amount.toNumber(),
        paidAmount: payment.invoice.paidAmount.toNumber(),
        subtotal: payment.invoice.subtotal.toNumber(),
        tax: payment.invoice.tax.toNumber(),
        discount: payment.invoice.discount.toNumber(),
      } : null
    }));

    return NextResponse.json({
      payments: serializedPayments,
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
    const { invoiceId, amount, paymentDate, methodId, notes, source } = await request.json();

    if (!methodId) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoiceId ? parseInt(invoiceId) : null,
        amount: parseFloat(amount),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        methodId: parseInt(methodId),
        notes,
        userId: user.id,
        isMatched: !!invoiceId,
        source: source || "manual",
      },
      include: { method: true },
    });

    // Update invoice status if payment is linked
    if (invoiceId) {
      await updateInvoiceAfterPayment(parseInt(invoiceId));
    }

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json(payment);
  } catch (error: any) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}