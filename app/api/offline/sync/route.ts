import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createQuickExpense } from "@/lib/data/transactions";
import { createNote } from "@/lib/data/notes";
import { createReminder } from "@/lib/data/reminders";
import { setNotePinned } from "@/lib/data/notes";
import { setReminderDone } from "@/lib/data/reminders";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const QuickExpensePayloadSchema = z.object({
  kind: z.enum(["BASELINE", "EXTRA"]).optional(),
  type: z.enum(["INCOME", "EXPENSE", "SAVINGS"]).optional(),
  extraType: z.enum(["EXTRA_INCOME", "EXTRA_EXPENSE", "EXTRA_SAVINGS"]).optional(),
  amount: z.number().positive(),
  memo: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  occurredAt: z.string().optional(),
  recurring: z.boolean().optional(),
});

const NotePayloadSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10_000),
});

const ReminderPayloadSchema = z.object({
  title: z.string().min(2).max(120),
  dueAt: z.string().min(1),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
  recurrenceInterval: z.number().int().min(1).max(30).optional(),
});

const NoteSetPinnedPayloadSchema = z.object({
  noteId: z.string().min(1),
  pinned: z.boolean(),
});

const ReminderSetDonePayloadSchema = z.object({
  reminderId: z.string().min(1),
  done: z.boolean(),
});

const OperationSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("quick_expense_create"),
    payload: QuickExpensePayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("note_create"),
    payload: NotePayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("reminder_create"),
    payload: ReminderPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("note_set_pinned"),
    payload: NoteSetPinnedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("reminder_set_done"),
    payload: ReminderSetDonePayloadSchema,
  }),
]);

const RequestSchema = z.object({
  operations: z.array(OperationSchema).max(100),
});

export async function POST(request: Request) {
  const rateKey = `offline-sync:${getClientKey(request)}`;
  const rate = await checkRateLimit(rateKey, 60, 60_000);
  if (!rate.allowed) {
    return Response.json({ error: "Too many sync requests." }, { status: 429 });
  }

  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Per-user rate limit — stricter guard on top of IP limit
  const userRate = await checkRateLimit(`offline-sync:user:${user.id}`, 120, 60_000);
  if (!userRate.allowed) {
    return Response.json({ error: "Too many sync requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid sync payload." }, { status: 400 });
  }

  const processed: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  // Idempotency: clients retry whole batches after network failures, so any
  // operation already recorded as applied is acknowledged without re-applying —
  // a replayed expense must never post twice.
  const opIds = parsed.data.operations.map((op) => op.id);
  const alreadyApplied = new Set(
    (
      await prisma.offlineSyncOp.findMany({
        where: { userId: user.id, opId: { in: opIds } },
        select: { opId: true },
      })
    ).map((row) => row.opId)
  );

  for (const op of parsed.data.operations) {
    if (alreadyApplied.has(op.id)) {
      processed.push(op.id);
      continue;
    }
    try {
      // Claim the op id before applying: a concurrent duplicate request loses
      // the unique-constraint race and skips instead of double-applying.
      await prisma.offlineSyncOp.create({ data: { userId: user.id, opId: op.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        processed.push(op.id);
        continue;
      }
      failed.push({ id: op.id, reason: "Sync bookkeeping failed." });
      continue;
    }
    try {
      if (op.type === "quick_expense_create") {
        await createQuickExpense(op.payload);
        processed.push(op.id);
      } else if (op.type === "note_create") {
        await createNote(op.payload);
        processed.push(op.id);
      } else if (op.type === "reminder_create") {
        await createReminder(op.payload);
        processed.push(op.id);
      } else if (op.type === "note_set_pinned") {
        await setNotePinned(op.payload.noteId, op.payload.pinned);
        processed.push(op.id);
      } else if (op.type === "reminder_set_done") {
        await setReminderDone(op.payload.reminderId, op.payload.done);
        processed.push(op.id);
      }
    } catch (error) {
      // Release the claim so the client can retry a genuinely failed operation.
      await prisma.offlineSyncOp
        .deleteMany({ where: { userId: user.id, opId: op.id } })
        .catch(() => undefined);
      const reason = error instanceof Error ? error.message : "Sync failed.";
      failed.push({ id: op.id, reason });
    }
  }

  return Response.json({
    processed,
    failed,
  });
}
