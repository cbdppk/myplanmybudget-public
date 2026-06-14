"use client";

import { useEffect, useState } from "react";

type ResolvedTheme = "light" | "dark";

function getStoredTheme() {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" || stored === "system" ? stored : null;
}

function resolveTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(next: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.style.colorScheme = next;
}

/**
 * `variant="dark"` — always renders with white/transparent styling (for dark headers).
 * `variant="auto"` — adapts icon to current theme but uses neutral light-mode styling (for light headers).
 */
export function ThemeToggle({
  className = "",
  variant = "auto",
}: {
  className?: string;
  variant?: "dark" | "auto";
}) {
  const [theme, setTheme] = useState<ResolvedTheme | null>(null);

  useEffect(() => {
    const syncTheme = () => {
      const next = resolveTheme();
      applyTheme(next);
      setTheme(next);
    };

    syncTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemChange(e: MediaQueryListEvent) {
      const stored = getStoredTheme();
      if (!stored || stored === "system") {
        const next = e.matches ? "dark" : "light";
        applyTheme(next);
        setTheme(next);
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key && event.key !== "theme") return;
      syncTheme();
    }
    function onThemeChange() {
      syncTheme();
    }

    mq.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("app-theme-change", onThemeChange);
    return () => {
      mq.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("app-theme-change", onThemeChange);
    };
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next);
    setTheme(next);
    window.dispatchEvent(new Event("app-theme-change"));
  }

  if (theme === null) return <div className={`h-9 w-9 ${className}`} />;

  // dark variant: always white icons (for dark-bg headers like the public nav)
  // auto variant: adapts to context (for light-bg headers like the app nav)
  const buttonClass =
    variant === "dark"
      ? "border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
      : theme === "dark"
        ? "border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
        : "border-slate-200 bg-white/80 text-slate-500 hover:bg-slate-100 hover:text-slate-900";

  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      onClick={toggle}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${buttonClass} ${className}`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
