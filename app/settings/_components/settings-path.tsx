"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const labelMap: Record<string, string> = {
  settings: "Settings",
  account: "Account",
  profile: "Profile",
  security: "Security",
  budget: "Budget & Currency",
  categories: "Categories",
  goals: "Goals & Savings",
  notifications: "Notifications",
  privacy: "Data & Privacy",
  appearance: "Appearance",
  help: "Help & About",
  danger: "Danger Zone",
};

export function SettingsPath() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length || segments[0] !== "settings") return null;

  const isSubPage = segments.length > 1;

  return (
    <nav aria-label="Settings path" className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
      {isSubPage && (
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[color:var(--page-secondary)] transition"
          aria-label="Go back"
        >
          <ArrowLeft className="h-3 w-3" />
        </button>
      )}
      <Link href="/settings" className="theme-chip rounded-full px-2 py-1 hover:bg-[color:var(--page-secondary)]">
        Settings
      </Link>
      {segments.slice(1).map((segment, index) => {
        const href = `/${segments.slice(0, index + 2).join("/")}`;
        return (
          <span key={href} className="inline-flex items-center gap-2">
            <span>/</span>
            <Link href={href} className="theme-chip rounded-full px-2 py-1 hover:bg-[color:var(--page-secondary)]">
              {labelMap[segment] ?? segment}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
