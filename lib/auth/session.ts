import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clearDbIdentity, getRequestCache, hasRequestCache, setDbIdentity, setRequestCache } from "@/lib/security/db-context";

export type SessionUser = { id: string; email: string; issuedAt: number };

const REAUTH_WINDOW_MS = 5 * 60 * 1000;

function isDbUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = error.message.toLowerCase();
  return (
    text.includes("can't reach database server") ||
    text.includes("connection") ||
    text.includes("timeout") ||
    text.includes("too many connections") ||
    text.includes("unable to start a transaction") ||
    text.includes("prismaclientinitializationerror")
  );
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (hasRequestCache("sessionUser")) {
    return getRequestCache<SessionUser | null>("sessionUser") ?? null;
  }

  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) {
    clearDbIdentity();
    setRequestCache("sessionUser", null);
    return null;
  }

  setDbIdentity({ userEmail: email });

  const sessionUser = session?.user as { id?: string; profileId?: string } | undefined;
  const profileIdFromSession = sessionUser?.profileId ?? null;
  const issuedAt = session?.expires ? Date.parse(session.expires) : Date.now();
  const resolvedIssuedAt = Number.isFinite(issuedAt) ? issuedAt : Date.now();

  // Fast path: trust profileId claim from authenticated session to avoid extra DB roundtrips.
  if (profileIdFromSession) {
    setDbIdentity({ userId: profileIdFromSession, userEmail: email });
    const claimedUser = { id: profileIdFromSession, email, issuedAt: resolvedIssuedAt };
    setRequestCache("sessionUser", claimedUser);
    return claimedUser;
  }

  let profileId: string | null = null;
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { email },
      select: { id: true },
    });
    profileId = profile?.id ?? null;
  } catch (error) {
    if (!isDbUnavailableError(error)) throw error;
    console.warn("session_user_db_unavailable", JSON.stringify({ hasProfileIdFromSession: false, email }));
    setRequestCache("sessionUser", null);
    return null;
  }

  if (!profileId) {
    setRequestCache("sessionUser", null);
    return null;
  }
  setDbIdentity({ userId: profileId, userEmail: email });

  const user = { id: profileId, email, issuedAt: resolvedIssuedAt };
  setRequestCache("sessionUser", user);
  return user;
}

export async function createSession(_user?: { id: string; email: string }) {
  throw new Error("Credentials session flow is disabled. Use Auth.js sign-in.");
}

export async function clearSession() {
  await signOut({ redirect: false });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  let profile: { isActive: boolean } | null = null;
  try {
    profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { isActive: true },
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      throw new Error("DATABASE_UNAVAILABLE");
    }
    throw error;
  }
  if (!profile?.isActive) throw new Error("ACCOUNT_DISABLED");
  return user;
}

export async function markRecentReauth() {
  const user = await requireUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: { reauthenticatedAt: new Date() },
  });
}

export async function hasRecentReauth() {
  const user = await getSessionUser();
  if (!user) return false;
  let profile: { reauthenticatedAt: Date | null } | null = null;
  try {
    profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { reauthenticatedAt: true },
    });
  } catch (error) {
    if (isDbUnavailableError(error)) return false;
    throw error;
  }
  if (!profile?.reauthenticatedAt) return false;
  return Date.now() - profile.reauthenticatedAt.getTime() < REAUTH_WINDOW_MS;
}
