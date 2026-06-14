"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { archiveCategory, createCategory } from "../actions";
import { HelpTip } from "../_components/help-tip";

type CategoryItem = { id: string; name: string; kind: string };

export function CategoriesSettingsForm({ initialCategories }: { initialCategories: CategoryItem[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"expense" | "savings">("expense");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tone = !message
    ? null
    : /added|archived/i.test(message)
      ? "success"
      : /security|re-authenticate|refresh|wait/i.test(message)
        ? "warning"
        : "error";
  const messageClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-rose-200 bg-rose-50 text-rose-800";
  const showSecurityLink = (message ?? "").toLowerCase().includes("security");

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Categories</h2>
        <HelpTip text="Archive keeps data history safe. Archived categories are hidden from normal budgeting forms." />
      </div>
      <p className="mt-1 text-xs text-black/60">Add, manage, and archive expense/savings categories.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
        <input className="h-10 rounded-xl border border-black/15 px-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
        <select className="h-10 rounded-xl border border-black/15 px-3" value={kind} onChange={(e) => setKind(e.target.value === "savings" ? "savings" : "expense")}>
          <option value="expense">Expense</option>
          <option value="savings">Savings</option>
        </select>
        <Button
          loading={pending}
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              try {
                const result = await createCategory({ name, kind });
                if (!result.ok) {
                  setMessage(result.error);
                  return;
                }
                if (result.data.category) {
                  setCategories((prev) => [...prev, result.data.category!].sort((a, b) => a.name.localeCompare(b.name)));
                }
                setName("");
                setMessage("Category added.");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed.");
              }
            });
          }}
        >
          Add
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2 text-sm">
            <p>{category.name} <span className="text-black/50">({category.kind})</span></p>
            <Button
              size="sm"
              variant="outline"
              loading={pending}
              disabled={pending}
              onClick={() => {
                setMessage(null);
                start(async () => {
                  try {
                    const result = await archiveCategory(category.id);
                    if (!result.ok) {
                      setMessage(result.error);
                      return;
                    }
                    setCategories((prev) => prev.filter((row) => row.id !== category.id));
                    setMessage("Category archived.");
                    router.refresh();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed.");
                  }
                });
              }}
            >
              Archive
            </Button>
          </div>
        ))}
      </div>
      {message ? (
        <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${messageClass}`}>
          <p>{message}</p>
          {showSecurityLink ? (
            <div className="mt-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/security">Open Security</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
