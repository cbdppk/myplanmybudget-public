import { prisma } from "@/lib/prisma";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber, withDbRetry } from "@/lib/data/utils";
import { getDisplayCurrencyContext } from "@/lib/data/currency";
import { materializeDueRecurringRules } from "@/lib/data/recurring";
import { getOpenRemindersPreview } from "@/lib/data/reminders";
import { withPerfTiming } from "@/lib/observability/perf";
import { effectiveRegularIncome, extraExpenseAvailable, getPeriodDayMetrics, round2, windowIncome } from "@/lib/finance/math";
import { addDaysUtc, dayBoundsInTz, getZonedParts, safeTimeZone, zonedMidnightUtc } from "@/lib/dates";
import { actualExpenseWhere, actualSavingsWhere } from "@/lib/data/txn-filters";

type DashboardRange = "DAY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "ALL_TIME" | "SPECIFIC_MONTH";
type ChartMode = "DAILY" | "MONTHLY" | "YEARLY";

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

// Chart bucket keys use the user's local calendar so a late-night purchase
// lands on the day the user experienced, not the server's UTC date.
function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function dateKeyTz(value: Date, timeZone: string) {
  const parts = getZonedParts(value, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function monthKeyTz(value: Date, timeZone: string) {
  const parts = getZonedParts(value, timeZone);
  return `${parts.year}-${pad2(parts.month)}`;
}

function yearKeyTz(value: Date, timeZone: string) {
  return String(getZonedParts(value, timeZone).year);
}

function monthsBetweenTz(start: Date, end: Date, timeZone: string) {
  const s = getZonedParts(start, timeZone);
  const e = getZonedParts(end, timeZone);
  return (e.year - s.year) * 12 + (e.month - s.month);
}

function chartModeFor(range: DashboardRange, windowStart: Date, windowEnd: Date, timeZone: string): ChartMode {
  if (range === "DAY" || range === "WEEKLY" || range === "MONTHLY" || range === "SPECIFIC_MONTH") return "DAILY";
  if (range === "YEARLY") return "MONTHLY";
  // ALL_TIME: pick a granularity that gives the chart enough points to draw a
  // real shape. A new user with one or two months of history would otherwise
  // get a single monthly dot; show them daily movement instead.
  const months = monthsBetweenTz(windowStart, windowEnd, timeZone);
  if (months > 24) return "YEARLY";
  if (months >= 2) return "MONTHLY";
  return "DAILY";
}

export async function getDashboardData(options?: { range?: DashboardRange; month?: string }) {
  return withPerfTiming("dashboard_data", { range: options?.range ?? "MONTHLY" }, () =>
    withDbRetry(async () => {
      const user = await getActiveUser();
      // Post due recurring transactions before reading so every figure includes them.
      await materializeDueRecurringRules(user.id);
      const period = await ensureCurrentBudgetPeriod(user.id);
      const now = new Date();
      const periodReadEnd = now < period.startDate
        ? new Date(period.startDate.getTime() - 1)
        : now < period.endDate ? now : period.endDate;
      const timeZone = safeTimeZone(user.timezone);
      const nowParts = getZonedParts(now, timeZone);
      const todayStart = dayBoundsInTz(timeZone, now).start;
      const range = options?.range ?? (options?.month ? "SPECIFIC_MONTH" : "MONTHLY");
      // ALL_TIME starts at the beginning of the signup MONTH, not the signup
      // day — so the earliest chart bucket includes any transactions logged
      // earlier that month (e.g. a salary on the 1st when signup was the 5th)
      // instead of showing an empty first month.
      const signupParts = getZonedParts(new Date(user.createdAt), timeZone);
      const userStart = zonedMidnightUtc(signupParts.year, signupParts.month, 1, timeZone);

      // Parse specific month param: "2025-01" → that month in the user's timezone
      let specificMonthStart: Date | null = null;
      let specificMonthEnd: Date | null = null;
      if (options?.month) {
        const [y, m] = options.month.split("-").map(Number);
        if (y && m) {
          specificMonthStart = zonedMidnightUtc(y, m, 1, timeZone);
          specificMonthEnd = new Date(zonedMidnightUtc(y, m + 1, 1, timeZone).getTime() - 1);
        }
      }

      const windowStart =
        range === "SPECIFIC_MONTH" && specificMonthStart
          ? specificMonthStart
          : range === "DAY"
            ? todayStart
            : range === "WEEKLY"
              ? dayBoundsInTz(timeZone, addDaysUtc(now, -6)).start
              : range === "YEARLY"
                ? zonedMidnightUtc(nowParts.year, 1, 1, timeZone)
                : range === "ALL_TIME"
                  ? userStart
                  : period.startDate;

      const windowEnd =
        range === "SPECIFIC_MONTH" && specificMonthEnd ? specificMonthEnd : now;

      const windowDays = daysBetween(windowStart, windowEnd);

      const specificMonthLabel = options?.month
        ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone }).format(specificMonthStart ?? now)
        : null;

      const windowLabel =
        specificMonthLabel ??
        (range === "DAY"
          ? "today"
          : range === "WEEKLY"
            ? "this week"
            : range === "YEARLY"
              ? `year to date (${nowParts.year})`
              : range === "ALL_TIME"
                ? "all time"
                : "this month");

      const activeChartMode = chartModeFor(range, windowStart, windowEnd, timeZone);
      const windowStartParts = getZonedParts(windowStart, timeZone);
      const trendStart =
        activeChartMode === "DAILY"
          ? windowStart
          : activeChartMode === "MONTHLY"
            ? zonedMidnightUtc(windowStartParts.year, windowStartParts.month, 1, timeZone)
            : zonedMidnightUtc(windowStartParts.year, 1, 1, timeZone);

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
        trendTxns,
        rangeTotals,
        rangeExpenseAgg,
        rangeSavingsAgg,
        todayTotals,
        todayExpenseAgg,
        todaySavingsAgg,
        healthTotals,
        allCategories,
        transactionCount,
        earliestTxn,
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
        // Planned expense spend by category, summed over the BUDGET PERIOD (not the
        // chart window) since the per-category target is a monthly allocation — so
        // "Budget by category" allocated vs spent always compares like-for-like.
        // Off-budget EXTRA_EXPENSE is excluded here: it draws from surplus, not a
        // category's planned budget.
        prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            userId: user.id,
            type: "EXPENSE",
            extraType: null,
            category: { is: { kind: "expense" } },
            occurredAt: { gte: period.startDate, lte: periodReadEnd },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId: user.id,
            type: "EXPENSE",
            extraType: null,
            category: { is: { kind: "expense" } },
            occurredAt: { gte: period.startDate, lte: periodReadEnd },
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
            occurredAt: { gte: period.startDate, lte: periodReadEnd },
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
        prisma.transaction.aggregate({
          where: actualExpenseWhere(user.id, windowStart, windowEnd),
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: actualSavingsWhere(user.id, windowStart, windowEnd),
          _sum: { amount: true },
        }),
        prisma.transaction.groupBy({
          by: ["type", "extraType"],
          where: { userId: user.id, occurredAt: { gte: todayStart, lte: now } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.transaction.aggregate({
          where: actualExpenseWhere(user.id, todayStart, now),
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: actualSavingsWhere(user.id, todayStart, now),
          _sum: { amount: true },
        }),
        // Month-anchored totals for the Money-health card: the health figures
        // always describe the displayed month (budget period or the picked
        // specific month), independent of the chart window.
        prisma.transaction.groupBy({
          by: ["type", "extraType"],
          where: {
            userId: user.id,
            occurredAt: {
              gte: range === "SPECIFIC_MONTH" && specificMonthStart ? specificMonthStart : period.startDate,
              lte: range === "SPECIFIC_MONTH" && specificMonthEnd ? specificMonthEnd : periodReadEnd,
            },
          },
          _sum: { amount: true },
        }),
        prisma.category.findMany({
          where: { userId: user.id, kind: { in: ["expense", "savings"] } },
          select: { id: true, name: true, kind: true },
        }),
        prisma.transaction.count({
          where: { userId: user.id, occurredAt: { gte: windowStart, lte: windowEnd } },
        }),
        // Earliest transaction: the month picker spans from here (or signup,
        // whichever is earlier) to now, so every month that could hold data is
        // selectable — not just months that happen to have a budget period.
        prisma.transaction.findFirst({
          where: { userId: user.id },
          select: { occurredAt: true },
          orderBy: { occurredAt: "asc" },
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
      const { totalDays: daysInPeriod, elapsedDays: daysElapsedInPeriod } = getPeriodDayMetrics(
        period.startDate,
        period.endDate,
        now,
        timeZone
      );
      const periodActive = now >= period.startDate && now <= period.endDate;
      const periodElapsedFraction = Math.min(1, Math.max(0, daysElapsedInPeriod / Math.max(1, daysInPeriod)));
      const dailyRate = Math.max(1, daysInPeriod);
      const baselineIncomeWindow = periodActive ? round2((baselineIncome / dailyRate) * windowDays) : 0;
      const baselineExpenseWindow = periodActive ? round2((baselineExpense / dailyRate) * windowDays) : 0;
      const baselineSavingsWindow = periodActive ? round2((baselineSavings / dailyRate) * windowDays) : 0;

      const rangeIncome = rangeTotals
        .filter((item) => item.type === "INCOME")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const rangeExtraIncome = rangeTotals
        .filter((item) => item.type === "INCOME" && item.extraType === "EXTRA_INCOME")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const rangeSavings = toNumber(rangeSavingsAgg._sum.amount);
      const rangeExpense = toNumber(rangeExpenseAgg._sum.amount);
      const rangeExtraExpense = rangeTotals
        .filter((item) => item.type === "EXPENSE" && item.extraType === "EXTRA_EXPENSE")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);

      const plannedIncome = baselineIncomeWindow;
      const plannedExpenses = baselineExpenseWindow;
      const plannedSavings = baselineSavingsWindow;
      const extraIncome = round2(rangeExtraIncome);
      // Merge plan with reality: the prorated planned income is the reference and
      // real recorded regular income supersedes it once logged, then extra income
      // adds on top. Identical reconciliation to lib/data/money-overview.ts so the
      // dashboard net and the /track live balance always agree.
      const rangeRegularIncome = round2(rangeIncome - rangeExtraIncome);
      const income = round2(effectiveRegularIncome(baselineIncomeWindow, rangeRegularIncome) + extraIncome);
      // Money health shows REAL actuals — what money has actually left — so a
      // figure never claims money is gone when it isn't. The depleting plan
      // ("you'd have spent ~X by now if you tracked the plan evenly") is exposed
      // separately as a reference (plannedExpenseToDate / plannedSavingsToDate),
      // surfaced as an "expected by now" line in the UI, not baked into the actual.
      // The window already ends at "now", so baselineExpenseWindow == planned-to-date.
      const expenses = round2(rangeExpense);
      const savings = round2(rangeSavings);
      const plannedExpenseToDate = round2(baselineExpenseWindow);
      const plannedSavingsToDate = round2(baselineSavingsWindow);
      const extraExpenses = round2(rangeExtraExpense);
      const totalOutflow = round2(expenses + savings);
      const net = round2(income - totalOutflow);
      const plannedNet = round2(plannedIncome - plannedExpenses - plannedSavings);
      const availableMoney = net;
      // Raw actual transaction totals — used by the Money-movement section so its
      // "Total in / out" cards match the chart, which plots real transactions
      // (the Money-health card above is the plan-depleting view instead).
      const actualIncomeTotal = round2(rangeIncome);
      const actualExpenseTotal = round2(rangeExpense);
      const actualSavingsTotal = round2(rangeSavings);
      const actualNet = round2(actualIncomeTotal - actualExpenseTotal - actualSavingsTotal);

      // Daily plan allowances — the budget spread evenly across the period.
      const dailyPlannedExpense = round2(baselineExpense / dailyRate);
      const dailyPlannedSavings = round2(baselineSavings / dailyRate);
      const todayActualIncome = todayTotals
        .filter((item) => item.type === "INCOME")
        .reduce((sum, item) => sum + toNumber(item._sum.amount), 0);
      const todayActualSavings = toNumber(todaySavingsAgg._sum.amount);
      const todayActualExpenses = toNumber(todayExpenseAgg._sum.amount);
      // Today shows what was ACTUALLY logged today (truthful), with the day's
      // planned allowance kept separately as a reference (dailyPlannedExpense /
      // dailyPlannedSavings) so the UI can show "of your ~X/day plan" without
      // claiming money left the account when it hasn't.
      const todayIncome = round2(todayActualIncome);
      const todayExpenses = round2(todayActualExpenses);
      const todaySavings = round2(todayActualSavings);
      const todayCount = todayTotals.reduce((sum, item) => sum + item._count._all, 0);

      // ── Money-health income: responds to the selected filter ──
      //  • TODAY / WEEKLY   → income actually recorded in that window only.
      //  • MONTHLY / month  → full budget income (merged with recorded regular
      //                       income, never stacked) + extra income — the
      //                       month's total money from day one.
      //  • YEARLY           → budget income accrued month-by-month across the
      //                       year so far, merged with recorded regular income,
      //                       + extra income.
      //  • ALL_TIME         → all budget income accrued since signup, merged
      //                       with all recorded regular income, + extra income.
      // The "regular income" in every window is what the user recorded there;
      // extra income always adds on top.
      // How many budget months the window's plan covers (income lands once per
      // budget month). Windows shorter than a month contribute no budget income
      // baseline — only what was actually recorded counts.
      const monthsInWindow =
        range === "ALL_TIME"
          ? Math.max(1, monthsBetweenTz(userStart, now, timeZone) + 1)
          : range === "YEARLY"
            ? Math.max(1, nowParts.month)
            : range === "MONTHLY" || range === "SPECIFIC_MONTH"
              ? 1
              : 0; // DAY / WEEKLY: no baseline income, recorded only
      const health = windowIncome({
        baselineIncome: periodActive ? baselineIncome : 0,
        monthsInWindow,
        recordedRegularIncome: round2(rangeIncome - rangeExtraIncome),
        recordedExtraIncome: rangeExtraIncome,
      });
      const healthRegularIncome = health.regular;
      const healthExtraIncome = health.extra;
      const healthIncome = health.total;

      // Extra (off-budget) spend for the avg-spend/day calc — always the
      // current budget month, since the daily average is a month concept.
      const healthExtraExpense = round2(
        healthTotals
          .filter((item) => item.type === "EXPENSE" && item.extraType === "EXTRA_EXPENSE")
          .reduce((sum, item) => sum + toNumber(item._sum.amount), 0)
      );
      const healthActualIncome = round2(
        healthTotals
          .filter((item) => item.type === "INCOME")
          .reduce((sum, item) => sum + toNumber(item._sum.amount), 0)
      );
      const healthExtraIncomeMonth = round2(
        healthTotals
          .filter((item) => item.type === "INCOME" && item.extraType === "EXTRA_INCOME")
          .reduce((sum, item) => sum + toNumber(item._sum.amount), 0)
      );

      // Avg spend/day = the budget's daily share plus any off-budget extra
      // spending averaged over the days elapsed so far this month.
      const burnRate = round2(
        (periodActive ? baselineExpense : 0) / dailyRate + healthExtraExpense / Math.max(1, daysElapsedInPeriod)
      );

      const expenseSpentMap = new Map(budgetExpenseSpentByCategory.map((row) => [row.categoryId, toNumber(row._sum.amount)]));
      const savingsSpentMap = new Map(budgetSavingsSpentByCategory.map((row) => [row.categoryId, toNumber(row._sum.amount)]));
      // Budget used is a monthly-budget concept, so it doesn't shrink with a
      // weekly/yearly chart window.
      const budgeted = round2(baselineExpense);
      // Real logged planned-expense spend this period.
      const actualSpent = round2(toNumber(budgetExpenseUsedAgg._sum.amount));
      // "Expected by now": the budget the plan releases at its daily average by
      // today (avg/day × days elapsed). This is the primary "used" figure —
      // the budget dissected day by day.
      const budgetExpectedToDate = round2(budgeted * periodElapsedFraction);
      // The headline moves with reality: normally it's the plan-released amount,
      // but once real spend runs ahead of the pace, actual spend pulls it up.
      const used = round2(Math.min(budgeted, Math.max(budgetExpectedToDate, actualSpent)));
      const budgetRemaining = round2(budgeted - used);
      const budgetStatusPct = budgeted > 0 ? Math.min(100, Math.max(0, round2((used / budgeted) * 100))) : 0;
      const expectedProgressPct = round2(periodElapsedFraction * 100);
      const budgetPaceDelta = round2(actualSpent - budgetExpectedToDate);

      // Surplus pool that off-budget extra spending draws from, computed from the
      // full monthly plan so it matches the /track live-balance model: income
      // (regular + extra, over the period) minus the full planned outflow. When
      // extra spend exceeds it, the user is eating into their plan → warn.
      const surplusForExtras = extraExpenseAvailable({
        carryIn: toNumber(period.carryIn),
        baselineIncome: periodActive ? baselineIncome : 0,
        baselineExpense: periodActive ? baselineExpense : 0,
        baselineSavings: periodActive ? baselineSavings : 0,
        actualIncome: healthActualIncome,
        extraIncome: healthExtraIncomeMonth,
        extraExpense: 0,
      });
      const extraSurplusRemaining = extraExpenseAvailable({
        carryIn: toNumber(period.carryIn),
        baselineIncome: periodActive ? baselineIncome : 0,
        baselineExpense: periodActive ? baselineExpense : 0,
        baselineSavings: periodActive ? baselineSavings : 0,
        actualIncome: healthActualIncome,
        extraIncome: healthExtraIncomeMonth,
        extraExpense: healthExtraExpense,
      });
      // Structured warning — the page formats the amount with the user's currency.
      // "budget-full" fires on ACTUAL spend hitting the budget, not on time
      // elapsing (the plan-released figure reaches 100% at month end by design).
      const budgetWarning: { level: "bad" | "warn"; kind: "over-surplus" | "budget-full" | "over-pace"; amount: number } | null =
        extraSurplusRemaining < 0
          ? { level: "bad", kind: "over-surplus", amount: Math.abs(extraSurplusRemaining) }
          : actualSpent >= budgeted && budgeted > 0
            ? { level: "warn", kind: "budget-full", amount: 0 }
            : budgetPaceDelta > 0.01
              ? { level: "warn", kind: "over-pace", amount: budgetPaceDelta }
              : null;

      // Categories with a target, plus categories with real spend but no
      // target yet (target 0) — so the card shows data as soon as anything is
      // logged, not only after per-category budgets are configured.
      const targetedCategoryIds = new Set(targets.map((item) => item.categoryId));
      const spentOnlyRows = allCategories
        .filter((category) => !targetedCategoryIds.has(category.id))
        .map((category) => ({
          categoryId: category.id,
          category: category.name,
          kind: category.kind,
          target: 0,
          spent: category.kind === "savings" ? savingsSpentMap.get(category.id) ?? 0 : expenseSpentMap.get(category.id) ?? 0,
        }))
        .filter((row) => row.spent > 0);
      const budgetByCategory = [
        ...targets.map((item) => {
          const target = toNumber(item.amount);
          const spent = item.category.kind === "savings" ? savingsSpentMap.get(item.categoryId) ?? 0 : expenseSpentMap.get(item.categoryId) ?? 0;
          return {
            categoryId: item.categoryId,
            category: item.category.name,
            kind: item.category.kind,
            target,
            spent,
          };
        }),
        ...spentOnlyRows,
      ]
        .map((row) => ({ ...row, remaining: round2(row.target - row.spent) }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 8);
      const topSpendCategory =
        budgetByCategory
          .filter((item) => item.kind === "expense")
          .sort((a, b) => b.spent - a.spent)[0] ?? null;

      // Seed chart buckets from the window's local calendar (keys are pure
      // calendar arithmetic on local parts, so DST shifts can't skip a bucket).
      const movementMap = new Map<string, { income: number; expense: number }>();
      if (activeChartMode === "DAILY") {
        for (let i = 0; i < windowDays; i += 1) {
          const day = new Date(Date.UTC(windowStartParts.year, windowStartParts.month - 1, windowStartParts.day + i));
          movementMap.set(day.toISOString().slice(0, 10), { income: 0, expense: 0 });
        }
      } else if (activeChartMode === "MONTHLY") {
        const totalMonths = monthsBetweenTz(windowStart, windowEnd, timeZone) + 1;
        for (let i = 0; i < totalMonths; i += 1) {
          const monthIndex = windowStartParts.month - 1 + i;
          const y = windowStartParts.year + Math.floor(monthIndex / 12);
          const m = (monthIndex % 12) + 1;
          movementMap.set(`${y}-${pad2(m)}`, { income: 0, expense: 0 });
        }
      } else {
        const endYear = getZonedParts(windowEnd, timeZone).year;
        for (let y = windowStartParts.year; y <= endYear; y += 1) {
          movementMap.set(String(y), { income: 0, expense: 0 });
        }
      }

      for (const txn of trendTxns) {
        const key =
          activeChartMode === "DAILY"
            ? dateKeyTz(txn.occurredAt, timeZone)
            : activeChartMode === "MONTHLY"
              ? monthKeyTz(txn.occurredAt, timeZone)
              : yearKeyTz(txn.occurredAt, timeZone);
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

      // Plan overlay for the movement chart: the expected expenditure per day
      // (budget expense spread over the period), spiking to the planned income
      // on the income day of each month (the budget-month anchor day). Monthly
      // and yearly buckets show the plan's expense total for the bucket.
      const incomeDayOfMonth = getZonedParts(period.startDate, timeZone).day;
      const plannedMovementSeries = movementSeries.map(({ label }) => {
        if (activeChartMode === "DAILY") {
          const bucketDay = Number(label.slice(8, 10));
          const base = round2(baselineExpense / dailyRate);
          return bucketDay === incomeDayOfMonth ? round2(base + baselineIncome) : base;
        }
        if (activeChartMode === "MONTHLY") return round2(baselineExpense);
        return round2(baselineExpense * 12);
      });

      // Pressure is measured on ACTUAL spend vs budget (not time elapsed).
      const actualUsedPct = budgeted > 0 ? (actualSpent / budgeted) * 100 : 0;
      const moneyGist =
        availableMoney >= 0 && actualUsedPct <= 85
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
        // Depleting-plan references ("expected by now") — shown as reference lines,
        // never baked into the actual expense/savings figures.
        plannedExpenseToDate,
        plannedSavingsToDate,
        dailyPlannedExpense,
        dailyPlannedSavings,
        // Raw actual transaction totals for the Money-movement section (match the chart).
        actualIncomeTotal,
        actualExpenseTotal,
        actualSavingsTotal,
        actualNet,
        // Full monthly baseline amounts (not prorated) — used for Money Health card
        baselineIncome,
        baselineExpense,
        baselineSavings,
        availableMoney,
        net,
        burnRate,
        budgeted,
        used,
        actualSpent,
        budgetRemaining,
        budgetStatusPct,
        budgetExpectedToDate,
        expectedProgressPct,
        budgetPaceDelta,
        dailyPlannedExpenseAmount: round2(baselineExpense / dailyRate),
        dayOfPeriod: daysElapsedInPeriod,
        daysInPeriodCount: daysInPeriod,
        surplusForExtras,
        extraSurplusRemaining,
        budgetWarning,
        budgetByCategory,
        topSpendCategory,
        movementSeries,
        plannedMovementSeries,
        // Month-anchored Money-health figures (budget income merged with
        // recorded income, plus extras) — independent of the chart window.
        healthIncome,
        healthRegularIncome,
        healthExtraIncome,
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
        // Month picker: every month from the earliest activity (first
        // transaction, or signup) up to the current month, newest first — so a
        // user can inspect any past month whether or not it has a budget period.
        userMonths: (() => {
          const firstActivity = earliestTxn?.occurredAt ?? new Date(user.createdAt);
          const startParts = getZonedParts(firstActivity < new Date(user.createdAt) ? firstActivity : new Date(user.createdAt), timeZone);
          const months: Array<{ key: string; label: string }> = [];
          let y = nowParts.year;
          let m = nowParts.month;
          // Walk backwards to the first-activity month (cap at 60 months).
          for (let i = 0; i < 60; i += 1) {
            const anchor = zonedMidnightUtc(y, m, 1, timeZone);
            months.push({
              key: `${y}-${pad2(m)}`,
              label: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone }).format(anchor),
            });
            if (y === startParts.year && m === startParts.month) break;
            m -= 1;
            if (m === 0) { m = 12; y -= 1; }
          }
          return months;
        })(),
        activeMonth: options?.month ?? null,
      };
    }, 3),
  );
}
