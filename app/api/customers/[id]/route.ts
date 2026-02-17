import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";

// GET /api/customers/[id] — single customer with financial stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            clientName: true,
            amount: true,
            paidAmount: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Compute financial stats
    const now = new Date();
    let totalRevenue = 0;
    let totalPaid = 0;
    let agingCurrent = 0;
    let aging30 = 0;
    let aging60 = 0;
    let aging90 = 0;
    let lastActivityDate: Date | null = null;
    let overdueCount = 0;

    for (const inv of customer.invoices) {
      const amount = Number(inv.amount);
      const paid = Number(inv.paidAmount);
      const outstanding = amount - paid;
      totalRevenue += amount;
      totalPaid += paid;

      if (!lastActivityDate || new Date(inv.createdAt) > lastActivityDate) {
        lastActivityDate = new Date(inv.createdAt);
      }

      if (outstanding > 0 && inv.status !== "paid") {
        const dueDate = new Date(inv.dueDate);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysOverdue > 90) {
          aging90 += outstanding;
          overdueCount++;
        } else if (daysOverdue > 60) {
          aging60 += outstanding;
          overdueCount++;
        } else if (daysOverdue > 30) {
          aging30 += outstanding;
          overdueCount++;
        } else {
          agingCurrent += outstanding;
          if (daysOverdue > 0) overdueCount++;
        }
      }
    }

    const totalOutstanding = totalRevenue - totalPaid;
    const outstandingRatio = totalRevenue > 0 ? totalOutstanding / totalRevenue : 0;

    // Health score
    let healthScore: "green" | "yellow" | "red" = "green";
    if (aging60 + aging90 > 0 || outstandingRatio > 0.5) {
      healthScore = "red";
    } else if (aging30 > 0 || outstandingRatio > 0.3) {
      healthScore = "yellow";
    }

    return NextResponse.json({
      ...customer,
      stats: {
        totalRevenue,
        totalPaid,
        totalOutstanding,
        invoiceCount: customer.invoices.length,
        lastActivityDate,
        healthScore,
        aging: {
          current: agingCurrent,
          days30: aging30,
          days60: aging60,
          days90: aging90,
        },
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] — update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, email, phone, address, notes } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(customer);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] — delete customer (nullify invoice FKs)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Nullify customerId on linked invoices first
    await prisma.invoice.updateMany({
      where: { customerId: id },
      data: { customerId: null },
    });

    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({ message: "Customer deleted" });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
