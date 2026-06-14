"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateGoalsSettings } from "../actions";
import { HelpTip } from "../_components/help-tip";

export function GoalsSettingsForm({
  initialAutoCreate,
  initialFundingSource,
}: {
  initialAutoCreate: boolean;
  initialFundingSource: string;
}) {
  const router = useRouter();
  const [autoCreate, setAutoCreate] = useState(initialAutoCreate);
  const [fundingSource, setFundingSource] = useState(initialFundingSource);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hasChanges = autoCreate !== initialAutoCreate || fundingSource !== initialFundingSource;

  useEffect(() => {
    setAutoCreate(initialAutoCreate);
  }, [initialAutoCreate]);

  useEffect(() => {
    setFundingSource(initialFundingSource);
  }, [initialFundingSource]);

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Goals & Savings</h2>
        <HelpTip text="Choose how savings categories become goal buckets and whether surplus can also fund goals." />
      </div>
      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Control how savings categories map into goals and what funding source is used.</p>
      <div className="mt-3 grid gap-2 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={autoCreate} onChange={(e) => setAutoCreate(e.target.checked)} />
          Auto-create goals from savings categories
        </label>
        <label>
          <div className="text-xs text-[color:var(--text-secondary)]">Default goal funding source</div>
          <select className="mt-1 h-10 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3" value={fundingSource} onChange={(e) => setFundingSource(e.target.value)}>
            <option value="SAVINGS_ONLY">Savings only</option>
            <option value="SAVINGS_PLUS_SURPLUS">Savings + Surplus</option>
            <option value="SURPLUS_ONLY">Surplus only (no savings deduction)</option>
          </select>
        </label>
      </div>
      <div className="mt-3">
        <Button
          loading={pending}
          disabled={pending || !hasChanges}
          onClick={() => {
            setMessage(null);
            start(async () => {
              try {
                await updateGoalsSettings({
                  autoCreateGoalsFromSavings: autoCreate,
                  goalFundingSource: fundingSource as "SAVINGS_ONLY" | "SAVINGS_PLUS_SURPLUS" | "SURPLUS_ONLY",
                });
                setMessage("Goals settings saved.");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed.");
              }
            });
          }}
        >
          Save goals settings
        </Button>
      </div>
      {message ? <p className="mt-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
    </section>
  );
}
