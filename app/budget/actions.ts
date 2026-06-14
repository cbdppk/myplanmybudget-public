"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveBudgetEditFlow } from "@/lib/data/budgets";
import { requireUser } from "@/lib/auth/session";

const SaveBudgetEditSchema = z.object({
  preferredCurrency: z.string().min(3).max(5),
  incomeFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  budgetStartMode: z.enum(["CURRENT_MONTH", "NEXT_MONTH"]),
  incomeAmount: z.number().min(0),
  monthlyExpense: z.number().min(0),
  monthlySavings: z.number().min(0),
  categories: z.array(
    z.object({
      id: z.string().min(1).optional(),
      name: z.string().min(1).max(80),
      kind: z.enum(["expense", "savings"]),
      amount: z.number().min(0),
      cadence: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    })
  ),
});

export async function saveBudgetEdit(input: z.infer<typeof SaveBudgetEditSchema>) {
  await requireUser();
  const data = SaveBudgetEditSchema.parse(input);
  const result = await saveBudgetEditFlow(data);

  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/budget/edit");
  revalidatePath("/transactions");
  revalidatePath("/track");
  revalidatePath("/goals");
  revalidatePath("/simulate");
  revalidatePath("/plan");
  revalidatePath("/simulations");
  revalidatePath("/budgets");

  return result;
}
