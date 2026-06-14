import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`push:subscribe:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid subscription payload." }, { status: 400 });
  }

  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: parsed.data.endpoint },
    select: { userId: true },
  });
  if (existing && existing.userId !== user.id) {
    await prisma.auditEvent
      .create({
        data: {
          userId: user.id,
          action: "PUSH_SUBSCRIPTION_TAKEOVER_BLOCKED",
          meta: { endpoint: parsed.data.endpoint },
        },
      })
      .catch(() => undefined);
    return Response.json({ error: "Subscription endpoint is already bound to another account." }, { status: 409 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    update: {
      userId: user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      expirationTime: parsed.data.expirationTime ? new Date(parsed.data.expirationTime) : null,
      active: true,
    },
    create: {
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      expirationTime: parsed.data.expirationTime ? new Date(parsed.data.expirationTime) : null,
      active: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      userId: user.id,
      action: "PUSH_SUBSCRIPTION_UPSERT",
      meta: parsed.data,
    },
  });

  return Response.json({ ok: true });
}
