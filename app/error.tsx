"use client";

import { useEffect } from "react";
import { reportException } from "@/lib/observability/sentry-runtime";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportException(error);
    console.error("app_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--page-bg)] p-8 text-center text-[color:var(--text-primary)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-3xl text-rose-700">!</div>
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Something went wrong</h1>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          An unexpected error occurred. If this keeps happening, please contact support.
        </p>
        {error.digest ? (
          <p className="mt-1 font-mono text-xs text-[color:var(--text-muted)]">ref: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-xl border [border-color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--page-secondary)]"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
