"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createNote as createNoteRepo,
  updateNote as updateNoteRepo,
  toggleNotePin,
} from "@/lib/data/notes";
import { requireUser } from "@/lib/auth/session";

const CreateNoteSchema = z.object({
  title: z.string().max(120).optional(),
  content: z.string().min(1).max(2000),
});

export async function createNote(input: z.infer<typeof CreateNoteSchema>) {
  await requireUser();
  const data = CreateNoteSchema.parse(input);
  const result = await createNoteRepo(data);
  revalidatePath("/notes");
  revalidatePath("/dashboard");
  return {
    ok: true,
    note: {
      id: result.note.id,
      title: result.note.title,
      content: result.note.content,
      pinned: result.note.pinned,
      createdAt: result.note.createdAt.toISOString(),
    },
  };
}

export async function togglePin(noteId: string) {
  await requireUser();
  await toggleNotePin(noteId);
  revalidatePath("/notes");
  revalidatePath("/dashboard");
  return { ok: true };
}

const UpdateNoteSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().max(120).optional(),
  content: z.string().min(1).max(2000),
});

export async function updateNote(input: z.infer<typeof UpdateNoteSchema>) {
  await requireUser();
  const data = UpdateNoteSchema.parse(input);
  await updateNoteRepo(data);
  revalidatePath("/notes");
  revalidatePath(`/notes/${data.noteId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
