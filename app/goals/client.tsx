"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTip } from "../settings/_components/help-tip";
import { addGoalSavings, createGoal, deleteGoal, saveFundingSource } from "./actions";

type GoalItem = {
  id: string;
  name: string;
  target: number;
  current: number;
  remaining: number;
  dueDate: Date | string | null;
  monthsLeft: number | null;
  monthlyNeeded: number | null;
  weeklyNeeded: number | null;
  approvedNow: boolean;
  monthsAtCurrentCapacity: number | null;
  recommendation: string;
  progressPct: number;
};

type FundingSource = "SAVINGS_ONLY" | "SAVINGS_PLUS_SURPLUS" | "SURPLUS_ONLY";

function toMoney(value: number, currency: string, fxRate = 1) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value * fxRate);
}

function monthsUntilDateInput(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMonths = (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
  return Math.max(1, diffMonths + 1);
}

export function GoalsClient({
  currency,
  fxRate,
  initialGoals,
  initialFundingSource,
  snapshot,
}: {
  currency: string;
  fxRate: number;
  initialGoals: GoalItem[];
  initialFundingSource: FundingSource;
  snapshot: {
    baselineIncome: number;
    baselineExpense: number;
    baselineSavings: number;
    baselineOutgoing: number;
    baselineSurplus: number;
    availableForGoalsMonthly: number;
    availableSavingsForGoals: number;
    availableSurplusForGoals: number;
    extraIncome: number;
    extraExpense: number;
    totalGoalCurrent: number;
  };
}) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [draftCurrent, setDraftCurrent] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [removeGoalId, setRemoveGoalId] = useState<string | null>(null);
  const [doneGoalId, setDoneGoalId] = useState<string | null>(null);
  const [fundingSource, setFundingSource] = useState<FundingSource>(initialFundingSource);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { setGoals(initialGoals); }, [initialGoals]);
  useEffect(() => { setFundingSource(initialFundingSource); }, [initialFundingSource]);

  const summary = useMemo(() => {
    const totalTarget = goals.reduce((sum, item) => sum + item.target, 0);
    const totalCurrent = goals.reduce((sum, item) => sum + item.current, 0);
    const totalRemaining = Math.max(0, totalTarget - totalCurrent);
    const avgProgress = goals.length > 0 ? goals.reduce((sum, item) => sum + item.progressPct, 0) / goals.length : 0;
    return { totalTarget, totalCurrent, totalRemaining, avgProgress };
  }, [goals]);

  const selectedAvailableNow =
    fundingSource === "SAVINGS_ONLY"
      ? snapshot.availableSavingsForGoals
      : fundingSource === "SURPLUS_ONLY"
        ? snapshot.availableSurplusForGoals
        : snapshot.availableSavingsForGoals + snapshot.availableSurplusForGoals;

  const plannerPreview = useMemo(() => {
    const parsedTarget = Number(target) || 0;
    const parsedCurrent = Number(current) || 0;
    const remaining = Math.max(0, parsedTarget - parsedCurrent);
    const monthsLeft = monthsUntilDateInput(dueDate);
    const monthlyNeeded = monthsLeft ? remaining / monthsLeft : null;
    return { remaining, monthsLeft, monthlyNeeded };
  }, [current, dueDate, target]);

  const affordabilityCards = [
    {
      label: "Monthly surplus",
      value: snapshot.baselineSurplus,
      help: "What's left from your planned income after covering all planned expenses and savings — your breathing room each month.",
    },
    {
      label: "Available for goals / month",
      value: snapshot.availableForGoalsMonthly,
      help: `Estimated monthly room after factoring in real income and expense activity. Current extras: +${snapshot.extraIncome.toFixed(2)} income, -${snapshot.extraExpense.toFixed(2)} expense.`,
    },
    {
      label: "Savings available",
      value: snapshot.availableSavingsForGoals,
      help: "Your budgeted savings plus any extra savings you've logged, minus what's already assigned to existing goals.",
    },
    {
      label: "Surplus available",
      value: snapshot.availableSurplusForGoals,
      help: "Leftover surplus this period from baseline plus extra income minus extra expense.",
    },
  ];

  function handleDoneGoal(goalId: string, fromSavings: boolean) {
    start(async () => {
      try {
        await deleteGoal(goalId);
        setDoneGoalId(null);
        toast.success(fromSavings ? "Goal marked complete. Savings used." : "Goal marked complete.");
        router.refresh();
      } catch {
        toast.error("Failed to complete goal.");
      }
    });
  }

  const doneGoal = goals.find((g) => g.id === doneGoalId) ?? null;

  return (
    <div className="space-y-6">
      {/* Affordability summary */}
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Savings overview</h2>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Switch funding source to see how much is available for your goals under each scenario.</p>
          </div>
          <div className="w-full text-xs sm:w-auto">
            <p className="mb-2 text-[color:var(--text-secondary)]">Funding source</p>
            <div className="flex flex-wrap items-center gap-2">
              {(["SAVINGS_ONLY", "SAVINGS_PLUS_SURPLUS", "SURPLUS_ONLY"] as FundingSource[]).map((source) => {
                const label = source === "SAVINGS_ONLY" ? "Savings only" : source === "SURPLUS_ONLY" ? "Surplus only" : "Savings + surplus";
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => {
                      setFundingSource(source);
                      start(async () => { await saveFundingSource(source); });
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${fundingSource === source ? "bg-sky-700 text-white" : "border [border-color:var(--border)] bg-[color:var(--card-bg)] text-[color:var(--text-secondary)]"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[color:var(--text-secondary)]">
              Available now: <span className="font-semibold text-[color:var(--text-primary)]">{toMoney(selectedAvailableNow, currency, fxRate)}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
          {affordabilityCards.map((card) => (
            <div key={card.label} className="rounded-2xl border [border-color:var(--border)] bg-black/[0.03] dark:bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[color:var(--text-secondary)]">{card.label}</p>
                <HelpTip text={card.help} />
              </div>
              <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{toMoney(card.value, currency, fxRate)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Goal list — BEFORE summary */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Your goals</h2>
          <Button size="sm" onClick={() => setShowCreateForm((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {showCreateForm ? "Cancel" : "Create goal"}
          </Button>
        </div>

        {/* Create form — collapsible */}
        {showCreateForm && (
          <div className="mt-4 rounded-2xl border [border-color:var(--border)] bg-[color:var(--page-secondary)] p-5">
            <p className="text-sm font-semibold">New goal</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="goal-name">What are you saving for?</Label>
                <Input
                  id="goal-name"
                  className="mt-2 h-11 rounded-xl"
                  placeholder="Emergency fund, new laptop, holiday trip..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="goal-target">Target amount</Label>
                <Input
                  id="goal-target"
                  className="mt-2 h-11 rounded-xl"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="goal-current">Already saved</Label>
                <Input
                  id="goal-current"
                  className="mt-2 h-11 rounded-xl"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="goal-date">Target date (optional)</Label>
                <Input
                  id="goal-date"
                  className="mt-2 h-11 rounded-xl"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">Leave blank for an open-ended goal.</p>
              </div>
            </div>
            {/* Preview */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
              <div className="rounded-xl bg-[color:var(--card-bg)] border [border-color:var(--border)] px-3 py-2">
                <p className="text-xs text-[color:var(--text-secondary)]">Remaining to save</p>
                <p className="font-semibold">{toMoney(plannerPreview.remaining, currency, fxRate)}</p>
              </div>
              <div className="rounded-xl bg-[color:var(--card-bg)] border [border-color:var(--border)] px-3 py-2">
                <p className="text-xs text-[color:var(--text-secondary)]">Monthly need</p>
                <p className="font-semibold">{plannerPreview.monthlyNeeded === null ? "No deadline" : toMoney(plannerPreview.monthlyNeeded, currency, fxRate)}</p>
              </div>
              <div className="rounded-xl bg-[color:var(--card-bg)] border [border-color:var(--border)] px-3 py-2">
                <p className="text-xs text-[color:var(--text-secondary)]">Available now</p>
                <p className="font-semibold">{toMoney(selectedAvailableNow, currency, fxRate)}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                loading={pending}
                disabled={pending || !name.trim() || !target}
                onClick={() => {
                  setMessage(null);
                  start(async () => {
                    try {
                      await createGoal({
                        name,
                        target: Number(target) || 0,
                        current: Number(current) || 0,
                        dueDate: dueDate || undefined,
                      });
                      setName(""); setTarget(""); setCurrent("0"); setDueDate("");
                      setShowCreateForm(false);
                      setMessage("Goal added.");
                      toast.success("Goal added.");
                      router.refresh();
                    } catch (error) {
                      const msg = error instanceof Error ? error.message : "Failed to add goal.";
                      setMessage(msg);
                      toast.error(msg);
                    }
                  });
                }}
              >
                Save goal
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)} disabled={pending}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed [border-color:var(--border)] py-10 text-center">
              <p className="text-sm text-[color:var(--text-muted)]">No goals yet.</p>
              <button type="button" onClick={() => setShowCreateForm(true)} className="mt-2 text-sm text-sky-600 underline underline-offset-2">
                Create your first goal
              </button>
            </div>
          ) : null}
          {goals.map((goal) => {
            const availableNow = selectedAvailableNow;
            const remaining = Math.max(0, goal.target - goal.current);
            const remainingAfterAvailable = Math.max(0, remaining - availableNow);
            const monthsLeft = goal.monthsLeft ?? 12;
            const monthlyNeed = monthsLeft > 0 ? remainingAfterAvailable / monthsLeft : null;
            const weeklyNeed = monthlyNeed !== null ? (monthlyNeed * 12) / 52 : null;
            const timeToGoal =
              remaining <= 0
                ? 0
                : remainingAfterAvailable <= 0
                  ? 0
                  : snapshot.availableForGoalsMonthly > 0
                    ? Math.ceil(remainingAfterAvailable / snapshot.availableForGoalsMonthly)
                    : null;
            const advice =
              remaining <= 0
                ? "Goal reached! Mark it done."
                : availableNow >= remaining
                  ? "You can fund this now from the selected source."
                  : snapshot.availableForGoalsMonthly > 0
                    ? `Need about ${(monthlyNeed ?? 0).toFixed(2)} monthly (${(weeklyNeed ?? 0).toFixed(2)} weekly).`
                    : "Insufficient surplus and savings. Reduce expenses or increase income first.";
            const isComplete = remaining <= 0;

            return (
              <article key={goal.id} className={`rounded-xl border p-4 text-sm ${isComplete ? "border-emerald-200 bg-emerald-500/10" : "[border-color:var(--border)]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{goal.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isComplete ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-black/[0.05] dark:bg-white/[0.05] text-[color:var(--text-secondary)]"}`}>
                    {goal.progressPct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-black/10 dark:bg-white/10">
                  <div className={`h-2 rounded-full ${isComplete ? "bg-emerald-500" : "bg-sky-600"}`} style={{ width: `${Math.min(100, goal.progressPct)}%` }} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-[color:var(--text-muted)]">Target</p>
                    <p className="font-semibold">{toMoney(goal.target, currency, fxRate)}</p>
                  </div>
                  <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-[color:var(--text-muted)]">Saved</p>
                    <p className="font-semibold">{toMoney(goal.current, currency, fxRate)}</p>
                  </div>
                  <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-[color:var(--text-muted)]">Remaining</p>
                    <p className="font-semibold">{toMoney(goal.remaining, currency, fxRate)}</p>
                  </div>
                </div>
                {!isComplete && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2">
                      <p className="text-[11px] text-[color:var(--text-muted)]">Monthly need</p>
                      <p className="font-semibold">{monthlyNeed === null ? "N/A" : toMoney(monthlyNeed, currency, fxRate)}</p>
                    </div>
                    <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2">
                      <p className="text-[11px] text-[color:var(--text-muted)]">Time to goal</p>
                      <p className="font-semibold">{timeToGoal === null ? "N/A" : `${timeToGoal} month${timeToGoal === 1 ? "" : "s"}`}</p>
                    </div>
                  </div>
                )}
                <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${isComplete ? "border-emerald-200 bg-emerald-500/10" : availableNow >= remaining && remaining > 0 ? "border-emerald-200 bg-emerald-500/10" : "[border-color:var(--border)] bg-black/[0.02] dark:bg-white/[0.02]"}`}>
                  <p className={`font-medium ${isComplete || (availableNow >= remaining && remaining > 0) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700"}`}>{advice}</p>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {!isComplete && (
                    <>
                      <Input
                        className="h-9 w-full rounded-xl sm:max-w-[160px]"
                        inputMode="decimal"
                        placeholder="Add savings"
                        value={draftCurrent[goal.id] ?? ""}
                        onChange={(e) => setDraftCurrent((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        loading={pending}
                        className="w-full sm:w-auto"
                        disabled={pending || (Number(draftCurrent[goal.id] ?? 0) || 0) <= 0}
                        onClick={() => {
                          const amount = Number(draftCurrent[goal.id] ?? 0) || 0;
                          if (amount <= 0) return;
                          start(async () => {
                            try {
                              await addGoalSavings({ goalId: goal.id, amount });
                              setDraftCurrent((prev) => ({ ...prev, [goal.id]: "" }));
                              toast.success("Savings added.");
                              router.refresh();
                            } catch {
                              toast.error("Failed to add savings.");
                            }
                          });
                        }}
                      >
                        Add savings
                      </Button>
                    </>
                  )}
                  {isComplete && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                      onClick={() => setDoneGoalId(goal.id)}
                    >
                      Mark done ✓
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setRemoveGoalId(goal.id)}
                  >
                    Remove
                  </Button>
                  <Button asChild type="button" size="sm" variant="outline" className="w-full sm:w-auto">
                    <Link
                      href={`/simulate?fromGoal=1&scenarioName=${encodeURIComponent(`${goal.name} purchase check`)}&income=${encodeURIComponent(String(snapshot.baselineIncome))}&expenses=${encodeURIComponent(String(snapshot.baselineExpense))}&startingSavings=${encodeURIComponent(String(goal.current))}&horizon=${encodeURIComponent(String(goal.monthsLeft ?? 12))}&target=${encodeURIComponent(String(goal.remaining))}`}
                    >
                      Simulate
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Goals summary */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold">Goals summary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm">
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-3">
            <p className="text-[color:var(--text-secondary)]">Total target</p>
            <p className="font-semibold">{toMoney(summary.totalTarget, currency, fxRate)}</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-3">
            <p className="text-[color:var(--text-secondary)]">Saved so far</p>
            <p className="font-semibold">{toMoney(summary.totalCurrent, currency, fxRate)}</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-3">
            <p className="text-[color:var(--text-secondary)]">Remaining</p>
            <p className="font-semibold">{toMoney(summary.totalRemaining, currency, fxRate)}</p>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-3">
            <p className="text-[color:var(--text-secondary)]">Avg progress</p>
            <p className="font-semibold">{summary.avgProgress.toFixed(1)}%</p>
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-[color:var(--text-secondary)]">{message}</p> : null}

      {/* Remove goal modal */}
      <ModalDialog open={Boolean(removeGoalId)} onClose={() => setRemoveGoalId(null)} labelledBy="remove-goal-title" describedBy="remove-goal-desc">
        <h3 id="remove-goal-title" className="text-base font-semibold text-[color:var(--text-primary)]">Remove this goal?</h3>
        <p id="remove-goal-desc" className="mt-1 text-sm text-[color:var(--text-secondary)]">
          This will remove the goal and its savings category mapping. This cannot be undone.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setRemoveGoalId(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="w-full bg-rose-600 hover:bg-rose-700 sm:w-auto"
            loading={pending}
            disabled={pending}
            onClick={() => {
              const goalId = removeGoalId;
              if (!goalId) return;
              start(async () => {
                try {
                  await deleteGoal(goalId);
                  setRemoveGoalId(null);
                  toast.success("Goal removed.");
                  router.refresh();
                } catch {
                  toast.error("Failed to remove goal.");
                }
              });
            }}
          >
            Remove goal
          </Button>
        </div>
      </ModalDialog>

      {/* Done goal modal */}
      <ModalDialog open={Boolean(doneGoalId)} onClose={() => setDoneGoalId(null)} labelledBy="done-goal-title" describedBy="done-goal-desc">
        <h3 id="done-goal-title" className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
          🎉 {doneGoal?.name ?? "Goal"} complete!
        </h3>
        <p id="done-goal-desc" className="mt-2 text-sm text-[color:var(--text-secondary)]">
          How did you complete this goal?
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            className="w-full rounded-xl border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-left text-sm hover:bg-emerald-500/20"
            onClick={() => doneGoalId && handleDoneGoal(doneGoalId, true)}
            disabled={pending}
          >
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">I purchased it using my savings</p>
            <p className="mt-0.5 text-xs text-emerald-600/70 dark:text-emerald-400/70">The money came from the savings allocated to this goal.</p>
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm hover:bg-sky-100"
            onClick={() => doneGoalId && handleDoneGoal(doneGoalId, false)}
            disabled={pending}
          >
            <p className="font-semibold text-sky-800">I received it without spending the saved money</p>
            <p className="mt-0.5 text-xs text-sky-700/70">A gift, bonus, or other source covered it — your savings remain intact.</p>
          </button>
        </div>
        <div className="mt-3">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setDoneGoalId(null)} disabled={pending}>
            Not yet
          </Button>
        </div>
      </ModalDialog>
    </div>
  );
}
