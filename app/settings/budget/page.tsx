import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";
import { BudgetSettingsForm } from "./client";
import { supportedCurrencies } from "@/lib/money/currencies";

export const dynamic = "force-dynamic";

export default async function SettingsBudgetPage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) return <DataLoadError primaryHref="/settings" primaryLabel="Open settings overview" />;

  return (
    <BudgetSettingsForm
      initialCurrency={data.user.preferredCurrency}
      currencyOptions={supportedCurrencies()}
      initialBudget={{
        baselineIncome: Number(data.user.baselineIncome),
        baselineExpense: Number(data.user.baselineExpense),
        baselineSavings: Number(data.user.baselineSavings),
        dailySpendEstimate: Number(data.user.dailySpendEstimate),
        dailyEstimateAuto: data.user.dailyEstimateAuto,
        incomeFrequency: data.user.incomeFrequency,
        budgetStartMode: data.user.budgetStartMode,
        blockExtrasWhenSurplusNegative: data.user.blockExtrasWhenSurplusNegative,
        showSimulationSuggestion: data.user.showSimulationSuggestion,
        updatedAt: data.user.updatedAt.toISOString(),
        daysInPeriod: data.budget.daysInPeriod,
        categories: data.budget.categories,
      }}
    />
  );
}
