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

export async function toggleReminderDone(reminderId: string) {
  const user = await getActiveUser();
  const reminder = await prisma.reminder.findFirst({ where: { id: reminderId, userId: user.id } });
  if (!reminder) throw new Error("Reminder not found.");

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { done: !reminder.done },
  });
  return { ok: true };
}

export async function setReminderDone(reminderId: string, done: boolean) {
  const user = await getActiveUser();
  const reminder = await prisma.reminder.findFirst({ where: { id: reminderId, userId: user.id }, select: { id: true } });
  if (!reminder) throw new Error("Reminder not found.");
  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { done },
  });
  return { ok: true };
}

export async function deleteReminder(reminderId: string) {
  const user = await getActiveUser();
  const reminder = await prisma.reminder.findFirst({ where: { id: reminderId, userId: user.id }, select: { id: true } });
  if (!reminder) throw new Error("Reminder not found.");
  await prisma.reminder.delete({ where: { id: reminder.id } });
  return { ok: true };
}
