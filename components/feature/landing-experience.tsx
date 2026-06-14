"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Coins,
  ShieldCheck,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { HeroMobileBg } from "@/components/feature/hero-mobile-bg";

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.14 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  body: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.22em]">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="public-muted mt-4 text-base leading-relaxed sm:text-lg">{body}</p>
    </div>
  );
}

function SurfaceCard({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "soft" | "accent";
}) {
  const toneClass =
    tone === "accent" ? "public-panel-accent" : tone === "soft" ? "public-panel-soft" : "public-panel";

  return <div className={`${toneClass} rounded-[1.75rem] ${className}`.trim()}>{children}</div>;
}

const highlights = [
  {
    icon: Wallet,
    title: "One clear picture of your money",
    body: "See your income, spending targets, savings, and remaining room all in one place. No more switching between apps or spreadsheets.",
  },
  {
    icon: Zap,
    title: "Log transactions in seconds",
    body: "Quick capture for income, expenses, and savings. Your live balance updates instantly so you always know where you stand.",
  },
  {
    icon: Target,
    title: "Goals that stay on track",
    body: "Set savings goals and the app tracks progress automatically, pulling from your savings categories and any surplus each month.",
  },
];

const workflowSteps = [
  {
    title: "Set up your budget",
    body: "Enter your income, planned expenses, and savings targets. Takes under 2 minutes and you only do it once per month.",
  },
  {
    title: "Track what actually happened",
    body: "Log income, expenses, and extra savings as they occur. The app updates your live balance immediately.",
  },
  {
    title: "Stay ahead of problems",
    body: "Use reminders, goals, and simulations to spot spending pressure early not just at month end.",
  },
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Your financial data is yours. We never sell it or use it for advertising.",
  },
  {
    icon: Bell,
    title: "Built for daily check-ins",
    body: "Reminders and notes live inside the same product so nothing important gets missed.",
  },
  {
    icon: BrainCircuit,
    title: "Everything in one place",
    body: "Budgeting, tracking, goals, simulations, and an AI assistant — without feeling like five separate tools.",
  },
];

const productRows = [
  { label: "Budget view", value: "Allocated, spent, and remaining in one place" },
  { label: "Transactions", value: "Fast entry for income, expense, and savings" },
  { label: "Goals", value: "Clear target math with progress and affordability" },
  { label: "Support tools", value: "Reminders, notes, simulations, and AI assistant" },
];

