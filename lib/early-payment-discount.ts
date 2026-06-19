import prisma from "./prisma";
import { Prisma } from "@prisma/client";

export type EarlyPaymentThreshold = "full" | "half";

export interface EarlyPaymentDiscountSettingSnapshot {
  daysWindow: number;
  discountPercent: number;
  paymentThreshold: EarlyPaymentThreshold;
  isActive: boolean;
}

const DEFAULT_SETTING: EarlyPaymentDiscountSettingSnapshot = {
  daysWindow: 0,
  discountPercent: 0,
  paymentThreshold: "full",
  isActive: false,
};

export function isEarlyPaymentDiscountConfigured(
  setting?: EarlyPaymentDiscountSettingSnapshot | null,
): boolean {
  if (!setting?.isActive) return false;
  return setting.daysWindow > 0 && setting.discountPercent > 0;
}

export async function getEarlyPaymentDiscountSettingSnapshot(): Promise<EarlyPaymentDiscountSettingSnapshot> {
  const model = (prisma as any)?.earlyPaymentDiscountSetting;
  if (!model) {
    return DEFAULT_SETTING;
  }

  const row = await model.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!row) {
    return DEFAULT_SETTING;
  }

  const threshold =
    row.paymentThreshold === "half" ? "half" : ("full" as EarlyPaymentThreshold);

  return {
    daysWindow: Number(row.daysWindow ?? 0),
    discountPercent: Number(row.discountPercent ?? 0),
    paymentThreshold: threshold,
    isActive: !!row.isActive,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

function getLatestPaymentDate(invoice: {
  payments: Array<{ paymentDate: Date; source?: string | null }>;
  paymentMatches?: Array<{ payment: { paymentDate: Date } | null }>;
}): Date | null {
  const dates: Date[] = [];

  for (const payment of invoice.payments) {
    if (payment.source === "store_credit_applied") continue;
    dates.push(new Date(payment.paymentDate));
  }

  for (const match of invoice.paymentMatches || []) {
    if (match.payment?.paymentDate) {
      dates.push(new Date(match.payment.paymentDate));
    }
  }

  if (dates.length === 0) return null;

  return dates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}

export async function maybeApplyEarlyPaymentDiscount(
  tx: any,
  input: {
    invoice: {
      id: number;
      invoiceNumber: string;
      amount: Prisma.Decimal | number;
      paidAmount: Prisma.Decimal | number;
      earlyPaymentDiscount: Prisma.Decimal | number;
      status: string;
      invoiceDate: Date;
      createdAt: Date;
      payments: Array<{ paymentDate: Date; source?: string | null }>;
      paymentMatches?: Array<{ payment: { paymentDate: Date } | null }>;
    };
    totalPaid: number;
    setting?: EarlyPaymentDiscountSettingSnapshot;
  },
): Promise<number | null> {
  const setting =
    input.setting ?? (await getEarlyPaymentDiscountSettingSnapshot());

  if (!isEarlyPaymentDiscountConfigured(setting)) {
    return null;
  }

  const invoice = input.invoice;
  if (invoice.status === "abandoned" || invoice.status === "inactive") {
    return null;
  }

  const existingDiscount = Number(
    invoice.earlyPaymentDiscount?.toNumber?.() ??
      invoice.earlyPaymentDiscount ??
      0,
  );
  if (existingDiscount > 0) {
    return null;
  }

  const invoiceAmount = Number(
    invoice.amount?.toNumber?.() ?? invoice.amount ?? 0,
  );
  if (invoiceAmount <= 0) {
    return null;
  }

  const thresholdAmount =
    setting.paymentThreshold === "half"
      ? roundMoney(invoiceAmount / 2)
      : invoiceAmount;

  if (input.totalPaid + 0.01 < thresholdAmount) {
    return null;
  }

  const invoiceStartDate = new Date(invoice.invoiceDate || invoice.createdAt);
  const latestPaymentDate = getLatestPaymentDate(invoice);
  if (!latestPaymentDate) {
    return null;
  }

  if (daysBetween(invoiceStartDate, latestPaymentDate) > setting.daysWindow) {
    return null;
  }

  const discountAmount = roundMoney(
    (invoiceAmount * setting.discountPercent) / 100,
  );
  if (discountAmount <= 0) {
    return null;
  }

  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      earlyPaymentDiscount: discountAmount,
      amount: roundMoney(Math.max(invoiceAmount - discountAmount, 0)),
    },
  });

  return discountAmount;
}
