import { prisma } from "@/lib/prisma";
import { getMonthlyMoneyOverview } from "@/lib/data/money-overview";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber } from "@/lib/data/utils";
import { fromMonthly, normalizeToMonthly, type MoneyCadence } from "@/lib/money/frequency";
import { getDisplayCurrencyContext } from "@/lib/data/currency";
import { logAudit } from "@/lib/data/audit";
import { getPeriodDayMetrics, round2 } from "@/lib/finance/math";
import { withPerfTiming } from "@/lib/observability/perf";
import { Prisma } from "@prisma/client";

const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Rent",
  "Transport",
  "Utilities",
  "Health",
  "Education",
  "Entertainment",
  "Shopping",
  "Insurance",
  "Family",
];

const DEFAULT_SAVINGS_CATEGORIES = [
  "Emergency Fund",
  "Investments",
  "Retirement",
  "Vacation Fund",
  "Education Fund",
  "Personal savings",
];
const HIDDEN_CATEGORY_NAMES = new Set(["misc", "savings", "planned item"]);

const SAVINGS_NAME_HINTS = ["savings", "saving", "fund", "retirement", "investment", "vacation"];

function normalizedKind(kind: string, name: string) {
  const lower = name.trim().toLowerCase();
  if (kind === "savings") return "savings";
  if (SAVINGS_NAME_HINTS.some((hint) => lower.includes(hint))) return "savings";
  return "expense";
}

async function ensureBudgetCategories(userId: string) {
  const existing = await prisma.category.findMany({
    where: { userId, kind: { in: ["expense", "savings"] } },
    select: { name: true, kind: true },
  });

  const existingSet = new Set(existing.map((item) => `${item.kind}:${item.name.toLowerCase()}`));
  const toCreate: Array<{ userId: string; name: string; kind: string }> = [];

  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    const key = `expense:${name.toLowerCase()}`;
    if (!existingSet.has(key)) toCreate.push({ userId, name, kind: "expense" });
  }
  for (const name of DEFAULT_SAVINGS_CATEGORIES) {
    const key = `savings:${name.toLowerCase()}`;
    if (!existingSet.has(key)) toCreate.push({ userId, name, kind: "savings" });
  }

  if (toCreate.length > 0) {
    await prisma.category.createMany({ data: toCreate });
  }
}

