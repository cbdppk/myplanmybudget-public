import assert from "node:assert/strict";
import test from "node:test";
import { loadTsModule } from "./load-ts-module.mjs";

// ---------------------------------------------------------------------------
// Carry-over: periodSurplus is both the live balance and next month's carry-in.
// ---------------------------------------------------------------------------

test("periodSurplus does not double-count when the user logs their plan (old carry-in bug)", async () => {
  const { periodSurplus } = await loadTsModule("lib/data/txn-filters.ts");

  // Baseline plan: income 3000, expense 2000, savings 500.
  // The user faithfully logs the 3000 salary and 2500 of total outflow.
  const carry = periodSurplus({
    carryIn: 0,
    baselineIncome: 3000,
    actuals: { actualIncome: 3000, extraIncome: 0, actualExpense: 2000, actualSavings: 500 },
  });

  // Real leftover is 500. The old formula (baselineNet + transactionNet)
  // produced 1000 by counting both the plan and the logged reality.
  assert.equal(carry, 500);
});

test("periodSurplus uses planned income as the floor when income was never logged", async () => {
  const { periodSurplus } = await loadTsModule("lib/data/txn-filters.ts");

  const carry = periodSurplus({
    carryIn: 100,
    baselineIncome: 3000,
    actuals: { actualIncome: 0, extraIncome: 0, actualExpense: 1800, actualSavings: 200 },
  });

  // carry-in + planned income − real logged outflow: 100 + 3000 − 2000
  assert.equal(carry, 1100);
});

test("periodSurplus lets recorded income exceed the plan and adds extra income on top", async () => {
  const { periodSurplus } = await loadTsModule("lib/data/txn-filters.ts");

  const carry = periodSurplus({
    carryIn: 0,
    baselineIncome: 3000,
    // 3500 regular income logged (raise) + 400 extra income, 2500 spent.
    actuals: { actualIncome: 3900, extraIncome: 400, actualExpense: 2500, actualSavings: 0 },
  });

  assert.equal(carry, 3500 + 400 - 2500);
});

test("canonical filters only match INCOME/EXPENSE so transfers never count as money flow", async () => {
  const filters = await loadTsModule("lib/data/txn-filters.ts");
  const gte = new Date("2026-07-01T00:00:00Z");
  const lte = new Date("2026-07-31T23:59:59Z");

  assert.equal(filters.actualExpenseWhere("u1", gte, lte).type, "EXPENSE");
  assert.equal(filters.actualSavingsWhere("u1", gte, lte).type, "EXPENSE");
  assert.equal(filters.plannedExpenseWhere("u1", gte, lte).type, "EXPENSE");
  assert.equal(filters.incomeWhere("u1", gte, lte).type, "INCOME");
  assert.equal(filters.extraIncomeWhere("u1", gte, lte).type, "INCOME");
});

// ---------------------------------------------------------------------------
// Recurring occurrence math.
// ---------------------------------------------------------------------------

test("nextRunAfter monthly advances to the rule's day next month when already past it", async () => {
  const { nextRunAfter } = await loadTsModule("lib/dates.ts");

  // Logged rent on July 5 (UTC tz) — next run is Aug 5, not today or Sep.
  const next = nextRunAfter({
    cadence: "monthly",
    after: new Date("2026-07-05T12:00:00Z"),
    timeZone: "UTC",
    dayOfMonth: 5,
  });
  assert.equal(next.toISOString(), "2026-08-05T00:00:00.000Z");
});

test("nextRunAfter monthly runs later the same month when the day is still ahead", async () => {
  const { nextRunAfter } = await loadTsModule("lib/dates.ts");

  const next = nextRunAfter({
    cadence: "monthly",
    after: new Date("2026-07-02T12:00:00Z"),
    timeZone: "UTC",
    dayOfMonth: 15,
  });
  assert.equal(next.toISOString(), "2026-07-15T00:00:00.000Z");
});

test("nextRunAfter respects the user's timezone for local midnight", async () => {
  const { nextRunAfter } = await loadTsModule("lib/dates.ts");

  // Accra is UTC+0; New York in July is UTC−4, so local midnight = 04:00Z.
  const next = nextRunAfter({
    cadence: "monthly",
    after: new Date("2026-07-05T12:00:00Z"),
    timeZone: "America/New_York",
    dayOfMonth: 5,
  });
  assert.equal(next.toISOString(), "2026-08-05T04:00:00.000Z");
});

