"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteScenario as deleteScenarioRepo, runScenario as runScenarioRepo } from "@/lib/data/simulations";
import { requireUser } from "@/lib/auth/session";

const RunScenarioSchema = z.object({
  name: z.string().min(2).max(80),
  monthlyIncome: z.number().min(0).max(1_000_000_000),
  monthlyExpenses: z.number().min(0).max(1_000_000_000),
  startingSavings: z.number().min(0).max(1_000_000_000).optional(),
  horizonMonths: z.number().int().min(1).max(120).optional(),
  targetAmount: z.number().min(0).max(1_000_000_000).optional(),
  targetMonths: z.number().int().min(1).max(1200).optional(),
  debtBalance: z.number().min(0).max(1_000_000_000).optional(),
  debtApr: z.number().min(0).max(200).optional(),
  debtMinPayment: z.number().min(0).max(1_000_000_000).optional(),
  extraDebtPayment: z.number().min(0).max(1_000_000_000).optional(),
  debtStrategy: z.enum(["AVALANCHE", "SNOWBALL"]).optional(),
});

export async function runScenario(input: z.infer<typeof RunScenarioSchema>) {
  await requireUser();
  const data = RunScenarioSchema.parse(input);
  const result = await runScenarioRepo(data);
  revalidatePath("/simulate");
  return { ok: true, result, scenarioId: result.scenarioId };
}

export async function deleteScenario(scenarioId: string) {
  await requireUser();
  if (!scenarioId) throw new Error("Scenario id is required.");
  await deleteScenarioRepo(scenarioId);
  revalidatePath("/simulate");
  return { ok: true };
}
