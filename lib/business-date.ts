export const BUSINESS_TIMEZONE =
  process.env.BUSINESS_TIMEZONE?.trim() || "America/Chicago";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface BusinessDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getBusinessDateParts(date: Date): BusinessDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function findBusinessInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  const approximate = Date.UTC(year, month - 1, day, hour + 6, minute, 0);

  for (let offsetHours = -18; offsetHours <= 18; offsetHours++) {
    const candidate = new Date(approximate + offsetHours * 3600000);
    const parts = getBusinessDateParts(candidate);

    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    ) {
      return candidate;
    }
  }

  return new Date(approximate);
}

export function toBusinessDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getBusinessTodayString(): string {
  return toBusinessDateString(new Date());
}

export function toBusinessDateStringFromInput(input: string | Date): string {
  if (typeof input === "string" && DATE_ONLY_REGEX.test(input)) {
    return input;
  }

  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return toBusinessDateString(parsed);
}

export function startOfBusinessDay(input: string | Date): Date {
  const dateStr =
    typeof input === "string" && DATE_ONLY_REGEX.test(input)
      ? input
      : toBusinessDateString(new Date(input));
  const [year, month, day] = dateStr.split("-").map(Number);
  return findBusinessInstant(year, month, day, 0, 0);
}

export function endOfBusinessDay(input: string | Date): Date {
  const start = startOfBusinessDay(input);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function normalizeBusinessCalendarDate(input: string | Date): Date {
  const dateStr =
    typeof input === "string" && DATE_ONLY_REGEX.test(input)
      ? input
      : toBusinessDateString(new Date(input));
  const [year, month, day] = dateStr.split("-").map(Number);
  return findBusinessInstant(year, month, day, 12, 0);
}

export function parseBusinessDateInput(input: string | Date): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new Error("Invalid date");
    }
    return startOfBusinessDay(input);
  }

  if (DATE_ONLY_REGEX.test(input)) {
    return startOfBusinessDay(input);
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }

  return startOfBusinessDay(parsed);
}

export function isFutureBusinessDate(input: string | Date): boolean {
  const selected = toBusinessDateStringFromInput(input);
  if (!selected) return false;
  return selected > getBusinessTodayString();
}

export function isBeforeBusinessToday(input: string | Date): boolean {
  const selected = toBusinessDateStringFromInput(input);
  if (!selected) return false;
  return selected < getBusinessTodayString();
}

export function isAfterBusinessToday(input: string | Date): boolean {
  return isFutureBusinessDate(input);
}

export function daysBetweenBusiness(
  start: string | Date,
  end: string | Date,
): number {
  const startMs = startOfBusinessDay(start).getTime();
  const endMs = startOfBusinessDay(end).getTime();
  return Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24));
}

export function formatBusinessDate(
  input: string | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
): string {
  let date: Date;
  if (typeof input === "string") {
    if (!input.trim()) {
      return "";
    }
    try {
      date = parseBusinessDateInput(input);
    } catch {
      return "";
    }
  } else {
    date = input;
  }

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: BUSINESS_TIMEZONE,
  }).format(date);
}
