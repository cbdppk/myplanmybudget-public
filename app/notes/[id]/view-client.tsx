"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateNote } from "../actions";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export function NoteJournalEditor({
  noteId,
  initialTitle,
  initialContent,
  createdAt,
}: {
  noteId: string;
  initialTitle: string;
  initialContent: string;
  createdAt: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [pending, start] = useTransition();

  const hasChanges = title !== initialTitle || content !== initialContent;

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSave = () => {
    start(async () => {
      try {
        await updateNote({ noteId, title: title || undefined, content });
        setEditing(false);
        toast.success("Note updated.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update note.");
      }
    });
  };

  const handleCancel = () => {
    setTitle(initialTitle);
    setContent(initialContent);
    setEditing(false);
  };

  return (
    <article className="card p-6 md:p-8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {editing ? (
            <input
              className="w-full rounded-xl border border-black/15 px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              autoFocus
            />
          ) : (
            <h1 className="text-xl font-semibold leading-snug">{title || "Untitled"}</h1>
          )}
          <p className="mt-1 text-xs text-black/40">{formatDate(createdAt)}</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 px-3 py-1.5 text-sm text-black/60 transition hover:bg-black/[0.04] hover:text-black/80"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" loading={pending} disabled={pending || !hasChanges} onClick={handleSave}>
              <Check className="mr-1 h-3.5 w-3.5" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={pending}>
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-6">
        {editing ? (
          <textarea
            className="min-h-[400px] w-full rounded-xl border border-black/15 p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-400"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        ) : (
          <div className="prose prose-sm max-w-none">
            {content.split("\n").map((line, i) =>
              line.trim() === "" ? (
                <br key={i} />
              ) : (
                <p key={i} className="text-sm leading-relaxed text-black/80">
                  {line}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </article>
  );
}
