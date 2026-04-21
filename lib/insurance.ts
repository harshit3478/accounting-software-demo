export interface InsuranceBand {
  maxValue: number;
  clientShare: number;
}

// Client insurance share slabs provided by business.
// Amounts above the final slab use the final slope as an estimate.
export const DEFAULT_INSURANCE_BANDS: InsuranceBand[] = [
  { maxValue: 200, clientShare: 2.75 },
  { maxValue: 300, clientShare: 3.85 },
  { maxValue: 400, clientShare: 4.9 },
  { maxValue: 500, clientShare: 6.05 },
  { maxValue: 600, clientShare: 7.15 },
  { maxValue: 700, clientShare: 8.2 },
  { maxValue: 800, clientShare: 9.35 },
  { maxValue: 900, clientShare: 10.4 },
  { maxValue: 1000, clientShare: 11.55 },
  { maxValue: 1100, clientShare: 12.6 },
  { maxValue: 1200, clientShare: 13.75 },
  { maxValue: 1300, clientShare: 14.8 },
  { maxValue: 1400, clientShare: 15.95 },
  { maxValue: 1500, clientShare: 17 },
  { maxValue: 1600, clientShare: 18.15 },
  { maxValue: 1700, clientShare: 19.2 },
  { maxValue: 1800, clientShare: 20.35 },
  { maxValue: 1900, clientShare: 21.4 },
  { maxValue: 2000, clientShare: 22.55 },
  { maxValue: 2100, clientShare: 23.6 },
  { maxValue: 2200, clientShare: 24.75 },
  { maxValue: 2300, clientShare: 25.8 },
  { maxValue: 2400, clientShare: 26.95 },
  { maxValue: 2500, clientShare: 28 },
  { maxValue: 2600, clientShare: 29.15 },
  { maxValue: 2700, clientShare: 30.2 },
  { maxValue: 2800, clientShare: 31.35 },
  { maxValue: 2900, clientShare: 32.4 },
  { maxValue: 3000, clientShare: 33.55 },
  { maxValue: 3100, clientShare: 34.6 },
  { maxValue: 3200, clientShare: 35.75 },
  { maxValue: 3300, clientShare: 36.8 },
  { maxValue: 3400, clientShare: 37.95 },
  { maxValue: 3500, clientShare: 39 },
  { maxValue: 3600, clientShare: 40.15 },
  { maxValue: 3700, clientShare: 41.2 },
  { maxValue: 3800, clientShare: 42.35 },
  { maxValue: 3900, clientShare: 43.4 },
  { maxValue: 4000, clientShare: 44.55 },
  { maxValue: 4100, clientShare: 45.6 },
  { maxValue: 4200, clientShare: 46.75 },
  { maxValue: 4300, clientShare: 47.8 },
  { maxValue: 4400, clientShare: 48.85 },
  { maxValue: 4500, clientShare: 50 },
  { maxValue: 4600, clientShare: 51.15 },
  { maxValue: 4700, clientShare: 52.2 },
  { maxValue: 4800, clientShare: 53.35 },
  { maxValue: 4900, clientShare: 54.4 },
  { maxValue: 5000, clientShare: 55.55 },
];

export function calculateInsuranceAmount(
  invoiceValue: number,
  bands: InsuranceBand[] = DEFAULT_INSURANCE_BANDS,
): number {
  if (!Number.isFinite(invoiceValue) || invoiceValue <= 0) {
    return 0;
  }

  if (!Array.isArray(bands) || bands.length === 0) {
    return 0;
  }

  const sortedBands = [...bands].sort((a, b) => a.maxValue - b.maxValue);

  const roundedValue = Math.ceil(invoiceValue / 100) * 100;
  const matchedBand = sortedBands.find((band) => roundedValue <= band.maxValue);
  if (matchedBand) {
    return Number(matchedBand.clientShare.toFixed(2));
  }

  const maxBand = sortedBands[sortedBands.length - 1];
  const extraHundreds = Math.ceil((roundedValue - maxBand.maxValue) / 100);
  const extrapolated = maxBand.clientShare + extraHundreds * 1.15;
  return Number(extrapolated.toFixed(2));
}
