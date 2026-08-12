"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createQuickTransaction as createQuickTransactionRepo,
  deleteTransactionById,
  splitTransaction as splitTransactionRepo,
  updateTransaction as updateTransactionRepo,
} from "@/lib/data/transactions";
import { createTransfer as createTransferRepo } from "@/lib/data/accounts";

const MONEY_PATHS = ["/track", "/transactions", "/dashboard", "/plan", "/goals", "/settings"];

function revalidateMoneyPaths() {
  for (const path of MONEY_PATHS) revalidatePath(path);
}

const CreateTxnSchema = z.object({
  kind: z.enum(["BASELINE", "EXTRA"]).optional(),
  type: z.enum(["INCOME", "EXPENSE", "SAVINGS"]).optional(),
  extraType: z.enum(["EXTRA_INCOME", "EXTRA_EXPENSE", "EXTRA_SAVINGS"]).optional(),
  amount: z.number().positive(),
  memo: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  accountId: z.string().max(64).optional(),
  occurredAt: z.string().optional(),
  recurring: z.boolean().optional(),
});

export async function createQuickTransaction(input: z.infer<typeof CreateTxnSchema>) {
  const data = CreateTxnSchema.parse(input);
  await createQuickTransactionRepo(data);
  revalidateMoneyPaths();
  return { ok: true };
}

const UpdateTxnSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive().optional(),
  memo: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  occurredAt: z.string().optional(),
  cleared: z.boolean().optional(),
});

export async function updateTransaction(input: z.infer<typeof UpdateTxnSchema>) {
  const data = UpdateTxnSchema.parse(input);
  await updateTransactionRepo(data);
  revalidateMoneyPaths();
  return { ok: true };
}

const SplitTxnSchema = z.object({
  id: z.string().min(1),
  parts: z
    .array(
      z.object({
        amount: z.number().positive(),
        category: z.string().max(80).optional(),
        memo: z.string().max(200).optional(),
      })
    )
    .min(2)
    .max(10),
});

export async function splitTransaction(input: z.infer<typeof SplitTxnSchema>) {
  const data = SplitTxnSchema.parse(input);
  await splitTransactionRepo(data);
  revalidateMoneyPaths();
  return { ok: true };
}

export async function deleteTransaction(id: string) {
  await deleteTransactionById(id);
  revalidateMoneyPaths();
  return { ok: true };
}

const CreateTransferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().max(200).optional(),
  occurredAt: z.string().optional(),
});

export async function createTransfer(input: z.infer<typeof CreateTransferSchema>) {
  const data = CreateTransferSchema.parse(input);
  await createTransferRepo(data);
  revalidateMoneyPaths();
  return { ok: true };
}
