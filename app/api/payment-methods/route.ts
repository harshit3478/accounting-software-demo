import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, requireAdmin } from "../../../lib/auth";

// GET /api/payment-methods — list all (active by default, or all for admin)
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("all") === "true";

    const methods = await prisma.paymentMethodEntry.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(methods);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
}

// POST /api/payment-methods — create (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { name, icon, color } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get next sort order
    const maxSort = await prisma.paymentMethodEntry.aggregate({ _max: { sortOrder: true } });
    const nextSort = (maxSort._max.sortOrder || 0) + 1;

    const method = await prisma.paymentMethodEntry.create({
      data: {
        name: name.trim(),
        icon: icon || null,
        color: color || "#6B7280",
        sortOrder: nextSort,
      },
    });

    return NextResponse.json(method, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A payment method with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create payment method" }, { status: 500 });
  }
}

// PUT /api/payment-methods — update (admin only, expects id in body)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, name, icon, color, isActive, sortOrder } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Check if system method — can't rename or delete system methods
    const existing = await prisma.paymentMethodEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    const data: any = {};
    if (name !== undefined) {
      if (existing.isSystem && name !== existing.name) {
        return NextResponse.json({ error: "Cannot rename system payment methods" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (icon !== undefined) data.icon = icon;
    if (color !== undefined) data.color = color;
    if (isActive !== undefined) {
      if (existing.isSystem && !isActive) {
        return NextResponse.json({ error: "Cannot deactivate system payment methods" }, { status: 400 });
      }
      data.isActive = isActive;
    }
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const method = await prisma.paymentMethodEntry.update({
      where: { id },
      data,
    });

    return NextResponse.json(method);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A payment method with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update payment method" }, { status: 500 });
  }
}

// DELETE /api/payment-methods — delete (admin only, expects id in body)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const existing = await prisma.paymentMethodEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }
    if (existing.isSystem) {
      return NextResponse.json({ error: "Cannot delete system payment methods" }, { status: 400 });
    }

    // Check if any payments use this method
    const paymentCount = await prisma.payment.count({ where: { methodId: id } });
    if (paymentCount > 0) {
      // Soft delete instead
      await prisma.paymentMethodEntry.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: "Payment method deactivated (has existing payments)", deactivated: true });
    }

    await prisma.paymentMethodEntry.delete({ where: { id } });
    return NextResponse.json({ message: "Payment method deleted" });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete payment method" }, { status: 500 });
  }
}
