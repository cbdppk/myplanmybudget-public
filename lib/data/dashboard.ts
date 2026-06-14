import { prisma } from "@/lib/prisma";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber, withDbRetry } from "@/lib/data/utils";
import { getDisplayCurrencyContext } from "@/lib/data/currency";
import { getOpenRemindersPreview } from "@/lib/data/reminders";
import { withPerfTiming } from "@/lib/observability/perf";
import { getPeriodDayMetrics, round2 } from "@/lib/finance/math";

type DashboardRange = "WEEKLY" | "MONTHLY" | "YEARLY" | "ALL_TIME" | "SPECIFIC_MONTH";
type ChartMode = "DAILY" | "MONTHLY" | "YEARLY";

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function yearKey(value: Date) {
  return String(value.getFullYear());
}

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function addYears(value: Date, amount: number) {
  return new Date(value.getFullYear() + amount, 0, 1);
}

function chartModeFor(range: DashboardRange, windowStart: Date, windowEnd: Date): ChartMode {
  if (range === "WEEKLY" || range === "MONTHLY" || range === "SPECIFIC_MONTH") return "DAILY";
  if (range === "YEARLY") return "MONTHLY";
  return monthsBetween(windowStart, windowEnd) > 24 ? "YEARLY" : "MONTHLY";
}

