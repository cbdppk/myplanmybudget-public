import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";
import { PrivacySettingsForm } from "./client";

export const dynamic = "force-dynamic";

export default async function SettingsPrivacyPage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) return <DataLoadError primaryHref="/settings" primaryLabel="Open settings overview" />;

  return <PrivacySettingsForm analyticsOptIn={data.user.analyticsOptIn} tipsOptIn={data.user.tipsOptIn} />;
}
