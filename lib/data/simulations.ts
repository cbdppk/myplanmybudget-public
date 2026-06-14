import { prisma } from "@/lib/prisma";
import { ensureCurrentBudgetPeriod, getActiveUser, toNumber } from "@/lib/data/utils";
import { buildSimulationTimeline } from "@/lib/sim/engine";
import { getDisplayCurrencyContext } from "@/lib/data/currency";
import { getMonthlyMoneyOverview } from "@/lib/data/money-overview";
import { withPerfTiming } from "@/lib/observability/perf";

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asTimeline(value: unknown): Array<{ monthIndex: number; balance: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const monthIndex = asNumber(row.monthIndex);
      const balance = asNumber(row.balance);
      if (monthIndex === null || balance === null) return null;
      return { monthIndex, balance };
    })
    .filter(Boolean) as Array<{ monthIndex: number; balance: number }>;
}

export async function runScenario(params: {
  name: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  startingSavings?: number;
  horizonMonths?: number;
  targetAmount?: number;
  targetMonths?: number;
  debtBalance?: number;
  debtApr?: number;
  debtMinPayment?: number;
  extraDebtPayment?: number;
  debtStrategy?: "AVALANCHE" | "SNOWBALL";
}) {
  return withPerfTiming("simulate_run_scenario", { name: params.name }, async () => {
    const user = await getActiveUser();
    const period = await ensureCurrentBudgetPeriod(user.id);

  const [expenseAgg, incomeAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "EXPENSE", occurredAt: { gte: period.startDate, lte: period.endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "INCOME", occurredAt: { gte: period.startDate, lte: period.endDate } },
      _sum: { amount: true },
    }),
  ]);

  const baseExpenses = toNumber(expenseAgg._sum.amount);
  const baseIncome = toNumber(incomeAgg._sum.amount);
  const projectedExpenses = Math.max(0, params.monthlyExpenses);
  const projectedIncome = Math.max(0, params.monthlyIncome);
  const horizonMonths = params.horizonMonths ?? 12;
  const startingSavings = Math.max(0, params.startingSavings ?? 0);
  const targetAmount = Math.max(0, params.targetAmount ?? 0);
  const targetMonths = Math.max(1, params.targetMonths ?? horizonMonths);
  const projectedNet = projectedIncome - projectedExpenses;
  const requiredIncomeForTarget = projectedExpenses + targetAmount / targetMonths;
  const monthsToTarget = projectedNet > 0 ? Math.ceil(Math.max(0, targetAmount - startingSavings) / projectedNet) : null;

  const debtBalance = Math.max(0, params.debtBalance ?? 0);
  const debts = debtBalance > 0
    ? [{ id: "debt-1", name: "Debt", balance: debtBalance, aprPct: Math.max(0, params.debtApr ?? 0), minPayment: Math.max(0, params.debtMinPayment ?? 0) }]
    : [];

  const simulation = buildSimulationTimeline({
    startBalance: startingSavings,
    monthlyIncome: projectedIncome,
    monthlyExpenses: projectedExpenses,
    horizonMonths,
    debts,
    extraDebtPayment: Math.max(0, params.extraDebtPayment ?? 0),
    debtStrategy: params.debtStrategy ?? "AVALANCHE",
  });

  const sandbox = await prisma.sandbox.create({
    data: { userId: user.id, periodId: period.id, name: params.name },
  });

  await prisma.sandboxOverride.createMany({
    data: [
      { userId: user.id, sandboxId: sandbox.id, kind: "summary", key: "scenarioInput", value: params },
      { userId: user.id, sandboxId: sandbox.id, kind: "summary", key: "incomeInput", value: projectedIncome },
      { userId: user.id, sandboxId: sandbox.id, kind: "summary", key: "expenseInput", value: projectedExpenses },
      {
        userId: user.id,
        sandboxId: sandbox.id,
        kind: "summary",
        key: "projected",
        value: {
          baseExpenses,
          baseIncome,
          projectedExpenses,
          projectedIncome,
          projectedNet,
          startingSavings,
          targetAmount,
          targetMonths,
          requiredIncomeForTarget,
          monthsToTarget,
          timeline: simulation.timeline,
          summary: simulation.summary,
        },
      },
    ],
  });

    return {
      scenarioId: sandbox.id,
      baseExpenses,
      baseIncome,
      projectedExpenses,
      projectedIncome,
      projectedNet,
      startingSavings,
      targetAmount,
      targetMonths,
      requiredIncomeForTarget,
      monthsToTarget,
      timeline: simulation.timeline,
      ...simulation.summary,
    };
  });
}

