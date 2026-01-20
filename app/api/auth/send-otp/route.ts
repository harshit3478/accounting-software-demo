import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { sendLoginOtp } from '../../../../lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Security: Don't reveal if user exists or not, but for this internal tool implies we might want to know.
    // However, if we want to be nice, we only send if user exists.
    if (!user) {
      // Return 200 to genericize, or 404 if we want to be explicit. 
      // Given the small userbase (20-30), explicit errors are helpful.
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate 6 digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save to DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiresAt: otpExpiresAt,
      },
    });
    console.log(`Generated OTP for ${email}: ${otp} (expires at ${otpExpiresAt.toISOString()})`);
    // Send Email
    const emailResult = await sendLoginOtp(email, otp);

    if (!emailResult.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ message: 'OTP sent successfully' });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
