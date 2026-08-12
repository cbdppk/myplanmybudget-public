import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/data/utils";

export async function getExportBundle(userId: string) {
  const [user, accounts, categories, budgetTargets, transactions, notes, reminders, goals, recurringRules] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, currency: true, createdAt: true, updatedAt: true },
    }),
    prisma.financialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true, balance: true, createdAt: true, updatedAt: true },
    }),
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, color: true, icon: true, createdAt: true, updatedAt: true },
    }),
    prisma.budgetTarget.findMany({
      where: { userId },
      include: {
        period: { select: { id: true, name: true, startDate: true, endDate: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ period: { startDate: "desc" } }, { category: { name: "asc" } }],
    }),
    prisma.transaction.findMany({
      where: { userId },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.reminder.findMany({
      where: { userId },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recurringRule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    schemaVersion: "myplanmybudget.export.v1",
    exportedAt: new Date().toISOString(),
    user,
    accounts: accounts.map((item) => ({
      ...item,
      balance: toNumber(item.balance),
    })),
    categories,
    budgets: budgetTargets.map((item) => ({
      id: item.id,
      amount: toNumber(item.amount),
      period: item.period,
      category: item.category,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    transactions: transactions.map((item) => ({
      id: item.id,
      type: item.type,
      amount: toNumber(item.amount),
      currency: item.currency,
      occurredAt: item.occurredAt,
      memo: item.memo,
      category: item.category,
      account: item.account,
      fromAccount: item.fromAccount,
      toAccount: item.toAccount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    notes: notes.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      pinned: item.pinned,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    reminders: reminders.map((item) => ({
      id: item.id,
      title: item.title,
      dueAt: item.dueAt,
      channel: item.channel,
      done: item.done,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    goals: goals.map((item) => ({
      id: item.id,
      name: item.name,
      target: toNumber(item.target),
      current: toNumber(item.current),
      dueDate: item.dueDate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    recurringRules: recurringRules.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      amount: toNumber(item.amount),
      cadence: item.cadence,
      nextRunAt: item.nextRunAt,
      active: item.active,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}
