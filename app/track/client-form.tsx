"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createQuickTransaction } from "./actions";
import {
  quickTransactionPosting,
  type QuickFlowMode,
  type QuickIncomeKind,
  type QuickOutflowKind,
} from "@/lib/finance/transaction-shape";

type OptimisticTxn = {
  id: string;
  memo: string | null;
  type: "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER";
  amount: number;
  occurredAt: Date | string;
  category: string | null;
};

type WizardStep = "AMOUNT" | "KIND" | "DETAILS";

function toMoney(value: number, currency: string, fxRate = 1) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value * fxRate);
}

type FormAccount = { id: string; name: string; isDefault: boolean };

export function QuickExpenseForm({
  expenseCategories,
  savingsCategories,
  accounts = [],
  liveBalance,
  currency,
  fxRate,
  onAdded,
}: {
  expenseCategories: string[];
  savingsCategories: string[];
  accounts?: FormAccount[];
  liveBalance: number;
  currency: string;
  fxRate: number;
  onAdded?: (txn: OptimisticTxn) => void;
}) {
  const router = useRouter();
  const getLocalToday = () => new Date().toISOString().slice(0, 10);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("AMOUNT");
  const [flowMode, setFlowMode] = useState<QuickFlowMode>("OUTFLOW");
  const [incomeKind, setIncomeKind] = useState<QuickIncomeKind>("REGULAR");
  const [outflowKind, setOutflowKind] = useState<QuickOutflowKind>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [customExpense, setCustomExpense] = useState("");
  const [memo, setMemo] = useState("");
  const [occurredAt, setOccurredAt] = useState(getLocalToday());
  const [accountId, setAccountId] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const showAccountPicker = accounts.length > 1;

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

  function startFlow(mode: QuickFlowMode) {
    setMsg(null);
    setWizardOpen(true);
    setWizardStep("AMOUNT");
    setFlowMode(mode);
    setIncomeKind("REGULAR");
    setOutflowKind("EXPENSE");
    setCategory("");
    setCustomExpense("");
    setMemo("");
    setAmount("");
    setOccurredAt(getLocalToday());
    setAccountId("");
  }

  function resetFlow() {
    setWizardOpen(false);
    setWizardStep("AMOUNT");
    setFlowMode("OUTFLOW");
    setIncomeKind("REGULAR");
    setOutflowKind("EXPENSE");
    setAmount("");
    setCategory("");
    setCustomExpense("");
    setMemo("");
    setOccurredAt(getLocalToday());
    setAccountId("");
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
    const posting = quickTransactionPosting({ flowMode, incomeKind, outflowKind });
    const resolvedCategory = (detailCategory ?? "").trim();

    start(async () => {
      try {
        await createQuickTransaction({
          kind: posting.kind,
          type: posting.type,
          extraType: posting.extraType,
          amount: parsedAmount,
          category: resolvedCategory || undefined,
          memo: memo.trim() || undefined,
          accountId: accountId || undefined,
          occurredAt: occurredAtForSave,
          recurring: false,
        });

        onAdded?.({
          id: `optimistic-${Date.now()}`,
          memo: memo.trim() || null,
          type: posting.type,
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
  const negativePreview = liveBalance - (amountValid ? parsedAmount : 0);

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
                {flowMode === "OUTFLOW" ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-black/65">
                    After this transaction
                    <p className={`mt-1 font-semibold ${negativePreview < 0 ? "text-rose-700" : "text-slate-900"}`}>
                      {toMoney(Number.isFinite(negativePreview) ? negativePreview : liveBalance, currency, fxRate)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-black/65">
                    Income treatment
                    <p className="mt-1 font-semibold text-slate-900">Choose regular or extra next</p>
                  </div>
                )}
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
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIncomeKind("REGULAR")}
                    className={`rounded-2xl border px-4 py-4 text-left ${incomeKind === "REGULAR" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-black/10 hover:bg-black/[0.02]"}`}
                  >
                    <p className="font-semibold">Regular income</p>
                    <p className="mt-1 text-xs text-black/60">Salary or pay already included in your budget. It replaces the plan amount instead of doubling it.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomeKind("EXTRA")}
                    className={`rounded-2xl border px-4 py-4 text-left ${incomeKind === "EXTRA" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-black/10 hover:bg-black/[0.02]"}`}
                  >
                    <p className="font-semibold">Extra income</p>
                    <p className="mt-1 text-xs text-black/60">Bonus, gift, side gig, or other money that should be added on top of your plan.</p>
                  </button>
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
                    {incomeKind === "REGULAR"
                      ? "This regular income will reconcile with your planned income, so logging your salary will not double it."
                      : "This extra income will be added on top of your planned income."}
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-black/65">
                    Amount
                    <p className="mt-1 font-semibold text-slate-900">{toMoney(parsedAmount, currency, fxRate)}</p>
                  </div>
                  <label>
                    <div className="text-xs font-medium text-black/60">Date</div>
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                      type="date"
                      value={occurredAt}
                      onChange={(event) => setOccurredAt(event.target.value)}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <div className="text-xs font-medium text-black/60">Note (optional)</div>
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                      value={memo}
                      onChange={(event) => setMemo(event.target.value)}
                      placeholder="Salary, bonus, side gig..."
                    />
                  </label>
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

              {showAccountPicker ? (
                <label className="sm:col-span-2">
                  <div className="text-xs font-medium text-black/60">Account</div>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-black/15 bg-white px-3"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.isDefault ? "" : account.id}>
                        {account.name}
                        {account.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
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
