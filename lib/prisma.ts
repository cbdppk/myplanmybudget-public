import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDbIdentity } from "@/lib/security/db-context";

const PROTECTED_MODELS = new Set([
  "UserProfile",
  "FinancialAccount",
  "Category",
  "BudgetPeriod",
  "BudgetTarget",
  "Transaction",
  "RecurringRule",
  "Goal",
  "Sandbox",
  "SandboxOverride",
  "Note",
  "Reminder",
  "PushSubscription",
  "AuditEvent",
  "AuthCredential",
]);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdmin?: PrismaClient;
};

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 700);
const PERF_LOGS_ENABLED = process.env.PERF_LOGS === "true";
const DB_TX_MAX_WAIT_MS = Number(process.env.DB_TX_MAX_WAIT_MS ?? 10000);
const DB_TX_TIMEOUT_MS = Number(process.env.DB_TX_TIMEOUT_MS ?? 15000);

function cleanEnv(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeDbUrl(value: string) {
  if (!value) return value;
  try {
    const parsed = new URL(value);
    const sslMode = parsed.searchParams.get("sslmode");
    if (!sslMode || sslMode === "require") {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    if (!parsed.searchParams.get("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "5");
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

const runtimeUrl = normalizeDbUrl(cleanEnv(process.env.DATABASE_URL));
// DIRECT_URL (unpooled) is used for the admin client to bypass the connection pooler.
// For CLI operations (migrate, etc.), DIRECT_URL is configured in prisma.config.ts.
const directUrl = normalizeDbUrl(cleanEnv(process.env.DIRECT_URL));
const runtimeConnectionString = runtimeUrl || undefined;
const adminConnectionString = directUrl || runtimeUrl || undefined;

function getConnectionUser(connectionString?: string) {
  if (!connectionString) return "";
  try {
    const parsed = new URL(connectionString);
    return decodeURIComponent(parsed.username ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function resolveStrictDbIdentityMode(connectionString?: string) {
  const user = getConnectionUser(connectionString);
  const usesRlsRuntimeRole = user.includes("app_runtime");
  const configured = process.env.DB_IDENTITY_STRICT;
  if (configured === "true") return true;
  if (configured === "false") {
    if (usesRlsRuntimeRole) {
      console.warn(
        "db_identity_strict_forced",
        JSON.stringify({
          reason: "runtime_uses_rls_role",
          user: user || undefined,
        }),
      );
      return true;
    }
    return false;
  }
  return process.env.NODE_ENV === "production" || usesRlsRuntimeRole;
}

const strictDbIdentityMode = resolveStrictDbIdentityMode(runtimeConnectionString);

function readWhereString(
  where: unknown,
  key: "id" | "email"
): string | null {
  if (!where || typeof where !== "object") return null;
  const raw = (where as Record<string, unknown>)[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object") {
    const equals = (raw as Record<string, unknown>).equals;
    if (typeof equals === "string" && equals.trim()) return equals.trim();
  }
  return null;
}

function readUserIdFromObject(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>).userId;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object") {
    const equals = (raw as Record<string, unknown>).equals;
    if (typeof equals === "string" && equals.trim()) return equals.trim();
  }
  return null;
}

function extractUserIdDeep(value: unknown, depth = 0): string | null {
  if (!value || depth > 4) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractUserIdDeep(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const direct = readUserIdFromObject(value);
  if (direct) return direct;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = extractUserIdDeep(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function readUserIdFromArgs(args: unknown): string | null {
  return extractUserIdDeep(args);
}

function toModelDelegateKey(model: string) {
  if (!model) return model;
  return `${model[0].toLowerCase()}${model.slice(1)}`;
}

function makePrismaClient(connectionString?: string) {
  if (connectionString) {
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter, log: ["error", "warn"] });
  }
  // Fallback: no connection string — Prisma will error at query time with a clear message.
  return new PrismaClient({ log: ["error", "warn"] });
}

const basePrisma =
  globalForPrisma.prisma ?? makePrismaClient(runtimeConnectionString);

const basePrismaAdmin =
  globalForPrisma.prismaAdmin ?? makePrismaClient(adminConnectionString);

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !PROTECTED_MODELS.has(model)) {
          return query(args);
        }

        const startedAt = Date.now();
        const identity = getDbIdentity();
        let userId = identity.userId?.trim();
        let userEmail = identity.userEmail?.trim().toLowerCase();

        // Allow strictly-scoped UserProfile lookups to bootstrap identity context.
        if (model === "UserProfile" && !userId && !userEmail) {
          const where = (args as { where?: unknown } | undefined)?.where;
          userId = readWhereString(where, "id") ?? undefined;
          userEmail = readWhereString(where, "email")?.toLowerCase() ?? undefined;
        }

        if (!userId) {
          userId = readUserIdFromArgs(args) ?? undefined;
        }

        try {
          if (!userId && !(model === "UserProfile" && userEmail)) {
            throw new Error(`DB_IDENTITY_REQUIRED:${model}`);
          }

          if (!strictDbIdentityMode) {
            return query(args);
          }

          const result = await basePrisma.$transaction(
            async (tx) => {
              await tx.$executeRaw`
                SELECT
                  set_config('app.user_id', ${userId ?? ""}, true),
                  set_config('app.user_email', ${userEmail ?? ""}, true)
              `;

              const delegateKey = toModelDelegateKey(model);
              const delegate = (tx as unknown as Record<string, unknown>)[delegateKey];
              const operationFn =
                delegate && typeof delegate === "object"
                  ? (delegate as Record<string, unknown>)[operation]
                  : undefined;

              if (typeof operationFn !== "function") {
                return query(args);
              }
              return (operationFn as (input: unknown) => Promise<unknown>)(args);
            },
            {
              maxWait: DB_TX_MAX_WAIT_MS,
              timeout: DB_TX_TIMEOUT_MS,
            },
          );
          return result;
        } finally {
          const elapsed = Date.now() - startedAt;
          if (PERF_LOGS_ENABLED && elapsed >= SLOW_QUERY_MS) {
            console.warn(
              "slow_query",
              JSON.stringify({
                model,
                operation,
                elapsedMs: elapsed,
                strictDbIdentityMode,
                hasUserId: Boolean(userId),
                hasUserEmail: Boolean(userEmail),
              }),
            );
          }
        }
      },
    },
  },
});

export const prismaAdmin = basePrismaAdmin;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
  globalForPrisma.prismaAdmin = basePrismaAdmin;
}
