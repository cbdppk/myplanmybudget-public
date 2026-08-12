import { PageHeader } from "@/components/shell/page-header";
import { getRemindersData } from "@/lib/data/reminders";
import { RemindersClient } from "./client";
import { Button } from "@/components/ui/button";
import { DataLoadError } from "@/components/feature/data-load-error";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  let data: Awaited<ReturnType<typeof getRemindersData>> | null = null;
  try {
    data = await getRemindersData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
        <PageHeader title="Reminders" subtitle="Track deadlines and schedule follow-ups." />
        <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
      <PageHeader
        title="Reminders"
        subtitle="Track deadlines, recurring reminders, and add events to your device calendar."
        action={
          <Button asChild size="sm" variant="outline">
            <a href="/api/reminders/ics">Add all to calendar</a>
          </Button>
        }
      />
      <div className="mt-6">
        <RemindersClient
          initialReminders={data.reminders.map((item) => ({
            id: item.id,
            title: item.title,
            dueAt: item.dueAt.toISOString(),
            recurrence: item.recurrence as "NONE" | "DAILY" | "WEEKLY" | "MONTHLY",
            recurrenceInterval: item.recurrenceInterval,
            done: item.done,
          }))}
        />
      </div>
    </main>
  );
}
