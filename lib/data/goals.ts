import { prisma } from "@/lib/prisma";
import { getMonthlyMoneyOverview } from "@/lib/data/money-overview";
import { getActiveUser, toNumber } from "@/lib/data/utils";
import { getDisplayCurrencyContext } from "@/lib/data/currency";
import { logAudit } from "@/lib/data/audit";

function monthsUntil(date: Date | null) {
  if (!date) return null;
  const now = new Date();
  const diffMonths = (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
  return Math.max(1, diffMonths + 1);
}

async function syncSavingsCategoriesToGoals(userId: string, goalNames: string[]) {
  const uniqueGoalNames = Array.from(
    new Set(
      goalNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    )
  );

  const existingSavings = await prisma.category.findMany({
    where: { userId, kind: "savings" },
    select: { id: true, name: true },
  });

  const goalNameSet = new Set(uniqueGoalNames);
  const toDeleteIds = existingSavings.filter((item) => !goalNameSet.has(item.name)).map((item) => item.id);
  const existingNameSet = new Set(existingSavings.map((item) => item.name));
  const toCreate = uniqueGoalNames.filter((name) => !existingNameSet.has(name));

  const tx = [];
  if (toDeleteIds.length > 0) {
    tx.push(
      prisma.category.deleteMany({
        where: { userId, id: { in: toDeleteIds } },
      })
    );
  }
  if (toCreate.length > 0) {
    tx.push(
      prisma.category.createMany({
        data: toCreate.map((name) => ({ userId, name, kind: "savings" })),
        skipDuplicates: true,
      })
    );
  }
  if (tx.length > 0) {
    await prisma.$transaction(tx);
  }
}

export async function getGoalsPlannerData() {
  const user = await getActiveUser();
  const [goals, overview, fx] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    getMonthlyMoneyOverview(user.id),
    getDisplayCurrencyContext(user),
  ]);

  await syncSavingsCategoriesToGoals(
    user.id,
    goals.map((goal) => goal.name)
  );

  const baselineIncome = toNumber(user.baselineIncome);
  const baselineExpense = toNumber(user.baselineExpense);
  const baselineSavings = toNumber(user.baselineSavings);
  const baselineOutgoing = baselineExpense + baselineSavings;
  const baselineSurplus = Math.max(0, baselineIncome - baselineOutgoing);
  const extraIncome = Math.max(0, overview.extraIncome);
  const extraExpense = Math.max(0, overview.extraExpense);
  const projectedExtraIncome =
    overview.dayOfMonth > 0
      ? Math.max(0, (extraIncome / overview.dayOfMonth) * overview.daysInMonth)
      : extraIncome;
  const projectedExtraExpense =
    overview.dayOfMonth > 0
      ? Math.max(0, (extraExpense / overview.dayOfMonth) * overview.daysInMonth)
      : extraExpense;
  const availableForGoalsMonthly = Math.max(0, baselineSurplus + projectedExtraIncome - projectedExtraExpense);
  const totalGoalCurrent = goals.reduce((sum, goal) => sum + toNumber(goal.current), 0);
  const availableSavingsForGoals = Math.max(0, baselineSavings + overview.extraSavings - totalGoalCurrent);
  const availableSurplusForGoals = Math.max(0, baselineSurplus + extraIncome - extraExpense);

  return {
    user,
    currency: { preferred: fx.preferredCurrency, rate: fx.fxRate },
    defaultFundingSource: (user.goalFundingSource as "SAVINGS_ONLY" | "SAVINGS_PLUS_SURPLUS" | "SURPLUS_ONLY") ?? "SAVINGS_PLUS_SURPLUS",
    snapshot: {
      baselineIncome,
      baselineExpense,
      baselineSavings,
      baselineOutgoing,
      baselineSurplus,
      availableForGoalsMonthly,
      availableSavingsForGoals,
      availableSurplusForGoals,
      extraIncome,
      extraExpense,
      totalGoalCurrent,
    },
    goals: goals.map((goal) => {
      const target = toNumber(goal.target);
      const current = toNumber(goal.current);
      const remaining = Math.max(0, target - current);
      const remainingAfterSavings = Math.max(0, remaining - (availableSavingsForGoals + availableSurplusForGoals));
      const monthsLeft = monthsUntil(goal.dueDate);
      const monthlyNeeded = monthsLeft ? remainingAfterSavings / monthsLeft : null;
      const weeklyNeeded = monthlyNeeded !== null ? (monthlyNeeded * 12) / 52 : null;
      const progressPct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      const monthsAtCurrentCapacity =
        remaining <= 0
          ? 0
          : remainingAfterSavings <= 0
            ? 0
            : availableForGoalsMonthly > 0
              ? Math.ceil(remainingAfterSavings / availableForGoalsMonthly)
              : null;
      const approvedNow = remaining > 0 && remaining <= availableSavingsForGoals + availableSurplusForGoals;
      const recommendation =
        remaining <= 0
          ? "Goal completed."
          : approvedNow
            ? "You can fund this now from available savings/surplus."
            : availableSavingsForGoals + availableSurplusForGoals <= 0 && availableForGoalsMonthly <= 0
              ? "Insufficient surplus and savings. Reduce expenses or increase income first."
              : monthlyNeeded && availableForGoalsMonthly > 0
                ? `Need about ${monthlyNeeded.toFixed(2)} monthly (${((monthlyNeeded * 12) / 52).toFixed(2)} weekly).`
                : "Savings available, but monthly surplus is low. Increase surplus to keep this goal on track.";
      return {
        id: goal.id,
        name: goal.name,
        target,
        current,
        remaining,
        dueDate: goal.dueDate,
        monthsLeft,
        monthlyNeeded,
        weeklyNeeded,
        approvedNow,
        monthsAtCurrentCapacity,
        recommendation,
        progressPct,
      };
    }),
  };
}

export async function createGoal(params: {
  name: string;
  target: number;
  current?: number;
  dueDate?: string;
}) {
  const user = await getActiveUser();
  const created = await prisma.goal.create({
    data: {
      userId: user.id,
      name: params.name,
      target: params.target,
      current: Math.max(0, params.current ?? 0),
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
    },
  });
  await syncSavingsCategoriesToGoals(
    user.id,
    (
      await prisma.goal.findMany({
        where: { userId: user.id },
        select: { name: true },
      })
    ).map((goal) => goal.name)
  );
  logAudit(user.id, "goal_create", { name: params.name, target: params.target });
  return { ok: true, id: created.id };
}

export async function updateGoalProgress(params: { goalId: string; current: number }) {
  const user = await getActiveUser();
  await prisma.goal.updateMany({
    where: { id: params.goalId, userId: user.id },
    data: { current: Math.max(0, params.current) },
  });
  logAudit(user.id, "goal_update_progress", { goalId: params.goalId, current: params.current });
  return { ok: true };
}

export async function addGoalSavings(params: { goalId: string; amount: number }) {
  const user = await getActiveUser();
  const amount = Math.max(0, params.amount);
  if (amount <= 0) return { ok: true };
  await prisma.goal.updateMany({
    where: { id: params.goalId, userId: user.id },
    data: { current: { increment: amount } },
  });
  return { ok: true };
}

export async function deleteGoal(goalId: string) {
  const user = await getActiveUser();
  await prisma.goal.deleteMany({
    where: { id: goalId, userId: user.id },
  });
  logAudit(user.id, "goal_delete", { goalId });
  await syncSavingsCategoriesToGoals(
    user.id,
    (
      await prisma.goal.findMany({
        where: { userId: user.id },
        select: { name: true },
      })
    ).map((goal) => goal.name)
  );
  return { ok: true };
}
