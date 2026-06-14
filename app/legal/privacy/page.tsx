import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — MyplanMybudget",
  description: "How MyplanMybudget collects, uses, and protects your personal data.",
};

const EFFECTIVE_DATE = "1 March 2025";
const COMPANY = "EyeHai Technologies";
const PRODUCT = "MyplanMybudget";
const CONTACT_EMAIL = "privacy@example.com";

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-[color:var(--text-primary)] sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[color:var(--text-secondary)] sm:text-base">{children}</div>
    </section>
  );
}

const toc = [
  ["overview",      "Overview"],
  ["collect",       "Information We Collect"],
  ["how-we-use",    "How We Use Your Information"],
  ["sharing",       "Sharing of Information"],
  ["storage",       "Data Storage & Security"],
  ["retention",     "Data Retention"],
  ["cookies",       "Cookies & Local Storage"],
  ["third-party",   "Third-Party Services"],
  ["rights",        "Your Rights"],
  ["children",      "Children's Privacy"],
  ["transfers",     "International Transfers"],
  ["changes",       "Changes to This Policy"],
  ["contact",       "Contact Us"],
];

export default function PrivacyPage() {
  return (
    <div className="pb-16">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      {/* Header */}
      <div className="public-panel mb-10 rounded-2xl p-6 sm:p-8">
        <p className="public-kicker text-[11px] font-semibold uppercase tracking-[0.2em]">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Effective date: <strong className="text-[color:var(--text-secondary)]">{EFFECTIVE_DATE}</strong> · Last updated: <strong className="text-[color:var(--text-secondary)]">{EFFECTIVE_DATE}</strong>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-secondary)]">
          {COMPANY} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates {PRODUCT} and is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data. Please read it carefully.
        </p>
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <strong>Short version:</strong> We collect only what we need to run the service. We do not sell your data, show you ads, or share it with third parties for commercial purposes.
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:items-start">
        {/* TOC */}
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

          <Section id="overview" title="1. Overview">
            <p>This policy applies to all users of {PRODUCT}, accessible at myplanmybudget.app. It covers data we collect when you visit the site, create an account, and use the application.</p>
            <p>We act as the data controller for personal information collected through {PRODUCT}.</p>
          </Section>

          <Section id="collect" title="2. Information We Collect">
            <p><strong>Information you provide directly:</strong></p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Account data:</strong> Your email address and (if applicable) a hashed password when you register.</li>
              <li><strong>Profile data:</strong> Display name, preferred currency, and any optional profile fields you complete.</li>
              <li><strong>Financial data:</strong> Budget plans, transaction records, savings goals, reminders, and notes you create in the app. This data is entered by you and is used solely to provide the service to you.</li>
              <li><strong>Communication:</strong> Messages you send to us via the contact form or by email.</li>
            </ul>
            <p><strong>Information collected automatically:</strong></p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Log data:</strong> Server logs including your IP address, browser type, operating system, pages visited, and timestamps. Logs are retained for up to 90 days for security and debugging purposes.</li>
              <li><strong>Session data:</strong> An encrypted session token stored in an HttpOnly cookie to keep you signed in.</li>
              <li><strong>Error reports:</strong> Anonymised error and crash reports to help us fix bugs. These do not include your financial data.</li>
            </ul>
            <p><strong>Information from third parties:</strong></p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Google OAuth (optional):</strong> If you choose to sign in with Google, we receive your Google account email address and display name. We do not receive your Google password or financial data held by Google.</li>
            </ul>
          </Section>

          <Section id="how-we-use" title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>Create and manage your account.</li>
              <li>Provide, maintain, and improve the service.</li>
              <li>Display your financial data in the application as you have entered it.</li>
              <li>Send essential service communications — account confirmation, security alerts, and product updates you have opted into.</li>
              <li>Respond to your support enquiries.</li>
              <li>Detect, investigate, and prevent fraudulent transactions, abuse, and security breaches.</li>
              <li>Comply with legal obligations.</li>
            </ul>
            <p>We do <strong>not</strong> use your data to:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>Show you advertising (there are no ads in {PRODUCT}).</li>
              <li>Build a behavioural profile for advertising purposes.</li>
              <li>Sell, rent, or trade your personal data to third parties.</li>
              <li>Train machine-learning models on your financial data.</li>
            </ul>
          </Section>

          <Section id="sharing" title="4. Sharing of Information">
            <p>We do not sell or rent your personal data. We may share it only in the following limited circumstances:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Service providers:</strong> We use a small number of trusted sub-processors to operate the service (e.g., database hosting, error tracking). These providers access data only as necessary to perform services on our behalf and are contractually bound to protect it.</li>
              <li><strong>Legal compliance:</strong> We may disclose information if required to do so by law, court order, or in response to a valid request by a government authority.</li>
              <li><strong>Business transfer:</strong> If {COMPANY} is involved in a merger, acquisition, or asset sale, your data may be transferred. We will provide notice before your personal data is transferred and becomes subject to a different privacy policy.</li>
              <li><strong>With your consent:</strong> In any other case, only with your explicit prior consent.</li>
            </ul>
          </Section>

          <Section id="storage" title="5. Data Storage & Security">
            <p>Your data is stored in a managed PostgreSQL database with row-level security (RLS) enforced at the database layer, meaning each user can only access their own records.</p>
            <p>We implement the following security measures:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>Encrypted connections (TLS/HTTPS) for all data in transit.</li>
              <li>Encrypted session tokens stored in HttpOnly, Secure cookies.</li>
              <li>Content Security Policy and other HTTP security headers on every response.</li>
              <li>Idle session timeout to reduce the risk of unauthorised access on shared devices.</li>
              <li>Optional two-factor authentication (TOTP) for your account.</li>
              <li>Audit logging for sensitive account actions.</li>
            </ul>
            <p>No method of transmission over the Internet or electronic storage is 100% secure. While we use commercially reasonable means to protect your data, we cannot guarantee absolute security.</p>
          </Section>

          <Section id="retention" title="6. Data Retention">
            <p>We retain your data for as long as your account is active or as needed to provide you with the service.</p>
            <p>When you delete your account, we will delete or anonymise your personal data within 30 days, except where we are required to retain it for legal, accounting, or regulatory purposes.</p>
            <p>Server log data is retained for up to 90 days and then automatically deleted.</p>
          </Section>

          <Section id="cookies" title="7. Cookies & Local Storage">
            <p><strong>Session cookie:</strong> We set one essential cookie — an encrypted session token that keeps you signed in. This cookie is HttpOnly and Secure. It is strictly necessary for the service to function and cannot be disabled while you are using the application.</p>
            <p><strong>Local storage:</strong> We use your browser's localStorage to remember small preferences such as your cookie consent choice and UI state (e.g., sidebar open/closed). This data never leaves your device.</p>
            <p><strong>No tracking cookies:</strong> We do not use any third-party advertising, analytics, or tracking cookies. There are no Google Analytics, Facebook Pixel, or similar third-party scripts embedded in the service.</p>
            <p><strong>Cookie consent:</strong> On your first visit you will be shown a cookie notice. Accepting it acknowledges the use of the essential session cookie described above. Declining means we will not set any non-essential cookies (though the session cookie remains necessary if you log in).</p>
          </Section>

          <Section id="third-party" title="8. Third-Party Services">
            <p>The following third-party services may be used to operate {PRODUCT}:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Database hosting:</strong> Your data is stored with a managed PostgreSQL provider under a data processing agreement.</li>
              <li><strong>Google OAuth (optional):</strong> If you sign in with Google, you are subject to Google's Privacy Policy in addition to ours.</li>
              <li><strong>Error monitoring:</strong> We may use an error tracking service to capture application errors. Error reports are anonymised and do not include your financial data.</li>
            </ul>
            <p>We review our sub-processors regularly and will update this section if that list changes.</p>
          </Section>

          <Section id="rights" title="9. Your Rights">
            <p>Depending on your jurisdiction, you may have the following rights with respect to your personal data:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Ask us to correct inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request deletion of your data. You can delete your account (and all associated data) directly from the app settings.</li>
              <li><strong>Portability:</strong> Export your financial data in CSV format at any time using the in-app export feature.</li>
              <li><strong>Restriction:</strong> Ask us to restrict processing of your data in certain circumstances.</li>
              <li><strong>Objection:</strong> Object to processing of your data where we rely on legitimate interests as the legal basis.</li>
              <li><strong>Withdraw consent:</strong> Where processing is based on your consent, you may withdraw it at any time without affecting the lawfulness of prior processing.</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-[color:var(--text-primary)]">{CONTACT_EMAIL}</a>. We will respond within 30 days.</p>
          </Section>

          <Section id="children" title="10. Children's Privacy">
            <p>{PRODUCT} is not directed at children under the age of 13 (or the applicable minimum age in your jurisdiction). We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will promptly delete it.</p>
          </Section>

          <Section id="transfers" title="11. International Transfers">
            <p>Your data may be processed in countries other than the one in which you reside. Where personal data is transferred outside your country, we take appropriate safeguards — such as standard contractual clauses — to ensure your data receives an equivalent level of protection.</p>
          </Section>

          <Section id="changes" title="12. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or via a prominent notice in the application before the changes take effect.</p>
            <p>The effective date at the top of this page reflects when the policy was last updated. Continued use of the service after changes take effect constitutes acceptance of the revised policy.</p>
          </Section>

          <Section id="contact" title="13. Contact Us">
            <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact our privacy team:</p>
            <div className="legal-deep-surface mt-3 rounded-xl border p-4">
              <p className="font-semibold text-[color:var(--text-primary)]">{COMPANY} — Privacy</p>
              <p className="mt-1 text-[color:var(--text-secondary)]">Email: <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-[color:var(--text-primary)]">{CONTACT_EMAIL}</a></p>
              <p className="mt-1 text-[color:var(--text-secondary)]">Contact form: <Link href="/contact" className="underline hover:text-[color:var(--text-primary)]">myplanmybudget.app/contact</Link></p>
            </div>
            <p>We aim to respond to all privacy enquiries within 30 days.</p>
          </Section>

          <div className="legal-deep-surface-soft rounded-2xl border p-5 text-xs">
            This Privacy Policy was last updated on {EFFECTIVE_DATE}. See also our{" "}
            <Link href="/legal/terms" className="underline hover:text-[color:var(--text-primary)]">Terms of Service</Link>.
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
