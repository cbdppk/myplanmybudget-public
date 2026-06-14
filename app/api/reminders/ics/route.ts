import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function formatUtc(date: Date) {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(".000", "");
}

export async function GET(request: Request) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch {
    return new Response("Unauthenticated", { status: 401 });
  }

  const url = new URL(request.url);
  const reminderId = url.searchParams.get("reminderId");

  const reminders = await prisma.reminder.findMany({
    where: { userId: user.id, done: false, ...(reminderId ? { id: reminderId } : {}) },
    orderBy: { dueAt: "asc" },
    take: 500,
    select: { id: true, title: true, dueAt: true, recurrence: true, recurrenceInterval: true },
  });

  const now = formatUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EyeHai Technologies//MyplanMybudget//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const item of reminders) {
    const due = formatUtc(item.dueAt);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:reminder-${item.id}@myplanmybudget`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${due}`);
    lines.push(`DTEND:${due}`);
    lines.push(`SUMMARY:${escapeIcs(item.title)}`);
    lines.push("DESCRIPTION:Imported from MyplanMybudget reminders.");
    if (item.recurrence !== "NONE") {
      const freq = item.recurrence.toUpperCase();
      const interval = Math.max(1, item.recurrenceInterval || 1);
      lines.push(`RRULE:FREQ=${freq};INTERVAL=${interval}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const body = `${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${reminderId ? "myplanmybudget-reminder" : "myplanmybudget-reminders"}.ics"`,
      "cache-control": "no-store",
    },
  });
}
