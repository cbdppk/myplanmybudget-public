import { getZonedParts, safeTimeZone } from "@/lib/dates";

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Reconcile planned (baseline) income with what the user has actually recorded.
 *
 * The plan is the reference: a user with $3k fixed monthly income sees $3k from
 * day one, before logging anything. As they record real income transactions the
 * actual figure *merges in* rather than stacking on top — so logging the $3k
 * paycheck keeps income at $3k (not $6k), and recording more than planned lifts
 * it to the real amount. Extra/bonus income is tracked separately and always
 * adds on top of this effective figure.
 *
 * Both the dashboard and the live-balance overview call this so the income they
 * display — and therefore every net / surplus derived from it — always agree.
 */
export function effectiveRegularIncome(baselineIncome: number, actualRegularIncome: number) {
  return round2(Math.max(baselineIncome, actualRegularIncome));
}

export function extraExpenseAvailable(params: {
  carryIn: number;
  baselineIncome: number;
  baselineExpense: number;
  baselineSavings: number;
  actualIncome: number;
  extraIncome: number;
  extraExpense: number;
}) {
  const regularIncome = effectiveRegularIncome(
    params.baselineIncome,
    round2(params.actualIncome - params.extraIncome)
  );
  return round2(
    params.carryIn +
      regularIncome +
      params.extraIncome -
      params.baselineExpense -
      params.baselineSavings -
      params.extraExpense
  );
}

/**
 * Income shown on the dashboard for the selected filter window.
 *
 * `monthsInWindow` is how many budget-income cycles the window spans (income
 * lands once per budget month): 0 for sub-month windows (today/this week),
 * 1 for a single month, N for year-to-date or all-time. When it's 0 the figure
 * is purely what the user recorded in the window; otherwise the budget income
 * accrued over those months is the reference that recorded regular income
 * merges into (never stacks on), and extra income always adds on top.
 */
export function windowIncome(params: {
  baselineIncome: number;
  monthsInWindow: number;
  recordedRegularIncome: number;
  recordedExtraIncome: number;
}) {
  const { baselineIncome, monthsInWindow, recordedRegularIncome, recordedExtraIncome } = params;
  const budgetIncome = round2(baselineIncome * Math.max(0, monthsInWindow));
  const regular =
    monthsInWindow > 0
      ? effectiveRegularIncome(budgetIncome, recordedRegularIncome)
      : round2(recordedRegularIncome);
  return {
    regular,
    extra: round2(recordedExtraIncome),
    total: round2(regular + round2(recordedExtraIncome)),
  };
}

function calendarDayOrdinal(value: Date, timeZone: string) {
  const parts = getZonedParts(value, safeTimeZone(timeZone));
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / (24 * 60 * 60 * 1000));
}

export function getPeriodDayMetrics(periodStart: Date, periodEnd: Date, now: Date, timeZone = "UTC") {
  const startDay = calendarDayOrdinal(periodStart, timeZone);
  const endDay = calendarDayOrdinal(periodEnd, timeZone);
  const totalDays = Math.max(1, endDay - startDay + 1);
  const effectiveNow = now > periodEnd ? periodEnd : now;
  const elapsedRaw = calendarDayOrdinal(effectiveNow, timeZone) - startDay + 1;
  const elapsedDays = Math.max(0, Math.min(totalDays, elapsedRaw));
  return { totalDays, elapsedDays, effectiveNow };
}

/** Number of spendable calendar days left, including today. */
export function remainingPeriodDays(totalDays: number, elapsedDays: number) {
  if (elapsedDays <= 0) return Math.max(1, totalDays);
  return Math.max(1, totalDays - elapsedDays + 1);
}

export function computeCarryForwardFromGroups(rows: Array<{ type: string; amount: number }>) {
  return rows.reduce((sum, row) => {
    if (row.type === "INCOME") return sum + row.amount;
    if (row.type === "EXPENSE") return sum - row.amount;
    return sum;
  }, 0);
}
