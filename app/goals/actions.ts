"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addGoalSavings as addGoalSavingsRepo,
  createGoal as createGoalRepo,
  deleteGoal as deleteGoalRepo,
  updateGoalProgress as updateGoalProgressRepo,
} from "@/lib/data/goals";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const CreateGoalSchema = z.object({
  name: z.string().min(2).max(120),
  target: z.number().positive(),
  current: z.number().min(0).optional(),
  dueDate: z.string().optional(),
});

const UpdateGoalSchema = z.object({
  goalId: z.string().min(1),
  current: z.number().min(0),
});

const AddGoalSavingsSchema = z.object({
  goalId: z.string().min(1),
  amount: z.number().positive(),
});

export async function createGoal(input: z.infer<typeof CreateGoalSchema>) {
  await requireUser();
  await createGoalRepo(CreateGoalSchema.parse(input));
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/simulate");
  return { ok: true };
}

export async function updateGoalProgress(input: z.infer<typeof UpdateGoalSchema>) {
  await requireUser();
  await updateGoalProgressRepo(UpdateGoalSchema.parse(input));
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addGoalSavings(input: z.infer<typeof AddGoalSavingsSchema>) {
  await requireUser();
  await addGoalSavingsRepo(AddGoalSavingsSchema.parse(input));
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteGoal(goalId: string) {
  await requireUser();
  await deleteGoalRepo(goalId);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveFundingSource(source: "SAVINGS_ONLY" | "SAVINGS_PLUS_SURPLUS" | "SURPLUS_ONLY") {
  const user = await requireUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: { goalFundingSource: source },
  });
  revalidatePath("/goals");
  return { ok: true };
}
