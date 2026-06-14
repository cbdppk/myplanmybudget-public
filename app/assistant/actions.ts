"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/data/utils";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAssistantFeedback } from "@/lib/data/assistant-feedback";
import { ASSISTANT_FEEDBACK_CATEGORY_VALUES } from "@/lib/assistant/feedback";

const SubmitAssistantFeedbackSchema = z.object({
  category: z.enum(ASSISTANT_FEEDBACK_CATEGORY_VALUES),
  subject: z.string().min(3).max(160),
  message: z.string().min(10).max(4000),
  sourceQuestion: z.string().max(4000).optional(),
});

export async function submitAssistantFeedback(input: z.infer<typeof SubmitAssistantFeedbackSchema>) {
  const user = await getActiveUser();
  const rate = await checkRateLimit(`assistant-feedback:${user.id}`, 8, 60_000);
  if (!rate.allowed) {
    throw new Error("Too many feedback messages. Please wait a moment and try again.");
  }

  const data = SubmitAssistantFeedbackSchema.parse(input);

  const feedback = await createAssistantFeedback({
    userId: user.id,
    name: user.name,
    email: user.email,
    category: data.category,
    subject: data.subject,
    message: data.message,
    sourceQuestion: data.sourceQuestion,
    sourcePage: "assistant",
  });

  revalidatePath("/admin");

  return { ok: true, feedbackId: feedback.id };
}
