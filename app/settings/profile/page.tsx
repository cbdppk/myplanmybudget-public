import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";
import { ProfileSettingsForm } from "./client";

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) return <DataLoadError primaryHref="/settings" primaryLabel="Open settings overview" />;

  return (
    <ProfileSettingsForm
      initialName={data.user.name ?? ""}
      initialTimezone={data.user.timezone}
      initialLanguage={data.user.language}
    />
  );
}
