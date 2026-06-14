import Link from "next/link";
import { VerifyPendingClient } from "./client";

export default async function VerifyPendingPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const email = typeof params?.email === "string" ? params.email : "";

  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">Check your email</h1>
        <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
          We sent a confirmation link to{" "}
          {email ? (
            <span className="font-semibold text-[color:var(--text-primary)]">{email}</span>
          ) : (
            "your email address"
          )}
          . Click it to activate your account.
        </p>
        <p className="mt-2 text-xs text-[color:var(--text-muted)]">
          The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
        </p>

        <div className="auth-form-shell mt-6 rounded-[1.75rem] p-5">
          <VerifyPendingClient email={email} />
        </div>

        <p className="mt-6 text-xs text-[color:var(--text-muted)]">
          Already confirmed?{" "}
          <Link href="/login" className="underline hover:text-[color:var(--text-primary)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
