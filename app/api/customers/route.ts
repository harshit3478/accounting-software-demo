import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth";

function isStoreCreditCompatibilityError(error: any): boolean {
  const message = String(error?.message || "");
  return (
    message.includes("storeCredit") ||
    message.includes("Unknown arg") ||
    error?.code === "P2022"
  );
}

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
      let customers: any[] = [];
      try {
        customers = await prisma.customer.findMany({
          where,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            storeCredit: true,
          },
        });
      } catch (error: any) {
        if (!isStoreCreditCompatibilityError(error)) {
          throw error;
        }
        customers = await prisma.customer.findMany({
          where,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        });
      }

      return NextResponse.json(
        customers.map((c) => ({
          ...c,
          storeCredit: (c as any).storeCredit?.toNumber
            ? (c as any).storeCredit.toNumber()
            : ((c as any).storeCredit ?? 0),
        })),
      );
    }

    const sortBy = searchParams.get("sortBy") || "revenue";
    const sortDirection = (searchParams.get("sortDirection") || "desc") as
      | "asc"
      | "desc";
    const top = searchParams.get("top"); // e.g. "10" for top 10
    const pastDue = searchParams.get("pastDue") === "true";

    // Fetch customers with their invoices for stats calculation
    let customersRaw: any[] = [];
    const total = await prisma.customer.count({ where });
    try {
      customersRaw = await prisma.customer.findMany({
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
      });
    } catch (error: any) {
      if (!isStoreCreditCompatibilityError(error)) {
        throw error;
      }
      customersRaw = await prisma.customer.findMany({
        where,
        skip: top ? undefined : skip,
        take: top ? parseInt(top) : limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
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
      });
    }

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
            (now.getTime() - new Date(inv.dueDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (daysOverdue > 0) overdueCount++;
          if (daysOverdue > 60) aging60Plus += outstanding;
        }
      }

      const totalOutstanding = totalRevenue - totalPaid;
      const outstandingRatio =
        totalRevenue > 0 ? totalOutstanding / totalRevenue : 0;

      let healthScore: "green" | "yellow" | "red" = "green";
      if (aging60Plus > 0 || outstandingRatio > 0.5) {
        healthScore = "red";
      } else if (overdueCount > 0 || outstandingRatio > 0.3) {
        healthScore = "yellow";
      }

      // Determine if customer has past due invoices
      const hasPastDue = overdueCount > 0 || totalOutstanding > 0;

      // Remove raw invoices from response (keep only stats)
      const { invoices: _, ...customerData } = c;
      return {
        ...customerData,
        storeCredit: (c as any).storeCredit?.toNumber
          ? (c as any).storeCredit.toNumber()
          : ((c as any).storeCredit ?? 0),
        stats: {
          totalRevenue,
          totalPaid,
          totalOutstanding,
          lastActivityDate,
          healthScore,
          hasPastDue,
        },
      };
    });

    // Filter by past due if requested
    let filtered = customers;
    if (pastDue) {
      filtered = filtered.filter((c) => c.stats.hasPastDue);
    }

    // Sort
    filtered.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortBy) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "outstanding":
          return dir * (a.stats.totalOutstanding - b.stats.totalOutstanding);
        case "invoiceCount":
          return dir * (a._count.invoices - b._count.invoices);
        case "lastActivity":
          return (
            dir *
            ((a.stats.lastActivityDate?.getTime() || 0) -
              (b.stats.lastActivityDate?.getTime() || 0))
          );
        case "revenue":
        default:
          return dir * (a.stats.totalRevenue - b.stats.totalRevenue);
      }
    });

    return NextResponse.json({
      customers: filtered,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 },
    );
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
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 },
    );
  }
}
