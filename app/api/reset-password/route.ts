import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    const user = await prisma.user.findFirst({ where: { resetToken: token } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword, resetToken: null },
    });

    return NextResponse.json({ message: 'Password reset successful' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}