import { NextRequest, NextResponse } from "next/server";
import { signAuthToken, setAuthTokenCookie } from "@/lib/auth-config";
import prisma from "../../../../lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Verify OTP
    if (!user.otpCode || user.otpCode !== otp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 });
    }

    // Verify Expiry
    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return NextResponse.json({ error: "OTP expired" }, { status: 401 });
    }

    // Clear OTP (Single use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      privileges: user.privileges,
    });

    const response = NextResponse.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    setAuthTokenCookie(response, token);

    return response;
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
