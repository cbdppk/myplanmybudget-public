"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateProfileDetails } from "../actions";

const TIMEZONES = [
  "Africa/Johannesburg", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai",
  "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
  "Pacific/Auckland",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "af", label: "Afrikaans" },
];

export function ProfileSettingsForm({
  initialName,
  initialTimezone,
  initialLanguage,
}: {
  initialName: string;
  initialTimezone: string;
  initialLanguage: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [language, setLanguage] = useState(initialLanguage);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hasChanges =
    name !== initialName || timezone !== initialTimezone || language !== initialLanguage;

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setTimezone(initialTimezone);
  }, [initialTimezone]);

  useEffect(() => {
    setLanguage(initialLanguage);
  }, [initialLanguage]);

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">Profile</h2>
      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Your personal information shown across the app.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor="profile-name" className="text-xs font-medium text-[color:var(--text-secondary)]">
            Display name
          </label>
          <input
            id="profile-name"
            className="h-10 rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="profile-timezone" className="text-xs font-medium text-[color:var(--text-secondary)]">
            Timezone
          </label>
          <select
            id="profile-timezone"
            className="h-10 rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
            ))}
            {!TIMEZONES.includes(timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="profile-language" className="text-xs font-medium text-[color:var(--text-secondary)]">
            Language
          </label>
          <select
            id="profile-language"
            className="h-10 rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
            {!LANGUAGES.find((l) => l.value === language) && (
              <option value={language}>{language}</option>
            )}
          </select>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          loading={pending}
          disabled={pending || !hasChanges}
          onClick={() => {
            setMessage(null);
            start(async () => {
              try {
                await updateProfileDetails({ name, timezone, language });
                setMessage("Profile updated.");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed to save.");
              }
            });
          }}
        >
          Save profile
        </Button>
        {message ? (
          <p className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
        ) : null}
      </div>
    </section>
  );
}