export async function getSimulationPageData(selectedScenarioId?: string) {
  return withPerfTiming("simulate_page_data", { hasSelectedScenario: Boolean(selectedScenarioId) }, async () => {
    const user = await getActiveUser();
    const period = await ensureCurrentBudgetPeriod(user.id);
    const [incomeAgg, expenseAgg, fx, overview] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "INCOME", occurredAt: { gte: period.startDate, lte: period.endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "EXPENSE", occurredAt: { gte: period.startDate, lte: period.endDate } },
      _sum: { amount: true },
    }),
    getDisplayCurrencyContext(user),
    getMonthlyMoneyOverview(user.id, { period }),
  ]);
  const historyRaw = await prisma.sandbox.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const historyIds = historyRaw.map((item) => item.id);
  const projectedRows =
    historyIds.length > 0
      ? await prisma.sandboxOverride.findMany({
          where: {
            userId: user.id,
            sandboxId: { in: historyIds },
            kind: "summary",
            key: "projected",
          },
          select: { sandboxId: true, value: true },
        })
      : [];
  const projectedNetBySandboxId = new Map<string, number | null>();
  for (const row of projectedRows) {
    const projected = (row.value ?? {}) as Record<string, unknown>;
    projectedNetBySandboxId.set(row.sandboxId, asNumber(projected.projectedNet));
  }

  const history = historyRaw.map((item) => ({
    id: item.id,
    name: item.name,
    createdAt: item.createdAt,
    projectedNet: projectedNetBySandboxId.get(item.id) ?? null,
    endingBalance: asNumber(((projectedRows.find((row) => row.sandboxId === item.id)?.value as Record<string, unknown> | undefined)?.summary as Record<string, unknown> | undefined)?.endingBalance ?? null),
    runwayMonths: asNumber(((projectedRows.find((row) => row.sandboxId === item.id)?.value as Record<string, unknown> | undefined)?.summary as Record<string, unknown> | undefined)?.runwayMonths ?? null),
  }));

  let selectedScenario: {
    id: string;
    name: string;
    createdAt: Date;
    input: {
      name: string;
      monthlyIncome: number;
      monthlyExpenses: number;
      startingSavings: number;
      horizonMonths: number;
      targetAmount: number;
      targetMonths: number;
    };
    result: {
      scenarioId: string;
      projectedExpenses: number;
      projectedIncome: number;
      projectedNet: number;
      startingSavings: number;
      targetAmount: number;
      monthsToTarget: number | null;
      runwayMonths: number | null;
      endingBalance: number;
      timeline: Array<{ monthIndex: number; balance: number }>;
    } | null;
  } | null = null;

  if (selectedScenarioId) {
    const selected = await prisma.sandbox.findFirst({
      where: { id: selectedScenarioId, userId: user.id },
      include: {
        overrides: {
          where: {
            kind: "summary",
            key: { in: ["scenarioInput", "projected"] },
          },
          select: { key: true, value: true },
        },
      },
    });

    if (selected) {
      const inputRow = selected.overrides.find((item) => item.key === "scenarioInput");
      const projectedRow = selected.overrides.find((item) => item.key === "projected");
      const raw = (inputRow?.value ?? {}) as Record<string, unknown>;
      const projectedRaw = (projectedRow?.value ?? {}) as Record<string, unknown>;
      const projectedSummary = (projectedRaw.summary ?? {}) as Record<string, unknown>;
      selectedScenario = {
        id: selected.id,
        name: selected.name,
        createdAt: selected.createdAt,
        input: {
          name: asString(raw.name) ?? selected.name,
          monthlyIncome: asNumber(raw.monthlyIncome) ?? 0,
          monthlyExpenses: asNumber(raw.monthlyExpenses) ?? 0,
          startingSavings: asNumber(raw.startingSavings) ?? 0,
          horizonMonths: asNumber(raw.horizonMonths) ?? 12,
          targetAmount: asNumber(raw.targetAmount) ?? 0,
          targetMonths: asNumber(raw.targetMonths) ?? 12,
        },
        result: projectedRow
          ? {
              scenarioId: selected.id,
              projectedExpenses: asNumber(projectedRaw.projectedExpenses) ?? 0,
              projectedIncome: asNumber(projectedRaw.projectedIncome) ?? 0,
              projectedNet: asNumber(projectedRaw.projectedNet) ?? 0,
              startingSavings: asNumber(projectedRaw.startingSavings) ?? 0,
              targetAmount: asNumber(projectedRaw.targetAmount) ?? 0,
              monthsToTarget: asNumber(projectedRaw.monthsToTarget),
              runwayMonths: asNumber(projectedSummary.runwayMonths),
              endingBalance: asNumber(projectedSummary.endingBalance) ?? 0,
              timeline: asTimeline(projectedRaw.timeline),
            }
          : null,
      };
    }
  }

    return {
      user,
      currency: { preferred: fx.preferredCurrency, rate: fx.fxRate },
      history,
      selectedScenario,
      baseline: {
        monthlyIncome: Math.max(toNumber(user.baselineIncome), toNumber(incomeAgg._sum.amount)),
        monthlyExpenses: Math.max(toNumber(user.baselineExpense), toNumber(expenseAgg._sum.amount)),
        actualSavings: Math.max(0, overview.savingsTotal),
      },
    };
  });
}

export async function deleteScenario(scenarioId: string) {
  const user = await getActiveUser();
  await prisma.sandboxOverride.deleteMany({
    where: { userId: user.id, sandboxId: scenarioId },
  });
  await prisma.sandbox.deleteMany({
    where: { userId: user.id, id: scenarioId },
  });
  return { ok: true };
}
