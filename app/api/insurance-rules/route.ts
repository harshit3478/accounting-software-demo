import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, isSuperAdmin } from "../../../lib/auth";
import { DEFAULT_INSURANCE_BANDS } from "../../../lib/insurance";

function ensureAdminOrSuper(user: any) {
  if (user.role !== "admin" && !isSuperAdmin(user)) {
    throw new Error("Forbidden");
  }
}

async function ensureDefaultRules() {
  const ruleModel = (prisma as any)?.insuranceRule;
  if (!ruleModel) return;

  const existingCount = await ruleModel.count();
  if (existingCount > 0) return;

  await ruleModel.createMany({
    data: DEFAULT_INSURANCE_BANDS.map((band, index) => ({
      maxValue: band.maxValue,
      clientShare: band.clientShare,
      sortOrder: index,
    })),
  });
}

export async function GET() {
  try {
    await requireAuth();

    const ruleModel = (prisma as any)?.insuranceRule;
    if (!ruleModel) {
      return NextResponse.json(
        {
          error:
            "InsuranceRule model is not available on Prisma client. Run migrations and regenerate Prisma client.",
        },
        { status: 500 },
      );
    }

    await ensureDefaultRules();

    const rules = await ruleModel.findMany({
      orderBy: [{ sortOrder: "asc" }, { maxValue: "asc" }],
    });

    return NextResponse.json(
      rules.map((r: any) => ({
        ...r,
        maxValue: r.maxValue?.toNumber ? r.maxValue.toNumber() : r.maxValue,
        clientShare: r.clientShare?.toNumber
          ? r.clientShare.toNumber()
          : r.clientShare,
      })),
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { id, clientShare } = await request.json();

    const ruleId = Number(id);
    if (!Number.isFinite(ruleId)) {
      throw new Error("Invalid rule id");
    }

    const parsedShare = Number(clientShare);
    if (!Number.isFinite(parsedShare) || parsedShare < 0) {
      throw new Error("Client share must be a valid non-negative number");
    }

    const updated = await (prisma as any).insuranceRule.update({
      where: { id: ruleId },
      data: { clientShare: parsedShare },
    });

    return NextResponse.json({
      ...updated,
      maxValue: updated.maxValue?.toNumber
        ? updated.maxValue.toNumber()
        : updated.maxValue,
      clientShare: updated.clientShare?.toNumber
        ? updated.clientShare.toNumber()
        : updated.clientShare,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
