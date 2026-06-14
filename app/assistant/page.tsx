import { redirect } from "next/navigation";
import { AppAssistant } from "@/components/feature/app-assistant";
import { getDashboardData } from "@/lib/data/dashboard";
import { getGoalsPlannerData } from "@/lib/data/goals";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let goalData: Awaited<ReturnType<typeof getGoalsPlannerData>> | null = null;

  try {
    [data, goalData] = await Promise.all([
      getDashboardData({ range: "MONTHLY" }),
      getGoalsPlannerData().catch(() => null),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNAUTHENTICATED")) {
      redirect("/login?next=%2Fassistant");
    }
    throw error;
  }

  const topSpend = data.budgetByCategory
    .slice()
    .sort((a, b) => b.spent - a.spent)
    .find((item) => item.spent > 0) ?? null;
  const biggestBudgetGap =
    data.budgetByCategory.filter((item) => item.kind === "expense" && item.remaining < 0).sort((a, b) => a.remaining - b.remaining)[0] ?? null;

  const assistantContext = {
    currency: data.currency.preferred,
    fxRate: data.currency.rate,
    periodName: data.period.name,
    windowLabel: data.filters.windowLabel,
    availableBalance: data.availableMoney,
    net: data.net,
    income: data.income,
    expenses: data.expenses,
    savings: data.savings,
    plannedIncome: data.plannedIncome,
    plannedExpenses: data.plannedExpenses,
    plannedSavings: data.plannedSavings,
    budgeted: data.budgeted,
    used: data.used,
    budgetRemaining: data.budgetRemaining,
    budgetStatusPct: data.budgetStatusPct,
    savingsRatePct: data.savingsRatePct,
    moneyGist: data.moneyGist,
    openReminderCount: data.openReminderCount,
    noteCount: data.noteSummary.count,
    todaySummary: data.todaySummary,
    topSpend: topSpend ? { category: topSpend.category, spent: topSpend.spent } : null,
    biggestBudgetGap: biggestBudgetGap ? { category: biggestBudgetGap.category, remaining: biggestBudgetGap.remaining } : null,
    recent: data.recent.map((txn) => ({
      id: txn.id,
      label: txn.memo ?? txn.category?.name ?? txn.type,
      occurredAt: new Date(txn.occurredAt).toISOString(),
    })),
    reminders: data.reminders.map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      dueAt: new Date(reminder.dueAt).toISOString(),
    })),
    lessons: data.moneyLessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      insight: lesson.insight,
    })),
    goalSummary: data.goalSummary,
    appSummary: data.appSummary,
    goalPlan: goalData
      ? {
          fundingSource: goalData.defaultFundingSource,
          baselineOutgoing: goalData.snapshot.baselineOutgoing,
          baselineSurplus: goalData.snapshot.baselineSurplus,
          availableForGoalsMonthly: goalData.snapshot.availableForGoalsMonthly,
          availableSavingsForGoals: goalData.snapshot.availableSavingsForGoals,
          availableSurplusForGoals: goalData.snapshot.availableSurplusForGoals,
          extraIncome: goalData.snapshot.extraIncome,
          extraExpense: goalData.snapshot.extraExpense,
        }
      : null,
  } as const;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <AppAssistant
        context={assistantContext}
        viewer={{
          name: data.user.name ?? null,
          email: data.user.email,
        }}
      />
    </div>
  );
}
