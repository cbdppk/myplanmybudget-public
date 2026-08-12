"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "./actions";
import { normalizeToMonthly, setupBudgetPeriodDays, type MoneyCadence } from "@/lib/money/frequency";
import { supportedCurrencies } from "@/lib/money/currencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Step = 1 | 2 | 3;
type StepAction = "next-2" | "next-3" | "back-1" | "back-2" | "apply-smart" | null;

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, amount);
}

function parseCategories(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function OnboardingForm({ defaultName, defaultCurrency }: { defaultName: string; defaultCurrency: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [stepPending, setStepPending] = useState<StepAction>(null);
  const [pending, start] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState(defaultName);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [accountName, setAccountName] = useState("Main Wallet");
  const [incomeFrequency, setIncomeFrequency] = useState<MoneyCadence>("MONTHLY");
  const [budgetStartMode, setBudgetStartMode] = useState<"CURRENT_MONTH" | "NEXT_MONTH">("CURRENT_MONTH");
  const [incomeAmount, setIncomeAmount] = useState("0");
  const [expenseAmount, setExpenseAmount] = useState("0");
  const [savingsAmount, setSavingsAmount] = useState("0");
  const [avgExpensePerCycle, setAvgExpensePerCycle] = useState("");
  const [avgSavingsPerCycle, setAvgSavingsPerCycle] = useState("");
  const [monthlyBills, setMonthlyBills] = useState("");
  const [expenseCategories, setExpenseCategories] = useState("Food, Transport, Rent, Utilities");
  const [savingsCategories, setSavingsCategories] = useState("Emergency Fund");
  const [enableDailyReminder, setEnableDailyReminder] = useState(true);
  const [dailyReminderHour, setDailyReminderHour] = useState("21");
  const [dailySpendEstimate, setDailySpendEstimate] = useState("");

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/dashboard?tour=start");
  }, [router]);

  const now = new Date();
  const daysInMonth = setupBudgetPeriodDays(now, budgetStartMode);
  const currencyOptions = useMemo(() => supportedCurrencies(), []);
  const monthlyIncome = useMemo(() => normalizeToMonthly(parseAmount(incomeAmount), incomeFrequency, daysInMonth), [daysInMonth, incomeAmount, incomeFrequency]);
  const monthlyExpense = useMemo(() => normalizeToMonthly(parseAmount(expenseAmount), incomeFrequency, daysInMonth), [daysInMonth, expenseAmount, incomeFrequency]);
  const monthlySavings = useMemo(() => normalizeToMonthly(parseAmount(savingsAmount), incomeFrequency, daysInMonth), [daysInMonth, savingsAmount, incomeFrequency]);
  const monthlySurplus = useMemo(() => monthlyIncome - monthlyExpense - monthlySavings, [monthlyIncome, monthlyExpense, monthlySavings]);
  const buttonsLocked = pending || stepPending !== null;

  function moveToStep(nextStep: Step, action: Exclude<StepAction, null>) {
    setError(null);
    setStepPending(action);
    window.setTimeout(() => {
      setStep(nextStep);
      setStepPending(null);
    }, 180);
  }

  function validateStepOne() {
    if (name.trim().length < 2) return "Please enter your full name (minimum 2 characters).";
    if (currency.trim().length < 3) return "Please select a valid currency.";
    if (accountName.trim().length < 2) return "Please enter a primary account name.";
    return null;
  }

  function validateStepTwo() {
    if (parseAmount(incomeAmount) <= 0) return "Income amount must be greater than 0.";
    if (parseAmount(expenseAmount) < 0) return "Expense amount cannot be negative.";
    if (parseAmount(savingsAmount) < 0) return "Savings amount cannot be negative.";
    return null;
  }

  if (redirecting) {
    return (
      <Card className="border-slate-200/90 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur">
        <CardContent className="py-10">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" aria-hidden="true" />
            <p className="text-sm text-slate-700">Setting up your workspace and opening dashboard...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/90 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur">
      <CardHeader className="pb-4">
        <p className="kicker">Baseline setup</p>
        <CardTitle>Set up your budget workspace</CardTitle>
        <CardDescription>Step {step} of 3. Every field below is saved to your account profile and budget setup.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {error ? <Alert>{error}</Alert> : null}
        {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="onboarding-name">Full name</Label>
                <Input id="onboarding-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <Label htmlFor="onboarding-currency">Preferred currency</Label>
                <select
                  id="onboarding-currency"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-sky-400/60"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                >
                  {currencyOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="onboarding-account-name">Primary account name</Label>
                <Input
                  id="onboarding-account-name"
                  className="mt-1"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Main Wallet"
                />
              </div>
              <div>
                <Label htmlFor="onboarding-income-frequency">Income frequency</Label>
                <select
                  id="onboarding-income-frequency"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-400/60"
                  value={incomeFrequency}
                  onChange={(e) => setIncomeFrequency(e.target.value as MoneyCadence)}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <Label htmlFor="onboarding-start-mode">Budget start mode</Label>
                <select
                  id="onboarding-start-mode"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-400/60"
                  value={budgetStartMode}
                  onChange={(e) => setBudgetStartMode(e.target.value as "CURRENT_MONTH" | "NEXT_MONTH")}
                >
                  <option value="CURRENT_MONTH">Current month</option>
                  <option value="NEXT_MONTH">Next month</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-600">Month start day is now automatic and uses the current date.</p>
            <div className="flex justify-end">
              <Button
                type="button"
                loading={stepPending === "next-2"}
                disabled={buttonsLocked}
                onClick={() => {
                  const validationError = validateStepOne();
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  moveToStep(2, "next-2");
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="onboarding-income-amount">Income amount ({incomeFrequency.toLowerCase()})</Label>
                <Input
                  id="onboarding-income-amount"
                  className="mt-1"
                  inputMode="decimal"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="onboarding-expense-amount">Expense amount ({incomeFrequency.toLowerCase()})</Label>
                <Input
                  id="onboarding-expense-amount"
                  className="mt-1"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="onboarding-savings-amount">Savings amount ({incomeFrequency.toLowerCase()})</Label>
                <Input
                  id="onboarding-savings-amount"
                  className="mt-1"
                  inputMode="decimal"
                  value={savingsAmount}
                  onChange={(e) => setSavingsAmount(e.target.value)}
                />
              </div>
            </div>

            {incomeFrequency !== "MONTHLY" ? (
              <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                <p className="text-sm font-semibold text-sky-900">Smart baseline helper</p>
                <p className="mt-1 text-xs text-sky-900/80">Convert cycle-based estimates into monthly totals.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="onboarding-avg-expense">Average expense ({incomeFrequency.toLowerCase()})</Label>
                    <Input
                      id="onboarding-avg-expense"
                      className="mt-1 border-sky-200"
                      inputMode="decimal"
                      value={avgExpensePerCycle}
                      onChange={(e) => setAvgExpensePerCycle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="onboarding-avg-savings">Average savings ({incomeFrequency.toLowerCase()})</Label>
                    <Input
                      id="onboarding-avg-savings"
                      className="mt-1 border-sky-200"
                      inputMode="decimal"
                      value={avgSavingsPerCycle}
                      onChange={(e) => setAvgSavingsPerCycle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="onboarding-monthly-bills">Fixed monthly bills</Label>
                    <Input
                      id="onboarding-monthly-bills"
                      className="mt-1 border-sky-200"
                      inputMode="decimal"
                      value={monthlyBills}
                      onChange={(e) => setMonthlyBills(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    loading={stepPending === "apply-smart"}
                    disabled={buttonsLocked}
                    onClick={() => {
                      setStepPending("apply-smart");
                      window.setTimeout(() => {
                        const computedExpense =
                          normalizeToMonthly(parseAmount(avgExpensePerCycle), incomeFrequency, daysInMonth) + parseAmount(monthlyBills);
                        const computedSavings = normalizeToMonthly(parseAmount(avgSavingsPerCycle), incomeFrequency, daysInMonth);
                        setExpenseAmount(computedExpense.toFixed(2));
                        setSavingsAmount(computedSavings.toFixed(2));
                        setStepPending(null);
                      }, 220);
                    }}
                  >
                    Apply smart totals
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p>Estimated monthly income: {monthlyIncome.toFixed(2)}</p>
              <p>Estimated monthly expenses: {monthlyExpense.toFixed(2)}</p>
              <p>Estimated monthly savings: {monthlySavings.toFixed(2)}</p>
              <p className={monthlySurplus < 0 ? "text-rose-700" : "text-emerald-700"}>Estimated monthly surplus: {monthlySurplus.toFixed(2)}</p>
            </section>

            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" loading={stepPending === "back-1"} disabled={buttonsLocked} onClick={() => moveToStep(1, "back-1")}>
                Back
              </Button>
              <Button
                type="button"
                loading={stepPending === "next-3"}
                disabled={buttonsLocked}
                onClick={() => {
                  const validationError = validateStepTwo();
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  moveToStep(3, "next-3");
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="onboarding-expense-categories">Expense categories (comma separated)</Label>
              <textarea
                id="onboarding-expense-categories"
                className="mt-1 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400/60"
                value={expenseCategories}
                onChange={(e) => setExpenseCategories(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="onboarding-savings-categories">Savings categories (comma separated)</Label>
              <textarea
                id="onboarding-savings-categories"
                className="mt-1 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400/60"
                value={savingsCategories}
                onChange={(e) => setSavingsCategories(e.target.value)}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={enableDailyReminder} onChange={(e) => setEnableDailyReminder(e.target.checked)} />
              Enable daily reminder
            </label>
            {enableDailyReminder ? (
              <div className="max-w-56">
                <Label htmlFor="onboarding-reminder-hour">Daily reminder hour (24h)</Label>
                <Input
                  id="onboarding-reminder-hour"
                  className="mt-1"
                  inputMode="numeric"
                  value={dailyReminderHour}
                  onChange={(e) => setDailyReminderHour(e.target.value)}
                />
              </div>
            ) : null}
            <div>
              <Label htmlFor="onboarding-daily-estimate">Daily spend estimate (optional)</Label>
              <Input
                id="onboarding-daily-estimate"
                className="mt-1 max-w-80"
                inputMode="decimal"
                value={dailySpendEstimate}
                onChange={(e) => setDailySpendEstimate(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" loading={stepPending === "back-2"} disabled={buttonsLocked} onClick={() => moveToStep(2, "back-2")}>
                Back
              </Button>
              <Button
                loading={pending}
                disabled={buttonsLocked}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  const parsedExpenseCategories = parseCategories(expenseCategories);
                  const parsedSavingsCategories = parseCategories(savingsCategories);
                  if (parsedExpenseCategories.length === 0) {
                    setError("Add at least one expense category.");
                    return;
                  }
                  if (parsedSavingsCategories.length === 0) {
                    setError("Add at least one savings category.");
                    return;
                  }

                  start(async () => {
                    try {
                      await completeOnboarding({
                        name: name.trim(),
                        currency,
                        incomeFrequency,
                        budgetStartMode,
                        accountName: accountName.trim(),
                        expenseCategories: parsedExpenseCategories,
                        savingsCategories: parsedSavingsCategories,
                        incomeAmount: parseAmount(incomeAmount),
                        expenseAmount: parseAmount(expenseAmount),
                        savingsAmount: parseAmount(savingsAmount),
                        enableDailyReminder,
                        dailyReminderHour: Math.min(23, Math.max(0, Math.floor(parseAmount(dailyReminderHour) || 21))),
                        dailySpendEstimate: dailySpendEstimate.trim() ? parseAmount(dailySpendEstimate) : undefined,
                      });
                      setMessage("Onboarding saved.");
                      setRedirecting(true);
                      router.replace("/dashboard?tour=start");
                    } catch (submitError) {
                      setError(submitError instanceof Error ? submitError.message : "Failed to complete onboarding.");
                    }
                  });
                }}
              >
                {pending ? "Saving setup..." : "Complete setup"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
