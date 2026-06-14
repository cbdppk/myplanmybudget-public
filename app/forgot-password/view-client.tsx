"use client";

import { useRef, useState, useTransition } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { requestPasswordReset } from "./actions";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [cfToken, setCfToken] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  if (result?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
        {result.message}
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (SITE_KEY && !cfToken) return;
    start(async () => {
      const res = await requestPasswordReset(email, cfToken);
      if (!res.ok) {
        turnstileRef.current?.reset();
        setCfToken("");
      }
      setResult(res);
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="block text-sm">
        <Label htmlFor="forgot-email">Email address</Label>
        <Input
          id="forgot-email"
          className="mt-1"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
        />
      </div>

      {SITE_KEY ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={SITE_KEY}
          onSuccess={(token) => setCfToken(token)}
          onExpire={() => setCfToken("")}
          onError={() => setCfToken("")}
          options={{ theme: "auto", size: "normal" }}
        />
      ) : null}

      {result && !result.ok ? <Alert>{result.message}</Alert> : null}
      <Button
        className="w-full"
        loading={pending}
        disabled={pending || (Boolean(SITE_KEY) && !cfToken)}
      >
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