export function LandingExperience() {
  return (
    <div className="overflow-x-clip pb-10 sm:pb-16">
      {/* Hero — desktop: photo background, mobile: clean gradient layout */}
      <section className="relative overflow-hidden">
        {/* ── Desktop background image (lg+) ── */}
        <div className="absolute inset-0 hidden lg:block">
          <Image
            src="/images/hero-person.png"
            alt=""
            fill
            priority
            className="object-cover object-right"
            sizes="100vw"
          />
          {/* Gradient: solid on left, transparent on right */}
          <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--page-bg)] from-40% via-[color:var(--page-bg)]/80 via-60% to-transparent" />
        </div>

        {/* ── Mobile background ── */}
        <HeroMobileBg />

        {/* Subtle radial accent on desktop */}
        <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-[24rem] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_48%)] lg:block" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
          <Reveal className="max-w-xl lg:text-left">
            <h1 className="text-4xl font-semibold tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] sm:text-5xl lg:text-6xl lg:text-[color:var(--text-primary)] lg:[text-shadow:none]">
              Your money. Your plan. One clear view.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.45)] sm:text-lg lg:text-[color:var(--text-secondary)] lg:[text-shadow:none]">
              MyplanMybudget helps you plan the month, log what happened, and keep your goals in sight all from a single, clean dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LoadingLinkButton href="/signup" className="w-full rounded-2xl border-0 sm:w-auto">
                Get started free <ArrowRight className="h-4 w-4" />
              </LoadingLinkButton>
              <LoadingLinkButton href="/about" variant="outline" className="w-full rounded-2xl sm:w-auto">
                See how it works
              </LoadingLinkButton>
            </div>

            {/* Setup stat */}
            <div className="mt-8">
              <SurfaceCard tone="soft" className="inline-block px-5 py-4">
                <p className="public-subtle text-[11px] font-semibold uppercase tracking-[0.16em]">Setup time</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">Under 2 minutes</p>
                <p className="public-muted mt-1 text-xs">Set your income, categories, and first goal then you&apos;re ready to track.</p>
              </SurfaceCard>
            </div>
          </Reveal>

          {/* ── Mobile-only stat pills ── */}
          <Reveal delay={80} className="mt-6 flex flex-wrap gap-3 lg:hidden">
            {[
              { icon: CheckCircle2, label: "Budget in 5 min", color: "text-emerald-600" },
              { icon: Zap, label: "Daily clarity", color: "text-sky-600" },
              { icon: Target, label: "Goal tracking", color: "text-violet-600" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="public-panel-soft flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-[color:var(--text-primary)]">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                {label}
              </div>
            ))}
          </Reveal>

          {/* Cards — shown below the hero text on all screen sizes */}
          <Reveal delay={100} className="mt-8 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <SurfaceCard className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="public-subtle text-[11px] font-semibold uppercase tracking-[0.16em]">This month</p>
                    <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">$1,460 left</p>
                    <p className="public-muted mt-1 text-sm">A clear view of what you can still spend or save right now.</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-500/12 px-3 py-2 text-right text-sm text-emerald-700 dark:text-emerald-300">
                    <p className="font-semibold">On pace</p>
                    <p className="mt-1 text-xs">12 days left</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { label: "Income logged", value: "$5,200", width: "100%", tone: "bg-emerald-500" },
                    { label: "Expenses", value: "$3,140", width: "60%", tone: "bg-rose-500" },
                    { label: "Saved", value: "$600", width: "12%", tone: "bg-sky-500" },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="public-muted">{row.label}</span>
                        <span className="font-semibold text-[color:var(--text-primary)]">{row.value}</span>
                      </div>
                      <div className="mt-2 h-2.5 rounded-full bg-[color:var(--page-secondary)]">
                        <div className={`h-2.5 rounded-full ${row.tone}`} style={{ width: row.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </SurfaceCard>

              <div className="flex flex-col gap-4">
                <SurfaceCard tone="soft" className="p-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">Faster check-ins</p>
                      <p className="public-muted mt-1 text-xs">Log expenses and income in seconds, anywhere.</p>
                    </div>
                  </div>
                </SurfaceCard>
                <SurfaceCard tone="soft" className="p-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">Clear money view</p>
                      <p className="public-muted mt-1 text-xs">Plan, actuals, and live balance in one dashboard.</p>
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <Reveal>
          <SectionHeading
            eyebrow="What you get"
            title="A budgeting flow that makes sense every day."
            body="Plan, track, and adjust all from the same view. No more scattered spreadsheets or forgetting what you planned."
            align="center"
          />
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {highlights.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <SurfaceCard tone="soft" className="h-full p-5 sm:p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--page-secondary)] text-[color:var(--accent)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
                <p className="public-muted mt-3 text-sm leading-relaxed">{item.body}</p>
              </SurfaceCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
          <Reveal>
            <SurfaceCard className="overflow-hidden p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
                <div>
                  <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.22em]">Everything in one place</p>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-3xl">
                    Budget, track, set goals, one product that keeps the whole picture.
                  </h3>
                  <p className="public-muted mt-4 text-sm leading-relaxed sm:text-base">
                    From setting your monthly budget to logging a single coffee, all your money moves flow into the same dashboard. You always know where you are.
                  </p>
                  <div className="mt-6 space-y-3">
                    {productRows.map((item) => (
                      <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-[color:var(--page-secondary)] px-4 py-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.label}</p>
                          <p className="public-muted mt-1 text-xs">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="relative min-h-[16rem] overflow-hidden rounded-[1.5rem]"
                  style={{
                    maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                  }}
                >
                  <Image
                    src="/images/about-hero.png"
                    alt="Financial progress"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                </div>
              </div>
            </SurfaceCard>
          </Reveal>

          <Reveal delay={120}>
            <div className="grid gap-4">
              <SurfaceCard tone="accent" className="overflow-hidden p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div
                    className="relative h-40 flex-1 overflow-hidden rounded-[1.5rem]"
                    style={{
                      maskImage: "linear-gradient(to right, black 60%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to right, black 60%, transparent 100%)",
                    }}
                  >
                    <Image
                      src="/images/goals-jar.png"
                      alt="Savings goal"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </div>
                  <div className="sm:max-w-[15rem]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                      <Target className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-[color:var(--text-primary)]">Goals stay visible</h3>
                    <p className="public-muted mt-2 text-sm">
                      Savings targets with progress, monthly contribution, and clear affordability so you always know how close you are.
                    </p>
                  </div>
                </div>
              </SurfaceCard>
              <div className="grid gap-4 sm:grid-cols-2">
                <SurfaceCard tone="soft" className="p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--text-primary)]">Clearer charts</h3>
                  <p className="public-muted mt-2 text-sm">Income vs. expenses over time, spending pace, and flex room all visualised clearly.</p>
                </SurfaceCard>
                <SurfaceCard tone="soft" className="p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    <Bell className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[color:var(--text-primary)]">Daily follow-through</h3>
                  <p className="public-muted mt-2 text-sm">Reminders, notes, and the AI assistant stay part of your workflow instead of being separate tools.</p>
                </SurfaceCard>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Three steps, one running picture of your money."
            body="The app works best when planning, tracking, and adjusting all feed the same view and they do."
            align="center"
          />
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <Reveal key={step.title} delay={index * 100}>
              <SurfaceCard className="h-full p-5 sm:p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-sm font-semibold text-white">
                  0{index + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[color:var(--text-primary)]">{step.title}</h3>
                <p className="public-muted mt-3 text-sm leading-relaxed">{step.body}</p>
              </SurfaceCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[0.92fr,1.08fr]">
          <Reveal>
            <SurfaceCard tone="accent" className="h-full p-5 sm:p-6">
              <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.22em]">Built with you in mind</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-3xl">
                Honest, calm, and easy to come back to every day.
              </h3>
              <p className="public-muted mt-4 text-sm leading-relaxed sm:text-base">
                No hidden assumptions, no overloaded dashboards. Just clear numbers and straightforward next steps every time you open the app.
              </p>
              <div
                className="mt-6 relative min-h-[15rem] overflow-hidden rounded-[1.5rem]"
                style={{
                  maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                }}
              >
                <Image
                  src="/images/about-team.png"
                  alt="Team working together"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              </div>
            </SurfaceCard>
          </Reveal>

          <Reveal delay={120}>
            <div className="grid gap-4">
              {trustPoints.map((item) => (
                <SurfaceCard key={item.title} tone="soft" className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--page-secondary)] text-[color:var(--accent)]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
                      <p className="public-muted mt-2 text-sm leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <Reveal>
          <SurfaceCard tone="accent" className="overflow-hidden px-5 py-8 text-center sm:px-8 sm:py-10">
            <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.22em]">Ready to start</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl lg:text-5xl">
              Budget with clarity from day one.
            </h2>
            <p className="public-muted mx-auto mt-4 max-w-2xl text-base leading-relaxed">
              Create an account, set a budget, and keep the same clean picture across planning, tracking, goals, reminders, and simulations.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <LoadingLinkButton href="/signup" className="w-full rounded-2xl border-0 sm:w-auto">
                Create free account <ArrowRight className="h-4 w-4" />
              </LoadingLinkButton>
              <LoadingLinkButton href="/login" variant="outline" className="w-full rounded-2xl sm:w-auto">
                Sign in
              </LoadingLinkButton>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
              <span className="public-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <ShieldCheck className="h-4 w-4" />
                Private by default
              </span>
              <span className="public-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <Coins className="h-4 w-4" />
                Free to use
              </span>
              <span className="public-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <Target className="h-4 w-4" />
                Goals included
              </span>
            </div>
          </SurfaceCard>
        </Reveal>
      </section>
    </div>
  );
}
