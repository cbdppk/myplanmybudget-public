import nextDynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { DataLoadError } from "@/components/feature/data-load-error";
import { getBudgetPlannerData } from "@/lib/data/budgets";

export const dynamic = "force-dynamic";

const BudgetPlanner = nextDynamic(() => import("@/app/plan/client").then((m) => m.BudgetPlanner), {
  loading: () => (
    <div className="animate-pulse space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-black/[0.06]" />)}
      </div>
      <div className="h-48 w-full rounded-xl bg-black/[0.06]" />
      <div className="h-32 w-full rounded-xl bg-black/[0.06]" />
    </div>
  ),
});

export default async function BudgetPage() {
  let data: Awaited<ReturnType<typeof getBudgetPlannerData>> | null = null;
  try {
    data = await getBudgetPlannerData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader title="Budget" subtitle="View your baseline summary." />
        <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Budget" subtitle={`Plan-first dashboard for ${data.period.name}.`} />
      <div className="mt-6">
        <BudgetPlanner items={data.items} currency={data.currency.preferred} fxRate={data.currency.rate} baseline={data.baseline} actual={data.actual} guidance={data.guidance} extrasSummary={data.extrasSummary} daysRemaining={data.daysRemaining} periodStartDate={data.period.startDate.toISOString()} />
      </div>
    </main>
  );
}
