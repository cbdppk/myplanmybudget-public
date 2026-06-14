"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createQuickTransaction as createQuickTransactionRepo } from "@/lib/data/transactions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { setDbIdentity } from "@/lib/security/db-context";

const CreateTxnSchema = z.object({
  kind: z.enum(["BASELINE", "EXTRA"]).optional(),
  type: z.enum(["INCOME", "EXPENSE", "SAVINGS"]).optional(),
  extraType: z.enum(["EXTRA_INCOME", "EXTRA_EXPENSE", "EXTRA_SAVINGS"]).optional(),
  amount: z.number().positive(),
  memo: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  occurredAt: z.string().optional(),
  recurring: z.boolean().optional(),
});

export async function createQuickTransaction(input: z.infer<typeof CreateTxnSchema>) {
  const data = CreateTxnSchema.parse(input);
  await createQuickTransactionRepo(data);
  revalidatePath("/track");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/goals");
  return { ok: true };
}

export async function deleteTransaction(id: string) {
  const user = await requireUser();
  setDbIdentity({ userId: user.id, userEmail: user.email ?? undefined });
  const txn = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!txn) throw new Error("Transaction not found.");
  await prisma.transaction.delete({ where: { id: txn.id } });
  revalidatePath("/track");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/goals");
  return { ok: true };
}
