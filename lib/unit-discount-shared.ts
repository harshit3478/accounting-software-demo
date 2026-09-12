import { roundMoney } from "./early-payment-discount-shared";
import {
  addCivilDays,
  formatBusinessDate,
  getBusinessTodayString,
  toBusinessDateStringFromInput,
} from "./business-date";

export { roundMoney };

export const UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS = 14;

export const DISCOUNT_KIND_UNIT_PERCENT = "unit_percent";
export const DISCOUNT_KIND_SHIPPING_CREDIT = "shipping_credit";

export type DiscountKind =
  | typeof DISCOUNT_KIND_UNIT_PERCENT
  | typeof DISCOUNT_KIND_SHIPPING_CREDIT;

export interface ShippingDiscountThreshold {
  minAmount: number | null;
  maxAmount: number | null;
  creditAmount: number;
  label: string;
}

export interface UnitDiscountSettingSnapshot {
  id?: number;
  kind?: DiscountKind;
  name?: string;
  unitName: string;
  discountPercent: number;
  periodStart: string;
  periodEnd: string;
  paymentDueDate?: string;
  isActive?: boolean;
  liveTypeId?: number | null;
  liveTypeName?: string | null;
  liveTypeCountry?: string | null;
  thresholds?: ShippingDiscountThreshold[];
}

export interface ShippingDiscountOfferSnapshot {
  name: string;
  label: string;
  creditCap: number;
  creditAmount: number;
  invoiceTotal: number;
  shippingFee: number;
  unitName: string;
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

export function getDiscountKind(
  setting?: { kind?: string | null } | null,
): DiscountKind {
  return setting?.kind === DISCOUNT_KIND_SHIPPING_CREDIT
    ? DISCOUNT_KIND_SHIPPING_CREDIT
    : DISCOUNT_KIND_UNIT_PERCENT;
}

export function parseOptionalAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return roundMoney(amount);
}

export function parseShippingThresholds(
  value: unknown,
): ShippingDiscountThreshold[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as {
        minAmount?: unknown;
        maxAmount?: unknown;
        creditAmount?: unknown;
        label?: unknown;
      };
      const creditAmount = roundMoney(Number(item.creditAmount || 0));
      if (creditAmount <= 0) return null;
      return {
        minAmount: parseOptionalAmount(item.minAmount),
        maxAmount: parseOptionalAmount(item.maxAmount),
        creditAmount,
        label: String(item.label || "").trim(),
      } satisfies ShippingDiscountThreshold;
    })
    .filter((row): row is ShippingDiscountThreshold => row !== null);
}

export function validateShippingThresholds(
  thresholds: ShippingDiscountThreshold[],
): string | null {
  if (thresholds.length === 0) {
    return "Add at least one shipping credit threshold";
  }

  for (const threshold of thresholds) {
    if (threshold.creditAmount <= 0) {
      return "Each threshold credit must be greater than 0";
    }
    if (
      threshold.minAmount != null &&
      threshold.maxAmount != null &&
      threshold.minAmount > threshold.maxAmount
    ) {
      return "Threshold minimum cannot be greater than maximum";
    }
  }

  const sorted = [...thresholds].sort(
    (a, b) => (a.minAmount ?? Number.NEGATIVE_INFINITY) -
      (b.minAmount ?? Number.NEGATIVE_INFINITY),
  );
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const left = sorted[i];
      const right = sorted[j];
      const leftMax = left.maxAmount ?? Number.POSITIVE_INFINITY;
      const rightMin = right.minAmount ?? Number.NEGATIVE_INFINITY;
      if (leftMax >= rightMin) {
        return "Shipping credit thresholds cannot overlap";
      }
    }
  }

  return null;
}

