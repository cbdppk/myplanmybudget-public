import Link from "next/link";
import { ResetPasswordClient } from "./view-client";
import { validateResetToken } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const token = typeof params?.token === "string" ? params.token : "";

  const { valid } = token ? await validateResetToken(token) : { valid: false };

  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="kicker">Account recovery</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--text-primary)]">Set new password</h1>
          {valid ? (
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              Choose a strong password for your account.
            </p>
          ) : null}
        </div>

        <div className="auth-form-shell rounded-[1.75rem] p-5">
          {valid ? (
            <ResetPasswordClient token={token} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                This reset link is invalid or has expired.
              </div>
              <Link
                href="/forgot-password"
                className="block text-center text-sm underline text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
              >
                Request a new reset link
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[color:var(--text-muted)]">
          Remember your password?{" "}
          <Link href="/login" className="underline hover:text-[color:var(--text-primary)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
