import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { PageHeader } from "@/components/shell/page-header";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { InfoPopover } from "@/components/ui/info-popover";
import { MiniLineChart } from "@/components/feature/charts";
import { getDashboardData } from "@/lib/data/dashboard";
import { RetryDashboardButton } from "./retry-dashboard-button";
import { DashboardFilters } from "./dashboard-filters";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

function toMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function mapDashboardErrorToMessage(message: string) {
  const lower = message.toLowerCase();
  if (message.includes("ACCOUNT_DISABLED")) return "Your account is disabled. Contact support or an administrator.";
  if (message.includes("DB_IDENTITY_REQUIRED")) return "Your session context is invalid. Please sign in again.";
  if (lower.includes("can't reach database server") || lower.includes("connection") || lower.includes("timeout") || lower.includes("too many connections") || lower.includes("unable to start a transaction")) {
    return "Dashboard is temporarily unavailable because the database is busy. Please retry in a few seconds.";
  }
  return "Dashboard is temporarily unavailable. Please retry.";
}

function formatMovementLabel(raw: string, chartMode: "DAILY" | "MONTHLY" | "YEARLY", range: "WEEKLY" | "MONTHLY" | "YEARLY" | "ALL_TIME" | "SPECIFIC_MONTH") {
  if (chartMode === "YEARLY") return raw;
  if (chartMode === "MONTHLY") {
    const [year, month] = raw.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", year: range === "ALL_TIME" ? "2-digit" : undefined }).format(new Date(year, (month || 1) - 1, 1));
  }
  return new Intl.DateTimeFormat("en-US", { weekday: range === "WEEKLY" ? "short" : undefined, month: "short", day: "numeric" }).format(new Date(`${raw}T00:00:00`));
}

function DashboardMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  valueClassName,
  detail,
  detailClassName,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "good" | "bad" | "info" | "success";
  valueClassName?: string;
  detail?: string;
  detailClassName?: string;
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-500/[0.07]"
      : tone === "bad"
        ? "bg-rose-500/[0.07]"
        : tone === "info"
          ? "bg-sky-500/[0.07]"
          : tone === "success"
            ? "bg-violet-500/[0.07]"
            : "theme-card-soft";

  return (
    <div className={cn("min-w-0 rounded-2xl px-3 py-2.5", toneClass)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">{label}</p>
        <InfoPopover content={hint} label={`${label} explanation`} panelClassName="w-64" />
      </div>
      <p className={cn("mt-1 text-base font-semibold [overflow-wrap:anywhere]", valueClassName)}>{value}</p>
      {detail ? <p className={cn("mt-1 text-xs text-[color:var(--text-secondary)]", detailClassName)}>{detail}</p> : null}
    </div>
  );
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; range?: "WEEKLY" | "MONTHLY" | "YEARLY" | "ALL_TIME"; month?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const requestHeaders = await headers();
  const requestId = requestHeaders.get("x-request-id");
  const showAdminNotice = params?.notice === "admin_required";
  const showOnboardingNotice = params?.notice === "onboarding_required";
  const range = params?.range ?? "MONTHLY";
  const month = params?.month ?? undefined;

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getDashboardData({ range, month });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNAUTHENTICATED")) {
      redirect(`/login?next=${encodeURIComponent(`/dashboard`)}`);
    }
    loadError = mapDashboardErrorToMessage(message);
    console.error("dashboard_load_error", { requestId, range, message });
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <PageHeader title="Dashboard" subtitle="Money overview" />
        {showAdminNotice ? <section className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:text-amber-300">Admin access is restricted.</section> : null}
        {showOnboardingNotice ? (
          <section className="mt-4 rounded-2xl border border-sky-300/60 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:border-sky-700/40 dark:text-sky-300">
            <p>Your account is active, but onboarding is not complete yet.</p>
            <LoadingLinkButton href="/onboarding" size="sm" className="mt-2">Set up onboarding</LoadingLinkButton>
          </section>
        ) : null}
        <section className="mt-6 rounded-2xl border border-rose-200/60 bg-rose-500/10 dark:border-rose-800/40 p-5">
          <p className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p>
          {requestId ? <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400/80">Request ID: {requestId}</p> : null}
          <div className="mt-3 flex gap-2"><RetryDashboardButton /><LoadingLinkButton href="/track" size="sm" variant="outline">Open transactions</LoadingLinkButton></div>
        </section>
      </main>
    );
  }

  const displayCurrency = data.currency.preferred;
  const fxRate = data.currency.rate;
  const money = (value: number) => toMoney(value * fxRate, displayCurrency);
  const movementLabels = data.movementSeries.map((item) => formatMovementLabel(item.label, data.filters.chartMode, data.filters.range));
  const incomeSeries = data.movementSeries.map((item) => item.income);
  const outflowSeries = data.movementSeries.map((item) => item.expense);
  const movementMax = Math.max(1, ...incomeSeries, ...outflowSeries);
  const netColor = data.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const topBudgetGap = data.budgetByCategory.filter((item) => item.kind === "expense" && item.remaining < 0).sort((a, b) => a.remaining - b.remaining)[0] ?? null;

  // ── Budget consumed (real spend vs plan) ──
  // Actual expense budget used as a % of the plan, with an "expected by now" pace marker
  // so the user can see whether real spending is ahead of or behind schedule.
  const budgetConsumedPct = Math.round(Math.min(100, Math.max(0, data.budgetStatusPct)));
  const expectedPct = Math.round(Math.min(100, Math.max(0, data.expectedProgressPct)));
  const overPace = data.budgetPaceDelta > 0.01;
  const paceColor = budgetConsumedPct >= 100 ? "text-rose-600 dark:text-rose-400" : overPace ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400";
  const paceBarColor = budgetConsumedPct >= 100 ? "bg-rose-500" : overPace ? "bg-amber-500" : "bg-sky-500";

  // ── Money Health: actual cash flow for the window ──
  // Uses real recorded transactions only, so it reconciles exactly with the Money movement
  // chart totals below. The plan (baseline) is shown separately as a reference.
  const healthIncome = data.income;
  const healthExpenses = data.expenses;
  const healthSavings = data.savings;
  const healthNet = data.net;
  const plannedNetRef = data.plannedIncome - data.plannedExpenses - data.plannedSavings;
  const moneyHealthColor = healthNet >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Dashboard"
        subtitle="Live budget and transaction overview."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <LoadingLinkButton href="/track" size="sm" className="w-full sm:w-auto">Add transaction</LoadingLinkButton>
            <LoadingLinkButton href="/budget" size="sm" variant="outline" className="w-full sm:w-auto">Budget</LoadingLinkButton>
          </div>
        }
      />

      {showAdminNotice ? <section className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:text-amber-300">Admin access is restricted.</section> : null}
      {showOnboardingNotice ? (
        <section className="mt-4 rounded-2xl border border-sky-300/60 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:border-sky-700/40 dark:text-sky-300">
          <p>Onboarding not complete.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <LoadingLinkButton href="/onboarding" size="sm" className="w-full sm:w-auto">Set up</LoadingLinkButton>
            <LoadingLinkButton href="/dashboard" size="sm" variant="outline" className="w-full sm:w-auto">Dismiss</LoadingLinkButton>
          </div>
        </section>
      ) : null}

      {/* Range filter + smart month picker */}
      <DashboardFilters range={range} month={month} userMonths={data.userMonths} />

      {/* ── Hero row: Money Health (actual) + Budget Pace (estimate) ── */}
      <section className="mt-5 grid gap-4 xl:grid-cols-[1.4fr,1fr]">

        {/* Money Health — actual net cash flow + breakdown */}
        <article className="theme-card rounded-[1.75rem] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Money health · {data.filters.windowLabel}</p>
            <InfoPopover content="Your actual recorded cash flow for this window: real income minus real expenses and savings. These match the Money movement chart totals exactly." label="Money health explanation" />
          </div>
          <p className={`mt-3 text-4xl font-semibold tracking-tight sm:text-5xl ${moneyHealthColor}`}>{money(healthNet)}</p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">Plan for this window: {money(plannedNetRef)} net</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <DashboardMetricCard
              label="Income"
              value={money(healthIncome)}
              hint="All income you've actually recorded in this window."
              tone="good"
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <DashboardMetricCard
              label="Expenses"
              value={money(healthExpenses)}
              hint="All expenses you've actually recorded in this window (planned budget spend plus any off-budget extras)."
              tone="bad"
              valueClassName="text-rose-700 dark:text-rose-300"
            />
            <DashboardMetricCard
              label="Saved"
              value={money(healthSavings)}
              hint="Money you've actually moved into savings in this window."
              tone="info"
              valueClassName="text-sky-700 dark:text-sky-300"
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DashboardMetricCard
              label="Avg spend/day"
              value={money(data.burnRate)}
              hint="Blended average daily spend: your actual transaction spend rate combined with your budget daily estimate."
              detail="Transactions + budget estimate"
            />
            <DashboardMetricCard
              label="Today net"
              value={money(data.todaySummary.net)}
              hint="Today only: logged income minus logged expense and savings."
              detail={`${data.todaySummary.count} transaction${data.todaySummary.count === 1 ? "" : "s"} today`}
              valueClassName={data.todaySummary.net >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}
            />
          </div>
          <p className="theme-card-soft mt-3 rounded-2xl px-3 py-2.5 text-xs text-[color:var(--text-secondary)]">{data.moneyGist}</p>
        </article>

        {/* Budget Pace — estimated daily consumption vs plan */}
        <article className="theme-card rounded-[1.75rem] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Budget used</p>
            <InfoPopover content="Your actual expense spending as a percentage of your expense budget. The marker shows how much you'd expect to have used by today if you spent evenly — so you can tell whether you're ahead of or behind plan." label="Budget used explanation" />
          </div>
          <p className={`mt-3 text-4xl font-semibold tracking-tight ${paceColor}`}>{budgetConsumedPct}%</p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">{money(data.used)} of {money(data.budgeted)} spent</p>

          {/* Budget-used bar with expected-by-now marker */}
          <div className="relative mt-4 h-3 rounded-full bg-[color:var(--page-secondary)]">
            <div className={`h-3 rounded-full transition-all ${paceBarColor}`} style={{ width: `${budgetConsumedPct}%` }} />
            <div className="absolute top-[-3px] h-[18px] w-0.5 bg-[color:var(--text-primary)]/50" style={{ left: `${expectedPct}%` }} title="Expected by now" />
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">
            {overPace
              ? `Ahead of plan — about ${money(data.budgetPaceDelta)} over the expected pace.`
              : `On track — expected ${expectedPct}% used by now.`}
          </p>

          {topBudgetGap ? (
            <DashboardMetricCard
              label="Top over-budget"
              value={topBudgetGap.category}
              hint="The expense category with the largest negative remaining balance versus its planned target."
              detail={`Over by ${money(Math.abs(topBudgetGap.remaining))}`}
              detailClassName="text-rose-700 dark:text-rose-300"
              tone="bad"
            />
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DashboardMetricCard
                label="Savings rate"
                value={`${data.savingsRatePct}%`}
                hint="Planned savings pace plus extra savings, divided by planned income for this window."
              />
              <DashboardMetricCard
                label="Expense budget left"
                value={money(data.budgetRemaining)}
                hint="How much planned expense budget remains after logged planned-expense usage. Extra expense does not consume this budget."
                valueClassName={data.budgetRemaining >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}
              />
            </div>
          )}
        </article>
      </section>

      {/* Chart + expandable categories */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
        {/* Movement chart — bigger with summary stats */}
        <article className="theme-card rounded-[1.75rem] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[color:var(--text-secondary)]">Money movement</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{data.filters.chartLabel} · hover or tap any point for details</p>
            </div>
            <InfoPopover content="Compares actual money in and money out over the selected range. Use it to spot spikes, slow weeks, and whether outflow is outrunning income." label="Money movement explanation" />
            <div className="flex flex-wrap gap-3 text-xs text-[color:var(--text-secondary)] sm:justify-end">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-5 rounded-full bg-sky-500" />Income</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-5 rounded-full bg-orange-500" />Out</span>
            </div>
          </div>
          {/* Period totals */}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DashboardMetricCard
              label="Total in"
              value={money(data.income)}
              hint="All income recorded in the current chart window."
              tone="good"
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <DashboardMetricCard
              label="Total out"
              value={money(data.expenses + data.savings)}
              hint="All money out in the current chart window: expenses plus extra savings."
              tone="bad"
              valueClassName="text-rose-700 dark:text-rose-300"
            />
            <DashboardMetricCard
              label="Net"
              value={money(data.net)}
              hint="Income minus total out for the current chart window."
              tone={data.net >= 0 ? "neutral" : "bad"}
              valueClassName={data.net >= 0 ? "text-[color:var(--text-primary)]" : "text-rose-700 dark:text-rose-300"}
            />
          </div>
          <div className="mt-3">
            <MiniLineChart
              values={incomeSeries}
              secondValues={outflowSeries}
              minValue={0}
              maxValue={movementMax}
              xLabels={movementLabels}
              title="Money movement chart"
              legend={["Income", "Money out"]}
            />
          </div>
        </article>

        {/* Budget by category — expandable, estimate badges */}
        <article className="theme-card rounded-[1.75rem] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Budget by category</p>
            <InfoPopover
              content="Allocated is your planned budget for each category. Spent is the real total of transactions you've logged to that category this period. Remaining is what's left."
              label="Budget by category explanation"
            />
          </div>

          {data.budgetByCategory.length > 0 ? (
            <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">
              Spent reflects your real logged transactions for each category.
            </p>
          ) : null}

          <div className="mt-3 space-y-1.5">
            {data.budgetByCategory.length === 0 ? (
              <div className="rounded-2xl border border-dashed [border-color:var(--border)] px-4 py-5 text-center">
                <p className="text-sm text-[color:var(--text-secondary)]">No category budgets set yet.</p>
                <LoadingLinkButton href="/budget" size="sm" className="mt-2">Set a budget</LoadingLinkButton>
              </div>
            ) : null}

            {data.budgetByCategory.map((item) => {
              const hasActivity = item.spent > 0;
              const remainingColor = item.remaining < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400";
              return (
                <details key={item.categoryId} className="group rounded-2xl border [border-color:var(--border)] bg-[color:var(--page-secondary)] open:bg-[color:var(--card-bg)] open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium text-[color:var(--text-primary)]">{item.category}</span>
                      {!hasActivity ? (
                        <span className="shrink-0 rounded-full border [border-color:var(--border)] bg-[color:var(--page-secondary)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Unused</span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`font-semibold ${remainingColor}`}>{money(item.remaining)}</span>
                      <span className="text-[color:var(--text-muted)] transition-transform group-open:rotate-180">▾</span>
                    </div>
                  </summary>
                  <div className="space-y-1.5 border-t [border-color:var(--border)] px-3 py-3 text-xs">
                    <div className="flex justify-between text-[color:var(--text-secondary)]">
                      <span>Allocated (plan)</span>
                      <span className="font-semibold">{money(item.target)}</span>
                    </div>
                    <div className="flex justify-between text-[color:var(--text-secondary)]">
                      <span>Logged so far</span>
                      <span className={`font-semibold ${hasActivity ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-muted)]"}`}>
                        {hasActivity ? money(item.spent) : "No transactions yet"}
                      </span>
                    </div>
                    <div className={`flex justify-between font-semibold ${remainingColor}`}>
                      <span>Remaining</span>
                      <span>{money(item.remaining)}</span>
                    </div>
                    {!hasActivity ? (
                      <p className="mt-1 text-[color:var(--text-muted)]">No spending logged to this category yet.</p>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </article>
      </section>

      {/* Bottom: Recent + Goals + Reminders */}
      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Recent transactions */}
        <article className="theme-card rounded-[1.75rem] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Recent transactions</p>
            <InfoPopover content="Latest logged income, spending, and savings entries. This list shows the real transactions currently shaping the dashboard." label="Recent transactions explanation" />
            <LoadingLinkButton href="/track" size="sm" variant="outline" className="w-full sm:w-auto">View all</LoadingLinkButton>
          </div>
          <div className="mt-3 space-y-2">
            {data.recent.length === 0 ? (
              <div className="rounded-2xl border border-dashed [border-color:var(--border)] py-6 text-center">
                <p className="text-sm text-[color:var(--text-secondary)]">No transactions yet.</p>
                <LoadingLinkButton href="/track" size="sm" className="mt-2">Log first</LoadingLinkButton>
              </div>
            ) : null}
            {data.recent.map((txn) => {
              const isSavings = txn.extraType === "EXTRA_SAVINGS" || txn.category?.kind === "savings";
              const isIncome = txn.type === "INCOME";
              const label = isSavings ? "Savings" : isIncome ? "Income" : "Expense";
              const amtColor = isIncome ? "text-emerald-700 dark:text-emerald-400" : isSavings ? "text-sky-600 dark:text-sky-400" : "text-rose-600 dark:text-rose-400";
              const dotColor = isIncome ? "bg-emerald-400" : isSavings ? "bg-sky-400" : "bg-rose-400";
              return (
                <div key={txn.id} className="theme-card-soft flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[color:var(--text-primary)]">{txn.memo ?? txn.category?.name ?? label}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">{new Date(txn.occurredAt).toLocaleDateString()} · {label}</p>
                    </div>
                  </div>
                  <p className={`shrink-0 font-semibold ${amtColor}`}>
                    {isIncome ? "+" : "-"}{money(Number(txn.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        </article>

        {/* Goals */}
        <article className="theme-card rounded-[1.75rem] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Savings goals</p>
            <InfoPopover content="Your current goal count and progress. These values come from the saved goal targets and current goal balances in Prisma." label="Savings goals explanation" />
            <LoadingLinkButton href="/goals" size="sm" variant="outline" className="w-full sm:w-auto">View all</LoadingLinkButton>
          </div>
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <DashboardMetricCard
                label="Active"
                value={String(data.goalSummary.count)}
                hint="Goals that are still in progress."
              />
              <DashboardMetricCard
                label="Done"
                value={String(data.goalSummary.completed)}
                hint="Goals already completed."
                tone="good"
                valueClassName="text-emerald-700 dark:text-emerald-300"
              />
            </div>
            {data.goals.length === 0 ? (
              <div className="rounded-2xl border border-dashed [border-color:var(--border)] py-5 text-center">
                <p className="text-sm text-[color:var(--text-secondary)]">No goals yet.</p>
                <LoadingLinkButton href="/goals" size="sm" className="mt-2">Create one</LoadingLinkButton>
              </div>
            ) : null}
            {data.goals.slice(0, 3).map((goal) => (
              <div key={goal.id} className="theme-card-soft rounded-2xl px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-[color:var(--text-primary)]">{goal.name}</span>
                  <span className="shrink-0 text-[color:var(--text-secondary)]">{goal.progressPct.toFixed(0)}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[color:var(--page-secondary)]">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, goal.progressPct)}%` }} />
                </div>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">{money(Number(goal.current))} of {money(Number(goal.target))}</p>
              </div>
            ))}
          </div>
        </article>

        {/* Reminders */}
        <article className="theme-card rounded-[1.75rem] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Open reminders</p>
            <InfoPopover content="Your next open reminders, ordered by due date so the nearest item stays visible on the dashboard." label="Open reminders explanation" />
            <LoadingLinkButton href="/reminders" size="sm" variant="outline" className="w-full sm:w-auto">View all</LoadingLinkButton>
          </div>
          {data.openReminderCount > data.reminders.length ? (
            <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">Showing the next {data.reminders.length} of {data.openReminderCount} open reminders.</p>
          ) : null}
          <div className="mt-3 space-y-2">
            {data.reminders.length === 0 ? <p className="text-sm text-[color:var(--text-secondary)]">No open reminders right now.</p> : null}
            {data.reminders.map((item) => (
              <div key={item.id} className="rounded-2xl border border-amber-300/50 bg-amber-500/[0.07] px-3 py-2.5 dark:border-amber-700/30">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{item.title}</p>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{new Date(item.dueAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
          {data.notes.length > 0 ? (
            <div className="mt-4 border-t [border-color:var(--border)] pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Latest notes</p>
              <div className="mt-2 space-y-2">
                {data.notes.slice(0, 2).map((note) => (
                  <Link key={note.id} href={`/notes/${note.id}`} className="theme-card-soft block rounded-2xl px-3 py-2.5 hover:opacity-80 transition-opacity">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">{note.title?.trim() || "Untitled note"}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[color:var(--text-secondary)]">{note.content}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
