import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const statusFilter = searchParams.get('status')?.split(',') || ['pending', 'partial', 'overdue'];
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');

    // Build where clause
    const where: any = {
      status: {
        in: statusFilter
      }
    };

    // Add search filter (client name or invoice number)
    if (query.trim()) {
      where.OR = [
        {
          clientName: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          invoiceNumber: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Add amount filters
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }

    // Fetch invoices
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        payments: true,
        paymentMatches: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit results for performance
    });

    // Calculate remaining balance for each invoice
    const enrichedInvoices = invoices.map(invoice => {
      const directPayments = invoice.payments.reduce((sum: number, p: any) => {
        return sum + p.amount.toNumber();
      }, 0);
      const matchedPayments = invoice.paymentMatches.reduce((sum: number, m: any) => {
        return sum + m.amount.toNumber();
      }, 0);
      const totalPaid = directPayments + matchedPayments;
      const remaining = invoice.amount.toNumber() - totalPaid;

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        amount: invoice.amount.toNumber(),
        paidAmount: totalPaid,
        remaining,
        status: invoice.status,
        dueDate: invoice.dueDate.toISOString().split('T')[0],
        createdAt: invoice.createdAt.toISOString().split('T')[0],
        description: invoice.description,
        isLayaway: invoice.isLayaway,
        user: invoice.user
      };
    });

    // Filter out fully paid invoices (remaining <= 0)
    const unpaidInvoices = enrichedInvoices.filter(inv => inv.remaining > 0);

    return NextResponse.json({
      invoices: unpaidInvoices,
      count: unpaidInvoices.length
    });

  } catch (error: any) {
    console.error('Search invoices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
