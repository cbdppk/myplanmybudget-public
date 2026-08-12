import { PageHeader } from "@/components/shell/page-header";
import { getTrackData } from "@/lib/data/transactions";
import { DataLoadError } from "@/components/feature/data-load-error";
import { TrackFeedClient } from "./feed-client";

export const dynamic = "force-dynamic";

export default async function TrackPage() {
  let data: Awaited<ReturnType<typeof getTrackData>> | null = null;
  try {
    data = await getTrackData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
        <PageHeader title="Transactions" subtitle="Track income and expenses in one place." />
        <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
      <PageHeader title="Transactions" subtitle="What is happening to your money right now." />
      <div className="mt-6">
        <TrackFeedClient
          currency={data.currency.preferred}
          fxRate={data.currency.rate}
          today={data.today}
          period={data.period}
          dailyGuide={data.dailyGuide}
          extras={data.extras}
          impact={data.impact}
          categories={data.filters.categories}
          transactions={data.transactions}
          accounts={data.accounts}
          netWorth={data.netWorth}
          clearedNetWorth={data.clearedNetWorth}
          assetsTotal={data.assetsTotal}
          liabilitiesTotal={data.liabilitiesTotal}
        />
      </div>
    </main>
  );
}
