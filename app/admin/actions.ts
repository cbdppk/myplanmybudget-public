"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  resolveAssistantFeedback as resolveAssistantFeedbackRepo,
  resolveContactInquiry as resolveContactInquiryRepo,
  updateUserActive as updateUserActiveRepo,
  updateUserRole as updateUserRoleRepo,
} from "@/lib/data/admin";
import { requireAdmin } from "@/lib/auth/permissions";
import { checkRateLimit } from "@/lib/security/rate-limit";

async function guardAdmin() {
  const admin = await requireAdmin();
  const rl = await checkRateLimit(`admin:${admin.id}`, 20, 60_000);
  if (!rl.allowed) throw new Error("Too many admin requests. Please slow down.");
  return admin;
}

const RoleSchema = z.object({
  targetUserId: z.string().min(8),
  role: z.enum(["USER", "ADMIN"]),
});

const ActiveSchema = z.object({
  targetUserId: z.string().min(8),
  isActive: z.boolean(),
});

const ResolveInquirySchema = z.object({
  inquiryId: z.string().min(8),
});

const ResolveAssistantFeedbackSchema = z.object({
  feedbackId: z.string().min(8),
});

export async function updateUserRole(input: z.infer<typeof RoleSchema>) {
  await guardAdmin();
  await updateUserRoleRepo(RoleSchema.parse(input));
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUserActive(input: z.infer<typeof ActiveSchema>) {
  await guardAdmin();
  await updateUserActiveRepo(ActiveSchema.parse(input));
  revalidatePath("/admin");
  return { ok: true };
}

export async function resolveContactInquiry(input: z.infer<typeof ResolveInquirySchema>) {
  await guardAdmin();
  await resolveContactInquiryRepo(ResolveInquirySchema.parse(input));
  revalidatePath("/admin");
  return { ok: true };
}

export async function resolveAssistantFeedback(input: z.infer<typeof ResolveAssistantFeedbackSchema>) {
  await guardAdmin();
  await resolveAssistantFeedbackRepo(ResolveAssistantFeedbackSchema.parse(input));
  revalidatePath("/admin");
  return { ok: true };
}
