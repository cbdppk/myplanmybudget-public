import { PageHeader } from "@/components/shell/page-header";
import { DataLoadError } from "@/components/feature/data-load-error";
import { getBudgetEditData } from "@/lib/data/budgets";
import { BudgetEditClient } from "./client";

export const dynamic = "force-dynamic";

export default async function BudgetEditPage() {
  let data: Awaited<ReturnType<typeof getBudgetEditData>> | null = null;
  try {
    data = await getBudgetEditData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <PageHeader title="Edit Budget" subtitle="Configure your budget behavior and allocations." />
        <DataLoadError primaryHref="/budget" primaryLabel="Back to budget" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <BudgetEditClient
        initial={{
          periodName: data.periodName,
          daysInMonth: data.daysInMonth,
          currency: data.currency,
          fxRate: data.fxRate,
          incomeFrequency: data.incomeFrequency,
          budgetStartMode: data.budgetStartMode,
          monthStartDay: data.monthStartDay,
          incomeAmount: data.incomeEntered,
          monthlyExpense: data.baselineExpenseMonthly,
          monthlySavings: data.baselineSavingsMonthly,
          categories: data.categories,
        }}
      />
    </main>
  );
}
