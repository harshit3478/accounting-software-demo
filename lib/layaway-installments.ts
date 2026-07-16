import {
  daysBetweenBusiness,
  formatBusinessDate,
  normalizeBusinessCalendarDate,
} from "./business-date";

export type LayawayPaymentFrequency = "monthly" | "bi-weekly" | "weekly";

/**
 * Layaway installment due-date rules:
 *
 * - **Bi-weekly** (15th and 30th; 30th uses last day when the month is shorter):
 *   - Invoice day **9–23** → first payment on the **30th** of the same month
 *   - Invoice day **1–8** → first payment on the **15th** of the same month
 *   - Invoice day **24–31** → first payment on the **15th** of the next month
 *
 * - **Monthly** (1st of each month — parallel to the bi-weekly 15 / 30 windows):
 *   - Invoice day **1–15** → first payment on the **upcoming 1st** (1st of next month)
 *   - Invoice day **16–31** → first payment on the **next 1st** (1st of next month)
 *
 * - **Weekly** (7th, 14th, 21st, 28th): first installment is the next anchor
 *   on/after the invoice date when it is at least 2 days away.
 */
const WEEKLY_SKIP_THRESHOLD = 2;

export interface LayawayInstallmentDraft {
  dueDate: Date;
  amount: number;
  label: string;
}

function startOfDay(date: Date) {
  return normalizeBusinessCalendarDate(date);
}

function daysBetween(from: Date, to: Date) {
  return daysBetweenBusiness(from, to);
}

function getOrdinalSuffix(value: number) {
  return value === 1 ? "st" : value === 2 ? "nd" : value === 3 ? "rd" : "th";
}

function addCalendarMonths(year: number, month: number, offset: number) {
  const absolute = year * 12 + month + offset;
  return {
    year: Math.floor(absolute / 12),
    month: ((absolute % 12) + 12) % 12,
  };
}

function createBiWeeklyAnchor(
  year: number,
  month: number,
  target: 15 | 30,
): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = target === 30 ? Math.min(30, lastDay) : 15;
  return new Date(year, month, day, 12, 0, 0, 0);
}

function createMonthlyAnchor(year: number, month: number): Date {
  return new Date(year, month, 1, 12, 0, 0, 0);
}

function getInvoiceDayOfMonth(invoiceDate: Date) {
  return startOfDay(invoiceDate).getDate();
}

/** Bi-weekly first installment based on invoice day-of-month windows. */
export function getBiWeeklyFirstInstallmentDate(invoiceDate: Date | string): Date {
  const baseDate = startOfDay(new Date(invoiceDate));
  const day = getInvoiceDayOfMonth(baseDate);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  if (day >= 9 && day <= 23) {
    return createBiWeeklyAnchor(year, month, 30);
  }

  if (day >= 1 && day <= 8) {
    return createBiWeeklyAnchor(year, month, 15);
  }

  const nextMonth = addCalendarMonths(year, month, 1);
  return createBiWeeklyAnchor(nextMonth.year, nextMonth.month, 15);
}

/**
 * Monthly first installment — both day windows use the 1st of next month
 * (the bi-weekly 1–15 / 15–30 periods both map to the next calendar 1st).
 */
export function getMonthlyFirstInstallmentDate(invoiceDate: Date | string): Date {
  const baseDate = startOfDay(new Date(invoiceDate));
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const nextMonth = addCalendarMonths(year, month, 1);
  return createMonthlyAnchor(nextMonth.year, nextMonth.month);
}

function getWeeklyFirstInstallmentDate(invoiceDate: Date): Date | null {
  const baseDate = startOfDay(invoiceDate);
  const iterator = iterateWeeklyAnchors(
    baseDate.getFullYear(),
    baseDate.getMonth(),
  );

  for (const anchor of iterator) {
    if (anchor < baseDate) continue;
    if (daysBetween(baseDate, anchor) >= WEEKLY_SKIP_THRESHOLD) {
      return new Date(anchor);
    }
  }

  return null;
}

function getFirstInstallmentAnchor(
  invoiceDate: Date,
  frequency: LayawayPaymentFrequency,
): Date | null {
  if (frequency === "bi-weekly") {
    return getBiWeeklyFirstInstallmentDate(invoiceDate);
  }
  if (frequency === "monthly") {
    return getMonthlyFirstInstallmentDate(invoiceDate);
  }
  return getWeeklyFirstInstallmentDate(invoiceDate);
}

function collectFollowingAnchors(
  frequency: LayawayPaymentFrequency,
  after: Date,
  count: number,
): Date[] {
  if (count <= 0) return [];

  const anchors: Date[] = [];
  const iterator = getAnchorIterator(
    frequency,
    after.getFullYear(),
    after.getMonth(),
  );

  for (const anchor of iterator) {
    if (anchor <= after) continue;
    anchors.push(new Date(anchor));
    if (anchors.length >= count) break;
  }

  return anchors;
}

function* iterateBiWeeklyAnchors(year: number, month: number) {
  let cursorYear = year;
  let cursorMonth = month;

  while (true) {
    for (const targetDay of [15, 30] as const) {
      const lastDay = new Date(cursorYear, cursorMonth + 1, 0).getDate();
      const day = targetDay === 30 ? Math.min(30, lastDay) : 15;
      yield new Date(cursorYear, cursorMonth, day, 12, 0, 0, 0);
    }

    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }
}

function* iterateMonthlyAnchors(year: number, month: number) {
  let cursorYear = year;
  let cursorMonth = month;

  while (true) {
    yield new Date(cursorYear, cursorMonth, 1, 12, 0, 0, 0);
    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }
}

