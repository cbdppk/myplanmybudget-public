"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MiniLineChart } from "@/components/feature/charts";
import { saveBudgetTargets } from "./actions";

type Item = {
  categoryId: string;
  name: string;
  kind: string;
  amount: number;
  cadence?: "DAILY" | "WEEKLY" | "MONTHLY";
  enteredAmount?: number;
  monthlyEquivalent?: number;
};

type SpendScope = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "LIFETIME";

function toMoney(value: number, currency: string, fxRate = 1) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value * fxRate);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function InfoTip({
  id,
  text,
  openTip,
  setOpenTip,
}: {
  id: string;
  text: string;
  openTip: string | null;
  setOpenTip: (value: string | null) => void;
}) {
  const open = openTip === id;
  const btnRef = useRef<HTMLDivElement>(null);
  const [align, setAlign] = useState<"left" | "right">("right");

  function computeAlign() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const panelWidth = 224; // w-56
    const fitsRight = rect.left + panelWidth <= vw - 8;
    const fitsLeft = rect.right - panelWidth >= 8;
    setAlign(fitsLeft && !fitsRight ? "left" : "right");
  }

  return (
    <div className="relative" ref={btnRef}>
      <button
        type="button"
        aria-label="Card explanation"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-black/20 bg-white text-[10px] font-semibold text-black/60 hover:bg-black/[0.04]"
        onClick={() => { computeAlign(); setOpenTip(open ? null : id); }}
      >
        ?
      </button>
      {open ? (
        <div className={`absolute z-10 mt-1 w-56 max-w-[min(14rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white p-2 text-xs text-black/70 shadow-sm ${align === "left" ? "right-0" : "left-0"}`}>
          {text}
        </div>
      ) : null}
    </div>
  );
}

function Card({
  title,
  value,
  hint,
  tipId,
  openTip,
  setOpenTip,
  badge,
  sub,
}: {
  title: string;
  value: string;
  hint: string;
  tipId: string;
  openTip: string | null;
  setOpenTip: (value: string | null) => void;
  badge?: { label: string; className: string };
  sub?: string;
}) {
  return (
    <article className="rounded-xl border border-sky-100 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-black/60">{title}</p>
        <InfoTip id={tipId} text={hint} openTip={openTip} setOpenTip={setOpenTip} />
      </div>
      <p className="mt-1 font-semibold">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-black/45">{sub}</p> : null}
      {badge ? <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.label}</p> : null}
    </article>
  );
}

