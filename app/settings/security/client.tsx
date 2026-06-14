"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSecurityPreferences, changePassword } from "../actions";
import { HelpTip } from "../_components/help-tip";
import { TotpSetup } from "./totp-setup";


export function SecuritySettingsForm({
  initialNotifyEmail,
  recentlyVerified,
  verificationFailed,
  hasRecentReauth,
  googleEnabled,
  totpEnabled,
  hasPassword,
  linkedProviders,
}: {
  initialNotifyEmail: boolean;
  recentlyVerified: boolean;
  verificationFailed: boolean;
  hasRecentReauth: boolean;
  googleEnabled: boolean;
  totpEnabled: boolean;
  hasPassword: boolean;
  linkedProviders: string[];
}) {
  const router = useRouter();
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ ok: boolean; text: string } | null>(
    recentlyVerified
      ? { ok: true, text: "Identity verified. Sensitive actions unlocked for 10 minutes." }
      : verificationFailed
        ? { ok: false, text: "Verification failed — please try again." }
        : null
  );
  const popupCleanupRef = useRef<(() => void) | null>(null);

  // Clean up popup listener on unmount.
  useEffect(() => () => { popupCleanupRef.current?.(); }, []);

  // Fallback path: reauth-complete page stored the result in sessionStorage
  // (used when the popup was blocked and a full-page redirect was used instead).
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("reauth_verified_status");
      if (!stored) return;
      sessionStorage.removeItem("reauth_verified_status");
      if (stored === "done") {
        setVerifyMessage({ ok: true, text: "Identity verified. Sensitive actions unlocked for 10 minutes." });
        router.refresh();
      } else {
        setVerifyMessage({ ok: false, text: "Verification failed — please try again." });
      }
    } catch {
      // sessionStorage unavailable.
    }
  }, [router]);

  useEffect(() => {
    setNotifyEmail(initialNotifyEmail);
  }, [initialNotifyEmail]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, startPassword] = useTransition();
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [prefsPending, startPrefs] = useTransition();
  const [prefsMessage, setPrefsMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const googleLinked = linkedProviders.includes("google");

  async function handleGoogleVerify() {
    setVerifyPending(true);
    setVerifyMessage(null);

    // Open the popup SYNCHRONOUSLY — before any await — so browsers don't
    // treat it as a non-gesture popup and block it. We load a neutral loading
    // page first, then navigate the popup to the real auth URL after the fetch.
    const popup = window.open(
      "/auth/reauth-pending",
      "reauth-popup",
      "width=520,height=620,popup=true",
    );

    try {
      const response = await fetch("/api/auth/reauth/start", { method: "POST" });
      if (!response.ok) {
        popup?.close();
        setVerifyMessage({ ok: false, text: "Unable to start verification. Please try again." });
        setVerifyPending(false);
        return;
      }
      const payload = (await response.json()) as { callbackUrl?: string };
      if (!payload.callbackUrl) {
        popup?.close();
        setVerifyMessage({ ok: false, text: "Unable to start verification. Please try again." });
        setVerifyPending(false);
        return;
      }

      const targetUrl = `/auth/reauth-google?callbackUrl=${encodeURIComponent(payload.callbackUrl)}`;

      if (popup && !popup.closed) {
        // Navigate the already-open popup to the actual auth flow.
        popup.location.href = targetUrl;

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if ((event.data as { type?: string })?.type !== "reauth-complete") return;
          cleanup();
          const status = (event.data as { status?: string })?.status;
          setVerifyPending(false);
          if (status === "done") {
            setVerifyMessage({ ok: true, text: "Identity verified. Sensitive actions unlocked for 10 minutes." });
            router.refresh();
          } else {
            setVerifyMessage({ ok: false, text: "Verification failed — please try again." });
          }
        };

        // Detect popup closed without completing (user dismissed it).
        const checkClosedTimer = setInterval(() => {
          if (popup.closed) {
            cleanup();
            setVerifyPending(false);
          }
        }, 600);

        const cleanup = () => {
          clearInterval(checkClosedTimer);
          window.removeEventListener("message", handleMessage);
          popupCleanupRef.current = null;
        };
        popupCleanupRef.current = cleanup;
        window.addEventListener("message", handleMessage);
      } else {
        // Popup was blocked even after synchronous open — last resort full-page redirect.
        // reauth-complete will use sessionStorage to communicate back without URL params.
        await signIn("google", { callbackUrl: payload.callbackUrl });
      }
    } catch {
      popup?.close();
      setVerifyMessage({ ok: false, text: "Something went wrong. Please try again." });
      setVerifyPending(false);
    }
  }


  return (
    <div className="space-y-5">

      {/* ── Identity verification ── */}
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Identity verification</h2>
            <HelpTip text="Some sensitive actions (exports, danger zone) require a recent re-verification to confirm it's really you." />
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hasRecentReauth ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-black/[0.05] dark:bg-white/[0.05] text-[color:var(--text-muted)]"}`}>
            {hasRecentReauth ? "Verified" : "Not verified"}
          </span>
        </div>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          {hasRecentReauth
            ? "Your identity is verified for the next 10 minutes. You can perform sensitive actions."
            : "Verify your identity to unlock exports and danger-zone operations."}
        </p>

        {verifyMessage ? (
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${verifyMessage.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
            {verifyMessage.text}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {googleEnabled ? (
            <Button
              size="sm"
              loading={verifyPending}
              disabled={verifyPending || hasRecentReauth}
              onClick={handleGoogleVerify}
            >
              {hasRecentReauth ? "Already verified" : "Verify with Google"}
            </Button>
          ) : (
            <p className="text-xs text-[color:var(--text-muted)]">Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.</p>
          )}
        </div>

        {googleLinked ? null : googleEnabled ? (
          <p className="mt-2 text-xs text-amber-700">Your account is not linked to Google. Link it first via your profile settings.</p>
        ) : null}
      </section>

      {/* ── Linked accounts ── */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Linked accounts</h2>
          <HelpTip text="OAuth providers connected to your account. You can sign in with any of these." />
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl border [border-color:var(--border)] px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--card-bg)] shadow-sm ring-1 ring-black/10">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              </span>
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="text-xs text-[color:var(--text-muted)]">Sign in with your Google account</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${googleLinked ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-black/[0.05] dark:bg-white/[0.05] text-[color:var(--text-muted)]"}`}>
              {googleLinked ? "Connected" : "Not linked"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border [border-color:var(--border)] px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--card-bg)] shadow-sm ring-1 ring-black/10 text-sm">🔑</span>
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-[color:var(--text-muted)]">Email + password credentials</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hasPassword ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-black/[0.05] dark:bg-white/[0.05] text-[color:var(--text-muted)]"}`}>
              {hasPassword ? "Set" : "None"}
            </span>
          </div>
        </div>
      </section>

      {/* ── 2FA / TOTP ── */}
      <TotpSetup totpEnabled={totpEnabled} />

      {/* ── Change password ── */}
      {hasPassword ? (
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Change password</h2>
            <HelpTip text="Update your login password. You must enter your current password to confirm the change." />
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="current-password" className="text-xs">Current password</Label>
              <Input id="current-password" className="mt-1" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <Label htmlFor="new-password" className="text-xs">New password</Label>
              <Input id="new-password" className="mt-1" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" />
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Minimum 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirm-new-password" className="text-xs">Confirm new password</Label>
              <Input id="confirm-new-password" className="mt-1" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" />
            </div>
            {passwordMessage ? (
              <div className={`rounded-xl px-3 py-2 text-xs font-medium ${passwordMessage.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 text-rose-700"}`}>
                {passwordMessage.text}
              </div>
            ) : null}
            <Button
              size="sm"
              loading={passwordPending}
              disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
              onClick={() => {
                if (newPassword !== confirmPassword) {
                  setPasswordMessage({ ok: false, text: "New passwords do not match." });
                  return;
                }
                if (newPassword.length < 8) {
                  setPasswordMessage({ ok: false, text: "Password must be at least 8 characters." });
                  return;
                }
                setPasswordMessage(null);
                startPassword(async () => {
                  const result = await changePassword({ currentPassword, newPassword });
                  if (result.ok) {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordMessage({ ok: true, text: "Password updated successfully." });
                    toast.success("Password updated.");
                  } else {
                    setPasswordMessage({ ok: false, text: result.error });
                    toast.error(result.error);
                  }
                });
              }}
            >
              Update password
            </Button>
          </div>
        </section>
      ) : null}

      {/* ── Security preferences ── */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Security preferences</h2>
          <HelpTip text="Control what security notifications you receive by email." />
        </div>
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="h-4 w-4 rounded [border-color:var(--border)] accent-sky-600"
            />
            <div>
              <p className="text-sm font-medium">Security email alerts</p>
              <p className="text-xs text-[color:var(--text-muted)]">Receive an email when suspicious sign-in activity is detected.</p>
            </div>
          </label>
        </div>
        {prefsMessage ? (
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${prefsMessage.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 text-rose-700"}`}>
            {prefsMessage.text}
          </div>
        ) : null}
        <div className="mt-4">
          <Button
            size="sm"
            loading={prefsPending}
            disabled={prefsPending}
            onClick={() => {
              setPrefsMessage(null);
              startPrefs(async () => {
                try {
                  await updateSecurityPreferences({ notifyEmail });
                  setPrefsMessage({ ok: true, text: "Preferences saved." });
                  toast.success("Security preferences saved.");
                } catch (error) {
                  const msg = error instanceof Error ? error.message : "Failed to save.";
                  setPrefsMessage({ ok: false, text: msg });
                  toast.error(msg);
                }
              });
            }}
          >
            Save preferences
          </Button>
        </div>
      </section>

    </div>
  );
}
