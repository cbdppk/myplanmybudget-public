import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/data/utils";
import { round2 } from "@/lib/finance/math";

type GoalLedgerTxn = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  extraType: "EXTRA_INCOME" | "EXTRA_EXPENSE" | "EXTRA_SAVINGS" | null;
  amount: number;
  category: { name: string; kind: string } | null;
};

type GoalClient = {
  goal: {
    findFirst(args: {
      where: { userId: string; name: { equals: string; mode: "insensitive" } };
      select: { id: true; current: true };
    }): Promise<{ id: string; current: unknown } | null>;
    updateMany(args: {
      where: { id: string; userId: string };
      data: { current: number };
    }): Promise<unknown>;
  };
};

function isSavingsTxn(txn: GoalLedgerTxn) {
  if (txn.type !== "EXPENSE") return false;
  return txn.extraType === "EXTRA_SAVINGS" || (txn.extraType === null && txn.category?.kind === "savings");
}

/**
 * Keep goal progress derived from the ledger: a savings transaction whose
 * category matches a goal (categories are name-synced to goals) moves
 * `goal.current` by the same amount. `direction` is +1 on create and −1 when a
 * transaction is deleted or re-pointed, so goals never drift from tracked money.
 */
export async function applyGoalEffect(
  userId: string,
  txn: GoalLedgerTxn,
  direction: 1 | -1,
  db: GoalClient = prisma
) {
  if (!isSavingsTxn(txn)) return;
  const categoryName = txn.category?.name?.trim();
  if (!categoryName) return;

  const goal = await db.goal.findFirst({
    where: { userId, name: { equals: categoryName, mode: "insensitive" } },
    select: { id: true, current: true },
  });
  if (!goal) return;

  const next = Math.max(0, round2(toNumber(goal.current) + direction * txn.amount));
  await db.goal.updateMany({
    where: { id: goal.id, userId },
    data: { current: next },
  });
}
