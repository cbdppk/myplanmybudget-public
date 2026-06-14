"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateNotificationSettings } from "../actions";
import { HelpTip } from "../_components/help-tip";

const REMINDERS = [
  { key: "notifyDailyCheckIn" as const, label: "Daily spend check-in", desc: "A quick nudge to log your spending each day." },
  { key: "notifyWeeklySummary" as const, label: "Weekly summary", desc: "A recap of your spending and progress each week." },
  { key: "notifyMonthEndReview" as const, label: "Month-end review", desc: "A wrap-up of your budget at the end of each month." },
  { key: "notifyGoalProgress" as const, label: "Goal progress updates", desc: "Alerts when your savings goals reach milestones." },
];

const CHANNELS = [
  { key: "notifyInApp" as const, label: "In-app notifications", desc: "See notifications inside the app." },
  { key: "notifyEmail" as const, label: "Email", desc: "Receive summaries and alerts by email." },
  { key: "notifyPush" as const, label: "Push notifications", desc: "Receive alerts on your device (requires permission)." },
];

type NotifState = {
  notifyDailyCheckIn: boolean;
  notifyWeeklySummary: boolean;
  notifyMonthEndReview: boolean;
  notifyGoalProgress: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyPush: boolean;
};

export function NotificationsSettingsForm({ initial }: { initial: NotifState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    setState(initial);
  }, [initial]);

  const toggle = (key: keyof NotifState) => setState((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasChanges = (Object.keys(initial) as (keyof NotifState)[]).some(
    (k) => state[k] !== initial[k]
  );

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <HelpTip text="Choose which reminders you want and how you want to receive them. You can turn off all notifications at any time." />
      </div>
      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Stay on track with budget and goal reminders.</p>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Reminders</p>
        {REMINDERS.map(({ key, label, desc }) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
            <input
              type="checkbox"
              checked={state[key]}
              onChange={() => toggle(key)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm">{label}</span>
              <span className="block text-xs text-[color:var(--text-muted)]">{desc}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 border-t [border-color:var(--border)] pt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">How to notify me</p>
        {CHANNELS.map(({ key, label, desc }) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
            <input
              type="checkbox"
              checked={state[key]}
              onChange={() => toggle(key)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm">{label}</span>
              <span className="block text-xs text-[color:var(--text-muted)]">{desc}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <Button
          loading={pending}
          disabled={pending || !hasChanges}
          onClick={() => {
            start(async () => {
              try {
                await updateNotificationSettings(state);
                toast.success("Notification settings saved.");
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to save.");
              }
            });
          }}
        >
          Save notification settings
        </Button>
      </div>
    </section>
  );
}
