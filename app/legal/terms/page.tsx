import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — MyplanMybudget",
  description: "Terms and conditions governing your use of MyplanMybudget.",
};

const EFFECTIVE_DATE = "1 March 2025";
const COMPANY = "EyeHai Technologies";
const PRODUCT = "MyplanMybudget";
const CONTACT_EMAIL = "support@myplanmybudget.app";

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-[color:var(--text-primary)] sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[color:var(--text-secondary)] sm:text-base">{children}</div>
    </section>
  );
}

const toc = [
  ["acceptance",      "Acceptance of Terms"],
  ["service",         "Description of Service"],
  ["accounts",        "User Accounts"],
  ["conduct",         "Acceptable Use"],
  ["content",         "Your Content"],
  ["ip",              "Intellectual Property"],
  ["privacy",         "Privacy"],
  ["disclaimers",     "Disclaimers"],
  ["liability",       "Limitation of Liability"],
  ["indemnification", "Indemnification"],
  ["termination",     "Termination"],
  ["changes",         "Changes to These Terms"],
  ["governing-law",   "Governing Law"],
  ["contact",         "Contact Us"],
];

export default function TermsPage() {
  return (
    <div className="pb-16">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      {/* Header */}
      <div className="public-panel mb-10 rounded-2xl p-6 sm:p-8">
        <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.2em]">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Effective date: <strong className="text-[color:var(--text-secondary)]">{EFFECTIVE_DATE}</strong> · Last updated: <strong className="text-[color:var(--text-secondary)]">{EFFECTIVE_DATE}</strong>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-secondary)]">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of {PRODUCT}, operated by {COMPANY} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By creating an account or using the service, you agree to be bound by these Terms. If you do not agree, do not use {PRODUCT}.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:items-start">
        {/* TOC — sticky on desktop */}
        <nav className="hidden rounded-2xl public-panel p-5 text-sm lg:sticky lg:top-24 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">Contents</p>
          <ol className="space-y-1.5">
            {toc.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} className="flex items-baseline gap-2 text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]">
                  <span className="w-5 shrink-0 text-[10px] text-[color:var(--text-muted)]">{i + 1}.</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Body */}
        <div className="space-y-10">

          <Section id="acceptance" title="1. Acceptance of Terms">
            <p>By accessing or using {PRODUCT} you confirm that you are at least 13 years of age (or the minimum digital consent age in your jurisdiction), that you have read and understood these Terms, and that you agree to be bound by them.</p>
            <p>If you are using the service on behalf of an organisation, you represent that you have authority to bind that organisation to these Terms.</p>
          </Section>

          <Section id="service" title="2. Description of Service">
            <p>{PRODUCT} is a personal finance tool that helps individuals plan budgets, track income and expenses, set savings goals, run financial simulations, and receive reminders about upcoming financial events.</p>
            <p>The service is provided free of charge. {COMPANY} reserves the right to introduce optional paid tiers in the future with reasonable notice; however, the core features available today will remain accessible without payment.</p>
            <p>We may modify, suspend, or discontinue the service (or any part of it) at any time with reasonable notice where practicable. We are not liable to you or any third party for any modification, suspension, or discontinuation.</p>
          </Section>

          <Section id="accounts" title="3. User Accounts">
            <p><strong>Registration.</strong> To use the service you must create an account with a valid email address and a password, or authenticate through a supported third-party provider (such as Google). You agree to provide accurate, current, and complete information.</p>
            <p><strong>Security.</strong> You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-[color:var(--text-primary)]">{CONTACT_EMAIL}</a> if you suspect unauthorised access.</p>
            <p><strong>One account per person.</strong> You may not create multiple accounts to circumvent any suspension or restriction.</p>
            <p><strong>Account data.</strong> You may delete your account at any time through the account settings. Upon deletion, your personal data will be removed in accordance with our <Link href="/legal/privacy" className="underline hover:text-[color:var(--text-primary)]">Privacy Policy</Link>.</p>
          </Section>

          <Section id="conduct" title="4. Acceptable Use">
            <p>You agree not to use {PRODUCT} to:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>Violate any applicable local, national, or international law or regulation.</li>
              <li>Transmit unsolicited or unauthorised communications (spam).</li>
              <li>Attempt to gain unauthorised access to any part of the service or its infrastructure.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the service.</li>
              <li>Upload or transmit viruses, malware, or any other malicious or harmful code.</li>
              <li>Scrape, crawl, or use automated means to extract data from the service.</li>
              <li>Interfere with the proper working of the service or impose an unreasonable load on our infrastructure.</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</li>
            </ul>
            <p>Violation of this section may result in immediate termination of your account.</p>
          </Section>

          <Section id="content" title="5. Your Content">
            <p><strong>Ownership.</strong> You retain all ownership rights to the financial data, notes, and other content you submit to {PRODUCT} (&quot;Your Content&quot;). We do not claim ownership of Your Content.</p>
            <p><strong>Licence to us.</strong> By submitting content you grant {COMPANY} a limited, non-exclusive, royalty-free licence to store, process, and display Your Content solely as necessary to provide the service to you.</p>
            <p><strong>Accuracy.</strong> You are solely responsible for the accuracy of the financial data you enter. {PRODUCT} performs calculations based on the data you provide; it does not independently verify your financial information.</p>
            <p><strong>Export.</strong> You may export Your Content via the data export feature at any time. We encourage you to keep copies of important data.</p>
          </Section>

          <Section id="ip" title="6. Intellectual Property">
            <p>The {PRODUCT} service — including its software, design, text, graphics, and other materials — is the property of {COMPANY} and is protected by applicable intellectual property laws.</p>
            <p>Nothing in these Terms grants you a right to use any trademark, service mark, or trade name of {COMPANY}.</p>
          </Section>

          <Section id="privacy" title="7. Privacy">
            <p>Your use of {PRODUCT} is also governed by our <Link href="/legal/privacy" className="underline hover:text-[color:var(--text-primary)]">Privacy Policy</Link>, which is incorporated into these Terms by reference. By agreeing to these Terms you also agree to the Privacy Policy.</p>
          </Section>

          <Section id="disclaimers" title="8. Disclaimers">
            <p><strong>{PRODUCT} is not a financial advisor.</strong> The service is a tool to help you organise and visualise your own financial data. Nothing in the service constitutes financial, investment, legal, or tax advice. You should consult a qualified professional before making significant financial decisions.</p>
            <p><strong>No warranty.</strong> The service is provided &quot;as is&quot; and &quot;as available&quot; without warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the service will be uninterrupted, error-free, or completely secure.</p>
          </Section>

          <Section id="liability" title="9. Limitation of Liability">
            <p>To the fullest extent permitted by applicable law, {COMPANY} and its officers, directors, employees, and agents shall not be liable for:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>Any indirect, incidental, special, consequential, or punitive damages.</li>
              <li>Loss of profits, data, goodwill, or other intangible losses.</li>
              <li>Any financial decisions made in reliance on information displayed by the service.</li>
              <li>Unauthorised access to or alteration of your data caused by factors outside our reasonable control.</li>
            </ul>
            <p>In any case, our total cumulative liability to you shall not exceed the greater of (a) the total amount you paid us in the twelve months preceding the claim or (b) $50 USD.</p>
          </Section>

          <Section id="indemnification" title="10. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless {COMPANY} and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in connection with: (a) your use of the service; (b) Your Content; (c) your violation of these Terms; or (d) your violation of any third-party right.</p>
          </Section>

          <Section id="termination" title="11. Termination">
            <p><strong>By you.</strong> You may stop using the service and delete your account at any time.</p>
            <p><strong>By us.</strong> We may suspend or terminate your access to the service immediately, with or without notice, if we reasonably believe you have violated these Terms, if required by law, or if continuing to provide the service creates a security or legal risk.</p>
            <p>Upon termination, your right to use the service ceases immediately. Provisions of these Terms that by their nature should survive termination will survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.</p>
          </Section>

          <Section id="changes" title="12. Changes to These Terms">
            <p>We may update these Terms from time to time. When we do, we will revise the effective date at the top of this page and, for material changes, provide notice via email or a prominent in-app notice.</p>
            <p>Your continued use of the service after changes take effect constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, please stop using the service and delete your account.</p>
          </Section>

          <Section id="governing-law" title="13. Governing Law">
            <p>These Terms are governed by and construed in accordance with the laws applicable in the jurisdiction where {COMPANY} is established, without regard to conflict of law principles. Any dispute arising from these Terms shall first be subject to good-faith negotiation between the parties.</p>
          </Section>

          <Section id="contact" title="14. Contact Us">
            <p>If you have any questions about these Terms, please contact us:</p>
            <div className="legal-deep-surface mt-3 rounded-xl border p-4">
              <p className="font-semibold text-[color:var(--text-primary)]">{COMPANY}</p>
              <p className="mt-1 text-[color:var(--text-secondary)]">Email: <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-[color:var(--text-primary)]">{CONTACT_EMAIL}</a></p>
              <p className="mt-1 text-[color:var(--text-secondary)]">Contact form: <Link href="/contact" className="underline hover:text-[color:var(--text-primary)]">myplanmybudget.app/contact</Link></p>
            </div>
          </Section>

          <div className="legal-deep-surface-soft rounded-2xl border p-5 text-xs">
            These Terms were last updated on {EFFECTIVE_DATE}. See also our{" "}
            <Link href="/legal/privacy" className="underline hover:text-[color:var(--text-primary)]">Privacy Policy</Link>.
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
