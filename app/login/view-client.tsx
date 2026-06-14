"use client";

import { useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Eye, EyeOff, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { Label } from "@/components/ui/label";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/* ── shared helpers ──────────────────────────────────────────────────────── */

function GlobalError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

function PrimaryBtn({
  disabled,
  pending,
  label,
  loadingLabel,
}: {
  disabled: boolean;
  pending: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={[
        "relative flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all",
        "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:bg-white dark:text-slate-900 dark:hover:bg-white/90",
      ].join(" ")}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */

export function LoginClient({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [backupMode, setBackupMode] = useState(false);
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cfToken, setCfToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(!SITE_KEY);

  /* OAuth error from URL params */
  const oauthError = (() => {
    const code = params.get("error");
    if (!code) return null;
    if (code === "AccessDenied") return "Access denied for this account.";
    if (code === "OAuthAccountNotLinked") return "This Google account is linked to a different profile. Sign out first.";
    if (code === "AccountInactive") return "This account has been deactivated.";
    if (code === "OAuthEmailMissing") return "Google did not share an email for this account.";
    if (code === "EmailNotVerified") return "__VERIFY__";
    return "Sign-in failed. Please try again.";
  })();

  const emailForResend = params.get("email") ?? "";

  async function doSignIn(withTotpCode?: string) {
    setPending(true);
    setLocalError(null);
    try {
      await signOut({ redirect: false });
      const result = await signIn("credentials", {
        email,
        password,
        totpCode: withTotpCode ?? "",
        cfToken: withTotpCode ? "" : cfToken,
        redirect: false,
        callbackUrl: "/auth/post-login",
      });
      if (!result || result.error) {
        if (step === "totp") {
          setLocalError(
            backupMode
              ? "Invalid backup code. Check the code and try again."
              : "Invalid 2FA code. Check your authenticator app and try again."
          );
        } else {
          setLocalError("Incorrect email or password.");
          turnstileRef.current?.reset();
          setCfToken("");
        }
        setPending(false);
        return;
      }
      try {
        await fetch("/api/auth/session", { cache: "no-store" });
      } catch {
        // non-blocking session pre-warm
      }
      window.location.assign(result.url || "/auth/post-login");
    } catch {
      setLocalError("Sign-in failed. Check your connection and try again.");
      setPending(false);
    }
  }

  /* ── TOTP / backup-code step ─────────────────────────────────────────── */
  if (step === "totp") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void doSignIn(totpCode);
        }}
      >
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm dark:border-sky-800/40 dark:bg-sky-900/20">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="text-sky-800 dark:text-sky-300">
            {backupMode
              ? "Enter one of your saved backup codes."
              : "Two-factor authentication is enabled. Enter the code from your authenticator app."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-totp" className="text-sm font-medium text-[color:var(--text-primary)]">
            {backupMode ? "Backup code" : "Authenticator code"}
          </Label>
          <input
            id="login-totp"
            type="text"
            inputMode={backupMode ? "text" : "numeric"}
            placeholder={backupMode ? "ABCD-1234" : "000000"}
            maxLength={backupMode ? 9 : 6}
            value={totpCode}
            onChange={(e) =>
              setTotpCode(
                backupMode
                  ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")
                  : e.target.value.replace(/\D/g, "")
              )
            }
            autoFocus
            autoComplete="one-time-code"
            className="flex h-11 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3.5 text-center text-lg tracking-[0.25em] text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          />
        </div>

        <GlobalError msg={localError} />

        <PrimaryBtn
          pending={pending}
          disabled={pending || (backupMode ? totpCode.replace("-", "").length < 8 : totpCode.length < 6)}
          label="Verify and sign in"
          loadingLabel="Verifying…"
        />

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-[color:var(--text-secondary)] underline hover:text-[color:var(--text-primary)]"
            onClick={() => { setStep("credentials"); setTotpCode(""); setLocalError(null); setBackupMode(false); }}
          >
            ← Back to sign in
          </button>
          <button
            type="button"
            className="text-[color:var(--text-secondary)] underline hover:text-[color:var(--text-primary)]"
            onClick={() => { setBackupMode((v) => !v); setTotpCode(""); setLocalError(null); }}
          >
            {backupMode ? "Use authenticator code" : "Use backup code"}
          </button>
        </div>
      </form>
    );
  }

  /* ── credentials step ────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (SITE_KEY && !cfToken) {
            setLocalError("Please wait for the security check to complete.");
            return;
          }
          setPending(true);
          setLocalError(null);
          void (async () => {
            try {
              const check = await fetch(`/api/auth/totp-required?email=${encodeURIComponent(email)}`);
              const { totpRequired } = (await check.json()) as { totpRequired: boolean };
              if (totpRequired) {
                setPending(false);
                setStep("totp");
                return;
              }
            } catch {
              // if check fails, proceed — server will validate
            }
            await doSignIn();
          })();
        }}
      >
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-sm font-medium text-[color:var(--text-primary)]">
            Email address
          </Label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="flex h-11 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3.5 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-sm font-medium text-[color:var(--text-primary)]">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-[color:var(--text-secondary)] underline hover:text-[color:var(--text-primary)]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              minLength={8}
              required
              className="flex h-11 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3.5 pr-11 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Turnstile */}
        {SITE_KEY ? (
          <Turnstile
            ref={turnstileRef}
            siteKey={SITE_KEY}
            onSuccess={(token) => { setCfToken(token); setTurnstileReady(true); }}
            onExpire={() => { setCfToken(""); setTurnstileReady(false); }}
            onError={() => {
              // Widget failed (e.g. localhost not in allowed domains).
              // Server bypasses in non-production, so allow submission.
              setCfToken("");
              setTurnstileReady(true);
            }}
            options={{ theme: "auto", size: "normal" }}
          />
        ) : null}

        <GlobalError msg={localError} />

        <PrimaryBtn
          pending={pending}
          disabled={pending || !turnstileReady}
          label="Sign in"
          loadingLabel="Signing in…"
        />
      </form>

      {/* Google OAuth */}
      {googleEnabled ? (
        <>
          <div className="relative py-1 text-center text-xs text-[color:var(--text-muted)]">
            <span className="relative z-10 bg-[color:var(--card-bg)] px-3">or continue with</span>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[color:var(--border)]" />
          </div>

          <button
            type="button"
            disabled={googlePending}
            onClick={async () => {
              setGooglePending(true);
              setLocalError(null);
              try {
                await signOut({ redirect: false });
                await signIn("google", { callbackUrl: "/auth/post-login" }, { prompt: "select_account" });
              } finally {
                setGooglePending(false);
              }
            }}
            className={[
              "flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border text-sm font-medium transition-all",
              "[border-color:var(--border)] bg-[color:var(--card-bg)] text-[color:var(--text-primary)]",
              "hover:bg-black/[0.03] active:scale-[0.98] dark:hover:bg-white/[0.04]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            {googlePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
                <path fill="#EA4335" d="M12 11v3.5h4.9c-.2 1.1-.8 2-1.7 2.7l2.8 2.2c1.6-1.5 2.5-3.8 2.5-6.4 0-.6 0-1.1-.1-1.6H12z" />
                <path fill="#34A853" d="M12 22c2.3 0 4.2-.7 5.6-2l-2.8-2.2c-.8.5-1.8.9-2.8.9-2.2 0-4.1-1.5-4.8-3.6L4.2 17c1.4 2.9 4.4 5 7.8 5z" />
                <path fill="#4A90E2" d="M7.2 15.1c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6L4.2 9.7C3.7 10.7 3.4 11.8 3.4 13s.3 2.3.8 3.3l3-1.2z" />
                <path fill="#FBBC05" d="M12 7.3c1.2 0 2.3.4 3.2 1.3l2.4-2.4C16.2 4.9 14.3 4 12 4 8.6 4 5.6 6 4.2 9l3 2.3c.7-2.1 2.6-3.6 4.8-3.6z" />
              </svg>
            )}
            Continue with Google
          </button>

          {oauthError && oauthError !== "__VERIFY__" ? (
            <GlobalError msg={oauthError} />
          ) : null}
        </>
      ) : null}

      {/* Email not verified banner */}
      {oauthError === "__VERIFY__" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Email not verified</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Please check your inbox and click the confirmation link before signing in.
          </p>
          <Link
            href={`/verify-pending${emailForResend ? `?email=${encodeURIComponent(emailForResend)}` : ""}`}
            className="mt-2 block text-xs font-semibold text-amber-800 underline hover:text-amber-700 dark:text-amber-300"
          >
            Resend verification email →
          </Link>
        </div>
      ) : null}

      <p className="text-center text-xs text-[color:var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <LoadingLinkButton
          href="/signup"
          variant="ghost"
          className="h-auto rounded-none px-0 py-0 font-semibold text-blue-600 hover:bg-transparent hover:underline dark:text-blue-400"
        >
          Create one
        </LoadingLinkButton>
      </p>
    </div>
  );
}
