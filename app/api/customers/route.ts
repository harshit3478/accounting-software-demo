import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth";

// GET /api/customers — list with search + pagination
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;
    const all = searchParams.get("all") === "true";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (all) {
      // Return all customers (for autocomplete dropdowns)
      const customers = await prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, phone: true },
      });
      return NextResponse.json(customers);
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: { _count: { select: { invoices: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

// POST /api/customers — create
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { name, email, phone, address, notes } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
