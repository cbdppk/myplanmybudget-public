"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "mpb-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — don't show banner
    }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch { /* noop */ }
    setVisible(false);
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, "declined"); } catch { /* noop */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      aria-live="polite"
      className="public-panel fixed bottom-4 left-4 right-4 z-50 mx-auto w-auto max-w-[calc(100vw-2rem)] px-4 py-4 backdrop-blur sm:left-4 sm:right-auto sm:mx-0 sm:max-w-sm sm:rounded-[1.75rem] sm:px-5 sm:py-5"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-sm">
          🍃
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">We use cookies</p>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-secondary)]">
            We use an essential session cookie to keep you signed in. No tracking, no ads.{" "}
            <Link href="/legal/privacy#cookies" className="underline hover:text-[color:var(--text-primary)]">
              Learn more
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={accept}
              className="rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-semibold text-stone-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={decline}
              className="rounded-xl border [border-color:var(--border)] px-4 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--page-secondary)] hover:text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sky-400/40"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
