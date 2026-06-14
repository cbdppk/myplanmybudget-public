import Link from "next/link";
import { ForgotPasswordClient } from "./view-client";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="kicker">Account recovery</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--text-primary)]">Forgot password?</h1>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <div className="auth-form-shell rounded-[1.75rem] p-5">
          <ForgotPasswordClient />
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
