import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, requireSettingPermission } from "../../../lib/auth";

async function ensureDefaultUnit() {
  const unitModel = (prisma as any).invoiceUnit;
  const existing = await unitModel.findFirst({ where: { name: "grams" } });
  if (!existing) {
    await unitModel.create({
      data: {
        name: "grams",
        isActive: true,
        isDefault: true,
        isSystem: true,
        sortOrder: 1,
      },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("all") === "true";

    await ensureDefaultUnit();

    const units = await (prisma as any).invoiceUnit.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(units);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch units" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSettingPermission("units");
    const body = await request.json();
    const { name, sortOrder } = body;

    if (!name || String(name).trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const unit = await (prisma as any).invoiceUnit.create({
      data: {
        name: String(name).trim(),
        isActive: true,
        isDefault: false,
        isSystem: false,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A unit with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create unit" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSettingPermission("units");
    const body = await request.json();
    const { id, name, isActive, sortOrder } = body;

    const unitId = Number(id);
    if (!Number.isFinite(unitId)) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const existing = await (prisma as any).invoiceUnit.findUnique({
      where: { id: unitId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (
      existing.isSystem &&
      name !== undefined &&
      String(name).trim() !== existing.name
    ) {
      return NextResponse.json(
        { error: "Cannot rename system unit" },
        { status: 400 },
      );
    }
    if (existing.isSystem && isActive === false) {
      return NextResponse.json(
        { error: "Cannot deactivate system unit" },
        { status: 400 },
      );
    }

    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (isActive !== undefined) data.isActive = !!isActive;
    if (sortOrder !== undefined) {
      const parsed = Number(sortOrder);
      data.sortOrder = Number.isFinite(parsed) ? parsed : 0;
    }

    const unit = await (prisma as any).invoiceUnit.update({
      where: { id: unitId },
      data,
    });

    return NextResponse.json(unit);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A unit with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update unit" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSettingPermission("units");
    const body = await request.json();
    const unitId = Number(body?.id);
    if (!Number.isFinite(unitId)) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const existing = await (prisma as any).invoiceUnit.findUnique({
      where: { id: unitId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }
    if (existing.isSystem) {
      return NextResponse.json(
        { error: "Cannot delete system unit" },
        { status: 400 },
      );
    }

    await (prisma as any).invoiceUnit.delete({ where: { id: unitId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete unit" },
      { status: 500 },
    );
  }
}
