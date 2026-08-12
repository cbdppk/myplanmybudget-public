import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { ContactInquiryStatus, ExtraTxnType, PrismaClient, ReminderChannel, TransactionKind, TxnType, UserRole } from "@prisma/client";

function requiredSeedEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required seed environment variable: ${name}`);
  }
  return value;
}

const ADMIN_EMAIL = requiredSeedEnv("SEED_ADMIN_EMAIL");
const ADMIN_PASSWORD = requiredSeedEnv("SEED_ADMIN_PASSWORD");
const USER_EMAIL = requiredSeedEnv("SEED_USER_EMAIL");
const USER_PASSWORD = requiredSeedEnv("SEED_USER_PASSWORD");
const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("Missing required database environment variable: DIRECT_URL or DATABASE_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const existing = await prisma.userProfile.findMany({
    where: { email: { in: [ADMIN_EMAIL, USER_EMAIL] } },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.userProfile.deleteMany({ where: { id: { in: existing.map((item) => item.id) } } });
  }

  const admin = await prisma.userProfile.create({
    data: {
      email: ADMIN_EMAIL,
      name: "EyeHai Admin",
      currency: "USD",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const user = await prisma.userProfile.create({
    data: {
      email: USER_EMAIL,
      name: "Power Test User",
      currency: "USD",
      baseCurrency: "USD",
      preferredCurrency: "USD",
      incomeFrequency: "MONTHLY",
      budgetStartMode: "CURRENT_MONTH",
      monthStartDay: 1,
      baselineIncome: 3200,
      baselineExpense: 1500,
      baselineSavings: 500,
      dailySpendEstimate: 42,
      role: UserRole.USER,
      isActive: true,
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        userId: admin.id,
        action: "AUTH_CREDENTIAL_SET",
        meta: { passwordHash: hashPassword(ADMIN_PASSWORD) },
      },
      {
        userId: user.id,
        action: "AUTH_CREDENTIAL_SET",
        meta: { passwordHash: hashPassword(USER_PASSWORD) },
      },
    ],
  });

  const [cashAccount, bankAccount] = await Promise.all([
    prisma.financialAccount.create({
      data: { userId: user.id, name: "Wallet", type: "cash", balance: 250 },
    }),
    prisma.financialAccount.create({
      data: { userId: user.id, name: "Main Bank", type: "bank", balance: 2200 },
    }),
  ]);

  const [housing, food, transport, salary, emergencyFund] = await Promise.all([
    prisma.category.create({
      data: { userId: user.id, name: "Housing", kind: "expense", color: "#0F172A", icon: "home" },
    }),
    prisma.category.create({
      data: { userId: user.id, name: "Food", kind: "expense", color: "#166534", icon: "utensils" },
    }),
    prisma.category.create({
      data: { userId: user.id, name: "Transport", kind: "expense", color: "#1D4ED8", icon: "car" },
    }),
    prisma.category.create({
      data: { userId: user.id, name: "Salary", kind: "income", color: "#065F46", icon: "wallet" },
    }),
    prisma.category.create({
      data: { userId: user.id, name: "Emergency Fund", kind: "savings", color: "#7C3AED", icon: "piggy-bank" },
    }),
  ]);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  const period = await prisma.budgetPeriod.create({
    data: {
      userId: user.id,
      name: start.toLocaleString("en-US", { month: "long", year: "numeric" }),
      startDate: start,
      endDate: end,
    },
  });

  await prisma.budgetTarget.createMany({
    data: [
      { userId: user.id, periodId: period.id, categoryId: housing.id, amount: 800 },
      { userId: user.id, periodId: period.id, categoryId: food.id, amount: 350 },
      { userId: user.id, periodId: period.id, categoryId: transport.id, amount: 220 },
      { userId: user.id, periodId: period.id, categoryId: emergencyFund.id, amount: 450 },
    ],
  });

  const now = Date.now();
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        type: TxnType.INCOME,
        kind: TransactionKind.BASELINE,
        amount: 3200,
        memo: "Monthly salary",
        categoryId: salary.id,
        accountId: bankAccount.id,
        occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 8),
      },
      {
        userId: user.id,
        type: TxnType.EXPENSE,
        kind: TransactionKind.BASELINE,
        amount: 760,
        memo: "Rent payment",
        categoryId: housing.id,
        accountId: bankAccount.id,
        occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 7),
      },
      {
        userId: user.id,
        type: TxnType.EXPENSE,
        kind: TransactionKind.BASELINE,
        amount: 46,
        memo: "Groceries",
        categoryId: food.id,
        accountId: cashAccount.id,
        occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
      },
      {
        userId: user.id,
        type: TxnType.EXPENSE,
        kind: TransactionKind.BASELINE,
        amount: 22,
        memo: "Taxi",
        categoryId: transport.id,
        accountId: cashAccount.id,
        occurredAt: new Date(now - 1000 * 60 * 60 * 24),
      },
      {
        userId: user.id,
        type: TxnType.INCOME,
        kind: TransactionKind.EXTRA,
        extraType: ExtraTxnType.EXTRA_INCOME,
        amount: 240,
        memo: "Freelance extra income",
        accountId: bankAccount.id,
        occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 3),
      },
      {
        userId: user.id,
        type: TxnType.EXPENSE,
        kind: TransactionKind.EXTRA,
        extraType: ExtraTxnType.EXTRA_EXPENSE,
        amount: 95,
        memo: "Unexpected car repair",
        categoryId: transport.id,
        accountId: cashAccount.id,
        occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
      },
      {
        userId: user.id,
        type: TxnType.EXPENSE,
        kind: TransactionKind.EXTRA,
        extraType: ExtraTxnType.EXTRA_SAVINGS,
        amount: 120,
        memo: "Extra emergency fund deposit",
        categoryId: emergencyFund.id,
        accountId: bankAccount.id,
        occurredAt: new Date(now - 1000 * 60 * 60 * 24),
      },
    ],
  });

  await prisma.recurringRule.createMany({
    data: [
      {
        userId: user.id,
        name: "Monthly rent",
        amount: 760,
        type: TxnType.EXPENSE,
        categoryId: housing.id,
        cadence: "monthly",
        dayOfMonth: 3,
        nextRunAt: new Date(start.getFullYear(), start.getMonth() + 1, 3),
      },
      {
        userId: user.id,
        name: "Monthly salary",
        amount: 3200,
        type: TxnType.INCOME,
        categoryId: salary.id,
        cadence: "monthly",
        dayOfMonth: 1,
        nextRunAt: new Date(start.getFullYear(), start.getMonth() + 1, 1),
      },
    ],
  });

  await prisma.goal.createMany({
    data: [
      { userId: user.id, name: "Emergency fund", target: 5000, current: 1300 },
      { userId: user.id, name: "Vacation", target: 1800, current: 460, dueDate: new Date(now + 1000 * 60 * 60 * 24 * 120) },
    ],
  });

  await prisma.note.createMany({
    data: [
      { userId: user.id, title: "Budget strategy", content: "Prioritize essentials and automate savings.", pinned: true },
      { userId: user.id, title: "Debt plan", content: "Use avalanche strategy for highest interest debt first." },
    ],
  });

  await prisma.reminder.createMany({
    data: [
      {
        userId: user.id,
        title: "Pay electricity bill",
        dueAt: new Date(now + 1000 * 60 * 60 * 24 * 2),
        channel: ReminderChannel.IN_APP,
      },
      {
        userId: user.id,
        title: "Review monthly budget",
        dueAt: new Date(now + 1000 * 60 * 60 * 24 * 5),
        channel: ReminderChannel.PUSH,
      },
    ],
  });

  const sandbox = await prisma.sandbox.create({
    data: { userId: user.id, periodId: period.id, name: "Conservative scenario" },
  });
  await prisma.sandboxOverride.createMany({
    data: [
      { userId: user.id, sandboxId: sandbox.id, kind: "expense_multiplier", key: "transport", value: { factor: 0.85 } },
      { userId: user.id, sandboxId: sandbox.id, kind: "income_buffer", key: "salary", value: { delta: -200 } },
    ],
  });

  await prisma.pushSubscription.create({
    data: {
      userId: user.id,
      endpoint: "https://example.push.service/subscriptions/test-user-1",
      p256dh: "test_p256dh_key_seed_value",
      auth: "test_auth_key_seed_value",
      active: true,
    },
  });

  const inquiry = await prisma.contactInquiry.create({
    data: {
      name: "Prospect Client",
      email: "prospect@example.com",
      subject: "Need onboarding support",
      message: "We are evaluating MyplanMybudget for team budgeting and want a guided demo.",
    },
  });

  await prisma.contactInquiry.create({
    data: {
      name: "Existing Customer",
      email: "customer@example.com",
      subject: "Data export question",
      message: "Need help understanding JSON export fields.",
      status: ContactInquiryStatus.RESOLVED,
      handledById: admin.id,
      resolvedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      userId: admin.id,
      action: "CONTACT_INQUIRY_RECEIVED",
      meta: { inquiryId: inquiry.id, at: new Date().toISOString() },
    },
  });

  console.log("Seed complete:");
  console.log(`- Admin: ${ADMIN_EMAIL}`);
  console.log(`- User:  ${USER_EMAIL}`);
  console.log("- Data seeded for budgets, transactions, simulations, reminders, notes, push, and contact inbox.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