test("nextRunAfter weekly lands on the requested weekday", async () => {
  const { nextRunAfter } = await loadTsModule("lib/dates.ts");

  // 2026-07-02 is a Thursday; next Monday (dow 1) is 2026-07-06.
  const next = nextRunAfter({
    cadence: "weekly",
    after: new Date("2026-07-02T09:00:00Z"),
    timeZone: "UTC",
    dayOfWeek: 1,
  });
  assert.equal(next.toISOString(), "2026-07-06T00:00:00.000Z");
});

test("nextRunAfter daily is strictly after the reference instant", async () => {
  const { nextRunAfter } = await loadTsModule("lib/dates.ts");

  const next = nextRunAfter({
    cadence: "daily",
    after: new Date("2026-07-02T00:00:00Z"),
    timeZone: "UTC",
  });
  assert.equal(next.toISOString(), "2026-07-03T00:00:00.000Z");
});

test("normalizeCadence defaults unknown values to monthly", async () => {
  const { normalizeCadence } = await loadTsModule("lib/dates.ts");
  assert.equal(normalizeCadence("MONTHLY"), "monthly");
  assert.equal(normalizeCadence("weird"), "monthly");
  assert.equal(normalizeCadence("Weekly"), "weekly");
  assert.equal(normalizeCadence(null), "monthly");
});

// ---------------------------------------------------------------------------
// Timezone-aware boundaries.
// ---------------------------------------------------------------------------

test("dayBoundsInTz brackets the user's local day, not the server's", async () => {
  const { dayBoundsInTz } = await loadTsModule("lib/dates.ts");

  // 01:00Z on July 2 is still 21:00 on July 1 in New York (UTC−4).
  const ref = new Date("2026-07-02T01:00:00Z");
  const ny = dayBoundsInTz("America/New_York", ref);
  assert.equal(ny.start.toISOString(), "2026-07-01T04:00:00.000Z");
  assert.equal(ny.end.toISOString(), "2026-07-02T03:59:59.999Z");

  const accra = dayBoundsInTz("Africa/Accra", ref);
  assert.equal(accra.start.toISOString(), "2026-07-02T00:00:00.000Z");
  assert.equal(accra.end.toISOString(), "2026-07-02T23:59:59.999Z");
});

test("dayBoundsInTz falls back to UTC for invalid timezones", async () => {
  const { dayBoundsInTz } = await loadTsModule("lib/dates.ts");
  const ref = new Date("2026-07-02T10:00:00Z");
  const bounds = dayBoundsInTz("Not/AZone", ref);
  assert.equal(bounds.start.toISOString(), "2026-07-02T00:00:00.000Z");
});

test("monthWindowFromStartDayInTz starts the budget month on the anchor day at local midnight", async () => {
  const { monthWindowFromStartDayInTz } = await loadTsModule("lib/dates.ts");

  // Anchor day 10, reference July 2 → window is Jun 10 to Jul 9 (inclusive end ms).
  const before = monthWindowFromStartDayInTz(new Date("2026-07-02T12:00:00Z"), 10, "UTC");
  assert.equal(before.start.toISOString(), "2026-06-10T00:00:00.000Z");
  assert.equal(before.end.toISOString(), "2026-07-09T23:59:59.999Z");

  // Reference July 15 → window is Jul 10 to Aug 9.
  const after = monthWindowFromStartDayInTz(new Date("2026-07-15T12:00:00Z"), 10, "UTC");
  assert.equal(after.start.toISOString(), "2026-07-10T00:00:00.000Z");
  assert.equal(after.end.toISOString(), "2026-08-09T23:59:59.999Z");
});

test("parseDateInputInTz pins date-only input to the picked day in the user's timezone", async () => {
  const { parseDateInputInTz, getZonedParts } = await loadTsModule("lib/dates.ts");

  const instant = parseDateInputInTz("2026-07-02", "America/New_York");
  const parts = getZonedParts(instant, "America/New_York");
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 7);
  assert.equal(parts.day, 2);

  // Full timestamps pass through unchanged.
  const full = parseDateInputInTz("2026-07-02T08:30:00.000Z", "America/New_York");
  assert.equal(full.toISOString(), "2026-07-02T08:30:00.000Z");
});

// ---------------------------------------------------------------------------
// CSV import parsing + validation.
// ---------------------------------------------------------------------------

test("parseCsv handles quoted fields, escaped quotes, and CRLF", async () => {
  const { parseCsv } = await loadTsModule("lib/money/csv-import.ts");
  const rows = parseCsv('date,memo,amount\r\n2026-07-01,"lunch, with ""friends""",12.50\r\n');
  assert.deepEqual(rows, [
    ["date", "memo", "amount"],
    ["2026-07-01", 'lunch, with "friends"', "12.50"],
  ]);
});

