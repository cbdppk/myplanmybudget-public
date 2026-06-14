"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QuickExpenseForm } from "./client-form";
import { deleteTransaction } from "./actions";
import { Button } from "@/components/ui/button";

type Txn = {
  id: string;
  memo: string | null;
  type: "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER";
  amount: number;
  occurredAt: Date | string;
  category: string | null;
};

function toMoney(value: number, currency: string, fxRate = 1) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value * fxRate);
}

function isWithinFilter(dateValue: Date, filter: "TODAY" | "WEEK" | "MONTH") {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
  const lowerBound = filter === "TODAY" ? startOfToday : filter === "WEEK" ? startOfWeek : startOfMonth;
  return dateValue >= lowerBound;
}

export function TrackFeedClient({
  currency,
  fxRate,
  today,
  period,
  dailyGuide,
  extras,
  impact,
  categories,
  transactions,
}: {
  currency: string;
  fxRate: number;
  today: { in: number; out: number; net: number };
  period: {
    name: string;
    monthIncome: number;
    monthExpense: number;
    monthSavings: number;
    plannedIncome: number;
    plannedExpense: number;
    plannedSavings: number;
    remainingThisPeriod: number;
    progressPct: number;
    expectedProgressPct: number;
    dayOfMonth: number;
    daysInMonth: number;
  };
  dailyGuide: {
    expenseEstimate: number;
    savingsEstimate: number;
    outflowEstimate: number;
    spentToday: number;
    savedToday: number;
    outflowToday: number;
    remainingExpenseToday: number;
    remainingSavingsToday: number;
    remainingOutflowToday: number;
    expectedExpenseToDate: number;
    expectedSavingsToDate: number;
  };
  extras: {
    liveBalance: number;
    todayExtraIncome: number;
    todayExtraExpense: number;
    todayExtraSavings: number;
    extraIncomeMonth: number;
    extraExpenseMonth: number;
    extraSavingsMonth: number;
    dailyBaselineUsed: number;
    budgetUsedPct: number;
  };
  impact: { headline: string; detail: string; projection: string; tone: "good" | "warn" | "bad" };
  categories: { expense: string[]; savings: string[] };
  transactions: Txn[];
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const router = useRouter();

  const [optimisticTransactions, addOptimisticTransaction] = useOptimistic(
    transactions,
    (current, newTxn: Txn) => [newTxn, ...current],
  );

  const [draftWindowFilter, setDraftWindowFilter] = useState<"TODAY" | "WEEK" | "MONTH">("TODAY");
  const [draftTypeFilter, setDraftTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE" | "SAVINGS">("ALL");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<string>("ALL");
  const [draftSearch, setDraftSearch] = useState("");
  const [windowFilter, setWindowFilter] = useState<"TODAY" | "WEEK" | "MONTH">("TODAY");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE" | "SAVINGS">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchText, setSearchText] = useState("");

  const allCategories = useMemo(() => [...categories.expense, ...categories.savings], [categories.expense, categories.savings]);

  function handleDelete(id: string) {
    if (!window.confirm("Delete this transaction?")) return;
    setDeletingId(id);
    setDeleteError(null);
    startDeleteTransition(async () => {
      try {
        await deleteTransaction(id);
        toast.success("Transaction deleted.");
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed.";
        setDeleteError(msg);
        toast.error(msg);
      } finally {
        setDeletingId(null);
      }
    });
  }

  const optimisticBalanceAdjustment = useMemo(() => {
    return optimisticTransactions.reduce((sum, item) => {
      if (!item.id.startsWith("optimistic-")) return sum;
      if (item.type === "INCOME") return sum + item.amount;
      if (item.type === "EXPENSE" || item.type === "SAVINGS") return sum - item.amount;
      return sum;
    }, 0);
  }, [optimisticTransactions]);

  const liveBalance = extras.liveBalance + optimisticBalanceAdjustment;
  const liveTodayIncome = today.in + optimisticTransactions.reduce((sum, item) => {
    if (!item.id.startsWith("optimistic-")) return sum;
    if (item.type !== "INCOME") return sum;
    const when = new Date(item.occurredAt);
    return isWithinFilter(when, "TODAY") ? sum + item.amount : sum;
  }, 0);
  const liveTodayOutflow = today.out + optimisticTransactions.reduce((sum, item) => {
    if (!item.id.startsWith("optimistic-")) return sum;
    if (item.type === "EXPENSE" || item.type === "SAVINGS") {
      const when = new Date(item.occurredAt);
      return isWithinFilter(when, "TODAY") ? sum + item.amount : sum;
    }
    return sum;
  }, 0);
  const liveTodayNet = liveTodayIncome - liveTodayOutflow;

  const filteredTransactions = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return optimisticTransactions.filter((item) => {
      const when = new Date(item.occurredAt);
      if (!isWithinFilter(when, windowFilter)) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (categoryFilter !== "ALL" && (item.category ?? "Uncategorized") !== categoryFilter) return false;
      if (!query) return true;

      const haystack = [item.memo ?? "", item.category ?? "", item.type].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [categoryFilter, optimisticTransactions, searchText, typeFilter, windowFilter]);

  const expectedProgressPct = Math.min(100, Math.max(0, period.expectedProgressPct));
  const impactToneClass =
    impact.tone === "bad" ? "border-rose-200 bg-rose-50" : impact.tone === "warn" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";

  const extraInfoRows: Array<{ label: string; value: string; tone?: "default" | "good" | "bad" | "info" }> = [
    { label: "Recorded income today", value: toMoney(liveTodayIncome, currency, fxRate), tone: "good" },
    { label: "Recorded outflow today", value: toMoney(liveTodayOutflow, currency, fxRate), tone: "bad" },
    { label: "Daily expense estimate", value: toMoney(dailyGuide.expenseEstimate, currency, fxRate), tone: "info" },
    { label: "Daily savings estimate", value: toMoney(dailyGuide.savingsEstimate, currency, fxRate), tone: "info" },
    { label: "Expected expense to date", value: toMoney(dailyGuide.expectedExpenseToDate, currency, fxRate) },
    { label: "Expected savings to date", value: toMoney(dailyGuide.expectedSavingsToDate, currency, fxRate) },
    { label: "Extra income this period", value: toMoney(extras.extraIncomeMonth, currency, fxRate), tone: "good" },
    { label: "Extra expense this period", value: toMoney(extras.extraExpenseMonth, currency, fxRate), tone: "bad" },
    { label: "Extra savings this period", value: toMoney(extras.extraSavingsMonth, currency, fxRate), tone: "info" },
  ];

  return (
    <div className="space-y-6">
      <section>
        <article className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="kicker">Live balance</div>
              <p className={`mt-2 break-words text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl ${liveBalance < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {toMoney(liveBalance, currency, fxRate)}
              </p>
              <p className="mt-1 text-sm text-black/60">
                Budget surplus left after live income, spending, and savings entries.
              </p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[320px]">
              <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-black/45">Today in</p>
                <p className="mt-1 text-base font-semibold text-emerald-700">{toMoney(liveTodayIncome, currency, fxRate)}</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-black/45">Today out</p>
                <p className="mt-1 text-base font-semibold text-rose-700">{toMoney(liveTodayOutflow, currency, fxRate)}</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-black/45">Net today</p>
                <p className={`mt-1 text-base font-semibold ${liveTodayNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {toMoney(liveTodayNet, currency, fxRate)}
                </p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section id="quick-form" className="scroll-mt-24">
        <QuickExpenseForm
          expenseCategories={categories.expense}
          savingsCategories={categories.savings}
          liveBalance={liveBalance}
          currency={currency}
          fxRate={fxRate}
          onAdded={addOptimisticTransaction}
        />
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">History</h2>
            <p className="mt-1 text-xs text-black/60">Filter, search, then apply to inspect what has been recorded.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setDraftWindowFilter("TODAY");
                setDraftTypeFilter("ALL");
                setDraftCategoryFilter("ALL");
                setDraftSearch("");
                setWindowFilter("TODAY");
                setTypeFilter("ALL");
                setCategoryFilter("ALL");
                setSearchText("");
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                setWindowFilter(draftWindowFilter);
                setTypeFilter(draftTypeFilter);
                setCategoryFilter(draftCategoryFilter);
                setSearchText(draftSearch);
              }}
            >
              Apply filters
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <label>
            <p className="text-xs text-black/60">Period</p>
            <select className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3 text-sm" value={draftWindowFilter} onChange={(e) => setDraftWindowFilter(e.target.value as "TODAY" | "WEEK" | "MONTH")}>
              <option value="TODAY">Today</option>
              <option value="WEEK">Week</option>
              <option value="MONTH">Month</option>
            </select>
          </label>
          <label>
            <p className="text-xs text-black/60">Type</p>
            <select className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3 text-sm" value={draftTypeFilter} onChange={(e) => setDraftTypeFilter(e.target.value as "ALL" | "INCOME" | "EXPENSE" | "SAVINGS")}>
              <option value="ALL">All</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </label>
          <label>
            <p className="text-xs text-black/60">Category</p>
            <select className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3 text-sm" value={draftCategoryFilter} onChange={(e) => setDraftCategoryFilter(e.target.value)}>
              <option value="ALL">All categories</option>
              {allCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value="Uncategorized">Uncategorized</option>
            </select>
          </label>
          <label>
            <p className="text-xs text-black/60">Search</p>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3 text-sm"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Search note, category, or type"
            />
          </label>
        </div>

        {deleteError ? <p className="mt-3 text-xs text-red-600">{deleteError}</p> : null}

        <div className="mt-4 space-y-2 text-sm">
          {filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 py-8 text-center">
              <p className="text-sm font-medium text-black/60">No transactions found</p>
              <p className="mt-1 text-xs text-black/40">Adjust filters or add a new transaction above.</p>
            </div>
          ) : null}
          {filteredTransactions.map((item) => (
            <article key={item.id} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.memo ?? item.category ?? item.type}</p>
                  <p className="mt-1 text-xs text-black/60">
                    {new Date(item.occurredAt).toLocaleString()} · {item.category ?? "Uncategorized"}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${item.type === "INCOME" ? "bg-emerald-100 text-emerald-700" : item.type === "SAVINGS" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
                    {item.type}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete transaction"
                    disabled={isPendingDelete && deletingId === item.id}
                    aria-busy={isPendingDelete && deletingId === item.id ? "true" : undefined}
                    onClick={() => handleDelete(item.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-black/30 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    {isPendingDelete && deletingId === item.id ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    ) : "×"}
                  </button>
                </div>
              </div>
              <p className={`mt-2 break-words text-sm font-semibold [overflow-wrap:anywhere] ${item.type === "INCOME" ? "text-emerald-700" : item.type === "SAVINGS" ? "text-blue-700" : "text-rose-700"}`}>
                {item.type === "INCOME" ? "+" : "-"}{toMoney(item.amount, currency, fxRate)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={`card border p-6 ${impactToneClass}`}>
        <h2 className="text-sm font-semibold">Budget impact</h2>
        <p className="mt-2 text-lg font-medium">{impact.headline}</p>
        <p className="mt-2 text-sm text-black/75">{impact.detail}</p>
        <p className="mt-2 text-sm font-medium">{impact.projection}</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-black/45">Expense pace</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{toMoney(dailyGuide.expectedExpenseToDate, currency, fxRate)}</p>
            <p className="mt-1 text-xs text-black/55">Expected by day {period.dayOfMonth}</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-black/45">Savings pace</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{toMoney(dailyGuide.expectedSavingsToDate, currency, fxRate)}</p>
            <p className="mt-1 text-xs text-black/55">Expected by day {period.dayOfMonth}</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-black/45">Budget progress</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{expectedProgressPct.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-black/55">Expected progress by day {period.dayOfMonth}</p>
            <p className="mt-1 text-xs text-black/45">
              Actual expense logged: {toMoney(period.monthExpense, currency, fxRate)} of {toMoney(period.plannedExpense, currency, fxRate)}
            </p>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Extra info</h2>
            <p className="mt-1 text-xs text-black/60">A cleaner breakdown of what the page is using to estimate your pace.</p>
          </div>
          <p className="text-xs text-black/50">
            Day {period.dayOfMonth} of {period.daysInMonth} in {period.name}
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/45">Daily outflow guide</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{toMoney(dailyGuide.outflowEstimate, currency, fxRate)}</p>
            <p className="mt-1 text-xs text-black/55">
              {toMoney(dailyGuide.expenseEstimate, currency, fxRate)} expense + {toMoney(dailyGuide.savingsEstimate, currency, fxRate)} savings
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/45">Today vs guide</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{toMoney(dailyGuide.outflowToday, currency, fxRate)}</p>
            <p className={`mt-1 text-xs ${dailyGuide.remainingOutflowToday < 0 ? "text-rose-700" : "text-black/55"}`}>
              {dailyGuide.remainingOutflowToday < 0 ? "Over guide by " : "Guide left: "}
              {toMoney(Math.abs(dailyGuide.remainingOutflowToday), currency, fxRate)}
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-black/45">Planned this period</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{toMoney(period.plannedExpense + period.plannedSavings, currency, fxRate)}</p>
            <p className="mt-1 text-xs text-black/55">
              {toMoney(period.plannedExpense, currency, fxRate)} expense + {toMoney(period.plannedSavings, currency, fxRate)} savings
            </p>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-black/10 rounded-2xl border border-black/10">
          {extraInfoRows.map((item) => (
            <li key={item.label} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="text-black/65">{item.label}</span>
              <span
                className={
                  item.tone === "good"
                    ? "font-semibold text-emerald-700"
                    : item.tone === "bad"
                      ? "font-semibold text-rose-700"
                      : item.tone === "info"
                        ? "font-semibold text-sky-700"
                        : "font-semibold text-black/85"
                }
              >
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
