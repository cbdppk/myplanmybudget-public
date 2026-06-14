import { prisma } from "@/lib/prisma";
import { ensureCurrentBudgetPeriod, toNumber } from "@/lib/data/utils";
import { getPeriodDayMetrics, round2 } from "@/lib/finance/math";

export type MoneyOverview = {
  periodName: string;
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
  const { totalDays: daysInMonth, elapsedDays: dayOfMonth } = getPeriodDayMetrics(period.startDate, period.endDate, now);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [
    user,
    monthExtraIncomeAgg,
    monthExtraExpenseAgg,
    monthExtraSavingsAgg,
    todayExtraIncomeAgg,
    todayExtraExpenseAgg,
    todayExtraSavingsAgg,
    monthActualExpenseAgg,
    monthActualSavingsAgg,
    monthActualIncomeAgg,
  ] =
    await Promise.all([
      prisma.userProfile.findUniqueOrThrow({
        where: { id: userId },
        select: {
          baselineIncome: true,
          baselineExpense: true,
          baselineSavings: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          kind: "EXTRA",
          type: "INCOME",
          occurredAt: { gte: period.startDate, lte: period.endDate },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          kind: "EXTRA",
          type: "EXPENSE",
          occurredAt: { gte: period.startDate, lte: period.endDate },
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
          occurredAt: { gte: period.startDate, lte: period.endDate },
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
      // Real expense/savings/income for the whole period (planned + extra), so the
      // live balance reflects what actually happened, not a calendar estimate.
      prisma.transaction.aggregate({
        where: {
          userId,
          type: "EXPENSE",
          occurredAt: { gte: period.startDate, lte: period.endDate },
          OR: [
            { extraType: "EXTRA_EXPENSE" },
            { extraType: null, category: { is: null } },
            { extraType: null, category: { is: { kind: "expense" } } },
          ],
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: "EXPENSE",
          occurredAt: { gte: period.startDate, lte: period.endDate },
          OR: [
            { extraType: "EXTRA_SAVINGS" },
            { extraType: null, category: { is: { kind: "savings" } } },
          ],
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: "INCOME",
          occurredAt: { gte: period.startDate, lte: period.endDate },
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
  const extraIncome = toNumber(monthExtraIncomeAgg._sum.amount);
  const extraExpense = toNumber(monthExtraExpenseAgg._sum.amount);
  const extraSavings = toNumber(monthExtraSavingsAgg._sum.amount);
  const todayExtraIncome = toNumber(todayExtraIncomeAgg._sum.amount);
  const todayExtraExpense = toNumber(todayExtraExpenseAgg._sum.amount);
  const todayExtraSavings = toNumber(todayExtraSavingsAgg._sum.amount);
  // Real recorded spend/savings for the period (planned + extra).
  const actualExpense = round2(toNumber(monthActualExpenseAgg._sum.amount));
  const actualSavings = round2(toNumber(monthActualSavingsAgg._sum.amount));
  const actualIncome = round2(toNumber(monthActualIncomeAgg._sum.amount));
  // Surplus / live balance = available income minus what has actually been spent and saved.
  const surplusRaw = round2(carryIn + baselineIncome + extraIncome - actualExpense - actualSavings);
  const surplusAvailable = round2(Math.max(0, surplusRaw));
  const incomeTotal = round2(carryIn + baselineIncome + extraIncome);
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
