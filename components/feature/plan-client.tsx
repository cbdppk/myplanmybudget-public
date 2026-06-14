"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type BudgetRow = { category: string; categoryId: string; limit: number; spent: number };

export function PlanClient({ initialRows }: { initialRows: BudgetRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [newCategory, setNewCategory] = useState("");
  const [newLimit, setNewLimit] = useState("100");

  const total = useMemo(() => rows.reduce((acc, row) => acc + row.limit, 0), [rows]);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Monthly category limits</h2>
        <p className="text-sm text-black/60">Total planned: ${total.toLocaleString()}</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-black/60">
              <th className="pb-2">Category</th>
              <th className="pb-2">Limit</th>
              <th className="pb-2">Spent</th>
              <th className="pb-2">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const pct = Math.min(100, Math.round((row.spent / Math.max(1, row.limit)) * 100));
              return (
                <tr key={row.categoryId} className="border-t border-black/10">
                  <td className="py-3 font-medium">{row.category}</td>
                  <td className="py-3">
                    <input
                      value={row.limit}
                      type="number"
                      className="h-9 w-24 rounded-xl border border-black/15 px-2"
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, limit: Number(e.target.value || 0) };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td className="py-3">${row.spent}</td>
                  <td className="py-3">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-black/10">
                      <div
                        className={`h-full ${pct > 90 ? "bg-[var(--danger)]" : pct > 75 ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-[var(--surface)] p-4">
        <p className="text-sm font-medium">Quick add category (drawer-style section)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="h-10 rounded-xl border border-black/15 px-3" placeholder="Category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <input className="h-10 w-28 rounded-xl border border-black/15 px-3" type="number" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
          <Button
            type="button"
            onClick={() => {
              if (!newCategory.trim()) return;
              setRows((prev) => [
                ...prev,
                { category: newCategory.trim(), categoryId: `${Date.now()}`, limit: Number(newLimit || 0), spent: 0 },
              ]);
              setNewCategory("");
            }}
          >
            Add category
          </Button>
        </div>
      </div>
    </section>
  );
}
