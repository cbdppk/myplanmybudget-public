"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const actions = [
  { href: "/track", label: "Transactions", hint: "Track income and spending" },
  { href: "/goals", label: "Goals", hint: "Plan monthly targets" },
  { href: "/track", label: "Add income", hint: "Capture paycheck" },
  { href: "/notes", label: "Add note", hint: "Save money thought" },
  { href: "/reminders", label: "Add reminder", hint: "Stay on schedule" },
  { href: "/simulate", label: "New simulation", hint: "Try scenario" },
  { href: "/settings", label: "Export", hint: "CSV or JSON" },
];

export function QuickActions() {
  return (
    <div className="card p-4">
      <div className="kicker">Global actions</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((item, idx) => (
          <Button key={item.label} size="sm" variant={idx === 0 ? "default" : "outline"} asChild>
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs text-black/60">One tap away from the top five actions.</p>
    </div>
  );
}
