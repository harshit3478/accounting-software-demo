export const CREDIT_CARD_PROCESSING_FEE_MAX_RATIO = 0.07;

export function isCreditCardPaymentMethod(methodName?: string | null): boolean {
  const name = (methodName || "").trim().toLowerCase();
  if (!name) return false;
  return (
    name.includes("card") ||
    name.includes("credit") ||
    name.includes("visa") ||
    name.includes("mastercard") ||
    name.includes("master card") ||
    name.includes("amex") ||
    name.includes("american express")
  );
}

export function isProcessingFeeSuggestablePayment(input: {
  quickbooksId?: string | null;
  source?: string | null;
  methodName?: string | null;
}): boolean {
  if (input.quickbooksId) return true;
  if (input.source === "quickbooks_import") return true;
  return isCreditCardPaymentMethod(input.methodName);
}

export function getCreditCardProcessingFeeSuggestion(input: {
  paymentTotal: number;
  amountToLink: number;
  paymentAvailable?: number;
  quickbooksId?: string | null;
  source?: string | null;
  methodName?: string | null;
}): {
  eligible: boolean;
  overage: number;
  maxSuggestable: number;
} {
  const paymentTotal = Number(input.paymentTotal || 0);
  const amountToLink = Number(input.amountToLink || 0);
  const available = Number(
    input.paymentAvailable != null ? input.paymentAvailable : paymentTotal,
  );
  const overage = Number(Math.max(available - amountToLink, 0).toFixed(2));
  const maxSuggestable = Number(
    (paymentTotal * CREDIT_CARD_PROCESSING_FEE_MAX_RATIO).toFixed(2),
  );
  const eligible =
    isProcessingFeeSuggestablePayment(input) &&
    overage > 0.009 &&
    overage <= maxSuggestable + 0.001;

  return { eligible, overage, maxSuggestable };
}
