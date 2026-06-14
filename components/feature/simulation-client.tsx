"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MiniLineChart } from "@/components/feature/charts";

export function SimulationClient({ baselineIncome, baselineExpense }: { baselineIncome: number; baselineExpense: number }) {
  const [incomeDelta, setIncomeDelta] = useState(0);
  const [expenseDelta, setExpenseDelta] = useState(0);
  const [goalMonths, setGoalMonths] = useState(6);

  const projectedRunway = useMemo(() => {
    const net = baselineIncome + incomeDelta - (baselineExpense + expenseDelta);
    return Math.max(1, Math.round((net / 100) * 2 + goalMonths));
  }, [baselineExpense, baselineIncome, expenseDelta, goalMonths, incomeDelta]);

  const trend = useMemo(
    () => Array.from({ length: 8 }, (_, i) => Math.max(100, baselineIncome - baselineExpense + incomeDelta - expenseDelta - i * 35 + goalMonths * 6)),
    [baselineExpense, baselineIncome, expenseDelta, goalMonths, incomeDelta]
  );

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <article className="card p-5">
        <h2 className="text-lg font-semibold">Scenario controls</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-black/70">Income change: {incomeDelta >= 0 ? "+" : ""}${incomeDelta}</span>
            <input className="mt-2 w-full" type="range" min={-1000} max={1000} step={50} value={incomeDelta} onChange={(e) => setIncomeDelta(Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            <span className="text-black/70">Expense change: {expenseDelta >= 0 ? "+" : ""}${expenseDelta}</span>
            <input className="mt-2 w-full" type="range" min={-1000} max={1000} step={50} value={expenseDelta} onChange={(e) => setExpenseDelta(Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            <span className="text-black/70">Goal timeline: {goalMonths} months</span>
            <input className="mt-2 w-full" type="range" min={1} max={24} value={goalMonths} onChange={(e) => setGoalMonths(Number(e.target.value))} />
          </label>
        </div>
      </article>

      <article className="card p-5">
        <h2 className="text-lg font-semibold">Scenario result</h2>
        <p className="mt-2 text-sm text-black/60">Projected runway: <span className="font-semibold text-[var(--success)]">{projectedRunway} months</span></p>
        <div className="mt-4">
          <MiniLineChart values={trend} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button">Save scenario</Button>
          <Button type="button" variant="outline">Compare</Button>
          <Button type="button" variant="outline">Apply to real budget</Button>
        </div>
        <p className="mt-3 text-xs text-black/60">Applying requires explicit confirm and does not auto-merge silently.</p>
      </article>
    </section>
  );
}
