"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { deleteScenario, runScenario } from "./actions";

type Result = {
  scenarioId: string;
  projectedExpenses: number;
  projectedIncome: number;
  projectedNet: number;
  startingSavings: number;
  targetAmount: number;
  monthsToTarget: number | null;
  runwayMonths: number | null;
  endingBalance: number;
  timeline: Array<{
    monthIndex: number;
    balance: number;
  }>;
};

type HistoryItem = {
  id: string;
  name: string;
  createdAt: Date | string;
  projectedNet: number | null;
  endingBalance: number | null;
  runwayMonths: number | null;
};

type SelectedScenario = {
  id: string;
  name: string;
  createdAt: Date | string;
  input: {
    name: string;
    monthlyIncome: number;
    monthlyExpenses: number;
    startingSavings: number;
    horizonMonths: number;
    targetAmount: number;
    targetMonths: number;
  };
  result: Result | null;
};

type Mode = "GOAL" | "LIVELIHOOD" | "STRESS";

function toNum(value: string | number | undefined | null, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toMoney(value: number, currency: string, fxRate = 1) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value * fxRate);
}

function formatUtcDateTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [align, setAlign] = useState<"left" | "right">("right");

  const computeAlign = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const panelWidth = 240;
    const fitsLeft = rect.right - panelWidth >= 8;
    const fitsRight = rect.left + panelWidth <= vw - 8;
    setAlign(fitsLeft && !fitsRight ? "left" : "right");
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label="Help"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-black/20 bg-white text-[10px] font-semibold text-black/60 hover:bg-black/[0.04]"
        onClick={() => { computeAlign(); setOpenTip(open ? null : id); }}
      >
        ?
      </button>
      {open ? (
        <div className={`absolute z-20 mt-1 w-60 max-w-[min(15rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white p-2 text-xs text-black/70 shadow-sm ${align === "left" ? "right-0" : "left-0"}`}>{text}</div>
      ) : null}
    </div>
  );
}

