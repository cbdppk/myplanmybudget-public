/**
 * Account lockout — tracks failed login attempts per email.
 * After MAX_FAILURES consecutive failures, the account is locked for LOCKOUT_WINDOW_MS.
 * A successful login clears the counter.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const MAX_FAILURES = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function lockoutKey(email: string) {
  return createHash("sha256").update(`lockout:${email.toLowerCase().trim()}`).digest("hex");
}

export async function isAccountLockedOut(email: string): Promise<{ locked: boolean; retryAfterMs?: number }> {
  try {
    const key = lockoutKey(email);
    const now = new Date();
    const bucket = await prisma.rateLimitBucket.findUnique({
      where: { key },
      select: { count: true, resetAt: true },
    });
    if (!bucket || bucket.resetAt <= now) return { locked: false };
    if (bucket.count >= MAX_FAILURES) {
      return { locked: true, retryAfterMs: Math.max(0, bucket.resetAt.getTime() - now.getTime()) };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}

export async function recordFailedLogin(email: string): Promise<void> {
  try {
    const key = lockoutKey(email);
    const now = new Date();
    const resetAt = new Date(now.getTime() + LOCKOUT_WINDOW_MS);
    await prisma.$transaction(async (tx) => {
      const bucket = await tx.rateLimitBucket.findUnique({ where: { key }, select: { count: true, resetAt: true } });
      if (!bucket || bucket.resetAt <= now) {
        await tx.rateLimitBucket.upsert({
          where: { key },
          update: { count: 1, resetAt },
          create: { key, count: 1, resetAt },
        });
      } else {
        await tx.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
      }
    });
  } catch {
    // Non-fatal — don't block login flow if DB is temporarily unavailable
  }
}

export async function clearFailedLogins(email: string): Promise<void> {
  try {
    const key = lockoutKey(email);
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  } catch {
    // Non-fatal
  }
}
