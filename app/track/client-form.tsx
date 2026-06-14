"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createQuickTransaction } from "./actions";

type OptimisticTxn = {
  id: string;
  memo: string | null;
  type: "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER";
  amount: number;
  occurredAt: Date | string;
  category: string | null;
};

type FlowMode = "INCOME" | "OUTFLOW";
type OutflowKind = "EXPENSE" | "SAVINGS" | "EXTRA_EXPENSE";
type WizardStep = "AMOUNT" | "KIND" | "DETAILS";

function toMoney(value: number, currency: string, fxRate = 1) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value * fxRate);
}

export function QuickExpenseForm({
  expenseCategories,
  savingsCategories,
  liveBalance,
  currency,
  fxRate,
  onAdded,
}: {
  expenseCategories: string[];
  savingsCategories: string[];
  liveBalance: number;
  currency: string;
  fxRate: number;
  onAdded?: (txn: OptimisticTxn) => void;
}) {
  const router = useRouter();
  const getLocalToday = () => new Date().toISOString().slice(0, 10);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("AMOUNT");
  const [flowMode, setFlowMode] = useState<FlowMode>("OUTFLOW");
  const [outflowKind, setOutflowKind] = useState<OutflowKind>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [customExpense, setCustomExpense] = useState("");
  const [memo, setMemo] = useState("");
  const [occurredAt, setOccurredAt] = useState(getLocalToday());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    if (flowMode !== "OUTFLOW") return [];
    if (outflowKind === "SAVINGS") return savingsCategories;
    if (outflowKind === "EXPENSE") return expenseCategories;
    return [];
  }, [expenseCategories, flowMode, outflowKind, savingsCategories]);

  useEffect(() => {
    if (flowMode !== "OUTFLOW" || outflowKind === "EXTRA_EXPENSE") {
      setCategory("");
      return;
    }
    if (category && !categoryOptions.includes(category)) {
      setCategory(categoryOptions[0] ?? "");
      return;
    }
    if (!category) {
      setCategory(categoryOptions[0] ?? "");
    }
  }, [category, categoryOptions, flowMode, outflowKind]);

  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const detailCategory =
    flowMode === "INCOME" ? null : outflowKind === "EXTRA_EXPENSE" ? customExpense.trim() : category;
  const canSave = amountValid && (flowMode === "INCOME" || (detailCategory ?? "").trim().length > 0);

  function startFlow(mode: FlowMode) {
    setMsg(null);
    setWizardOpen(true);
    setWizardStep("AMOUNT");
    setFlowMode(mode);
    setOutflowKind("EXPENSE");
    setCategory("");
    setCustomExpense("");
    setMemo("");
    setAmount("");
    setOccurredAt(getLocalToday());
  }

  function resetFlow() {
    setWizardOpen(false);
    setWizardStep("AMOUNT");
    setFlowMode("OUTFLOW");
    setOutflowKind("EXPENSE");
    setAmount("");
    setCategory("");
    setCustomExpense("");
    setMemo("");
    setOccurredAt(getLocalToday());
  }

  function nextStep() {
    if (wizardStep === "AMOUNT") {
      if (!amountValid) {
        setMsg("Enter a valid amount greater than 0.");
        return;
      }
      setWizardStep("KIND");
      return;
    }
    if (wizardStep === "KIND") {
      setWizardStep("DETAILS");
    }
  }

  function prevStep() {
    if (wizardStep === "DETAILS") {
      setWizardStep("KIND");
      return;
    }
    if (wizardStep === "KIND") {
      setWizardStep("AMOUNT");
    }
  }

  function saveEntry() {
    setMsg(null);
    if (!canSave) {
      setMsg("Complete the transaction details before saving.");
      return;
    }

    const occurredAtForSave = occurredAt && occurredAt !== getLocalToday() ? occurredAt : undefined;
    const txType = flowMode === "INCOME" ? "INCOME" : outflowKind === "SAVINGS" ? "SAVINGS" : "EXPENSE";
    // A planned expense logged against a real budget category is a BASELINE transaction so it
    // consumes that category's budget directly (not an off-budget extra). Everything else
    // (income, savings, custom-label spend) stays an EXTRA.
    const isPlannedExpense = flowMode === "OUTFLOW" && outflowKind === "EXPENSE";
    const extraType =
      flowMode === "INCOME"
        ? "EXTRA_INCOME"
        : outflowKind === "SAVINGS"
          ? "EXTRA_SAVINGS"
          : "EXTRA_EXPENSE";
    const resolvedCategory = (detailCategory ?? "").trim();

    start(async () => {
      try {
        await createQuickTransaction({
          kind: isPlannedExpense ? "BASELINE" : "EXTRA",
          type: txType,
          extraType: isPlannedExpense ? undefined : extraType,
          amount: parsedAmount,
          category: resolvedCategory || undefined,
          memo: memo.trim() || undefined,
          occurredAt: occurredAtForSave,
          recurring: false,
        });

        onAdded?.({
          id: `optimistic-${Date.now()}`,
          memo: memo.trim() || null,
          type: txType,
          amount: parsedAmount,
          occurredAt: occurredAt || new Date().toISOString(),
          category: resolvedCategory || null,
        });

        resetFlow();
        setMsg("Transaction saved.");
        toast.success("Transaction saved.");
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to save transaction.";
        setMsg(message);
        toast.error(message);
      }
    });
  }

  const stepLabel = wizardStep === "AMOUNT" ? "Step 1 of 3" : wizardStep === "KIND" ? "Step 2 of 3" : "Step 3 of 3";
  const negativePreview = flowMode === "INCOME" ? liveBalance + parsedAmount : liveBalance - (amountValid ? parsedAmount : 0);

  return (
    <div className="theme-card-accent rounded-3xl p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="kicker">Add transaction</p>
          <p className="text-sm font-semibold">Log income, expenses, extra savings, and extra spend with guided steps.</p>
          <p className="mt-1 text-xs text-black/60">The balance stays live from budget surplus plus extra income, spending, and savings.</p>
        </div>
        <div className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-left sm:w-auto sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.14em] text-black/45">Live balance</p>
          <p className={`mt-1 text-lg font-semibold ${liveBalance < 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {toMoney(liveBalance, currency, fxRate)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => startFlow("INCOME")} disabled={pending} className="w-full sm:w-auto">
          Add income
        </Button>
        <Button type="button" variant="outline" onClick={() => startFlow("OUTFLOW")} disabled={pending} className="w-full sm:w-auto">
          Add expense or savings
        </Button>
      </div>

      {wizardOpen ? (
        <section className="mt-4 rounded-[1.5rem] border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">{stepLabel}</p>
            <Button type="button" size="sm" variant="ghost" onClick={resetFlow} disabled={pending}>
              Cancel
            </Button>
          </div>

          {wizardStep === "AMOUNT" ? (
            <div className="mt-4 space-y-3">
              <label>
                <div className="text-xs font-medium text-black/60">Amount</div>
                <input
                  className="mt-1 h-12 w-full rounded-2xl border border-black/15 bg-white px-4 text-lg outline-none focus:ring-2 focus:ring-sky-300"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoFocus
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-black/65">
                  Current live balance
                  <p className={`mt-1 font-semibold ${liveBalance < 0 ? "text-rose-700" : "text-slate-900"}`}>{toMoney(liveBalance, currency, fxRate)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-black/65">
                  After this transaction
                  <p className={`mt-1 font-semibold ${negativePreview < 0 ? "text-rose-700" : "text-slate-900"}`}>
                    {toMoney(Number.isFinite(negativePreview) ? negativePreview : liveBalance, currency, fxRate)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-black/65">
                  Entry type
                  <p className="mt-1 font-semibold text-slate-900">{flowMode === "INCOME" ? "Income" : "Expense or savings"}</p>
                </div>
              </div>
            </div>
          ) : null}

          {wizardStep === "KIND" ? (
            <div className="mt-4 space-y-3">
              {flowMode === "INCOME" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <div className="text-xs font-medium text-black/60">Note (optional)</div>
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                      value={memo}
                      onChange={(event) => setMemo(event.target.value)}
                      placeholder="Salary, side gig, transfer..."
                    />
                  </label>

                  <label>
                    <div className="text-xs font-medium text-black/60">Date</div>
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                      type="date"
                      value={occurredAt}
                      onChange={(event) => setOccurredAt(event.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    {
                      id: "EXPENSE" as const,
                      title: "Expense",
                      text: "Use a planned expense category from your budget.",
                    },
                    {
                      id: "SAVINGS" as const,
                      title: "Extra savings",
                      text: "Log money moved into one of your savings categories.",
                    },
                    {
                      id: "EXTRA_EXPENSE" as const,
                      title: "Extra expense",
                      text: "Record off-budget spend with your own label.",
                    },
                  ]).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOutflowKind(item.id)}
                      className={`rounded-2xl border px-4 py-4 text-left ${outflowKind === item.id ? "border-sky-300 bg-sky-50 text-sky-900" : "border-black/10 hover:bg-black/[0.02]"}`}
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-black/60">{item.text}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {wizardStep === "DETAILS" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {flowMode === "INCOME" ? (
                <>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:col-span-2">
                    This income will be treated as extra income and added to your live balance immediately.
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-black/65">
                    Amount
                    <p className="mt-1 font-semibold text-slate-900">{toMoney(parsedAmount, currency, fxRate)}</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-black/65">
                    Date
                    <p className="mt-1 font-semibold text-slate-900">{occurredAt}</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-black/65 sm:col-span-2">
                    Note
                    <p className="mt-1 font-semibold text-slate-900">{memo.trim() || "No note added"}</p>
                  </div>
                </>
              ) : outflowKind === "EXTRA_EXPENSE" ? (
                <label className="sm:col-span-2">
                  <div className="text-xs font-medium text-black/60">What kind of extra expense is this?</div>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                    value={customExpense}
                    onChange={(event) => setCustomExpense(event.target.value)}
                    placeholder="Taxi, quick food, emergency cash, repairs..."
                  />
                </label>
              ) : (
                <label className="sm:col-span-2">
                  <div className="text-xs font-medium text-black/60">
                    Category ({outflowKind === "SAVINGS" ? "extra savings" : "expense"})
                  </div>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {categoryOptions.length === 0 ? <option value="">No categories yet</option> : null}
                    {categoryOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {flowMode === "OUTFLOW" ? (
                <>
                  <label>
                    <div className="text-xs font-medium text-black/60">Note (optional)</div>
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                      value={memo}
                      onChange={(event) => setMemo(event.target.value)}
                      placeholder="Any detail to remember"
                    />
                  </label>

                  <label>
                    <div className="text-xs font-medium text-black/60">Date</div>
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                      type="date"
                      value={occurredAt}
                      onChange={(event) => setOccurredAt(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {wizardStep !== "AMOUNT" ? (
              <Button type="button" variant="outline" onClick={prevStep} disabled={pending} className="w-full sm:w-auto">
                Back
              </Button>
            ) : null}
            {wizardStep !== "DETAILS" ? (
              <Button type="button" onClick={nextStep} disabled={pending || (wizardStep === "AMOUNT" && !amountValid)} className="w-full sm:w-auto">
                Continue
              </Button>
            ) : (
              <Button type="button" loading={pending} disabled={pending || !canSave} onClick={saveEntry} className="w-full sm:w-auto">
                {pending ? "Saving..." : "Save transaction"}
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {msg ? <p className="mt-3 text-sm text-black/70">{msg}</p> : null}
    </div>
  );
}