function BalanceChart({
  points,
  currency,
  fxRate,
  targetAmount,
}: {
  points: Array<{ monthIndex: number; balance: number }>;
  currency: string;
  fxRate: number;
  targetAmount: number;
}) {
  if (points.length === 0) return null;
  const axisColor = "var(--text-secondary)";
  const gridColor = "var(--border)";
  const lineColor = "var(--blue-light)";
  const pointColor = "var(--blue-brand)";
  const width = 420;
  const height = 210;
  const marginLeft = 42;
  const marginRight = 18;
  const marginTop = 16;
  const marginBottom = 44;
  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;
  const balances = points.map((p) => p.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(...balances, targetAmount, 1);
  const range = Math.max(1, max - min);
  const toX = (i: number) => marginLeft + (i / Math.max(1, points.length - 1)) * chartW;
  const toY = (value: number) => marginTop + (1 - (value - min) / range) * chartH;
  const polyline = points.map((p, i) => `${toX(i)},${toY(p.balance)}`).join(" ");
  const firstNegative = points.find((p) => p.balance < 0) ?? null;
  const firstTarget = targetAmount > 0 ? points.find((p) => p.balance >= targetAmount) ?? null : null;
  const ticks = [max, min + range / 2, min];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full rounded-2xl bg-[color:var(--surface)] p-2">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={marginLeft} y1={toY(tick)} x2={marginLeft + chartW} y2={toY(tick)} stroke={gridColor} />
            <text x={marginLeft - 6} y={toY(tick) + 4} textAnchor="end" fontSize="10" fill={axisColor}>
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth="3" />
        {points.map((p, i) => (
          <circle key={`${p.monthIndex}-${p.balance}`} cx={toX(i)} cy={toY(p.balance)} r="2.5" fill={pointColor} />
        ))}
        <line x1={marginLeft} y1={marginTop + chartH} x2={marginLeft + chartW} y2={marginTop + chartH} stroke={gridColor} />
        <text x={marginLeft} y={height - 24} textAnchor="start" fontSize="10" fill={axisColor}>
          Month 1
        </text>
        <text x={marginLeft + chartW} y={height - 24} textAnchor="end" fontSize="10" fill={axisColor}>
          Month {points.length}
        </text>
        <text x={marginLeft + chartW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={axisColor}>
          Months
        </text>
        {firstNegative ? (
          <g>
            <circle cx={toX(firstNegative.monthIndex - 1)} cy={toY(firstNegative.balance)} r="4" fill="#dc2626" />
            <text x={toX(firstNegative.monthIndex - 1) + 6} y={toY(firstNegative.balance) - 6} fontSize="10" fill="#991b1b">
              First negative month
            </text>
          </g>
        ) : null}
        {firstTarget ? (
          <g>
            <circle cx={toX(firstTarget.monthIndex - 1)} cy={toY(firstTarget.balance)} r="4" fill="#16a34a" />
            <text x={toX(firstTarget.monthIndex - 1) + 6} y={toY(firstTarget.balance) - 6} fontSize="10" fill="#166534">
              Target reached
            </text>
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-black/65">
        <span>X-axis: Months</span>
        <span>Y-axis: Balance ({currency})</span>
      </div>
    </div>
  );
}

function LoanCalculator({
  currency,
  fxRate,
  openTip,
  setOpenTip,
}: {
  currency: string;
  fxRate: number;
  openTip: string | null;
  setOpenTip: (value: string | null) => void;
}) {
  const [loanAmount, setLoanAmount] = useState("10000");
  const [loanApr, setLoanApr] = useState("8");
  const [loanTermMonths, setLoanTermMonths] = useState("36");
  const [interestType, setInterestType] = useState<"AMORTISING" | "SIMPLE" | "COMPOUND">("AMORTISING");
  const [loanResult, setLoanResult] = useState<{
    monthlyPayment: number;
    totalPaid: number;
    totalInterest: number;
    effectiveRate: number;
  } | null>(null);

  function calcLoan() {
    const principal = Math.max(0, toNum(loanAmount, 0));
    const annualRate = Math.max(0, toNum(loanApr, 0));
    const months = Math.max(1, Math.round(toNum(loanTermMonths, 1)));
    if (principal <= 0) { setLoanResult(null); return; }
    if (annualRate === 0) {
      const monthlyPayment = principal / months;
      setLoanResult({ monthlyPayment, totalPaid: principal, totalInterest: 0, effectiveRate: 0 });
      return;
    }
    if (interestType === "SIMPLE") {
      // Flat interest on original principal
      const totalInterest = principal * (annualRate / 100) * (months / 12);
      const totalPaid = principal + totalInterest;
      const monthlyPayment = totalPaid / months;
      setLoanResult({ monthlyPayment, totalPaid, totalInterest, effectiveRate: annualRate });
    } else if (interestType === "COMPOUND") {
      // Compound accrual (balloon) — interest compounds each month, full balance due at end
      // Most expensive option: P × (1 + r/12)^n
      const r = annualRate / 100 / 12;
      const totalPaid = principal * Math.pow(1 + r, months);
      const totalInterest = totalPaid - principal;
      const ear = (Math.pow(1 + r, 12) - 1) * 100;
      setLoanResult({ monthlyPayment: totalPaid / months, totalPaid, totalInterest, effectiveRate: ear });
    } else {
      // Amortising — standard reducing-balance bank loan (cheapest for same APR)
      const r = annualRate / 100 / 12;
      const monthlyPayment = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
      const totalPaid = monthlyPayment * months;
      const totalInterest = totalPaid - principal;
      const ear = (Math.pow(1 + r, 12) - 1) * 100;
      setLoanResult({ monthlyPayment, totalPaid, totalInterest, effectiveRate: ear });
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Loan calculator</h2>
        <InfoTip id="loan-calc" text="Three interest models: Amortising = standard bank loan, fixed monthly payments, cheapest total. Simple = flat rate on original principal. Compound = interest grows on unpaid balance every month — most expensive, used for credit cards and penalty debt." openTip={openTip} setOpenTip={setOpenTip} />
      </div>
      <p className="mt-1 text-xs text-black/60">Sandbox only — does not affect your budget or simulation history.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <div className="text-xs text-black/60">Loan amount</div>
          <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3 text-sm" inputMode="decimal" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
        </label>
        <label>
          <div className="text-xs text-black/60">Annual interest rate (%)</div>
          <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3 text-sm" inputMode="decimal" value={loanApr} onChange={(e) => setLoanApr(e.target.value)} />
        </label>
        <label>
          <div className="text-xs text-black/60">Term (months)</div>
          <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3 text-sm" inputMode="numeric" value={loanTermMonths} onChange={(e) => setLoanTermMonths(e.target.value)} />
        </label>
        <div>
          <div className="text-xs text-black/60">Interest type</div>
          <div className="mt-1 flex gap-1.5">
            {([
              { value: "AMORTISING", label: "Amortising", sub: "bank loan" },
              { value: "SIMPLE", label: "Simple", sub: "flat rate" },
              { value: "COMPOUND", label: "Compound", sub: "balloon" },
            ] as const).map(({ value, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => setInterestType(value)}
                className={`flex flex-1 flex-col items-center rounded-xl border px-1 py-1.5 text-center transition ${interestType === value ? "border-sky-400 bg-sky-50 text-sky-700" : "border-black/15 text-black/60 hover:bg-black/[0.03]"}`}
              >
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] opacity-60">{sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={calcLoan} className="w-full sm:w-auto">Calculate</Button>
      </div>
      {loanResult ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-xs text-black/60">{interestType === "COMPOUND" ? "Avg monthly (balloon ÷ n)" : "Monthly payment"}</p>
              <p className="mt-1 text-lg font-semibold text-sky-700">{toMoney(loanResult.monthlyPayment, currency, fxRate)}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-xs text-black/60">Total paid</p>
              <p className="mt-1 text-lg font-semibold">{toMoney(loanResult.totalPaid, currency, fxRate)}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-xs text-black/60">Total interest</p>
              <p className="mt-1 text-lg font-semibold text-rose-600">{toMoney(loanResult.totalInterest, currency, fxRate)}</p>
            </div>
          </div>
          {interestType !== "SIMPLE" && loanResult.effectiveRate > 0 ? (
            <p className="mt-2 text-xs text-black/60">
              Effective annual rate (EAR): <strong>{loanResult.effectiveRate.toFixed(2)}%</strong> —{" "}
              {interestType === "COMPOUND"
                ? "compound accrual balloons the balance every month, making this the most expensive structure."
                : "this is the true annual cost when monthly compounding is applied to the reducing balance."}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function ScenarioRunner({
  currency,
  fxRate,
  baseline,
  history,
  selectedScenario,
  prefill,
}: {
  currency: string;
  fxRate: number;
  baseline: { monthlyIncome: number; monthlyExpenses: number; actualSavings: number };
  history: HistoryItem[];
  selectedScenario: SelectedScenario | null;
  prefill: {
    name?: string;
    monthlyIncome?: string;
    monthlyExpenses?: string;
    startingSavings?: string;
    horizonMonths?: string;
    targetAmount?: string;
  } | null;
}) {
  const router = useRouter();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<Mode>("GOAL");
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [openingScenarioId, setOpeningScenarioId] = useState<string | null>(null);
  const [deletingScenarioId, setDeletingScenarioId] = useState<string | null>(null);
  const [runningPresetId, setRunningPresetId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showLoanCalc, setShowLoanCalc] = useState(false);
  const [pending, start] = useTransition();
  const [historyRows, setHistoryRows] = useState(history);

  const [name, setName] = useState(selectedScenario?.input.name ?? prefill?.name ?? "");
  const [goalItemName, setGoalItemName] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState(String(selectedScenario?.input.monthlyIncome ?? toNum(prefill?.monthlyIncome, Math.max(0, baseline.monthlyIncome))));
  const [monthlyExpenses, setMonthlyExpenses] = useState(String(selectedScenario?.input.monthlyExpenses ?? toNum(prefill?.monthlyExpenses, Math.max(0, baseline.monthlyExpenses))));
  const [currentSavings, setCurrentSavings] = useState(String(selectedScenario?.input.startingSavings ?? toNum(prefill?.startingSavings, Math.max(0, baseline.actualSavings))));
  const [projectionMonths, setProjectionMonths] = useState(String(selectedScenario?.input.horizonMonths ?? toNum(prefill?.horizonMonths, 12)));
  const [goalCost, setGoalCost] = useState(String(selectedScenario?.input.targetAmount ?? toNum(prefill?.targetAmount, 0)));
  const [timeframeType, setTimeframeType] = useState<"MONTHS" | "DATE">("MONTHS");
  const [targetMonths, setTargetMonths] = useState(String(selectedScenario?.input.targetMonths ?? toNum(prefill?.horizonMonths, 12)));
  const [targetDate, setTargetDate] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [debtBalance, setDebtBalance] = useState("0");
  const [debtApr, setDebtApr] = useState("18");
  const [debtMinPayment, setDebtMinPayment] = useState("0");
  const [extraDebtPayment, setExtraDebtPayment] = useState("0");
  const [debtStrategy, setDebtStrategy] = useState<"AVALANCHE" | "SNOWBALL">("AVALANCHE");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(selectedScenario?.result ?? null);
  const [lastScenarioId, setLastScenarioId] = useState<string | null>(selectedScenario?.id ?? null);

  useEffect(() => {
    setHistoryRows(history);
  }, [history]);

  useEffect(() => {
    if (!selectedScenario) return;
    setOpeningScenarioId(null);
    setLastScenarioId(selectedScenario.id);
    setName(selectedScenario.input.name);
    setMonthlyIncome(String(selectedScenario.input.monthlyIncome));
    setMonthlyExpenses(String(selectedScenario.input.monthlyExpenses));
    setCurrentSavings(String(selectedScenario.input.startingSavings));
    setProjectionMonths(String(selectedScenario.input.horizonMonths));
    setGoalCost(String(selectedScenario.input.targetAmount));
    setTargetMonths(String(selectedScenario.input.targetMonths));
    setResult(selectedScenario.result);
    setMode(selectedScenario.input.targetAmount > 0 ? "GOAL" : "LIVELIHOOD");
  }, [selectedScenario]);

  useEffect(() => {
    if (!result || !resultsRef.current) return;
    resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const decision = useMemo(() => {
    if (!result) return null;
    const surplusLabel = result.projectedNet >= 0 ? "Monthly surplus" : "Monthly shortfall";
    const runway = result.runwayMonths === null ? "No negative month in projection" : `${result.runwayMonths} month(s)`;
    const targetStatus =
      result.targetAmount <= 0
        ? "No goal target set"
        : result.monthsToTarget === null
          ? "Not reachable at current pace"
          : `Reachable in about ${result.monthsToTarget} month(s)`;
    const advice =
      result.projectedNet >= 0
        ? `You have a surplus of ${toMoney(result.projectedNet, currency, fxRate)} per month. Keep expenses steady to grow savings.`
        : `You are short by ${toMoney(Math.abs(result.projectedNet), currency, fxRate)} per month. Reduce expenses or increase income.`;
    const targetAdvice =
      result.targetAmount <= 0
        ? "Set a goal cost to estimate target timeline."
        : result.monthsToTarget === null
          ? `To hit ${toMoney(result.targetAmount, currency, fxRate)}, increase surplus by reducing expenses or raising income.`
          : `At this pace, you can hit ${toMoney(result.targetAmount, currency, fxRate)} in ${result.monthsToTarget} month(s).`;
    return { surplusLabel, runway, targetStatus, advice, targetAdvice };
  }, [currency, fxRate, result]);
  const historyBusy = openingScenarioId !== null || deletingScenarioId !== null || pending;

  const runWith = (params: {
    runName: string;
    income: number;
    expenses: number;
    savings: number;
    horizon: number;
    target: number;
    targetMonthsValue: number;
    onSettled?: () => void;
  }) => {
    setMessage(null);
    start(async () => {
      try {
        const debtBal = Math.max(0, toNum(debtBalance, 0));
        const response = await runScenario({
          name: params.runName,
          monthlyIncome: Math.max(0, params.income),
          monthlyExpenses: Math.max(0, params.expenses),
          startingSavings: Math.max(0, params.savings),
          horizonMonths: Math.max(1, params.horizon),
          targetAmount: Math.max(0, params.target),
          targetMonths: Math.max(1, params.targetMonthsValue),
          debtBalance: debtBal,
          debtApr: debtBal > 0 ? Math.max(0, toNum(debtApr, 18)) : undefined,
          debtMinPayment: debtBal > 0 ? Math.max(0, toNum(debtMinPayment, 0)) : undefined,
          extraDebtPayment: debtBal > 0 ? Math.max(0, toNum(extraDebtPayment, 0)) : undefined,
          debtStrategy: debtBal > 0 ? debtStrategy : undefined,
        });
        setResult(response.result);
        setLastScenarioId(response.scenarioId);
        setMessage("Simulation complete.");
        router.replace(`/simulate?scenario=${response.scenarioId}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to run simulation.");
      } finally {
        params.onSettled?.();
      }
    });
  };

  const stressPresets = [
    { id: "baseline", title: "Baseline", subtitle: "Keep current inputs", incomeMult: 1, expenseMult: 1, savingsAdd: 0 },
    { id: "tighten-spend", title: "Tighten spend", subtitle: "Expenses -15%", incomeMult: 1, expenseMult: 0.85, savingsAdd: 0 },
    { id: "income-drop", title: "Income drop", subtitle: "Income -20%", incomeMult: 0.8, expenseMult: 1, savingsAdd: 0 },
    { id: "expense-spike", title: "Expense spike", subtitle: "Expenses +30%", incomeMult: 1, expenseMult: 1.3, savingsAdd: 0 },
    { id: "side-income", title: "Side income", subtitle: "Income +20%", incomeMult: 1.2, expenseMult: 1, savingsAdd: 0 },
    { id: "aggressive-save", title: "Aggressive save", subtitle: "Expenses -10%, savings +5%", incomeMult: 1, expenseMult: 0.9, savingsAdd: 0.05 },
    { id: "debt-pressure", title: "Debt pressure", subtitle: "Expenses +20%, income -10%", incomeMult: 0.9, expenseMult: 1.2, savingsAdd: -0.1 },
    { id: "recession", title: "Recession stress", subtitle: "Income -30%, expenses +10%", incomeMult: 0.7, expenseMult: 1.1, savingsAdd: -0.2 },
  ] as const;

  return (
    <div className="space-y-6">
      {openingScenarioId ? (
        <section className="card p-6">
          <p className="text-sm font-semibold">Loading scenario...</p>
          <div className="mt-3 animate-pulse space-y-2">
            <div className="h-9 rounded-xl bg-black/10" />
            <div className="h-9 rounded-xl bg-black/10" />
            <div className="h-24 rounded-xl bg-black/10" />
          </div>
        </section>
      ) : null}

      <section className="card p-6">
        <h2 className="text-sm font-semibold">Simulation mode</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            { id: "GOAL" as const, title: "Buy Something", subtitle: "Can I reach a target by time?" },
            { id: "LIVELIHOOD" as const, title: "Livelihood", subtitle: "Will my month-to-month life stay stable?" },
            { id: "STRESS" as const, title: "Stress Tests", subtitle: "Run one-click shocks quickly." },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-xl border p-4 text-left transition ${mode === item.id ? "border-sky-400 bg-sky-50" : "border-black/10 bg-white hover:bg-black/[0.02]"}`}
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-black/60">{item.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold">{mode === "GOAL" ? "Buy Something Simulation" : mode === "LIVELIHOOD" ? "Livelihood Simulation" : "Stress Test Presets"}</h2>
        {mode === "STRESS" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {stressPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={pending || runningPresetId !== null}
                onClick={() => {
                  setRunningPresetId(preset.id);
                  const income = toNum(monthlyIncome, Math.max(0, baseline.monthlyIncome)) * preset.incomeMult;
                  const expenses = toNum(monthlyExpenses, Math.max(0, baseline.monthlyExpenses)) * preset.expenseMult;
                  const savings = Math.max(0, toNum(currentSavings, 0) + toNum(currentSavings, 0) * preset.savingsAdd);
                  runWith({
                    runName: `Stress: ${preset.title}`,
                    income,
                    expenses,
                    savings,
                    horizon: Math.max(1, toNum(projectionMonths, 12)),
                    target: 0,
                    targetMonthsValue: Math.max(1, toNum(targetMonths, 12)),
                    onSettled: () => setRunningPresetId(null),
                  });
                }}
                className="rounded-xl border border-black/10 bg-white p-4 text-left hover:bg-black/[0.02] disabled:opacity-60"
                aria-busy={runningPresetId === preset.id || undefined}
              >
                <p className="text-sm font-semibold">{preset.title}</p>
                <p className="mt-1 text-xs text-black/60">{preset.subtitle}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700">
                  {runningPresetId === preset.id ? (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                  ) : null}
                  {runningPresetId === preset.id ? "Running..." : "Run preset"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label>
                <div className="text-xs text-black/60">Scenario name</div>
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === "GOAL" ? "e.g. Save for new phone" : "e.g. Monthly stability check"}
                />
              </label>

              {mode === "GOAL" ? (
                <label>
                  <div className="text-xs text-black/60">What are you saving for? (optional)</div>
                  <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" value={goalItemName} onChange={(e) => setGoalItemName(e.target.value)} placeholder="e.g. New laptop, holiday trip" />
                </label>
              ) : null}

              {mode === "GOAL" ? (
                <label>
                  <div className="flex items-center gap-2 text-xs text-black/60">
                    Goal cost (target amount)
                    <InfoTip id="goal-cost" text="This is how much you want to reach (for example the TV cost)." openTip={openTip} setOpenTip={setOpenTip} />
                  </div>
                  <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" inputMode="decimal" value={goalCost} onChange={(e) => setGoalCost(e.target.value)} />
                </label>
              ) : (
                <label>
                  <div className="flex items-center gap-2 text-xs text-black/60">
                    How far should we project?
                    <InfoTip id="horizon" text="How many months to look into the future." openTip={openTip} setOpenTip={setOpenTip} />
                  </div>
                  <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" inputMode="numeric" value={projectionMonths} onChange={(e) => setProjectionMonths(e.target.value)} />
                </label>
              )}
            </div>

            {mode === "GOAL" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label>
                  <div className="text-xs text-black/60">Target timeframe type</div>
                  <select className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" value={timeframeType} onChange={(e) => setTimeframeType(e.target.value === "DATE" ? "DATE" : "MONTHS")}>
                    <option value="MONTHS">In X months</option>
                    <option value="DATE">By a date</option>
                  </select>
                </label>
                {timeframeType === "MONTHS" ? (
                  <label>
                    <div className="flex items-center gap-2 text-xs text-black/60">
                      How far should we project?
                      <InfoTip id="horizon" text="How many months to look into the future." openTip={openTip} setOpenTip={setOpenTip} />
                    </div>
                    <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" inputMode="numeric" value={targetMonths} onChange={(e) => setTargetMonths(e.target.value)} />
                  </label>
                ) : (
                  <label>
                    <div className="text-xs text-black/60">Target date</div>
                    <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                  </label>
                )}
              </div>
            ) : null}

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label>
                <div className="text-xs text-black/60">Income (monthly)</div>
                <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" inputMode="decimal" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
              </label>
              <label>
                <div className="text-xs text-black/60">Expenses (monthly)</div>
                <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" inputMode="decimal" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} />
              </label>
              <label>
                <div className="flex items-center gap-2 text-xs text-black/60">
                  {mode === "LIVELIHOOD" ? "Actual savings (current balance)" : "Current savings (starting balance)"}
                  <InfoTip id="current-savings" text={mode === "LIVELIHOOD" ? "This pulls from your current savings position so livelihood projections use real account context." : "This is the money you already have saved today. The simulation starts from here."} openTip={openTip} setOpenTip={setOpenTip} />
                </div>
                <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" inputMode="decimal" value={currentSavings} onChange={(e) => setCurrentSavings(e.target.value)} />
              </label>
            </div>

            <div className="mt-3">
              <button type="button" className="text-xs font-medium text-sky-700 hover:underline" onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? "Hide advanced" : "Show advanced"}
              </button>
              {showAdvanced ? (
                <div className="mt-2 rounded-xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="text-xs font-semibold text-black/70">Debt payoff scenario</p>
                    <InfoTip id="debt-payoff" text="Enter your total debt balance, interest rate (APR), and minimum payment. The simulation will factor in monthly interest and payments. Avalanche pays highest-rate debt first; Snowball pays smallest balance first." openTip={openTip} setOpenTip={setOpenTip} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <div className="text-xs text-black/60">Total debt balance</div>
                      <input className="mt-1 h-9 w-full rounded-xl border border-black/15 px-3 text-sm" inputMode="decimal" value={debtBalance} onChange={(e) => setDebtBalance(e.target.value)} placeholder="0" />
                    </label>
                    <label>
                      <div className="text-xs text-black/60">APR (%)</div>
                      <input className="mt-1 h-9 w-full rounded-xl border border-black/15 px-3 text-sm" inputMode="decimal" value={debtApr} onChange={(e) => setDebtApr(e.target.value)} placeholder="18" />
                    </label>
                    <label>
                      <div className="text-xs text-black/60">Min. monthly payment</div>
                      <input className="mt-1 h-9 w-full rounded-xl border border-black/15 px-3 text-sm" inputMode="decimal" value={debtMinPayment} onChange={(e) => setDebtMinPayment(e.target.value)} placeholder="0" />
                    </label>
                    <label>
                      <div className="text-xs text-black/60">Extra payment / month</div>
                      <input className="mt-1 h-9 w-full rounded-xl border border-black/15 px-3 text-sm" inputMode="decimal" value={extraDebtPayment} onChange={(e) => setExtraDebtPayment(e.target.value)} placeholder="0" />
                    </label>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs text-black/60">Payoff strategy</div>
                    <div className="mt-1 flex gap-3">
                      {(["AVALANCHE", "SNOWBALL"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDebtStrategy(s)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${debtStrategy === s ? "border-sky-400 bg-sky-50 text-sky-700" : "border-black/15 text-black/60 hover:bg-black/[0.03]"}`}
                        >
                          {s === "AVALANCHE" ? "Avalanche (highest APR first)" : "Snowball (smallest balance first)"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-black/40">Simulation remains sandbox-only — never modifies your real budget or transactions.</p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                loading={pending}
                disabled={pending}
                className="w-full sm:w-auto"
                onClick={() => {
                  const income = Math.max(0, toNum(monthlyIncome, baseline.monthlyIncome));
                  const expenses = Math.max(0, toNum(monthlyExpenses, baseline.monthlyExpenses));
                  const savings = Math.max(0, toNum(currentSavings, 0));
                  const goal = mode === "GOAL" ? Math.max(0, toNum(goalCost, 0)) : 0;
                  const computedTargetMonths =
                    mode === "GOAL"
                      ? timeframeType === "DATE"
                        ? (() => {
                            if (!targetDate) return Math.max(1, toNum(targetMonths, 12));
                            const now = new Date();
                            const due = new Date(targetDate);
                            const diff = (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth()) + 1;
                            return Math.max(1, diff);
                          })()
                        : Math.max(1, toNum(targetMonths, 12))
                      : Math.max(1, toNum(projectionMonths, 12));

                  if (mode === "GOAL" && goal <= 0) {
                    setMessage("Goal cost is required in Buy Something mode.");
                    return;
                  }

                  runWith({
                    runName: mode === "GOAL" && goalItemName.trim() ? `${name || "Goal simulation"}: ${goalItemName.trim()}` : name || "Simulation run",
                    income,
                    expenses,
                    savings,
                    horizon: computedTargetMonths,
                    target: goal,
                    targetMonthsValue: computedTargetMonths,
                  });
                }}
              >
                {pending ? "Running..." : "Run simulation"}
              </Button>
              {message ? <p className="text-sm text-black/70">{message}</p> : null}
            </div>
          </>
        )}
      </section>

      {result ? (
        <section ref={resultsRef} className="card p-6">
          <h2 className="text-sm font-semibold">Results</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-black/60">{decision?.surplusLabel}</p>
                <InfoTip id="card-surplus" text="Net monthly amount after income minus expenses." openTip={openTip} setOpenTip={setOpenTip} />
              </div>
              <p className={`mt-1 text-lg font-semibold ${result.projectedNet < 0 ? "text-rose-700" : "text-emerald-700"}`}>{toMoney(result.projectedNet, currency, fxRate)}</p>
              <p className="mt-1 text-xs text-black/60">{result.projectedNet < 0 ? "Short by this amount monthly." : "This amount can build savings monthly."}</p>
            </article>
            <article className="rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-black/60">Ending balance</p>
                <InfoTip id="card-ending" text="Projected balance at the end of your selected projection horizon." openTip={openTip} setOpenTip={setOpenTip} />
              </div>
              <p className="mt-1 text-lg font-semibold">{toMoney(result.endingBalance, currency, fxRate)}</p>
              <p className="mt-1 text-xs text-black/60">Where your balance lands by the final month.</p>
            </article>
            <article className="rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-black/60">Runway</p>
                <InfoTip id="card-runway" text="How long your money lasts before first negative month." openTip={openTip} setOpenTip={setOpenTip} />
              </div>
              <p className="mt-1 text-lg font-semibold">{decision?.runway}</p>
              <p className="mt-1 text-xs text-black/60">Stability check for monthly life plan.</p>
            </article>
            <article className="rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-black/60">Target status</p>
                <InfoTip id="card-target" text="Target reach status using this scenario pace and target amount." openTip={openTip} setOpenTip={setOpenTip} />
              </div>
              <p className="mt-1 text-lg font-semibold">{decision?.targetStatus}</p>
              <p className="mt-1 text-xs text-black/60">{result.targetAmount > 0 ? "Goal reachability summary." : "Set goal cost in Buy Something mode."}</p>
            </article>
          </div>

          <div className="mt-4">
            <BalanceChart points={result.timeline} currency={currency} fxRate={fxRate} targetAmount={result.targetAmount} />
            <p className="mt-2 text-xs text-black/60">
              This line shows your projected balance over time. If it goes below 0, you would run out of money in that month.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm">
            <p className="font-semibold">What this chart means</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-black/75">
              <li>Each point is your expected month-end balance.</li>
              <li>A downward line means expenses are outrunning income.</li>
              <li>Crossing below zero means money is exhausted.</li>
              <li>Target marker shows when your goal cost is reached.</li>
            </ul>
          </div>

          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
            <p className="font-semibold">Advice</p>
            <p className="mt-1 text-black/80">{decision?.advice}</p>
            <p className="mt-1 text-black/80">{decision?.targetAdvice}</p>
          </div>
        </section>
      ) : null}

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Loan calculator</h2>
            <p className="mt-0.5 text-xs text-black/60">Estimate monthly repayments with compound or simple interest.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowLoanCalc((v) => !v)}>
            {showLoanCalc ? "Hide" : "Open"}
          </Button>
        </div>
      </section>
      {showLoanCalc ? <LoanCalculator currency={currency} fxRate={fxRate} openTip={openTip} setOpenTip={setOpenTip} /> : null}

      <section className="card p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Scenario history</h2>
          <InfoTip id="history" text="Saved runs you can reopen later." openTip={openTip} setOpenTip={setOpenTip} />
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {historyRows.length === 0 ? <p className="text-black/60">No saved scenarios yet.</p> : null}
          {historyRows.map((item) => {
            const busy = historyBusy || openingScenarioId === item.id || deletingScenarioId === item.id;
            return (
              <div key={item.id} className={`rounded-xl border px-3 py-2 ${lastScenarioId === item.id ? "border-sky-300 bg-sky-50/50" : "border-black/10"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{item.name}</p>
                  <p className={`text-xs font-semibold ${item.projectedNet !== null && item.projectedNet < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {item.projectedNet === null ? "N/A" : toMoney(item.projectedNet, currency, fxRate)}
                  </p>
                </div>
                <p className="text-xs text-black/60">{formatUtcDateTime(item.createdAt)} UTC</p>
                <p className="mt-1 text-xs text-black/65">
                  Ending balance: {item.endingBalance === null ? "N/A" : toMoney(item.endingBalance, currency, fxRate)} | Runway:{" "}
                  {item.runwayMonths === null ? "N/A" : `${item.runwayMonths} month(s)`}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={openingScenarioId === item.id}
                    disabled={busy}
                    onClick={() => {
                      setOpeningScenarioId(item.id);
                      setLastScenarioId(item.id);
                      router.push(`/simulate?scenario=${item.id}`);
                    }}
                  >
                    Open
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDeleteId(item.id)}>
                    Delete
                  </Button>
                  <InfoTip id={`reopen-${item.id}`} text="Loads saved inputs and saved results for this scenario." openTip={openTip} setOpenTip={setOpenTip} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ModalDialog open={Boolean(confirmDeleteId)} onClose={() => setConfirmDeleteId(null)} labelledBy="delete-scenario-title" describedBy="delete-scenario-desc">
        <h3 id="delete-scenario-title" className="text-base font-semibold text-[color:var(--text-primary)]">Delete scenario?</h3>
        <p id="delete-scenario-desc" className="mt-1 text-sm text-[color:var(--text-secondary)]">This cannot be undone.</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-rose-600 text-white hover:bg-rose-700"
            loading={pending}
            disabled={pending}
            onClick={() => {
              const scenarioId = confirmDeleteId;
              if (!scenarioId) return;
              setDeletingScenarioId(scenarioId);
              setHistoryRows((prev) => prev.filter((row) => row.id !== scenarioId));
              setConfirmDeleteId(null);
              start(async () => {
                try {
                  await deleteScenario(scenarioId);
                  if (lastScenarioId === scenarioId) {
                    setResult(null);
                    setLastScenarioId(null);
                    router.replace("/simulate");
                  } else {
                    router.refresh();
                  }
                } catch {
                  router.refresh();
                } finally {
                  setDeletingScenarioId(null);
                }
              });
            }}
          >
            Delete
          </Button>
        </div>
      </ModalDialog>
    </div>
  );
}
