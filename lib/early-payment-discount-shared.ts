export type EarlyPaymentThreshold = "full" | "half";

export interface EarlyPaymentDiscountSettingSnapshot {
  daysWindow: number;
  discountPercent: number;
  paymentThreshold: EarlyPaymentThreshold;
  isActive: boolean;
}

export function isEarlyPaymentDiscountConfigured(
  setting?: EarlyPaymentDiscountSettingSnapshot | null,
): boolean {
  if (!setting?.isActive) return false;
  return setting.daysWindow > 0 && setting.discountPercent > 0;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

import { daysBetweenBusiness as daysBetween } from "./business-date";

export { daysBetween };

export function calculateEarlyPaymentDiscountAmount(
  invoiceAmount: number,
  discountPercent: number,
): number {
  return roundMoney((invoiceAmount * discountPercent) / 100);
}

export interface EarlyPaymentEligibilityInput {
  invoice: {
    isLayaway?: boolean;
    amount: number;
    paidAmount: number;
    earlyPaymentDiscount?: number;
    invoiceDate?: Date | string | null;
    createdAt?: Date | string | null;
    status?: string;
  };
  additionalPaymentAmount: number;
  paymentDate: Date | string;
  setting?: EarlyPaymentDiscountSettingSnapshot | null;
}

export interface EarlyPaymentEligibilityResult {
  eligible: boolean;
  discountAmount: number;
  discountPercent: number;
  daysWindow: number;
  storeCreditAmount: number;
}

export function checkEarlyPaymentDiscountEligibility(
  input: EarlyPaymentEligibilityInput,
): EarlyPaymentEligibilityResult | null {
  const setting = input.setting;
  if (!isEarlyPaymentDiscountConfigured(setting)) {
    return null;
  }

  const invoice = input.invoice;
  if (invoice.isLayaway) {
    return null;
  }

  if (invoice.status === "abandoned" || invoice.status === "inactive") {
    return null;
  }

  const existingDiscount = Number(invoice.earlyPaymentDiscount ?? 0);
  if (existingDiscount > 0) {
    return null;
  }

  const invoiceAmount = Number(invoice.amount);
  if (invoiceAmount <= 0) {
    return null;
  }

  const discountAmount = calculateEarlyPaymentDiscountAmount(
    invoiceAmount,
    setting!.discountPercent,
  );
  if (discountAmount <= 0) {
    return null;
  }

  const projectedTotalPaid =
    Number(invoice.paidAmount) + input.additionalPaymentAmount;
  const thresholdAmount =
    setting!.paymentThreshold === "half"
      ? roundMoney(invoiceAmount / 2)
      : roundMoney(Math.max(invoiceAmount - discountAmount, 0));

  if (projectedTotalPaid + 0.01 < thresholdAmount) {
    return null;
  }

  const invoiceStartDate = new Date(
    invoice.invoiceDate || invoice.createdAt || new Date(),
  );
  const paymentDate = new Date(input.paymentDate);
  if (
    Number.isNaN(invoiceStartDate.getTime()) ||
    Number.isNaN(paymentDate.getTime())
  ) {
    return null;
  }

  if (daysBetween(invoiceStartDate, paymentDate) > setting!.daysWindow) {
    return null;
  }

  const adjustedInvoiceAmount = roundMoney(
    Math.max(invoiceAmount - discountAmount, 0),
  );
  const storeCreditAmount = roundMoney(
    Math.max(projectedTotalPaid - adjustedInvoiceAmount, 0),
  );

  return {
    eligible: true,
    discountAmount,
    discountPercent: setting!.discountPercent,
    daysWindow: setting!.daysWindow,
    storeCreditAmount,
  };
}
