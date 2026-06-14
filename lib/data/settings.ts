import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber } from "@/lib/data/utils";
import { hasRecentReauth } from "@/lib/auth/session";
import { fromMonthly, normalizeToMonthly, type MoneyCadence } from "@/lib/money/frequency";
import { isExpectedVersionMatch, parseSettingsVersion } from "@/lib/data/settings-guards";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

const SAVINGS_NAME_HINTS = ["savings", "saving", "fund", "retirement", "investment", "vacation"];
const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Rent", "Transport", "Utilities", "Health", "Education"];
const DEFAULT_SAVINGS_CATEGORIES = ["Emergency Fund", "Investments", "Retirement", "Vacation Fund", "Personal savings"];
const HIDDEN_CATEGORY_NAMES = new Set(["misc", "savings", "planned item"]);

function normalizedKind(kind: string, name: string) {
  const lower = name.trim().toLowerCase();
  if (kind === "savings") return "savings";
  if (SAVINGS_NAME_HINTS.some((hint) => lower.includes(hint))) return "savings";
  return "expense";
}

async function logSettingsAudit(userId: string, action: string, meta: Record<string, unknown>) {
  await prisma.auditEvent.create({
    data: {
      userId,
      action,
      meta: meta as Prisma.InputJsonValue,
    },
  });
}

async function assertUserSettingsVersionInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  expectedUpdatedAt: Date | null
) {
  if (!expectedUpdatedAt) return;
  const profile = await tx.userProfile.findUnique({
    where: { id: userId },
    select: { updatedAt: true },
  });
  if (!profile || !isExpectedVersionMatch(profile.updatedAt, expectedUpdatedAt)) {
    throw new Error("Settings changed in another session. Refresh and try again.");
  }
}

async function ensureSettingsCategories(userId: string) {
  const existing = await prisma.category.findMany({
    where: { userId, kind: { in: ["expense", "savings"] } },
    select: { name: true, kind: true },
  });
  const existingSet = new Set(existing.map((item) => `${item.kind}:${item.name.toLowerCase()}`));
  const createData: Array<{ userId: string; name: string; kind: "expense" | "savings" }> = [];

  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    const key = `expense:${name.toLowerCase()}`;
    if (!existingSet.has(key)) createData.push({ userId, name, kind: "expense" });
  }
  for (const name of DEFAULT_SAVINGS_CATEGORIES) {
    const key = `savings:${name.toLowerCase()}`;
    if (!existingSet.has(key)) createData.push({ userId, name, kind: "savings" });
  }

  if (createData.length > 0) {
    await prisma.category.createMany({ data: createData });
  }
}

export async function getSettingsData() {
  const user = await getActiveUser();
  await ensureSettingsCategories(user.id);
  const period = await ensureCurrentBudgetPeriod(user.id);
  const [accounts, categories, targets] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true, balance: true },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    prisma.budgetTarget.findMany({
      where: { userId: user.id, periodId: period.id },
      select: { categoryId: true, amount: true, cadence: true },
    }),
  ]);

  const targetMap = new Map(targets.map((item) => [item.categoryId, { amount: toNumber(item.amount), cadence: (item.cadence as MoneyCadence) ?? "MONTHLY" }]));
  const visibleCategories = categories.filter((item) => {
    if (item.name.startsWith("Archived:")) return false;
    return !HIDDEN_CATEGORY_NAMES.has(item.name.trim().toLowerCase());
  });
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const budgetCategories = visibleCategories
    .filter((item) => item.kind === "expense" || item.kind === "savings")
    .map((item) => ({
      id: item.id,
      name: item.name,
      kind: normalizedKind(item.kind, item.name),
      amount: targetMap.get(item.id)?.amount ?? 0,
      cadence: targetMap.get(item.id)?.cadence ?? "MONTHLY",
      enteredAmount: fromMonthly(targetMap.get(item.id)?.amount ?? 0, targetMap.get(item.id)?.cadence ?? "MONTHLY", daysInMonth),
    }));

  return {
    user,
    accounts,
    categories: visibleCategories,
    budget: {
      periodName: period.name,
      baselineIncome: toNumber(user.baselineIncome),
      baselineExpense: toNumber(user.baselineExpense),
      baselineSavings: toNumber(user.baselineSavings),
      dailySpendEstimate: toNumber(user.dailySpendEstimate),
      categories: budgetCategories,
    },
  };
}