export async function getDashboardData(options?: { range?: DashboardRange; month?: string }) {
  return withPerfTiming("dashboard_data", { range: options?.range ?? "MONTHLY" }, () =>
    withDbRetry(async () => {
      const user = await getActiveUser();
      const period = await ensureCurrentBudgetPeriod(user.id);
      const now = new Date();
      const todayStart = startOfDay(now);
      const range = options?.range ?? (options?.month ? "SPECIFIC_MONTH" : "MONTHLY");
      const userStart = startOfDay(new Date(user.createdAt));

      // Parse specific month param: "2025-01" → first and last day of that month
      let specificMonthStart: Date | null = null;
      let specificMonthEnd: Date | null = null;
      if (options?.month) {
        const [y, m] = options.month.split("-").map(Number);
        if (y && m) {
          specificMonthStart = new Date(y, m - 1, 1);
          specificMonthEnd = new Date(y, m, 0, 23, 59, 59, 999);
        }
      }

      const windowStart =
        range === "SPECIFIC_MONTH" && specificMonthStart
          ? specificMonthStart
          : range === "WEEKLY"
            ? startOfDay(addDays(now, -6))
            : range === "YEARLY"
              ? new Date(now.getFullYear(), 0, 1)
              : range === "ALL_TIME"
                ? userStart
                : period.startDate;

      const windowEnd =
        range === "SPECIFIC_MONTH" && specificMonthEnd ? specificMonthEnd : now;

      const windowDays = daysBetween(windowStart, windowEnd);

      const specificMonthLabel = options?.month
        ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(specificMonthStart ?? now)
        : null;

      const windowLabel =
        specificMonthLabel ??
        (range === "WEEKLY"
          ? "this week"
          : range === "YEARLY"
            ? `year to date (${now.getFullYear()})`
            : range === "ALL_TIME"
              ? "all time"
              : "this month");

      const burnStart = startOfDay(addDays(now, -Math.min(30, windowDays)));
      const activeChartMode = chartModeFor(range, windowStart, windowEnd);
      const trendStart =
        activeChartMode === "DAILY"
          ? windowStart
          : activeChartMode === "MONTHLY"
            ? new Date(windowStart.getFullYear(), windowStart.getMonth(), 1)
            : new Date(windowStart.getFullYear(), 0, 1);

      const [
        fx,
        recent,
        reminderOverview,
        goals,
        notes,
        noteCount,
        targets,
        budgetExpenseSpentByCategory,
        budgetExpenseUsedAgg,
        budgetSavingsSpentByCategory,
        burnRateAgg,
        trendTxns,
        rangeTotals,
        todayTotals,
        transactionCount,
        userBudgetPeriods,
      ] = await Promise.all([
        getDisplayCurrencyContext(user),
        prisma.transaction.findMany({
          where: { userId: user.id, occurredAt: { gte: windowStart, lte: windowEnd } },
          include: { category: { select: { name: true, kind: true } } },
          orderBy: { occurredAt: "desc" },
          take: 8,
        }),
        getOpenRemindersPreview(user.id, 5),
        prisma.goal.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.note.findMany({
          where: { userId: user.id },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
          take: 3,
        }),
        prisma.note.count({
          where: { userId: user.id },
        }),
        prisma.budgetTarget.findMany({
          where: { userId: user.id, periodId: period.id },
          include: { category: { select: { id: true, name: true, kind: true } } },
        }),
        // Real expense spend by category (planned + extra), mirroring the budget
        // page so /dashboard and /plan reconcile. Savings are tracked separately.
        prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            userId: user.id,
            type: "EXPENSE",
            OR: [
              { extraType: "EXTRA_EXPENSE" },
              { extraType: null, category: { is: null } },
              { extraType: null, category: { is: { kind: "expense" } } },
            ],
            occurredAt: { gte: windowStart, lte: windowEnd },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId: user.id,
            type: "EXPENSE",
            OR: [
              { extraType: "EXTRA_EXPENSE" },
              { extraType: null, category: { is: null } },
              { extraType: null, category: { is: { kind: "expense" } } },
            ],
            occurredAt: { gte: windowStart, lte: windowEnd },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            userId: user.id,
            type: "EXPENSE",
            OR: [
              { extraType: "EXTRA_SAVINGS" },
              { extraType: null, category: { is: { kind: "savings" } } },
            ],
            occurredAt: { gte: windowStart, lte: windowEnd },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId: user.id,
            type: "EXPENSE",
            OR: [{ extraType: "EXTRA_EXPENSE" }, { extraType: null }],
            occurredAt: { gte: burnStart, lte: now },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          where: { userId: user.id, occurredAt: { gte: trendStart, lte: windowEnd } },
          select: { occurredAt: true, amount: true, type: true },
          orderBy: { occurredAt: "asc" },
        }),
        prisma.transaction.groupBy({
          by: ["type", "extraType"],
          where: { userId: user.id, occurredAt: { gte: windowStart, lte: windowEnd } },
          _sum: { amount: true },
        }),
        prisma.transaction.groupBy({
          by: ["type", "extraType"],
          where: { userId: user.id, occurredAt: { gte: todayStart, lte: now } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.transaction.count({
          where: { userId: user.id, occurredAt: { gte: windowStart, lte: windowEnd } },
        }),
        prisma.budgetPeriod.findMany({
          where: { userId: user.id },
          select: { startDate: true },
          orderBy: { startDate: "desc" },
          take: 24,
        }),
      ]);

      const { reminders, openReminderCount } = reminderOverview;

      const targetExpenseTotal = targets
        .filter((item) => item.category.kind === "expense")
        .reduce((sum, item) => sum + toNumber(item.amount), 0);
      const targetSavingsTotal = targets
        .filter((item) => item.category.kind === "savings")
        .reduce((sum, item) => sum + toNumber(item.amount), 0);
      const baselineIncome = toNumber(user.baselineIncome);
      const baselineExpense = Math.max(toNumber(user.baselineExpense), targetExpenseTotal);
      const baselineSavings = Math.max(toNumber(user.baselineSavings), targetSavingsTotal);
      const { totalDays: daysInPeriod, elapsedDays: daysElapsedInPeriod } = getPeriodDayMetrics(period.startDate, period.endDate, now);
      const periodElapsedFraction = Math.min(1, Math.max(0, daysElapsedInPeriod / Math.max(1, daysInPeriod)));
      const dailyRate = Math.max(1, daysInPeriod);
      const baselineIncomeWindow = round2((baselineIncome / dailyRate) * windowDays);
      const baselineExpenseWindow = round2((baselineExpense / dailyRate) * windowDays);
      const baselineSavingsWindow = round2((baselineSavings / dailyRate) * windowDays);

      const rangeIncome = rangeTotals
        .filter((item) => item.type === "INCOME")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const rangeExtraIncome = rangeTotals
        .filter((item) => item.type === "INCOME" && item.extraType === "EXTRA_INCOME")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const rangeExtraSavings = rangeTotals
        .filter((item) => item.type === "EXPENSE" && item.extraType === "EXTRA_SAVINGS")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const rangeExpense = rangeTotals
        .filter((item) => item.type === "EXPENSE" && item.extraType !== "EXTRA_SAVINGS")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const rangeExtraExpense = rangeTotals
        .filter((item) => item.type === "EXPENSE" && item.extraType === "EXTRA_EXPENSE")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);

      const plannedIncome = baselineIncomeWindow;
      const plannedExpenses = baselineExpenseWindow;
      const plannedSavings = baselineSavingsWindow;
      const income = round2(rangeIncome);
      const expenses = round2(rangeExpense);
      const savings = round2(rangeExtraSavings);
      const extraIncome = round2(rangeExtraIncome);
      const extraExpenses = round2(rangeExtraExpense);
      const totalOutflow = round2(expenses + savings);
      const net = round2(income - totalOutflow);
      const plannedNet = round2(plannedIncome - plannedExpenses - plannedSavings);
      const availableMoney = net;

      const todayIncome = todayTotals
        .filter((item) => item.type === "INCOME")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const todaySavings = todayTotals
        .filter((item) => item.type === "EXPENSE" && item.extraType === "EXTRA_SAVINGS")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const todayExpenses = todayTotals
        .filter((item) => item.type === "EXPENSE" && item.extraType !== "EXTRA_SAVINGS")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const todayCount = todayTotals.reduce((sum, item) => sum + item._count._all, 0);
      const actualDailyBurn = Math.round((toNumber(burnRateAgg._sum.amount) / Math.max(1, Math.min(30, windowDays))) * 100) / 100;
      const budgetDailyExpense = round2(baselineExpense / dailyRate);
      const burnRate = round2((actualDailyBurn + budgetDailyExpense) / 2);

      const expenseSpentMap = new Map(budgetExpenseSpentByCategory.map((row) => [row.categoryId, toNumber(row._sum.amount)]));
      const savingsSpentMap = new Map(budgetSavingsSpentByCategory.map((row) => [row.categoryId, toNumber(row._sum.amount)]));
      const budgeted = round2(range === "MONTHLY" ? baselineExpense : baselineExpenseWindow);
      const used = round2(toNumber(budgetExpenseUsedAgg._sum.amount));
      const budgetRemaining = round2(budgeted - used);
      const budgetStatusPct = budgeted > 0 ? Math.min(100, Math.max(0, round2((used / budgeted) * 100))) : 0;
      // "Expected by now": prorated plan consumption from calendar pace, used only as a
      // reference marker so the user can see whether real spend is ahead of or behind plan.
      const budgetExpectedToDate = round2(budgeted * periodElapsedFraction);
      const expectedProgressPct = round2(periodElapsedFraction * 100);
      const budgetPaceDelta = round2(used - budgetExpectedToDate);

      const budgetByCategory = targets
        .map((item) => {
          const target = toNumber(item.amount);
          const spent = item.category.kind === "savings" ? savingsSpentMap.get(item.categoryId) ?? 0 : expenseSpentMap.get(item.categoryId) ?? 0;
          return {
            categoryId: item.categoryId,
            category: item.category.name,
            kind: item.category.kind,
            target,
            spent,
            remaining: round2(target - spent),
          };
        })
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 8);
      const topSpendCategory =
        budgetByCategory
          .filter((item) => item.kind === "expense")
          .sort((a, b) => b.spent - a.spent)[0] ?? null;

      const movementMap = new Map<string, { income: number; expense: number }>();
      if (activeChartMode === "DAILY") {
        for (let i = 0; i < windowDays; i += 1) {
          movementMap.set(dateKey(addDays(windowStart, i)), { income: 0, expense: 0 });
        }
      } else if (activeChartMode === "MONTHLY") {
        const totalMonths = monthsBetween(windowStart, windowEnd) + 1;
        for (let i = 0; i < totalMonths; i += 1) {
          movementMap.set(monthKey(addMonths(windowStart, i)), { income: 0, expense: 0 });
        }
      } else {
        const totalYears = windowEnd.getFullYear() - windowStart.getFullYear() + 1;
        for (let i = 0; i < totalYears; i += 1) {
          movementMap.set(yearKey(addYears(windowStart, i)), { income: 0, expense: 0 });
        }
      }

      for (const txn of trendTxns) {
        const key =
          activeChartMode === "DAILY"
            ? dateKey(txn.occurredAt)
            : activeChartMode === "MONTHLY"
              ? monthKey(txn.occurredAt)
              : yearKey(txn.occurredAt);
        const row = movementMap.get(key);
        if (!row) continue;
        const amount = toNumber(txn.amount);
        if (txn.type === "INCOME") row.income += amount;
        if (txn.type === "EXPENSE") row.expense += amount;
      }

      const movementSeries = Array.from(movementMap.entries()).map(([label, row]) => ({
        label,
        income: round2(row.income),
        expense: round2(row.expense),
        net: round2(row.income - row.expense),
      }));

      const moneyGist =
        availableMoney >= 0 && budgetStatusPct <= 85
          ? "You are inside budget and still keeping money available."
          : availableMoney >= 0
            ? "Money is still positive, but spending pressure is rising."
            : "You are spending faster than this budget window can support.";

      const savingsRateBase = round2(plannedSavings + savings);
      const savingsRatePct = plannedIncome > 0 ? Math.round((savingsRateBase / plannedIncome) * 1000) / 10 : 0;
      const emergencyFundTarget = round2((expenses > 0 ? expenses : plannedExpenses) * 3);
      const recent7 = movementSeries.slice(-7);
      const recent7Net = recent7.reduce((sum, item) => sum + item.net, 0);
      const overspendDays7 = recent7.filter((item) => item.expense > item.income).length;
      const extraIncomeNeeded = Math.max(0, totalOutflow - income);

      const moneyLessons = [
        {
          id: "savings-rate",
          title: "Savings Rate",
          status: savingsRatePct >= 20 ? "good" : savingsRatePct >= 0 ? "warning" : "bad",
          insight:
            plannedSavings === 0 && savings === 0
              ? "No savings target or extra savings logged yet. Set a savings budget or log extra savings to track this rate."
              : savingsRatePct >= 20
                ? `Strong pace: your planned savings plus extra savings put you at ${savingsRatePct}% for ${windowLabel}.`
                : savingsRatePct >= 0
                  ? `Savings rate is ${savingsRatePct}% from budgeted savings pace plus extra savings. Push it toward 20% for stronger resilience.`
                  : `Savings rate is ${savingsRatePct}%. Spending is above income right now.`,
        },
        {
          id: "emergency-fund",
          title: "Emergency Buffer",
          status: availableMoney > 0 ? "good" : "warning",
          insight:
            emergencyFundTarget > 0
              ? `Target a 3-month buffer of ${Math.round(emergencyFundTarget * 100) / 100} in your currency.`
              : "Create a stronger expense baseline before estimating a buffer target.",
        },
        {
          id: "weekly-flow",
          title: "Recent Cashflow",
          status: recent7Net >= 0 ? "good" : "bad",
          insight:
            recent7Net >= 0
              ? `Recent net flow is positive (${Math.round(recent7Net * 100) / 100}).`
              : `Recent net flow is negative (${Math.round(recent7Net * 100) / 100}) with ${overspendDays7} overspend day(s).`,
        },
        {
          id: "income-gap",
          title: "Income Gap Plan",
          status: extraIncomeNeeded > 0 ? "warning" : "good",
          insight:
            extraIncomeNeeded > 0
              ? `You need at least ${Math.round(extraIncomeNeeded * 100) / 100} more income or matching cuts to break even.`
              : "Income currently covers spending in this window.",
        },
      ] as const;

      const goalsWithProgress = goals.map((goal) => {
        const target = toNumber(goal.target);
        const current = toNumber(goal.current);
        const progressPct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
        return {
          ...goal,
          progressPct,
        };
      });
      const completedGoals = goalsWithProgress.filter((goal) => goal.progressPct >= 100).length;
      const averageGoalProgressPct =
        goalsWithProgress.length > 0
          ? Math.round((goalsWithProgress.reduce((sum, goal) => sum + goal.progressPct, 0) / goalsWithProgress.length) * 10) / 10
          : 0;

      return {
        user,
        currency: {
          base: fx.baseCurrency,
          preferred: fx.preferredCurrency,
          rate: fx.fxRate,
        },
        filters: {
          range,
          windowStart,
          windowDays,
          windowLabel,
          chartLabel:
            activeChartMode === "DAILY"
              ? "daily money movement"
              : activeChartMode === "MONTHLY"
                ? "monthly money movement"
                : "yearly money movement",
          chartMode: activeChartMode,
        },
        period,
        income,
        expenses,
        savings,
        extraIncome,
        extraExpenses,
        totalOutflow,
        plannedIncome,
        plannedExpenses,
        plannedSavings,
        // Full monthly baseline amounts (not prorated) — used for Money Health card
        baselineIncome,
        baselineExpense,
        baselineSavings,
        availableMoney,
        net,
        burnRate,
        budgeted,
        used,
        budgetRemaining,
        budgetStatusPct,
        budgetExpectedToDate,
        expectedProgressPct,
        budgetPaceDelta,
        budgetByCategory,
        topSpendCategory,
        movementSeries,
        moneyStatus: availableMoney,
        moneyStatusBreakdown: {
          baselineNet: plannedNet,
          extraNet: net,
          carryForward: 0,
        },
        moneyGist,
        savingsRatePct,
        moneyLessons,
        todaySummary: {
          count: todayCount,
          income: todayIncome,
          expenses: todayExpenses,
          savings: todaySavings,
          net: round2(todayIncome - todayExpenses - todaySavings),
        },
        recent,
        reminders,
        openReminderCount,
        notes,
        noteSummary: {
          count: noteCount,
        },
        goals: goalsWithProgress,
        goalSummary: {
          count: goalsWithProgress.length,
          completed: completedGoals,
          averageProgressPct: averageGoalProgressPct,
          totalSaved: goalsWithProgress.reduce((sum, goal) => sum + toNumber(goal.current), 0),
          totalTarget: goalsWithProgress.reduce((sum, goal) => sum + toNumber(goal.target), 0),
        },
        appSummary: {
          transactionCount,
          goalCount: goalsWithProgress.length,
          openReminderCount,
          noteCount,
        },
        userMonths: Array.from(
          new Map(
            userBudgetPeriods.map((p) => {
              const d = new Date(p.startDate);
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
              return [key, { key, label }] as const;
            })
          ).values()
        ),
        activeMonth: options?.month ?? null,
      };
    }, 3),
  );
}
