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

    const sortBy = searchParams.get("sortBy") || "revenue";
    const top = searchParams.get("top"); // e.g. "10" for top 10

    // Fetch customers with their invoices for stats calculation
    const [customersRaw, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: top ? undefined : skip,
        take: top ? parseInt(top) : limit,
        include: {
          _count: { select: { invoices: true } },
          invoices: {
            select: {
              amount: true,
              paidAmount: true,
              status: true,
              dueDate: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const now = new Date();

    // Compute stats per customer
    const customers = customersRaw.map((c) => {
      let totalRevenue = 0;
      let totalPaid = 0;
      let lastActivityDate: Date | null = null;
      let overdueCount = 0;
      let aging60Plus = 0;

      for (const inv of c.invoices) {
        const amount = Number(inv.amount);
        const paid = Number(inv.paidAmount);
        totalRevenue += amount;
        totalPaid += paid;

        if (!lastActivityDate || new Date(inv.createdAt) > lastActivityDate) {
          lastActivityDate = new Date(inv.createdAt);
        }

        const outstanding = amount - paid;
        if (outstanding > 0 && inv.status !== "paid") {
          const daysOverdue = Math.floor(
            (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysOverdue > 0) overdueCount++;
          if (daysOverdue > 60) aging60Plus += outstanding;
        }
      }

      const totalOutstanding = totalRevenue - totalPaid;
      const outstandingRatio = totalRevenue > 0 ? totalOutstanding / totalRevenue : 0;

      let healthScore: "green" | "yellow" | "red" = "green";
      if (aging60Plus > 0 || outstandingRatio > 0.5) {
        healthScore = "red";
      } else if (overdueCount > 0 || outstandingRatio > 0.3) {
        healthScore = "yellow";
      }

      // Remove raw invoices from response (keep only stats)
      const { invoices: _, ...customerData } = c;
      return {
        ...customerData,
        stats: {
          totalRevenue,
          totalPaid,
          totalOutstanding,
          lastActivityDate,
          healthScore,
        },
      };
    });

    // Sort
    customers.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "outstanding":
          return b.stats.totalOutstanding - a.stats.totalOutstanding;
        case "invoiceCount":
          return b._count.invoices - a._count.invoices;
        case "lastActivity":
          return (
            (b.stats.lastActivityDate?.getTime() || 0) -
            (a.stats.lastActivityDate?.getTime() || 0)
          );
        case "revenue":
        default:
          return b.stats.totalRevenue - a.stats.totalRevenue;
      }
    });

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
