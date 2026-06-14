"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

const sections = [
  { href: "/settings/account", title: "Account", desc: "Your email address and sign-in information." },
  { href: "/settings/profile", title: "Profile", desc: "Your name, timezone, and language preference." },
  { href: "/settings/security", title: "Security", desc: "Password, two-factor authentication, and login alerts." },
  { href: "/settings/budget", title: "Budget & Currency", desc: "Set your monthly budget plan, categories, and preferred currency." },
  { href: "/settings/goals", title: "Goals & Savings", desc: "Configure how savings are tracked and used toward your goals." },
  { href: "/settings/notifications", title: "Notifications", desc: "Choose what reminders and updates you receive and how." },
  { href: "/settings/privacy", title: "Data & Privacy", desc: "Control your data, download your information, and manage privacy settings." },
  { href: "/settings/appearance", title: "Appearance", desc: "Choose your preferred theme — light, dark, or system." },
  { href: "/settings/help", title: "Help & About", desc: "Guides, tips, and ways to get support." },
  { href: "/settings/danger", title: "Danger Zone", desc: "Reset your data or deactivate your account." },
];

export function SettingsGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPending) setLoadingHref(null);
  }, [isPending]);

  // Also clear when navigation completes
  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  const navigate = (href: string) => {
    setLoadingHref(href);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {sections.map((section) => {
        const isLoading = loadingHref === section.href;
        return (
          <button
            key={section.href}
            type="button"
            onClick={() => navigate(section.href)}
            disabled={isPending}
            className="card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-wait"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{section.title}</p>
              {isLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[color:var(--text-secondary)]" />}
            </div>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{section.desc}</p>
          </button>
        );
      })}
    </section>
  );
}
