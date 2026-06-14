import Image from "next/image";
import { ArrowRight, Download, Lock, Shield, Sparkles } from "lucide-react";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";

function Section({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-2xl">
        <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.22em]">{eyebrow}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
          {title}
        </h2>
        <p className="public-muted mt-4 text-base leading-relaxed sm:text-lg">{body}</p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="overflow-x-clip pb-10 sm:pb-16">
      <section className="border-b [border-color:var(--nav-border)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.02fr,0.98fr] lg:items-center lg:py-18">
          <div className="max-w-2xl">
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-5xl lg:text-6xl">
              Built to make money feel more clear and less heavy.
            </h1>
            <p className="public-muted mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              MyplanMybudget is a budgeting tool from EyeHai Technologies. We built it for people who want a direct, honest view of what is happening with their money without having to fight a complex finance app.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LoadingLinkButton href="/signup" className="w-full rounded-2xl border-0 sm:w-auto">
                Create account <ArrowRight className="h-4 w-4" />
              </LoadingLinkButton>
              <LoadingLinkButton href="/contact" variant="outline" className="w-full rounded-2xl sm:w-auto">
                Talk to us
              </LoadingLinkButton>
            </div>
          </div>

          <div className="public-panel-accent overflow-hidden rounded-[2rem] p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.08fr,0.92fr] lg:items-center">
              <div className="public-panel rounded-[1.75rem] p-5">
                <p className="public-subtle text-[11px] font-semibold uppercase tracking-[0.16em]">What we optimize for</p>
                <div className="mt-4 space-y-3">
                  {[
                    "A realistic monthly picture, not abstract finance jargon",
                    "Fast everyday use on phones, not only on wide desktop layouts",
                    "Privacy-first decisions from login to export",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl bg-[color:var(--page-secondary)] px-4 py-3 text-sm">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="public-muted">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative min-h-[18rem] overflow-hidden rounded-[1.75rem] bg-[color:var(--page-secondary)]">
                <Image
                  src="/images/about-hero.png"
                  alt="A calm path representing steady financial progress"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 38vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section
        eyebrow="Our mission"
        title="Money clarity should be practical, calm, and usable every day."
        body="Most people do not need more features. They need one reliable picture that explains what is coming in, what is going out, and what room is left to move."
      >
        <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="public-panel rounded-[1.75rem] p-5 sm:p-6">
            <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Why this product exists</h3>
            <p className="public-muted mt-4 text-sm leading-relaxed sm:text-base">
              Budgeting usually breaks down when the tool is slower than real life. MyplanMybudget keeps the core loop simple: set a baseline, log what changed, and see the updated picture immediately.
            </p>
            <div className="mt-6 space-y-4">
              {[
                { label: "Income planned", value: "$5,200", width: "100%", tone: "bg-emerald-500" },
                { label: "Spent so far", value: "$3,140", width: "60%", tone: "bg-rose-500" },
                { label: "Saved so far", value: "$600", width: "12%", tone: "bg-sky-500" },
                { label: "Remaining", value: "$1,460", width: "28%", tone: "bg-blue-500" },
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
          </div>

          <div className="grid gap-4">
            {[
              {
                title: "Simple enough to stick with",
                body: "A budgeting habit only helps when the product is light enough to reopen daily.",
              },
              {
                title: "Honest about the numbers",
                body: "We try to separate planned values from recorded activity so users are not misled by inflated totals.",
              },
              {
                title: "Designed for real routines",
                body: "Transactions, goals, reminders, notes, and simulations support the same money picture instead of competing with it.",
              },
            ].map((item) => (
              <div key={item.title} className="public-panel-soft rounded-[1.75rem] p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
                <p className="public-muted mt-3 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        eyebrow="How we work"
        title="We build around clarity, not feature noise."
        body="The product is shaped by a small set of principles: explain the state clearly, keep actions close to the information they change, and do not hide the important numbers."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Real daily workflow",
              body: "Budget first, track changes fast, and keep follow-up tools visible instead of buried.",
            },
            {
              title: "Phone-friendly by default",
              body: "Shorter sections, fewer fixed columns, and larger touch targets matter more than decorative complexity.",
            },
            {
              title: "Trust over gimmicks",
              body: "Clear export controls, security posture, and straightforward language are part of the product, not extras.",
            },
          ].map((item) => (
            <div key={item.title} className="public-panel rounded-[1.75rem] p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
              <p className="public-muted mt-3 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Security and trust"
        title="Financial data deserves a serious default posture."
        body="We treat budgeting data as sensitive, which means controls for login, export, and account protection are part of the product surface."
      >
        <div className="grid gap-4 xl:grid-cols-[0.92fr,1.08fr]">
          <div className="public-panel-accent rounded-[1.75rem] p-5 sm:p-6">
            <div className="space-y-4">
              {[
                { icon: Shield, title: "2-factor support", body: "Authenticator-based TOTP setup is available for stronger sign-in protection." },
                { icon: Lock, title: "Row-level separation", body: "Data paths are designed around per-user isolation instead of shared flat access." },
                { icon: Download, title: "Portability", body: "Users can export their data instead of being trapped in the product." },
                { icon: Sparkles, title: "No ad-driven model", body: "The product is built around usefulness, not profiling or selling behavioural data." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 rounded-2xl bg-[color:var(--card-bg)] px-4 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--page-secondary)] text-[color:var(--accent)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.title}</p>
                    <p className="public-muted mt-1 text-sm">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="public-panel rounded-[1.75rem] p-5 sm:p-6">
            <p className="public-subtle text-[11px] font-semibold uppercase tracking-[0.16em]">Checklist</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Protected routes for app pages",
                "Re-auth gates for sensitive exports",
                "Content Security Policy in place",
                "Rate limiting on sensitive endpoints",
                "Idle logout support",
                "Audit-friendly account actions",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-[color:var(--page-secondary)] px-4 py-3 text-sm text-[color:var(--text-primary)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="The company"
        title="MyplanMybudget is built by EyeHai Technologies."
        body="We are focused on practical software that people can actually keep using. That means fewer gimmicks, more clarity, and a product that respects the user’s attention."
      >
        <div className="grid gap-4 lg:grid-cols-[1.02fr,0.98fr]">
          <div className="public-panel rounded-[1.75rem] overflow-hidden">
            <div className="relative min-h-[18rem] bg-[color:var(--page-secondary)]">
              <Image
                src="/images/about-team.png"
                alt="Small team collaborating"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
            <div className="p-5 sm:p-6">
              <p className="public-muted text-sm leading-relaxed">
                We build tools we would use ourselves: direct, understandable, and stable enough to become part of a normal monthly routine.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Model", value: "Free to use" },
              { label: "Approach", value: "Privacy-first" },
              { label: "Focus", value: "Practical budgeting workflows" },
              { label: "Support", value: "Reachable through the contact page" },
            ].map((item) => (
              <div key={item.label} className="public-panel-soft rounded-[1.75rem] p-5 sm:p-6">
                <p className="public-subtle text-[11px] font-semibold uppercase tracking-[0.16em]">{item.label}</p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--text-primary)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <section className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
        <div className="public-panel-accent rounded-[2rem] px-5 py-8 text-center sm:px-8 sm:py-10">
          <h2 className="text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
            Ready to see the product for yourself?
          </h2>
          <p className="public-muted mx-auto mt-4 max-w-2xl text-base leading-relaxed">
            Create an account to start planning, tracking, and reviewing your month with a clearer mobile experience.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LoadingLinkButton href="/signup" className="w-full rounded-2xl border-0 sm:w-auto">
              Create account <ArrowRight className="h-4 w-4" />
            </LoadingLinkButton>
            <LoadingLinkButton href="/contact" variant="outline" className="w-full rounded-2xl sm:w-auto">
              Talk to us
            </LoadingLinkButton>
          </div>
          <p className="public-subtle mt-5 text-sm">Free to use · Built by EyeHai Technologies</p>
        </div>
      </section>
    </div>
  );
}
