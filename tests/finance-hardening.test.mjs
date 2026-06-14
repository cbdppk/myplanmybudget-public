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
