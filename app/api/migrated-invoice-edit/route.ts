import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, requireSettingPermission } from "../../../lib/auth";
import { getMigratedInvoiceEditSettingSnapshot } from "../../../lib/migrated-invoice-edit";

export async function GET() {
  try {
    await requireAuth();
    const setting = await getMigratedInvoiceEditSettingSnapshot();
    return NextResponse.json(setting);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSettingPermission("migrated-invoice-edit");

    const body = await request.json();
    const isActive = !!body?.isActive;

    const model = (prisma as any)?.migratedInvoiceEditSetting;
    if (!model) {
      return NextResponse.json(
        { error: "MigratedInvoiceEditSetting model is not available" },
        { status: 500 },
      );
    }

    await model.deleteMany({});
    const row = await model.create({
      data: { isActive },
    });

    return NextResponse.json({
      id: row.id,
      isActive: row.isActive,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
