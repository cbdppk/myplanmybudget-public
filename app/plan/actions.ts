"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createBudgetCategory as createBudgetCategoryRepo, saveBudgetTargets as saveBudgetTargetsRepo } from "@/lib/data/budgets";
import { requireUser } from "@/lib/auth/session";

const SaveBudgetSchema = z.object({
  items: z.array(
    z.object({
      categoryId: z.string().min(1),
      amount: z.number().min(0),
    })
  ),
});

const CreateBudgetCategorySchema = z.object({
  name: z.string().min(2).max(80),
  kind: z.enum(["expense", "savings"]),
});

export async function saveBudgetTargets(input: z.infer<typeof SaveBudgetSchema>) {
  try {
    await requireUser();
    const data = SaveBudgetSchema.parse(input);
    await saveBudgetTargetsRepo(data.items);
    revalidatePath("/budget");
    revalidatePath("/plan");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("saveBudgetTargets failed", error);
    throw new Error("Unable to save budget right now. Please try again.");
  }
}

export async function createBudgetCategory(input: z.infer<typeof CreateBudgetCategorySchema>) {
  try {
    await requireUser();
    const data = CreateBudgetCategorySchema.parse(input);
    await createBudgetCategoryRepo(data);
    revalidatePath("/budget");
    revalidatePath("/plan");
    return { ok: true };
  } catch (error) {
    console.error("createBudgetCategory failed", error);
    throw new Error("Unable to add category right now. Please try again.");
  }
}
