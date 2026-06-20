import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { normalizeCustomerEmail } from "@/lib/customer-email";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const email = normalizeCustomerEmail(searchParams.get("email"));

    if (!email) {
      return NextResponse.json({ customer: null });
    }

    const customer = await prisma.customer.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

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
