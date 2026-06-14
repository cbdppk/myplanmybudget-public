import { prisma } from "@/lib/prisma";

export function getMonthBounds(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function ensureCurrentBudgetPeriod(userId: string) {
  const { start, end } = getMonthBounds();
  const name = start.toLocaleString("en-US", { month: "long", year: "numeric" });

  const existing = await prisma.budgetPeriod.findFirst({
    where: { userId, startDate: start },
    select: { id: true },
  });

  if (existing) {
    return prisma.budgetPeriod.update({
      where: { id: existing.id },
      data: { endDate: end, name },
    });
  }

  return prisma.budgetPeriod.create({
    data: {
      userId,
      name,
      startDate: start,
      endDate: end,
    },
  });
}
