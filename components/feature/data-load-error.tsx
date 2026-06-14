"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DataLoadError({
  message = "We could not load this page right now because the database is temporarily unavailable.",
  primaryHref,
  primaryLabel,
}: {
  message?: string;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [primaryPending, setPrimaryPending] = useState(false);

  return (
    <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
      <p className="text-sm text-red-800">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={pending}
          disabled={pending}
          onClick={() => {
            start(() => {
              router.refresh();
            });
          }}
        >
          {pending ? "Retrying..." : "Try again"}
        </Button>
        {primaryHref && primaryLabel ? (
          <Button
            size="sm"
            variant="outline"
            loading={primaryPending}
            disabled={pending || primaryPending}
            onClick={() => {
              setPrimaryPending(true);
              router.push(primaryHref);
            }}
          >
            {primaryPending ? "Opening..." : primaryLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
