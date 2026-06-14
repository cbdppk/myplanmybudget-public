import { prisma } from "@/lib/prisma";
import { getBudgetImpactSnapshot } from "@/lib/data/budgets";
import { getMonthlyMoneyOverview } from "@/lib/data/money-overview";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber } from "@/lib/data/utils";
import { getDisplayCurrencyContext } from "@/lib/data/currency";
import { logAudit } from "@/lib/data/audit";
import { Prisma } from "@prisma/client";
import { getPeriodDayMetrics, round2 } from "@/lib/finance/math";
import { withPerfTiming } from "@/lib/observability/perf";

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function resolveCategoryId(params: {
  userId: string;
  category: string;
  kind: string;
}) {
  const normalizedCategory = normalizeCategoryName(params.category);
  if (!normalizedCategory) return null;

  const existing = await prisma.category.findFirst({
    where: {
      userId: params.userId,
      name: { equals: normalizedCategory, mode: "insensitive" },
      kind: params.kind,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.category.create({
      data: {
        userId: params.userId,
        name: normalizedCategory,
        kind: params.kind,
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await prisma.category.findFirst({
        where: {
          userId: params.userId,
          name: { equals: normalizedCategory, mode: "insensitive" },
          kind: params.kind,
        },
        select: { id: true },
      });
      if (concurrent) return concurrent.id;
    }
    throw error;
  }
}

export async function createQuickTransaction(params: {
  kind?: "BASELINE" | "EXTRA";
  type?: "INCOME" | "EXPENSE" | "SAVINGS";
  extraType?: "EXTRA_INCOME" | "EXTRA_EXPENSE" | "EXTRA_SAVINGS";
  amount: number;
  memo?: string;
  category?: string;
  occurredAt?: string;
  recurring?: boolean;
}) {
  const user = await getActiveUser();
  const transactionKind = params.kind ?? "EXTRA";
  const txnType = params.type ?? "EXPENSE";
  const storedType = txnType === "INCOME" ? "INCOME" : "EXPENSE";
  const categoryKind = txnType === "SAVINGS" ? "savings" : "expense";
  const resolvedExtraType =
    params.extraType ??
    (txnType === "INCOME" ? "EXTRA_INCOME" : txnType === "SAVINGS" ? "EXTRA_SAVINGS" : "EXTRA_EXPENSE");
  const recurringCategoryId =
    txnType !== "INCOME" && params.category
      ? await resolveCategoryId({
          userId: user.id,
          category: params.category,
          kind: categoryKind,
        })
      : null;

  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: storedType,
      kind: transactionKind,
      extraType: transactionKind === "EXTRA" ? resolvedExtraType : null,
      amount: params.amount,
      memo: params.memo ?? null,
      categoryId: recurringCategoryId,
      occurredAt: params.occurredAt ? new Date(params.occurredAt) : undefined,
    },
  });

  logAudit(user.id, "transaction_create", { type: txnType, kind: transactionKind, amount: params.amount, memo: params.memo });

  if (params.recurring) {
    await prisma.recurringRule.create({
      data: {
        userId: user.id,
        name: params.memo || (txnType === "INCOME" ? "Recurring income" : txnType === "SAVINGS" ? "Recurring savings" : "Recurring expense"),
        amount: params.amount,
        type: storedType,
        categoryId: recurringCategoryId,
        cadence: "monthly",
        dayOfMonth: 1,
        nextRunAt: new Date(),
      },
    });
  }

  return { ok: true };
}

export async function createQuickExpense(params: {
  kind?: "BASELINE" | "EXTRA";
  amount: number;
  memo?: string;
  category?: string;
  occurredAt?: string;
  recurring?: boolean;
  type?: "INCOME" | "EXPENSE" | "SAVINGS";
  extraType?: "EXTRA_INCOME" | "EXTRA_EXPENSE" | "EXTRA_SAVINGS";
}) {
  return createQuickTransaction(params);
}

export async function getTrackData() {
  return withPerfTiming("track_page_data", {}, async () => {
    const user = await getActiveUser();
    const period = await ensureCurrentBudgetPeriod(user.id);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const periodStart = period.startDate;
    const periodEnd = period.endDate > endOfToday ? endOfToday : period.endDate;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const expenseWhere = (gte: Date, lte: Date) =>
      ({
        userId: user.id,
        type: "EXPENSE" as const,
        occurredAt: { gte, lte },
        OR: [
          { extraType: "EXTRA_EXPENSE" as const },
          { extraType: null, category: { is: null } },
          { extraType: null, category: { is: { kind: "expense" } } },
        ],
      }) satisfies Prisma.TransactionWhereInput;
    const savingsWhere = (gte: Date, lte: Date) =>
      ({
        userId: user.id,
        type: "EXPENSE" as const,
        occurredAt: { gte, lte },
        OR: [
          { extraType: "EXTRA_SAVINGS" as const },
          { extraType: null, category: { is: { kind: "savings" } } },
        ],
      }) satisfies Prisma.TransactionWhereInput;

    const [todayExpenseAgg, todaySavingsAgg, todayIncomeAgg, monthExpenseAgg, monthSavingsAgg, monthIncomeAgg, txns, categories, goals, impact, overview, fx, monthExtraAggs, todayExtraAggs] = await Promise.all([
      prisma.transaction.aggregate({
        where: expenseWhere(startOfToday, endOfToday),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: savingsWhere(startOfToday, endOfToday),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "INCOME", occurredAt: { gte: startOfToday, lte: endOfToday } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: expenseWhere(periodStart, periodEnd),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: savingsWhere(periodStart, periodEnd),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "INCOME", occurredAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id, type: { in: ["EXPENSE", "INCOME"] } },
        include: { category: { select: { name: true, kind: true } } },
        orderBy: { occurredAt: "desc" },
        take: 120,
      }),
      prisma.category.findMany({
        where: { userId: user.id, kind: { in: ["expense", "savings"] } },
        select: { name: true, kind: true },
        orderBy: { name: "asc" },
      }),
      prisma.goal.findMany({
        where: { userId: user.id },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
      getBudgetImpactSnapshot(user.id),
      getMonthlyMoneyOverview(user.id, { period }),
      getDisplayCurrencyContext(user),
      prisma.transaction.groupBy({
        by: ["extraType"],
        where: {
          userId: user.id,
          kind: "EXTRA",
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["extraType"],
        where: {
          userId: user.id,
          kind: "EXTRA",
          occurredAt: { gte: startOfToday, lte: endOfToday },
        },
        _sum: { amount: true },
      }),
    ]);

    const todayIn = toNumber(todayIncomeAgg._sum.amount);
    const todayExpense = toNumber(todayExpenseAgg._sum.amount);
    const todaySavings = toNumber(todaySavingsAgg._sum.amount);
    const todayOut = round2(todayExpense + todaySavings);
    const todayNet = round2(todayIn - todayOut);
    const monthIncome = toNumber(monthIncomeAgg._sum.amount);
    const monthExpense = toNumber(monthExpenseAgg._sum.amount);
    const monthSavings = toNumber(monthSavingsAgg._sum.amount);
    const periodRemaining = round2(impact.plannedExpense - monthExpense);
    const progressPct = impact.plannedExpense > 0 ? Math.min(100, Math.max(0, (monthExpense / impact.plannedExpense) * 100)) : 0;
    const monthExtraByType = new Map(monthExtraAggs.map((item) => [item.extraType ?? "EXTRA_EXPENSE", toNumber(item._sum.amount)]));
    const todayExtraByType = new Map(todayExtraAggs.map((item) => [item.extraType ?? "EXTRA_EXPENSE", toNumber(item._sum.amount)]));
    const monthExtraIncome = monthExtraByType.get("EXTRA_INCOME") ?? 0;
    const monthExtraExpense = monthExtraByType.get("EXTRA_EXPENSE") ?? 0;
    const monthExtraSavings = monthExtraByType.get("EXTRA_SAVINGS") ?? 0;
    const todayExtraIncome = todayExtraByType.get("EXTRA_INCOME") ?? 0;
    const todayExtraExpense = todayExtraByType.get("EXTRA_EXPENSE") ?? 0;
    const todayExtraSavings = todayExtraByType.get("EXTRA_SAVINGS") ?? 0;
    const expenseEstimateToday = round2(overview.dailyExpenseBudget);
    const savingsEstimateToday = round2(overview.dailySavingsBudget);
    const outflowEstimateToday = round2(expenseEstimateToday + savingsEstimateToday);
    const outflowToday = round2(todayOut);
    const savedToday = round2(todaySavings);
    const spentToday = round2(todayExpense);
    const guideRemainingExpenseToday = round2(expenseEstimateToday - spentToday);
    const guideRemainingSavingsToday = round2(savingsEstimateToday - savedToday);
    const guideRemainingOutflowToday = round2(outflowEstimateToday - outflowToday);

  let impactHeadline = "You're within plan.";
  let impactTone: "good" | "warn" | "bad" = "good";
  if (overview.surplusRaw < 0) {
    impactHeadline = `Your live balance is ${Math.abs(overview.surplusRaw).toFixed(2)} below zero.`;
    impactTone = "bad";
  } else if (impact.projectedExcess > 0.01) {
    impactHeadline = `You're ${impact.projectedExcess.toFixed(2)} above your likely month-end pace.`;
    impactTone = "bad";
  } else if (impact.drift > 0.01) {
    impactHeadline = `You're ${impact.drift.toFixed(2)} over plan pace.`;
    impactTone = impact.projectedExcess > 0.01 ? "bad" : "warn";
  }

  let impactProjection = "Current pace is aligned with plan.";
  if (overview.surplusRaw < 0) {
    impactProjection = "You can still log transactions, but the page is warning that current money on board is already negative.";
  } else if (impact.projectedExcess > 0.01) {
    impactProjection = `If you continue like this, you'll exceed plan by about ${impact.projectedExcess.toFixed(2)}.`;
  }

    return {
    user,
    currency: { preferred: fx.preferredCurrency, rate: fx.fxRate },
    today: {
      in: todayIn,
      out: todayOut,
      net: todayNet,
    },
    period: {
      name: impact.periodName,
      monthIncome,
      monthExpense,
      monthSavings,
      plannedIncome: impact.plannedIncome,
      plannedExpense: impact.plannedExpense,
      plannedSavings: impact.plannedSavings,
      remainingThisPeriod: periodRemaining,
      progressPct,
      expectedProgressPct: impact.expectedProgressPct,
      dayOfMonth: impact.dayOfMonth,
      daysInMonth: impact.daysInMonth,
    },
    dailyGuide: {
      expenseEstimate: expenseEstimateToday,
      savingsEstimate: savingsEstimateToday,
      outflowEstimate: outflowEstimateToday,
      spentToday,
      savedToday,
      outflowToday,
      remainingExpenseToday: guideRemainingExpenseToday,
      remainingSavingsToday: guideRemainingSavingsToday,
      remainingOutflowToday: guideRemainingOutflowToday,
      expectedExpenseToDate: round2(overview.baselineExpenseUsedToDate),
      expectedSavingsToDate: round2(overview.baselineSavingsUsedToDate),
    },
    extras: {
      liveBalance: round2(overview.surplusRaw),
      todayExtraIncome,
      todayExtraExpense,
      todayExtraSavings,
      extraIncomeMonth: monthExtraIncome,
      extraExpenseMonth: monthExtraExpense,
      extraSavingsMonth: monthExtraSavings,
      dailyBaselineUsed: round2(overview.dailyExpenseBudget + overview.dailySavingsBudget),
      budgetUsedPct: overview.budgetUsedPct,
    },
    impact: {
      headline: impactHeadline,
      detail: `By day ${impact.dayOfMonth}, expected expense pace is ${overview.baselineExpenseUsedToDate.toFixed(2)} and expected savings pace is ${overview.baselineSavingsUsedToDate.toFixed(2)}.`,
      projection: impactProjection,
      tone: impactTone,
    },
    filters: {
      bounds: {
        today: startOfToday,
        week: startOfWeek,
        month: periodStart,
      },
      categories: {
        expense: Array.from(new Set(categories.filter((item) => item.kind === "expense").map((item) => item.name))).filter(Boolean),
        savings: Array.from(new Set([...categories.filter((item) => item.kind === "savings").map((item) => item.name), ...goals.map((goal) => goal.name)])).filter(Boolean),
      },
    },
    transactions: txns.map((txn) => {
      const type: "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER" =
        txn.type === "EXPENSE" && (txn.extraType === "EXTRA_SAVINGS" || txn.category?.kind === "savings") ? "SAVINGS" : txn.type;
      return {
        id: txn.id,
        memo: txn.memo,
        type,
        amount: toNumber(txn.amount),
        occurredAt: txn.occurredAt,
        category: txn.category?.name ?? null,
      };
    }),
    };
  });
}

export async function getTransactionsForExport(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    include: { category: { select: { name: true } } },
    orderBy: { occurredAt: "desc" },
  });
}
