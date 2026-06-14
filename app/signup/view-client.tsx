"use client";

import { useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { Label } from "@/components/ui/label";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function pwStrength(pw: string): { score: number; label: string; color: string; bg: string } {
  if (!pw) return { score: 0, label: "", color: "text-transparent", bg: "bg-transparent" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: "Weak", color: "text-rose-500", bg: "bg-rose-500" };
  if (s <= 3) return { score: s, label: "Fair", color: "text-amber-500", bg: "bg-amber-400" };
  return { score: s, label: "Strong", color: "text-emerald-600", bg: "bg-emerald-500" };
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function FieldErr({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-rose-600">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
      {msg}
    </p>
  );
}

function TextInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error: string | null;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-[color:var(--text-primary)]">
        {label}
      </Label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={[
          "flex h-11 w-full rounded-xl border px-3.5 py-2 text-sm transition-colors",
          "bg-[color:var(--card-bg)] text-[color:var(--text-primary)]",
          "placeholder:text-[color:var(--text-muted)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60",
          error ? "border-rose-400 focus-visible:ring-rose-300/50" : "[border-color:var(--border)]",
        ].join(" ")}
      />
      <FieldErr msg={error} />
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  autoComplete,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error: string | null;
  autoComplete?: string;
  children?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-[color:var(--text-primary)]">
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder ?? "••••••••"}
          autoComplete={autoComplete}
          className={[
            "flex h-11 w-full rounded-xl border px-3.5 py-2 pr-11 text-sm transition-colors",
            "bg-[color:var(--card-bg)] text-[color:var(--text-primary)]",
            "placeholder:text-[color:var(--text-muted)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60",
            error ? "border-rose-400 focus-visible:ring-rose-300/50" : "[border-color:var(--border)]",
          ].join(" ")}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {children}
      <FieldErr msg={error} />
    </div>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */

export function SignupClient({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cfToken, setCfToken] = useState("");
  // Ready when: no widget configured, OR widget solved, OR widget errored (dev/localhost — server bypasses)
  const [turnstileReady, setTurnstileReady] = useState(!SITE_KEY);

  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirm: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<"use_google" | "sign_in" | null>(null);

  const strength = pwStrength(password);

  /* field-level errors (shown after touch or submit attempt) */
  const nameErr =
    (touched.name || submitAttempted) && name.trim().length < 2
      ? "Enter your full name (at least 2 characters)."
      : null;
  const emailErr =
    (touched.email || submitAttempted) && !isValidEmail(email)
      ? email.trim() === "" ? "Email address is required." : "Enter a valid email address."
      : null;
  const passwordErr =
    (touched.password || submitAttempted) && password.length < 8
      ? "Password must be at least 8 characters."
      : null;
  const confirmErr =
    (touched.confirm || submitAttempted) && confirm !== password && confirm.length > 0
      ? "Passwords do not match."
      : (touched.confirm || submitAttempted) && confirm.length === 0
        ? "Please confirm your password."
        : null;

  const isFormValid =
    name.trim().length >= 2 &&
    isValidEmail(email) &&
    password.length >= 8 &&
    confirm === password &&
    (!SITE_KEY || cfToken);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setGlobalError(null);
    setErrorHint(null);
    if (!isFormValid) return;

    setPending(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password, cfToken }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; hint?: string; requiresVerification?: boolean };
      if (!res.ok) {
        setGlobalError(payload.error ?? "Signup failed. Please try again.");
        setErrorHint((payload.hint as "use_google" | "sign_in") ?? null);
        turnstileRef.current?.reset();
        setCfToken("");
        setPending(false);
        return;
      }
      router.push(`/verify-pending?email=${encodeURIComponent(email)}`);
    } catch {
      setGlobalError("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Name */}
        <TextInput
          id="signup-name"
          label="Full name"
          value={name}
          onChange={setName}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          placeholder="Jane Smith"
          autoComplete="name"
          error={nameErr}
        />

        {/* Email */}
        <TextInput
          id="signup-email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          placeholder="you@example.com"
          autoComplete="email"
          error={emailErr}
        />

        {/* Password + strength bar */}
        <PasswordInput
          id="signup-password"
          label="Password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          autoComplete="new-password"
          error={passwordErr}
        >
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                      i <= strength.score ? strength.bg : "bg-black/10 dark:bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium ${strength.color}`}>{strength.label}</p>
            </div>
          )}
        </PasswordInput>

        {/* Confirm password */}
        <PasswordInput
          id="signup-confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          autoComplete="new-password"
          error={confirmErr}
        >
          {confirm.length > 0 && password.length > 0 && confirm === password && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Passwords match
            </p>
          )}
        </PasswordInput>

        {/* Turnstile */}
        {SITE_KEY ? (
          <div>
            <Turnstile
              ref={turnstileRef}
              siteKey={SITE_KEY}
              onSuccess={(token) => { setCfToken(token); setTurnstileReady(true); }}
              onExpire={() => { setCfToken(""); setTurnstileReady(false); }}
              onError={() => {
                // Widget failed to connect (e.g. localhost not in allowed domains).
                // Server-side bypasses verification in non-production, so allow submission.
                setCfToken("");
                setTurnstileReady(true);
              }}
              options={{ theme: "auto", size: "normal" }}
            />
          </div>
        ) : null}

        {/* Global error — hint-aware */}
        {globalError && errorHint === "use_google" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
            <p className="flex items-start gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {globalError}
            </p>
            {googleEnabled ? (
              <button
                type="button"
                disabled={googlePending}
                className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-lg border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--text-primary)] hover:bg-black/[0.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.04]"
                onClick={async () => {
                  setGooglePending(true);
                  try {
                    await signOut({ redirect: false });
                    await signIn("google", { callbackUrl: "/auth/post-login" }, { prompt: "select_account" });
                  } finally { setGooglePending(false); }
                }}
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
            ) : null}
          </div>
        ) : globalError && errorHint === "sign_in" ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 dark:border-sky-800/40 dark:bg-sky-900/20">
            <p className="flex items-start gap-2 text-sm font-medium text-sky-800 dark:text-sky-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {globalError}
            </p>
            <a
              href="/login"
              className="mt-2 block text-sm font-semibold text-sky-700 underline hover:text-sky-900 dark:text-sky-400"
            >
              Go to sign in →
            </a>
          </div>
        ) : globalError ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {globalError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending || !turnstileReady}
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
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

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
              setGlobalError(null);
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
        </>
      ) : null}

      <p className="text-center text-xs text-[color:var(--text-secondary)]">
        Already have an account?{" "}
        <LoadingLinkButton
          href="/login"
          variant="ghost"
          className="h-auto rounded-none px-0 py-0 font-semibold text-blue-600 hover:bg-transparent hover:underline dark:text-blue-400 dark:hover:bg-transparent"
        >
          Sign in
        </LoadingLinkButton>
      </p>
    </div>
  );
}
