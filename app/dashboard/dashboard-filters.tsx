"use client";

import { useRouter } from "next/navigation";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";

export function DashboardFilters({
  range,
  month,
  userMonths,
}: {
  range: string;
  month: string | undefined;
  userMonths: Array<{ key: string; label: string }>;
}) {
  const router = useRouter();

  return (
    <section className="mt-5 flex flex-wrap items-center gap-2">
      {(["DAY", "WEEKLY", "MONTHLY", "ALL_TIME"] as const).map((item) => (
        <LoadingLinkButton
          key={item}
          href={`/dashboard?range=${item}`}
          size="sm"
          variant={!month && range === item ? "default" : "outline"}
          className="h-9 rounded-full px-4 text-xs"
        >
          {item === "DAY" ? "Today" : item === "ALL_TIME" ? "All time" : item === "WEEKLY" ? "This week" : "This month"}
        </LoadingLinkButton>
      ))}
      {userMonths.length > 0 ? (
        <select
          value={month ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              router.push(`/dashboard?month=${val}`);
            } else {
              router.push(`/dashboard?range=${range}`);
            }
          }}
          className="h-9 cursor-pointer rounded-full border px-3 text-xs font-medium [border-color:var(--border)] bg-[color:var(--card-bg)] text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sky-400"
          style={{
            appearance: "none",
            paddingRight: "1.75rem",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.5rem center",
          }}
        >
          <option value="">Pick a month…</option>
          {userMonths.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      ) : null}
    </section>
  );
}
