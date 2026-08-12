import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/data/utils";
import { applyGoalEffect } from "@/lib/data/goal-ledger";
import { nextRunAfter, safeTimeZone } from "@/lib/dates";

export { nextRunAfter, normalizeCadence, type RecurringCadence } from "@/lib/dates";

const MAX_CATCHUP_OCCURRENCES = 36;

/**
 * Post transactions for every due occurrence of the user's active recurring
 * rules, advancing `nextRunAt` as it goes. Called lazily from the money data
 * loaders (and from the dispatch cron), so rules post even without a scheduler.
 *
 * Idempotency: each occurrence is claimed with an optimistic
 * `updateMany(where nextRunAt = expected)` before its transaction is created,
 * so concurrent requests can never double-post.
 *
 * Posting semantics keep the money model consistent:
 * - INCOME  → kind BASELINE (merges with planned income; never stacks on it)
 * - EXPENSE with savings-kind category → EXTRA_SAVINGS (funds matching goal)
 * - EXPENSE otherwise → kind BASELINE (consumes the category budget)
 * Occurrences at or before the rule's creation are skipped: the transaction
 * that created the rule already covers them (legacy rules were stored with
 * nextRunAt = created time and must not double-post).
 */
export async function materializeDueRecurringRules(userId: string, now = new Date()) {
  const dueRules = await prisma.recurringRule.findMany({
    where: { userId, active: true, nextRunAt: { lte: now } },
    include: { user: { select: { timezone: true, baseCurrency: true, currency: true } } },
  });
  if (dueRules.length === 0) return { posted: 0 };

  const categoryIds = dueRules.map((rule) => rule.categoryId).filter((id): id is string => Boolean(id));
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { userId, id: { in: categoryIds } },
        select: { id: true, name: true, kind: true },
      })
    : [];
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const defaultAccount = await prisma.financialAccount.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let posted = 0;
  for (const rule of dueRules) {
    const timeZone = safeTimeZone(rule.user.timezone);
    const currency = rule.user.baseCurrency || rule.user.currency || null;
    let occurrence = rule.nextRunAt;

    for (let i = 0; i < MAX_CATCHUP_OCCURRENCES && occurrence <= now; i += 1) {
      const next = nextRunAfter({
        cadence: rule.cadence,
        after: occurrence,
        timeZone,
        dayOfMonth: rule.dayOfMonth,
        dayOfWeek: rule.dayOfWeek,
      });
      const claimed = await prisma.recurringRule.updateMany({
        where: { id: rule.id, userId, nextRunAt: occurrence },
        data: { nextRunAt: next, lastRunAt: occurrence },
      });
      if (claimed.count === 0) break; // another request claimed this occurrence

      if (occurrence > rule.createdAt) {
        const category = rule.categoryId ? categoryById.get(rule.categoryId) ?? null : null;
        const isSavings = rule.type === "EXPENSE" && category?.kind === "savings";
        const created = await prisma.transaction.create({
          data: {
            userId,
            type: rule.type,
            kind: isSavings ? "EXTRA" : "BASELINE",
            extraType: isSavings ? "EXTRA_SAVINGS" : null,
            amount: rule.amount,
            currency,
            memo: rule.name,
            categoryId: rule.categoryId,
            accountId: defaultAccount?.id ?? null,
            occurredAt: occurrence,
          },
          select: { id: true, type: true, extraType: true, amount: true },
        });
        await applyGoalEffect(userId, {
          type: created.type,
          extraType: created.extraType,
          amount: toNumber(created.amount),
          category: category ? { name: category.name, kind: category.kind } : null,
        }, 1);
        posted += 1;
      }
      occurrence = next;
    }
  }
  return { posted };
}
