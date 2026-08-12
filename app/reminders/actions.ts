"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createReminderWithRecurrence as createReminderRepo,
  toggleReminderDone as toggleReminderDoneRepo,
  deleteReminder as deleteReminderRepo,
} from "@/lib/data/reminders";
import { CreateReminderSchema } from "@/lib/validators/reminders";
import { sendEmail } from "@/lib/email/send";
import { requireUser } from "@/lib/auth/session";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const ToggleReminderSchema = z.object({
  reminderId: z.string().min(1),
});

export type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; message: string };

/**
 * Server Actions that throw get their message replaced by Next's generic
 * "An error occurred in the Server Components render…" text in production
 * builds, so the UI can never explain what actually failed. Map to a result
 * object instead, and keep the real error in the server logs.
 */
function toActionFailure(error: unknown, fallback: string): { ok: false; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  console.error("reminder_action_failed", JSON.stringify({ error: raw }));

  if (raw === "UNAUTHENTICATED") return { ok: false, message: "Your session has expired. Please sign in again." };
  if (raw === "ACCOUNT_DISABLED") return { ok: false, message: "This account is disabled." };
  if (raw === "DATABASE_UNAVAILABLE") {
    return { ok: false, message: "The database is temporarily unavailable. Please try again in a moment." };
  }
  if (raw.startsWith("DB_IDENTITY_REQUIRED")) {
    return { ok: false, message: "Could not confirm your session for this change. Please refresh and try again." };
  }
  if (raw === "Reminder not found.") return { ok: false, message: raw };
  return { ok: false, message: fallback };
}

export async function createReminder(input: z.infer<typeof CreateReminderSchema>) {
  await requireUser();
  const parsed = CreateReminderSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Reminder title must be at least 2 characters and due date is required.");
  }
  const data = parsed.data;
  const result = await createReminderRepo(data);
  revalidatePath("/reminders");
  revalidatePath("/notes");
  revalidatePath("/dashboard");

  if (data.channel === "EMAIL" && result.userEmail) {
    const dueDate = new Date(data.dueAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    await sendEmail({
      to: result.userEmail,
      subject: `Reminder set: ${data.title}`,
      text: `You set a reminder: "${data.title}" due on ${dueDate}.\n\nView reminders: ${process.env.NEXT_PUBLIC_APP_URL}/reminders`,
      html: `<p>You set a reminder: <strong>${escapeHtml(data.title)}</strong> due on ${escapeHtml(dueDate)}.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/reminders">View reminders</a></p>`,
    });
  }

  return {
    ok: true,
    reminder: {
      id: result.reminder.id,
      title: result.reminder.title,
      dueAt: result.reminder.dueAt.toISOString(),
      recurrence: result.reminder.recurrence as "NONE" | "DAILY" | "WEEKLY" | "MONTHLY",
      recurrenceInterval: result.reminder.recurrenceInterval,
      done: result.reminder.done,
    },
  };
}

export async function toggleReminder(
  input: z.infer<typeof ToggleReminderSchema>
): Promise<ActionResult<{ done: boolean }>> {
  try {
    await requireUser();
    const data = ToggleReminderSchema.parse(input);
    const result = await toggleReminderDoneRepo(data.reminderId);
    revalidatePath("/reminders");
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    return { ok: true, done: result.done };
  } catch (error) {
    return toActionFailure(error, "Failed to update reminder.");
  }
}

export async function deleteReminder(input: { reminderId: string }): Promise<ActionResult> {
  try {
    await requireUser();
    const { reminderId } = z.object({ reminderId: z.string().min(1) }).parse(input);
    await deleteReminderRepo(reminderId);
    revalidatePath("/reminders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return toActionFailure(error, "Failed to delete reminder.");
  }
}
