import { Prisma } from "@prisma/client";
import { effectiveRegularIncome, round2 } from "@/lib/finance/math";

// Local Decimal-or-null coercion; not imported from utils to keep this module
// dependency-free (utils imports it for carry-in).
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  return Number(String(value)) || 0;
}

/**
 * Canonical transaction where-clauses for the money model. Every aggregate that
 * feeds a user-visible money figure (live balance, dashboard net, carry-over)
 * must be built from these so the numbers can never disagree between screens
 * or between a period's end and the next period's carry-in.
 *
 * All filters match on type INCOME/EXPENSE, so TRANSFER rows (account-to-account
 * moves) never count as money in or out.
 */

/** All real money out: planned category spend + off-budget extra expense. */
export function actualExpenseWhere(userId: string, gte: Date, lte: Date) {
  return {
    userId,
    type: "EXPENSE" as const,
    occurredAt: { gte, lte },
    OR: [
      { extraType: "EXTRA_EXPENSE" as const },
      { extraType: null, category: { is: null } },
      { extraType: null, category: { is: { kind: "expense" } } },
    ],
  } satisfies Prisma.TransactionWhereInput;
}

/** All money moved into savings (explicit extra savings or savings-kind category). */
export function actualSavingsWhere(userId: string, gte: Date, lte: Date) {
  return {
    userId,
    type: "EXPENSE" as const,
    occurredAt: { gte, lte },
    OR: [
      { extraType: "EXTRA_SAVINGS" as const },
      { extraType: null, category: { is: { kind: "savings" } } },
    ],
  } satisfies Prisma.TransactionWhereInput;
}

/** Planned expense only — what consumes category budgets (off-budget extras excluded). */
export function plannedExpenseWhere(userId: string, gte: Date, lte: Date) {
  return {
    userId,
    type: "EXPENSE" as const,
    extraType: null,
    occurredAt: { gte, lte },
    OR: [
      { category: { is: null } },
      { category: { is: { kind: "expense" } } },
    ],
  } satisfies Prisma.TransactionWhereInput;
}

/** Every income transaction (regular + extra). */
export function incomeWhere(userId: string, gte: Date, lte: Date) {
  return {
    userId,
    type: "INCOME" as const,
    occurredAt: { gte, lte },
  } satisfies Prisma.TransactionWhereInput;
}

/** Extra (off-plan) income only. */
export function extraIncomeWhere(userId: string, gte: Date, lte: Date) {
  return {
    userId,
    kind: "EXTRA" as const,
    type: "INCOME" as const,
    occurredAt: { gte, lte },
  } satisfies Prisma.TransactionWhereInput;
}

export type PeriodActuals = {
  actualIncome: number;
  extraIncome: number;
  actualExpense: number;
  actualSavings: number;
};

// Structural client type so both the extended runtime client and interactive
// transaction clients can be passed.
type TxnAggregateClient = {
  transaction: {
    aggregate(args: {
      where: Prisma.TransactionWhereInput;
      _sum: { amount: true };
    }): Promise<{ _sum: { amount: unknown } }>;
  };
};

/** The four real-money aggregates that define a period's cash picture. */
export async function computePeriodActuals(
  db: TxnAggregateClient,
  userId: string,
  start: Date,
  end: Date
): Promise<PeriodActuals> {
  const [incomeAgg, extraIncomeAgg, expenseAgg, savingsAgg] = await Promise.all([
    db.transaction.aggregate({ where: incomeWhere(userId, start, end), _sum: { amount: true } }),
    db.transaction.aggregate({ where: extraIncomeWhere(userId, start, end), _sum: { amount: true } }),
    db.transaction.aggregate({ where: actualExpenseWhere(userId, start, end), _sum: { amount: true } }),
    db.transaction.aggregate({ where: actualSavingsWhere(userId, start, end), _sum: { amount: true } }),
  ]);
  return {
    actualIncome: round2(toNumber(incomeAgg._sum.amount)),
    extraIncome: round2(toNumber(extraIncomeAgg._sum.amount)),
    actualExpense: round2(toNumber(expenseAgg._sum.amount)),
    actualSavings: round2(toNumber(savingsAgg._sum.amount)),
  };
}

/**
 * The live balance at any point in a period — and, evaluated at the period's
 * end, the exact amount that carries into the next period. Planned income is
 * the reference; recorded regular income merges in (never stacks) via
 * effectiveRegularIncome, and only real logged outflow counts as spent.
 */
export function periodSurplus(params: {
  carryIn: number;
  baselineIncome: number;
  actuals: PeriodActuals;
}) {
  const { carryIn, baselineIncome, actuals } = params;
  const actualRegularIncome = round2(actuals.actualIncome - actuals.extraIncome);
  const regularIncome = effectiveRegularIncome(baselineIncome, actualRegularIncome);
  return round2(carryIn + regularIncome + actuals.extraIncome - actuals.actualExpense - actuals.actualSavings);
}
