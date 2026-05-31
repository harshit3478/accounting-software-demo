import prisma from "./prisma";

export interface RecalculationFeeSettingSnapshot {
  ratePercent: number;
  isActive: boolean;
}

export async function getRecalculationFeeSettingSnapshot(): Promise<RecalculationFeeSettingSnapshot> {
  const rateModel = (prisma as any)?.recalculationFeeSetting;
  if (!rateModel) {
    return { ratePercent: 0, isActive: false };
  }

  const row = await rateModel.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!row) {
    return { ratePercent: 0, isActive: false };
  }

  return {
    ratePercent: Number(row.ratePercent ?? 0),
    isActive: !!row.isActive,
  };
}

export function calculateRecalculationFeeAmount(
  remainingAmount: number,
  ratePercent: number,
) {
  const safeRemaining = Math.max(0, Number(remainingAmount) || 0);
  const safeRate = Math.max(0, Number(ratePercent) || 0);
  return Number(((safeRemaining * safeRate) / 100).toFixed(2));
}
