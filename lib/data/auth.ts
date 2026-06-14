import { prisma } from "@/lib/prisma";
import { setDbIdentity } from "@/lib/security/db-context";

function getBootstrapAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function shouldBootstrapAdmin(email: string) {
  return getBootstrapAdminEmails().has(email.trim().toLowerCase());
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  setDbIdentity({ userEmail: normalizedEmail });
  return prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, role: true, isActive: true },
  });
}

export async function createAuthUser(email: string, name?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  setDbIdentity({ userEmail: normalizedEmail });
  const resolvedName = name?.trim() || normalizedEmail.split("@")[0];
  const created = await prisma.userProfile.create({
    data: {
      email: normalizedEmail,
      name: resolvedName,
      currency: "USD",
      role: shouldBootstrapAdmin(normalizedEmail) ? "ADMIN" : "USER",
      emailVerified: false,
      themePreference: "dark",
    },
    select: { id: true, email: true, role: true, isActive: true },
  });
  setDbIdentity({ userId: created.id, userEmail: created.email });
  await prisma.category.createMany({
    data: [
      { userId: created.id, name: "Housing", kind: "expense" },
      { userId: created.id, name: "Food", kind: "expense" },
      { userId: created.id, name: "Transport", kind: "expense" },
      { userId: created.id, name: "Emergency Fund", kind: "savings" },
      { userId: created.id, name: "Investments", kind: "savings" },
    ],
    skipDuplicates: true,
  });
  return created;
}

export async function maybePromoteBootstrapAdmin(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!shouldBootstrapAdmin(normalizedEmail)) return;
  setDbIdentity({ userId, userEmail: normalizedEmail });
  await prisma.userProfile.update({
    where: { id: userId },
    data: { role: "ADMIN", isActive: true },
  });
}

export async function saveCredentialHash(userId: string, passwordHash: string) {
  setDbIdentity({ userId });
  await prisma.authCredential.upsert({
    where: { userId },
    update: { passwordHash },
    create: { userId, passwordHash },
  });

  await prisma.auditEvent.create({
    data: {
      userId,
      action: "AUTH_CREDENTIAL_SET",
      meta: { source: "auth_credential_table" },
    },
  });
}

export async function getStoredPasswordHash(userId: string): Promise<string | null> {
  setDbIdentity({ userId });
  const credential = await prisma.authCredential.findUnique({
    where: { userId },
    select: { passwordHash: true },
  });
  if (credential?.passwordHash) return credential.passwordHash;

  // Backward-compatible read for existing deployments; will be replaced on next credential save.
  const latest = await prisma.auditEvent.findFirst({
    where: { userId, action: "AUTH_CREDENTIAL_SET" },
    orderBy: { createdAt: "desc" },
    select: { meta: true },
  });

  if (!latest?.meta || typeof latest.meta !== "object" || Array.isArray(latest.meta)) return null;
  const hash = (latest.meta as Record<string, unknown>).passwordHash;
  return typeof hash === "string" ? hash : null;
}
