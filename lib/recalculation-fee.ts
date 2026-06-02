import prisma from "./prisma";
import { calculateRecalculationFeeAmount } from "./recalculation-fee-calculator";

export interface RecalculationFeeSettingSnapshot {
  ratePercent: number;
  isActive: boolean;
}

export async function getRecalculationFeeSettingSnapshot(): Promise<RecalculationFeeSettingSnapshot> {
  const row = await prisma.recalculationFeeSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!row) {
    return { ratePercent: 0, isActive: false };
  }

  return {
    ratePercent: Number(row.ratePercent ?? 0),
    isActive: !!row.isActive,
  };
}

export { calculateRecalculationFeeAmount };
