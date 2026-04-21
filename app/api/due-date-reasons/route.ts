import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, isSuperAdmin } from "../../../lib/auth";

function ensureAdminOrSuper(user: any) {
  if (user.role !== "admin" && !isSuperAdmin(user)) {
    throw new Error("Forbidden");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const reasonModel = (prisma as any)?.dueDateReason;
    if (!reasonModel) {
      return NextResponse.json(
        {
          error:
            "DueDateReason model is not available on Prisma client. Run migrations and regenerate Prisma client.",
        },
        { status: 500 },
      );
    }

    const where = activeOnly ? { isActive: true } : {};
    const reasons = await reasonModel.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(reasons);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { reason, isActive, sortOrder } = await request.json();

    if (!reason || !String(reason).trim()) {
      throw new Error("Reason is required");
    }

    const created = await (prisma as any).dueDateReason.create({
      data: {
        reason: String(reason).trim(),
        isActive: typeof isActive === "boolean" ? isActive : true,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        createdBy: user.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This due date reason already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { id, reason, isActive, sortOrder } = await request.json();

    const reasonId = Number(id);
    if (!Number.isFinite(reasonId)) {
      throw new Error("Invalid reason id");
    }

    const data: any = {};

    if (reason !== undefined) {
      if (!String(reason).trim()) {
        throw new Error("Reason is required");
      }
      data.reason = String(reason).trim();
    }

    if (isActive !== undefined) {
      data.isActive = !!isActive;
    }

    if (sortOrder !== undefined) {
      const parsedSort = Number(sortOrder);
      data.sortOrder = Number.isFinite(parsedSort) ? parsedSort : 0;
    }

    const updated = await (prisma as any).dueDateReason.update({
      where: { id: reasonId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This due date reason already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { id } = await request.json();
    const reasonId = Number(id);
    if (!Number.isFinite(reasonId)) {
      throw new Error("Invalid reason id");
    }

    await (prisma as any).dueDateReason.delete({ where: { id: reasonId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
