import { assistantFeedbackCategoryLabel, type AssistantFeedbackCategory } from "@/lib/assistant/feedback";

export type AssistantPrompt = {
  id: string;
  label: string;
  message: string;
};

export type AssistantPromptGroup = {
  title: string;
  prompts: AssistantPrompt[];
};

export type AssistantPageGuide = {
  id: string;
  title: string;
  href: string;
  prompt: string;
  description: string;
  keywords: string[];
};

export type LocalAssistantContext = {
  currency: string;
  fxRate: number;
  periodName: string;
  windowLabel: string;
  availableBalance: number;
  net: number;
  income: number;
  expenses: number;
  savings: number;
  plannedIncome: number;
  plannedExpenses: number;
  plannedSavings: number;
  budgeted: number;
  used: number;
  budgetRemaining: number;
  budgetStatusPct: number;
  savingsRatePct: number;
  moneyGist: string;
  openReminderCount: number;
  noteCount: number;
  todaySummary: {
    count: number;
    income: number;
    expenses: number;
    savings: number;
    net: number;
  };
  topSpend: { category: string; spent: number } | null;
  biggestBudgetGap: { category: string; remaining: number } | null;
  recent: Array<{
    id: string;
    label: string;
    occurredAt: string;
  }>;
  reminders: Array<{
    id: string;
    title: string;
    dueAt: string;
  }>;
  lessons: Array<{
    id: string;
    title: string;
    status: "good" | "warning" | "bad";
    insight: string;
  }>;
  goalSummary: {
    count: number;
    completed: number;
    averageProgressPct: number;
    totalSaved: number;
    totalTarget: number;
  };
  appSummary: {
    transactionCount: number;
    goalCount: number;
    openReminderCount: number;
    noteCount: number;
  };
  goalPlan: {
    fundingSource: "SAVINGS_ONLY" | "SAVINGS_PLUS_SURPLUS" | "SURPLUS_ONLY";
    baselineOutgoing: number;
    baselineSurplus: number;
    availableForGoalsMonthly: number;
    availableSavingsForGoals: number;
    availableSurplusForGoals: number;
    extraIncome: number;
    extraExpense: number;
  } | null;
};

export type LocalAssistantReply = {
  content: string;
  suggestions?: string[];
  feedback?: {
    category: AssistantFeedbackCategory;
    subject: string;
    message: string;
  };
};

export const LOCAL_ASSISTANT_CAPABILITIES = [
  "Explain what each page does",
  "Define budget and goal calculations",
  "Read your live month from Prisma data",
  "Route complaints and product feedback to admin",
  "Suggest the next money task to handle",
] as const;

export const LOCAL_ASSISTANT_PAGE_GUIDES: AssistantPageGuide[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    href: "/dashboard",
    prompt: "What does the Dashboard page do?",
    description: "Shows your actual income, expenses, savings, budget use, top spend, recent activity, and trend chart.",
    keywords: ["dashboard", "home"],
  },
  {
    id: "budget",
    title: "Budget",
    href: "/budget",
    prompt: "What does the Budget page do?",
    description: "Sets the baseline plan: income, outgoing, category targets, and plan-versus-actual guidance.",
    keywords: ["budget", "plan"],
  },
  {
    id: "transactions",
    title: "Transactions",
    href: "/track",
    prompt: "How do I use the Transactions page?",
    description: "Daily capture page for income, expenses, and extra savings. This is where real money activity gets logged.",
    keywords: ["transactions", "transaction", "track", "expenses", "expense"],
  },
  {
    id: "goals",
    title: "Goals",
    href: "/goals",
    prompt: "How do goals work in this app?",
    description: "Plans target purchases and savings goals using available savings plus optional surplus funding.",
    keywords: ["goals", "goal", "goal planner"],
  },
  {
    id: "simulate",
    title: "Simulate",
    href: "/simulate",
    prompt: "What does the Simulate page do?",
    description: "Runs sandbox scenarios before you change your real budget.",
    keywords: ["simulate", "simulation", "simulations"],
  },
  {
    id: "notes",
    title: "Notes",
    href: "/notes",
    prompt: "What does the Notes page do?",
    description: "Keeps personal notes and pinned references inside the app.",
    keywords: ["notes", "note"],
  },
  {
    id: "reminders",
    title: "Reminders",
    href: "/reminders",
    prompt: "What does the Reminders page do?",
    description: "Tracks deadlines, recurring reminders, and exports events to calendar.",
    keywords: ["reminders", "reminder", "deadlines", "calendar"],
  },
  {
    id: "settings",
    title: "Settings",
    href: "/settings",
    prompt: "What can I change in Settings?",
    description: "Manages profile, categories, budget behavior, goal defaults, notifications, privacy, and safety options.",
    keywords: ["settings", "profile", "privacy", "security"],
  },
];

