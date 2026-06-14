"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Note = { id: string; title: string; content: string };
type Reminder = { id: string; title: string; dueAt: string; channel: string; done: boolean };

export function NotesClient({ initialNotes, initialReminders }: { initialNotes: Note[]; initialReminders: Reminder[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => initialNotes.filter((n) => `${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase())),
    [initialNotes, query]
  );

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <article className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Notes</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="h-9 rounded-xl border border-black/15 px-3 text-sm" />
        </div>

        <div className="mt-4 space-y-3">
          {filtered.length ? (
            filtered.map((note) => (
              <div key={note.id} className="rounded-2xl border border-black/10 p-4">
                <p className="font-medium">{note.title}</p>
                <p className="mt-1 text-sm text-black/70">{note.content}</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-black/20 p-5 text-sm text-black/60">No notes yet. Use Add note from global actions.</div>
          )}
        </div>
      </article>

      <article className="card p-5">
        <h2 className="text-lg font-semibold">Reminders</h2>
        <div className="mt-3 space-y-2 text-sm">
          {initialReminders.length ? (
            initialReminders.map((item) => (
              <div key={item.id} className="rounded-xl bg-black/[0.03] px-3 py-2">
                {item.title} - {item.dueAt} - {item.channel}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-black/20 px-3 py-2 text-black/60">No reminders set.</div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 p-4">
          <p className="text-sm font-medium">Create reminder</p>
          <div className="mt-2 grid gap-2">
            <input className="h-9 rounded-xl border border-black/15 px-3 text-sm" placeholder="Title" />
            <input className="h-9 rounded-xl border border-black/15 px-3 text-sm" placeholder="Schedule (cron-like) e.g. monthly:last-day" />
          </div>
          <Button className="mt-3" size="sm">Save reminder</Button>
        </div>
      </article>
    </section>
  );
}