export function matchShippingThreshold(
  invoiceTotal: number,
  thresholds: ShippingDiscountThreshold[],
): ShippingDiscountThreshold | null {
  const total = roundMoney(invoiceTotal);
  const sorted = [...thresholds].sort(
    (a, b) =>
      (a.minAmount ?? Number.NEGATIVE_INFINITY) -
      (b.minAmount ?? Number.NEGATIVE_INFINITY),
  );
  return (
    sorted.find((threshold) => {
      if (threshold.minAmount != null && total < threshold.minAmount) {
        return false;
      }
      if (threshold.maxAmount != null && total > threshold.maxAmount) {
        return false;
      }
      return true;
    }) || null
  );
}

export function formatShippingThresholdSummary(
  threshold: ShippingDiscountThreshold,
): string {
  const credit = `up to $${threshold.creditAmount.toFixed(2)}`;
  const label = threshold.label || "Shipping credit";
  if (threshold.minAmount == null && threshold.maxAmount == null) {
    return `${label}: ${credit}`;
  }
  if (threshold.minAmount == null && threshold.maxAmount != null) {
    return `$${threshold.maxAmount.toFixed(2)} or less → ${label}, ${credit}`;
  }
  if (threshold.minAmount != null && threshold.maxAmount == null) {
    return `$${threshold.minAmount.toFixed(2)} and above → ${label}, ${credit}`;
  }
  return `$${threshold.minAmount!.toFixed(2)}–$${threshold.maxAmount!.toFixed(2)} → ${label}, ${credit}`;
}

export function parseShippingDiscountOffer(
  value: unknown,
): ShippingDiscountOfferSnapshot | null {
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
    name?: unknown;
    label?: unknown;
    creditCap?: unknown;
    creditAmount?: unknown;
    invoiceTotal?: unknown;
    shippingFee?: unknown;
    unitName?: unknown;
  };
  const creditAmount = roundMoney(Number(raw.creditAmount || 0));
  if (creditAmount <= 0) return null;

  return {
    name: String(raw.name || "").trim(),
    label: String(raw.label || "Shipping credit").trim() || "Shipping credit",
    creditCap: roundMoney(Number(raw.creditCap || creditAmount)),
    creditAmount,
    invoiceTotal: roundMoney(Number(raw.invoiceTotal || 0)),
    shippingFee: roundMoney(Number(raw.shippingFee || 0)),
    unitName: String(raw.unitName || "").trim(),
  };
}

export function liveTypeScopesOverlap(
  left?: number | null,
  right?: number | null,
): boolean {
  if (left == null || right == null) return true;
  return Number(left) === Number(right);
}

export function calculateShippingDiscountOffer(input: {
  items?: UnitDiscountItemLike[] | null;
  invoiceDate?: string | Date | null;
  isLayaway?: boolean;
  shippingFee?: number | string | null;
  invoiceTotal?: number | string | null;
  settings?: UnitDiscountSettingSnapshot[] | null;
}): ShippingDiscountOfferSnapshot | null {
  if (input.isLayaway) return null;

  const invoiceDate = input.invoiceDate
    ? toBusinessDateStringFromInput(input.invoiceDate)
    : "";
  if (!invoiceDate) return null;

  const shippingFee = roundMoney(Number(input.shippingFee || 0));
  if (shippingFee <= 0) return null;

  const invoiceTotal = roundMoney(Number(input.invoiceTotal || 0));
  if (invoiceTotal <= 0) return null;

  const itemUnits = new Set(
    (Array.isArray(input.items) ? input.items : [])
      .map((item) =>
        normalizeUnitKey(String(item.unit || "grams").trim() || "grams"),
      )
      .filter(Boolean),
  );
  if (itemUnits.size === 0) return null;

  const settings = (input.settings || [])
    .map((setting) => ({
      ...setting,
      kind: getDiscountKind(setting),
      unitName: String(setting.unitName || "").trim(),
      periodStart: toBusinessDateStringFromInput(setting.periodStart || ""),
      periodEnd: toBusinessDateStringFromInput(setting.periodEnd || ""),
      thresholds: parseShippingThresholds(setting.thresholds),
    }))
    .filter(
      (setting) =>
        setting?.isActive !== false &&
        setting.kind === DISCOUNT_KIND_SHIPPING_CREDIT &&
        setting.unitName &&
        setting.periodStart &&
        setting.periodEnd &&
        setting.thresholds.length > 0 &&
        itemUnits.has(normalizeUnitKey(setting.unitName)) &&
        isCivilDateInInclusiveRange(
          invoiceDate,
          setting.periodStart,
          setting.periodEnd,
        ),
    );

  if (settings.length === 0) return null;

  let best: ShippingDiscountOfferSnapshot | null = null;
  for (const setting of settings) {
    const matched = matchShippingThreshold(invoiceTotal, setting.thresholds);
    if (!matched) continue;
    const creditAmount = roundMoney(
      Math.min(shippingFee, matched.creditAmount),
    );
    if (creditAmount <= 0) continue;
    if (!best || creditAmount > best.creditAmount) {
      best = {
        name: String(setting.name || "").trim(),
        label: matched.label || "Shipping credit",
        creditCap: matched.creditAmount,
        creditAmount,
        invoiceTotal,
        shippingFee,
        unitName: setting.unitName,
      };
    }
  }

  return best;
}