export const LOCAL_ASSISTANT_PROMPT_GROUPS: AssistantPromptGroup[] = [
  {
    title: "Ask About The App",
    prompts: [
      { id: "app-overview", label: "What does this app do?", message: "What does this app do?" },
      { id: "start", label: "How do I start using it?", message: "How do I start using this app?" },
      { id: "setup-budget", label: "How do I set up a budget?", message: "How do I set up a budget?" },
      { id: "setup-goals", label: "How do I set goals?", message: "How do I set goals?" },
      { id: "make-transaction", label: "How do I make a transaction?", message: "How do I make a transaction?" },
      { id: "budget-vs-track", label: "Budget vs Transactions", message: "What is the difference between Budget and Transactions?" },
      { id: "goals-work", label: "How goals work", message: "How do goals work in this app?" },
    ],
  },
  {
    title: "Read My Data",
    prompts: [
      { id: "month-summary", label: "Analyze my month", message: "Analyze my month" },
      { id: "budget-status", label: "Budget status", message: "What is my budget status?" },
      { id: "spend", label: "Top spend", message: "Where am I overspending?" },
      { id: "focus", label: "Next focus", message: "What should I focus on next?" },
    ],
  },
  {
    title: "Common Tasks",
    prompts: [
      { id: "add-income", label: "Add income", message: "How do I add income?" },
      { id: "add-savings", label: "Add savings", message: "How do I add savings?" },
      { id: "goal-room", label: "Goal room", message: "How much room do I have for goals?" },
      { id: "data-source", label: "What data do you use?", message: "What data do you use?" },
    ],
  },
  {
    title: "Support & Feedback",
    prompts: [
      { id: "report-bug", label: "Report a bug", message: "Something is not working. I want to report a bug." },
      { id: "send-complaint", label: "Send complaint", message: "I have a complaint about the app." },
      { id: "feature-request", label: "Feature request", message: "I want to send a feature request." },
      { id: "need-support", label: "Need support", message: "I need support with this app." },
    ],
  },
];

function toMoney(value: number, currency: string, fxRate: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value * fxRate);
}

function toShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function promptMessages(ids: string[]) {
  const lookup = new Map(LOCAL_ASSISTANT_PROMPT_GROUPS.flatMap((group) => group.prompts.map((prompt) => [prompt.id, prompt.message])));
  return ids.map((id) => lookup.get(id)).filter((item): item is string => Boolean(item));
}

function fundingSourceLabel(value: "SAVINGS_ONLY" | "SAVINGS_PLUS_SURPLUS" | "SURPLUS_ONLY") {
  if (value === "SAVINGS_ONLY") return "Savings only";
  if (value === "SURPLUS_ONLY") return "Surplus only";
  return "Savings + surplus";
}

function detectFeedbackCategory(normalized: string): AssistantFeedbackCategory {
  if (hasAny(normalized, ["bug", "broken", "not working", "error", "issue", "problem", "glitch", "fix"])) {
    return "BUG";
  }
  if (hasAny(normalized, ["feature", "request", "improve", "suggestion", "add this", "enhancement"])) {
    return "FEATURE";
  }
  if (hasAny(normalized, ["support", "help me", "need help", "assist me"])) {
    return "SUPPORT";
  }
  if (hasAny(normalized, ["complaint", "complain", "frustrated", "bad experience", "unhappy"])) {
    return "COMPLAINT";
  }
  return "OTHER";
}

function defaultFeedbackSubject(category: AssistantFeedbackCategory) {
  switch (category) {
    case "BUG":
      return "Assistant bug report";
    case "FEATURE":
      return "Assistant feature request";
    case "SUPPORT":
      return "Assistant support request";
    case "OTHER":
      return "Assistant feedback";
    case "COMPLAINT":
    default:
      return "Assistant complaint";
  }
}

