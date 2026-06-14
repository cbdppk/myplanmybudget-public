import { startOfMonth } from "./dates";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) return Number(String(value));
  return 0;
}

export async function getDashboardData() {
  const user = await requireUser();
  const monthStart = startOfMonth();
  const now = new Date();
  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 30);

  const [transactions, reminders, burnRateAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id, occurredAt: { gte: monthStart } },
      include: { category: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 24,
    }),
    prisma.reminder.count({ where: { userId: user.id, done: false } }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "EXPENSE", occurredAt: { gte: last30, lte: now } },
      _sum: { amount: true },
    }),
  ]);

  const income = transactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + toNumber(t.amount), 0);
  const expense = transactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + toNumber(t.amount), 0);
  const balance = income - expense;
  const burnRate = Math.round((toNumber(burnRateAgg._sum.amount) / 30) * 100) / 100;

  const weekly = [0, 0, 0, 0, 0, 0];
  transactions.forEach((t) => {
    const index = Math.min(5, Math.floor((Date.now() - t.occurredAt.getTime()) / (1000 * 60 * 60 * 24 * 5)));
    const impact = t.type === "INCOME" ? toNumber(t.amount) : -toNumber(t.amount);
    weekly[5 - index] += impact;
  });

  return {
    income,
    expense,
    burnRate,
    balance,
    reminders,
    transactions: transactions.slice(0, 6),
    weekly,
  };
}

export async function getBudgetData() {
  const user = await requireUser();
  const monthStart = startOfMonth();

  const categories = await prisma.category.findMany({
    where: { userId: user.id, kind: "expense" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const txns = await prisma.transaction.findMany({
    where: { userId: user.id, type: "EXPENSE", occurredAt: { gte: monthStart } },
    select: { amount: true, categoryId: true },
  });

  const spentByCategory = new Map<string, number>();
  txns.forEach((txn) => {
    if (!txn.categoryId) return;
    spentByCategory.set(txn.categoryId, (spentByCategory.get(txn.categoryId) ?? 0) + toNumber(txn.amount));
  });

  return categories.map((cat) => ({
    category: cat.name,
    categoryId: cat.id,
    spent: Math.round(spentByCategory.get(cat.id) ?? 0),
    limit: Math.max(100, Math.round((spentByCategory.get(cat.id) ?? 0) * 1.2) || 300),
  }));
}

export async function getTransactionsData() {
  const user = await requireUser();

  const txns = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { occurredAt: "desc" },
    include: { category: { select: { name: true } } },
    take: 50,
  });

  return txns.map((txn) => ({
    id: txn.id,
    date: txn.occurredAt.toISOString().slice(0, 10),
    type: txn.type,
    category: txn.category?.name ?? "Uncategorized",
    memo: txn.memo ?? "",
    amount: toNumber(txn.amount),
  }));
}

export async function getNotesRemindersData() {
  const user = await requireUser();

  const [notes, reminders] = await Promise.all([
    prisma.note.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.reminder.findMany({ where: { userId: user.id }, orderBy: { dueAt: "asc" }, take: 20 }),
  ]);

  return {
    notes: notes.map((n) => ({ id: n.id, title: n.title ?? "Untitled", content: n.content })),
    reminders: reminders.map((r) => ({ id: r.id, title: r.title, dueAt: r.dueAt.toISOString().slice(0, 10), channel: r.channel, done: r.done })),
  };
}

export async function getSimulationBase() {
  const user = await requireUser();

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: user.id, type: "INCOME" } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: user.id, type: "EXPENSE" } }),
  ]);

  return {
    baselineIncome: Math.round(toNumber(incomeAgg._sum.amount)),
    baselineExpense: Math.round(toNumber(expenseAgg._sum.amount)),
  };
}
