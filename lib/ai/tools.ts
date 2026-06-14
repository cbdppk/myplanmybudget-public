import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";
import { createQuickTransaction } from "@/lib/data/transactions";
import { createGoal } from "@/lib/data/goals";
import { createReminderWithRecurrence } from "@/lib/data/reminders";
import { getDashboardData } from "@/lib/data/dashboard";

export type ActionRecord = {
  tool: string;
  label: string;
  detail: string;
};

// ── Tool schema definitions sent to Claude ────────────────────────────────────

export const AI_TOOLS: Tool[] = [
  {
    name: "log_transaction",
    description:
      "Log a financial transaction (expense, income, or savings) for the user. Use this whenever the user says they spent money, received money, or made a savings contribution. IMPORTANT: Do NOT use this for creating goals — use create_goal instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["EXPENSE", "INCOME", "SAVINGS"],
          description: "EXPENSE for spending money, INCOME for receiving money, SAVINGS for savings contributions",
        },
        amount: {
          type: "number",
          description: "Positive numeric amount (e.g. 50, 120.50)",
        },
        memo: {
          type: "string",
          description: "Short description of the transaction (e.g. 'groceries', 'salary', 'electricity bill')",
        },
        category: {
          type: "string",
          description:
            "Category name. For EXPENSE use existing budget categories if they match (e.g. 'Food', 'Transport'). Leave empty if unsure.",
        },
        occurredAt: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD). Default to today if not mentioned.",
        },
      },
      required: ["type", "amount", "memo"],
    },
  },
  {
    name: "create_goal",
    description:
      "Create a new savings goal for the user. Use this when the user wants to save toward a specific target (e.g. 'save $2000 for a laptop', 'I want to save for a vacation').",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Goal name (e.g. 'Laptop', 'Vacation Fund', 'Emergency Buffer')",
        },
        target: {
          type: "number",
          description: "Target amount to save (positive number)",
        },
        current: {
          type: "number",
          description: "Amount already saved toward this goal (default 0)",
        },
        dueDate: {
          type: "string",
          description: "Target completion date as ISO string (YYYY-MM-DD). Optional — omit if user did not mention a deadline.",
        },
      },
      required: ["name", "target"],
    },
  },
  {
    name: "create_reminder",
    description:
      "Create a reminder for an upcoming event, bill, or recurring financial obligation. Use this when the user mentions deadlines, bills, or scheduled payments.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Reminder title (e.g. 'Pay rent', 'Review budget', 'Insurance due')",
        },
        dueAt: {
          type: "string",
          description: "Due date/time as ISO string. If the user says 'the 1st', use next month's 1st. Required.",
        },
        recurrence: {
          type: "string",
          enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY"],
          description:
            "Repeat pattern. Use MONTHLY for bills, WEEKLY for weekly check-ins, NONE for one-time events. Default NONE.",
        },
      },
      required: ["title", "dueAt"],
    },
  },
  {
    name: "get_financial_summary",
    description:
      "Retrieve the user's current financial state to answer advice questions. Call this before giving any financial analysis or answering questions like 'how am I doing?', 'am I on track?', 'what should I cut?'.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ── Tool executor ──────────────────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

export async function executeTool(
  name: string,
  input: ToolInput
): Promise<{ result: string; action?: ActionRecord }> {
  switch (name) {
    case "log_transaction": {
      const type = (input.type as string) ?? "EXPENSE";
      const amount = Number(input.amount);
      const memo = (input.memo as string) ?? "";
      const category = input.category as string | undefined;
      const occurredAt = input.occurredAt as string | undefined;

      await createQuickTransaction({
        type: type as "INCOME" | "EXPENSE" | "SAVINGS",
        amount,
        memo,
        category,
        occurredAt,
      });

      return {
        result: `Successfully logged ${type} of ${amount} for "${memo}"${category ? ` under category "${category}"` : ""}.`,
        action: {
          tool: "log_transaction",
          label: `Logged ${type.toLowerCase()}`,
          detail: `${memo} — ${amount}`,
        },
      };
    }

    case "create_goal": {
      const name = (input.name as string) ?? "New Goal";
      const target = Number(input.target);
      const current = input.current !== undefined ? Number(input.current) : 0;
      const dueDate = input.dueDate as string | undefined;

      await createGoal({ name, target, current, dueDate });

      return {
        result: `Goal "${name}" created with a target of ${target}${current > 0 ? ` (${current} already saved)` : ""}${dueDate ? ` by ${dueDate}` : ""}.`,
        action: {
          tool: "create_goal",
          label: "Created goal",
          detail: `${name} — target ${target}`,
        },
      };
    }

    case "create_reminder": {
      const title = (input.title as string) ?? "Reminder";
      const dueAt = (input.dueAt as string) ?? new Date().toISOString();
      const recurrence = (input.recurrence as "NONE" | "DAILY" | "WEEKLY" | "MONTHLY") ?? "NONE";

      await createReminderWithRecurrence({
        title,
        dueAt,
        recurrence,
        recurrenceInterval: 1,
      });

      return {
        result: `Reminder "${title}" set for ${dueAt}${recurrence !== "NONE" ? ` repeating ${recurrence.toLowerCase()}` : ""}.`,
        action: {
          tool: "create_reminder",
          label: "Reminder set",
          detail: `${title}`,
        },
      };
    }

    case "get_financial_summary": {
      const data = await getDashboardData({ range: "MONTHLY" });
      const currency = data.currency.preferred;

      const summary = {
        period: data.period.name,
        window: data.filters.windowLabel,
        income: data.income,
        expenses: data.expenses,
        savings: data.savings,
        net: data.net,
        moneyStatus: data.moneyStatus,
        budgetUsedPct: data.budgetStatusPct,
        burnRate: data.burnRate,
        savingsRatePct: data.savingsRatePct,
        currency,
        topCategories: data.budgetByCategory.slice(0, 4).map((category) => ({
          name: category.category,
          spent: category.spent,
          remaining: category.remaining,
        })),
        goals: data.goals.slice(0, 4).map((g) => ({
          name: g.name,
          progressPct: g.progressPct,
        })),
        moneyGist: data.moneyGist,
      };

      return { result: JSON.stringify(summary) };
    }

    default:
      return { result: `Unknown tool: ${name}` };
  }
}
