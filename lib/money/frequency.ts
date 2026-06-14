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
