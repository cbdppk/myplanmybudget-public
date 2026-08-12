# Assistant

**Added:** 2026-03-06
**Model:** Claude Haiku 3.5 (`claude-haiku-4-5-20251001`) via Anthropic SDK
**Route:** `/assistant` (`/ai` now redirects)

## Current Runtime Note

As of **2026-03-12**, the main Assistant page no longer calls an external AI API for normal use.

- `/assistant` now runs a **local deterministic assistant UI** that answers common product/help questions, explains live account data from Prisma-backed reads, and can route complaints or feedback into the admin inbox.
- The page uses built-in app knowledge plus live dashboard/goals context.
- The older `/api/ai/chat` route and Anthropic integration still exist in the codebase, but the main Assistant page is not dependent on them now.

---

## What It Does

Users type natural language into a chat interface and the AI:

| Input example | Action taken |
|---|---|
| "I spent $50 on groceries" | Creates EXPENSE transaction, matches/creates category |
| "Save $2000 for a laptop by June" | Creates a savings goal with target + due date |
| "Remind me to pay rent on the 1st" | Creates a monthly recurring reminder |
| "How am I doing this month?" | Reads live dashboard data, gives plain-language advice |

The AI does **not** invent numbers or guess at your data — it reads live figures from your actual budget period and only reports what it finds.

---

## Architecture

```
User types message
       ↓
/app/ai/page.tsx           — client component, holds chat state in useState
       ↓  POST { messages[] }
/app/api/ai/chat/route.ts  — auth + rate limit + user context builder
       ↓
lib/ai/agent.ts            — Anthropic SDK call, one agentic loop
       ↓  Claude picks tool(s)
lib/ai/tools.ts            — tool executor, calls lib/data/* functions
       ↓  tool results fed back to Claude
       ↓  Claude returns natural language reply
Route returns { reply, actions[] }
       ↓
Chat UI shows reply + action pills
```

**One agentic loop per message** (not streaming):
1. Call Claude with tool definitions
2. If Claude returns `tool_use` blocks → execute each tool → feed results back
3. Claude returns final text response
4. Return `{ reply, actions[] }` to client

No streaming in v1 (can be added later). This keeps the implementation simple and predictable.

---

## New Files

### `lib/ai/tools.ts`

Defines the 4 tool schemas (sent to Claude as JSON) and their executor functions.

**Tools:**

| Name | Description | Calls |
|---|---|---|
| `log_transaction` | Log expense, income, or savings | `createQuickTransaction()` |
| `create_goal` | Create a savings goal | `createGoal()` |
| `create_reminder` | Set a bill or event reminder | `createReminderWithRecurrence()` |
| `get_financial_summary` | Read current financial state | `getDashboardData()` |

All writes go through the existing `lib/data/*` functions — full RLS enforcement, validation, and audit logging apply automatically.

`get_financial_summary` is **read-only**. It returns a condensed JSON snapshot (income, expenses, savings, net, budget %, savings rate, top categories, active goals) for the AI to base advice on.

### `lib/ai/agent.ts`

Core Anthropic SDK call logic.

**Key exports:**
- `runAiAgent(messages, userContext)` — runs the agentic loop, returns `{ reply, actions }`
- `ConversationMessage` type — `{ role: "user" | "assistant", content: string }`
- `UserContext` type — `{ name, currency, periodName, periodStart, periodEnd, categoryNames }`

**System prompt injects:**
- Today's date
- User's currency
- Current budget period name and date range
- Existing category names (so AI categorises transactions correctly)
- Personality: brief, actionable, encouraging financial coach

**Model:** `claude-haiku-4-5-20251001` — cheapest capable model, excellent at structured tool use.

### `app/api/ai/chat/route.ts`

Authenticated POST API route.

**Request body:**
```json
{ "messages": [{ "role": "user", "content": "..." }, ...] }
```

