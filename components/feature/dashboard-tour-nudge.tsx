"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getAppTourStorageKeys } from "@/lib/app-tour";

function readStorage(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures so the CTA remains non-blocking.
  }
}

export function DashboardTourNudge({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const { completedKey, activeKey, nudgeDismissedKey } = getAppTourStorageKeys(userEmail);

  useEffect(() => {
    if (pathname !== "/dashboard") {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (searchParams.get("tour") === "start") {
      setVisible(false);
      return;
    }
    if (readStorage(localStorage, completedKey) === "1") {
      setVisible(false);
      return;
    }
    if (readStorage(sessionStorage, activeKey) === "1") {
      setVisible(false);
      return;
    }
    if (readStorage(sessionStorage, nudgeDismissedKey) === "1") {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timeoutId = window.setTimeout(() => {
      setVisible(false);
      writeStorage(sessionStorage, nudgeDismissedKey, "1");
    }, 120000);

    return () => window.clearTimeout(timeoutId);
  }, [activeKey, completedKey, nudgeDismissedKey, pathname, searchParams]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    writeStorage(sessionStorage, nudgeDismissedKey, "1");
  };

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex justify-end sm:inset-x-auto sm:right-4">
      <div className="pointer-events-auto w-full max-w-xs rounded-2xl border border-sky-200/70 bg-white/95 p-3 shadow-xl shadow-sky-900/10 backdrop-blur dark:border-sky-700/50 dark:bg-slate-950/95">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Quick Tour</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">Want a guided walkthrough?</p>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">I can show what each menu item does and walk through the main pages.</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss app tour prompt"
            className="rounded-full px-2 py-1 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--page-secondary)]"
            onClick={dismiss}
          >
            x
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={() => {
              setVisible(false);
              router.push("/dashboard?tour=start");
            }}
          >
            Start tour
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