function BudgetPie({ values }: { values: Array<{ label: string; value: number; color: string }> }) {
  const total = values.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const size = 220;
  const center = size / 2;
  const radius = 72;

  let acc = 0;
  const slices = values
    .map((item) => {
      const safeValue = Math.max(0, item.value);
      if (total <= 0 || safeValue <= 0) return null;
      const start = (acc / total) * Math.PI * 2;
      acc += safeValue;
      const end = (acc / total) * Math.PI * 2;
      const x1 = center + radius * Math.cos(start - Math.PI / 2);
      const y1 = center + radius * Math.sin(start - Math.PI / 2);
      const x2 = center + radius * Math.cos(end - Math.PI / 2);
      const y2 = center + radius * Math.sin(end - Math.PI / 2);
      const largeArc = end - start > Math.PI ? 1 : 0;
      const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return { ...item, path };
    })
    .filter(Boolean) as Array<{ label: string; value: number; color: string; path: string }>;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-56 w-56">
        <circle cx={center} cy={center} r={radius} fill="#f1f5f9" />
        {slices.map((slice) => (
          <path key={slice.label} d={slice.path} fill={slice.color} />
        ))}
        <circle cx={center} cy={center} r={40} fill="white" />
        <text x={center} y={center - 2} textAnchor="middle" className="fill-black text-[10px] font-semibold">
          Budget
        </text>
        <text x={center} y={center + 12} textAnchor="middle" className="fill-black/65 text-[9px]">
          Split
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        {values.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BudgetPlanner({
  items,
  currency,
  fxRate,
  baseline,
  actual,
  guidance,
  extrasSummary,
  daysRemaining,
  periodStartDate,
}: {
  items: Item[];
  currency: string;
  fxRate: number;
  baseline: {
    monthIncome: number;
    monthExpense: number;
    monthSavings: number;
    dailySpendEstimate: number;
    daysInMonth: number;
    dayOfMonth: number;
  };
  actual: {
    monthIncome: number;
    monthExpenseOnly: number;
    monthSavings: number;
    monthExpense: number;
    effectiveIncome: number;
    realBalance: number;
    expectedExpenseToDate: number;
    expenseDrift: number;
    projectedExpenseAtMonthEnd: number;
    projectedDrift: number;
    plannedRemaining: number;
  };
  guidance: string[];
  extrasSummary: {
    extraIncome: number;
    extraExpense: number;
    extraSavings: number;
  };
  daysRemaining: number;
  periodStartDate: string;
}) {
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [scope, setScope] = useState<SpendScope>("MONTHLY");
  const [lifetimeYears, setLifetimeYears] = useState<2 | 5 | 10 | 15 | 20>(10);
  const [editMode, setEditMode] = useState(false);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const [periodNoticeDismissed, setPeriodNoticeDismissed] = useState(false);

  // Persist the dismiss across page navigations using sessionStorage.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`period_notice:${periodStartDate}`) === "1") {
        setPeriodNoticeDismissed(true);
      }
    } catch { /* sessionStorage unavailable */ }
  }, [periodStartDate]);

  function dismissPeriodNotice() {
    setPeriodNoticeDismissed(true);
    try { sessionStorage.setItem(`period_notice:${periodStartDate}`, "1"); } catch { /* ignore */ }
  }

  function openEdit() {
    const initial: Record<string, string> = {};
    for (const item of items) {
      initial[item.categoryId] = String((item.monthlyEquivalent ?? item.amount).toFixed(2));
    }
    setDraftAmounts(initial);
    setSaveError(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSaveError(null);
  }

  const draftAmountFor = (categoryId: string) => {
    const value = parseFloat(draftAmounts[categoryId] ?? "0");
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  const draftExpenseTotal = items
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + draftAmountFor(item.categoryId), 0);
  const draftSavingsTotal = items
    .filter((item) => item.kind === "savings")
    .reduce((sum, item) => sum + draftAmountFor(item.categoryId), 0);
  const draftTotal = draftExpenseTotal + draftSavingsTotal;
  const overExpense = draftExpenseTotal > baseline.monthExpense + 0.01;
  const overSavings = draftSavingsTotal > baseline.monthSavings + 0.01;
  const overBudget = overExpense || overSavings;

  function handleSave() {
    if (overBudget) return;
    setSaveError(null);
    startSave(async () => {
      try {
        const saveItems = items.map((item) => {
          const n = parseFloat(draftAmounts[item.categoryId] ?? "0");
          return { categoryId: item.categoryId, amount: Number.isFinite(n) ? Math.max(0, n) : 0 };
        });
        await saveBudgetTargets({ items: saveItems });
        setEditMode(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed. Please try again.");
      }
    });
  }

  const expenseItems = items.filter((item) => item.kind === "expense");
  const savingsItems = items.filter((item) => item.kind === "savings" && item.name.trim().toLowerCase() !== "savings");

  const expenditure = Math.max(0, baseline.monthExpense);
  const savings = Math.max(0, baseline.monthSavings);

  const recordedIncome = round2(actual.monthIncome);
  const recordedExpenseOnly = round2(actual.monthExpenseOnly); // planned expense only
  const recordedExtraExpense = round2(extrasSummary.extraExpense); // off-budget extra spend
  const recordedExpenseAll = round2(recordedExpenseOnly + recordedExtraExpense); // all real money out
  const recordedSavings = round2(actual.monthSavings);
  // The depleting plan ("expected by now" if you tracked the budget evenly) is a
  // PACE REFERENCE only — it is never treated as money already gone, so the Real
  // balance below stays truthful for users who haven't logged much yet.
  const plannedExpenseToDate = round2(actual.expectedExpenseToDate);
  const plannedSavingsToDate = round2((baseline.monthSavings / Math.max(1, baseline.daysInMonth)) * baseline.dayOfMonth);
  // Real balance comes from the canonical ledger calculation: carry-in plus
  // reconciled regular/extra income minus actual expenses and savings.
  const balanceAcrossBoard = round2(actual.realBalance);
  const newIncome = round2(extrasSummary.extraIncome);
  // Keep flex room aligned with the ledger: carry-in + reconciled income funds
  // the plan, then off-budget extra spending draws down what is unallocated.
  const planSurplus = round2(Math.max(0, actual.effectiveIncome - expenditure - savings - recordedExtraExpense));
  // Flex room per remaining day = plan surplus divided by days left this period
  const dailyFlexRoom = daysRemaining > 0 ? round2(planSurplus / daysRemaining) : planSurplus;
  const extraMoney = planSurplus;
  // New-period notice: show if we are within first 3 days of the period
  const isNewPeriod = (() => {
    try {
      const start = new Date(periodStartDate);
      const now = new Date();
      return (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) <= 3;
    } catch {
      return false;
    }
  })();

  const savingsItemsTotal = round2(
    savingsItems.reduce((sum, item) => sum + Math.max(0, item.monthlyEquivalent ?? item.amount), 0)
  );
  const unallocatedSavings = round2(Math.max(0, savings - savingsItemsTotal));

  const combinedOutflow = round2(expenditure + savings);
  const incomeLine = [
    0,
    round2(baseline.monthIncome * 0.25),
    round2(baseline.monthIncome * 0.5),
    round2(actual.monthIncome),
    round2(baseline.monthIncome * 0.8),
    round2(baseline.monthIncome),
  ];
  const expenditureLine = [
    0,
    round2(combinedOutflow * 0.25),
    round2(combinedOutflow * 0.5),
    round2(recordedExpenseAll + recordedSavings),
    round2(actual.projectedExpenseAtMonthEnd + savings),
    round2(combinedOutflow),
  ];

  const autoSpend = useMemo(() => {
    const days = Math.max(1, baseline.daysInMonth);
    const monthExpense = expenditure;
    const monthSavings = savings;

    const scopeConfig = {
      DAILY: { label: "Daily", expense: round2(monthExpense / days), savings: round2(monthSavings / days), flex: dailyFlexRoom },
      WEEKLY: { label: "Weekly", expense: round2((monthExpense * 12) / 52), savings: round2((monthSavings * 12) / 52), flex: round2(dailyFlexRoom * 7) },
      MONTHLY: { label: "Monthly", expense: monthExpense, savings: monthSavings, flex: planSurplus },
      YEARLY: { label: "Yearly", expense: round2(monthExpense * 12), savings: round2(monthSavings * 12), flex: round2(planSurplus * 12) },
      LIFETIME: {
        label: "Lifetime",
        expense: round2(monthExpense * 12 * lifetimeYears),
        savings: round2(monthSavings * 12 * lifetimeYears),
        flex: round2(planSurplus * 12 * lifetimeYears),
      },
    }[scope];

    const bullets = [
      `Planned savings (${scopeConfig.label}): ${toMoney(scopeConfig.savings, currency, fxRate)}`,
      `Planned expenditure (${scopeConfig.label}): ${toMoney(scopeConfig.expense, currency, fxRate)}`,
    ];

    if (scope === "LIFETIME") {
      bullets.push(`Your projected total outflow over ${lifetimeYears} year(s): ${toMoney(scopeConfig.expense + scopeConfig.savings, currency, fxRate)}. Increase your savings rate now to build resilience over this horizon.`);
    } else {
      // "Daily Flex Room" — the surplus budget divided by remaining days, so the user knows
      // how much of unallocated plan money they can spend each day without breaking the budget.
      const flexLabel = scope === "DAILY" ? "Daily flex room"
        : scope === "WEEKLY" ? "Weekly flex room"
        : scope === "MONTHLY" ? "Monthly surplus"
        : "Yearly surplus";
      bullets.push(`${flexLabel} (${scopeConfig.label}): ${toMoney(scopeConfig.flex, currency, fxRate)}`);
    }

    if (planSurplus <= 0) {
      bullets.push("No surplus in your plan. All income is allocated to expenses or savings.");
    } else if (actual.monthIncome > baseline.monthIncome * 1.4) {
      bullets.push("Income spike this month. Consider moving the extra to savings before spending it.");
    } else {
      bullets.push("Stay within this flex room each day to end the period with a surplus — it's your safe-to-spend cushion.");
    }

    return bullets;
  }, [actual.monthIncome, baseline.daysInMonth, baseline.monthIncome, currency, dailyFlexRoom, expenditure, fxRate, lifetimeYears, planSurplus, savings, scope]);

  const pieValues = [
    { label: "Expenditure", value: expenditure, color: "#0ea5e9" },
    { label: "Savings", value: savings, color: "#10b981" },
    { label: "Extra", value: Math.max(0, extraMoney), color: "#f59e0b" },
  ];

  return (
    <div className="space-y-6">
      {isNewPeriod && !periodNoticeDismissed ? (
        <section className="card relative px-4 py-4">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissPeriodNotice}
            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-lg leading-none text-[color:var(--text-muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
          >
            ×
          </button>
          <p className="pr-7 text-sm font-semibold">New budget period started</p>
          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">A new month has begun. Review your budget and update if needed.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/settings/budget"
              className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
            >
              Update budget
            </Link>
            <button
              type="button"
              onClick={dismissPeriodNotice}
              className="rounded-xl border [border-color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      <section className="theme-card-accent rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Budget snapshot</h2>
            <p className="mt-1 text-xs text-black/60">Your plan vs what you have actually logged this period.</p>
          </div>
          <Link href="/settings/budget" className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-50">
            Edit budget
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card tipId="income" openTip={openTip} setOpenTip={setOpenTip} title="Planned income" value={toMoney(baseline.monthIncome, currency, fxRate)} hint="The monthly income you set in your budget. Your expected earnings this period." badge={{ label: "Plan", className: "bg-sky-100 text-sky-800" }} />
          <Card tipId="expenditure" openTip={openTip} setOpenTip={setOpenTip} title="Planned expenses" value={toMoney(expenditure, currency, fxRate)} hint="What you planned to spend on expenses this month — not what you have spent yet." badge={{ label: "Plan", className: "bg-rose-100 text-rose-800" }} />
          <Card tipId="savings" openTip={openTip} setOpenTip={setOpenTip} title="Planned savings" value={toMoney(savings, currency, fxRate)} hint="What you planned to save this month — not what has been saved yet." badge={{ label: "Plan", className: "bg-emerald-100 text-emerald-800" }} />
          <Card tipId="balance" openTip={openTip} setOpenTip={setOpenTip} title="Real balance" value={toMoney(balanceAcrossBoard, currency, fxRate)} sub={`Plan pace by now: ${toMoney(plannedExpenseToDate + plannedSavingsToDate, currency, fxRate)} used`} hint="Your carry-in plus reconciled regular income and extra income, minus what you've actually spent and saved. The plan-pace line is a reference, not money already gone." badge={{ label: balanceAcrossBoard >= 0 ? "Available" : "Overspent", className: balanceAcrossBoard >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800" }} />
          <Card tipId="income-logged" openTip={openTip} setOpenTip={setOpenTip} title="Income logged" value={toMoney(recordedIncome, currency, fxRate)} hint="Total income transactions you have recorded this period. Includes your baseline pay and any extra income." badge={newIncome > 0 ? { label: `+${toMoney(newIncome, currency, fxRate)} extra`, className: "bg-violet-100 text-violet-800" } : undefined} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Income and expenditure graph</h3>
            <InfoTip id="graph" text="Single graph with both income and total expenditure lines." openTip={openTip} setOpenTip={setOpenTip} />
          </div>
          <div className="mt-3">
            <MiniLineChart values={incomeLine} secondValues={expenditureLine} minValue={0} maxValue={Math.max(...incomeLine, ...expenditureLine, 1)} xLabels={["Start", "25%", "50%", "Now", "Trend", "Month End"]} legend={["Income", "Expenditure"]} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">Income line</span>
            <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-800">Expenditure line</span>
            <span className="text-xs text-black/50">Blue = income · Orange = total expenditure</span>
          </div>
        </article>

        <article className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Spending pace & flex room</h3>
            <InfoTip id="auto-spend" text="Shows your planned spend pace across different time windows, plus your Daily Flex Room — how much of your unallocated budget surplus you can spend each remaining day without breaking your plan." openTip={openTip} setOpenTip={setOpenTip} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "LIFETIME"] as SpendScope[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${scope === item ? "bg-sky-700 text-white" : "border border-black/15 bg-white text-black/70"}`}
              >
                {item}
              </button>
            ))}
          </div>
          {scope === "LIFETIME" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-black/60">Years:</span>
              {[2, 5, 10, 15, 20].map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setLifetimeYears(year as 2 | 5 | 10 | 15 | 20)}
                  className={`rounded-full px-2.5 py-1 font-semibold ${lifetimeYears === year ? "bg-emerald-700 text-white" : "border border-black/15 bg-white text-black/70"}`}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm">
            {autoSpend.map((item) => (
              <li key={item} className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Preferred spending info</h3>
            <InfoTip id="preferred" text="Information card showing your account spending orientation." openTip={openTip} setOpenTip={setOpenTip} />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <p className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">Income logged this period: {toMoney(recordedIncome, currency, fxRate)}</p>
            <p className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">Expenses logged this period: {toMoney(recordedExpenseOnly, currency, fxRate)}</p>
            <p className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">Savings logged this period: {toMoney(recordedSavings, currency, fxRate)}</p>
            <p className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">Spending style: {balanceAcrossBoard < 0 ? "Pressure mode — reduce spending" : "Controlled mode — maintain pace"}</p>
          </div>
        </article>

        <article className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Budget pie</h3>
            <InfoTip id="pie" text="Pie chart for expenditure, savings, and extra money split." openTip={openTip} setOpenTip={setOpenTip} />
          </div>
          <div className="mt-2">
            <BudgetPie values={pieValues} />
          </div>
        </article>
      </section>

      <section className="card p-4 text-sm">
        <p className="font-semibold">How extras affected this month</p>
        <div className="mt-2 space-y-1 text-black/75">
          <p>Extra income + {toMoney(extrasSummary.extraIncome, currency, fxRate)} updated your month.</p>
          <p>Extra expenses - {toMoney(extrasSummary.extraExpense, currency, fxRate)} drawn from your surplus (not your category budgets).</p>
          <p>Extra savings - {toMoney(extrasSummary.extraSavings, currency, fxRate)} moved to savings.</p>
        </div>
      </section>

      <section className="space-y-2 text-sm">
        {guidance.map((item, index) => (
          <p key={`${index}-${item}`} className="rounded-xl border border-black/10 bg-white px-3 py-2">
            {item}
          </p>
        ))}
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Expenditure and savings overview</h2>
            <p className="mt-1 text-xs text-black/60">This shows where your fixed budget amounts are intended to go this period.</p>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? null : (
              <>
                <button
                  type="button"
                  onClick={openEdit}
                  className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-50"
                >
                  Edit categories
                </button>
                <Link href="/settings/budget" className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-semibold text-black/60 hover:bg-black/[0.03]">
                  Full settings →
                </Link>
              </>
            )}
          </div>
        </div>

        {editMode ? (
          <div className="mt-4 space-y-3">
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${overBudget ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              <span>Total allocated: {toMoney(round2(draftTotal), currency, fxRate)}</span>
              <span>Expenses: {toMoney(round2(draftExpenseTotal), currency, fxRate)} / {toMoney(baseline.monthExpense, currency, fxRate)}</span>
              <span>Savings: {toMoney(round2(draftSavingsTotal), currency, fxRate)} / {toMoney(baseline.monthSavings, currency, fxRate)}</span>
            </div>
            {overBudget ? (
              <p className="text-xs text-rose-600">
                {overExpense ? `Expense categories exceed the expense plan by ${toMoney(round2(draftExpenseTotal - baseline.monthExpense), currency, fxRate)}. ` : ""}
                {overSavings ? `Savings categories exceed the savings plan by ${toMoney(round2(draftSavingsTotal - baseline.monthSavings), currency, fxRate)}.` : ""}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {items
                .filter((item) => item.kind === "expense" || (item.kind === "savings" && item.name.trim().toLowerCase() !== "savings"))
                .map((item) => (
                  <label key={item.categoryId} className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{item.name}</p>
                      <p className="text-[10px] text-black/50">{item.kind === "savings" ? "Savings" : "Expense"} · monthly</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={draftAmounts[item.categoryId] ?? ""}
                      onChange={(e) => setDraftAmounts((prev) => ({ ...prev, [item.categoryId]: e.target.value }))}
                      className="w-28 rounded-lg border border-black/15 px-2 py-1.5 text-right text-sm"
                    />
                  </label>
                ))}
            </div>
            {saveError ? <p className="text-xs text-rose-600">{saveError}</p> : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={savePending || overBudget}
                className="rounded-full bg-sky-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {savePending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savePending}
                className="rounded-full border border-black/15 px-4 py-1.5 text-xs font-semibold text-black/60 hover:bg-black/[0.03] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Expenditure categories</h3>
                <p className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">{toMoney(expenditure, currency, fxRate)}</p>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {expenseItems.map((item) => (
                  <div key={item.categoryId} className="flex flex-col gap-2 rounded-lg bg-black/[0.03] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p>{item.name}</p>
                      <p className="text-[11px] text-black/55">
                        {item.enteredAmount?.toFixed(2) ?? item.amount.toFixed(2)} {item.cadence?.toLowerCase() ?? "monthly"} · monthly {toMoney(item.monthlyEquivalent ?? item.amount, currency, fxRate)}
                      </p>
                    </div>
                    <p>{toMoney(item.monthlyEquivalent ?? item.amount, currency, fxRate)}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Savings focus</h3>
                <p className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{toMoney(savings, currency, fxRate)}</p>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {savingsItems.map((item) => (
                  <div key={item.categoryId} className="flex flex-col gap-2 rounded-lg bg-black/[0.03] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p>{item.name}</p>
                      <p className="text-[11px] text-black/55">
                        {item.enteredAmount?.toFixed(2) ?? item.amount.toFixed(2)} {item.cadence?.toLowerCase() ?? "monthly"} · monthly {toMoney(item.monthlyEquivalent ?? item.amount, currency, fxRate)}
                      </p>
                    </div>
                    <p>{toMoney(item.monthlyEquivalent ?? item.amount, currency, fxRate)}</p>
                  </div>
                ))}
                {unallocatedSavings > 0.01 ? (
                  <div className="flex flex-col gap-2 rounded-lg bg-black/[0.03] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <p>Unallocated savings</p>
                    <p>{toMoney(unallocatedSavings, currency, fxRate)}</p>
                  </div>
                ) : null}
              </div>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
