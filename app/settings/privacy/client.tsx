"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePrivacySettings } from "../actions";

export function PrivacySettingsForm({ analyticsOptIn, tipsOptIn }: { analyticsOptIn: boolean; tipsOptIn: boolean }) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(analyticsOptIn);
  const [tips, setTips] = useState(tipsOptIn);
  const [pending, start] = useTransition();
  const [exportPending, setExportPending] = useState(false);

  useEffect(() => {
    setAnalytics(analyticsOptIn);
  }, [analyticsOptIn]);

  useEffect(() => {
    setTips(tipsOptIn);
  }, [tipsOptIn]);

  const hasChanges = analytics !== analyticsOptIn || tips !== tipsOptIn;

  const downloadExport = async (format: "csv" | "json") => {
    setExportPending(true);
    try {
      const res = await fetch(`/api/export/${format}`);
      if (!res.ok) throw new Error("Export failed. Please try again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Your data has been downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setExportPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Your data</h2>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Download a copy of all your financial data at any time.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            loading={exportPending}
            disabled={exportPending}
            onClick={() => downloadExport("csv")}
          >
            Download as CSV
          </Button>
          <Button
            variant="outline"
            loading={exportPending}
            disabled={exportPending}
            onClick={() => downloadExport("json")}
          >
            Download as JSON
          </Button>
        </div>
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">Your export includes all transactions, goals, notes, and budget data.</p>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Privacy preferences</h2>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Control how your data is used to improve your experience.</p>
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm">Help improve the app</span>
              <span className="block text-xs text-[color:var(--text-muted)]">Allow us to collect anonymous usage data to make the app better.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={tips}
              onChange={(e) => setTips(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm">Personalised tips</span>
              <span className="block text-xs text-[color:var(--text-muted)]">Get money-saving tips tailored to your spending patterns.</span>
            </span>
          </label>
        </div>
        <div className="mt-4">
          <Button
            loading={pending}
            disabled={pending || !hasChanges}
            onClick={() => {
              start(async () => {
                try {
                  await updatePrivacySettings({ analyticsOptIn: analytics, tipsOptIn: tips });
                  router.refresh();
                  toast.success("Privacy preferences saved.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to save.");
                }
              });
            }}
          >
            Save preferences
          </Button>
        </div>
      </section>
    </div>
  );
}
