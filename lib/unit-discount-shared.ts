import { roundMoney } from "./early-payment-discount-shared";
import {
  formatBusinessDate,
  getBusinessTodayString,
  toBusinessDateStringFromInput,
} from "./business-date";

export { roundMoney };

export interface UnitDiscountSettingSnapshot {
  id?: number;
  unitName: string;
  discountPercent: number;
  periodStart: string;
  periodEnd: string;
  paymentDueDate: string;
  isActive?: boolean;
}

export interface UnitDiscountBreakdownLine {
  unitName: string;
  discountPercent: number;
  itemAmount: number;
  discountAmount: number;
}

export interface UnitDiscountOfferSnapshot {
  paymentDueDate: string;
  totalDiscount: number;
  breakdown: UnitDiscountBreakdownLine[];
}

export interface UnitDiscountItemLike {
  unit?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
}

export function normalizeUnitKey(unitName: string): string {
  return String(unitName || "")
    .trim()
    .toLowerCase();
}

export function parseUnitDiscountOffer(
  value: unknown,
): UnitDiscountOfferSnapshot | null {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const raw = parsed as {
    paymentDueDate?: unknown;
    totalDiscount?: unknown;
    breakdown?: unknown;
  };

  const paymentDueDate = toBusinessDateStringFromInput(
    String(raw.paymentDueDate || ""),
  );
  const totalDiscount = roundMoney(Number(raw.totalDiscount || 0));
  const breakdown = Array.isArray(raw.breakdown)
    ? raw.breakdown
        .map((line) => {
          if (!line || typeof line !== "object") return null;
          const row = line as {
            unitName?: unknown;
            discountPercent?: unknown;
            itemAmount?: unknown;
            discountAmount?: unknown;
          };
          const unitName = String(row.unitName || "").trim();
          const discountAmount = roundMoney(Number(row.discountAmount || 0));
          if (!unitName || discountAmount <= 0) return null;
          return {
            unitName,
            discountPercent: Number(row.discountPercent || 0),
            itemAmount: roundMoney(Number(row.itemAmount || 0)),
            discountAmount,
          } satisfies UnitDiscountBreakdownLine;
        })
        .filter((line): line is UnitDiscountBreakdownLine => line !== null)
    : [];

  if (!paymentDueDate || totalDiscount <= 0 || breakdown.length === 0) {
    return null;
  }

  return {
    paymentDueDate,
    totalDiscount,
    breakdown,
  };
}

export function isCivilDateInInclusiveRange(
  date: string | Date | null | undefined,
  start: string,
  end: string,
): boolean {
  const value = date ? toBusinessDateStringFromInput(date) : "";
  if (!value || !start || !end) return false;
  return value >= start && value <= end;
}