export async function getBudgetPlannerData() {
  return withPerfTiming("budget_planner_data", {}, async () => {
    const user = await getActiveUser();
    await ensureBudgetCategories(user.id);
    const period = await ensureCurrentBudgetPeriod(user.id);
    const now = new Date();
    const { totalDays: daysInMonth, elapsedDays: dayOfMonth, effectiveNow } = getPeriodDayMetrics(period.startDate, period.endDate, now);

  const [categories, targets, monthIncomeAgg, monthExpenseOnlyAgg, monthSavingsAgg, overview, fx] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id, kind: { in: ["expense", "savings"] } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.budgetTarget.findMany({
      where: { userId: user.id, periodId: period.id },
      select: { categoryId: true, amount: true, cadence: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "INCOME", occurredAt: { gte: period.startDate, lte: effectiveNow } },
      _sum: { amount: true },
    }),
    // Pure expenses — savings-type transactions excluded to avoid double-counting
    prisma.transaction.aggregate({
      where: {
        userId: user.id,
        type: "EXPENSE",
        NOT: { extraType: "EXTRA_SAVINGS" },
        occurredAt: { gte: period.startDate, lte: effectiveNow },
      },
      _sum: { amount: true },
    }),
    // Savings contributions logged this period
    prisma.transaction.aggregate({
      where: {
        userId: user.id,
        type: "EXPENSE",
        extraType: "EXTRA_SAVINGS",
        occurredAt: { gte: period.startDate, lte: effectiveNow },
      },
      _sum: { amount: true },
    }),
    getMonthlyMoneyOverview(user.id, { period }),
    getDisplayCurrencyContext(user),
  ]);

  const targetMap = new Map(targets.map((item) => [item.categoryId, { amount: toNumber(item.amount), cadence: (item.cadence as MoneyCadence) ?? "MONTHLY" }]));
  const expenseCategories = categories.filter(
    (item) => normalizedKind(item.kind, item.name) === "expense" && !HIDDEN_CATEGORY_NAMES.has(item.name.trim().toLowerCase())
  );
  const savingsCategories = categories.filter(
    (item) => normalizedKind(item.kind, item.name) === "savings" && !HIDDEN_CATEGORY_NAMES.has(item.name.trim().toLowerCase())
  );
  const expenseTargetTotal = expenseCategories.reduce((sum, item) => sum + (targetMap.get(item.id)?.amount ?? 0), 0);
  const savingsTargetTotal = savingsCategories.reduce((sum, item) => sum + (targetMap.get(item.id)?.amount ?? 0), 0);
  const baselineIncome = toNumber(user.baselineIncome);
  const baselineExpense = Math.max(toNumber(user.baselineExpense), expenseTargetTotal);
  const baselineSavings = Math.max(toNumber(user.baselineSavings), savingsTargetTotal);
  const manualDailyEstimate = toNumber(user.dailySpendEstimate);
  const guideCategories = new Set(["food", "transport", "utilities"]);
  const guideCategoryMonthly = expenseCategories.reduce((sum, item) => {
    if (!guideCategories.has(item.name.trim().toLowerCase())) return sum;
    return sum + (targetMap.get(item.id)?.amount ?? 0);
  }, 0);
  const derivedDailySpendEstimate = round2((guideCategoryMonthly > 0 ? guideCategoryMonthly : baselineExpense) / Math.max(1, daysInMonth));
  const dailySpendEstimate = manualDailyEstimate > 0 ? manualDailyEstimate : derivedDailySpendEstimate;
  const actualIncome = toNumber(monthIncomeAgg._sum.amount);
  const actualExpenseOnly = toNumber(monthExpenseOnlyAgg._sum.amount);
  const actualSavings = toNumber(monthSavingsAgg._sum.amount);
  const actualExpense = round2(actualExpenseOnly + actualSavings); // total outflow for projection calcs
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
  const expectedExpenseToDate = round2((baselineExpense * dayOfMonth) / Math.max(1, daysInMonth));
  const expenseDrift = round2(actualExpenseOnly - expectedExpenseToDate);
  const projectedExpenseAtMonthEnd = dayOfMonth > 0 ? round2((actualExpenseOnly / dayOfMonth) * daysInMonth) : 0;
  const projectedDrift = round2(projectedExpenseAtMonthEnd - baselineExpense);
  const plannedRemaining = round2(baselineExpense - actualExpenseOnly);
  const guidance: string[] = [];
  if (expenseDrift > 0.01) guidance.push(`Spending is ${expenseDrift.toFixed(2)} above your expected pace so far. Consider slowing down this week.`);
  if (projectedDrift > 0.01) guidance.push(`At this pace you may overshoot your budget by ${projectedDrift.toFixed(2)} by month end.`);
  if (guidance.length === 0) guidance.push("You are within your spending pace. Keep logging transactions to stay accurate.");

    return {
      user,
      currency: { preferred: fx.preferredCurrency, rate: fx.fxRate },
      period,
      baseline: {
        monthIncome: baselineIncome,
        monthExpense: baselineExpense,
        monthSavings: baselineSavings,
        dailySpendEstimate,
        daysInMonth,
        dayOfMonth,
      },
      actual: {
        monthIncome: actualIncome,
        monthExpenseOnly: actualExpenseOnly,
        monthSavings: actualSavings,
        monthExpense: actualExpense,
        expectedExpenseToDate,
        expenseDrift,
        projectedExpenseAtMonthEnd,
        projectedDrift,
        plannedRemaining,
      },
      daysRemaining,
      guidance,
      extrasSummary: {
        extraIncome: overview.extraIncome,
        extraExpense: overview.extraExpense,
        extraSavings: overview.extraSavings,
      },
      items: categories
        .filter((category) => !HIDDEN_CATEGORY_NAMES.has(category.name.trim().toLowerCase()))
        .map((category) => ({
          categoryId: category.id,
          name: category.name,
          kind: normalizedKind(category.kind, category.name),
          cadence: targetMap.get(category.id)?.cadence ?? "MONTHLY",
          amount: targetMap.get(category.id)?.amount ?? 0,
          enteredAmount: fromMonthly(targetMap.get(category.id)?.amount ?? 0, targetMap.get(category.id)?.cadence ?? "MONTHLY", daysInMonth),
          monthlyEquivalent: targetMap.get(category.id)?.amount ?? 0,
        })),
    };
  });
}