export async function updateProfile(params: { name: string; currency: string; expectedUpdatedAt?: string }) {
  const user = await getActiveUser();
  const expectedUpdatedAt = parseSettingsVersion(params.expectedUpdatedAt);
  const before = { name: user.name ?? null, currency: user.currency, preferredCurrency: user.preferredCurrency };
  const nextCurrency = params.currency.toUpperCase();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    await assertUserSettingsVersionInTx(tx as unknown as Prisma.TransactionClient, user.id, expectedUpdatedAt);
    await tx.userProfile.update({
      where: { id: user.id },
      data: { name: params.name, currency: nextCurrency },
    });
  });
  await logSettingsAudit(user.id, "settings.profile.updated", {
    before,
    after: { name: params.name, currency: nextCurrency },
  });
  return { ok: true };
}

export async function updateProfileDetails(params: { name: string; timezone: string; language: string; expectedUpdatedAt?: string }) {
  const user = await getActiveUser();
  const expectedUpdatedAt = parseSettingsVersion(params.expectedUpdatedAt);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    await assertUserSettingsVersionInTx(tx as unknown as Prisma.TransactionClient, user.id, expectedUpdatedAt);
    await tx.userProfile.update({
      where: { id: user.id },
      data: {
        name: params.name,
        timezone: params.timezone,
        language: params.language,
      },
    });
  });
  return { ok: true };
}

export async function updateSecurityPreferences(params: { notifyEmail: boolean }) {
  const user = await getActiveUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      notifyEmail: params.notifyEmail,
    },
  });
  return { ok: true };
}

export async function createAccount(params: { name: string; type: string; balance: number }) {
  const user = await getActiveUser();
  await prisma.financialAccount.create({
    data: {
      userId: user.id,
      name: params.name,
      type: params.type,
      balance: params.balance,
    },
  });
  return { ok: true };
}

export async function createCategory(params: { name: string; kind: string }) {
  const user = await getActiveUser();
  const normalized = params.name.trim();
  if (!normalized) {
    throw new Error("Category name is required.");
  }
  if (HIDDEN_CATEGORY_NAMES.has(normalized.toLowerCase())) {
    throw new Error("This category name is reserved. Choose a specific name.");
  }
  const existing = await prisma.category.findFirst({
    where: { userId: user.id, name: normalized },
    select: { id: true },
  });
  if (!existing) {
    const created = await prisma.category.create({
      data: { userId: user.id, name: normalized, kind: params.kind },
      select: { id: true, name: true, kind: true },
    });
    await logSettingsAudit(user.id, "settings.category.created", { name: normalized, kind: params.kind });
    return { category: created };
  }
  return { category: null };
}

export async function archiveCategory(categoryId: string) {
  const user = await getActiveUser();
  const existing = await prisma.category.findFirst({
    where: { id: categoryId, userId: user.id },
    select: { name: true, kind: true },
  });
  await prisma.category.updateMany({
    where: { id: categoryId, userId: user.id },
    data: { name: `Archived: ${Date.now()}` },
  });
  await logSettingsAudit(user.id, "settings.category.archived", { categoryId, existing });
  return { ok: true };
}

export async function deleteCategory(categoryId: string) {
  const user = await getActiveUser();
  const existing = await prisma.category.findFirst({
    where: { id: categoryId, userId: user.id },
    select: { name: true, kind: true },
  });
  await prisma.category.deleteMany({
    where: { id: categoryId, userId: user.id },
  });
  await logSettingsAudit(user.id, "settings.category.deleted", { categoryId, existing });
  return { ok: true };
}

