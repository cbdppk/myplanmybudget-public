import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma, prismaAdmin } from "@/lib/prisma";
import { getStoredPasswordHash, maybePromoteBootstrapAdmin } from "@/lib/data/auth";
import { verifyPassword } from "@/lib/auth/password";
import { setDbIdentity } from "@/lib/security/db-context";
import { verifyTotpCode } from "@/lib/data/totp";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { isAccountLockedOut, recordFailedLogin, clearFailedLogins } from "@/lib/security/login-guard";
import { useBackupCode } from "@/lib/data/totp";

function cleanEnv(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

const nextAuthSecret = cleanEnv(process.env.NEXTAUTH_SECRET);
const authSecretFallback = cleanEnv(process.env.AUTH_SECRET);
const authSecret = nextAuthSecret || authSecretFallback;
if (!authSecret || authSecret.length < 32) {
  throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) must be set and at least 32 characters long.");
}
const googleClientId = cleanEnv(process.env.GOOGLE_CLIENT_ID);
const googleClientSecret = cleanEnv(process.env.GOOGLE_CLIENT_SECRET);
const googleEnabled = Boolean(googleClientId && googleClientSecret);
const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      totpCode: { label: "2FA Code", type: "text" },
      cfToken: { label: "Turnstile Token", type: "text" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      // Turnstile bot check — only on the initial credentials step (not TOTP re-attempt)
      const cfToken = String(credentials?.cfToken ?? "");
      const totpCode = String(credentials?.totpCode ?? "");
      if (!totpCode) {
        const turnstileOk = await verifyTurnstile(cfToken || undefined);
        if (!turnstileOk) return null;
      }

      // Account lockout — check before any DB auth work
      const lockout = await isAccountLockedOut(email);
      if (lockout.locked) return null;

      setDbIdentity({ userEmail: email });
      const profile = await prisma.userProfile.findUnique({
        where: { email },
        select: { id: true, email: true, isActive: true, name: true, totpEnabled: true, totpSecret: true },
      });
      if (!profile?.isActive) return null;
      setDbIdentity({ userId: profile.id, userEmail: profile.email });

      const hash = await getStoredPasswordHash(profile.id);
      if (!hash || !verifyPassword(password, hash)) {
        await recordFailedLogin(email);
        return null;
      }

      // Validate TOTP if enabled — accepts authenticator code OR a backup code
      if (profile.totpEnabled && profile.totpSecret) {
        const code = String(credentials?.totpCode ?? "").replace(/\s/g, "");
        if (!code) {
          await recordFailedLogin(email);
          return null;
        }
        const totpOk = verifyTotpCode(profile.totpSecret, code);
        if (!totpOk) {
          const backupOk = await useBackupCode(profile.id, code);
          if (!backupOk) {
            await recordFailedLogin(email);
            return null;
          }
        }
      }

      await clearFailedLogins(email);
      await maybePromoteBootstrapAdmin(profile.id, profile.email);

      const authUser = await prismaAdmin.user.upsert({
        where: { email: profile.email },
        update: { profileId: profile.id, name: profile.name ?? undefined },
        create: { email: profile.email, name: profile.name ?? profile.email.split("@")[0], profileId: profile.id },
        select: { id: true, email: true, name: true },
      });

      return {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
      };
    },
  }),
];
if (googleEnabled) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prismaAdmin),
  secret: authSecret,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12, updateAge: 60 * 60 },
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === "production",
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  logger: {
    error(code, ...message) {
      const codeValue = typeof code === "string" ? code : code instanceof Error ? code.name : "";
      const rendered = [code, ...message]
        .map((item) => (item instanceof Error ? item.message : String(item)))
        .join(" ");
      const isOAuthAccountNotLinked =
        codeValue === "OAuthAccountNotLinked" || rendered.includes("OAuthAccountNotLinked");
      if (isOAuthAccountNotLinked) {
        console.warn("[auth] OAuthAccountNotLinked");
        return;
      }
      console.error("[auth][error]", code, ...message);
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return "/login?error=OAuthEmailMissing";
      setDbIdentity({ userEmail: email });

      // Google OAuth: mark email as verified since Google already confirmed it
      const isGoogle = account?.provider === "google";

      const profile = await prisma.userProfile.upsert({
        where: { email },
        update: {
          name: user.name ?? undefined,
          ...(isGoogle ? { emailVerified: true } : {}),
        },
        create: {
          email,
          name: user.name ?? null,
          currency: "GHS",
          preferredCurrency: "GHS",
          baseCurrency: "GHS",
          emailVerified: isGoogle,
          themePreference: "dark",
        },
        select: { id: true, isActive: true, emailVerified: true },
      });
      if (!profile.isActive) return "/login?error=AccountInactive";

      // Block unverified credentials users from signing in
      if (account?.provider === "credentials" && !profile.emailVerified) {
        return `/login?error=EmailNotVerified`;
      }

      const authUserId = readString((user as { id?: unknown }).id);
      if (authUserId) {
        try {
          await prismaAdmin.user.update({
            where: { id: authUserId },
            data: { profileId: profile.id, name: user.name ?? undefined },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn("auth_profile_link_warning", { email, authUserId, message });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      const IDLE_TIMEOUT_S = 2 * 60 * 60; // 2 hours of inactivity
      const nowSec = Math.floor(Date.now() / 1000);

      if (!user) {
        // Existing session refresh — check idle timeout
        const lastActive = Number((token as { lastActiveAt?: unknown }).lastActiveAt ?? 0);
        if (lastActive > 0 && nowSec - lastActive > IDLE_TIMEOUT_S) {
          // Session has been idle too long — invalidate by returning a minimal token
          return { ...token, expired: true };
        }
      }
      // Update last-active timestamp on every JWT refresh
      (token as { lastActiveAt?: number }).lastActiveAt = nowSec;

      const tokenProfileId = (token as { profileId?: unknown }).profileId;
      if (typeof tokenProfileId === "string" && tokenProfileId.trim()) return token;

      const userProfileId = user ? (user as { profileId?: unknown }).profileId : undefined;
      if (typeof userProfileId === "string" && userProfileId.trim()) {
        (token as { profileId?: string }).profileId = userProfileId.trim();
        return token;
      }

      if (!token.email) return token;
      const lastLookupAt = Number((token as { profileLookupAt?: unknown }).profileLookupAt ?? 0);
      const profileNowSec = Math.floor(Date.now() / 1000);
      if (!user && Number.isFinite(lastLookupAt) && profileNowSec - lastLookupAt < 15 * 60) {
        return token;
      }

      const email = String(token.email).toLowerCase().trim();
      try {
        setDbIdentity({ userEmail: email });
        const profile = await prisma.userProfile.findUnique({
          where: { email },
          select: { id: true },
        });
        if (profile?.id) {
          (token as { profileId?: string }).profileId = profile.id;
        }
        (token as { profileLookupAt?: number }).profileLookupAt = profileNowSec;
      } catch (error) {
        (token as { profileLookupAt?: number }).profileLookupAt = profileNowSec;
      }
      return token;
    },
    async session({ session, token }) {
      // Idle-expired sessions — strip the user so middleware treats them as unauthenticated
      if ((token as { expired?: boolean }).expired) {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      const profileId = (token as { profileId?: string }).profileId;
      if (session.user) {
        const authUserId = readString(token.sub);
        (session.user as { id?: string; profileId?: string }).id = authUserId || undefined;
        (session.user as { id?: string; profileId?: string }).profileId = profileId ?? undefined;
      }
      return session;
    },
  },
});