export async function getBudgetImpactSnapshot(userId: string) {
  const period = await ensureCurrentBudgetPeriod(userId);
  const now = new Date();
  const { totalDays: daysInMonth, elapsedDays: dayOfMonth, effectiveNow } = getPeriodDayMetrics(period.startDate, period.endDate, now);
  const expenseWhere = {
    userId,
    type: "EXPENSE" as const,
    occurredAt: { gte: period.startDate, lte: effectiveNow },
    OR: [
      { extraType: "EXTRA_EXPENSE" as const },
      { extraType: null, category: { is: null } },
      { extraType: null, category: { is: { kind: "expense" } } },
    ],
  } satisfies Prisma.TransactionWhereInput;
  const savingsWhere = {
    userId,
    type: "EXPENSE" as const,
    occurredAt: { gte: period.startDate, lte: effectiveNow },
    OR: [
      { extraType: "EXTRA_SAVINGS" as const },
      { extraType: null, category: { is: { kind: "savings" } } },
    ],
  } satisfies Prisma.TransactionWhereInput;

  const [user, monthExpenseAgg, monthSavingsAgg, monthIncomeAgg, targets, categories] = await Promise.all([
    prisma.userProfile.findUniqueOrThrow({ where: { id: userId } }),
    prisma.transaction.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: savingsWhere,
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: "INCOME", occurredAt: { gte: period.startDate, lte: effectiveNow } },
      _sum: { amount: true },
    }),
    prisma.budgetTarget.findMany({ where: { userId, periodId: period.id }, select: { categoryId: true, amount: true } }),
    prisma.category.findMany({ where: { userId, kind: "expense" }, select: { id: true, name: true } }),
  ]);

  const expenseTargetTotal = targets.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const plannedExpense = Math.max(toNumber(user.baselineExpense), expenseTargetTotal);
  const plannedIncome = Math.max(toNumber(user.baselineIncome), toNumber(monthIncomeAgg._sum.amount));
  const plannedSavings = toNumber(user.baselineSavings);
  const actualExpense = toNumber(monthExpenseAgg._sum.amount);
  const actualSavings = toNumber(monthSavingsAgg._sum.amount);
  const actualIncome = toNumber(monthIncomeAgg._sum.amount);
  const expectedExpenseToDate = round2((plannedExpense * dayOfMonth) / Math.max(1, daysInMonth));
  const drift = round2(actualExpense - expectedExpenseToDate);
  const projectedExpense = dayOfMonth > 0 ? round2((actualExpense / dayOfMonth) * daysInMonth) : 0;
  const projectedExcess = round2(projectedExpense - plannedExpense);
  const remainingThisPeriod = round2(plannedExpense - actualExpense);
  const progressPct = plannedExpense > 0 ? Math.min(100, Math.max(0, (actualExpense / plannedExpense) * 100)) : 0;
  const expectedProgressPct = round2((dayOfMonth / Math.max(1, daysInMonth)) * 100);

  const guideCategoryIds = new Set(
    categories.filter((item) => ["food", "transport", "utilities"].includes(item.name.trim().toLowerCase())).map((item) => item.id)
  );
  const guideMonthly = targets.reduce((sum, item) => (guideCategoryIds.has(item.categoryId) ? sum + toNumber(item.amount) : sum), 0);
  const dailySpendEstimate = toNumber(user.dailySpendEstimate) > 0 ? toNumber(user.dailySpendEstimate) : round2((guideMonthly > 0 ? guideMonthly : plannedExpense) / Math.max(1, daysInMonth));

  return {
    periodName: period.name,
    plannedExpense,
    plannedIncome,
    plannedSavings,
    actualExpense,
    actualSavings,
    actualIncome,
    expectedExpenseToDate,
    drift,
    projectedExpense,
    projectedExcess,
    remainingThisPeriod,
    progressPct,
    expectedProgressPct,
    daysInMonth,
    dayOfMonth,
    dailySpendEstimate,
  };
}

