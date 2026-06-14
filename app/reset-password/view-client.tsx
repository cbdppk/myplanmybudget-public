"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { resetPassword } from "./actions";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setResult({ ok: false, message: "Passwords do not match." });
      return;
    }
    start(async () => {
      const res = await resetPassword(token, password);
      setResult(res);
    });
  }

  if (result?.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          {result.message}
        </div>
        <LoadingLinkButton href="/login" className="w-full">
          Sign in
        </LoadingLinkButton>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="block text-sm">
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          className="mt-1"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          placeholder="At least 8 characters"
          required
          autoFocus
        />
      </div>
      <div className="block text-sm">
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <Input
          id="reset-confirm"
          className="mt-1"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          placeholder="Repeat password"
          required
        />
      </div>
      {result && !result.ok ? <Alert>{result.message}</Alert> : null}
      <Button className="w-full" loading={pending} disabled={pending}>
        {pending ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
}
