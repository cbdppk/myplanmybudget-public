"use client";

import { useState, useTransition, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

const navItems = [
  { href: "/settings", label: "Overview" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/budget", label: "Budget & Currency" },
  { href: "/settings/goals", label: "Goals & Savings" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/privacy", label: "Data & Privacy" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/help", label: "Help & About" },
  { href: "/settings/danger", label: "Danger Zone" },
];

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPending) setLoadingHref(null);
  }, [isPending]);

  const navigate = (href: string) => {
    setLoadingHref(href);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <nav className="card h-fit p-3 md:sticky md:top-24">
      <button
        type="button"
        onClick={() => {
          startTransition(() => router.back());
        }}
        className="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-black/50 transition hover:bg-black/[0.04] hover:text-black/80"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </button>
      <ul className="grid gap-1 md:block">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const loading = loadingHref === item.href;
          return (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => navigate(item.href)}
                className={`flex w-full items-center justify-between rounded-xl border-l-2 px-3 py-2 text-left text-sm transition ${
                  active
                    ? "border-sky-500 bg-sky-100 font-semibold text-sky-800 shadow-sm"
                    : "border-transparent text-black/70 hover:bg-black/[0.03]"
                }`}
              >
                {item.label}
                {loading && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
