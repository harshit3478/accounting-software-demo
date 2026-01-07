import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const lastPayment = await prisma.payment.findFirst({
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        createdAt: true
      }
    });

    return NextResponse.json({
      lastUpdated: lastPayment?.createdAt || null
    });
  } catch (error: any) {
    console.error('Error fetching last payment update:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