test("normalizeImportRows maps headers, aliases, and day-first dates", async () => {
  const { parseCsv, normalizeImportRows } = await loadTsModule("lib/money/csv-import.ts");
  const { rows, errors } = normalizeImportRows(
    parseCsv(
      [
        "Date,Type,Amount,Category,Note,Pending",
        "2026-07-01,expense,45.90,Food,groceries,",
        "02/07/2026,income,1000,, salary,",
        "2026-07-03,debit,\"1,200.00\",Rent,,yes",
        "2026-07-04,weird,10,,,",
        "not-a-date,expense,10,,,",
        "2026-07-05,expense,abc,,,",
        "2026-07-06,expense,-3,,,",
      ].join("\n")
    )
  );

  // Signed bank-export amounts are accepted via abs(), so "-3" imports as 3.
  assert.equal(rows.length, 4);
  assert.equal(rows[3].amount, 3);
  assert.deepEqual(rows[0], {
    line: 2,
    occurredAt: "2026-07-01",
    type: "EXPENSE",
    amount: 45.9,
    category: "Food",
    memo: "groceries",
    pending: undefined,
  });
  assert.equal(rows[1].occurredAt, "2026-07-02");
  assert.equal(rows[1].type, "INCOME");
  assert.equal(rows[2].amount, 1200);
  assert.equal(rows[2].pending, true);
  assert.equal(errors.length, 3);
  assert.match(errors[0].reason, /Unknown type/);
  assert.match(errors[1].reason, /Unrecognized date/);
  assert.match(errors[2].reason, /Invalid amount/);
});

test("normalizeImportRows rejects files without the required headers", async () => {
  const { parseCsv, normalizeImportRows } = await loadTsModule("lib/money/csv-import.ts");
  const { rows, errors } = normalizeImportRows(parseCsv("foo,bar\n1,2\n"));
  assert.equal(rows.length, 0);
  assert.match(errors[0].reason, /must include/);
});

// ---------------------------------------------------------------------------
// Dashboard money-health income responds to the filter window.
// ---------------------------------------------------------------------------

test("windowIncome shows only recorded income for sub-month windows (today/week)", async () => {
  const { windowIncome } = await loadTsModule("lib/finance/math.ts");

  // Today: nothing recorded yet → 0, even with a 3000 monthly budget income.
  const empty = windowIncome({ baselineIncome: 3000, monthsInWindow: 0, recordedRegularIncome: 0, recordedExtraIncome: 0 });
  assert.equal(empty.total, 0);

  // This week: recorded 400 regular + 50 extra → 450, budget ignored.
  const week = windowIncome({ baselineIncome: 3000, monthsInWindow: 0, recordedRegularIncome: 400, recordedExtraIncome: 50 });
  assert.equal(week.regular, 400);
  assert.equal(week.total, 450);
});

test("windowIncome shows the full month budget income from day one", async () => {
  const { windowIncome } = await loadTsModule("lib/finance/math.ts");

  // Month, nothing recorded → full 3000 budget income.
  const fresh = windowIncome({ baselineIncome: 3000, monthsInWindow: 1, recordedRegularIncome: 0, recordedExtraIncome: 0 });
  assert.equal(fresh.total, 3000);

  // Logging the 3000 salary doesn't double it (merge, not stack).
  const logged = windowIncome({ baselineIncome: 3000, monthsInWindow: 1, recordedRegularIncome: 3000, recordedExtraIncome: 0 });
  assert.equal(logged.total, 3000);

  // Recording more than budget lifts it; extra income always adds on top.
  const raise = windowIncome({ baselineIncome: 3000, monthsInWindow: 1, recordedRegularIncome: 3500, recordedExtraIncome: 200 });
  assert.equal(raise.total, 3700);
});

test("windowIncome accrues budget income across months for year-to-date and all-time", async () => {
  const { windowIncome } = await loadTsModule("lib/finance/math.ts");

  // 7 months into the year at 3000/mo, nothing recorded → 21000 accrued.
  const ytd = windowIncome({ baselineIncome: 3000, monthsInWindow: 7, recordedRegularIncome: 0, recordedExtraIncome: 0 });
  assert.equal(ytd.total, 21000);

  // All time: 10 months since signup, recorded 32000 (more than 30000 budget)
  // plus 500 extra → recorded total wins, extra on top.
  const allTime = windowIncome({ baselineIncome: 3000, monthsInWindow: 10, recordedRegularIncome: 32000, recordedExtraIncome: 500 });
  assert.equal(allTime.total, 32500);
});