export function calculateUnitDiscountOffer(input: {
  items?: UnitDiscountItemLike[] | null;
  invoiceDate?: string | Date | null;
  isLayaway?: boolean;
  settings?: UnitDiscountSettingSnapshot[] | null;
}): UnitDiscountOfferSnapshot | null {
  if (input.isLayaway) return null;

  const settings = (input.settings || [])
    .map((setting) => ({
      ...setting,
      periodStart: toBusinessDateStringFromInput(setting.periodStart || ""),
      periodEnd: toBusinessDateStringFromInput(setting.periodEnd || ""),
      paymentDueDate: toBusinessDateStringFromInput(
        setting.paymentDueDate || "",
      ),
    }))
    .filter(
      (setting) =>
        setting?.isActive !== false &&
        Number(setting.discountPercent) > 0 &&
        setting.periodStart &&
        setting.periodEnd &&
        setting.paymentDueDate,
    );
  if (settings.length === 0) return null;

  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0) return null;

  const amountsByUnit = new Map<string, { unitName: string; amount: number }>();
  for (const item of items) {
    const unitName = String(item.unit || "grams").trim() || "grams";
    const lineAmount = roundMoney(
      Number(item.quantity || 0) * Number(item.price || 0),
    );
    if (lineAmount <= 0) continue;
    const key = normalizeUnitKey(unitName);
    const existing = amountsByUnit.get(key);
    if (existing) {
      existing.amount = roundMoney(existing.amount + lineAmount);
    } else {
      amountsByUnit.set(key, { unitName, amount: lineAmount });
    }
  }

  if (amountsByUnit.size === 0) return null;

  const matchedByUnit = new Map<
    string,
    {
      setting: UnitDiscountSettingSnapshot;
      itemAmount: number;
      unitName: string;
    }
  >();

  for (const [unitKey, unitAmount] of amountsByUnit.entries()) {
    const setting = settings.find(
      (row) =>
        normalizeUnitKey(row.unitName) === unitKey &&
        isCivilDateInInclusiveRange(
          input.invoiceDate,
          row.periodStart,
          row.periodEnd,
        ),
    );
    if (!setting) continue;
    matchedByUnit.set(unitKey, {
      setting,
      itemAmount: unitAmount.amount,
      unitName: unitAmount.unitName,
    });
  }

  if (matchedByUnit.size === 0) return null;

  const breakdown: UnitDiscountBreakdownLine[] = [];
  let paymentDueDate = "";

  for (const match of matchedByUnit.values()) {
    const discountAmount = roundMoney(
      (match.itemAmount * Number(match.setting.discountPercent)) / 100,
    );
    if (discountAmount <= 0) continue;
    breakdown.push({
      unitName: match.unitName,
      discountPercent: Number(match.setting.discountPercent),
      itemAmount: match.itemAmount,
      discountAmount,
    });
    if (!paymentDueDate || match.setting.paymentDueDate < paymentDueDate) {
      paymentDueDate = match.setting.paymentDueDate;
    }
  }

  const totalDiscount = roundMoney(
    breakdown.reduce((sum, line) => sum + line.discountAmount, 0),
  );
  if (!paymentDueDate || totalDiscount <= 0) return null;

  return {
    paymentDueDate,
    totalDiscount,
    breakdown,
  };
}

export function isUnitDiscountOfferOpen(
  offer: UnitDiscountOfferSnapshot | null | undefined,
  paymentDate?: string | Date | null,
): boolean {
  if (!offer) return false;
  const compareDate = paymentDate
    ? toBusinessDateStringFromInput(paymentDate)
    : getBusinessTodayString();
  if (!compareDate) return false;
  return compareDate <= offer.paymentDueDate;
}

export function getUnitDiscountDisplayState(input: {
  isLayaway?: boolean;
  status?: string;
  amount?: number | string | null;
  paidAmount?: number | string | null;
  unitDiscountAmount?: number | string | null;
  unitDiscountOffer?: unknown;
  paymentDate?: string | Date | null;
  additionalPaymentAmount?: number;
}): {
  offer: UnitDiscountOfferSnapshot | null;
  appliedAmount: number;
  applied: boolean;
  pending: boolean;
  expired: boolean;
  wouldApply: boolean;
  discountedTotal: number;
  remainingAfterDiscount: number;
} {
  const offer = parseUnitDiscountOffer(input.unitDiscountOffer);
  const appliedAmount = roundMoney(Number(input.unitDiscountAmount || 0));
  const amount = roundMoney(Number(input.amount || 0));
  const paidAmount = roundMoney(Number(input.paidAmount || 0));
  const applied = appliedAmount > 0;
  const blocked =
    !!input.isLayaway ||
    input.status === "abandoned" ||
    input.status === "inactive";

  if (!offer || blocked) {
    return {
      offer: applied ? offer : null,
      appliedAmount,
      applied,
      pending: false,
      expired: false,
      wouldApply: false,
      discountedTotal: amount,
      remainingAfterDiscount: roundMoney(Math.max(amount - paidAmount, 0)),
    };
  }

  const discountedTotal = applied
    ? amount
    : roundMoney(Math.max(amount - offer.totalDiscount, 0));
  const remainingAfterDiscount = roundMoney(
    Math.max(discountedTotal - paidAmount, 0),
  );
  const stillOpen = isUnitDiscountOfferOpen(offer, input.paymentDate);
  const pending = !applied && stillOpen;
  const expired = !applied && !stillOpen;
  const projectedPaid =
    paidAmount + roundMoney(Number(input.additionalPaymentAmount || 0));
  const wouldApply =
    pending && projectedPaid + 0.01 >= discountedTotal && stillOpen;

  return {
    offer,
    appliedAmount,
    applied,
    pending,
    expired,
    wouldApply,
    discountedTotal,
    remainingAfterDiscount,
  };
}