export async function updateBudgetPreferences(params: {
  preferredCurrency: string;
  incomeFrequency: string;
  budgetStartMode: string;
  blockExtrasWhenSurplusNegative: boolean;
  showSimulationSuggestion: boolean;
  dailyEstimateAuto: boolean;
  dailySpendEstimate: number;
  expectedUpdatedAt?: string;
}) {
  const user = await getActiveUser();
  const expectedUpdatedAt = parseSettingsVersion(params.expectedUpdatedAt);
  const before = {
    preferredCurrency: user.preferredCurrency,
    currency: user.currency,
    incomeFrequency: user.incomeFrequency,
    budgetStartMode: user.budgetStartMode,
    monthStartDay: user.monthStartDay,
    blockExtrasWhenSurplusNegative: user.blockExtrasWhenSurplusNegative,
    showSimulationSuggestion: user.showSimulationSuggestion,
    dailyEstimateAuto: user.dailyEstimateAuto,
    dailySpendEstimate: toNumber(user.dailySpendEstimate),
  };
  const monthStartDay = Math.min(28, Math.max(1, new Date().getDate()));
  const dailySpendEstimate = Math.max(0, round2(params.dailySpendEstimate));
  const preferredCurrency = params.preferredCurrency.toUpperCase();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    await assertUserSettingsVersionInTx(tx as unknown as Prisma.TransactionClient, user.id, expectedUpdatedAt);
    return tx.userProfile.update({
      where: { id: user.id },
      data: {
        preferredCurrency,
        currency: preferredCurrency,
        incomeFrequency: params.incomeFrequency,
        budgetStartMode: params.budgetStartMode,
        monthStartDay,
        blockExtrasWhenSurplusNegative: params.blockExtrasWhenSurplusNegative,
        showSimulationSuggestion: params.showSimulationSuggestion,
        dailyEstimateAuto: params.dailyEstimateAuto,
        dailySpendEstimate,
      },
      select: { updatedAt: true },
    });
  });
  await logSettingsAudit(user.id, "settings.budgetPreferences.updated", {
    before,
    after: {
      preferredCurrency,
      currency: preferredCurrency,
      incomeFrequency: params.incomeFrequency,
      budgetStartMode: params.budgetStartMode,
      monthStartDay,
      blockExtrasWhenSurplusNegative: params.blockExtrasWhenSurplusNegative,
      showSimulationSuggestion: params.showSimulationSuggestion,
      dailyEstimateAuto: params.dailyEstimateAuto,
      dailySpendEstimate,
    },
  });
  return { ok: true, updatedAt: updated.updatedAt.toISOString() };
}

export async function updateGoalsSettings(params: { autoCreateGoalsFromSavings: boolean; goalFundingSource: string }) {
  const user = await getActiveUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      autoCreateGoalsFromSavings: params.autoCreateGoalsFromSavings,
      goalFundingSource: params.goalFundingSource,
    },
  });
  return { ok: true };
}

export async function updateNotificationSettings(params: {
  notifyDailyCheckIn: boolean;
  notifyWeeklySummary: boolean;
  notifyMonthEndReview: boolean;
  notifyGoalProgress: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyPush: boolean;
}) {
  const user = await getActiveUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      notifyDailyCheckIn: params.notifyDailyCheckIn,
      notifyWeeklySummary: params.notifyWeeklySummary,
      notifyMonthEndReview: params.notifyMonthEndReview,
      notifyGoalProgress: params.notifyGoalProgress,
      notifyInApp: params.notifyInApp,
      notifyEmail: params.notifyEmail,
      notifyPush: params.notifyPush,
    },
  });
  return { ok: true };
}

export async function updatePrivacySettings(params: { analyticsOptIn: boolean; tipsOptIn: boolean }) {
  const user = await getActiveUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      analyticsOptIn: params.analyticsOptIn,
      tipsOptIn: params.tipsOptIn,
    },
  });
  return { ok: true };
}

export async function updateAppearanceSettings(params: { themePreference: string }) {
  const user = await getActiveUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: { themePreference: params.themePreference },
  });
  return { ok: true };
}

export async function resetAllUserData() {
  const allowed = await hasRecentReauth();
  if (!allowed) throw new Error("Please re-authenticate in Security to continue.");
  const user = await getActiveUser();
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.recurringRule.deleteMany({ where: { userId: user.id } }),
    prisma.goal.deleteMany({ where: { userId: user.id } }),
    prisma.note.deleteMany({ where: { userId: user.id } }),
    prisma.reminder.deleteMany({ where: { userId: user.id } }),
    prisma.budgetTarget.deleteMany({ where: { userId: user.id } }),
    prisma.sandboxOverride.deleteMany({ where: { userId: user.id } }),
    prisma.sandbox.deleteMany({ where: { userId: user.id } }),
    prisma.financialAccount.deleteMany({ where: { userId: user.id } }),
  ]);
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      baselineIncome: 0,
      baselineExpense: 0,
      baselineSavings: 0,
      dailySpendEstimate: 0,
    },
  });
  return { ok: true };
}

