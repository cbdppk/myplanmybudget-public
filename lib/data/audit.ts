import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget audit event. Never throws — audit failures must not block
 * the main operation.
 */
export function logAudit(userId: string, action: string, meta?: Record<string, unknown>) {
  void prisma.auditEvent
    .create({ data: { userId, action, meta: meta ?? undefined } })
    .catch(() => undefined);
}
