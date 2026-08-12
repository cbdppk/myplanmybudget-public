"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  updateBudgetPlan,
  updateBudgetPreferences,
} from "../actions";
import { HelpTip } from "../_components/help-tip";
import { normalizeToMonthly, type MoneyCadence } from "@/lib/money/frequency";

type BudgetCategoryItem = {
  id: string;
  name: string;
  kind: string;
  amount: number;
  cadence: MoneyCadence;
  enteredAmount: number;
};

type BudgetRow = BudgetCategoryItem & { amountText: string };

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function cadenceLabel(value: MoneyCadence) {
  return value.toLowerCase();
}

function messageTone(message: string | null) {
  if (!message) return null;
  const text = message.toLowerCase();
  if (
    text.includes("saved") ||
    text.includes("added") ||
    text.includes("archived") ||
    text.includes("deleted")
  ) {
    return "success";
  }
  if (
    text.includes("re-authenticate") ||
    text.includes("security") ||
    text.includes("refresh") ||
    text.includes("wait and try again") ||
    text.includes("session expired")
  ) {
    return "warning";
  }
  return "error";
}

export function BudgetSettingsForm({
  initialCurrency,
  currencyOptions,
  initialBudget,
}: {
  initialCurrency: string;
  currencyOptions: string[];
  initialBudget: {
    baselineIncome: number;
    baselineExpense: number;
    baselineSavings: number;
    dailySpendEstimate: number;
    dailyEstimateAuto: boolean;
    incomeFrequency: string;
    budgetStartMode: string;
    blockExtrasWhenSurplusNegative: boolean;
    showSimulationSuggestion: boolean;
    updatedAt: string;
    daysInPeriod: number;
    categories: BudgetCategoryItem[];
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [currency, setCurrency] = useState(initialCurrency);
  const [incomeFrequency, setIncomeFrequency] = useState(initialBudget.incomeFrequency as MoneyCadence);
  const [budgetStartMode, setBudgetStartMode] = useState(initialBudget.budgetStartMode);
  const [blockExtras, setBlockExtras] = useState(initialBudget.blockExtrasWhenSurplusNegative);
  const [showSimulationSuggestion, setShowSimulationSuggestion] = useState(initialBudget.showSimulationSuggestion);
  const [profileVersion, setProfileVersion] = useState(initialBudget.updatedAt);
  const [baselineIncome, setBaselineIncome] = useState(initialBudget.baselineIncome.toFixed(2));
  const [baselineExpense, setBaselineExpense] = useState(initialBudget.baselineExpense.toFixed(2));
  const [baselineSavings, setBaselineSavings] = useState(initialBudget.baselineSavings.toFixed(2));
  const [avgExpensePerCycle, setAvgExpensePerCycle] = useState("");
  const [avgSavingsPerCycle, setAvgSavingsPerCycle] = useState("");
  const [monthlyBills, setMonthlyBills] = useState("");
  const [editingBehavior, setEditingBehavior] = useState(false);
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [editingAllocations, setEditingAllocations] = useState(false);
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newSavingsCategory, setNewSavingsCategory] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSavingsForm, setShowSavingsForm] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [categoryAction, setCategoryAction] = useState<{ id: string; kind: "archive" | "delete" } | null>(null);
  const [rows, setRows] = useState<BudgetRow[]>(
    initialBudget.categories.map((item) => ({ ...item, amountText: item.enteredAmount.toFixed(2) }))
  );
  const newExpenseCategoryRef = useRef<HTMLDivElement>(null);
  const newSavingsCategoryRef = useRef<HTMLDivElement>(null);

  const daysInMonth = initialBudget.daysInPeriod;

  useEffect(() => {
    setRows((prev) => prev.map((row) => ({ ...row, cadence: incomeFrequency })));
  }, [incomeFrequency]);

  useEffect(() => {
    setCurrency(initialCurrency);
  }, [initialCurrency]);

  useEffect(() => {
    setIncomeFrequency(initialBudget.incomeFrequency as MoneyCadence);
    setBudgetStartMode(initialBudget.budgetStartMode);
    setBlockExtras(initialBudget.blockExtrasWhenSurplusNegative);
    setShowSimulationSuggestion(initialBudget.showSimulationSuggestion);
    setProfileVersion(initialBudget.updatedAt);
    setBaselineIncome(initialBudget.baselineIncome.toFixed(2));
    setBaselineExpense(initialBudget.baselineExpense.toFixed(2));
    setBaselineSavings(initialBudget.baselineSavings.toFixed(2));
    setRows(initialBudget.categories.map((item) => ({ ...item, amountText: item.enteredAmount.toFixed(2) })));
  }, [initialBudget]);

  const expenseRows = useMemo(() => rows.filter((item) => item.kind === "expense"), [rows]);
  const savingsRows = useMemo(() => rows.filter((item) => item.kind === "savings"), [rows]);
  const expenseMonthlyTotal = useMemo(
    () => expenseRows.reduce((sum, item) => sum + normalizeToMonthly(Number(item.amountText) || 0, item.cadence, daysInMonth), 0),
    [daysInMonth, expenseRows]
  );
  const savingsMonthlyTotal = useMemo(
    () => savingsRows.reduce((sum, item) => sum + normalizeToMonthly(Number(item.amountText) || 0, item.cadence, daysInMonth), 0),
    [daysInMonth, savingsRows]
  );
  const incomeMonthlyEquivalent = useMemo(
    () => normalizeToMonthly(Number(baselineIncome) || 0, incomeFrequency, daysInMonth),
    [baselineIncome, daysInMonth, incomeFrequency]
  );
  const expenseRemaining = round2((Number(baselineExpense) || 0) - expenseMonthlyTotal);
  const savingsRemaining = round2((Number(baselineSavings) || 0) - savingsMonthlyTotal);
  const expenseOver = expenseRemaining < 0;
  const savingsOver = savingsRemaining < 0;
  const allocationsValid = !expenseOver && !savingsOver;
  const isSmartMode = incomeFrequency !== "MONTHLY";

  function derivedDailyEstimate() {
    const expenseBase = Number(baselineExpense) || 0;
    return round2(expenseBase / Math.max(1, daysInMonth));
  }

  async function saveBudgetPlan(successMessage: string) {
    if (!allocationsValid) {
      const msg = "Allocation exceeds baseline. Reduce category totals before saving.";
      setMessage(msg);
      toast.error(msg);
      return false;
    }
    const result = await updateBudgetPlan({
      baselineIncome: normalizeToMonthly(Number(baselineIncome) || 0, incomeFrequency, daysInMonth),
      baselineExpense: Number(baselineExpense) || 0,
      baselineSavings: Number(baselineSavings) || 0,
      dailySpendEstimate: derivedDailyEstimate(),
      expectedUpdatedAt: profileVersion,
      items: rows.map((row) => ({
        categoryId: row.id,
        amount: round2(Number(row.amountText) || 0),
        cadence: row.cadence,
      })),
    });
    if (!result.ok) {
      setMessage(result.error);
      toast.error(result.error ?? "Save failed.");
      return false;
    }
    if (result.data?.updatedAt) setProfileVersion(result.data.updatedAt);
    setMessage(successMessage);
    toast.success(successMessage);
    router.refresh();
    return true;
  }

  function handleUnexpectedError(error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed.";
    setMessage(msg);
    toast.error(msg);
  }

  async function handleCreateCategory(kind: "expense" | "savings", value: string, successMessage: string) {
    const result = await createCategory({ name: value, kind });
    if (!result.ok) {
      setMessage(result.error);
      toast.error(result.error ?? "Failed to create category.");
      return false;
    }
    setMessage(successMessage);
    toast.success(successMessage);
    // Optimistically add the new row so the UI updates immediately.
    const newCat = result.data?.category;
    if (newCat) {
      const newRow: BudgetRow = {
        id: newCat.id,
        name: newCat.name,
        kind: newCat.kind,
        amount: 0,
        cadence: incomeFrequency,
        enteredAmount: 0,
        amountText: "0.00",
      };
      setRows((prev) => [...prev, newRow]);
      // Expand collapsible and scroll to new row.
      if (kind === "expense") {
        setExpenseOpen(true);
        setTimeout(() => newExpenseCategoryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
      } else {
        setSavingsOpen(true);
        setTimeout(() => newSavingsCategoryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
      }
    }
    router.refresh();
    return true;
  }

  async function handleArchiveCategory(categoryId: string) {
    const result = await archiveCategory(categoryId);
    if (!result.ok) {
      setMessage(result.error);
      toast.error(result.error ?? "Failed to archive category.");
      return false;
    }
    setMessage("Category archived.");
    toast.success("Category archived.");
    setRows((prev) => prev.filter((r) => r.id !== categoryId));
    router.refresh();
    return true;
  }

  async function handleDeleteCategory(categoryId: string) {
    const result = await deleteCategory(categoryId);
    if (!result.ok) {
      setMessage(result.error);
      toast.error(result.error ?? "Failed to delete category.");
      return false;
    }
    setMessage("Category deleted.");
    toast.success("Category deleted.");
    setRows((prev) => prev.filter((r) => r.id !== categoryId));
    router.refresh();
    return true;
  }

  const notificationTone = messageTone(message);
  const messageClass =
    notificationTone === "success"
      ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800/40 dark:text-emerald-400"
      : notificationTone === "warning"
        ? "border-amber-300/60 bg-amber-500/10 text-amber-800 dark:border-amber-700/40 dark:text-amber-300"
        : "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-800/40 dark:text-rose-400";
  const showSecurityLink = (message ?? "").toLowerCase().includes("security");
  const showRefreshButton = (message ?? "").toLowerCase().includes("refresh");

  return (
    <div className="space-y-4">
      {message ? (
        <section className={`rounded-2xl border px-4 py-3 text-sm ${messageClass}`}>
          <p>{message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {showSecurityLink ? (
              <Link
                href="/settings/security"
                className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold [border-color:var(--border)] bg-[color:var(--card-bg)] text-[color:var(--text-primary)] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              >
                Go to Security &amp; verify →
              </Link>
            ) : null}
            {showRefreshButton ? (
              <Button size="sm" variant="outline" onClick={() => router.refresh()}>
                Refresh
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Budget behavior</h2>
            <HelpTip text="These controls define the app-wide baseline interpretation for budget pacing, surplus guards, and period defaults." />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {editingBehavior ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditingBehavior(false)}>
                Cancel
              </Button>
            ) : null}
            <Button size="sm" variant={editingBehavior ? "default" : "outline"} disabled={pending} onClick={() => setEditingBehavior((prev) => !prev)}>
              {editingBehavior ? "Editing" : "Edit"}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Global preferences used by Budget, Transactions, Dashboard, and Goals.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-[color:var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              Income frequency
              <HelpTip text="Changing this automatically syncs category cadence so the whole budget model stays aligned." />
            </span>
            <select className="mt-1 h-10 w-full rounded-xl border [border-color:var(--border)] px-3 text-sm bg-[color:var(--card-bg)] disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04]" disabled={!editingBehavior} value={incomeFrequency} onChange={(e) => setIncomeFrequency(e.target.value as MoneyCadence)}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          <label className="text-xs text-[color:var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              Budget starts
              <HelpTip text="This is chosen during initial setup and then locked so existing periods and carry-forward history are not re-bucketed." />
            </span>
            <select className="mt-1 h-10 w-full rounded-xl border [border-color:var(--border)] px-3 text-sm bg-[color:var(--card-bg)] disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04]" disabled value={budgetStartMode} onChange={(e) => setBudgetStartMode(e.target.value)}>
              <option value="CURRENT_MONTH">Current month</option>
              <option value="NEXT_MONTH">Next month</option>
            </select>
          </label>
          <label className="text-xs text-[color:var(--text-secondary)]">
            Currency
            <select className="mt-1 h-10 w-full rounded-xl border [border-color:var(--border)] px-3 uppercase text-sm bg-[color:var(--card-bg)] disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04]" disabled={!editingBehavior} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())}>
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-[color:var(--text-secondary)]">Month start day is automatic and follows the current date.</p>
        <div className="mt-3 grid gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" disabled={!editingBehavior} checked={blockExtras} onChange={(e) => setBlockExtras(e.target.checked)} />
            Block extra expense/savings when surplus is negative
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" disabled={!editingBehavior} checked={showSimulationSuggestion} onChange={(e) => setShowSimulationSuggestion(e.target.checked)} />
            Show simulation suggestion when blocked
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button
            loading={pending}
            disabled={pending || !editingBehavior}
            onClick={() => {
              setMessage(null);
              start(async () => {
                try {
                  const result = await updateBudgetPreferences({
                    preferredCurrency: currency,
                    incomeFrequency,
                    budgetStartMode: budgetStartMode as "CURRENT_MONTH" | "NEXT_MONTH",
                    blockExtrasWhenSurplusNegative: blockExtras,
                    showSimulationSuggestion,
                    dailyEstimateAuto: true,
                    dailySpendEstimate: derivedDailyEstimate(),
                    expectedUpdatedAt: profileVersion,
                  });
                  if (!result.ok) {
                    setMessage(result.error);
                    toast.error(result.error ?? "Save failed.");
                    return;
                  }
                  if (result.data?.updatedAt) setProfileVersion(result.data.updatedAt);
                  setMessage("Budget behavior settings saved.");
                  toast.success("Budget behavior settings saved.");
                  setEditingBehavior(false);
                  router.refresh();
                } catch (error) {
                  handleUnexpectedError(error);
                }
              });
            }}
          >
            Save behavior
          </Button>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Baseline budget</h3>
            <HelpTip text="After you save, this becomes your fixed budget total. Category allocations must stay within these amounts." />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {editingBaseline ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditingBaseline(false)}>
                Cancel
              </Button>
            ) : null}
            <Button size="sm" variant={editingBaseline ? "default" : "outline"} disabled={pending} onClick={() => setEditingBaseline((prev) => !prev)}>
              {editingBaseline ? "Editing" : "Edit"}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Your fixed monthly budget total. Expense and savings categories must stay within these amounts.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-[color:var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              Income amount ({cadenceLabel(incomeFrequency)})
              <HelpTip text="Income is entered in your selected frequency and normalized to monthly value automatically." />
            </span>
            <input className="mt-1 h-10 w-full rounded-xl border [border-color:var(--border)] px-3 text-sm bg-[color:var(--card-bg)] disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04]" disabled={!editingBaseline} value={baselineIncome} onChange={(e) => setBaselineIncome(e.target.value)} />
            <span className="mt-1 block text-[11px] text-[color:var(--text-muted)]">Monthly equivalent: {incomeMonthlyEquivalent.toFixed(2)}</span>
          </label>
          <label className="text-xs text-[color:var(--text-secondary)]">
            Monthly expenditure baseline
            <input className="mt-1 h-10 w-full rounded-xl border [border-color:var(--border)] px-3 text-sm bg-[color:var(--card-bg)] disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04]" disabled={!editingBaseline} value={baselineExpense} onChange={(e) => setBaselineExpense(e.target.value)} />
          </label>
          <label className="text-xs text-[color:var(--text-secondary)]">
            Monthly savings baseline
            <input className="mt-1 h-10 w-full rounded-xl border [border-color:var(--border)] px-3 text-sm bg-[color:var(--card-bg)] disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04]" disabled={!editingBaseline} value={baselineSavings} onChange={(e) => setBaselineSavings(e.target.value)} />
          </label>
        </div>
        {isSmartMode ? (
          <article className="mt-4 rounded-xl border border-sky-300/60 bg-sky-500/[0.07] dark:border-sky-800/40 p-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-sky-900">Smart baseline helper</p>
              <HelpTip text="For daily/weekly earners: estimate monthly expense and savings from per-cycle averages + fixed monthly bills." />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-xs text-sky-900/80">
                Avg expense ({cadenceLabel(incomeFrequency)})
                <input className="mt-1 h-9 w-full rounded-xl border border-sky-200 bg-[color:var(--card-bg)] px-3 text-sm disabled:bg-black/[0.06] dark:disabled:bg-white/[0.06]" disabled={!editingBaseline} value={avgExpensePerCycle} onChange={(e) => setAvgExpensePerCycle(e.target.value)} />
              </label>
              <label className="text-xs text-sky-900/80">
                Avg savings ({cadenceLabel(incomeFrequency)})
                <input className="mt-1 h-9 w-full rounded-xl border border-sky-200 bg-[color:var(--card-bg)] px-3 text-sm disabled:bg-black/[0.06] dark:disabled:bg-white/[0.06]" disabled={!editingBaseline} value={avgSavingsPerCycle} onChange={(e) => setAvgSavingsPerCycle(e.target.value)} />
              </label>
              <label className="text-xs text-sky-900/80">
                Fixed monthly bills
                <input className="mt-1 h-9 w-full rounded-xl border border-sky-200 bg-[color:var(--card-bg)] px-3 text-sm disabled:bg-black/[0.06] dark:disabled:bg-white/[0.06]" disabled={!editingBaseline} value={monthlyBills} onChange={(e) => setMonthlyBills(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!editingBaseline}
                onClick={() => {
                  const expenseMonthly = normalizeToMonthly(Number(avgExpensePerCycle) || 0, incomeFrequency, daysInMonth) + (Number(monthlyBills) || 0);
                  const savingsMonthly = normalizeToMonthly(Number(avgSavingsPerCycle) || 0, incomeFrequency, daysInMonth);
                  setBaselineExpense(round2(expenseMonthly).toFixed(2));
                  setBaselineSavings(round2(savingsMonthly).toFixed(2));
                }}
              >
                Apply smart totals
              </Button>
              <p className="text-xs text-sky-900/80">Daily estimate is auto-derived from baseline expenditure.</p>
            </div>
          </article>
        ) : null}
        {!allocationsValid ? <p className="mt-2 text-xs font-semibold text-rose-700">Category allocations exceed the baseline. Reduce category totals before saving.</p> : null}
        {editingBaseline && (
          <div className="mt-4">
            <Button
              className="w-full sm:w-auto"
              loading={pending}
              disabled={pending || !allocationsValid}
              onClick={() => {
                setMessage(null);
                start(async () => {
                  try {
                    const saved = await saveBudgetPlan("Baseline budget saved.");
                    if (!saved) return;
                    setEditingBaseline(false);
                  } catch (error) {
                    handleUnexpectedError(error);
                  }
                });
              }}
            >
              Save baseline budget
            </Button>
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Category allocations</h3>
            <HelpTip text="Set category amounts in the same cadence as your income frequency. All rows are synced automatically when frequency changes." />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {editingAllocations ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => {
                setEditingAllocations(false);
                setShowExpenseForm(false);
                setShowSavingsForm(false);
                setNewExpenseCategory("");
                setNewSavingsCategory("");
              }}>
                Cancel
              </Button>
            ) : null}
            <Button size="sm" variant={editingAllocations ? "default" : "outline"} disabled={pending} onClick={() => {
              setEditingAllocations((prev) => !prev);
              setShowExpenseForm(false);
              setShowSavingsForm(false);
              setNewExpenseCategory("");
              setNewSavingsCategory("");
            }}>
              {editingAllocations ? "Editing" : "Edit"}
            </Button>
          </div>
        </div>
        <div className="mt-3 space-y-4">
          <article className={`rounded-xl border p-3 ${expenseOver ? "border-rose-300 bg-rose-50/40" : "[border-color:var(--border)]"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Expense categories</p>
              <button
                type="button"
                title="Add expense category"
                disabled={!editingAllocations}
                onClick={() => { setShowExpenseForm((v) => !v); setNewExpenseCategory(""); }}
                className="flex h-7 w-7 items-center justify-center rounded-full border [border-color:var(--border)] text-[color:var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
              Remaining from baseline: {expenseRemaining.toFixed(2)} {expenseOver ? "(over allocation)" : ""}
            </p>
            <div className="mt-2 space-y-2">
              {expenseRows.slice(0, 5).map((row) => {
                const index = rows.findIndex((item) => item.id === row.id);
                const rowMonthly = normalizeToMonthly(Number(row.amountText) || 0, row.cadence, daysInMonth);
                return (
                  <article key={row.id} className="rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{row.name}</p>
                      <p className="text-[11px] text-[color:var(--text-secondary)]">Uses expense baseline</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Monthly equivalent: {rowMonthly.toFixed(2)}</p>
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <input
                          className="h-9 min-w-0 flex-1 rounded-xl border [border-color:var(--border)] px-3 text-sm"
                          value={row.amountText}
                          disabled={!editingAllocations}
                          onChange={(e) => {
                            const next = [...rows];
                            next[index] = { ...next[index], amountText: e.target.value };
                            setRows(next);
                          }}
                        />
                        <select
                          className="h-9 w-28 flex-shrink-0 rounded-xl border [border-color:var(--border)] px-2 text-sm"
                          value={row.cadence}
                          disabled={!editingAllocations}
                          onChange={(e) => {
                            const next = [...rows];
                            next[index] = { ...next[index], cadence: e.target.value as MoneyCadence };
                            setRows(next);
                          }}
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={pending && categoryAction?.id === row.id && categoryAction.kind === "archive"}
                          disabled={pending || !editingAllocations}
                          onClick={() => {
                            setMessage(null);
                            setCategoryAction({ id: row.id, kind: "archive" });
                            start(async () => {
                              try {
                                await handleArchiveCategory(row.id);
                              } catch (error) {
                                handleUnexpectedError(error);
                              } finally {
                                setCategoryAction(null);
                              }
                            });
                          }}
                        >
                          Archive
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={pending && categoryAction?.id === row.id && categoryAction.kind === "delete"}
                          disabled={pending || !editingAllocations}
                          onClick={() => {
                            if (!window.confirm(`Delete "${row.name}" category? This cannot be undone.`)) return;
                            setMessage(null);
                            setCategoryAction({ id: row.id, kind: "delete" });
                            start(async () => {
                              try {
                                await handleDeleteCategory(row.id);
                              } catch (error) {
                                handleUnexpectedError(error);
                              } finally {
                                setCategoryAction(null);
                              }
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {expenseRows.length > 5 ? (
                <Collapsible open={expenseOpen} onOpenChange={setExpenseOpen}>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {expenseRows.slice(5).map((row) => {
                      const index = rows.findIndex((item) => item.id === row.id);
                      const rowMonthly = normalizeToMonthly(Number(row.amountText) || 0, row.cadence, daysInMonth);
                      return (
                        <article key={row.id} className="rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">{row.name}</p>
                            <p className="text-[11px] text-[color:var(--text-secondary)]">Uses expense baseline</p>
                          </div>
                          <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Monthly equivalent: {rowMonthly.toFixed(2)}</p>
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <input
                                className="h-9 min-w-0 flex-1 rounded-xl border [border-color:var(--border)] px-3 text-sm"
                                value={row.amountText}
                                disabled={!editingAllocations}
                                onChange={(e) => {
                                  const next = [...rows];
                                  next[index] = { ...next[index], amountText: e.target.value };
                                  setRows(next);
                                }}
                              />
                              <select
                                className="h-9 w-28 flex-shrink-0 rounded-xl border [border-color:var(--border)] px-2 text-sm"
                                value={row.cadence}
                                disabled={!editingAllocations}
                                onChange={(e) => {
                                  const next = [...rows];
                                  next[index] = { ...next[index], cadence: e.target.value as MoneyCadence };
                                  setRows(next);
                                }}
                              >
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                loading={pending && categoryAction?.id === row.id && categoryAction.kind === "archive"}
                                disabled={pending || !editingAllocations}
                                onClick={() => {
                                  setMessage(null);
                                  setCategoryAction({ id: row.id, kind: "archive" });
                                  start(async () => {
                                    try {
                                      await handleArchiveCategory(row.id);
                                    } catch (error) {
                                      handleUnexpectedError(error);
                                    } finally {
                                      setCategoryAction(null);
                                    }
                                  });
                                }}
                              >
                                Archive
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                loading={pending && categoryAction?.id === row.id && categoryAction.kind === "delete"}
                                disabled={pending || !editingAllocations}
                                onClick={() => {
                                  if (!window.confirm(`Delete "${row.name}" category? This cannot be undone.`)) return;
                                  setMessage(null);
                                  setCategoryAction({ id: row.id, kind: "delete" });
                                  start(async () => {
                                    try {
                                      await handleDeleteCategory(row.id);
                                    } catch (error) {
                                      handleUnexpectedError(error);
                                    } finally {
                                      setCategoryAction(null);
                                    }
                                  });
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </CollapsibleContent>
                  <CollapsibleTrigger className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800">
                    {expenseOpen ? "Show less" : `Show all categories (${expenseRows.length})`}
                    {expenseOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                </Collapsible>
              ) : null}
            </div>
            {showExpenseForm && editingAllocations && (
              <div className="mt-2 flex gap-2" ref={newExpenseCategoryRef}>
                <input
                  autoFocus
                  className="h-9 min-w-0 flex-1 rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="Category name"
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = newExpenseCategory.trim();
                      if (!value) return;
                      setMessage(null);
                      start(async () => {
                        try {
                          const created = await handleCreateCategory("expense", value, "Expense category added.");
                          if (!created) return;
                          setNewExpenseCategory("");
                          setShowExpenseForm(false);
                        } catch (error) { handleUnexpectedError(error); }
                      });
                    }
                    if (e.key === "Escape") { setShowExpenseForm(false); setNewExpenseCategory(""); }
                  }}
                />
                <Button
                  size="sm"
                  loading={pending}
                  disabled={pending || !newExpenseCategory.trim()}
                  onClick={() => {
                    const value = newExpenseCategory.trim();
                    if (!value) return;
                    setMessage(null);
                    start(async () => {
                      try {
                        const created = await handleCreateCategory("expense", value, "Expense category added.");
                        if (!created) return;
                        setNewExpenseCategory("");
                        setShowExpenseForm(false);
                      } catch (error) { handleUnexpectedError(error); }
                    });
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </article>

          <article className={`rounded-xl border p-3 ${savingsOver ? "border-rose-300 bg-rose-50/40" : "[border-color:var(--border)]"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Savings categories</p>
              <button
                type="button"
                title="Add savings category"
                disabled={!editingAllocations}
                onClick={() => { setShowSavingsForm((v) => !v); setNewSavingsCategory(""); }}
                className="flex h-7 w-7 items-center justify-center rounded-full border [border-color:var(--border)] text-[color:var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
              Remaining from baseline: {savingsRemaining.toFixed(2)} {savingsOver ? "(over allocation)" : ""}
            </p>
            <div className="mt-2 space-y-2">
              {savingsRows.slice(0, 5).map((row) => {
                const index = rows.findIndex((item) => item.id === row.id);
                const rowMonthly = normalizeToMonthly(Number(row.amountText) || 0, row.cadence, daysInMonth);
                return (
                  <article key={row.id} className="rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{row.name}</p>
                      <p className="text-[11px] text-[color:var(--text-secondary)]">Uses savings baseline</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Monthly equivalent: {rowMonthly.toFixed(2)}</p>
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <input
                          className="h-9 min-w-0 flex-1 rounded-xl border [border-color:var(--border)] px-3 text-sm"
                          value={row.amountText}
                          disabled={!editingAllocations}
                          onChange={(e) => {
                            const next = [...rows];
                            next[index] = { ...next[index], amountText: e.target.value };
                            setRows(next);
                          }}
                        />
                        <select
                          className="h-9 w-28 flex-shrink-0 rounded-xl border [border-color:var(--border)] px-2 text-sm"
                          value={row.cadence}
                          disabled={!editingAllocations}
                          onChange={(e) => {
                            const next = [...rows];
                            next[index] = { ...next[index], cadence: e.target.value as MoneyCadence };
                            setRows(next);
                          }}
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={pending && categoryAction?.id === row.id && categoryAction.kind === "archive"}
                          disabled={pending || !editingAllocations}
                          onClick={() => {
                            setMessage(null);
                            setCategoryAction({ id: row.id, kind: "archive" });
                            start(async () => {
                              try {
                                await handleArchiveCategory(row.id);
                              } catch (error) {
                                handleUnexpectedError(error);
                              } finally {
                                setCategoryAction(null);
                              }
                            });
                          }}
                        >
                          Archive
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={pending && categoryAction?.id === row.id && categoryAction.kind === "delete"}
                          disabled={pending || !editingAllocations}
                          onClick={() => {
                            if (!window.confirm(`Delete "${row.name}" category? This cannot be undone.`)) return;
                            setMessage(null);
                            setCategoryAction({ id: row.id, kind: "delete" });
                            start(async () => {
                              try {
                                await handleDeleteCategory(row.id);
                              } catch (error) {
                                handleUnexpectedError(error);
                              } finally {
                                setCategoryAction(null);
                              }
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {savingsRows.length > 5 ? (
                <Collapsible open={savingsOpen} onOpenChange={setSavingsOpen}>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {savingsRows.slice(5).map((row) => {
                      const index = rows.findIndex((item) => item.id === row.id);
                      const rowMonthly = normalizeToMonthly(Number(row.amountText) || 0, row.cadence, daysInMonth);
                      return (
                        <article key={row.id} className="rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">{row.name}</p>
                            <p className="text-[11px] text-[color:var(--text-secondary)]">Uses savings baseline</p>
                          </div>
                          <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Monthly equivalent: {rowMonthly.toFixed(2)}</p>
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <input
                                className="h-9 min-w-0 flex-1 rounded-xl border [border-color:var(--border)] px-3 text-sm"
                                value={row.amountText}
                                disabled={!editingAllocations}
                                onChange={(e) => {
                                  const next = [...rows];
                                  next[index] = { ...next[index], amountText: e.target.value };
                                  setRows(next);
                                }}
                              />
                              <select
                                className="h-9 w-28 flex-shrink-0 rounded-xl border [border-color:var(--border)] px-2 text-sm"
                                value={row.cadence}
                                disabled={!editingAllocations}
                                onChange={(e) => {
                                  const next = [...rows];
                                  next[index] = { ...next[index], cadence: e.target.value as MoneyCadence };
                                  setRows(next);
                                }}
                              >
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                loading={pending && categoryAction?.id === row.id && categoryAction.kind === "archive"}
                                disabled={pending || !editingAllocations}
                                onClick={() => {
                                  setMessage(null);
                                  setCategoryAction({ id: row.id, kind: "archive" });
                                  start(async () => {
                                    try {
                                      await handleArchiveCategory(row.id);
                                    } catch (error) {
                                      handleUnexpectedError(error);
                                    } finally {
                                      setCategoryAction(null);
                                    }
                                  });
                                }}
                              >
                                Archive
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                loading={pending && categoryAction?.id === row.id && categoryAction.kind === "delete"}
                                disabled={pending || !editingAllocations}
                                onClick={() => {
                                  if (!window.confirm(`Delete "${row.name}" category? This cannot be undone.`)) return;
                                  setMessage(null);
                                  setCategoryAction({ id: row.id, kind: "delete" });
                                  start(async () => {
                                    try {
                                      await handleDeleteCategory(row.id);
                                    } catch (error) {
                                      handleUnexpectedError(error);
                                    } finally {
                                      setCategoryAction(null);
                                    }
                                  });
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </CollapsibleContent>
                  <CollapsibleTrigger className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800">
                    {savingsOpen ? "Show less" : `Show all categories (${savingsRows.length})`}
                    {savingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                </Collapsible>
              ) : null}
            </div>
            {showSavingsForm && editingAllocations && (
              <div className="mt-2 flex gap-2" ref={newSavingsCategoryRef}>
                <input
                  autoFocus
                  className="h-9 min-w-0 flex-1 rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="Category name"
                  value={newSavingsCategory}
                  onChange={(e) => setNewSavingsCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = newSavingsCategory.trim();
                      if (!value) return;
                      setMessage(null);
                      start(async () => {
                        try {
                          const created = await handleCreateCategory("savings", value, "Savings category added.");
                          if (!created) return;
                          setNewSavingsCategory("");
                          setShowSavingsForm(false);
                        } catch (error) { handleUnexpectedError(error); }
                      });
                    }
                    if (e.key === "Escape") { setShowSavingsForm(false); setNewSavingsCategory(""); }
                  }}
                />
                <Button
                  size="sm"
                  loading={pending}
                  disabled={pending || !newSavingsCategory.trim()}
                  onClick={() => {
                    const value = newSavingsCategory.trim();
                    if (!value) return;
                    setMessage(null);
                    start(async () => {
                      try {
                        const created = await handleCreateCategory("savings", value, "Savings category added.");
                        if (!created) return;
                        setNewSavingsCategory("");
                        setShowSavingsForm(false);
                      } catch (error) { handleUnexpectedError(error); }
                    });
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </article>
        </div>
        {!allocationsValid ? <p className="mt-2 text-xs font-semibold text-rose-700">Category totals exceed the baseline. Reduce amounts before saving.</p> : null}
        {editingAllocations && (
          <div className="mt-4">
            <Button
              className="w-full sm:w-auto"
              loading={pending}
              disabled={pending || !allocationsValid}
              onClick={() => {
                setMessage(null);
                start(async () => {
                  try {
                    const saved = await saveBudgetPlan("Category allocations saved.");
                    if (!saved) return;
                    setEditingAllocations(false);
                  } catch (error) {
                    handleUnexpectedError(error);
                  }
                });
              }}
            >
              Save allocations
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
