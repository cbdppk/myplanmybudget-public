import { prisma } from "@/lib/prisma";
import { getBudgetImpactSnapshot } from "@/lib/data/budgets";
import { getMonthlyMoneyOverview } from "@/lib/data/money-overview";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber } from "@/lib/data/utils";
import { getDisplayCurrencyContext } from "@/lib/data/currency";
import { logAudit } from "@/lib/data/audit";
import { ensureDefaultAccount, getAccountsWithBalances } from "@/lib/data/accounts";
import {
  actualExpenseWhere,
  actualSavingsWhere,
  computePeriodActuals,
  periodSurplus,
  plannedExpenseWhere,
} from "@/lib/data/txn-filters";
import { applyGoalEffect } from "@/lib/data/goal-ledger";
import { materializeDueRecurringRules, nextRunAfter } from "@/lib/data/recurring";
import { dayBoundsInTz, parseDateInputInTz, safeTimeZone } from "@/lib/dates";
import { Prisma } from "@prisma/client";
import { extraExpenseAvailable, round2 } from "@/lib/finance/math";
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
  accountId?: string;
  occurredAt?: string;
  recurring?: boolean;
  pending?: boolean;
}) {
  const user = await getActiveUser();
  const timeZone = safeTimeZone(user.timezone);
  const transactionKind = params.kind ?? "EXTRA";
  const txnType = params.type ?? "EXPENSE";
  const storedType = txnType === "INCOME" ? "INCOME" : "EXPENSE";
  const categoryKind = txnType === "SAVINGS" ? "savings" : "expense";
  const resolvedExtraType =
    params.extraType ??
    (txnType === "INCOME" ? "EXTRA_INCOME" : txnType === "SAVINGS" ? "EXTRA_SAVINGS" : "EXTRA_EXPENSE");
  const normalizedCategory = params.category ? normalizeCategoryName(params.category) : "";
  const categoryId =
    txnType !== "INCOME" && normalizedCategory
      ? await resolveCategoryId({
          userId: user.id,
          category: normalizedCategory,
          kind: categoryKind,
        })
      : null;

  // Every transaction lands in an account so the ledger reconciles against a
  // real balance; unspecified rows go to the user's default (oldest) account.
  let accountId: string | null = null;
  if (params.accountId) {
    const owned = await prisma.financialAccount.findFirst({
      where: { id: params.accountId, userId: user.id },
      select: { id: true },
    });
    if (!owned) throw new Error("Account not found.");
    accountId = owned.id;
  } else {
    accountId = (await ensureDefaultAccount(user.id)).id;
  }

  const currency = user.baseCurrency || user.currency || null;
  const occurredAt = params.occurredAt ? parseDateInputInTz(params.occurredAt, timeZone) : new Date();
  const isExtraOutflow = transactionKind === "EXTRA" && storedType === "EXPENSE";
  const candidatePeriod = isExtraOutflow && user.blockExtrasWhenSurplusNegative
    ? await ensureCurrentBudgetPeriod(user.id)
    : null;
  const period = candidatePeriod && occurredAt >= candidatePeriod.startDate && occurredAt <= candidatePeriod.endDate
    ? candidatePeriod
    : null;

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    if (period) {
      const [actuals, extraExpenseAgg] = await Promise.all([
        computePeriodActuals(tx, user.id, period.startDate, period.endDate),
        tx.transaction.aggregate({
          where: {
            userId: user.id,
            type: "EXPENSE",
            kind: "EXTRA",
            OR: [{ extraType: "EXTRA_EXPENSE" }, { extraType: null }],
            occurredAt: { gte: period.startDate, lte: period.endDate },
          },
          _sum: { amount: true },
        }),
      ]);
      const liveBalance = periodSurplus({
        carryIn: toNumber(period.carryIn),
        baselineIncome: toNumber(user.baselineIncome),
        actuals,
      });
      const availableForExtraExpense = extraExpenseAvailable({
        carryIn: toNumber(period.carryIn),
        baselineIncome: toNumber(user.baselineIncome),
        baselineExpense: toNumber(user.baselineExpense),
        baselineSavings: toNumber(user.baselineSavings),
        actualIncome: actuals.actualIncome,
        extraIncome: actuals.extraIncome,
        extraExpense: toNumber(extraExpenseAgg._sum.amount),
      });
      const available = resolvedExtraType === "EXTRA_EXPENSE" ? availableForExtraExpense : liveBalance;
      if (round2(available - params.amount) < 0) {
        throw new Error(
          `This extra outflow would exceed your available balance by ${Math.abs(round2(available - params.amount)).toFixed(2)}.`
        );
      }
    }

    return tx.transaction.create({
      data: {
        userId: user.id,
        type: storedType,
        kind: transactionKind,
        extraType: transactionKind === "EXTRA" ? resolvedExtraType : null,
        amount: params.amount,
        currency,
        cleared: !params.pending,
        memo: params.memo ?? null,
        categoryId,
        accountId,
        occurredAt,
      },
      select: { id: true, type: true, extraType: true },
    });
  });

  // Savings logged against a goal-synced category move the goal forward too.
  await applyGoalEffect(user.id, {
    type: created.type,
    extraType: created.extraType,
    amount: params.amount,
    category: categoryId ? { name: normalizedCategory, kind: categoryKind } : null,
  }, 1);

  logAudit(user.id, "transaction_create", {
    transactionId: created.id,
    type: txnType,
    kind: transactionKind,
    amount: params.amount,
    memo: params.memo,
  });

  if (params.recurring) {
    // The rule's first run is the NEXT occurrence after this transaction —
    // the transaction just created covers the current one. Recurrence keeps
    // the day of month the user actually logged (capped at 28).
    const dayOfMonth = Math.min(28, Math.max(1, new Date(occurredAt).getUTCDate()));
    await prisma.recurringRule.create({
      data: {
        userId: user.id,
        name: params.memo || (txnType === "INCOME" ? "Recurring income" : txnType === "SAVINGS" ? "Recurring savings" : "Recurring expense"),
        amount: params.amount,
        type: storedType,
        categoryId,
        cadence: "monthly",
        dayOfMonth,
        nextRunAt: nextRunAfter({ cadence: "monthly", after: occurredAt, timeZone, dayOfMonth }),
      },
    });
  }

  return { ok: true, id: created.id };
}

