"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Trash2, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createReminder, deleteReminder, toggleReminder } from "./actions";

type ReminderRow = {
  id: string;
  title: string;
  dueAt: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceInterval: number;
  done: boolean;
};

function formatDueDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function recurrenceLabel(r: ReminderRow) {
  if (r.recurrence === "NONE") return "One-time";
  return `Repeats every ${r.recurrenceInterval} ${r.recurrence.toLowerCase()}`;
}

function sortReminders(rows: ReminderRow[]) {
  return [...rows].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export function RemindersClient({ initialReminders }: { initialReminders: ReminderRow[] }) {
  const router = useRouter();
  const [reminders, setReminders] = useState(() => sortReminders(initialReminders));
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [recurrence, setRecurrence] = useState<"NONE" | "DAILY" | "WEEKLY" | "MONTHLY">("NONE");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [channel, setChannel] = useState<"IN_APP" | "EMAIL" | "PUSH">("IN_APP");

  const [pending, start] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setReminders(sortReminders(initialReminders));
  }, [initialReminders]);

  const canAdd = title.trim().length >= 2 && dueAt.trim().length > 0;

  const resetForm = () => {
    setTitle("");
    setDueAt("");
    setRecurrence("NONE");
    setRecurrenceInterval("1");
    setChannel("IN_APP");
    setShowForm(false);
  };

  const handleCreate = () => {
    if (!canAdd) return;
    const payload = {
      title: title.trim(),
      dueAt,
      recurrence,
      recurrenceInterval: Number(recurrenceInterval) || 1,
      channel,
    };
    start(async () => {
      try {
        const result = await createReminder(payload);
        setReminders((prev) => sortReminders([result.reminder, ...prev.filter((item) => item.id !== result.reminder.id)]));
        resetForm();
        router.refresh();
        toast.success("Reminder added.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add reminder.");
      }
    });
  };

  const handleToggle = (id: string) => {
    setTogglingId(id);
    start(async () => {
      try {
        await toggleReminder({ reminderId: id });
        setReminders((prev) => sortReminders(prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r))));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update reminder.");
      } finally {
        setTogglingId(null);
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    start(async () => {
      try {
        await deleteReminder({ reminderId: id });
        setReminders((prev) => prev.filter((r) => r.id !== id));
        setDeleteConfirmId(null);
        toast.success("Reminder deleted.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete reminder.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const active = reminders.filter((r) => !r.done);
  const done = reminders.filter((r) => r.done);

  return (
    <div className="space-y-4">
      {/* New reminder button */}
      {!showForm && (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New reminder
          </Button>
        </div>
      )}

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-2xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New reminder</h2>
            <button type="button" onClick={resetForm} className="rounded-full p-1 hover:bg-black/[0.06] dark:hover:bg-white/[0.06]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">Title</label>
              <input
                className="h-10 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] px-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="e.g. Pay rent"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">Due date & time</label>
              <input
                className="h-10 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] px-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-[color:var(--text-secondary)]">Repeat</label>
                <select
                  className="h-10 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] px-3 text-sm"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as "NONE" | "DAILY" | "WEEKLY" | "MONTHLY")}
                >
                  <option value="NONE">No repeat</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-[color:var(--text-secondary)]">Notify via</label>
                <select
                  className="h-10 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] px-3 text-sm"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "IN_APP" | "EMAIL" | "PUSH")}
                >
                  <option value="IN_APP">In-app</option>
                  <option value="EMAIL">Email</option>
                  <option value="PUSH">Push</option>
                </select>
              </div>
            </div>
            {recurrence !== "NONE" && (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-[color:var(--text-secondary)]">Every N {recurrence.toLowerCase()}s</label>
                <input
                  className="h-10 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] px-3 text-base"
                  inputMode="numeric"
                  min="1"
                  max="30"
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="mt-5 flex gap-3">
            <Button loading={pending} disabled={pending || !canAdd} onClick={handleCreate} className="flex-1">
              Save reminder
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-6 shadow-xl">
            <h2 className="text-base font-semibold text-rose-600 dark:text-rose-400">Delete reminder?</h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              This will permanently delete the reminder. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                className="flex-1 bg-rose-700 text-white hover:bg-rose-800"
                loading={deletingId === deleteConfirmId}
                disabled={deletingId === deleteConfirmId}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                Delete
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={!!deletingId}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active reminders */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Upcoming</h2>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">No upcoming reminders. Add one above.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {active.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border [border-color:var(--border)] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{formatDueDate(item.dueAt)}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{recurrenceLabel(item)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/api/reminders/ics?reminderId=${item.id}`}
                    className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition hover:bg-black/[0.05] hover:text-[color:var(--text-secondary)] dark:hover:bg-white/[0.05]"
                    title="Add to calendar"
                  >
                    <Calendar className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    title="Mark done"
                    disabled={togglingId === item.id}
                    onClick={() => handleToggle(item.id)}
                    className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-50 dark:hover:text-emerald-400"
                  >
                    {togglingId === item.id ? (
                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Done reminders */}
      {done.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[color:var(--text-muted)]">Completed</h2>
          <div className="mt-3 space-y-2">
            {done.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border [border-color:var(--border)] px-4 py-3 opacity-60">
                <div className="min-w-0">
                  <p className="text-sm line-through">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{formatDueDate(item.dueAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    title="Mark open"
                    disabled={togglingId === item.id}
                    onClick={() => handleToggle(item.id)}
                    className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition hover:bg-black/[0.05] hover:text-[color:var(--text-secondary)] disabled:opacity-50 dark:hover:bg-white/[0.05]"
                  >
                    {togglingId === item.id ? (
                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
