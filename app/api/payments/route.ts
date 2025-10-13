import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../../lib/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const user = await requireAuth();

    const where = user.role === 'admin' ? {} : { userId: user.id };

    const payments = await prisma.payment.findMany({
      where,
      include: { invoice: true },
    });

    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { invoiceId, amount, paymentDate, method } = await request.json();

    const payment = await prisma.payment.create({
      data: {
        invoiceId: parseInt(invoiceId),
        amount: parseFloat(amount),
        paymentDate: new Date(paymentDate),
        method,
        userId: user.id,
      },
    });

    return NextResponse.json(payment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}