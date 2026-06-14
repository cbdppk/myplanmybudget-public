import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

let lastCleanupAt = 0;

function trimToken(value: string) {
  return value.trim().replaceAll('"', "");
}

function normalizeIp(value: string) {
  const candidate = trimToken(value);
  return isIP(candidate) ? candidate : "";
}

function ipFromForwarded(value: string) {
  if (!value || value.length > 1024) return "";
  const parts = value.split(",").map((item) => normalizeIp(item)).filter(Boolean);
  if (parts.length === 0) return "";
  // Prefer right-most valid item to reduce spoofing from prepended values.
  return parts[parts.length - 1];
}

function fallbackFingerprint(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  const host = request.headers.get("host") ?? "";
  const hash = createHash("sha256").update(`${ua}|${lang}|${host}`).digest("hex").slice(0, 16);
  return `unknown:${hash}`;
}

export function getClientKey(request: Request) {
  const direct =
    normalizeIp(request.headers.get("cf-connecting-ip") ?? "") ||
    normalizeIp(request.headers.get("x-real-ip") ?? "") ||
    normalizeIp(request.headers.get("x-client-ip") ?? "");
  if (direct) return direct;

  const forwarded =
    ipFromForwarded(request.headers.get("x-forwarded-for") ?? "") ||
    ipFromForwarded(request.headers.get("x-vercel-forwarded-for") ?? "");
  if (forwarded) return forwarded;

  return fallbackFingerprint(request);
}

function bucketKeyFor(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  // Skip rate limiting in development so local testing isn't blocked.
  if (process.env.NODE_ENV !== "production") {
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }

  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const bucketKey = bucketKeyFor(key);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.rateLimitBucket.findUnique({
        where: { key: bucketKey },
        select: { count: true, resetAt: true },
      });

      if (!current || current.resetAt <= now) {
        await tx.rateLimitBucket.upsert({
          where: { key: bucketKey },
          update: { count: 1, resetAt },
          create: { key: bucketKey, count: 1, resetAt },
        });
        return { allowed: true, remaining: Math.max(0, limit - 1) };
      }

      if (current.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, current.resetAt.getTime() - now.getTime()),
        };
      }

      const updated = await tx.rateLimitBucket.update({
        where: { key: bucketKey },
        data: { count: { increment: 1 } },
        select: { count: true, resetAt: true },
      });

      return {
        allowed: true,
        remaining: Math.max(0, limit - updated.count),
        retryAfterMs: Math.max(0, updated.resetAt.getTime() - now.getTime()),
      };
    });

    if (now.getTime() - lastCleanupAt > 5 * 60_000) {
      lastCleanupAt = now.getTime();
      void prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lte: now } } }).catch(() => undefined);
    }

    return result;
  } catch {
    // Fail closed when shared limiter is unavailable to avoid bypassing protections.
    return { allowed: false, remaining: 0, retryAfterMs: windowMs };
  }
}
