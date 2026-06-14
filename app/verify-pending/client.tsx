"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function VerifyPendingClient({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleResend() {
    start(async () => {
      try {
        const response = await fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!response.ok) {
          setResult({ ok: false, message: payload.error ?? "Failed to resend. Please try again." });
        } else {
          setResult({ ok: true, message: "A new confirmation email has been sent." });
        }
      } catch {
        setResult({ ok: false, message: "Failed to resend. Please try again." });
      }
    });
  }

  if (result?.ok) {
    return (
      <p className="text-sm text-emerald-700">{result.message}</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[color:var(--text-secondary)]">Didn&apos;t receive the email?</p>
      {result && !result.ok ? (
        <p className="text-sm text-rose-600">{result.message}</p>
      ) : null}
      <Button
        className="w-full"
        variant="outline"
        loading={pending}
        disabled={pending || !email}
        onClick={handleResend}
      >
        {pending ? "Sending..." : "Resend confirmation email"}
      </Button>
    </div>
  );
}