function isSavingsShape(txn: { type: string; extraType: string | null; category: { kind: string } | null }) {
  return txn.type === "EXPENSE" && (txn.extraType === "EXTRA_SAVINGS" || txn.category?.kind === "savings");
}

export async function updateTransaction(params: {
  id: string;
  amount?: number;
  memo?: string;
  category?: string;
  occurredAt?: string;
  cleared?: boolean;
}) {
  const user = await getActiveUser();
  const timeZone = safeTimeZone(user.timezone);
  const existing = await prisma.transaction.findFirst({
    where: { id: params.id, userId: user.id },
    include: { category: { select: { name: true, kind: true } } },
  });
  if (!existing) throw new Error("Transaction not found.");
  if (existing.type === "TRANSFER") throw new Error("Transfers cannot be edited — delete and re-create instead.");

  const nextAmount = params.amount !== undefined ? round2(params.amount) : toNumber(existing.amount);
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) throw new Error("Amount must be greater than 0.");

  const categoryKind = isSavingsShape(existing) ? "savings" : "expense";
  let nextCategoryId = existing.categoryId;
  let nextCategoryName = existing.category?.name ?? null;
  if (params.category !== undefined && existing.type !== "INCOME") {
    const normalized = normalizeCategoryName(params.category);
    nextCategoryId = normalized
      ? await resolveCategoryId({ userId: user.id, category: normalized, kind: categoryKind })
      : null;
    nextCategoryName = normalized || null;
  }

  // Reverse the old row's goal contribution, apply the new one — goal progress
  // stays derived from the ledger through edits.
  await applyGoalEffect(user.id, {
    type: existing.type,
    extraType: existing.extraType,
    amount: toNumber(existing.amount),
    category: existing.category,
  }, -1);

  const updated = await prisma.transaction.update({
    where: { id: existing.id },
    data: {
      amount: nextAmount,
      memo: params.memo !== undefined ? (params.memo.trim() || null) : existing.memo,
      categoryId: nextCategoryId,
      occurredAt: params.occurredAt ? parseDateInputInTz(params.occurredAt, timeZone) : existing.occurredAt,
      cleared: params.cleared !== undefined ? params.cleared : existing.cleared,
    },
    select: { id: true, type: true, extraType: true },
  });

  await applyGoalEffect(user.id, {
    type: updated.type,
    extraType: updated.extraType,
    amount: nextAmount,
    category: nextCategoryName ? { name: nextCategoryName, kind: categoryKind } : null,
  }, 1);

  logAudit(user.id, "transaction_update", {
    transactionId: existing.id,
    before: { amount: toNumber(existing.amount), memo: existing.memo, category: existing.category?.name ?? null, occurredAt: existing.occurredAt },
    after: { amount: nextAmount, memo: params.memo ?? existing.memo, category: nextCategoryName, occurredAt: params.occurredAt ?? existing.occurredAt },
  });

  return { ok: true };
}

