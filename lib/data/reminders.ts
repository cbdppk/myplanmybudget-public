import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/data/utils";

export async function getOpenRemindersPreview(userId: string, take = 5) {
  const [reminders, openReminderCount] = await Promise.all([
    prisma.reminder.findMany({
      where: { userId, done: false },
      orderBy: { dueAt: "asc" },
      take,
    }),
    prisma.reminder.count({
      where: { userId, done: false },
    }),
  ]);

  return { reminders, openReminderCount };
}

export async function getRemindersData() {
  const user = await getActiveUser();
  const reminders = await prisma.reminder.findMany({
    where: { userId: user.id },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }],
    take: 50,
  });

  return { user, reminders };
}

export async function createReminder(params: { title: string; dueAt: string }) {
  const user = await getActiveUser();
  const reminder = await prisma.reminder.create({
    data: {
      userId: user.id,
      title: params.title,
      dueAt: new Date(params.dueAt),
      recurrence: "NONE",
      recurrenceInterval: 1,
    },
  });
  return { ok: true, reminder };
}

export async function createReminderWithRecurrence(params: {
  title: string;
  dueAt: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceInterval: number;
  channel?: "IN_APP" | "EMAIL" | "PUSH";
}) {
  const user = await getActiveUser();
  const reminder = await prisma.reminder.create({
    data: {
      userId: user.id,
      title: params.title,
      dueAt: new Date(params.dueAt),
      recurrence: params.recurrence,
      recurrenceInterval: Math.max(1, Math.min(30, Math.floor(params.recurrenceInterval))),
      channel: params.channel ?? "IN_APP",
    },
  });
  return { ok: true, reminder, userEmail: user.email };
}

// Writes go through updateMany/deleteMany so the tenant is part of the query
// args. The RLS extension in lib/prisma.ts resolves identity from the args
// first and only falls back to the ambient request identity, so a `where: { id }`
// write is the one shape in this file that can fail with DB_IDENTITY_REQUIRED.
export async function toggleReminderDone(reminderId: string) {
  const user = await getActiveUser();
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, userId: user.id },
    select: { id: true, done: true },
  });
  if (!reminder) throw new Error("Reminder not found.");

  const done = !reminder.done;
  const { count } = await prisma.reminder.updateMany({
    where: { id: reminder.id, userId: user.id },
    data: { done },
  });
  if (count === 0) throw new Error("Reminder not found.");
  return { ok: true, done };
}

export async function setReminderDone(reminderId: string, done: boolean) {
  const user = await getActiveUser();
  const { count } = await prisma.reminder.updateMany({
    where: { id: reminderId, userId: user.id },
    data: { done },
  });
  if (count === 0) throw new Error("Reminder not found.");
  return { ok: true };
}

export async function deleteReminder(reminderId: string) {
  const user = await getActiveUser();
  const { count } = await prisma.reminder.deleteMany({
    where: { id: reminderId, userId: user.id },
  });
  if (count === 0) throw new Error("Reminder not found.");
  return { ok: true };
}
