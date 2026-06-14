"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const inputClass =
  "theme-input mt-1 h-11 w-full rounded-2xl px-4 text-sm";

export function ContactForm() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [status,  setStatus]  = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setStatus(null);
        setBusy(true);
        void (async () => {
          try {
            const response = await fetch("/api/contact", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name, email, subject, message }),
            });
            const payload = (await response.json().catch(() => null)) as
              | { error?: string; inquiryId?: string }
              | null;
            if (!response.ok) throw new Error(payload?.error ?? "Failed to send message.");
            setStatus({ ok: true, text: `Message sent. Reference: ${payload?.inquiryId ?? "N/A"}` });
            setName(""); setEmail(""); setSubject(""); setMessage("");
          } catch (error) {
            setStatus({ ok: false, text: error instanceof Error ? error.message : "Failed to send message." });
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <label className="block text-sm">
        <span className="text-[color:var(--text-secondary)]">Name</span>
        <input className={inputClass} type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Your name" />
      </label>

      <label className="block text-sm">
        <span className="text-[color:var(--text-secondary)]">Email</span>
        <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={190} placeholder="you@example.com" />
      </label>

      <label className="block text-sm">
        <span className="text-[color:var(--text-secondary)]">Subject <span className="text-[color:var(--text-muted)]">(optional)</span></span>
        <input className={inputClass} type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="What is this about?" />
      </label>

      <label className="block text-sm">
        <span className="text-[color:var(--text-secondary)]">Message</span>
        <textarea
          className="theme-input mt-1 min-h-32 w-full rounded-2xl px-4 py-3 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={4000}
          placeholder="Tell us how we can help…"
        />
      </label>

      {status ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            status.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={busy}
        loading={busy}
        className="w-full rounded-2xl border-0 font-semibold"
      >
        {busy ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
