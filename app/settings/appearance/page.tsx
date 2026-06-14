import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";
import { AppearanceSettingsForm } from "./client";

export const dynamic = "force-dynamic";

export default async function SettingsAppearancePage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) return <DataLoadError primaryHref="/settings" primaryLabel="Open settings overview" />;

  return <AppearanceSettingsForm initialTheme={data.user.themePreference} />;
}
