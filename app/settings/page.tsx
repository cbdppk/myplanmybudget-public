import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { SettingsGrid } from "./_components/settings-grid";

export const dynamic = "force-dynamic";

export default async function SettingsOverviewPage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) {
    return <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />;
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Settings overview</h2>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Signed in as <span className="font-semibold">{data.user.email}</span> · {data.user.currency}
        </p>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">App tour</h2>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Replay the guided walkthrough any time to revisit the menu and the main budgeting pages.
        </p>
        <div className="mt-3">
          <LoadingLinkButton href="/dashboard?tour=start" size="sm">
            Replay app tour
          </LoadingLinkButton>
        </div>
      </section>

      <SettingsGrid />
    </div>
  );
}
