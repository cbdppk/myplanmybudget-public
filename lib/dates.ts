const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(tz: string | null | undefined) {
  return isValidTimeZone(tz) ? tz : "UTC";
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let formatter = partsFormatterCache.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    partsFormatterCache.set(tz, formatter);
  }
  return formatter;
}

export type ZonedDateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Calendar date/time an instant reads as on a wall clock in the given zone. */
export function getZonedParts(at: Date, timeZone: string): ZonedDateParts {
  const tz = safeTimeZone(timeZone);
  const parts: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(at)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl can render midnight as "24" with hour12: false.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function tzOffsetMs(timeZone: string, at: Date) {
  const parts = getZonedParts(at, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The UTC instant of local midnight for a calendar date in the given zone.
 * Iterates twice so DST transitions around midnight converge.
 */
export function zonedMidnightUtc(year: number, month: number, day: number, timeZone: string) {
  const tz = safeTimeZone(timeZone);
  const utcGuess = Date.UTC(year, month - 1, day);
  let instant = new Date(utcGuess);
  for (let i = 0; i < 2; i += 1) {
    instant = new Date(utcGuess - tzOffsetMs(tz, instant));
  }
  return instant;
}

/** Start/end instants of "today" as experienced in the user's timezone. */
export function dayBoundsInTz(timeZone: string, ref = new Date()) {
  const tz = safeTimeZone(timeZone);
  const parts = getZonedParts(ref, tz);
  const start = zonedMidnightUtc(parts.year, parts.month, parts.day, tz);
  const nextMidnight = zonedMidnightUtc(parts.year, parts.month, parts.day + 1, tz);
  return { start, end: new Date(nextMidnight.getTime() - 1) };
}

/**
 * The user's budget month: starts at local midnight on `startDay` (clamped to
 * 1–28 so every month has the day) and ends a millisecond before the next
 * month's start day.
 */
export function monthWindowFromStartDayInTz(ref: Date, startDay: number, timeZone: string) {
  const tz = safeTimeZone(timeZone);
  const safeStartDay = Math.min(28, Math.max(1, Math.floor(startDay)));
  const parts = getZonedParts(ref, tz);
  const startsThisMonth = parts.day >= safeStartDay;
  const startYear = parts.year;
  const startMonth = startsThisMonth ? parts.month : parts.month - 1;
  const start = zonedMidnightUtc(startYear, startMonth, safeStartDay, tz);
  const end = new Date(zonedMidnightUtc(startYear, startMonth + 1, safeStartDay, tz).getTime() - 1);
  return { start, end };
}

/** Days in the user's current local calendar month. */
export function daysInMonthInTz(timeZone: string, ref = new Date()) {
  const parts = getZonedParts(ref, safeTimeZone(timeZone));
  return new Date(parts.year, parts.month, 0).getDate();
}

export function addDaysUtc(date: Date, amount: number) {
  return new Date(date.getTime() + amount * DAY_MS);
}

export type RecurringCadence = "daily" | "weekly" | "monthly" | "yearly";

export function normalizeCadence(value: string | null | undefined): RecurringCadence {
  const lower = (value ?? "").trim().toLowerCase();
  if (lower === "daily" || lower === "weekly" || lower === "yearly") return lower;
  return "monthly";
}

/**
 * First recurrence occurrence strictly after `after`, at local midnight in the
 * user's timezone. Monthly rules run on `dayOfMonth` (clamped 1–28 so every
 * month has it); weekly rules on `dayOfWeek` (0 = Sunday).
 */
export function nextRunAfter(params: {
  cadence: string | null | undefined;
  after: Date;
  timeZone: string;
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
}): Date {
  const cadence = normalizeCadence(params.cadence);
  const tz = safeTimeZone(params.timeZone);
  const parts = getZonedParts(params.after, tz);

  if (cadence === "daily") {
    return zonedMidnightUtc(parts.year, parts.month, parts.day + 1, tz);
  }
  if (cadence === "weekly") {
    const targetDow = Math.min(6, Math.max(0, Math.floor(params.dayOfWeek ?? 0)));
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = zonedMidnightUtc(parts.year, parts.month, parts.day + offset, tz);
      const candidateParts = getZonedParts(candidate, tz);
      const dow = new Date(Date.UTC(candidateParts.year, candidateParts.month - 1, candidateParts.day)).getUTCDay();
      if (dow === targetDow) return candidate;
    }
    return zonedMidnightUtc(parts.year, parts.month, parts.day + 7, tz);
  }
  if (cadence === "yearly") {
    const day = Math.min(28, Math.max(1, Math.floor(params.dayOfMonth ?? parts.day)));
    const thisYear = zonedMidnightUtc(parts.year, parts.month, day, tz);
    return thisYear > params.after ? thisYear : zonedMidnightUtc(parts.year + 1, parts.month, day, tz);
  }
  // monthly
  const day = Math.min(28, Math.max(1, Math.floor(params.dayOfMonth ?? parts.day)));
  const thisMonth = zonedMidnightUtc(parts.year, parts.month, day, tz);
  return thisMonth > params.after ? thisMonth : zonedMidnightUtc(parts.year, parts.month + 1, day, tz);
}

/**
 * Parse a user-entered date. Date-only strings ("2026-07-02") are pinned to
 * local noon in the user's timezone so the transaction lands on the day the
 * user picked regardless of server timezone; full timestamps pass through.
 */
export function parseDateInputInTz(value: string, timeZone: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const midnight = zonedMidnightUtc(Number(y), Number(m), Number(d), safeTimeZone(timeZone));
    return new Date(midnight.getTime() + 12 * 60 * 60 * 1000);
  }
  return new Date(value);
}