export async function saveBudgetTargets(items: Array<{ categoryId: string; amount: number; cadence?: MoneyCadence }>) {
  const user = await getActiveUser();
  const period = await ensureCurrentBudgetPeriod(user.id);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const latestByCategory = new Map<string, { amount: number; cadence: MoneyCadence }>();
  for (const item of items) {
    const cadence = item.cadence ?? "MONTHLY";
    latestByCategory.set(item.categoryId, {
      amount: normalizeToMonthly(Math.max(0, round2(item.amount)), cadence, daysInMonth),
      cadence,
    });
  }

  const operations = Array.from(latestByCategory.entries()).map(([categoryId, item]) => {
    const amount = item.amount;
    if (amount <= 0) {
      return prisma.budgetTarget.deleteMany({
        where: { userId: user.id, periodId: period.id, categoryId },
      });
    }
    return prisma.budgetTarget.upsert({
      where: {
        userId_periodId_categoryId: {
          userId: user.id,
          periodId: period.id,
          categoryId,
        },
      },
      update: { amount, cadence: item.cadence },
      create: {
        userId: user.id,
        periodId: period.id,
        categoryId,
        amount,
        cadence: item.cadence,
      },
    });
  });

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  logAudit(user.id, "budget_targets_save", { count: operations.length });
  return { ok: true };
}

export async function createBudgetCategory(params: { name: string; kind: "expense" | "savings" }) {
  const user = await getActiveUser();
  const exists = await prisma.category.findFirst({
    where: { userId: user.id, name: params.name, kind: params.kind },
    select: { id: true },
  });
  if (!exists) {
    await prisma.category.create({
      data: {
        userId: user.id,
        name: params.name,
        kind: params.kind,
      },
    });
  }
  return { ok: true };
}

export type BudgetEditCategoryInput = {
  id?: string;
  name: string;
  kind: "expense" | "savings";
  amount: number;
  cadence: MoneyCadence;
};

export async function getBudgetEditData() {
  const user = await getActiveUser();
  await ensureBudgetCategories(user.id);
  const period = await ensureCurrentBudgetPeriod(user.id);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const [categories, targets, fx] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id, kind: { in: ["expense", "savings"] } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.budgetTarget.findMany({
      where: { userId: user.id, periodId: period.id },
      select: { categoryId: true, amount: true, cadence: true },
    }),
    getDisplayCurrencyContext(user),
  ]);

  const targetMap = new Map(targets.map((item) => [item.categoryId, { amount: toNumber(item.amount), cadence: (item.cadence as MoneyCadence) ?? "MONTHLY" }]));
  const baselineIncomeMonthly = toNumber(user.baselineIncome);
  const baselineExpenseMonthly = toNumber(user.baselineExpense);
  const baselineSavingsMonthly = toNumber(user.baselineSavings);
  const incomeFrequency = (user.incomeFrequency as MoneyCadence) ?? "MONTHLY";
  const budgetStartMode: "CURRENT_MONTH" | "NEXT_MONTH" = user.budgetStartMode === "NEXT_MONTH" ? "NEXT_MONTH" : "CURRENT_MONTH";

  const rows = categories
    .filter((category) => category.name.trim().toLowerCase() !== "misc")
    .map((category) => {
      const cadence = targetMap.get(category.id)?.cadence ?? "MONTHLY";
      const monthlyEquivalent = targetMap.get(category.id)?.amount ?? 0;
      return {
        id: category.id,
        name: category.name,
        kind: normalizedKind(category.kind, category.name),
        cadence,
        enteredAmount: fromMonthly(monthlyEquivalent, cadence, daysInMonth),
        monthlyEquivalent,
      };
    });

  return {
    periodName: period.name,
    daysInMonth,
    currency: fx.preferredCurrency,
    fxRate: fx.fxRate,
    baselineIncomeMonthly,
    baselineExpenseMonthly,
    baselineSavingsMonthly,
    incomeFrequency,
    incomeEntered: fromMonthly(baselineIncomeMonthly, incomeFrequency, daysInMonth),
    budgetStartMode,
    categories: rows,
  };
}

