import nextDynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { DataLoadError } from "@/components/feature/data-load-error";
import { getSimulationPageData } from "@/lib/data/simulations";

export const dynamic = "force-dynamic";

const ScenarioRunner = nextDynamic(() => import("./client").then((m) => m.ScenarioRunner), {
  loading: () => (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-full rounded-xl bg-black/[0.06]" />
      <div className="h-40 w-full rounded-xl bg-black/[0.06]" />
      <div className="h-64 w-full rounded-xl bg-black/[0.06]" />
    </div>
  ),
});

export default async function SimulatePage({
  searchParams,
}: {
  searchParams?: Promise<{
    scenario?: string;
    fromGoal?: string;
    scenarioName?: string;
    income?: string;
    expenses?: string;
    startingSavings?: string;
    horizon?: string;
    target?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const selectedScenarioId = params?.scenario;
  const prefill =
    params?.fromGoal === "1"
      ? {
          name: params.scenarioName,
          monthlyIncome: params.income,
          monthlyExpenses: params.expenses,
          startingSavings: params.startingSavings,
          horizonMonths: params.horizon,
          targetAmount: params.target,
        }
      : null;
  let data: Awaited<ReturnType<typeof getSimulationPageData>> | null = null;
  try {
    data = await getSimulationPageData(selectedScenarioId);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader title="Simulate" subtitle="Predict spending and required income for your goals." />
        <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />
      </main>
    );
  }
  const { history, baseline, selectedScenario } = data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Simulate" subtitle="Test scenarios before changing your real budget." />
      <div className="mt-6">
        <ScenarioRunner currency={data.currency.preferred} fxRate={data.currency.rate} baseline={baseline} history={history} selectedScenario={selectedScenario} prefill={prefill} />
      </div>
    </main>
  );
}