function* iterateWeeklyAnchors(year: number, month: number) {
  let cursorYear = year;
  let cursorMonth = month;
  const weeklyDays = [7, 14, 21, 28];

  while (true) {
    const lastDay = new Date(cursorYear, cursorMonth + 1, 0).getDate();
    for (const day of weeklyDays) {
      if (day <= lastDay) {
        yield new Date(cursorYear, cursorMonth, day, 12, 0, 0, 0);
      }
    }

    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }
}

function getAnchorIterator(
  frequency: LayawayPaymentFrequency,
  year: number,
  month: number,
) {
  if (frequency === "monthly") return iterateMonthlyAnchors(year, month);
  if (frequency === "bi-weekly") return iterateBiWeeklyAnchors(year, month);
  return iterateWeeklyAnchors(year, month);
}

function isFirstInstallmentAnchorValid(
  invoiceDate: Date,
  anchor: Date,
  frequency: LayawayPaymentFrequency,
) {
  const normalizedInvoice = startOfDay(invoiceDate);
  const normalizedAnchor = startOfDay(anchor);

  if (normalizedAnchor < normalizedInvoice) {
    return false;
  }

  return (
    daysBetween(normalizedInvoice, normalizedAnchor) >= WEEKLY_SKIP_THRESHOLD
  );
}

export function getLayawayInstallmentDueDates(
  invoiceDate: Date | string,
  frequency: LayawayPaymentFrequency,
  count: number,
): Date[] {
  const baseDate = startOfDay(new Date(invoiceDate));
  if (Number.isNaN(baseDate.getTime()) || count <= 0) {
    return [];
  }

  if (frequency === "bi-weekly" || frequency === "monthly") {
    const firstAnchor = getFirstInstallmentAnchor(baseDate, frequency);
    if (!firstAnchor) return [];

    const dueDates = [firstAnchor];
    if (dueDates.length >= count) {
      return dueDates.slice(0, count);
    }

    dueDates.push(
      ...collectFollowingAnchors(
        frequency,
        firstAnchor,
        count - dueDates.length,
      ),
    );
    return dueDates;
  }

  const iterator = getAnchorIterator(
    frequency,
    baseDate.getFullYear(),
    baseDate.getMonth(),
  );

  const dueDates: Date[] = [];
  let foundFirst = false;

  for (const anchor of iterator) {
    if (!foundFirst) {
      if (!isFirstInstallmentAnchorValid(baseDate, anchor, frequency)) {
        continue;
      }
      foundFirst = true;
    } else if (anchor <= dueDates[dueDates.length - 1]) {
      continue;
    }

    dueDates.push(new Date(anchor));
    if (dueDates.length >= count) {
      break;
    }
  }

  return dueDates;
}

export function getLayawayInstallmentCount(
  months: number,
  frequency: LayawayPaymentFrequency,
) {
  if (frequency === "bi-weekly") return months * 2;
  if (frequency === "weekly") return months * 4;
  return months;
}

export function calculateLayawayInstallmentAmount(options: {
  totalAmount: number;
  downPayment: number;
  months: number;
  frequency: LayawayPaymentFrequency;
}): number {
  const numInstallments = getLayawayInstallmentCount(
    options.months,
    options.frequency,
  );
  const effectiveDownPayment = Math.min(
    Math.max(0, options.downPayment),
    options.totalAmount,
  );
  const installmentBase = Math.max(
    options.totalAmount - effectiveDownPayment,
    0,
  );
  return numInstallments > 0 ? installmentBase / numInstallments : 0;
}

export function buildLayawayInstallmentSchedule(options: {
  invoiceDate: Date | string;
  frequency: LayawayPaymentFrequency;
  months: number;
  downPayment: number;
  totalAmount: number;
  includeDownPayment?: boolean;
  /** Skip this many regular (non-down) installments that are already paid. */
  paidRegularInstallmentCount?: number;
}): LayawayInstallmentDraft[] {
  const {
    invoiceDate,
    frequency,
    months,
    downPayment,
    totalAmount,
    includeDownPayment = true,
    paidRegularInstallmentCount = 0,
  } = options;

  const numInstallments = getLayawayInstallmentCount(months, frequency);
  const effectiveDownPayment = Math.min(
    Math.max(0, downPayment),
    totalAmount,
  );
  const safeDownPayment = includeDownPayment ? effectiveDownPayment : 0;
  const installmentAmount = calculateLayawayInstallmentAmount({
    totalAmount,
    downPayment: effectiveDownPayment,
    months,
    frequency,
  });
  const installments: LayawayInstallmentDraft[] = [];
  const invoiceBaseDate = startOfDay(new Date(invoiceDate));

  if (safeDownPayment > 0) {
    installments.push({
      dueDate: invoiceBaseDate,
      amount: safeDownPayment,
      label: "Down Payment",
    });
  }

  const dueDates = getLayawayInstallmentDueDates(
    invoiceDate,
    frequency,
    numInstallments,
  );

  dueDates.forEach((dueDate, index) => {
    const installmentNumber = index + 1;
    if (installmentNumber <= paidRegularInstallmentCount) {
      return;
    }

    installments.push({
      dueDate,
      amount: installmentAmount,
      label: `${installmentNumber}${getOrdinalSuffix(installmentNumber)} Payment`,
    });
  });

  return installments;
}

export function formatLayawayInstallmentDate(date: Date | string) {
  return formatBusinessDate(date);
}
