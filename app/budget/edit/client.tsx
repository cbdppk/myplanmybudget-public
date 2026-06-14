"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supportedCurrencies } from "@/lib/money/currencies";
import { normalizeToMonthly, type MoneyCadence } from "@/lib/money/frequency";
import { saveBudgetEdit } from "../actions";

type TabKey = "BEHAVIOUR" | "BUDGET" | "CATEGORIES" | "REVIEW";
type BudgetStartMode = "CURRENT_MONTH" | "NEXT_MONTH";
type CategoryKind = "expense" | "savings";

type Row = {
  localId: string;
  id?: string;
  name: string;
  kind: CategoryKind;
  amountText: string;
  cadence: MoneyCadence;
};

type InitialData = {
  periodName: string;
  daysInMonth: number;
  currency: string;
  fxRate: number;
  incomeFrequency: MoneyCadence;
  budgetStartMode: BudgetStartMode;
  incomeAmount: number;
  monthlyExpense: number;
  monthlySavings: number;
  categories: Array<{
    id: string;
    name: string;
    kind: string;
    cadence: MoneyCadence;
    enteredAmount: number;
    monthlyEquivalent: number;
  }>;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toMoney(value: number, currency: string, fxRate = 1) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value * fxRate);
}

function asAmount(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, num);
}

function QuestionTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/15 text-[10px] font-semibold text-black/60"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open ? <span className="absolute left-6 top-0 z-10 w-56 rounded-xl border border-black/10 bg-white p-2 text-xs text-black/70 shadow">{text}</span> : null}
    </span>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-blue-700 text-white" : "border border-black/15 bg-white text-black/70"}`}
    >
      {label}
    </button>
  );
}