export async function saveBudgetEditFlow(input: {
  preferredCurrency: string;
  incomeFrequency: MoneyCadence;
  budgetStartMode: "CURRENT_MONTH" | "NEXT_MONTH";
  incomeAmount: number;
  monthlyExpense: number;
  monthlySavings: number;
  categories: BudgetEditCategoryInput[];
}) {
  const user = await getActiveUser();
  const period = await ensureCurrentBudgetPeriod(user.id);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const incomeFrequency = input.incomeFrequency ?? "MONTHLY";
  const baselineIncome = normalizeToMonthly(Math.max(0, round2(input.incomeAmount)), incomeFrequency, daysInMonth);
  const baselineExpense = Math.max(0, round2(input.monthlyExpense));
  const baselineSavings = Math.max(0, round2(input.monthlySavings));
  const monthStartDay = Math.min(28, Math.max(1, now.getDate()));
  const preferredCurrency = input.preferredCurrency.trim().toUpperCase();

  const normalizedRows = input.categories
    .map((item) => ({
      id: item.id,
      name: item.name.trim(),
      kind: item.kind,
      cadence: item.cadence ?? "MONTHLY",
      enteredAmount: Math.max(0, round2(item.amount)),
    }))
    .filter((item) => item.name.length > 0);

  const finalByCategory = new Map<string, { amount: number; cadence: MoneyCadence; kind: "expense" | "savings" }>();

  for (const row of normalizedRows) {
    let categoryId = row.id;
    if (categoryId) {
      const existingById = await prisma.category.findFirst({
        where: { id: categoryId, userId: user.id },
        select: { id: true, kind: true },
      });
      if (!existingById) {
        categoryId = undefined;
      } else if (normalizedKind(existingById.kind, row.name) !== row.kind) {
        throw new Error(`Category kind mismatch for "${row.name}".`);
      }
    }

    if (!categoryId) {
      const existingByName = await prisma.category.findFirst({
        where: { userId: user.id, name: { equals: row.name, mode: "insensitive" } },
        select: { id: true, kind: true, name: true },
      });
      if (existingByName) {
        const existingKind = normalizedKind(existingByName.kind, existingByName.name);
        if (existingKind !== row.kind) {
          throw new Error(`Category "${existingByName.name}" already exists as ${existingKind}.`);
        }
        categoryId = existingByName.id;
      } else {
        const created = await prisma.category.create({
          data: { userId: user.id, name: row.name, kind: row.kind },
          select: { id: true },
        });
        categoryId = created.id;
      }
    }

    finalByCategory.set(categoryId, {
      amount: normalizeToMonthly(row.enteredAmount, row.cadence, daysInMonth),
      cadence: row.cadence,
      kind: row.kind,
    });
  }

  let expenseAllocated = 0;
  let savingsAllocated = 0;
  for (const item of finalByCategory.values()) {
    if (item.kind === "savings") savingsAllocated += item.amount;
    else expenseAllocated += item.amount;
  }
  expenseAllocated = round2(expenseAllocated);
  savingsAllocated = round2(savingsAllocated);

  if (expenseAllocated > baselineExpense + 0.01) {
    throw new Error("Expense allocations cannot exceed monthly expense.");
  }
  if (savingsAllocated > baselineSavings + 0.01) {
    throw new Error("Savings allocations cannot exceed monthly savings.");
  }

  const existingTargets = await prisma.budgetTarget.findMany({
    where: { userId: user.id, periodId: period.id },
    select: { categoryId: true },
  });

  const keepCategoryIds = new Set<string>();
  const targetOps: Array<ReturnType<typeof prisma.budgetTarget.upsert> | ReturnType<typeof prisma.budgetTarget.deleteMany>> = [];

  for (const [categoryId, item] of finalByCategory.entries()) {
    if (item.amount <= 0) continue;
    keepCategoryIds.add(categoryId);
    targetOps.push(
      prisma.budgetTarget.upsert({
        where: {
          userId_periodId_categoryId: {
            userId: user.id,
            periodId: period.id,
            categoryId,
          },
        },
        update: { amount: item.amount, cadence: item.cadence },
        create: {
          userId: user.id,
          periodId: period.id,
          categoryId,
          amount: item.amount,
          cadence: item.cadence,
        },
      })
    );
  }

  for (const target of existingTargets) {
    if (keepCategoryIds.has(target.categoryId)) continue;
    targetOps.push(prisma.budgetTarget.deleteMany({ where: { userId: user.id, periodId: period.id, categoryId: target.categoryId } }));
  }

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { id: user.id },
      data: {
        preferredCurrency,
        currency: preferredCurrency,
        incomeFrequency,
        monthStartDay,
        budgetStartMode: input.budgetStartMode,
        baselineIncome,
        baselineExpense,
        baselineSavings,
      },
    }),
    ...targetOps,
  ]);

  logAudit(user.id, "budget_edit_save", { baselineIncome, baselineExpense, baselineSavings, preferredCurrency });
  return {
    ok: true,
    baseline: { income: baselineIncome, expense: baselineExpense, savings: baselineSavings },
    allocated: { expense: expenseAllocated, savings: savingsAllocated },
  };
}