export async function deactivateAccount() {
  const allowed = await hasRecentReauth();
  if (!allowed) throw new Error("Please re-authenticate in Security to continue.");
  const user = await getActiveUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: { isActive: false },
  });
  return { ok: true };
}

export async function updateBudgetPlan(params: {
  baselineIncome: number;
  baselineExpense: number;
  baselineSavings: number;
  dailySpendEstimate: number;
  expectedUpdatedAt?: string;
  items: Array<{ categoryId: string; amount: number; cadence: MoneyCadence }>;
}) {
  const user = await getActiveUser();
  const expectedUpdatedAt = parseSettingsVersion(params.expectedUpdatedAt);
  const period = await ensureCurrentBudgetPeriod(user.id);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const baselineIncome = Math.max(0, round2(params.baselineIncome));
  const baselineExpense = Math.max(0, round2(params.baselineExpense));
  const baselineSavings = Math.max(0, round2(params.baselineSavings));
  const dailySpendEstimate = Math.max(0, round2(params.dailySpendEstimate));

  const latestByCategory = new Map<string, { amount: number; cadence: MoneyCadence }>();
  for (const item of params.items) {
    const cadence = item.cadence ?? "MONTHLY";
    const monthlyAmount = normalizeToMonthly(Math.max(0, round2(item.amount)), cadence, daysInMonth);
    latestByCategory.set(item.categoryId, { amount: monthlyAmount, cadence });
  }

  const categoryIds = Array.from(latestByCategory.keys());
  const categories =
    categoryIds.length > 0
      ? await prisma.category.findMany({
          where: { userId: user.id, id: { in: categoryIds } },
          select: { id: true, name: true, kind: true },
        })
      : [];
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  let expenseAllocated = 0;
  let savingsAllocated = 0;
  for (const [categoryId, item] of latestByCategory.entries()) {
    const amount = item.amount;
    const category = categoryById.get(categoryId);
    if (!category) continue;
    const kind = normalizedKind(category.kind, category.name);
    if (kind === "savings") savingsAllocated += amount;
    else expenseAllocated += amount;
  }
  expenseAllocated = round2(expenseAllocated);
  savingsAllocated = round2(savingsAllocated);
  if (expenseAllocated > baselineExpense + 0.01) {
    throw new Error("Expense allocations cannot exceed baseline expenditure.");
  }
  if (savingsAllocated > baselineSavings + 0.01) {
    throw new Error("Savings allocations cannot exceed baseline savings.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    await assertUserSettingsVersionInTx(tx as unknown as Prisma.TransactionClient, user.id, expectedUpdatedAt);
    const next = await tx.userProfile.update({
      where: { id: user.id },
      data: {
        baselineIncome,
        baselineExpense,
        baselineSavings,
        dailySpendEstimate,
      },
      select: { updatedAt: true },
    });
    for (const [categoryId, item] of latestByCategory.entries()) {
      const amount = item.amount;
      if (amount <= 0) {
        await tx.budgetTarget.deleteMany({
          where: { userId: user.id, periodId: period.id, categoryId },
        });
        continue;
      }
      await tx.budgetTarget.upsert({
        where: {
          userId_periodId_categoryId: {
            userId: user.id,
            periodId: period.id,
            categoryId,
          },
        },
        update: { amount, cadence: item.cadence },
        create: { userId: user.id, periodId: period.id, categoryId, amount, cadence: item.cadence },
      });
    }
    return next;
  });

  await logSettingsAudit(user.id, "settings.budgetPlan.updated", {
    baselineIncome,
    baselineExpense,
    baselineSavings,
    dailySpendEstimate,
    expenseAllocated,
    savingsAllocated,
    itemCount: latestByCategory.size,
    periodId: period.id,
  });

  return { ok: true, updatedAt: updated.updatedAt.toISOString() };
}
