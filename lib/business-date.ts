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

function formatOptionsIncludeTime(
  options: Intl.DateTimeFormatOptions,
): boolean {
  return (
    options.hour != null ||
    options.minute != null ||
    options.second != null ||
    options.timeStyle != null
  );
}

/**
 * Format a date for display.
 * - Timestamps with time → viewer's local timezone (browser on client;
 *   process TZ on server, set from BUSINESS_TIMEZONE in instrumentation).
 * - Date-only values (invoice / due / payment dates) → fixed civil calendar
 *   day via UTC date parts so the same Invoice Date shows everywhere.
 *   Legacy rows stored as UTC midnight (e.g. 2026-07-07T00:00:00.000Z) and
 *   newer rows stored as US Central start-of-day both keep the intended day;
 *   formatting those instants in America/Chicago incorrectly shifted legacy
 *   dates back one day (PH saw Jul 7 → Jul 6).
 * Storage stays UTC; no DB changes. Day boundaries still use BUSINESS_TIMEZONE.
 */
export function formatBusinessDate(
  input: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
): string {
  if (input == null) {
    return "";
  }

  if (typeof input === "string" && !input.trim()) {
    return "";
  }

  // YYYY-MM-DD: format the civil day as-is (no TZ day-shift).
  if (typeof input === "string" && DATE_ONLY_REGEX.test(input.trim())) {
    const [year, month, day] = input.trim().split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }

  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  // Timestamps with time: show in the viewer's local timezone.
  if (formatOptionsIncludeTime(options)) {
    return new Intl.DateTimeFormat("en-US", options).format(date);
  }

  // Date-only: fixed civil day (UTC date parts). Do not use BUSINESS_TIMEZONE
  // here — that shifts legacy UTC-midnight invoice dates back one day.
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}
