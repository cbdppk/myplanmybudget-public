import { requireAdmin } from "@/lib/auth/permissions";
import { prisma, prismaAdmin } from "@/lib/prisma";

function cleanEnv(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextAuthUrl = cleanEnv(process.env.NEXTAUTH_URL);
  const nextAuthSecret = cleanEnv(process.env.NEXTAUTH_SECRET);
  const authSecret = cleanEnv(process.env.AUTH_SECRET);
  const googleClientId = cleanEnv(process.env.GOOGLE_CLIENT_ID);
  const googleClientSecret = cleanEnv(process.env.GOOGLE_CLIENT_SECRET);

  const warnings: string[] = [];
  if (!nextAuthSecret && !authSecret) warnings.push("Missing NEXTAUTH_SECRET/AUTH_SECRET.");
  if (!nextAuthUrl) warnings.push("Missing NEXTAUTH_URL.");
  if (!googleClientId || !googleClientSecret) warnings.push("Google OAuth env is missing.");
  if (nextAuthUrl && !nextAuthUrl.startsWith("https://") && process.env.NODE_ENV === "production") {
    warnings.push("NEXTAUTH_URL should be https:// in production.");
  }

  const runtimeDbStart = Date.now();
  const runtimeRole = await prisma.$queryRawUnsafe<{ role: string; rolbypassrls: boolean }[]>(
    "SELECT current_user AS role, rolbypassrls FROM pg_roles WHERE rolname = current_user"
  ).catch(() => [] as { role: string; rolbypassrls: boolean }[]);
  const runtimeDbMs = Date.now() - runtimeDbStart;

  const adminDbStart = Date.now();
  const adminRole = await prismaAdmin.$queryRawUnsafe<{ role: string; rolbypassrls: boolean }[]>(
    "SELECT current_user AS role, rolbypassrls FROM pg_roles WHERE rolname = current_user"
  ).catch(() => [] as { role: string; rolbypassrls: boolean }[]);
  const adminDbMs = Date.now() - adminDbStart;

  if (process.env.NODE_ENV === "production" && runtimeRole[0]?.rolbypassrls) {
    warnings.push("Runtime DB role has BYPASSRLS enabled.");
  }
  if (runtimeDbMs > 1500) {
    warnings.push(`Runtime DB latency is high (${runtimeDbMs}ms).`);
  }

  return Response.json({
    ok: warnings.length === 0,
    env: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      NEXTAUTH_URL: Boolean(nextAuthUrl),
      NEXTAUTH_SECRET: Boolean(nextAuthSecret),
      AUTH_SECRET: Boolean(authSecret),
      GOOGLE_CLIENT_ID: Boolean(googleClientId),
      GOOGLE_CLIENT_SECRET: Boolean(googleClientSecret),
    },
    db: {
      runtime: {
        role: runtimeRole[0]?.role ?? null,
        bypassRls: runtimeRole[0]?.rolbypassrls ?? null,
        latencyMs: runtimeDbMs,
      },
      admin: {
        role: adminRole[0]?.role ?? null,
        bypassRls: adminRole[0]?.rolbypassrls ?? null,
        latencyMs: adminDbMs,
      },
    },
    warnings,
  });
}