export function BudgetEditClient({ initial }: { initial: InitialData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<TabKey>("BEHAVIOUR");
  const [incomeFrequency, setIncomeFrequency] = useState<MoneyCadence>(initial.incomeFrequency);
  const [currency, setCurrency] = useState(initial.currency);
  const [currencySearch, setCurrencySearch] = useState("");
  const [startMode, setStartMode] = useState<BudgetStartMode>(initial.budgetStartMode);

  const [incomeAmount, setIncomeAmount] = useState(initial.incomeAmount.toFixed(2));
  const [monthlyExpense, setMonthlyExpense] = useState(initial.monthlyExpense.toFixed(2));
  const [monthlySavings, setMonthlySavings] = useState(initial.monthlySavings.toFixed(2));

  const [helpOpen, setHelpOpen] = useState(false);
  const [avgSpend, setAvgSpend] = useState("");
  const [avgSave, setAvgSave] = useState("");
  const [monthlyBills, setMonthlyBills] = useState("");
  const [expenseOverridden, setExpenseOverridden] = useState(false);
  const [savingsOverridden, setSavingsOverridden] = useState(false);

  const [rows, setRows] = useState<Row[]>(
    initial.categories.map((item, index) => ({
      localId: `seed-${index}`,
      id: item.id,
      name: item.name,
      kind: item.kind === "savings" ? "savings" : "expense",
      amountText: item.enteredAmount.toFixed(2),
      cadence: item.cadence,
    }))
  );

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const currencyOptions = useMemo(() => supportedCurrencies(), []);
  const filteredCurrencyOptions = useMemo(() => {
    const q = currencySearch.trim().toUpperCase();
    if (!q) return currencyOptions;
    return currencyOptions.filter((code) => code.includes(q));
  }, [currencyOptions, currencySearch]);

  const monthStartDayNum = Math.min(28, Math.max(1, new Date().getDate()));
  const incomeMonthlyEquivalent = useMemo(() => normalizeToMonthly(asAmount(incomeAmount), incomeFrequency, initial.daysInMonth), [incomeAmount, incomeFrequency, initial.daysInMonth]);

  const expenseRows = useMemo(() => rows.filter((row) => row.kind === "expense"), [rows]);
  const savingsRows = useMemo(() => rows.filter((row) => row.kind === "savings"), [rows]);

  const expenseAllocationMonthly = useMemo(
    () => expenseRows.reduce((sum, row) => sum + normalizeToMonthly(asAmount(row.amountText), row.cadence, initial.daysInMonth), 0),
    [expenseRows, initial.daysInMonth]
  );
  const savingsAllocationMonthly = useMemo(
    () => savingsRows.reduce((sum, row) => sum + normalizeToMonthly(asAmount(row.amountText), row.cadence, initial.daysInMonth), 0),
    [savingsRows, initial.daysInMonth]
  );

  const monthlyExpenseNum = asAmount(monthlyExpense);
  const monthlySavingsNum = asAmount(monthlySavings);

  const overExpense = expenseAllocationMonthly > monthlyExpenseNum + 0.01;
  const overSavings = savingsAllocationMonthly > monthlySavingsNum + 0.01;
  const overApportioned = overExpense || overSavings;

  const expensePct = monthlyExpenseNum > 0 ? Math.min(100, Math.round((expenseAllocationMonthly / monthlyExpenseNum) * 100)) : 0;
  const savingsPct = monthlySavingsNum > 0 ? Math.min(100, Math.round((savingsAllocationMonthly / monthlySavingsNum) * 100)) : 0;

  useEffect(() => {
    if (incomeFrequency === "MONTHLY") return;
    const cadence = incomeFrequency;
    const spendMonthly = normalizeToMonthly(asAmount(avgSpend), cadence, initial.daysInMonth);
    const saveMonthly = normalizeToMonthly(asAmount(avgSave), cadence, initial.daysInMonth);
    const billsMonthly = asAmount(monthlyBills);

    if (!expenseOverridden) setMonthlyExpense(round2(spendMonthly + billsMonthly).toFixed(2));
    if (!savingsOverridden) setMonthlySavings(round2(saveMonthly).toFixed(2));
  }, [avgSave, avgSpend, expenseOverridden, incomeFrequency, initial.daysInMonth, monthlyBills, savingsOverridden]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function newRow(kind: CategoryKind): Row {
    return {
      localId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: "",
      kind,
      amountText: "0",
      cadence: "MONTHLY",
    };
  }

  function updateRow(localId: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)));
  }

  function removeRow(localId: string) {
    setRows((current) => current.filter((row) => row.localId !== localId));
  }

  function daysUntilStart() {
    if (startMode === "CURRENT_MONTH") return 0;
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), monthStartDayNum);
    const next = now >= current ? new Date(now.getFullYear(), now.getMonth() + 1, monthStartDayNum) : current;
    const ms = next.getTime() - now.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  async function onSave() {
    setError(null);
    setToast(null);

    const hasInvalidCategory = rows.some((row) => row.name.trim().length === 0);
    if (hasInvalidCategory) {
      setError("Every category row needs a name before saving.");
      setActiveTab("CATEGORIES");
      return;
    }

    if (!currency || !incomeFrequency) {
      setError("Complete required Behaviour fields before saving.");
      setActiveTab("BEHAVIOUR");
      return;
    }

    if (overApportioned) {
      setError("Category allocations exceed monthly expense or savings. Adjust allocations to continue.");
      setActiveTab("CATEGORIES");
      return;
    }

    const expenseNames = new Set<string>();
    const savingsNames = new Set<string>();
    for (const row of rows) {
      const key = row.name.trim().toLowerCase();
      if (row.kind === "expense") {
        if (expenseNames.has(key)) {
          setError(`Duplicate expense category: ${row.name.trim()}`);
          setActiveTab("CATEGORIES");
          return;
        }
        expenseNames.add(key);
      } else {
        if (savingsNames.has(key)) {
          setError(`Duplicate savings category: ${row.name.trim()}`);
          setActiveTab("CATEGORIES");
          return;
        }
        savingsNames.add(key);
      }
    }

    startTransition(async () => {
      try {
        await saveBudgetEdit({
          preferredCurrency: currency,
          incomeFrequency,
          budgetStartMode: startMode,
          incomeAmount: asAmount(incomeAmount),
          monthlyExpense: monthlyExpenseNum,
          monthlySavings: monthlySavingsNum,
          categories: rows.map((row) => ({
            id: row.id,
            name: row.name.trim(),
            kind: row.kind,
            amount: asAmount(row.amountText),
            cadence: row.cadence,
          })),
        });
        setToast("Budget changes saved.");
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save budget changes.");
      }
    });
  }

  const disableSave = pending || overApportioned || !currency || !incomeFrequency;

  return (
    <div className="space-y-4">
      <header className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--primary)]">Edit Budget</h1>
            <p className="mt-1 text-sm text-black/60">{initial.periodName} baseline and category allocations.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/budget")} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={pending} disabled={disableSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      <section className="card p-4">
        <div className="flex flex-wrap gap-2">
          <TabButton active={activeTab === "BEHAVIOUR"} onClick={() => setActiveTab("BEHAVIOUR")} label="Behaviour" />
          <TabButton active={activeTab === "BUDGET"} onClick={() => setActiveTab("BUDGET")} label="Budget" />
          <TabButton active={activeTab === "CATEGORIES"} onClick={() => setActiveTab("CATEGORIES")} label="Categories" />
          <TabButton active={activeTab === "REVIEW"} onClick={() => setActiveTab("REVIEW")} label="Review" />
        </div>

        {activeTab === "BEHAVIOUR" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 p-3">
              <p className="text-xs text-black/60">Income frequency *</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {(["DAILY", "WEEKLY", "MONTHLY"] as MoneyCadence[]).map((item) => (
                  <label key={item} className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2">
                    <input type="radio" checked={incomeFrequency === item} onChange={() => setIncomeFrequency(item)} />
                    {item.toLowerCase()}
                    <QuestionTip text="Frequency affects monthly-equivalent calculations used across budgeting and checks." />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-black/10 p-3">
              <p className="text-xs text-black/60">Currency * (searchable)</p>
              <input
                className="mt-2 h-9 w-full rounded-xl border border-black/15 px-3 text-sm"
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                placeholder="Search currency code"
              />
              <select className="mt-2 h-10 w-full rounded-xl border border-black/15 px-3 text-sm uppercase" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {filteredCurrencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-black/10 p-3 text-sm">
              <span className="text-xs text-black/60">Month start day (automatic)</span>
              <p className="mt-2 text-black/70">Automatically set to day {monthStartDayNum} based on today&apos;s date.</p>
            </div>

            <div className="rounded-xl border border-black/10 p-3">
              <p className="text-xs text-black/60">Start mode</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <label className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2">
                  <input type="radio" checked={startMode === "CURRENT_MONTH"} onChange={() => setStartMode("CURRENT_MONTH")} />
                  Start now
                </label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2">
                  <input type="radio" checked={startMode === "NEXT_MONTH"} onChange={() => setStartMode("NEXT_MONTH")} />
                  Start next month
                </label>
              </div>
              <p className="mt-2 text-xs text-black/60">Estimated activation in {daysUntilStart()} day(s).</p>
            </div>
          </div>
        ) : null}

        {activeTab === "BUDGET" ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="text-xs text-black/60">Income ({incomeFrequency.toLowerCase()})</span>
                <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} inputMode="decimal" />
                <p className="mt-1 text-xs text-black/60">Monthly equivalent: {toMoney(incomeMonthlyEquivalent, currency, initial.fxRate)}</p>
              </label>
              <label className="text-sm">
                <span className="text-xs text-black/60">Monthly expense</span>
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3"
                  value={monthlyExpense}
                  onChange={(e) => {
                    setExpenseOverridden(true);
                    setMonthlyExpense(e.target.value);
                  }}
                  inputMode="decimal"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-black/60">Monthly savings</span>
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3"
                  value={monthlySavings}
                  onChange={(e) => {
                    setSavingsOverridden(true);
                    setMonthlySavings(e.target.value);
                  }}
                  inputMode="decimal"
                />
              </label>
            </div>

            {(incomeFrequency === "DAILY" || incomeFrequency === "WEEKLY") ? (
              <div className="rounded-xl border border-black/10 p-3">
                <button type="button" className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setHelpOpen((v) => !v)}>
                  Help me calculate
                  <span>{helpOpen ? "Hide" : "Show"}</span>
                </button>
                {helpOpen ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="text-xs text-black/60">Avg spend per {incomeFrequency === "DAILY" ? "day" : "week"}</span>
                      <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" value={avgSpend} onChange={(e) => setAvgSpend(e.target.value)} inputMode="decimal" />
                    </label>
                    <label className="text-sm">
                      <span className="text-xs text-black/60">Avg save per {incomeFrequency === "DAILY" ? "day" : "week"}</span>
                      <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" value={avgSave} onChange={(e) => setAvgSave(e.target.value)} inputMode="decimal" />
                    </label>
                    <label className="text-sm">
                      <span className="text-xs text-black/60">Monthly bills total</span>
                      <input className="mt-1 h-10 w-full rounded-xl border border-black/15 px-3" value={monthlyBills} onChange={(e) => setMonthlyBills(e.target.value)} inputMode="decimal" />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "CATEGORIES" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-black/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Expense Categories</h3>
                <Button size="sm" variant="outline" onClick={() => setRows((current) => [...current, newRow("expense")])}>Add category</Button>
              </div>
              <div className="space-y-2">
                {expenseRows.map((row) => {
                  const monthlyEquivalent = normalizeToMonthly(asAmount(row.amountText), row.cadence, initial.daysInMonth);
                  return (
                    <div key={row.localId} className="rounded-xl border border-black/10 p-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_110px_120px_auto]">
                        <input className="h-9 rounded-xl border border-black/15 px-3 text-sm" value={row.name} onChange={(e) => updateRow(row.localId, { name: e.target.value })} placeholder="Category name" />
                        <input
                          className="h-9 rounded-xl border border-black/15 px-3 text-sm"
                          value={row.amountText}
                          onChange={(e) => updateRow(row.localId, { amountText: e.target.value })}
                          inputMode="decimal"
                        />
                        <select className="h-9 rounded-xl border border-black/15 px-2 text-sm" value={row.cadence} onChange={(e) => updateRow(row.localId, { cadence: e.target.value as MoneyCadence })}>
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                        <Button size="sm" variant="outline" onClick={() => removeRow(row.localId)}>
                          Remove
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-black/60">
                        Monthly equivalent: {toMoney(monthlyEquivalent, currency, initial.fxRate)} <QuestionTip text="Monthly equivalent converts daily/weekly/category frequency to monthly for allocation checks." />
                      </p>
                    </div>
                  );
                })}
                {expenseRows.length === 0 ? <p className="text-xs text-black/60">No expense categories yet.</p> : null}
              </div>

              <div className="mt-3 text-xs text-black/70">
                <div className="mb-1 flex justify-between">
                  <span>Allocated</span>
                  <span>{toMoney(expenseAllocationMonthly, currency, initial.fxRate)} / {toMoney(monthlyExpenseNum, currency, initial.fxRate)}</span>
                </div>
                <div className="h-2 rounded-full bg-black/10">
                  <div className={`h-full rounded-full ${overExpense ? "bg-red-600" : "bg-sky-600"}`} style={{ width: `${expensePct}%` }} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-black/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Savings Categories</h3>
                <Button size="sm" variant="outline" onClick={() => setRows((current) => [...current, newRow("savings")])}>Add category</Button>
              </div>
              <div className="space-y-2">
                {savingsRows.map((row) => {
                  const monthlyEquivalent = normalizeToMonthly(asAmount(row.amountText), row.cadence, initial.daysInMonth);
                  return (
                    <div key={row.localId} className="rounded-xl border border-black/10 p-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_110px_120px_auto]">
                        <input className="h-9 rounded-xl border border-black/15 px-3 text-sm" value={row.name} onChange={(e) => updateRow(row.localId, { name: e.target.value })} placeholder="Category name" />
                        <input
                          className="h-9 rounded-xl border border-black/15 px-3 text-sm"
                          value={row.amountText}
                          onChange={(e) => updateRow(row.localId, { amountText: e.target.value })}
                          inputMode="decimal"
                        />
                        <select className="h-9 rounded-xl border border-black/15 px-2 text-sm" value={row.cadence} onChange={(e) => updateRow(row.localId, { cadence: e.target.value as MoneyCadence })}>
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                        <Button size="sm" variant="outline" onClick={() => removeRow(row.localId)}>
                          Remove
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-black/60">
                        Monthly equivalent: {toMoney(monthlyEquivalent, currency, initial.fxRate)} <QuestionTip text="Monthly equivalent converts daily/weekly/category frequency to monthly for allocation checks." />
                      </p>
                    </div>
                  );
                })}
                {savingsRows.length === 0 ? <p className="text-xs text-black/60">No savings categories yet.</p> : null}
              </div>

              <div className="mt-3 text-xs text-black/70">
                <div className="mb-1 flex justify-between">
                  <span>Allocated</span>
                  <span>{toMoney(savingsAllocationMonthly, currency, initial.fxRate)} / {toMoney(monthlySavingsNum, currency, initial.fxRate)}</span>
                </div>
                <div className="h-2 rounded-full bg-black/10">
                  <div className={`h-full rounded-full ${overSavings ? "bg-red-600" : "bg-emerald-600"}`} style={{ width: `${savingsPct}%` }} />
                </div>
              </div>
            </section>

            <p className="lg:col-span-2 rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/70">
              Over-apportion rule <QuestionTip text="You cannot allocate more monthly-equivalent category totals than the monthly baseline expense/savings values." />
              : if expense allocation exceeds monthly expense or savings allocation exceeds monthly savings, Save is disabled.
            </p>
          </div>
        ) : null}

        {activeTab === "REVIEW" ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border border-black/10 p-3">
              <p className="font-semibold">Behaviour</p>
              <p className="mt-1 text-black/70">{incomeFrequency.toLowerCase()} income, {currency}, month start auto-set to day {monthStartDayNum}, {startMode === "NEXT_MONTH" ? "start next month" : "start now"}.</p>
            </div>
            <div className="rounded-xl border border-black/10 p-3">
              <p className="font-semibold">Monthly equivalents</p>
              <ul className="mt-1 space-y-1 text-black/70">
                <li>Income: {toMoney(incomeMonthlyEquivalent, currency, initial.fxRate)}</li>
                <li>Expense baseline: {toMoney(monthlyExpenseNum, currency, initial.fxRate)}</li>
                <li>Savings baseline: {toMoney(monthlySavingsNum, currency, initial.fxRate)}</li>
                <li>Expense allocated: {toMoney(expenseAllocationMonthly, currency, initial.fxRate)}</li>
                <li>Savings allocated: {toMoney(savingsAllocationMonthly, currency, initial.fxRate)}</li>
              </ul>
            </div>
            <div className={`rounded-xl border p-3 ${overApportioned ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {overApportioned
                ? "Allocation check failed: reduce over-apportioned categories before saving."
                : "Allocation check passed: you can save changes."}
            </div>
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {toast ? <p className="fixed bottom-4 right-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow">{toast}</p> : null}
    </div>
  );
}