/**
 * Replace one expense with several categorized parts that sum to the same
 * amount — e.g. a supermarket receipt split across Food and Household. The
 * parts inherit date, account, currency, kind, and cleared state, so every
 * balance and budget figure is unchanged except the per-category attribution.
 */
export async function splitTransaction(params: {
  id: string;
  parts: Array<{ amount: number; category?: string; memo?: string }>;
}) {
  const user = await getActiveUser();
  const existing = await prisma.transaction.findFirst({
    where: { id: params.id, userId: user.id },
    include: { category: { select: { name: true, kind: true } } },
  });
  if (!existing) throw new Error("Transaction not found.");
  if (existing.type !== "EXPENSE") throw new Error("Only expenses can be split.");

  const parts = params.parts
    .map((part) => ({ ...part, amount: round2(part.amount) }))
    .filter((part) => Number.isFinite(part.amount) && part.amount > 0);
  if (parts.length < 2) throw new Error("A split needs at least two parts.");
  const total = round2(parts.reduce((sum, part) => sum + part.amount, 0));
  const originalAmount = round2(toNumber(existing.amount));
  if (Math.abs(total - originalAmount) > 0.01) {
    throw new Error(`Split parts must add up to ${originalAmount.toFixed(2)}.`);
  }

  const categoryKind = isSavingsShape(existing) ? "savings" : "expense";
  const resolvedParts: Array<{ amount: number; memo: string | null; categoryId: string | null; categoryName: string | null }> = [];
  for (const part of parts) {
    const normalized = part.category ? normalizeCategoryName(part.category) : "";
    const categoryId = normalized
      ? await resolveCategoryId({ userId: user.id, category: normalized, kind: categoryKind })
      : existing.categoryId;
    resolvedParts.push({
      amount: part.amount,
      memo: part.memo?.trim() || existing.memo,
      categoryId,
      categoryName: normalized || existing.category?.name || null,
    });
  }

  await applyGoalEffect(user.id, {
    type: existing.type,
    extraType: existing.extraType,
    amount: originalAmount,
    category: existing.category,
  }, -1);

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id: existing.id } }),
    prisma.transaction.createMany({
      data: resolvedParts.map((part) => ({
        userId: user.id,
        type: existing.type,
        kind: existing.kind,
        extraType: existing.extraType,
        amount: part.amount,
        currency: existing.currency,
        cleared: existing.cleared,
        memo: part.memo,
        categoryId: part.categoryId,
        accountId: existing.accountId,
        occurredAt: existing.occurredAt,
      })),
    }),
  ]);

  for (const part of resolvedParts) {
    await applyGoalEffect(user.id, {
      type: existing.type,
      extraType: existing.extraType,
      amount: part.amount,
      category: part.categoryName ? { name: part.categoryName, kind: categoryKind } : null,
    }, 1);
  }

  logAudit(user.id, "transaction_split", {
    transactionId: existing.id,
    originalAmount,
    parts: resolvedParts.map((part) => ({ amount: part.amount, category: part.categoryName })),
  });

  return { ok: true };
}

