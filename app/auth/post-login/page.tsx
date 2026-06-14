import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma, prismaAdmin } from "@/lib/prisma";
import { withDbRetry } from "@/lib/data/utils";
import { hasCompletedBudgetOnboarding } from "@/lib/data/onboarding";
import { setDbIdentity } from "@/lib/security/db-context";
import { PageHeader } from "@/components/shell/page-header";
import { DataLoadError } from "@/components/feature/data-load-error";

function isDbUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("too many connections") ||
    message.includes("unable to start a transaction") ||
    message.includes("prismaclientinitializationerror")
  );
}

function isRlsPolicyError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("row-level security policy");
}

export default async function PostLoginPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) redirect("/login");
  const sessionUser = session?.user as { id?: string; profileId?: string } | undefined;
  const authUserId = sessionUser?.id?.trim();
  setDbIdentity({ userEmail: email });

  async function ensureAuthUserLink(profileId: string) {
    if (!authUserId) return;
    try {
      await withDbRetry(
        () =>
          prismaAdmin.user.update({
            where: { id: authUserId },
            data: { profileId },
          }),
        1,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("post_login_profile_link_warning", { email, authUserId, profileId, message });
    }
  }

  let profile: { id: string } | null = null;
  try {
    profile = await withDbRetry(
      () =>
        prisma.userProfile.findUnique({
          where: { email },
          select: { id: true },
        }),
      1,
    );
  } catch (error) {
    if (isDbUnavailableError(error)) {
      console.warn("post_login_db_unavailable", { email });
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <PageHeader title="Post-login check" subtitle="We are verifying your account setup." />
          <DataLoadError
            message="We could not verify your account right now because the database is temporarily unavailable."
            primaryHref="/dashboard"
            primaryLabel="Open dashboard"
          />
        </main>
      );
    }
    throw error;
  }

  if (!profile) {
    try {
      // Use runtime Prisma for UserProfile bootstrap so RLS identity is applied from setDbIdentity().
      setDbIdentity({ userEmail: email });
      const bootstrapped = await withDbRetry(
        async () => {
          try {
            return await prisma.userProfile.upsert({
              where: { email },
              update: {},
              create: {
                email,
                name: email.split("@")[0],
                currency: "USD",
                preferredCurrency: "USD",
                baseCurrency: "USD",
              },
            });
          } catch (error) {
            if (!isRlsPolicyError(error)) throw error;
            console.warn("post_login_profile_bootstrap_runtime_rls_denied", { email });
            return prismaAdmin.userProfile.upsert({
              where: { email },
              update: {},
              create: {
                email,
                name: email.split("@")[0],
                currency: "USD",
                preferredCurrency: "USD",
                baseCurrency: "USD",
              },
            });
          }
        },
        1,
      );
      await ensureAuthUserLink(bootstrapped.id);
    } catch (error) {
      if (isDbUnavailableError(error)) {
        console.warn("post_login_profile_bootstrap_db_unavailable", { email });
        return (
          <main className="mx-auto max-w-3xl px-4 py-10">
            <PageHeader title="Post-login check" subtitle="We are setting up your account profile." />
            <DataLoadError
              message="We could not initialize your profile right now because the database is temporarily unavailable."
              primaryHref="/login"
              primaryLabel="Open login"
            />
          </main>
        );
      }
      throw error;
    }
    redirect("/onboarding");
  }

  await ensureAuthUserLink(profile.id);
  const hasBudgetSetup = await hasCompletedBudgetOnboarding(profile.id);
  redirect(hasBudgetSetup ? "/dashboard" : "/onboarding");
}
