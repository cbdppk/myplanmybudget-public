"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startTotpSetup, verifyAndEnableTotp, disableTotpAction } from "./totp-actions";

export function TotpSetup({ totpEnabled }: { totpEnabled: boolean }) {
  const [step, setStep] = useState<"idle" | "setup" | "backup" | "disable">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (totpEnabled && step === "idle") {
    return (
      <section className="card p-5">
        <h3 className="text-sm font-semibold">Two-Factor Authentication (2FA)</h3>
        <p className="mt-1 text-xs text-emerald-700 font-medium">2FA is enabled on your account.</p>
        <p className="mt-1 text-xs text-black/60">Enter your authenticator code to disable 2FA.</p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setStep("disable"); setCode(""); setMessage(null); }}>
            Disable 2FA
          </Button>
        </div>
      </section>
    );
  }

  if (step === "disable") {
    return (
      <section className="card p-5">
        <h3 className="text-sm font-semibold">Disable Two-Factor Authentication</h3>
        <p className="mt-1 text-xs text-black/60">Enter your current 6-digit authenticator code to confirm.</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            className="h-10 w-36 rounded-xl border border-black/15 px-3 text-center tracking-widest"
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            size="sm"
            loading={pending}
            disabled={pending || code.length < 6}
            onClick={() => {
              start(async () => {
                const result = await disableTotpAction(code);
                if (result.ok) {
                  toast.success("2FA disabled.");
                  setStep("idle");
                  setCode("");
                } else {
                  setMessage(result.error ?? "Failed.");
                  toast.error(result.error ?? "Failed.");
                }
              });
            }}
          >
            Confirm disable
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setStep("idle"); setCode(""); setMessage(null); }}>
            Cancel
          </Button>
        </div>
        {message ? <p className="mt-2 text-xs text-red-600">{message}</p> : null}
      </section>
    );
  }

  if (step === "setup" && qrCode) {
    return (
      <section className="card p-5">
        <h3 className="text-sm font-semibold">Set Up Two-Factor Authentication</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-black/70">
          <li>Install an authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
          <li>Scan the QR code below</li>
          <li>Enter the 6-digit code from your app to confirm</li>
        </ol>
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="TOTP QR code — scan with authenticator app" className="h-40 w-40 rounded-xl border border-black/10" />
          <div className="space-y-2">
            <p className="text-xs text-black/60">Enter the 6-digit code:</p>
            <input
              className="h-10 w-36 rounded-xl border border-black/15 px-3 text-center text-lg tracking-widest"
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={pending}
                disabled={pending || code.length < 6}
                onClick={() => {
                  start(async () => {
                    const result = await verifyAndEnableTotp(code);
                    if (result.ok) {
                      toast.success("2FA enabled! Save your backup codes.");
                      setBackupCodes(result.backupCodes ?? []);
                      setStep("backup");
                      setQrCode(null);
                      setCode("");
                    } else {
                      setMessage(result.error ?? "Failed.");
                      toast.error(result.error ?? "Invalid code, try again.");
                    }
                  });
                }}
              >
                Enable 2FA
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setStep("idle"); setQrCode(null); setCode(""); setMessage(null); }}>
                Cancel
              </Button>
            </div>
            {message ? <p className="text-xs text-red-600">{message}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  if (step === "backup") {
    return (
      <section className="card p-5">
        <h3 className="text-sm font-semibold text-emerald-700">2FA Enabled — Save Your Backup Codes</h3>
        <p className="mt-1 text-xs text-black/60">
          These 10 single-use codes let you access your account if you lose your authenticator. Store them somewhere safe — they will not be shown again.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] p-4 font-mono text-sm">
          {backupCodes.map((c) => (
            <span key={c} className="select-all text-black/80">{c}</span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(backupCodes.join("\n"));
              toast.success("Backup codes copied.");
            }}
          >
            Copy all
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setBackupCodes([]);
              setStep("idle");
              window.location.reload();
            }}
          >
            Done — I saved them
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <h3 className="text-sm font-semibold">Two-Factor Authentication (2FA)</h3>
      <p className="mt-1 text-xs text-black/60">
        Protect your account with a time-based one-time password (TOTP) from an authenticator app.
      </p>
      <div className="mt-3">
        <Button
          size="sm"
          loading={pending}
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              try {
                const result = await startTotpSetup();
                setQrCode(result.qrCode);
                setStep("setup");
              } catch (error) {
                const msg = error instanceof Error ? error.message : "Failed to start setup.";
                setMessage(msg);
                toast.error(msg);
              }
            });
          }}
        >
          Set up 2FA
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-red-600">{message}</p> : null}
    </section>
  );
}
