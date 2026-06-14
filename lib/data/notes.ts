import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/data/utils";

export async function getNotesData() {
  const user = await getActiveUser();
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return { user, notes };
}

export async function createNote(params: { title?: string; content: string }) {
  const user = await getActiveUser();
  const note = await prisma.note.create({
    data: { userId: user.id, title: params.title ?? null, content: params.content },
  });
  return { ok: true, note };
}

export async function getNoteById(noteId: string) {
  const user = await getActiveUser();
  return prisma.note.findFirst({
    where: { id: noteId, userId: user.id },
  });
}

export async function updateNote(params: { noteId: string; title?: string; content: string }) {
  const user = await getActiveUser();
  const note = await prisma.note.findFirst({ where: { id: params.noteId, userId: user.id }, select: { id: true } });
  if (!note) throw new Error("Note not found.");
  await prisma.note.update({
    where: { id: note.id },
    data: {
      title: params.title ?? null,
      content: params.content,
    },
  });
  return { ok: true };
}

export async function toggleNotePin(noteId: string) {
  const user = await getActiveUser();
  const note = await prisma.note.findFirst({ where: { id: noteId, userId: user.id } });
  if (!note) throw new Error("Note not found.");
  await prisma.note.update({ where: { id: note.id }, data: { pinned: !note.pinned } });
  return { ok: true };
}

export async function setNotePinned(noteId: string, pinned: boolean) {
  const user = await getActiveUser();
  const note = await prisma.note.findFirst({ where: { id: noteId, userId: user.id }, select: { id: true } });
  if (!note) throw new Error("Note not found.");
  await prisma.note.update({ where: { id: note.id }, data: { pinned } });
  return { ok: true };
}

export async function getNotesAndRemindersForExport(userId: string) {
  const [notes, reminders] = await Promise.all([
    prisma.note.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.reminder.findMany({ where: { userId }, orderBy: { dueAt: "asc" } }),
  ]);
  return { notes, reminders };
}
