"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createNote, togglePin } from "./actions";

type NoteRow = {
  id: string;
  title: string | null;
  content: string;
  pinned: boolean;
  createdAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function contentPreview(text: string, maxLen = 120) {
  const t = text.trim();
  return t.length > maxLen ? t.slice(0, maxLen) + "…" : t;
}

function sortNotes(rows: NoteRow[]) {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function NotesBoard({ initialNotes }: { initialNotes: NoteRow[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState(() => sortNotes(initialNotes));
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [query, setQuery] = useState("");
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [pending, start] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  useEffect(() => {
    setNotes(sortNotes(initialNotes));
  }, [initialNotes]);

  const resetForm = () => {
    setNewTitle("");
    setNewContent("");
    setShowForm(false);
  };

  const handleCreate = () => {
    if (!newContent.trim()) return;
    start(async () => {
      try {
        const result = await createNote({ title: newTitle || undefined, content: newContent });
        setNotes((prev) => sortNotes([result.note, ...prev.filter((note) => note.id !== result.note.id)]));
        resetForm();
        toast.success("Note saved.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save note.");
      }
    });
  };

  const handlePin = (noteId: string) => {
    setPinningId(noteId);
    start(async () => {
      try {
        await togglePin(noteId);
        setNotes((prev) => sortNotes(prev.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n))));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update note.");
      } finally {
        setPinningId(null);
      }
    });
  };

  const visibleNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((note) => {
      if (onlyPinned && !note.pinned) return false;
      if (!q) return true;
      return (note.title ?? "").toLowerCase().includes(q) || note.content.toLowerCase().includes(q);
    });
  }, [notes, onlyPinned, query]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-9 w-48 rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] px-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
            placeholder="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setOnlyPinned((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition ${onlyPinned ? "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" : "[border-color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--page-secondary)]"}`}
          >
            <Pin className="h-3.5 w-3.5" />
            {onlyPinned ? "Pinned only" : "All notes"}
          </button>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New note
          </Button>
        )}
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-2xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New note</h2>
            <button type="button" onClick={resetForm} className="rounded-full p-1 hover:bg-black/[0.06] dark:hover:bg-white/[0.06]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">Title (optional)</label>
              <input
                className="h-10 w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] px-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Give your note a title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">Note</label>
              <textarea
                className="min-h-[160px] w-full rounded-xl border [border-color:var(--border)] bg-[color:var(--page-bg)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Write your note here…"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button loading={pending} disabled={pending || !newContent.trim()} onClick={handleCreate} className="flex-1">
              Save note
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Notes grid */}
      {visibleNotes.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-[color:var(--text-secondary)]">
            {notes.length === 0 ? "No notes yet." : "No notes match your search."}
          </p>
          {notes.length === 0 && (
            <button type="button" onClick={() => setShowForm(true)} className="mt-3 text-sm text-sky-600 underline underline-offset-2 dark:text-sky-400">
              Create your first note
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleNotes.map((note) => (
            <article key={note.id} className="card group flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  disabled={openingId === note.id}
                  onClick={() => {
                    setOpeningId(note.id);
                    router.push(`/notes/${note.id}`);
                  }}
                  className="flex-1 text-left"
                >
                  <p className="text-sm font-semibold leading-snug">
                    <span className="relative inline-flex items-center">
                      <span className={openingId === note.id ? "invisible" : undefined}>{note.title || "Untitled"}</span>
                      {openingId === note.id ? (
                        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        </span>
                      ) : null}
                    </span>
                  </p>
                </button>
                <button
                  type="button"
                  title={note.pinned ? "Unpin" : "Pin"}
                  disabled={pinningId === note.id}
                  onClick={() => handlePin(note.id)}
                  className={`shrink-0 rounded-lg p-1 transition ${note.pinned ? "text-sky-500" : "text-[color:var(--text-muted)] opacity-0 group-hover:opacity-100"} hover:bg-black/[0.05] dark:hover:bg-white/[0.05] disabled:opacity-40`}
                >
                  {pinningId === note.id ? (
                    <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-[color:var(--text-secondary)]">
                {contentPreview(note.content)}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-[color:var(--text-muted)]">{formatDate(note.createdAt)}</p>
                <button
                  type="button"
                  disabled={openingId === note.id}
                  onClick={() => {
                    setOpeningId(note.id);
                    router.push(`/notes/${note.id}`);
                  }}
                  className="text-xs text-sky-600 underline underline-offset-2 hover:text-sky-700 dark:text-sky-400"
                >
                  Open
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
