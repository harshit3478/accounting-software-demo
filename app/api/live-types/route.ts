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
    const liveTypeModel = (prisma as any)?.liveType;

    if (!liveTypeModel) {
      return NextResponse.json(
        {
          error:
            "LiveType model is not available on Prisma client. Run migrations and regenerate Prisma client.",
        },
        { status: 500 },
      );
    }

    const where = activeOnly ? { isActive: true } : {};
    const liveTypes = await liveTypeModel.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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

    return NextResponse.json(liveTypes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { name, country, isActive, sortOrder } = await request.json();

    if (!name || !String(name).trim()) {
      throw new Error("Live type name is required");
    }

    if (!country || !String(country).trim()) {
      throw new Error("Country is required");
    }

    const created = await (prisma as any).liveType.create({
      data: {
        name: String(name).trim(),
        country: String(country).trim(),
        isActive: typeof isActive === "boolean" ? isActive : true,
        isDefault: false,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        createdBy: user.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This live type already exists" },
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

    const { id, name, country, isActive, sortOrder } = await request.json();
    const liveTypeId = Number(id);
    if (!Number.isFinite(liveTypeId)) {
      throw new Error("Invalid live type id");
    }

    const data: any = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        throw new Error("Live type name is required");
      }
      data.name = String(name).trim();
    }

    if (country !== undefined) {
      if (!String(country).trim()) {
        throw new Error("Country is required");
      }
      data.country = String(country).trim();
    }

    if (isActive !== undefined) {
      data.isActive = !!isActive;
    }

    if (sortOrder !== undefined) {
      const parsedSort = Number(sortOrder);
      data.sortOrder = Number.isFinite(parsedSort) ? parsedSort : 0;
    }

    const updated = await (prisma as any).liveType.update({
      where: { id: liveTypeId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This live type already exists" },
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
    const liveTypeId = Number(id);
    if (!Number.isFinite(liveTypeId)) {
      throw new Error("Invalid live type id");
    }

    await (prisma as any).liveType.delete({ where: { id: liveTypeId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
