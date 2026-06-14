import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prismaAdmin } from "@/lib/prisma";
import { resolveAssistantFeedback as resolveAssistantFeedbackRepo } from "@/lib/data/assistant-feedback";

function describeAdminError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      code: error.code,
      message: error.message,
      table: typeof error.meta?.table === "string" ? error.meta.table : null,
    };
  }
  return {
    message: error instanceof Error ? error.message : String(error),
  };
}

async function getAssistantFeedbackSnapshot() {
  try {
    const [assistantFeedback, openAssistantFeedbackCount] = await Promise.all([
      prismaAdmin.assistantFeedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 250,
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          subject: true,
          message: true,
          category: true,
          sourcePage: true,
          sourceQuestion: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          handledBy: { select: { email: true } },
        },
      }),
      prismaAdmin.assistantFeedback.count({ where: { status: "NEW" } }),
    ]);

    return { assistantFeedback, openAssistantFeedbackCount };
  } catch (error) {
    console.warn("admin_assistant_feedback_unavailable", describeAdminError(error));
    return { assistantFeedback: [], openAssistantFeedbackCount: 0 };
  }
}

export async function getAdminData() {
  const admin = await requireAdmin();
  const [
    users,
    inquiries,
    activeUsers,
    totalUsers,
    totalPushSubs,
    openInquiryCount,
    assistantFeedbackSnapshot,
  ] = await Promise.all([
    prismaAdmin.userProfile.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { transactions: true, reminders: true, pushSubscriptions: true },
        },
      },
      take: 200,
    }),
    prismaAdmin.contactInquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        handledBy: { select: { email: true } },
      },
    }),
    prismaAdmin.userProfile.count({ where: { isActive: true } }),
    prismaAdmin.userProfile.count(),
    prismaAdmin.pushSubscription.count({ where: { active: true } }),
    prismaAdmin.contactInquiry.count({ where: { status: "NEW" } }),
    getAssistantFeedbackSnapshot(),
  ]);

  return {
    admin,
    users,
    inquiries,
    assistantFeedback: assistantFeedbackSnapshot.assistantFeedback,
    stats: {
      activeUsers,
      totalUsers,
      totalPushSubs,
      openInquiryCount,
      openAssistantFeedbackCount: assistantFeedbackSnapshot.openAssistantFeedbackCount,
    },
  };
}

export async function updateUserRole(input: { targetUserId: string; role: "USER" | "ADMIN" }) {
  const admin = await requireAdmin();
  if (input.targetUserId === admin.id && input.role !== "ADMIN") {
    throw new Error("You cannot remove your own admin role.");
  }

  await prismaAdmin.userProfile.update({
    where: { id: input.targetUserId },
    data: { role: input.role },
  });

  await prismaAdmin.auditEvent.create({
    data: {
      userId: admin.id,
      action: "ADMIN_USER_ROLE_UPDATED",
      meta: { targetUserId: input.targetUserId, role: input.role },
    },
  });

  return { ok: true };
}

export async function updateUserActive(input: { targetUserId: string; isActive: boolean }) {
  const admin = await requireAdmin();
  if (input.targetUserId === admin.id && !input.isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  await prismaAdmin.userProfile.update({
    where: { id: input.targetUserId },
    data: { isActive: input.isActive },
  });

  await prismaAdmin.auditEvent.create({
    data: {
      userId: admin.id,
      action: "ADMIN_USER_STATUS_UPDATED",
      meta: { targetUserId: input.targetUserId, isActive: input.isActive },
    },
  });

  return { ok: true };
}

export async function resolveContactInquiry(input: { inquiryId: string }) {
  const admin = await requireAdmin();

  await prismaAdmin.contactInquiry.update({
    where: { id: input.inquiryId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      handledById: admin.id,
    },
  });

  await prismaAdmin.auditEvent.create({
    data: {
      userId: admin.id,
      action: "CONTACT_INQUIRY_RESOLVED",
      meta: { inquiryId: input.inquiryId },
    },
  });

  return { ok: true };
}

export async function resolveAssistantFeedback(input: { feedbackId: string }) {
  const admin = await requireAdmin();
  await resolveAssistantFeedbackRepo({ feedbackId: input.feedbackId, adminId: admin.id });
  return { ok: true };
}
