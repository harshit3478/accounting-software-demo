export interface LayawayFeeRate {
  months: number;
  ratePerGram: number;
  unitName?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface LayawayFeeConfig {
  basisUnit: string;
}

export interface LayawayFeeUnitConfig {
  unitName: string;
  rates: LayawayFeeRate[];
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

export const DEFAULT_LAYAWAY_FEE_CONFIG: LayawayFeeConfig = {
  basisUnit: "grams",
};

export const DEFAULT_LAYAWAY_FEE_CONFIGS: LayawayFeeUnitConfig[] = [
  {
    unitName: DEFAULT_LAYAWAY_FEE_CONFIG.basisUnit,
    rates: [...DEFAULT_LAYAWAY_FEE_RATES],
  },
];

function normalizeUnitName(unit: string | null | undefined) {
  return String(unit || "")
    .trim()
    .toLowerCase();
}

function getFallbackUnitName(rate: any) {
  return (
    normalizeUnitName(rate?.unitName || rate?.basisUnit || "grams") || "grams"
  );
}

export function normalizeLayawayFeeRate(rate: any): LayawayFeeRate {
  return {
    months: Number(rate?.months || 0),
    ratePerGram: Number(rate?.ratePerGram || rate?.rate || 0),
    unitName: getFallbackUnitName(rate),
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

export function groupLayawayFeeRatesByUnit(
  rates: any[],
): LayawayFeeUnitConfig[] {
  const grouped = new Map<string, LayawayFeeRate[]>();

  for (const rate of normalizeLayawayFeeRates(rates)) {
    const unitName = normalizeUnitName(rate.unitName) || "grams";
    const current = grouped.get(unitName) || [];
    current.push({ ...rate, unitName });
    grouped.set(unitName, current);
  }

  const configs = [...grouped.entries()].map(([unitName, ratesForUnit]) => ({
    unitName,
    rates: ratesForUnit.sort((left, right) => left.months - right.months),
  }));

  if (configs.length === 0) {
    return [...DEFAULT_LAYAWAY_FEE_CONFIGS];
  }

  return configs.sort((left, right) =>
    left.unitName.localeCompare(right.unitName),
  );
}

export function flattenLayawayFeeConfigs(
  configs: LayawayFeeUnitConfig[] | null | undefined,
): LayawayFeeRate[] {
  return (configs || []).flatMap((config) =>
    (config.rates || []).map((rate) => ({
      ...normalizeLayawayFeeRate(rate),
      unitName: normalizeUnitName(config.unitName) || "grams",
    })),
  );
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

export function getLayawayRateForUnitAndMonths(
  unitName: string | null | undefined,
  months: number,
  configs: LayawayFeeUnitConfig[] = DEFAULT_LAYAWAY_FEE_CONFIGS,
): LayawayFeeRate | null {
  const normalizedUnitName = normalizeUnitName(unitName);
  const selectedConfig =
    configs.find(
      (config) => normalizeUnitName(config.unitName) === normalizedUnitName,
    ) ||
    configs.find(
      (config) =>
        normalizeUnitName(config.unitName) ===
        DEFAULT_LAYAWAY_FEE_CONFIG.basisUnit,
    ) ||
    configs[0] ||
    null;

  if (!selectedConfig) return null;

  return getLayawayRateForMonths(months, selectedConfig.rates);
}

export function getLayawayWeight(items: LayawayItemLike[] | null | undefined) {
  return getLayawayQuantityForUnit(items, DEFAULT_LAYAWAY_FEE_CONFIG.basisUnit);
}

export function getLayawayQuantityForUnit(
  items: LayawayItemLike[] | null | undefined,
  basisUnit: string,
) {
  const normalizedBasisUnit = normalizeUnitName(basisUnit);

  return (items || []).reduce((sum, item) => {
    const quantity = Number(item?.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return sum;

    if (
      normalizedBasisUnit &&
      normalizeUnitName(item?.unit) !== normalizedBasisUnit
    ) {
      return sum;
    }

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
  ratesOrConfigs:
    | LayawayFeeRate[]
    | LayawayFeeUnitConfig[] = DEFAULT_LAYAWAY_FEE_CONFIGS,
  basisUnit: string = DEFAULT_LAYAWAY_FEE_CONFIG.basisUnit,
): number {
  const configs =
    Array.isArray(ratesOrConfigs) &&
    ratesOrConfigs.length > 0 &&
    "rates" in ratesOrConfigs[0]
      ? (ratesOrConfigs as LayawayFeeUnitConfig[])
      : groupLayawayFeeRatesByUnit(
          (ratesOrConfigs as LayawayFeeRate[]).map((rate) => ({
            ...rate,
            unitName: rate.unitName || basisUnit,
          })),
        );

  const safeItems = items || [];
  const total = safeItems.reduce((sum, item) => {
    const quantity = Number(item?.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return sum;

    const rate = getLayawayRateForUnitAndMonths(item?.unit, months, configs);
    if (!rate) return sum;

    return sum + quantity * Math.max(0, Number(rate.ratePerGram) || 0);
  }, 0);

  return Number(total.toFixed(2));
}
