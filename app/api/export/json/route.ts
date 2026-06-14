import { hasRecentReauth, requireUser } from "@/lib/auth/session";
import { getExportBundle } from "@/lib/data/exports";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit(`export:json:${user.id}`, 10, 15 * 60_000);
  if (!rl.allowed) {
    return Response.json({ error: "Export rate limit reached. Try again in 15 minutes." }, { status: 429 });
  }

  const allowed = await hasRecentReauth();
  if (!allowed) {
    return Response.json({ error: "Please re-authenticate in Security to continue." }, { status: 401 });
  }

  const data = await getExportBundle(user.id);

  return Response.json(
    data,
    {
      headers: {
        "content-disposition": "attachment; filename=myplanmybudget-export.json",
      },
    }
  );
}
