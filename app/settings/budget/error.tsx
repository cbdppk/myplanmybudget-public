"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SettingsBudgetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("settings_budget_render_error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
      <h2 className="text-sm font-semibold text-rose-900">Could not complete this settings request</h2>
      <p className="mt-1 text-sm text-rose-800">
        Your session or validation state may have changed. Retry once, then re-verify in Security if needed.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-rose-700/90">Error reference: {error.digest}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/security">Open Security</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings">Settings home</Link>
        </Button>
      </div>
    </section>
  );
}
