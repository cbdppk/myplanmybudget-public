import { prisma } from "@/lib/prisma";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber } from "@/lib/data/utils";
import { normalizeToMonthly, type MoneyCadence } from "@/lib/money/frequency";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getOnboardingUser() {
  return getActiveUser();
}

export async function hasCompletedBudgetOnboarding(userId: string) {
  const [profile, budgetTargetCount] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { id: userId },
      select: { baselineIncome: true, baselineExpense: true, baselineSavings: true },
    }),
    prisma.budgetTarget.count({
      where: { userId },
    }),
  ]);

  return (
    toNumber(profile?.baselineIncome) > 0 ||
    toNumber(profile?.baselineExpense) > 0 ||
    toNumber(profile?.baselineSavings) > 0 ||
    budgetTargetCount > 0
  );
}

export async function completeOnboarding(params: {
  name: string;
  currency: string;
  incomeFrequency: MoneyCadence;
  budgetStartMode: "CURRENT_MONTH" | "NEXT_MONTH";
  accountName: string;
  expenseCategories: string[];
  savingsCategories: string[];
  incomeAmount: number;
  expenseAmount: number;
  savingsAmount: number;
  enableDailyReminder?: boolean;
  dailyReminderHour?: number;
  dailySpendEstimate?: number;
}) {
  const user = await getActiveUser();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const autoMonthStartDay = Math.min(28, Math.max(1, now.getDate()));
  const baselineIncome = normalizeToMonthly(params.incomeAmount, params.incomeFrequency, daysInMonth);
  const baselineExpense = normalizeToMonthly(params.expenseAmount, params.incomeFrequency, daysInMonth);
  const baselineSavings = normalizeToMonthly(params.savingsAmount, params.incomeFrequency, daysInMonth);

  const existingAccount = await prisma.financialAccount.findFirst({
    where: { userId: user.id, name: params.accountName },
    select: { id: true },
  });

  if (!existingAccount) {
    await prisma.financialAccount.create({
      data: { userId: user.id, name: params.accountName, type: "cash" },
    });
  }

  const period = await ensureCurrentBudgetPeriod(user.id, {
    monthStartDay: autoMonthStartDay,
    startMode: params.budgetStartMode,
  });

  const ensuredExpenseCategoryIds: string[] = [];
  for (const categoryName of params.expenseCategories) {
    const existingCategory = await prisma.category.findFirst({
      where: { userId: user.id, name: categoryName, kind: "expense" },
      select: { id: true, kind: true },
    });
    if (existingCategory) {
      ensuredExpenseCategoryIds.push(existingCategory.id);
    } else {
      const created = await prisma.category.create({
        data: { userId: user.id, name: categoryName, kind: "expense" },
      });
      ensuredExpenseCategoryIds.push(created.id);
    }
  }

  const savingsCategoryIds: string[] = [];
  for (const categoryName of params.savingsCategories) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name: categoryName, kind: "savings" },
      select: { id: true },
    });
    if (existing) {
      savingsCategoryIds.push(existing.id);
    } else {
      const created = await prisma.category.create({
        data: { userId: user.id, name: categoryName, kind: "savings" },
      });
      savingsCategoryIds.push(created.id);
    }
  }

  const expenseCategories = await prisma.category.findMany({
    where: { userId: user.id, id: { in: ensuredExpenseCategoryIds } },
    select: { id: true, name: true },
  });
  const budgetTargets: Array<{ categoryId: string; amount: number }> = [];

  if (baselineExpense > 0 && expenseCategories.length > 0) {
    const priorityIds = expenseCategories
      .filter((item) => ["food", "transport", "utilities"].includes(item.name.trim().toLowerCase()))
      .map((item) => item.id);
    const nonPriority = expenseCategories.filter((item) => !priorityIds.includes(item.id));
    const priorityPool = priorityIds.length > 0 ? round2(baselineExpense * 0.55) : 0;
    const remainingPool = round2(Math.max(0, baselineExpense - priorityPool));

    if (priorityIds.length > 0) {
      let allocated = 0;
      for (let i = 0; i < priorityIds.length; i += 1) {
        const amount = i === priorityIds.length - 1 ? round2(priorityPool - allocated) : round2(priorityPool / priorityIds.length);
        allocated += amount;
        budgetTargets.push({ categoryId: priorityIds[i], amount });
      }
    }

    const remainingTargets = nonPriority.length > 0 ? nonPriority : expenseCategories.filter((item) => priorityIds.includes(item.id));
    if (remainingTargets.length > 0) {
      let allocated = 0;
      for (let i = 0; i < remainingTargets.length; i += 1) {
        const amount = i === remainingTargets.length - 1 ? round2(remainingPool - allocated) : round2(remainingPool / remainingTargets.length);
        allocated += amount;
        budgetTargets.push({ categoryId: remainingTargets[i].id, amount });
      }
    }
  }

  if (baselineSavings > 0 && savingsCategoryIds.length > 0) {
    let allocated = 0;
    for (let i = 0; i < savingsCategoryIds.length; i += 1) {
      const amount = i === savingsCategoryIds.length - 1 ? round2(baselineSavings - allocated) : round2(baselineSavings / savingsCategoryIds.length);
      allocated += amount;
      budgetTargets.push({ categoryId: savingsCategoryIds[i], amount });
    }
  }

  const expenseCategoryNameById = new Map(expenseCategories.map((item) => [item.id, item.name.trim().toLowerCase()]));
  const priorityTotal = budgetTargets.reduce((sum, item) => {
    const categoryName = expenseCategoryNameById.get(item.categoryId);
    if (!categoryName) return sum;
    if (!["food", "transport", "utilities"].includes(categoryName)) return sum;
    return sum + toNumber(item.amount);
  }, 0);
  const derivedDailyEstimate = round2((priorityTotal > 0 ? priorityTotal : baselineExpense) / Math.max(1, daysInMonth));
  const dailySpendEstimate =
    params.dailySpendEstimate !== undefined && Number.isFinite(params.dailySpendEstimate) && params.dailySpendEstimate > 0
      ? round2(params.dailySpendEstimate)
      : derivedDailyEstimate;

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { id: user.id },
      data: {
        name: params.name,
        currency: params.currency.toUpperCase(),
        baseCurrency: params.currency.toUpperCase(),
        preferredCurrency: params.currency.toUpperCase(),
        incomeFrequency: params.incomeFrequency,
        budgetStartMode: params.budgetStartMode,
        monthStartDay: autoMonthStartDay,
        baselineIncome,
        baselineExpense,
        baselineSavings,
        dailySpendEstimate,
      },
    }),
    ...budgetTargets.map((item) =>
      prisma.budgetTarget.upsert({
        where: {
          userId_periodId_categoryId: { userId: user.id, periodId: period.id, categoryId: item.categoryId },
        },
        update: { amount: item.amount, cadence: "MONTHLY" },
        create: { userId: user.id, periodId: period.id, categoryId: item.categoryId, amount: item.amount, cadence: "MONTHLY" },
      })
    ),
    ...(params.enableDailyReminder
      ? [
          prisma.reminder.create({
            data: {
              userId: user.id,
              title: "Daily account check-in",
              dueAt: new Date(new Date().setHours(params.dailyReminderHour ?? 21, 0, 0, 0)),
              recurrence: "DAILY",
              recurrenceInterval: 1,
            },
          }),
        ]
      : []),
  ]);

  await prisma.auditEvent.create({
    data: {
      userId: user.id,
      action: "onboarding.completed",
      meta: {
        accountName: params.accountName,
        categoryCount: params.expenseCategories.length + params.savingsCategories.length,
        baselineIncome,
        baselineExpense,
        baselineSavings,
        dailySpendEstimate,
      },
    },
  });

  return { ok: true };
}
