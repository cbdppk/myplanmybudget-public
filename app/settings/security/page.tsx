import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";
import { SecuritySettingsForm } from "./client";
import { hasRecentReauth, getSessionUser } from "@/lib/auth/session";
import { prisma, prismaAdmin } from "@/lib/prisma";

export const dynamic = "force-dynamic";


export default async function SettingsSecurityPage({
  searchParams,
}: {
  searchParams?: Promise<{ verified?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) return <DataLoadError primaryHref="/settings" primaryLabel="Open settings overview" />;

  const recent = await hasRecentReauth();
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  let totpEnabled = false;
  let hasPassword = false;
  let linkedProviders: string[] = [];
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser?.id) {
      const [profile, credential, authUser] = await Promise.all([
        prisma.userProfile.findUnique({
          where: { id: sessionUser.id },
          select: { totpEnabled: true },
        }),
        prisma.authCredential.findUnique({
          where: { userId: sessionUser.id },
          select: { userId: true },
        }),
        // Account (OAuth) records belong to the Auth.js User, not UserProfile.
        // Look up by profileId to get the correct userId for account lookup.
        // Use prismaAdmin to bypass RLS — Auth.js tables are not user-scoped.
        prismaAdmin.user.findUnique({
          where: { profileId: sessionUser.id },
          select: { accounts: { select: { provider: true } } },
        }),
      ]);
      totpEnabled = Boolean(profile?.totpEnabled);
      hasPassword = Boolean(credential);
      linkedProviders = (authUser?.accounts ?? []).map((a) => a.provider);
    }
  } catch {
    totpEnabled = false;
    hasPassword = false;
    linkedProviders = [];
  }

  return (
    <SecuritySettingsForm
      initialNotifyEmail={data.user.notifyEmail}
      recentlyVerified={params?.verified === "done"}
      verificationFailed={params?.verified === "failed"}
      hasRecentReauth={recent}
      googleEnabled={googleEnabled}
      totpEnabled={totpEnabled}
      hasPassword={hasPassword}
      linkedProviders={linkedProviders}
    />
  );
}
