import Link from "next/link";
import { SignupClient } from "./view-client";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { CheckCircle2, Sparkles } from "lucide-react";

export default async function SignupPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="auth-page-shell flex min-h-[calc(100dvh-64px)]">
      {/* ── Left panel (brand) ───────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,#081224_0%,#0b1830_52%,#0e1d39_100%)] p-10 lg:flex lg:w-[44%]">
        {/* Background orbs */}
        <div className="anim-glow-soft pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="anim-float-slow pointer-events-none absolute -bottom-20 -left-10 h-80 w-80 rounded-full bg-indigo-700/10 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-cyan-400">
            M
          </span>
          <span className="font-bold text-white">MyplanMybudget</span>
        </div>

        {/* Middle content */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400">
            <Sparkles className="h-3 w-3" />
            Get started today
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-tight text-white">
            Get a clear picture of your money in minutes.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            Join people using MyplanMybudget to plan smarter, spend less, and save more — every month.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Set up your first budget in 5 minutes",
              "Track every expense and income",
              "Build savings goals step by step",
              "Run 'what if' simulations risk-free",
              "Get started and take control in minutes",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/55">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                {item}
              </div>
            ))}
          </div>
          {/* Mini mockup */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] text-white/35">Your dashboard preview</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Income", "$5,200", "text-emerald-400"],
                ["Spent", "$3,140", "text-amber-400"],
                ["Left", "$2,060", "text-cyan-400"],
              ].map(([label, val, color]) => (
                <div key={label} className="rounded-xl bg-slate-800 p-2.5">
                  <p className="text-[9px] text-white/35">{label}</p>
                  <p className={`mt-0.5 text-xs font-bold ${color}`}>{val}</p>
                </div>
              ))}
            </div>
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
            <p className="kicker">Get started</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--text-primary)]">Create your account</h1>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
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

          <div className="auth-form-shell mt-8 rounded-[1.75rem] p-5">
            <SignupClient googleEnabled={googleEnabled} />
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
