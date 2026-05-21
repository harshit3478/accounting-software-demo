export interface LayawayFeeRate {
  months: number;
  ratePerGram: number;
  isActive?: boolean;
  sortOrder?: number;
}

export const DEFAULT_LAYAWAY_FEE_RATES: LayawayFeeRate[] = [
  { months: 1, ratePerGram: 3 },
  { months: 2, ratePerGram: 4 },
  { months: 3, ratePerGram: 5 },
  { months: 4, ratePerGram: 8 },
  { months: 5, ratePerGram: 9 },
  { months: 6, ratePerGram: 10 },
];

export interface LayawayItemLike {
  quantity?: number | string | null;
  unit?: string | null;
}

export function normalizeLayawayFeeRate(rate: any): LayawayFeeRate {
  return {
    months: Number(rate?.months || 0),
    ratePerGram: Number(rate?.ratePerGram || rate?.rate || 0),
    isActive: rate?.isActive ?? true,
    sortOrder: Number(rate?.sortOrder || 0),
  };
}

export function normalizeLayawayFeeRates(rates: any[]): LayawayFeeRate[] {
  const normalized = (Array.isArray(rates) ? rates : [])
    .map(normalizeLayawayFeeRate)
    .filter((rate) => Number.isFinite(rate.months) && rate.months > 0)
    .sort((left, right) => left.months - right.months);

  if (normalized.length === 0) {
    return [...DEFAULT_LAYAWAY_FEE_RATES];
  }

  return normalized;
}

export function getLayawayRateForMonths(
  months: number,
  rates: LayawayFeeRate[] = DEFAULT_LAYAWAY_FEE_RATES,
): LayawayFeeRate | null {
  const normalizedMonths = Math.max(0, Number(months) || 0);
  if (normalizedMonths <= 0) return null;

  const sortedRates = [...rates]
    .filter((rate) => Number.isFinite(rate.months) && rate.months > 0)
    .sort((left, right) => left.months - right.months);

  if (sortedRates.length === 0) return null;

  const exact = sortedRates.find((rate) => rate.months === normalizedMonths);
  if (exact) return exact;

  if (normalizedMonths > sortedRates[sortedRates.length - 1].months) {
    return sortedRates[sortedRates.length - 1];
  }

  return null;
}

export function getLayawayWeight(items: LayawayItemLike[] | null | undefined) {
  return (items || []).reduce((sum, item) => {
    const quantity = Number(item?.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return sum;
    return sum + quantity;
  }, 0);
}

export function calculateLayawayFee(
  weightInGrams: number,
  months: number,
  rates: LayawayFeeRate[] = DEFAULT_LAYAWAY_FEE_RATES,
): number {
  const rate = getLayawayRateForMonths(months, rates);
  if (!rate) return 0;

  const safeWeight = Math.max(0, Number(weightInGrams) || 0);
  const safeRate = Math.max(0, Number(rate.ratePerGram) || 0);
  return Number((safeWeight * safeRate).toFixed(2));
}

export function calculateLayawayFeeFromItems(
  items: LayawayItemLike[] | null | undefined,
  months: number,
  rates: LayawayFeeRate[] = DEFAULT_LAYAWAY_FEE_RATES,
): number {
  return calculateLayawayFee(getLayawayWeight(items), months, rates);
}
