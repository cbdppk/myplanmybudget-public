import { prismaAdmin } from "@/lib/prisma";
import { assistantFeedbackCategoryLabel, type AssistantFeedbackCategory } from "@/lib/assistant/feedback";

export async function createAssistantFeedback(input: {
  userId: string;
  name?: string | null;
  email: string;
  subject?: string | null;
  message: string;
  category: AssistantFeedbackCategory;
  sourceQuestion?: string | null;
  sourcePage?: string | null;
}) {
  const feedback = await prismaAdmin.assistantFeedback.create({
    data: {
      userId: input.userId,
      name: input.name?.trim() || null,
      email: input.email.trim().toLowerCase(),
      subject: input.subject?.trim() || null,
      message: input.message.trim(),
      category: input.category,
      sourceQuestion: input.sourceQuestion?.trim() || null,
      sourcePage: input.sourcePage?.trim() || "assistant",
    },
    select: { id: true, createdAt: true, category: true },
  });

  const admins = await prismaAdmin.userProfile.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prismaAdmin.auditEvent.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        action: "ASSISTANT_FEEDBACK_RECEIVED",
        meta: {
          feedbackId: feedback.id,
          category: feedback.category,
          categoryLabel: assistantFeedbackCategoryLabel(feedback.category as AssistantFeedbackCategory),
          at: feedback.createdAt.toISOString(),
        },
      })),
    }).catch(() => undefined);
  }

  return feedback;
}

export async function resolveAssistantFeedback(input: { feedbackId: string; adminId: string }) {
  await prismaAdmin.assistantFeedback.update({
    where: { id: input.feedbackId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      handledById: input.adminId,
    },
  });

  await prismaAdmin.auditEvent.create({
    data: {
      userId: input.adminId,
      action: "ASSISTANT_FEEDBACK_RESOLVED",
      meta: { feedbackId: input.feedbackId },
    },
  });

  return { ok: true };
}
