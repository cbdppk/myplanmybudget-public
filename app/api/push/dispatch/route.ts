import { requireAdmin } from "@/lib/auth/permissions";
import { prismaAdmin } from "@/lib/prisma";
import webPush from "web-push";
import { timingSafeEqual } from "node:crypto";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";
import { validatePushEnv } from "@/lib/push/validate-env";

function parseMode(request: Request) {
  const url = new URL(request.url);
  const modeFromQuery = url.searchParams.get("mode");
  const modeFromHeader = request.headers.get("x-push-mode");
  const normalized = (modeFromQuery ?? modeFromHeader ?? "dry-run").toLowerCase();
  return normalized === "live" ? "live" : "dry-run";
}

export async function POST(request: Request) {
  const rateKey = `push-dispatch:${getClientKey(request)}`;
  const rate = await checkRateLimit(rateKey, 20, 60_000);
  if (!rate.allowed) {
    return Response.json({ error: "Too many dispatch requests." }, { status: 429 });
  }

  const dispatchSecret = process.env.PUSH_DISPATCH_SECRET;
  const suppliedSecret = request.headers.get("x-push-dispatch-secret");

  if (dispatchSecret) {
    const supplied = Buffer.from(suppliedSecret ?? "", "utf8");
    const expected = Buffer.from(dispatchSecret, "utf8");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    try {
      await requireAdmin();
    } catch {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const now = new Date();
  const next24h = new Date(now);
  next24h.setHours(next24h.getHours() + 24);
  const mode = parseMode(request);

  const [subscriptions, dueReminders] = await Promise.all([
    prismaAdmin.pushSubscription.findMany({
      where: { active: true },
      select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
    }),
    prismaAdmin.reminder.findMany({
      where: {
        done: false,
        dueAt: { gte: now, lte: next24h },
      },
      orderBy: { dueAt: "asc" },
      select: { id: true, userId: true, title: true, dueAt: true },
      take: 1000,
    }),
  ]);

  const activeByUser = new Map<string, string[]>();
  for (const sub of subscriptions) {
    if (!activeByUser.has(sub.userId)) activeByUser.set(sub.userId, []);
    activeByUser.get(sub.userId)?.push(sub.endpoint);
  }

  const remindersByUser = new Map<string, Array<{ id: string; title: string; dueAt: Date }>>();
  for (const reminder of dueReminders) {
    if (!remindersByUser.has(reminder.userId)) remindersByUser.set(reminder.userId, []);
    remindersByUser.get(reminder.userId)?.push({
      id: reminder.id,
      title: reminder.title,
      dueAt: reminder.dueAt,
    });
  }

  const dispatchPreview = Array.from(activeByUser.entries())
    .map(([userId, endpoints]) => {
      const reminders = remindersByUser.get(userId) ?? [];
      return {
        endpointCount: endpoints.length,
        reminderCount: reminders.length,
        nextDueAt: reminders[0]?.dueAt?.toISOString() ?? null,
      };
    })
    .filter((item) => item.reminderCount > 0);

  if (mode === "dry-run") {
    await prismaAdmin.auditEvent.create({
      data: {
        userId: dueReminders[0]?.userId ?? "system",
        action: "PUSH_DISPATCH_RUN",
        meta: {
          runAt: now.toISOString(),
          mode,
          usersTargeted: dispatchPreview.length,
          reminderCount: dispatchPreview.reduce((sum, item) => sum + item.reminderCount, 0),
        },
      },
    }).catch(() => undefined);

    return Response.json({
      ok: true,
      mode,
      usersTargeted: dispatchPreview.length,
      reminderCount: dispatchPreview.reduce((sum, item) => sum + item.reminderCount, 0),
      dispatchPreview,
    });
  }

  const pushEnv = validatePushEnv();
  if (!pushEnv.ready) {
    return Response.json(
      {
        error: "Missing VAPID keys for live mode.",
        missing: pushEnv.missing,
        hint: "Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in your environment. Run: npx web-push generate-vapid-keys",
        mode,
      },
      { status: 400 },
    );
  }
  const vapidSubject = process.env.VAPID_SUBJECT!;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY!;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const targets = subscriptions.filter((sub) => (remindersByUser.get(sub.userId)?.length ?? 0) > 0);
  const failedSubscriptions: Array<{ id: string; endpoint: string; reason: string; statusCode?: number }> = [];
  let delivered = 0;

  for (const sub of targets) {
    const reminders = remindersByUser.get(sub.userId) ?? [];
    const first = reminders[0];
    if (!first) continue;
    const title = reminders.length === 1 ? "Upcoming reminder" : `${reminders.length} upcoming reminders`;
    const body =
      reminders.length === 1
        ? `${first.title} due ${first.dueAt.toLocaleString()}`
        : `Next: ${first.title} (${first.dueAt.toLocaleString()})`;
    const payload = JSON.stringify({ title, body, url: "/reminders" });

    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      delivered += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : undefined;
      const reason = error instanceof Error ? error.message : "Push send failed.";
      failedSubscriptions.push({ id: sub.id, endpoint: sub.endpoint, reason, statusCode });
    }
  }

  const staleIds = failedSubscriptions
    .filter((item) => item.statusCode === 404 || item.statusCode === 410)
    .map((item) => item.id);
  if (staleIds.length > 0) {
    await prismaAdmin.pushSubscription.updateMany({
      where: { id: { in: staleIds } },
      data: { active: false },
    });
  }

  await prismaAdmin.auditEvent.create({
    data: {
      userId: targets[0]?.userId ?? dueReminders[0]?.userId ?? "system",
      action: "PUSH_DISPATCH_RUN",
      meta: {
        runAt: now.toISOString(),
        mode,
        subscriptionsTargeted: targets.length,
        delivered,
        failed: failedSubscriptions.length,
        staleDeactivated: staleIds.length,
      },
    },
  }).catch(() => undefined);

  return Response.json({
    ok: true,
    mode,
    subscriptionsTargeted: targets.length,
    delivered,
    failed: failedSubscriptions.length,
    staleDeactivated: staleIds.length,
    failuresSample: failedSubscriptions.slice(0, 20).map((item) => ({
      id: item.id,
      statusCode: item.statusCode,
      reason: item.reason,
    })),
  });
}
