import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getNoteById } from "@/lib/data/notes";
import { NoteJournalEditor } from "./view-client";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNoteById(id);
  if (!note) return notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title={note.title || "Your note"}
        subtitle={`Journal entry #${note.id.slice(0, 8)}`}
        action={
          <LoadingLinkButton href="/notes" variant="outline" size="sm">
            ← Back to notes
          </LoadingLinkButton>
        }
      />
      <div className="mt-6">
        <NoteJournalEditor
          noteId={note.id}
          initialTitle={note.title ?? ""}
          initialContent={note.content}
          createdAt={note.createdAt.toISOString()}
        />
      </div>
    </main>
  );
}