export function getUnitDiscountPayByDate(
  invoiceDate?: string | Date | null,
): string {
  const date = invoiceDate ? toBusinessDateStringFromInput(invoiceDate) : "";
  if (!date) return "";
  return addCivilDays(date, UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS);
}

export function applyUnitDiscountPayByDate(
  offer: UnitDiscountOfferSnapshot | null,
  invoiceDate?: string | Date | null,
): UnitDiscountOfferSnapshot | null {
  if (!offer) return null;
  const paymentDueDate = getUnitDiscountPayByDate(invoiceDate);
  if (!paymentDueDate) return offer;
  return { ...offer, paymentDueDate };
}

export function normalizeUnitDiscountOfferJson(
  offerValue: unknown,
  invoiceDate?: string | Date | null,
): UnitDiscountOfferSnapshot | null {
  return applyUnitDiscountPayByDate(
    parseUnitDiscountOffer(offerValue),
    invoiceDate,
  );
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

  if (totalDiscount <= 0 || breakdown.length === 0) {
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

  const invoiceDate = input.invoiceDate
    ? toBusinessDateStringFromInput(input.invoiceDate)
    : "";
  if (!invoiceDate) return null;

  const settings = (input.settings || [])
    .map((setting) => ({
      ...setting,
      periodStart: toBusinessDateStringFromInput(setting.periodStart || ""),
      periodEnd: toBusinessDateStringFromInput(setting.periodEnd || ""),
    }))
    .filter(
      (setting) =>
        setting?.isActive !== false &&
        getDiscountKind(setting) === DISCOUNT_KIND_UNIT_PERCENT &&
        Number(setting.discountPercent) > 0 &&
        setting.periodStart &&
        setting.periodEnd,
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
          invoiceDate,
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
  }

  const totalDiscount = roundMoney(
    breakdown.reduce((sum, line) => sum + line.discountAmount, 0),
  );
  const paymentDueDate = getUnitDiscountPayByDate(invoiceDate);
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
  invoiceDate?: string | Date | null;
  createdAt?: string | Date | null;
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
  const offer = applyUnitDiscountPayByDate(
    parseUnitDiscountOffer(input.unitDiscountOffer),
    input.invoiceDate || input.createdAt,
  );
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
  const offer = applyUnitDiscountPayByDate(
    parseUnitDiscountOffer(input.unitDiscountOffer) ||
      calculateUnitDiscountOffer({
        items: input.items,
        invoiceDate: input.invoiceDate,
        isLayaway: input.isLayaway,
        settings: input.settings,
      }),
    input.invoiceDate,
  );
  return offer;
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
      message: `After you change this date to ${formattedNext}, this invoice will be eligible for a unit discount offer.\n\n$${nextOffer.totalDiscount.toFixed(2)} off (${breakdown}).\nIf this invoice is fully paid within ${UNIT_DISCOUNT_PAYMENT_WINDOW_DAYS} days (by ${formatBusinessDate(nextOffer.paymentDueDate)}), you save this discount.`,
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
