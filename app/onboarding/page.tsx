import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { OnboardingForm } from "./client";
import { getOnboardingUser, hasCompletedBudgetOnboarding } from "@/lib/data/onboarding";
import { DataLoadError } from "@/components/feature/data-load-error";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function mapOnboardingErrorToMessage(message: string) {
  const lower = message.toLowerCase();
  if (message.includes("ACCOUNT_DISABLED")) {
    return "Your account is disabled. Contact support or an administrator.";
  }
  if (message.includes("DB_IDENTITY_REQUIRED")) {
    return "Your session context is invalid. Please sign in again.";
  }
  if (
    lower.includes("can't reach database server") ||
    lower.includes("connection") ||
    lower.includes("timeout") ||
    lower.includes("too many connections") ||
    lower.includes("unable to start a transaction") ||
    lower.includes("database_unavailable")
  ) {
    return "We could not load onboarding because the database is temporarily unavailable.";
  }
  return "We could not load onboarding right now. Please retry.";
}

export default async function OnboardingPage() {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const requestId = requestHeaders.get("x-request-id");
  const hasSessionCookie = requestCookies.getAll().some((item) => {
    const name = item.name;
    return (
      name === "authjs.session-token" ||
      name.startsWith("authjs.session-token.") ||
      name === "__Secure-authjs.session-token" ||
      name.startsWith("__Secure-authjs.session-token.") ||
      name === "next-auth.session-token" ||
      name.startsWith("next-auth.session-token.") ||
      name === "__Secure-next-auth.session-token" ||
      name.startsWith("__Secure-next-auth.session-token.")
    );
  });

  let user: Awaited<ReturnType<typeof getOnboardingUser>> | null = null;
  let loadError: string | null = null;
  try {
    user = await getOnboardingUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const digest =
      typeof error === "object" && error && "digest" in error
        ? String((error as { digest?: unknown }).digest ?? "")
        : undefined;
    if (message.includes("UNAUTHENTICATED")) {
      if (!hasSessionCookie) {
        const next = encodeURIComponent("/onboarding");
        redirect(`/login?next=${next}`);
      }
      loadError = "Your session could not be verified for onboarding. Open login once to refresh your session, then return here.";
    } else {
      loadError = mapOnboardingErrorToMessage(message);
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "onboarding_load_warning",
        JSON.stringify({
          requestId: requestId ?? undefined,
          message,
          digest: digest || undefined,
        }),
      );
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader
          title="Onboarding"
          subtitle="Create your baseline budget workspace."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Back to app</Link>
            </Button>
          }
        />
        <DataLoadError message={loadError ?? undefined} primaryHref="/login" primaryLabel="Open auth" />
      </main>
    );
  }

  const alreadyOnboarded = await hasCompletedBudgetOnboarding(user.id);
  if (alreadyOnboarded) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Onboarding"
        subtitle="Create your baseline budget workspace."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Back to app</Link>
          </Button>
        }
      />
      <div className="mt-6">
        <OnboardingForm defaultName={user.name ?? ""} defaultCurrency={user.currency} />
      </div>
    </main>
  );
}
