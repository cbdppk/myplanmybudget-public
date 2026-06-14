import { PageHeader } from "@/components/shell/page-header";
import { getGoalsPlannerData } from "@/lib/data/goals";
import { DataLoadError } from "@/components/feature/data-load-error";
import { GoalsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  let data: Awaited<ReturnType<typeof getGoalsPlannerData>> | null = null;
  try {
    data = await getGoalsPlannerData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader title="Goals" subtitle="Plan and track your target purchases and savings goals." />
        <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Goals" subtitle="Plan purchases and savings goals from your baseline and real transaction flow." />
      <div className="mt-6">
        <GoalsClient
          currency={data.currency.preferred}
          fxRate={data.currency.rate}
          initialGoals={data.goals}
          initialFundingSource={data.defaultFundingSource}
          snapshot={data.snapshot}
        />
      </div>
    </main>
  );
}
