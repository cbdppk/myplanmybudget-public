import { prisma } from "@/lib/prisma";
import { ensureCurrentBudgetPeriod, toNumber } from "@/lib/data/utils";
import { computePeriodActuals, periodSurplus } from "@/lib/data/txn-filters";
import { dayBoundsInTz } from "@/lib/dates";
import { effectiveRegularIncome, getPeriodDayMetrics, round2 } from "@/lib/finance/math";

export type MoneyOverview = {
  periodName: string;
  periodActive: boolean;
  now: Date;
  dayOfMonth: number;
  daysInMonth: number;
  carryIn: number;
  baselineIncome: number;
  baselineExpense: number;
  baselineSavings: number;
  dailyExpenseBudget: number;
  dailySavingsBudget: number;
  baselineExpenseUsedToDate: number;
  baselineSavingsUsedToDate: number;
  expectedExpenseToDate: number;
  expectedSavingsToDate: number;
  actualExpense: number;
  actualSavings: number;
  actualIncome: number;
  extraIncome: number;
  extraExpense: number;
  extraSavings: number;
  todayExtraIncome: number;
  todayExtraExpense: number;
  todayExtraSavings: number;
  surplusRaw: number;
  surplusAvailable: number;
  incomeTotal: number;
  expenseTotal: number;
  savingsTotal: number;
  budgetUsedPct: number;
};

type OverviewPeriod = { name: string; startDate: Date; endDate: Date; carryIn?: unknown };

export async function getMonthlyMoneyOverview(userId: string, options?: { period?: OverviewPeriod }): Promise<MoneyOverview> {
  const period = options?.period ?? (await ensureCurrentBudgetPeriod(userId));
  const now = new Date();
  const user = await prisma.userProfile.findUniqueOrThrow({
    where: { id: userId },
    select: {
      baselineIncome: true,
      baselineExpense: true,
      baselineSavings: true,
      timezone: true,
    },
  });
  const { totalDays: daysInMonth, elapsedDays: dayOfMonth, effectiveNow } = getPeriodDayMetrics(
    period.startDate,
    period.endDate,
    now,
    user.timezone
  );
  const periodActive = now >= period.startDate && now <= period.endDate;
  const actualWindowEnd = periodActive ? effectiveNow : new Date(period.startDate.getTime() - 1);
  const { start: startOfToday, end: endOfToday } = dayBoundsInTz(user.timezone, now);

  const [
    // Real income/expense/savings for the whole period (planned + extra), via the
    // shared canonical filters — the same aggregation that computes next period's
    // carry-in, so live balance and carry-over always agree.
    actuals,
    monthExtraExpenseAgg,
    monthExtraSavingsAgg,
    todayExtraIncomeAgg,
    todayExtraExpenseAgg,
    todayExtraSavingsAgg,
  ] =
    await Promise.all([
      computePeriodActuals(prisma, userId, period.startDate, actualWindowEnd),
      prisma.transaction.aggregate({
        where: {
          userId,
          kind: "EXTRA",
          type: "EXPENSE",
          occurredAt: { gte: period.startDate, lte: actualWindowEnd },
          OR: [{ extraType: "EXTRA_EXPENSE" }, { extraType: null }],
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          kind: "EXTRA",
          type: "EXPENSE",
          extraType: "EXTRA_SAVINGS",
          occurredAt: { gte: period.startDate, lte: actualWindowEnd },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          kind: "EXTRA",
          type: "INCOME",
          occurredAt: { gte: startOfToday, lte: endOfToday },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          kind: "EXTRA",
          type: "EXPENSE",
          occurredAt: { gte: startOfToday, lte: endOfToday },
          OR: [{ extraType: "EXTRA_EXPENSE" }, { extraType: null }],
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          kind: "EXTRA",
          type: "EXPENSE",
          extraType: "EXTRA_SAVINGS",
          occurredAt: { gte: startOfToday, lte: endOfToday },
        },
        _sum: { amount: true },
      }),
    ]);

  const baselineIncome = toNumber(user.baselineIncome);
  const baselineExpense = toNumber(user.baselineExpense);
  const baselineSavings = toNumber(user.baselineSavings);
  const carryIn = toNumber(period.carryIn);
  const dailyExpenseBudget = round2(baselineExpense / Math.max(1, daysInMonth));
  const dailySavingsBudget = round2(baselineSavings / Math.max(1, daysInMonth));
  // Prorated plan consumption — kept only as an "expected by now" reference line.
  const expectedExpenseToDate = round2(dailyExpenseBudget * dayOfMonth);
  const expectedSavingsToDate = round2(dailySavingsBudget * dayOfMonth);
  const extraIncome = actuals.extraIncome;
  const extraExpense = toNumber(monthExtraExpenseAgg._sum.amount);
  const extraSavings = toNumber(monthExtraSavingsAgg._sum.amount);
  const todayExtraIncome = toNumber(todayExtraIncomeAgg._sum.amount);
  const todayExtraExpense = toNumber(todayExtraExpenseAgg._sum.amount);
  const todayExtraSavings = toNumber(todayExtraSavingsAgg._sum.amount);
  // Real recorded spend/savings for the period (planned + extra).
  const actualExpense = actuals.actualExpense;
  const actualSavings = actuals.actualSavings;
  const actualIncome = actuals.actualIncome;
  // Regular (non-extra) income the user has actually recorded this period.
  const actualRegularIncome = round2(actualIncome - extraIncome);
  // Merge plan with reality: planned income is the reference, real recorded
  // income supersedes it once logged (see effectiveRegularIncome). This is the
  // same figure the dashboard uses, so live balance and dashboard net agree.
  const activeBaselineIncome = periodActive ? baselineIncome : 0;
  const regularIncome = effectiveRegularIncome(activeBaselineIncome, actualRegularIncome);
  // Surplus / live balance — same shared formula that computes next period's
  // carry-in, so what you see at period end is exactly what carries forward.
  const surplusRaw = periodSurplus({ carryIn, baselineIncome: activeBaselineIncome, actuals });
  const surplusAvailable = round2(Math.max(0, surplusRaw));
  const incomeTotal = round2(carryIn + regularIncome + extraIncome);
  const expenseTotal = actualExpense;
  const savingsTotal = actualSavings;
  const fullBaselineOutflow = Math.max(1, baselineExpense + baselineSavings);
  const used = actualExpense + actualSavings;
  const budgetUsedPct = Math.min(100, Math.max(0, round2((used / fullBaselineOutflow) * 100)));
  // Backwards-compatible aliases: these used to hold prorated estimates and are consumed
  // as "expected pace" by the transactions page.
  const baselineExpenseUsedToDate = expectedExpenseToDate;
  const baselineSavingsUsedToDate = expectedSavingsToDate;

  return {
    periodName: period.name,
    periodActive,
    now,
    dayOfMonth,
    daysInMonth,
    carryIn,
    baselineIncome,
    baselineExpense,
    baselineSavings,
    dailyExpenseBudget,
    dailySavingsBudget,
    baselineExpenseUsedToDate,
    baselineSavingsUsedToDate,
    expectedExpenseToDate,
    expectedSavingsToDate,
    actualExpense,
    actualSavings,
    actualIncome,
    extraIncome,
    extraExpense,
    extraSavings,
    todayExtraIncome,
    todayExtraExpense,
    todayExtraSavings,
    surplusRaw,
    surplusAvailable,
    incomeTotal,
    expenseTotal,
    savingsTotal,
    budgetUsedPct,
  };
}
