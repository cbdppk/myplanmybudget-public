import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

async function loadEngineModule() {
  const filePath = resolve("lib/sim/engine.ts");
  const source = await readFile(filePath, "utf8");

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  });

  const encoded = encodeURIComponent(transpiled.outputText);
  return import(`data:text/javascript;charset=utf-8,${encoded}`);
}

test("buildSimulationTimeline returns deterministic monthly balances", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  const simulation = buildSimulationTimeline({
    startBalance: 1000,
    monthlyIncome: 500,
    monthlyExpenses: 300,
    horizonMonths: 3,
  });

  const { timeline, summary } = simulation;

  assert.equal(timeline.length, 3);
  assert.deepEqual(
    timeline.map((point) => point.balance),
    [1200, 1400, 1600],
  );
  assert.deepEqual(timeline.map((point) => point.debtPayment), [0, 0, 0]);
  assert.equal(timeline[0]?.monthIndex, 1);
  assert.equal(timeline[2]?.monthIndex, 3);
  assert.equal(summary.negativeMonths, 0);
  assert.equal(summary.runwayMonths, null);
});

test("runway is correct when balance goes negative immediately", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  const { summary } = buildSimulationTimeline({
    startBalance: 0,
    monthlyIncome: 100,
    monthlyExpenses: 200,
    horizonMonths: 5,
  });

  assert.equal(summary.runwayMonths, 0);
  assert.ok(summary.negativeMonths > 0);
});

test("runway is correct when balance covers several months", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  // 300 balance, -100/month → goes negative at month 4 → 3 months runway
  const { summary } = buildSimulationTimeline({
    startBalance: 300,
    monthlyIncome: 100,
    monthlyExpenses: 200,
    horizonMonths: 6,
  });

  assert.equal(summary.runwayMonths, 3);
});

test("snowball pays lowest balance debt first", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  // extraDebtPayment of 500/month ensures both debts clear well within 24 months.
  // Small debt (500) is attacked first under snowball; big debt follows.
  const { summary } = buildSimulationTimeline({
    startBalance: 0,
    monthlyIncome: 2000,
    monthlyExpenses: 1000,
    horizonMonths: 24,
    debtStrategy: "SNOWBALL",
    extraDebtPayment: 500,
    debts: [
      { id: "big", name: "Big Debt", balance: 5000, aprPct: 5, minPayment: 100 },
      { id: "small", name: "Small Debt", balance: 500, aprPct: 20, minPayment: 20 },
    ],
  });

  assert.ok(summary.payoffMonth !== null, "Both debts should be paid off within horizon");
  assert.ok(summary.endingDebt < 0.02, "Ending debt should be near zero");
});

test("avalanche ends with equal or better balance than snowball on same debts", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  const makeDebts = () => [
    { id: "low-apr", name: "Low APR", balance: 1000, aprPct: 5, minPayment: 50 },
    { id: "high-apr", name: "High APR", balance: 1000, aprPct: 20, minPayment: 50 },
  ];

  const avalanche = buildSimulationTimeline({
    startBalance: 0,
    monthlyIncome: 2000,
    monthlyExpenses: 1000,
    horizonMonths: 36,
    debtStrategy: "AVALANCHE",
    debts: makeDebts(),
  });

  const snowball = buildSimulationTimeline({
    startBalance: 0,
    monthlyIncome: 2000,
    monthlyExpenses: 1000,
    horizonMonths: 36,
    debtStrategy: "SNOWBALL",
    debts: makeDebts(),
  });

  // Avalanche (highest APR first) accumulates less interest → ends with >= balance
  assert.ok(
    avalanche.summary.endingBalance >= snowball.summary.endingBalance - 0.01,
    `Avalanche (${avalanche.summary.endingBalance}) should be >= snowball (${snowball.summary.endingBalance})`,
  );
});

test("sort is deterministic with tied APR values", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  const makeInput = () => ({
    startBalance: 0,
    monthlyIncome: 3000,
    monthlyExpenses: 1000,
    horizonMonths: 12,
    debtStrategy: "AVALANCHE",
    debts: [
      { id: "a", name: "A", balance: 2000, aprPct: 10, minPayment: 100 },
      { id: "b", name: "B", balance: 1000, aprPct: 10, minPayment: 100 },
    ],
  });

  const run1 = buildSimulationTimeline(makeInput());
  const run2 = buildSimulationTimeline(makeInput());

  assert.equal(run1.summary.endingBalance, run2.summary.endingBalance);
  assert.equal(run1.summary.endingDebt, run2.summary.endingDebt);
});

test("zero income does not crash and runway reflects starting balance coverage", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  const { summary } = buildSimulationTimeline({
    startBalance: 500,
    monthlyIncome: 0,
    monthlyExpenses: 100,
    horizonMonths: 12,
  });

  // 500 / 100 = 5 months before going negative
  assert.equal(summary.runwayMonths, 5);
  assert.ok(summary.negativeMonths > 0);
});

test("interest rounding stays within 10 cents of expected over 120 months", async () => {
  const { buildSimulationTimeline } = await loadEngineModule();

  const { timeline } = buildSimulationTimeline({
    startBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    horizonMonths: 120,
    debts: [
      { id: "d", name: "Debt", balance: 10000, aprPct: 12, minPayment: 0 },
    ],
  });

  const lastPoint = timeline[timeline.length - 1];
  // 10000 * (1.01)^120 ≈ 33003.87
  const expected = 10000 * Math.pow(1 + 0.12 / 12, 120);
  assert.ok(
    Math.abs(lastPoint.totalDebt - expected) < 0.10,
    `Expected ~${expected.toFixed(2)} but got ${lastPoint.totalDebt.toFixed(2)}`,
  );
});
