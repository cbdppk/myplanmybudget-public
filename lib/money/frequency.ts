export type MoneyCadence = "DAILY" | "WEEKLY" | "MONTHLY";

const WEEKS_PER_MONTH = 4.33;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function cadenceFactor(cadence: MoneyCadence, daysInMonth: number) {
  if (cadence === "DAILY") return Math.max(1, daysInMonth);
  if (cadence === "WEEKLY") return WEEKS_PER_MONTH;
  return 1;
}

export function normalizeToMonthly(value: number, cadence: MoneyCadence, daysInMonth: number) {
  return round2(Math.max(0, value) * cadenceFactor(cadence, daysInMonth));
}

export function fromMonthly(value: number, cadence: MoneyCadence, daysInMonth: number) {
  return round2(Math.max(0, value) / cadenceFactor(cadence, daysInMonth));
}

/** Calendar-day length of a first-time budget period anchored to setup day. */
export function setupBudgetPeriodDays(ref: Date, startMode: "CURRENT_MONTH" | "NEXT_MONTH") {
  const anchorDay = Math.min(28, Math.max(1, ref.getDate()));
  const startMonthOffset = startMode === "NEXT_MONTH" ? 1 : 0;
  const start = Date.UTC(ref.getFullYear(), ref.getMonth() + startMonthOffset, anchorDay);
  const next = Date.UTC(ref.getFullYear(), ref.getMonth() + startMonthOffset + 1, anchorDay);
  return Math.max(1, Math.round((next - start) / (24 * 60 * 60 * 1000)));
}
