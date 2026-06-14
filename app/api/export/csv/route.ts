import { hasRecentReauth, requireUser } from "@/lib/auth/session";
import { getExportBundle } from "@/lib/data/exports";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return new Response("Unauthenticated", { status: 401 });
  }

  const rl = await checkRateLimit(`export:csv:${user.id}`, 10, 15 * 60_000);
  if (!rl.allowed) {
    return new Response("Export rate limit reached. Try again in 15 minutes.", { status: 429 });
  }

  const allowed = await hasRecentReauth();
  if (!allowed) {
    return new Response("Please re-authenticate in Security to continue.", { status: 401 });
  }

  const data = await getExportBundle(user.id);

  // Audit log the export
  await prisma.auditEvent.create({
    data: { userId: user.id, action: "DATA_EXPORT_CSV", meta: { exportedAt: new Date().toISOString() } },
  }).catch(() => undefined);

  // Escape CSV value and defend against formula injection (=, +, -, @, \t, \r prefixes)
  const escapeCsv = (value: unknown) => {
    const text = String(value ?? "");
    const escaped = text.replaceAll('"', '""');
    // Prefix formula-start characters to prevent injection in spreadsheet apps
    const safe = /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
    return `"${safe}"`;
  };

  const header = "record_type,id,date,title_or_name,category_or_period,type_or_state,amount,details";

  const transactionRows = data.transactions.map((item) =>
    [
      "transaction",
      item.id,
      item.occurredAt.toISOString().slice(0, 10),
      item.memo ?? "",
      item.category?.name ?? "",
      item.type,
      item.amount,
      "",
    ]
      .map(escapeCsv)
      .join(",")
  );

  const budgetRows = data.budgets.map((item) =>
    [
      "budget",
      item.id,
      item.period.startDate.toISOString().slice(0, 10),
      item.category.name,
      item.period.name,
      "target",
      item.amount,
      `${item.period.startDate.toISOString().slice(0, 10)}..${item.period.endDate.toISOString().slice(0, 10)}`,
    ]
      .map(escapeCsv)
      .join(",")
  );

  const reminderRows = data.reminders.map((item) =>
    [
      "reminder",
      item.id,
      item.dueAt.toISOString().slice(0, 10),
      item.title,
      "",
      item.done ? "done" : "open",
      "",
      item.channel,
    ]
      .map(escapeCsv)
      .join(",")
  );

  const noteRows = data.notes.map((item) =>
    [
      "note",
      item.id,
      item.updatedAt.toISOString().slice(0, 10),
      item.title ?? "",
      "",
      item.pinned ? "pinned" : "normal",
      "",
      item.content,
    ]
      .map(escapeCsv)
      .join(",")
  );

  const rows = [...transactionRows, ...budgetRows, ...reminderRows, ...noteRows];

  return new Response([header, ...rows].join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=myplanmybudget-export.csv",
    },
  });
}