// ---------------------------------------------------------------------------
// Assistant intent routing — word-boundary matching, not substring.
// ---------------------------------------------------------------------------

const assistantCtx = {
  currency: "GHS",
  fxRate: 1,
  reminders: [],
  recent: [],
  goals: [],
  income: 0,
  expenses: 0,
  savings: 0,
  net: 0,
  budgeted: 0,
  used: 0,
  noteCount: 0,
};

test('assistant answers "What does this app do?" with the app overview (not a greeting)', async () => {
  const { resolveLocalAssistantReply } = await loadTsModule("lib/ai/local-assistant.ts");
  for (const q of ["What does this app do?", "what can this app do", "explain the app"]) {
    const reply = resolveLocalAssistantReply(q, assistantCtx);
    // The greeting used to win because "this" contains "hi"; overview must win now.
    assert.match(reply.content, /MyplanMybudget is a plan-first/, `failed for: ${q}`);
  }
});

test("assistant still routes greetings and page questions correctly", async () => {
  const { resolveLocalAssistantReply } = await loadTsModule("lib/ai/local-assistant.ts");

  const greeting = resolveLocalAssistantReply("hello there", assistantCtx);
  assert.match(greeting.content, /Ask me about the app/);

  const pageQ = resolveLocalAssistantReply("what does the budget page do?", assistantCtx);
  assert.match(pageQ.content, /Budget is the plan-first page/);
});

// Current month: 6000 income (3000 budget + 3000 extra), 900 budgeted spend,
// 400 saved, 2000 expense budget — mirrors a real dashboard context.
const monthCtx = {
  ...assistantCtx,
  periodName: "Jul 1 - Jul 31, 2026",
  windowLabel: "this month",
  availableBalance: 4700,
  net: 4700,
  monthIncome: 6000,
  monthExpenses: 900,
  monthSavings: 400,
  monthNet: 4700,
  budgeted: 2000,
  used: 322.58, // plan-released pace (must NOT appear in answers)
  actualSpent: 900,
  budgetRemaining: 1677.42, // pace-based (must NOT appear in answers)
  budgetStatusPct: 16, // pace-based (must NOT appear in answers)
  moneyGist: "You are inside budget and still keeping money available.",
  topSpend: { category: "Food", spent: 900 },
  biggestBudgetGap: null,
  goalSummary: { count: 0, completed: 0, averageProgressPct: 0, totalSaved: 0, totalTarget: 0 },
  appSummary: { transactionCount: 3, goalCount: 0, openReminderCount: 0, noteCount: 0 },
  goalPlan: null,
  lessons: [],
};

test('assistant "analyze my month" reports current-month real actuals, not pace figures', async () => {
  const { resolveLocalAssistantReply } = await loadTsModule("lib/ai/local-assistant.ts");
  const reply = resolveLocalAssistantReply("Analyze my month", monthCtx);
  assert.match(reply.content, /current month \(Jul 1 - Jul 31, 2026\)/);
  assert.match(reply.content, /Income GHS\s6,000\.00/);
  assert.match(reply.content, /spent GHS\s900\.00 of your GHS\s2,000\.00/);
  // Budget-left is budget − actual spend (1100), never the pace-based 1677.42.
  assert.match(reply.content, /leaving GHS\s1,100\.00/);
  assert.doesNotMatch(reply.content, /1,677/);
  assert.doesNotMatch(reply.content, /16%/);
});

test('assistant "budget status" is not swallowed by the analyze branch', async () => {
  const { resolveLocalAssistantReply } = await loadTsModule("lib/ai/local-assistant.ts");
  const reply = resolveLocalAssistantReply("What is my budget status?", monthCtx);
  assert.match(reply.content, /^Budget status:/);
  assert.match(reply.content, /spent GHS\s0?900\.00|spent GHS\s900\.00/);
  assert.match(reply.content, /leaving GHS\s1,100\.00/);
});

test("assistant balance and savings answers use month actuals", async () => {
  const { resolveLocalAssistantReply } = await loadTsModule("lib/ai/local-assistant.ts");
  const balance = resolveLocalAssistantReply("what is my balance", monthCtx);
  assert.match(balance.content, /net for this month is GHS\s4,700\.00/);

  const saved = resolveLocalAssistantReply("how much have i saved", monthCtx);
  assert.match(saved.content, /moved GHS\s400\.00 to savings/);
  // 400 / 6000 = 6.7% savings rate, computed from month actuals.
  assert.match(saved.content, /6\.7%/);
});
