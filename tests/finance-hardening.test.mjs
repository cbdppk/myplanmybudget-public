import assert from "node:assert/strict";
import test from "node:test";
import { loadTsModule } from "./load-ts-module.mjs";

test("getPeriodDayMetrics respects custom period boundaries", async () => {
  const { getPeriodDayMetrics } = await loadTsModule("lib/finance/math.ts");

  const start = new Date("2026-02-10T00:00:00.000Z");
  const end = new Date("2026-03-09T23:59:59.999Z");
  const nowInside = new Date("2026-02-20T12:00:00.000Z");
  const nowAfter = new Date("2026-03-20T12:00:00.000Z");

  const inside = getPeriodDayMetrics(start, end, nowInside);
  assert.equal(inside.totalDays, 28);
  assert.equal(inside.elapsedDays, 11);

  const after = getPeriodDayMetrics(start, end, nowAfter);
  assert.equal(after.totalDays, 28);
  assert.equal(after.elapsedDays, 28);
  assert.equal(after.effectiveNow.toISOString(), end.toISOString());
});

test("getPeriodDayMetrics counts calendar days across the fall DST transition", async () => {
  const { getPeriodDayMetrics, remainingPeriodDays } = await loadTsModule("lib/finance/math.ts");
  const start = new Date("2026-11-01T04:00:00.000Z");
  const end = new Date("2026-12-01T04:59:59.999Z");
  const now = new Date("2026-11-15T17:00:00.000Z");

  const result = getPeriodDayMetrics(start, end, now, "America/New_York");
  assert.equal(result.totalDays, 30);
  assert.equal(result.elapsedDays, 15);
  assert.equal(remainingPeriodDays(result.totalDays, result.elapsedDays), 16);
});

test("setupBudgetPeriodDays uses the scheduled month for next-month budgets", async () => {
  const { setupBudgetPeriodDays } = await loadTsModule("lib/money/frequency.ts");
  const august = new Date(2026, 7, 2, 12, 0, 0);

  assert.equal(setupBudgetPeriodDays(august, "CURRENT_MONTH"), 31);
  assert.equal(setupBudgetPeriodDays(august, "NEXT_MONTH"), 30);
});

test("quick transaction posting distinguishes regular income from extra income", async () => {
  const { quickTransactionPosting } = await loadTsModule("lib/finance/transaction-shape.ts");

  assert.deepEqual(
    quickTransactionPosting({ flowMode: "INCOME", incomeKind: "REGULAR", outflowKind: "EXPENSE" }),
    { kind: "BASELINE", type: "INCOME", extraType: undefined }
  );
  assert.deepEqual(
    quickTransactionPosting({ flowMode: "INCOME", incomeKind: "EXTRA", outflowKind: "EXPENSE" }),
    { kind: "EXTRA", type: "INCOME", extraType: "EXTRA_INCOME" }
  );
});

test("extraExpenseAvailable preserves the plan and includes carry-in", async () => {
  const { extraExpenseAvailable } = await loadTsModule("lib/finance/math.ts");

  assert.equal(
    extraExpenseAvailable({
      carryIn: 100,
      baselineIncome: 3000,
      baselineExpense: 2000,
      baselineSavings: 500,
      actualIncome: 3000,
      extraIncome: 0,
      extraExpense: 200,
    }),
    400
  );
  assert.equal(
    extraExpenseAvailable({
      carryIn: 0,
      baselineIncome: 3000,
      baselineExpense: 2000,
      baselineSavings: 500,
      actualIncome: 500,
      extraIncome: 500,
      extraExpense: 0,
    }),
    1000
  );
});

test("computeCarryForwardFromGroups ignores transfer rows", async () => {
  const { computeCarryForwardFromGroups } = await loadTsModule("lib/finance/math.ts");

  const carry = computeCarryForwardFromGroups([
    { type: "INCOME", amount: 1000 },
    { type: "EXPENSE", amount: 300 },
    { type: "TRANSFER", amount: 400 },
  ]);

  assert.equal(carry, 700);
});

test("shouldQueueOfflineFallback blocks business-rule errors and permits network failures", async () => {
  const { shouldQueueOfflineFallback } = await loadTsModule("lib/offline/sync-policy.ts");

  assert.equal(shouldQueueOfflineFallback(new Error("Not possible unless you earn more. Open Simulation")), false);
  assert.equal(shouldQueueOfflineFallback(new Error("Budget is fully used. Not possible unless you earn more.")), false);
  assert.equal(shouldQueueOfflineFallback(new Error("network timeout while fetching resource")), true);
});
