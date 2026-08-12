import { prisma } from "@/lib/prisma";
import { getActiveUser, toNumber } from "@/lib/data/utils";
import { logAudit } from "@/lib/data/audit";
import { round2 } from "@/lib/finance/math";

const DEFAULT_ACCOUNT_NAME = "Cash";

/**
 * Every transaction belongs to an account so the ledger reconciles against
 * real-world balances. Users start with a "Cash" account; the first account
 * (by creation date) is the default that unassigned/legacy rows count toward.
 */
export async function ensureDefaultAccount(userId: string) {
  const existing = await prisma.financialAccount.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (existing) return existing;
  return prisma.financialAccount.create({
    data: { userId, name: DEFAULT_ACCOUNT_NAME, type: "cash" },
    select: { id: true, name: true },
  });
}

export type AccountWithBalance = {
  id: string;
  name: string;
  type: string;
  openingBalance: number;
  balance: number;
  /** Balance counting only cleared transactions — compare against statements. */
  clearedBalance: number;
  isDefault: boolean;
  isLiability: boolean;
};

const LIABILITY_TYPES = new Set(["debt", "credit", "loan", "liability"]);

/**
 * Balances are computed, never stored: openingBalance + income − expense
 * ± transfers touching the account. Legacy transactions with no accountId are
 * attributed to the default (oldest) account, which is exact for the
 * single-account case and keeps history meaningful after more accounts exist.
 *
 * Debts are accounts with a liability type (or negative balance): enter what
 * you owe as a negative opening balance, and payments are transfers into the
 * account, moving it toward zero. Net worth is then a plain signed sum.
 */
export async function getAccountsWithBalances(userId: string): Promise<{
  accounts: AccountWithBalance[];
  netWorth: number;
  clearedNetWorth: number;
  assetsTotal: number;
  liabilitiesTotal: number;
}> {
  const accounts = await prisma.financialAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, type: true, openingBalance: true },
  });
  if (accounts.length === 0) {
    return { accounts: [], netWorth: 0, clearedNetWorth: 0, assetsTotal: 0, liabilitiesTotal: 0 };
  }
  const defaultAccountId = accounts[0].id;

  const [flows, transfersOut, transfersIn] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["accountId", "type", "cleared"],
      where: { userId, type: { in: ["INCOME", "EXPENSE"] } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["fromAccountId", "cleared"],
      where: { userId, type: "TRANSFER", fromAccountId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["toAccountId", "cleared"],
      where: { userId, type: "TRANSFER", toAccountId: { not: null } },
      _sum: { amount: true },
    }),
  ]);

  const deltaByAccount = new Map<string, number>();
  const clearedDeltaByAccount = new Map<string, number>();
  const add = (accountId: string | null, amount: number, cleared: boolean) => {
    const key = accountId ?? defaultAccountId;
    deltaByAccount.set(key, (deltaByAccount.get(key) ?? 0) + amount);
    if (cleared) clearedDeltaByAccount.set(key, (clearedDeltaByAccount.get(key) ?? 0) + amount);
  };
  for (const row of flows) {
    const amount = toNumber(row._sum.amount);
    add(row.accountId, row.type === "INCOME" ? amount : -amount, row.cleared);
  }
  for (const row of transfersOut) add(row.fromAccountId, -toNumber(row._sum.amount), row.cleared);
  for (const row of transfersIn) add(row.toAccountId, toNumber(row._sum.amount), row.cleared);

  const withBalances = accounts.map((account) => {
    const opening = round2(toNumber(account.openingBalance));
    const balance = round2(opening + (deltaByAccount.get(account.id) ?? 0));
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      openingBalance: opening,
      balance,
      clearedBalance: round2(opening + (clearedDeltaByAccount.get(account.id) ?? 0)),
      isDefault: account.id === defaultAccountId,
      isLiability: LIABILITY_TYPES.has(account.type.toLowerCase()) || balance < 0,
    };
  });
  const netWorth = round2(withBalances.reduce((sum, account) => sum + account.balance, 0));
  const clearedNetWorth = round2(withBalances.reduce((sum, account) => sum + account.clearedBalance, 0));
  const assetsTotal = round2(withBalances.filter((a) => !a.isLiability).reduce((sum, a) => sum + a.balance, 0));
  const liabilitiesTotal = round2(Math.abs(withBalances.filter((a) => a.isLiability).reduce((sum, a) => sum + a.balance, 0)));
  return { accounts: withBalances, netWorth, clearedNetWorth, assetsTotal, liabilitiesTotal };
}

/**
 * Account-to-account move. TRANSFER rows never count as income or expense in
 * any money aggregate — they only shift computed balances between accounts
 * (e.g. Cash → Savings keeps net worth constant while building the asset side).
 */
export async function createTransfer(params: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  memo?: string;
  occurredAt?: string;
}) {
  const user = await getActiveUser();
  const amount = round2(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Transfer amount must be greater than 0.");
  if (params.fromAccountId === params.toAccountId) throw new Error("Choose two different accounts.");

  const owned = await prisma.financialAccount.findMany({
    where: { userId: user.id, id: { in: [params.fromAccountId, params.toAccountId] } },
    select: { id: true },
  });
  if (owned.length !== 2) throw new Error("Account not found.");

  const created = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "TRANSFER",
      kind: "EXTRA",
      extraType: null,
      amount,
      currency: user.baseCurrency || user.currency || null,
      memo: params.memo?.trim() || null,
      fromAccountId: params.fromAccountId,
      toAccountId: params.toAccountId,
      occurredAt: params.occurredAt ? new Date(params.occurredAt) : undefined,
    },
    select: { id: true },
  });
  logAudit(user.id, "transfer_create", {
    transactionId: created.id,
    fromAccountId: params.fromAccountId,
    toAccountId: params.toAccountId,
    amount,
  });
  return { ok: true, id: created.id };
}
