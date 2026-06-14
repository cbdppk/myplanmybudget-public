import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import { AI_TOOLS, executeTool, type ActionRecord } from "./tools";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type UserContext = {
  name: string | null;
  currency: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  categoryNames: string[];
};

export type AgentResult = {
  reply: string;
  actions: ActionRecord[];
};

function buildSystemPrompt(ctx: UserContext): string {
  const today = new Date().toISOString().slice(0, 10);
  const categories = ctx.categoryNames.length > 0 ? ctx.categoryNames.join(", ") : "none set yet";

  return `You are a concise, friendly personal finance assistant built into MyplanMybudget.
Your job is to help ${ctx.name ?? "the user"} manage their finances by:
- Logging transactions (expenses, income, savings contributions)
- Creating savings goals
- Setting reminders for bills and financial events
- Answering financial questions using their live data

## User context
- Today's date: ${today}
- Currency: ${ctx.currency}
- Current budget period: ${ctx.periodName} (${ctx.periodStart} to ${ctx.periodEnd})
- Existing expense/savings categories: ${categories}

## Rules
1. Be brief. One or two sentences max unless the user asks for explanation.
2. Always use tools to take action — never pretend to do something.
3. When logging an expense, try to match an existing category name (case-insensitive) if it fits.
4. If you need financial data to answer a question, call get_financial_summary first.
5. Confirm what you did after tool calls. Be encouraging but not sycophantic.
6. If a request is ambiguous (e.g. amount unclear), ask ONE focused clarifying question.
7. Never invent numbers. Only report figures you get back from get_financial_summary.
8. You cannot view past transactions, only the summary. Direct users to /track for history.

Keep all replies under 120 words unless the user explicitly asks for a detailed breakdown.`;
}

function toAnthropicMessages(messages: ConversationMessage[]): MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function extractText(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

export async function runAiAgent(
  messages: ConversationMessage[],
  ctx: UserContext
): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(ctx);
  const anthropicMessages = toAnthropicMessages(messages);

  // First call: AI decides whether to use tools or reply directly
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    tools: AI_TOOLS,
    messages: anthropicMessages,
  });

  const actions: ActionRecord[] = [];

  if (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const toolResults: MessageParam["content"] = [];

    for (const block of toolUseBlocks) {
      if (block.type !== "tool_use") continue;
      try {
        const outcome = await executeTool(block.name, block.input as Record<string, unknown>);
        if (outcome.action) actions.push(outcome.action);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: outcome.result,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Tool execution failed.";
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Error: ${msg}`,
          is_error: true,
        });
      }
    }

    // Second call: AI synthesises tool results into a natural response
    const followUp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      tools: AI_TOOLS,
      messages: [
        ...anthropicMessages,
        { role: "assistant", content: response.content },
        { role: "user",      content: toolResults },
      ],
    });

    return { reply: extractText(followUp), actions };
  }

  return { reply: extractText(response), actions };
}
