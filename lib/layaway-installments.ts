export type LayawayPaymentFrequency = "monthly" | "bi-weekly" | "weekly";

const SKIP_THRESHOLDS: Record<LayawayPaymentFrequency, number> = {
  monthly: 10,
  "bi-weekly": 7,
  weekly: 2,
};

export interface LayawayInstallmentDraft {
  dueDate: Date;
  amount: number;
  label: string;
}

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function daysBetween(from: Date, to: Date) {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function getOrdinalSuffix(value: number) {
  return value === 1 ? "st" : value === 2 ? "nd" : value === 3 ? "rd" : "th";
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

  const daysUntilAnchor = daysBetween(normalizedInvoice, normalizedAnchor);
  return daysUntilAnchor > SKIP_THRESHOLDS[frequency];
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

export function buildLayawayInstallmentSchedule(options: {
  invoiceDate: Date | string;
  frequency: LayawayPaymentFrequency;
  months: number;
  downPayment: number;
  totalAmount: number;
  includeDownPayment?: boolean;
}): LayawayInstallmentDraft[] {
  const {
    invoiceDate,
    frequency,
    months,
    downPayment,
    totalAmount,
    includeDownPayment = true,
  } = options;

  const numInstallments = getLayawayInstallmentCount(months, frequency);
  const safeDownPayment = includeDownPayment
    ? Math.min(Math.max(0, downPayment), totalAmount)
    : 0;
  const remaining = Math.max(totalAmount - safeDownPayment, 0);
  const installmentAmount =
    numInstallments > 0 ? remaining / numInstallments : 0;
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
    installments.push({
      dueDate,
      amount: installmentAmount,
      label: `${installmentNumber}${getOrdinalSuffix(installmentNumber)} Payment`,
    });
  });

  return installments;
}

export function formatLayawayInstallmentDate(date: Date | string) {
  const parsed = startOfDay(new Date(date));
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