function buildFocusText(context: LocalAssistantContext) {
  const money = (value: number) => toMoney(value, context.currency, context.fxRate);

  if (context.availableBalance < 0) {
    return `Main fix: close the ${money(Math.abs(context.availableBalance))} cash-flow gap before new discretionary spending.`;
  }
  if (context.biggestBudgetGap && context.biggestBudgetGap.remaining < 0) {
    return `Main fix: ${context.biggestBudgetGap.category} is over plan by ${money(Math.abs(context.biggestBudgetGap.remaining))}.`;
  }
  if (context.reminders[0]) {
    return `Main fix: handle ${context.reminders[0].title} due ${toShortDate(context.reminders[0].dueAt)}.`;
  }
  if (context.goalPlan) {
    const goalRoom =
      context.goalPlan.fundingSource === "SAVINGS_ONLY"
        ? context.goalPlan.availableSavingsForGoals
        : context.goalPlan.availableSavingsForGoals + context.goalPlan.availableSurplusForGoals;
    if (goalRoom > 0) {
      return `Main fix: you can move up to ${money(goalRoom)} toward goals now if that is the current priority.`;
    }
  }
  return `Main fix: keep actual use inside the remaining ${money(Math.max(0, context.budgetRemaining))} budget room.`;
}

function buildMonthlySummary(context: LocalAssistantContext) {
  const money = (value: number) => toMoney(value, context.currency, context.fxRate);
  const topSpend = context.topSpend
    ? `${context.topSpend.category} is your biggest expense category at ${money(context.topSpend.spent)}.`
    : "You do not have enough expense history yet to rank a top spend category.";

  return [
    `For ${context.windowLabel}, actual net cash flow is ${money(context.net)}.`,
    `${money(context.income)} income, ${money(context.expenses)} expenses, and ${money(context.savings)} moved to savings.`,
    `Planned expense budget used is ${context.budgetStatusPct.toFixed(0)}% with ${money(context.budgetRemaining)} remaining against ${money(context.budgeted)} planned.`,
    `${topSpend} ${context.moneyGist}`,
    buildFocusText(context),
  ].join("\n\n");
}

function buildPageGuideReply(page: AssistantPageGuide) {
  if (page.id === "transactions") {
    return `${page.title} is the daily capture page.\n\nUse it to log income, expenses, and extra savings. What you record there updates the real numbers on Dashboard, Budget progress, and Goal affordability.`;
  }

  if (page.id === "goals") {
    return `${page.title} turns savings into target plans.\n\nUse it to set target amounts, track progress, and see whether available savings or surplus can fund a goal now or over time.`;
  }

  if (page.id === "budget") {
    return `${page.title} is the plan-first page.\n\nUse it to review baseline income, outgoing, savings, and category targets before real transactions arrive.`;
  }

  return `${page.title} page:\n\n${page.description}`;
}

export function buildOpeningReplies(_context: LocalAssistantContext): LocalAssistantReply[] {

  return [
    {
      content:
        "Hi! I'm your personal finance assistant. I can help you understand your budget, track your money, set savings goals, and make the most of the app.\n\nAsk me anything — how to set up your budget, what your numbers mean, or where to go next.",
      suggestions: promptMessages(["app-overview", "setup-budget", "setup-goals", "make-transaction"]),
    },
  ];
}

