import { requireUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { runAiAgent, type ConversationMessage, type UserContext } from "@/lib/ai/agent";
import { prisma } from "@/lib/prisma";
import { ensureCurrentBudgetPeriod } from "@/lib/data/utils";

export const dynamic = "force-dynamic";

// Keep AI usage intentionally tight because the merged dashboard answers common
// questions locally and only escalates specific follow-ups to the model.
const AI_DAILY_LIMIT = 8;
const AI_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function buildUserContext(userId: string): Promise<UserContext> {
  const [profile, categories, period] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { id: userId },
      select: { name: true, currency: true },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    ensureCurrentBudgetPeriod(userId),
  ]);

  return {
    name: profile?.name ?? null,
    currency: profile?.currency ?? "USD",
    periodName: period.name,
    periodStart: period.startDate.toISOString().slice(0, 10),
    periodEnd: period.endDate.toISOString().slice(0, 10),
    categoryNames: categories.map((c) => c.name),
  };
}

export async function POST(req: Request) {
  // Auth check
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "ACCOUNT_DISABLED" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }

  // Rate limit: keyed by userId
  const rateResult = await checkRateLimit(`ai-daily:${user.id}`, AI_DAILY_LIMIT, AI_RATE_WINDOW_MS);
  if (!rateResult.allowed) {
    const retryAfterSec = Math.ceil((rateResult.retryAfterMs ?? AI_RATE_WINDOW_MS) / 1000);
    return Response.json(
      {
        error: `Daily AI limit reached. You can send ${AI_DAILY_LIMIT} AI follow-ups per day. Try again in about ${Math.ceil(retryAfterSec / 3600)} hours.`,
        remaining: 0,
        limit: AI_DAILY_LIMIT,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  // Parse and validate request body
  let messages: ConversationMessage[];
  try {
    const body = await req.json();
    if (!Array.isArray(body?.messages)) {
      return Response.json({ error: "Invalid request: messages must be an array." }, { status: 400 });
    }
    const MAX_MESSAGE_LENGTH = 2000;
    messages = (body.messages as ConversationMessage[])
      .filter(
        (m) =>
          m &&
          typeof m.role === "string" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0 &&
          m.content.length <= MAX_MESSAGE_LENGTH
      )
      .slice(-20); // keep last 20 messages to cap token usage

    if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
      return Response.json({ error: "Last message must be from user." }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Build user context for system prompt
  let ctx: UserContext;
  try {
    ctx = await buildUserContext(user.id);
  } catch {
    return Response.json({ error: "Failed to load user context." }, { status: 500 });
  }

  // Run the AI agent
  try {
    const result = await runAiAgent(messages, ctx);
    return Response.json({ reply: result.reply, actions: result.actions, remaining: rateResult.remaining, limit: AI_DAILY_LIMIT });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed.";
    if (message.includes("ANTHROPIC_API_KEY")) {
      return Response.json({ error: "AI is not configured. Set ANTHROPIC_API_KEY." }, { status: 503 });
    }
    console.error("ai_chat_error", { userId: user.id, message });
    return Response.json({ error: "AI request failed. Please try again." }, { status: 500 });
  }
}