export function resolveUnitDiscountOffer(input: {
  items?: UnitDiscountItemLike[] | null;
  invoiceDate?: string | Date | null;
  isLayaway?: boolean;
  unitDiscountOffer?: unknown;
  settings?: UnitDiscountSettingSnapshot[] | null;
}): UnitDiscountOfferSnapshot | null {
  return (
    parseUnitDiscountOffer(input.unitDiscountOffer) ||
    calculateUnitDiscountOffer({
      items: input.items,
      invoiceDate: input.invoiceDate,
      isLayaway: input.isLayaway,
      settings: input.settings,
    })
  );
}

export function getUnitDiscountedRemaining(input: {
  isLayaway?: boolean;
  status?: string;
  amount?: number | string | null;
  paidAmount?: number | string | null;
  unitDiscountAmount?: number | string | null;
  unitDiscountOffer?: unknown;
  paymentDate?: string | Date | null;
  items?: UnitDiscountItemLike[] | null;
  invoiceDate?: string | Date | null;
  settings?: UnitDiscountSettingSnapshot[] | null;
}): number {
  const grossRemaining = roundMoney(
    Math.max(Number(input.amount || 0) - Number(input.paidAmount || 0), 0),
  );
  const offer = resolveUnitDiscountOffer(input);
  const state = getUnitDiscountDisplayState({
    ...input,
    unitDiscountOffer: offer,
    additionalPaymentAmount: grossRemaining,
  });
  return state.pending ? state.remainingAfterDiscount : grossRemaining;
}

export interface UnitDiscountDateChangeNotice {
  kind: "gained" | "lost";
  title: string;
  message: string;
}

export function getUnitDiscountInvoiceDateChangeNotice(input: {
  items?: UnitDiscountItemLike[] | null;
  previousDate?: string | Date | null;
  nextDate?: string | Date | null;
  isLayaway?: boolean;
  settings?: UnitDiscountSettingSnapshot[] | null;
}): UnitDiscountDateChangeNotice | null {
  const previous = input.previousDate
    ? toBusinessDateStringFromInput(input.previousDate)
    : "";
  const next = input.nextDate
    ? toBusinessDateStringFromInput(input.nextDate)
    : "";
  if (!next || previous === next) return null;

  const previousOffer = calculateUnitDiscountOffer({
    items: input.items,
    invoiceDate: previous || null,
    isLayaway: input.isLayaway,
    settings: input.settings,
  });
  const nextOffer = calculateUnitDiscountOffer({
    items: input.items,
    invoiceDate: next,
    isLayaway: input.isLayaway,
    settings: input.settings,
  });

  const previousAmount = previousOffer?.totalDiscount ?? 0;
  const nextAmount = nextOffer?.totalDiscount ?? 0;
  if (previousAmount <= 0 && nextAmount <= 0) return null;
  if (previousAmount > 0 && nextAmount > 0 && previousAmount === nextAmount) {
    return null;
  }

  const formattedNext = formatBusinessDate(next);

  if (nextAmount > 0 && nextOffer && previousAmount <= 0) {
    const breakdown = nextOffer.breakdown
      .map(
        (line) =>
          `${line.unitName} ${line.discountPercent}% = $${line.discountAmount.toFixed(2)}`,
      )
      .join(", ");
    return {
      kind: "gained",
      title: "Invoice will be eligible for a discount",
      message: `After you change this date to ${formattedNext}, this invoice will be eligible for a unit discount offer.\n\n$${nextOffer.totalDiscount.toFixed(2)} off (${breakdown}).\nIf this invoice is fully paid by ${formatBusinessDate(nextOffer.paymentDueDate)}, you save this discount.`,
    };
  }

  if (previousAmount > 0 && previousOffer && nextAmount <= 0) {
    return {
      kind: "lost",
      title: "Unit discount will no longer apply",
      message: `This invoice is currently in a unit discount period. Changing the date to ${formattedNext} will remove the $${previousOffer.totalDiscount.toFixed(2)} discount offer.`,
    };
  }

  if (nextOffer && previousOffer && nextAmount !== previousAmount) {
    return {
      kind: nextAmount > previousAmount ? "gained" : "lost",
      title: "Unit discount will change",
      message: `Changing the date to ${formattedNext} will update the unit discount from $${previousAmount.toFixed(2)} to $${nextAmount.toFixed(2)}.`,
    };
  }

  return null;
}
