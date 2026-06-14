import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";
import { NotificationsSettingsForm } from "./client";

export const dynamic = "force-dynamic";

export default async function SettingsNotificationsPage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }
  if (!data) return <DataLoadError primaryHref="/settings" primaryLabel="Open settings overview" />;

  return (
    <NotificationsSettingsForm
      initial={{
        notifyDailyCheckIn: data.user.notifyDailyCheckIn,
        notifyWeeklySummary: data.user.notifyWeeklySummary,
        notifyMonthEndReview: data.user.notifyMonthEndReview,
        notifyGoalProgress: data.user.notifyGoalProgress,
        notifyInApp: data.user.notifyInApp,
        notifyEmail: data.user.notifyEmail,
        notifyPush: data.user.notifyPush,
      }}
    />
  );
}
