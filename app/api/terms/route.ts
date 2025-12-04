import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, isSuperAdmin } from "../../../lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    // Anyone authenticated can fetch terms (UI will restrict create/edit)
    const termModel = (prisma as any)?.term;
    if (!termModel) {
      return NextResponse.json(
        {
          error:
            "Term model is not available on Prisma client. Run `npx prisma migrate dev` and `npx prisma generate`.",
        },
        { status: 500 }
      );
    }

    const terms = await termModel.findMany({
      orderBy: { updatedAt: "desc" },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(terms);
  } catch (error: any) {
    console.error("GET /api/terms error:", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admin / superadmin can create default terms or manage terms
    if (user.role !== "admin" && !isSuperAdmin(user))
      throw new Error("Forbidden");

    const { title, lines, isDefault } = await request.json();

    if (!Array.isArray(lines) || lines.length === 0) {
      throw new Error("Terms must contain at least one line");
    }

    const limited = lines.slice(0, 5);

    const termModel = (prisma as any)?.term;
    if (!termModel) {
      return NextResponse.json(
        {
          error:
            "Term model is not available on Prisma client. Run `npx prisma migrate dev` and `npx prisma generate`.",
        },
        { status: 500 }
      );
    }

    const created = await termModel.create({
      data: {
        title: title || null,
        lines: limited,
        isDefault: !!isDefault,
        createdBy: user.id,
      },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    console.error("Create term error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "admin" && !isSuperAdmin(user))
      throw new Error("Forbidden");

    const { id, title, lines, isDefault } = await request.json();
    if (!id) throw new Error("Missing id");

    const limited = Array.isArray(lines) ? lines.slice(0, 5) : undefined;

    const termModel = (prisma as any)?.term;
    if (!termModel) {
      return NextResponse.json(
        {
          error:
            "Term model is not available on Prisma client. Run `npx prisma migrate dev` and `npx prisma generate`.",
        },
        { status: 500 }
      );
    }

    const updated = await termModel.update({
      where: { id },
      data: {
        title: title || undefined,
        lines: limited as any,
        isDefault: typeof isDefault === "boolean" ? isDefault : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update term error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "admin" && !isSuperAdmin(user))
      throw new Error("Forbidden");

    const { id } = await request.json();
    if (!id) throw new Error("Missing id");

    const termModel = (prisma as any)?.term;
    if (!termModel) {
      return NextResponse.json(
        {
          error:
            "Term model is not available on Prisma client. Run `npx prisma migrate dev` and `npx prisma generate`.",
        },
        { status: 500 }
      );
    }

    await termModel.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete term error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