export async function deleteTransactionById(id: string) {
  const user = await getActiveUser();
  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    include: { category: { select: { name: true, kind: true } } },
  });
  if (!existing) throw new Error("Transaction not found.");

  await applyGoalEffect(user.id, {
    type: existing.type,
    extraType: existing.extraType,
    amount: toNumber(existing.amount),
    category: existing.category,
  }, -1);

  await prisma.transaction.delete({ where: { id: existing.id } });

  // Money records must leave a trail when they disappear.
  logAudit(user.id, "transaction_delete", {
    transactionId: existing.id,
    type: existing.type,
    kind: existing.kind,
    extraType: existing.extraType,
    amount: toNumber(existing.amount),
    memo: existing.memo,
    category: existing.category?.name ?? null,
    occurredAt: existing.occurredAt,
  });

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
    // Post any due recurring transactions before reading, so rent/salary rules
    // are part of every figure the page shows.
    await materializeDueRecurringRules(user.id);
    const period = await ensureCurrentBudgetPeriod(user.id);
    const timeZone = safeTimeZone(user.timezone);
    const { start: startOfToday, end: endOfToday } = dayBoundsInTz(timeZone);
    const periodStart = period.startDate;
    const periodEnd = period.endDate > endOfToday ? endOfToday : period.endDate;
    const dowToday = new Date(startOfToday.getTime() + 12 * 60 * 60 * 1000).getUTCDay();
    const startOfWeek = new Date(startOfToday.getTime() - dowToday * 24 * 60 * 60 * 1000);

    const [todayExpenseAgg, todaySavingsAgg, todayIncomeAgg, monthExpenseAgg, monthSavingsAgg, monthIncomeAgg, txns, categories, goals, impact, overview, fx, monthExtraAggs, todayExtraAggs, accounts] = await Promise.all([
      prisma.transaction.aggregate({
        where: actualExpenseWhere(user.id, startOfToday, endOfToday),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: actualSavingsWhere(user.id, startOfToday, endOfToday),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "INCOME", occurredAt: { gte: startOfToday, lte: endOfToday } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: plannedExpenseWhere(user.id, periodStart, periodEnd),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: actualSavingsWhere(user.id, periodStart, periodEnd),
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "INCOME", occurredAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        include: {
          category: { select: { name: true, kind: true } },
          fromAccount: { select: { name: true } },
          toAccount: { select: { name: true } },
        },
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
          type: { in: ["INCOME", "EXPENSE"] },
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["extraType"],
        where: {
          userId: user.id,
          kind: "EXTRA",
          type: { in: ["INCOME", "EXPENSE"] },
          occurredAt: { gte: startOfToday, lte: endOfToday },
        },
        _sum: { amount: true },
      }),
      getAccountsWithBalances(user.id),
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

    // Surplus is the money left after the plan is funded — it's what off-budget
    // EXTRA_EXPENSE draws from. available-for-extras = income (regular + extra)
    // and carry-in, minus the full planned outflow (expense + savings budget).
    const activeBaselineIncome = overview.periodActive ? overview.baselineIncome : 0;
    const activeBaselineExpense = overview.periodActive ? overview.baselineExpense : 0;
    const activeBaselineSavings = overview.periodActive ? overview.baselineSavings : 0;
    const surplusBeforeExtras = extraExpenseAvailable({
      carryIn: overview.carryIn,
      baselineIncome: activeBaselineIncome,
      baselineExpense: activeBaselineExpense,
      baselineSavings: activeBaselineSavings,
      actualIncome: overview.actualIncome,
      extraIncome: overview.extraIncome,
      extraExpense: 0,
    });
    // How much of that surplus the off-budget extra spend has consumed, and what
    // is left. When extra spend exceeds the surplus the user is "over their extra
    // money" — exactly what should be warned about and not silently allowed.
    const extraSurplusRemaining = extraExpenseAvailable({
      carryIn: overview.carryIn,
      baselineIncome: activeBaselineIncome,
      baselineExpense: activeBaselineExpense,
      baselineSavings: activeBaselineSavings,
      actualIncome: overview.actualIncome,
      extraIncome: overview.extraIncome,
      extraExpense: monthExtraExpense,
    });
    const overExtraSurplus = extraSurplusRemaining < 0;

  let impactHeadline = "You're within plan.";
  let impactTone: "good" | "warn" | "bad" = "good";
  if (overview.surplusRaw < 0) {
    impactHeadline = `Your live balance is ${Math.abs(overview.surplusRaw).toFixed(2)} below zero.`;
    impactTone = "bad";
  } else if (overExtraSurplus) {
    impactHeadline = `Extra spending is ${Math.abs(extraSurplusRemaining).toFixed(2)} over your available surplus — it's now eating into your plan.`;
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
      // Surplus pool that off-budget extra spending draws from, and how much is
      // left. overExtraSurplus = true once extra spend has eaten past it.
      surplusForExtras: surplusBeforeExtras,
      extraSurplusRemaining,
      overExtraSurplus,
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
    accounts: accounts.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance,
      clearedBalance: account.clearedBalance,
      isDefault: account.isDefault,
      isLiability: account.isLiability,
    })),
    netWorth: accounts.netWorth,
    clearedNetWorth: accounts.clearedNetWorth,
    assetsTotal: accounts.assetsTotal,
    liabilitiesTotal: accounts.liabilitiesTotal,
    transactions: txns.map((txn) => {
      const type: "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER" =
        txn.type === "EXPENSE" && (txn.extraType === "EXTRA_SAVINGS" || txn.category?.kind === "savings") ? "SAVINGS" : txn.type;
      return {
        id: txn.id,
        memo: txn.memo,
        type,
        amount: toNumber(txn.amount),
        occurredAt: txn.occurredAt,
        cleared: txn.cleared,
        category:
          txn.type === "TRANSFER"
            ? [txn.fromAccount?.name, txn.toAccount?.name].filter(Boolean).join(" → ") || null
            : txn.category?.name ?? null,
      };
    }),
    };
  });
}

export async function getTransactionsForExport(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    include: {
      category: { select: { name: true } },
      account: { select: { name: true } },
      fromAccount: { select: { name: true } },
      toAccount: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}
