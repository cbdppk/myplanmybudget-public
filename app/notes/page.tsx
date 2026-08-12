import { PageHeader } from "@/components/shell/page-header";
import { NotesBoard } from "./client";
import { getNotesData } from "@/lib/data/notes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataLoadError } from "@/components/feature/data-load-error";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  let data: Awaited<ReturnType<typeof getNotesData>> | null = null;
  try {
    data = await getNotesData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
        <PageHeader title="Notes" subtitle="Your personal note vault." />
        <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
      <PageHeader
        title="Notes"
        subtitle="Your personal note vault. Saved notes stay available anytime you sign in."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/reminders">Open reminders</Link>
          </Button>
        }
      />
      <div className="mt-6">
        <NotesBoard
          initialNotes={data.notes.map((note) => ({
            id: note.id,
            title: note.title,
            content: note.content,
            pinned: note.pinned,
            createdAt: note.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
