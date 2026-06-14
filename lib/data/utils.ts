import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getRequestCache, setDbIdentity, setRequestCache } from "@/lib/security/db-context";

const DEMO_EMAIL = "demo@example.com";
const ALLOW_DEMO = process.env.ALLOW_DEMO_ACCOUNT === "true";

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) return Number(String(value));
  return 0;
}

export async function getOrCreateDemoUser() {
  setDbIdentity({ userEmail: DEMO_EMAIL });
  return prisma.userProfile.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo User", currency: "GHS" },
  });
}

export async function getActiveUser() {
  const cached = getRequestCache<Awaited<ReturnType<typeof prisma.userProfile.findUnique>>>("activeUser");
  if (cached?.id) return cached;

  const session = await getSessionUser();
  if (session) {
    setDbIdentity({ userId: session.id, userEmail: session.email });
    try {
      const existingById = await prisma.userProfile.findUnique({ where: { id: session.id } });
      if (existingById?.isActive) {
        setRequestCache("activeUser", existingById);
        return existingById;
      }
      if (existingById && !existingById.isActive) throw new Error("ACCOUNT_DISABLED");

      const existingByEmail = await prisma.userProfile.findUnique({ where: { email: session.email } });
      if (existingByEmail?.isActive) {
        setDbIdentity({ userId: existingByEmail.id, userEmail: existingByEmail.email });
        setRequestCache("activeUser", existingByEmail);
        return existingByEmail;
      }
      if (existingByEmail && !existingByEmail.isActive) throw new Error("ACCOUNT_DISABLED");
    } catch (error) {
      if (isTransientDbError(error)) throw new Error("DATABASE_UNAVAILABLE");
      throw error;
    }

    throw new Error("UNAUTHENTICATED");
  }
  if (ALLOW_DEMO && process.env.NODE_ENV !== "production") {
    const demo = await getOrCreateDemoUser();
    setRequestCache("activeUser", demo);
    return demo;
  }
  throw new Error("UNAUTHENTICATED");
}

function isTransientDbError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = error.message.toLowerCase();
  return (
    text.includes("can't reach database server") ||
    text.includes("connection") ||
    text.includes("timeout") ||
    text.includes("too many connections") ||
    text.includes("unable to start a transaction")
  );
}

export async function withDbRetry<T>(run: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (i >= attempts || !isTransientDbError(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 120 * i));
    }
  }
  throw lastError;
}

export function monthBounds(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function monthWindowFromStartDay(ref: Date, startDay: number) {
  const safeStartDay = Math.min(28, Math.max(1, Math.floor(startDay)));
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  const start = d >= safeStartDay ? new Date(y, m, safeStartDay) : new Date(y, m - 1, safeStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, safeStartDay, 0, 0, 0, 0);
  end.setMilliseconds(-1);
  return { start, end };
}

export async function ensureCurrentBudgetPeriod(
  userId: string,
  options?: { monthStartDay?: number; startMode?: "CURRENT_MONTH" | "NEXT_MONTH" }
) {
  const cacheKey = `budgetPeriod:${userId}:${options?.monthStartDay ?? "auto"}:${options?.startMode ?? "auto"}`;
  const cached = getRequestCache<Awaited<ReturnType<typeof prisma.budgetPeriod.findFirst>>>(cacheKey);
  if (cached?.id) return cached;

  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { monthStartDay: true, budgetStartMode: true },
  });
  const startDay = options?.monthStartDay ?? user?.monthStartDay ?? 1;
  const startMode = options?.startMode ?? ((user?.budgetStartMode as "CURRENT_MONTH" | "NEXT_MONTH" | null) ?? "CURRENT_MONTH");
  const existingAny = await prisma.budgetPeriod.findFirst({ where: { userId }, select: { id: true } });
  const ref = new Date();
  if (!existingAny && startMode === "NEXT_MONTH") {
    ref.setMonth(ref.getMonth() + 1);
  }
  const { start, end } = monthWindowFromStartDay(ref, startDay);
  const name = `${start.toLocaleString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const existing = await prisma.budgetPeriod.findFirst({ where: { userId, startDate: start } });
  if (existing) {
    // Period boundaries are deterministic from month start settings; no per-request rewrite needed.
    setRequestCache(cacheKey, existing);
    return existing;
  }

  const created = await prisma.$transaction(async (tx) => {
    const previous = await tx.budgetPeriod.findFirst({
      where: { userId, endDate: { lt: start } },
      orderBy: { endDate: "desc" },
      select: { id: true, carryIn: true, startDate: true, endDate: true },
    });

    let carryIn = 0;
    let previousTargets: Array<{ categoryId: string; amount: number; cadence: string }> = [];

    if (previous) {
      const [profile, incomeAgg, expenseAgg, targets] = await Promise.all([
        tx.userProfile.findUnique({
          where: { id: userId },
          select: { baselineIncome: true, baselineExpense: true, baselineSavings: true },
        }),
        tx.transaction.aggregate({
          where: { userId, type: "INCOME", occurredAt: { gte: previous.startDate, lte: previous.endDate } },
          _sum: { amount: true },
        }),
        tx.transaction.aggregate({
          where: { userId, type: "EXPENSE", occurredAt: { gte: previous.startDate, lte: previous.endDate } },
          _sum: { amount: true },
        }),
        tx.budgetTarget.findMany({
          where: { userId, periodId: previous.id },
          select: { categoryId: true, amount: true, cadence: true },
        }),
      ]);

      const baselineNet =
        toNumber(profile?.baselineIncome) -
        toNumber(profile?.baselineExpense) -
        toNumber(profile?.baselineSavings);
      const transactionNet = toNumber(incomeAgg._sum.amount) - toNumber(expenseAgg._sum.amount);
      carryIn = toNumber(previous.carryIn) + baselineNet + transactionNet;
      previousTargets = targets.map((item) => ({
        categoryId: item.categoryId,
        amount: toNumber(item.amount),
        cadence: item.cadence,
      }));
    }

    const period = await tx.budgetPeriod.create({
      data: { userId, name, startDate: start, endDate: end, carryIn },
    });

    if (previousTargets.length > 0) {
      await tx.budgetTarget.createMany({
        data: previousTargets.map((item) => ({
          userId,
          periodId: period.id,
          categoryId: item.categoryId,
          amount: item.amount,
          cadence: item.cadence,
        })),
        skipDuplicates: true,
      });
    }

    return period;
  });

  setRequestCache(cacheKey, created);
  return created;
}
