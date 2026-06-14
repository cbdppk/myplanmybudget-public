import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";

const UnsubscribeSchema = z.object({
  endpoint: z.string().url().optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`push:unsubscribe:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is acceptable for local-only unsubscribe.
  }

  const parsed = UnsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid unsubscribe payload." }, { status: 400 });
  }

  if (parsed.data.endpoint) {
    await prisma.pushSubscription.updateMany({
      where: { userId: user.id, endpoint: parsed.data.endpoint },
      data: { active: false },
    });
  } else {
    await prisma.pushSubscription.updateMany({
      where: { userId: user.id, active: true },
      data: { active: false },
    });
  }

  await prisma.auditEvent.create({
    data: {
      userId: user.id,
      action: "PUSH_SUBSCRIPTION_REMOVE",
      meta: parsed.data,
    },
  });

  return Response.json({ ok: true });
}
