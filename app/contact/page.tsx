import { ArrowRight, Mail, MessageSquare, Shield } from "lucide-react";
import { ContactForm } from "@/components/feature/contact-form";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";

export default function ContactPage() {
  return (
    <div className="overflow-x-clip pb-10 sm:pb-16">
      <section className="border-b [border-color:var(--nav-border)]">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6 sm:py-14">
          <span className="public-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <MessageSquare className="h-3.5 w-3.5" />
            Contact
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-5xl">
            We&apos;re here to help.
          </h1>
          <p className="public-muted mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Ask a question, report a problem, or send product feedback. We rebuilt this page to be clearer on mobile too, so the form and support details stay easy to use on smaller screens.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-4">
            <div className="public-panel-accent rounded-[2rem] p-5 sm:p-6">
              <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.22em]">Support style</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-3xl">
                Clear answers and practical next steps.
              </h2>
              <p className="public-muted mt-4 text-sm leading-relaxed sm:text-base">
                Messages go to the team maintaining the product. The goal is to help users get unstuck quickly, not send them through a maze.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  {
                    icon: MessageSquare,
                    label: "Product help",
                    value: "Questions about setup, budgeting flow, and how the app works.",
                  },
                  {
                    icon: Mail,
                    label: "Direct replies",
                    value: "Messages route to the internal admin inbox so the team can follow up clearly.",
                  },
                  {
                    icon: Shield,
                    label: "Privacy-respecting",
                    value: "Your support request is used to help you, not to build an advertising profile.",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] bg-[color:var(--card-bg)] px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--page-secondary)] text-[color:var(--accent)]">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.label}</p>
                        <p className="public-muted mt-1 text-sm">{item.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="public-panel rounded-[2rem] p-5 sm:p-6">
              <p className="public-subtle text-[11px] font-semibold uppercase tracking-[0.16em]">What to expect</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="public-panel-soft rounded-[1.5rem] p-4">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">Helpful replies</p>
                  <p className="public-muted mt-2 text-sm">We aim for guidance that tells you what to do next, not generic filler.</p>
                </div>
                <div className="public-panel-soft rounded-[1.5rem] p-4">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">Product signal</p>
                  <p className="public-muted mt-2 text-sm">Feedback from support helps us tighten the parts of the product that slow users down.</p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <LoadingLinkButton href="/signup" className="w-full rounded-2xl border-0 sm:w-auto">
                  Create account <ArrowRight className="h-4 w-4" />
                </LoadingLinkButton>
                <LoadingLinkButton href="/" variant="outline" className="w-full rounded-2xl sm:w-auto">
                  Back to home
                </LoadingLinkButton>
              </div>
            </div>
          </div>

          <div className="public-panel rounded-[2rem] p-5 sm:p-6 lg:p-8">
            <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Send a message</h2>
            <p className="public-muted mt-2 text-sm sm:text-base">
              Tell us what you need. The form is mobile-friendly now, so you should be able to send feedback without wrestling the layout.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
            <p className="public-subtle mt-5 text-xs">
              Typical topics include account help, setup questions, feature feedback, and workflow issues.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
