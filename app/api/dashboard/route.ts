import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../../lib/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const user = await requireAuth();

    const where = user.role === 'admin' ? {} : { userId: user.id };

    const invoices = await prisma.invoice.findMany({ where });
    const payments = await prisma.payment.findMany({ where });

    const outstanding = invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);

    const pending = invoices.filter(inv => inv.status === 'pending').length;
    const revenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const customers = new Set(invoices.map(inv => inv.clientName)).size;

    return NextResponse.json({
      outstanding,
      pending,
      revenue,
      customers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}