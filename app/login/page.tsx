import Link from "next/link";
import { LoginClient } from "./view-client";
import { CheckCircle2 } from "lucide-react";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; verified?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const next =
    typeof params?.next === "string" &&
    params.next.startsWith("/") &&
    !params.next.startsWith("//")
      ? params.next
      : null;
  const emailJustVerified = params?.verified === "1";
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="auth-page-shell flex min-h-[calc(100dvh-64px)]">
      {/* ── Left panel (brand) ───────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,#081224_0%,#0b1830_52%,#0e1d39_100%)] p-10 lg:flex lg:w-[44%]">
        {/* Background orbs */}
        <div className="anim-glow-soft pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="anim-float-slow pointer-events-none absolute -bottom-20 -left-10 h-80 w-80 rounded-full bg-blue-700/10 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-cyan-400">
            M
          </span>
          <span className="font-bold text-white">MyplanMybudget</span>
        </div>

        {/* Middle content */}
        <div className="relative">
          <blockquote className="text-2xl font-semibold leading-snug text-white">
            &quot;The clearest money picture I&apos;ve ever had. I finally know where every dollar goes.&quot;
          </blockquote>
          <p className="mt-4 text-sm text-white/45">— A daily active user</p>
          <div className="mt-10 space-y-3">
            {[
              "Budget planned in under 5 minutes",
              "Daily clarity on income and spending",
              "Savings goals with real progress tracking",
              "Sign in and get started in seconds",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/55">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative text-xs text-white/25">
          © {new Date().getFullYear()} EyeHai Technologies
        </p>
      </div>

      {/* ── Right panel (form) ───────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-cyan-400">
              M
            </span>
            <span className="font-bold text-[color:var(--text-primary)]">MyplanMybudget</span>
          </Link>

          <div>
            <p className="kicker">Welcome back</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--text-primary)]">Sign in</h1>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              Don&apos;t have an account?{" "}
              <LoadingLinkButton
                href="/signup"
                variant="ghost"
                className="h-auto rounded-none px-0 py-0 font-semibold text-blue-600 hover:bg-transparent hover:underline dark:text-blue-400 dark:hover:bg-transparent"
              >
                Create one
              </LoadingLinkButton>
            </p>
          </div>

          {next ? (
            <div className="theme-card-soft mt-4 rounded-xl px-4 py-3 text-xs text-[color:var(--text-secondary)]">
              After signing in you will be redirected to:{" "}
              <span className="font-semibold text-[color:var(--text-primary)]">{next}</span>
            </div>
          ) : null}

          {emailJustVerified ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Email confirmed! You can now sign in.
            </div>
          ) : null}

          <div className="auth-form-shell mt-8 rounded-[1.75rem] p-5">
            <LoginClient googleEnabled={googleEnabled} />
          </div>

          <p className="mt-6 text-xs text-[color:var(--text-muted)]">
            By continuing, you agree to our{" "}
            <Link href="/legal/terms" className="underline hover:text-[color:var(--text-primary)]">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline hover:text-[color:var(--text-primary)]">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
