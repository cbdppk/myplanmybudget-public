import { z } from "zod";

export const CreateReminderSchema = z.object({
  title: z.string().min(2).max(120),
  dueAt: z.string().min(1),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  recurrenceInterval: z.number().int().min(1).max(30).default(1),
  channel: z.enum(["IN_APP", "EMAIL", "PUSH"]).default("IN_APP"),
});

export const ToggleReminderSchema = z.object({
  reminderId: z.string().min(1),
});
