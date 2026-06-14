"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { completeOnboarding as completeOnboardingRepo } from "@/lib/data/onboarding";
import { requireUser } from "@/lib/auth/session";

const OnboardingSchema = z.object({
  name: z.string().min(2).max(80),
  currency: z.string().min(3).max(5),
  incomeFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  budgetStartMode: z.enum(["CURRENT_MONTH", "NEXT_MONTH"]),
  accountName: z.string().min(2).max(80),
  expenseCategories: z.array(z.string().min(2).max(80)).min(1),
  savingsCategories: z.array(z.string().min(2).max(80)).min(1),
  incomeAmount: z.number().min(0),
  expenseAmount: z.number().min(0),
  savingsAmount: z.number().min(0),
  enableDailyReminder: z.boolean().optional(),
  dailyReminderHour: z.number().int().min(0).max(23).optional(),
  dailySpendEstimate: z.number().min(0).optional(),
});

export async function completeOnboarding(input: z.infer<typeof OnboardingSchema>) {
  await requireUser();
  const data = OnboardingSchema.parse(input);
  await completeOnboardingRepo(data);
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}