export function resolveLocalAssistantReply(question: string, context: LocalAssistantContext): LocalAssistantReply {
  const normalized = normalize(question);
  const money = (value: number) => toMoney(value, context.currency, context.fxRate);
  const nextReminder = context.reminders[0];
  const latestTransaction = context.recent[0];
  const pageIntent = hasAny(normalized, ["page", "screen", "tab", "section", "where do i go", "how do i use", "what does"]);
  const pageGuide =
    pageIntent
      ? LOCAL_ASSISTANT_PAGE_GUIDES.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)))
      : null;

  if (!normalized) {
    return {
      content: "Ask about how the app works or ask me to read your current budget data.",
      suggestions: promptMessages(["app-overview", "month-summary", "budget-vs-track", "focus"]),
    };
  }

  if (hasAny(normalized, ["hello", "hi", "hey", "good morning", "good evening"])) {
    return {
      content: "Ask me about the app, a page, or your current money data.",
      suggestions: promptMessages(["app-overview", "month-summary", "add-income", "goals-work"]),
    };
  }

  if (hasAny(normalized, ["thank you", "thanks"])) {
    return {
      content: "Ask another app or money question any time.",
      suggestions: promptMessages(["budget-status", "focus", "goal-room"]),
    };
  }

  if (hasAny(normalized, ["external ai", "ai api", "openai", "anthropic", "api", "what data do you use", "data source", "privacy"])) {
    return {
      content: `This page answers locally. It uses built-in app guidance plus your live Prisma-backed dashboard and goals data.\n\nI read your actual transactions, budget totals, goals, reminders, and note counts for this signed-in account. I do not need an external AI API to answer these common questions.`,
      suggestions: promptMessages(["app-overview", "month-summary", "goal-room"]),
    };
  }

  if (hasAny(normalized, ["complaint", "complain", "bug", "broken", "not working", "issue", "problem", "feedback", "feature request", "support request", "report this", "frustrated"])) {
    const category = detectFeedbackCategory(normalized);
    return {
      content: `I can help explain the app, and I can also send this straight to the admin inbox.\n\nUse the feedback panel on this page to submit your ${assistantFeedbackCategoryLabel(category).toLowerCase()}. I will prefill it from what you just said so the admin team can review it quickly.`,
      suggestions: promptMessages(["report-bug", "send-complaint", "feature-request", "need-support"]),
      feedback: {
        category,
        subject: defaultFeedbackSubject(category),
        message: question.trim(),
      },
    };
  }

  if (pageGuide) {
    return {
      content: buildPageGuideReply(pageGuide),
      suggestions: [pageGuide.prompt, "What is the difference between Budget and Transactions?"],
    };
  }

  if (hasAny(normalized, ["what does this app do", "what is this app", "how does this app work", "what can this app do", "what can you do", "overview", "explain the app"])) {
    return {
      content:
        "MyplanMybudget is a plan-first personal finance app built by EyeHai Technologies.\n\nHere is what every section does:\n\n📊 Dashboard — your live financial overview. Shows real net cash flow from logged transactions, planned expense budget use, cashflow chart with hover details, and category-by-category budget breakdown.\n\n💰 Budget — set your monthly income, expense, and savings plan. Cards show your planned amounts vs what you have actually logged. The \"Daily Flex Room\" tells you how much of your surplus you can spend per remaining day.\n\n💸 Transactions — log income, expenses, and savings contributions. Every entry feeds the Dashboard and Budget pages immediately.\n\n🎯 Goals — create savings targets with deadlines. Track daily progress toward each goal and see how close you are.\n\n🔬 Simulate — run what-if scenarios on a safe sandbox copy of your plan. Test a new expense or income change before it affects your real data.\n\n🤖 Assistant (this page) — ask questions about your budget, your numbers, or how any page works. I read your live data, explain the app, and can route complaints or feedback to admin.\n\n📝 Notes — capture financial decisions, budget rationale, and follow-up thoughts inside the app.\n\n🔔 Reminders — set due dates for bills, savings transfers, or any financial event. The Dashboard shows what is due in the next 7 days.",
      suggestions: promptMessages(["start", "budget-vs-track", "goals-work", "month-summary"]),
    };
  }

  if (hasAny(normalized, ["how do i start", "getting started", "first step", "new here", "how to use this app", "start using"])) {
    return {
      content:
        "Best flow:\n\n1. Review Budget to confirm the monthly baseline.\n2. Use Transactions to log income, expense, or extra savings as money happens.\n3. Check Dashboard to see actual cash flow and budget use.\n4. Use Goals when you want to turn savings or surplus into a target.\n5. Use Simulate before changing the real plan.",
      suggestions: promptMessages(["budget-vs-track", "add-income", "add-savings", "month-summary"]),
    };
  }

  if (hasAny(normalized, ["how do i set up a budget", "set up a budget", "set up budget", "setup a budget", "setup budget", "create a budget", "create budget"])) {
    return {
      content:
        "Setting up your budget takes about 2 minutes:\n\n1. Go to **Settings → Budget & Currency** from the sidebar.\n2. Enter your monthly income — the amount you expect to earn each month.\n3. Set your monthly expenses — your regular spending like rent, food, transport, and bills.\n4. Set your monthly savings — how much you want to put aside each month.\n5. Add specific expense categories so the Budget page can track each area.\n\nOnce saved, your budget is live. Head to the **Budget** page to see your plan vs what you have actually logged. Add transactions on the **Transactions** page to start tracking real spending.",
      suggestions: promptMessages(["make-transaction", "setup-goals", "budget-vs-track"]),
    };
  }

  if (hasAny(normalized, ["how do i set goals", "set goals", "set a goal", "create a goal", "setup goals", "how do goals work", "saving goals", "savings goal"])) {
    return {
      content:
        "Creating a savings goal is simple:\n\n1. Open the **Goals** page from the sidebar.\n2. Tap **Create goal** and give it a name — for example, \"New laptop\" or \"Holiday trip\".\n3. Enter the target amount you want to save.\n4. Optionally add a due date so the app can calculate how much you need to save per month.\n5. Save the goal.\n\nThe app will then show you:\n- Your progress so far\n- Whether your current savings and surplus can fund the goal\n- A monthly savings recommendation\n\nYou can update your progress anytime from the Goals page.",
      suggestions: promptMessages(["setup-budget", "goal-room", "goals-work"]),
    };
  }

  if (hasAny(normalized, ["how do i make a transaction", "make a transaction", "add a transaction", "log a transaction", "how do i add", "log money", "record a payment"])) {
    return {
      content:
        "Logging a transaction keeps your budget accurate:\n\n1. Open the **Transactions** page from the sidebar.\n2. Choose the type:\n   - **Income** — money coming in (salary, freelance, etc.)\n   - **Expense** — money going out on a planned category\n   - **Extra expense** — unplanned spending outside your budget\n   - **Extra savings** — extra money you moved to savings\n3. Enter the amount, pick a category, add an optional note, and choose the date.\n4. Tap **Save**.\n\nYour Dashboard and Budget page will update immediately to reflect the new entry. Every transaction shapes your real net balance.",
      suggestions: promptMessages(["setup-budget", "add-income", "add-savings"]),
    };
  }

  if (
    hasAny(normalized, ["difference"]) &&
    hasAny(normalized, ["budget"]) &&
    hasAny(normalized, ["transactions", "transaction", "track"])
  ) {
    return {
      content:
        "Budget is the plan. Transactions is the real log.\n\nBudget says what the month should look like. Transactions records what actually happened. Dashboard compares those two views. Goals uses available savings and surplus, and Simulate is a sandbox that does not write back to live data.",
      suggestions: promptMessages(["month-summary", "add-income", "goals-work"]),
    };
  }

  if (hasAny(normalized, ["add income", "log income", "where do i add income"])) {
    return {
      content:
        "Open Transactions and choose Add income.\n\nStep 1 is amount. Step 2 is note and date. Step 3 confirms that the entry is treated as extra income and added to your live balance.",
      suggestions: promptMessages(["add-savings", "budget-vs-track", "month-summary"]),
    };
  }

  if (hasAny(normalized, ["add savings", "extra savings", "where do i add savings", "log savings"])) {
    return {
      content:
        "Open Transactions and choose Add expense or savings.\n\nPick Extra savings, choose the savings category, then add the note and date. That logs money moved aside without mixing it into normal expense spending.",
      suggestions: promptMessages(["add-income", "goals-work", "goal-room"]),
    };
  }

  if (hasAny(normalized, ["add expense", "log expense", "where do i add expense"])) {
    return {
      content:
        "Open Transactions and choose Add expense or savings.\n\nPick Expense for planned spending or Extra expense for off-budget spend, then enter the category, note, and date.",
      suggestions: promptMessages(["add-income", "budget-vs-track", "month-summary"]),
    };
  }

  if (hasAny(normalized, ["baseline surplus"])) {
    const baseValue = context.goalPlan?.baselineSurplus ?? 0;
    return {
      content: `Baseline surplus means baseline income minus baseline outgoing.\n\nRight now that baseline surplus is ${money(baseValue)} per month before any extra income or extra expense is applied.`,
      suggestions: promptMessages(["goal-room", "budget-status"]),
    };
  }

  if (hasAny(normalized, ["base outgoing", "baseline outgoing"])) {
    const baseValue = context.goalPlan?.baselineOutgoing ?? 0;
    return {
      content: `Baseline outgoing is your planned baseline expense plus planned baseline savings.\n\nRight now that total is ${money(baseValue)} per month.`,
      suggestions: promptMessages(["budget-status", "goal-room"]),
    };
  }

  if (hasAny(normalized, ["available for goals", "goals per month", "goal room"])) {
    if (!context.goalPlan) {
      return {
        content: "Goal-planning data is not available right now, but this metric normally comes from your baseline surplus adjusted by extra income and extra expense pace.",
        suggestions: promptMessages(["goals-work", "month-summary"]),
      };
    }
    return {
      content: `Available for goals per month is ${money(context.goalPlan.availableForGoalsMonthly)}.\n\nFormula: baseline surplus + projected extra income pace - projected extra expense pace.`,
      suggestions: promptMessages(["goals-work", "budget-status", "focus"]),
    };
  }

  if (hasAny(normalized, ["savings available"])) {
    if (!context.goalPlan) {
      return {
        content: "Savings-available data is not available right now.",
        suggestions: promptMessages(["goals-work", "month-summary"]),
      };
    }
    return {
      content: `Savings available for goals is ${money(context.goalPlan.availableSavingsForGoals)}.\n\nFormula: baseline savings + extra savings already logged - goal money already assigned.`,
      suggestions: promptMessages(["goal-room", "goals-work"]),
    };
  }

  if (hasAny(normalized, ["surplus available"])) {
    if (!context.goalPlan) {
      return {
        content: "Surplus-available data is not available right now.",
        suggestions: promptMessages(["goals-work", "month-summary"]),
      };
    }
    return {
      content: `Surplus available for goals is ${money(context.goalPlan.availableSurplusForGoals)}.\n\nThat is the live leftover from baseline surplus plus extra income minus extra expense.`,
      suggestions: promptMessages(["goal-room", "budget-status"]),
    };
  }

  if (hasAny(normalized, ["budget used"])) {
    return {
      content: `Budget used compares logged planned expenses against your planned expense budget for this window.\n\nExtra expense reduces surplus and live balance, but it does not consume the planned budget pot. Right now you have used ${money(context.used)} of ${money(context.budgeted)}, which is ${context.budgetStatusPct.toFixed(0)}%.`,
      suggestions: promptMessages(["month-summary", "spend", "focus"]),
    };
  }

  if (hasAny(normalized, ["savings rate"])) {
    return {
      content: `Savings rate uses your budgeted savings pace plus extra savings logged.\n\nRight now the rate is ${context.savingsRatePct.toFixed(1)}%, based on ${money(context.plannedSavings)} planned savings and ${money(context.savings)} extra savings in ${context.windowLabel}.`,
      suggestions: promptMessages(["month-summary", "goal-room"]),
    };
  }

  if (hasAny(normalized, ["analyze", "analysis", "summary", "how am i doing", "review my month", "month summary", "status"])) {
    return {
      content: buildMonthlySummary(context),
      suggestions: promptMessages(["budget-status", "spend", "focus", "goal-room"]),
    };
  }

  if (hasAny(normalized, ["balance", "cash flow", "net", "available money", "live balance"])) {
    return {
      content: `Available balance for ${context.windowLabel} is ${money(context.availableBalance)}.\n\nThat is built from actual income ${money(context.income)} minus actual expenses ${money(context.expenses)} and actual savings ${money(context.savings)}.`,
      suggestions: promptMessages(["month-summary", "budget-status", "focus"]),
    };
  }

  if (hasAny(normalized, ["budget status", "budget remaining", "remaining budget", "am i on budget"])) {
    return {
      content: `Budget status: ${context.budgetStatusPct.toFixed(0)}% of planned expense budget used.\n\nYou have used ${money(context.used)} of ${money(context.budgeted)} planned, leaving ${money(context.budgetRemaining)} for the current window. Extra expense sits outside that budget and hits surplus instead.`,
      suggestions: promptMessages(["spend", "focus", "month-summary"]),
    };
  }

  if (hasAny(normalized, ["overspend", "overspending", "spending too much", "top spend", "top spending", "where am i overspending"])) {
    if (context.biggestBudgetGap && context.biggestBudgetGap.remaining < 0) {
      return {
        content: `${context.biggestBudgetGap.category} is your main overspend point right now at ${money(Math.abs(context.biggestBudgetGap.remaining))} over plan.\n\n${context.topSpend ? `${context.topSpend.category} is also your biggest raw expense category at ${money(context.topSpend.spent)}.` : ""}`.trim(),
        suggestions: promptMessages(["budget-status", "focus", "month-summary"]),
      };
    }
    if (context.topSpend) {
      return {
        content: `You are not over a category plan right now, but ${context.topSpend.category} is still your biggest expense category at ${money(context.topSpend.spent)}.`,
        suggestions: promptMessages(["budget-status", "focus"]),
      };
    }
    return {
      content: "I do not have enough expense activity yet to point to an overspend category.",
      suggestions: promptMessages(["month-summary", "budget-status"]),
    };
  }

  if (hasAny(normalized, ["saved", "savings", "how much have i saved"])) {
    return {
      content: `You have logged ${money(context.savings)} as extra savings in ${context.windowLabel}.\n\nCombined with your budgeted savings pace, that puts your savings rate at ${context.savingsRatePct.toFixed(1)}%.`,
      suggestions: promptMessages(["goal-room", "month-summary", "budget-status"]),
    };
  }

  if (hasAny(normalized, ["goal", "goals", "funding source", "goal funding"])) {
    if (!context.goalPlan) {
      return {
        content: "Goals data is not available right now, but goals normally use Savings only or Savings + surplus as the funding source.",
        suggestions: promptMessages(["goals-work", "goal-room"]),
      };
    }
    const nowAvailable =
      context.goalPlan.fundingSource === "SAVINGS_ONLY"
        ? context.goalPlan.availableSavingsForGoals
        : context.goalPlan.availableSavingsForGoals + context.goalPlan.availableSurplusForGoals;
    return {
      content:
        `Goal funding is currently set to ${fundingSourceLabel(context.goalPlan.fundingSource)}.\n\n` +
        `${money(context.goalPlan.availableSavingsForGoals)} is available from savings, ${money(context.goalPlan.availableSurplusForGoals)} is available from surplus, and ${money(nowAvailable)} is available now under your current funding rule.\n\n` +
        `${context.goalSummary.count} goal${context.goalSummary.count === 1 ? "" : "s"} in total, ${context.goalSummary.completed} completed, ${context.goalSummary.averageProgressPct.toFixed(0)}% average progress.`,
      suggestions: promptMessages(["goal-room", "focus", "month-summary"]),
    };
  }

  if (hasAny(normalized, ["reminder", "reminders", "deadline", "due"])) {
    return {
      content: nextReminder
        ? `You have ${context.openReminderCount} open reminder${context.openReminderCount === 1 ? "" : "s"}. Next open reminder is ${nextReminder.title} due ${toShortDate(nextReminder.dueAt)}.`
        : "You have no open reminders right now.",
      suggestions: promptMessages(["focus", "month-summary"]),
    };
  }

  if (hasAny(normalized, ["notes", "note"])) {
    return {
      content: `You currently have ${context.noteCount} saved note${context.noteCount === 1 ? "" : "s"} in the app.\n\nUse Notes for references, plans, or decisions you want to keep alongside your budget data.`,
      suggestions: promptMessages(["app-overview", "focus"]),
    };
  }

  if (hasAny(normalized, ["recent transaction", "latest transaction", "last transaction"])) {
    return {
      content: latestTransaction
        ? `Latest transaction: ${latestTransaction.label} on ${toShortDate(latestTransaction.occurredAt)}.`
        : "No transactions are available yet.",
      suggestions: promptMessages(["month-summary", "budget-status"]),
    };
  }

  if (hasAny(normalized, ["focus", "priority", "next step", "what should i do"])) {
    return {
      content: buildFocusText(context),
      suggestions: promptMessages(["month-summary", "spend", "goal-room"]),
    };
  }

  if (hasAny(normalized, ["what pages", "what sections", "navigation"])) {
    return {
      content: `Main pages:\n\n${LOCAL_ASSISTANT_PAGE_GUIDES.map((item) => `- ${item.title}: ${item.description}`).join("\n")}`,
      suggestions: LOCAL_ASSISTANT_PAGE_GUIDES.slice(0, 4).map((item) => item.prompt),
    };
  }

  return {
    content:
      "I can answer app-use questions, explain the budget terms on screen, and read your current month from live data.\n\nTry one of the guided prompts below if you want a quick starting point.",
    suggestions: promptMessages(["app-overview", "budget-vs-track", "month-summary", "goal-room"]),
  };
}