**Response body:**
```json
{
  "reply": "Done! I logged $50 as an expense under Food.",
  "actions": [
    { "tool": "log_transaction", "label": "Logged expense", "detail": "groceries — 50" }
  ]
}
```

**Security:**
- `requireUser()` — 401 if not logged in, 403 if account disabled
- Rate limit: **20 requests per user per hour** using existing `RateLimitBucket` table
- Message history capped at last 20 messages before sending to API
- Last message must be from `"user"` role

**Error responses:**

| Status | Cause |
|---|---|
| 401 | Not authenticated |
| 403 | Account disabled |
| 400 | Invalid request body |
| 429 | Rate limit exceeded (Retry-After header included) |
| 503 | `ANTHROPIC_API_KEY` not set |
| 500 | AI or DB error |

### `app/ai/page.tsx`

Full-page chat UI. Client component — no server-side data fetching needed.

**UI features:**
- Chat bubbles (user right, AI left)
- **Action pills** above AI replies showing what was done:
  - Green = transaction logged
  - Purple = goal created
  - Amber = reminder set
- 4 quick starter buttons on the welcome screen
- Auto-resizing textarea (Shift+Enter for new line, Enter to send)
- Bouncing dots loading indicator while waiting for AI
- Error state with inline message
- Auto-scroll to latest message

Chat history lives in `useState` only (not persisted to DB). Each page load starts fresh. This keeps costs down — no DB reads/writes for conversation history.

---

## Modified Files

### `components/shell/app-shell.tsx`

- Added `{ href: "/ai", label: "AI Assistant" }` to the `appNav` array (second item, after Dashboard)
- Added `"/ai"` to `appPrefixes` so the route gets the app shell layout

---

## Cost Estimates

| Usage | Approximate cost |
|---|---|
| 1 advice message (no tool) | ~$0.001 |
| 1 action (transaction/goal/reminder) | ~$0.0004 |
| 100 users × 10 messages/day for a month | ~$1.20/month |

Rate limit of 20/hour per user prevents abuse.

Cost is billed to your Anthropic account, not per-user — set a monthly spend cap in the Anthropic console.

---

## Setup

### 1. Get an Anthropic API key

Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key.

### 2. Add the env var

**.env.local (development):**
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Vercel (production):**
Add `ANTHROPIC_API_KEY` in Project → Settings → Environment Variables.

### 3. That's it

Navigate to `/ai` in the app. The "AI Assistant" link appears in the sidebar.

---

## Dependencies Added

```
@anthropic-ai/sdk@0.78.0
```

Added to `package.json` via `pnpm add @anthropic-ai/sdk`.

---

## Extending Later

| Feature | Where to add |
|---|---|
| Streaming responses | `app/api/ai/chat/route.ts` — switch to `client.messages.stream()`, send SSE to client |
| Update goal progress | Add `update_goal` tool in `lib/ai/tools.ts` |
| Log transfers | Add `TRANSFER` type to `log_transaction` tool |
| Persist chat history | Add `AiThread` model to schema, save messages per user |
| Budget coaching mode | Expand `get_financial_summary` to include trend data + advice context |

---

## Data Flow (Sequence)

```
Browser                   /api/ai/chat          lib/ai/agent       Anthropic API       lib/data/*
  │                            │                     │                   │                  │
  │── POST { messages } ──────>│                     │                   │                  │
  │                            │── requireUser() ───>│                   │                  │
  │                            │── rate limit ───────│                   │                  │
  │                            │── buildUserContext()│                   │                  │
  │                            │── runAiAgent() ─────>                   │                  │
  │                            │                     │── messages.create ─>                 │
  │                            │                     │<── tool_use blocks ─                 │
  │                            │                     │── executeTool() ───────────────────>  │
  │                            │                     │<── { result, action } ──────────────  │
  │                            │                     │── messages.create (with results) ──>  │
  │                            │                     │<── final text reply ──────────────────│
  │                            │<── { reply, actions}│                   │                  │
  │<── { reply, actions } ─────│                     │                   │                  │
  │                            │                     │                   │                  │
```
