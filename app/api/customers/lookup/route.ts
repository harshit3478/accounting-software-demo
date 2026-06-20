import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findCustomerByEmail } from "@/lib/customer-email";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email?.trim()) {
      return NextResponse.json({ customer: null });
    }

    const customer = await findCustomerByEmail(prisma, email);

    return NextResponse.json({ customer });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
