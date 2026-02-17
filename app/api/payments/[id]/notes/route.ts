import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
    }

    const body = await request.json();
    const { notes } = body;

    // Update payment notes
    const payment = await prisma.payment.update({
      where: { id },
      data: {
        notes: notes || null,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      payment: {
        ...payment,
        amount: payment.amount.toNumber()
      }
    });
  } catch (error: any) {
    console.error('Update payment notes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
