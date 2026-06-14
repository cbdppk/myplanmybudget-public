"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateAppearanceSettings } from "../actions";
import { HelpTip } from "../_components/help-tip";

const THEMES = [
  { value: "system", label: "System default", desc: "Follows your device's light or dark setting." },
  { value: "light", label: "Light", desc: "Always use the light theme." },
  { value: "dark", label: "Dark", desc: "Always use the dark theme." },
];

export function AppearanceSettingsForm({ initialTheme }: { initialTheme: string }) {
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const [pending, start] = useTransition();

  const hasChanges = theme !== initialTheme;

  useEffect(() => {
    setTheme(initialTheme);
  }, [initialTheme]);

  // On mount, sync the DB preference to localStorage so the theme init script
  // picks up the correct theme on next page load, avoiding a flash.
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored !== initialTheme) {
      localStorage.setItem("theme", initialTheme);
      window.dispatchEvent(new Event("app-theme-change"));
    }
  }, [initialTheme]);

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <HelpTip text="Your theme choice is saved to your account and applies across all your devices." />
      </div>
      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Choose how the app looks.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            className={`rounded-xl border-2 p-4 text-left transition ${
              theme === t.value
                ? "border-sky-500 bg-sky-500/10"
                : "[border-color:var(--border)] hover:[border-color:var(--text-muted)]"
            }`}
          >
            <p className="text-sm font-medium">{t.label}</p>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{t.desc}</p>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Button
          loading={pending}
          disabled={pending || !hasChanges}
          onClick={() => {
            start(async () => {
              try {
                await updateAppearanceSettings({ themePreference: theme as "light" | "dark" | "system" });
                // Sync localStorage so the inline init script picks up the new theme on next load
                localStorage.setItem("theme", theme);
                window.dispatchEvent(new Event("app-theme-change"));
                router.refresh();
                toast.success("Appearance saved.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to save.");
              }
            });
          }}
        >
          Save appearance
        </Button>
      </div>
    </section>
  );
}
