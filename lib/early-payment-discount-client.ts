import {
  checkEarlyPaymentDiscountEligibility,
  EarlyPaymentDiscountSettingSnapshot,
  EarlyPaymentEligibilityResult,
  isEarlyPaymentDiscountConfigured,
} from "./early-payment-discount-shared";

export type {
  EarlyPaymentDiscountSettingSnapshot,
  EarlyPaymentEligibilityResult,
};

export { isEarlyPaymentDiscountConfigured };

export function normalizeEarlyDiscountInvoice(invoice: {
  isLayaway?: boolean;
  amount: number | string;
  paidAmount: number | string;
  earlyPaymentDiscount?: number | string | null;
  invoiceDate?: string | Date | null;
  createdAt?: string | Date | null;
  status?: string;
}) {
  return {
    isLayaway: !!invoice.isLayaway,
    amount: Number(invoice.amount ?? 0),
    paidAmount: Number(invoice.paidAmount ?? 0),
    earlyPaymentDiscount: Number(invoice.earlyPaymentDiscount ?? 0),
    invoiceDate: invoice.invoiceDate ?? null,
    createdAt: invoice.createdAt ?? null,
    status: invoice.status,
  };
}

export function getEarlyDiscountDisplayAmounts(
  invoice: {
    amount: number | string;
    paidAmount: number | string;
  },
  eligibility: EarlyPaymentEligibilityResult | null,
) {
  const grossAmount = Number(invoice.amount ?? 0);
  const paidAmount = Number(invoice.paidAmount ?? 0);
  const grossRemaining = Math.max(grossAmount - paidAmount, 0);
  const grossRemainingRounded = Math.round(grossRemaining * 100) / 100;

  if (!eligibility) {
    return {
      grossRemaining: grossRemainingRounded,
      netRemaining: grossRemainingRounded,
      displayRemaining: grossRemainingRounded,
      discountAmount: 0,
      showDiscount: false,
    };
  }

  const netTotal = Math.max(grossAmount - eligibility.discountAmount, 0);
  const netRemaining = Math.max(netTotal - paidAmount, 0);
  const netRemainingRounded = Math.round(netRemaining * 100) / 100;

  return {
    grossRemaining: grossRemainingRounded,
    netRemaining: netRemainingRounded,
    displayRemaining: netRemainingRounded,
    discountAmount: eligibility.discountAmount,
    showDiscount: netRemainingRounded + 0.01 < grossRemainingRounded,
  };
}

export function getEarlyPaymentDiscountEligibility(input: {
  invoice: {
    isLayaway?: boolean;
    amount: number | string;
    paidAmount: number | string;
    earlyPaymentDiscount?: number | string | null;
    invoiceDate?: string | Date | null;
    createdAt?: string | Date | null;
    status?: string;
  };
  paymentDate: string | Date;
  additionalPaymentAmount: number;
  setting?: EarlyPaymentDiscountSettingSnapshot | null;
}): EarlyPaymentEligibilityResult | null {
  return checkEarlyPaymentDiscountEligibility({
    invoice: normalizeEarlyDiscountInvoice(input.invoice),
    paymentDate: input.paymentDate,
    additionalPaymentAmount: input.additionalPaymentAmount,
    setting: input.setting,
  });
}
