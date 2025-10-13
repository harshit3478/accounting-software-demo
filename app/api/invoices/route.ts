import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../../lib/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const user = await requireAuth();

    const where = user.role === 'admin' ? {} : { userId: user.id };

    const invoices = await prisma.invoice.findMany({
      where,
      include: { payments: true },
    });

    return NextResponse.json(invoices);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { clientName, amount, dueDate, description } = await request.json();

    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientName,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        description,
      },
    });

    return NextResponse.json(invoice);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}