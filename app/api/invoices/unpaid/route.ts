import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ['pending', 'partial', 'overdue']
        }
      },
      select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
          status: true
      },
      orderBy: {
        dueDate: 'asc' // Due soonest first
      }
    });

    return NextResponse.json(unpaidInvoices);
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
