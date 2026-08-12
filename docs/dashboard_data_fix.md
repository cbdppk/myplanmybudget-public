# Dashboard Data Fix — Root Cause Analysis

**Date:** 2026-03-09
**Status:** Pre-fix analysis — DO NOT start coding until this is reviewed

---

## The Core Problem

The dashboard mixes **projected/planned baseline numbers** with **actual transaction data** and adds them together. Users see inflated income, expenses, and savings that don't match what they actually logged. This breaks trust in the whole dashboard.

---

## Bug 1 — Income, Expenses, Savings are WRONG

**File:** `lib/data/dashboard.ts` lines 160–163

```typescript
// CURRENT (broken)
const income  = baselineIncomeWindow  + rangeIncome;    // projected + actual
const expenses = baselineExpenseWindow + rangeExpense;   // projected + actual
const savings  = baselineSavingsWindow + rangeExtraSavings; // projected + actual
const net = income - expenses - savings;
```

**What the user sees:**
- User sets baselineIncome = GHS 5,000/month
- It is day 10 of 30 — they have logged ZERO income transactions
- Dashboard shows Income = GHS 1,667 (prorated baseline)
- User says: "I haven't received anything yet — why does it show 1,667?"

**What should happen:**
- Income = GHS 0 (actual)
- Planned income = GHS 1,667 (shown as grey reference, not the main figure)

**Fix:** Split into `actual` and `planned` figures. Actuals are the main card values.

```typescript
// CORRECT
const income   = rangeIncome;          // ACTUAL transactions only
const expenses = rangeExpense;         // ACTUAL transactions only
const savings  = rangeExtraSavings;    // ACTUAL transactions only
const net      = income - expenses - savings;  // real cash flow

// These become reference/context shown smaller under each card
const plannedIncome   = baselineIncomeWindow;
const plannedExpenses = baselineExpenseWindow;
const plannedSavings  = baselineSavingsWindow;
```

---

## Bug 2 — `moneyStatus` Formula is Misleading

**File:** `lib/data/dashboard.ts` lines 315–317

```typescript
// CURRENT (confusing)
const baselineNet  = baselineIncomeWindow - baselineExpenseWindow - baselineSavingsWindow;
const extraNet     = rangeIncome - rangeExpense - rangeExtraSavings;
const moneyStatus  = baselineNet + extraNet + carryForward;
```

**What the user sees on page:**
`GHS 2,340 + GHS −80 = GHS 2,260`

User has only logged GHS 80 of actual expenses and NO income. But the card shows a positive GHS 2,260 "Money Status" because the baseline projection dominates. They think they have money — they don't. They just haven't spent much yet.

**Fix:** `moneyStatus` should be the actual net flow only, carryForward added on ROLLING mode:

```typescript
const moneyStatus = net + carryForward;  // net is actual only after Bug 1 fix
```

The breakdown formula text on the card (`baselineNet + extraNet`) is also confusing for users and should be removed from the UI.

---

## Bug 3 — `budgetByCategory.spent` Adds Ghost Baseline Usage

**File:** `lib/data/dashboard.ts` lines 197–212

```typescript
// CURRENT (broken)
const baselineUsed = baselineByCategoryMap.get(item.categoryId) ?? 0;  // prorated target portion
const extras       = spentMap.get(item.categoryId) ?? 0;                // actual spending
const spent        = baselineUsed + extras;  // WRONG: imaginary + real
const remaining    = target - spent;
```

**Example:**
- User budgeted GHS 300 for "Food"
- User has only spent GHS 50 on food this month
- Dashboard shows: spent = GHS 100 (prorated 10/30 days) + GHS 50 = GHS 150, remaining = GHS 150
- Reality: remaining should be GHS 250 (300 - 50 actual)

**Fix:** Budget category `spent` should only be actual transactions:

```typescript
const spent     = spentMap.get(item.categoryId) ?? 0;  // actual only
const remaining = target - spent;
```

---

## Bug 4 — `used` (Budget Used %) Mixes Projected + Actual

**File:** `lib/data/dashboard.ts` line 188

```typescript
// CURRENT (confusing)
const used = round2(baselineExpenseWindow + baselineSavingsWindow + rangeExpense + rangeExtraSavings);
```

Budget Used % = `used / budgeted`. But `used` includes projected consumption, not just actual. On day 10 with zero transactions, it shows 33% used — even though the user has spent NOTHING.

**Fix:**

```typescript
const used = round2(expenses + savings);  // actual spending only (after Bug 1 fix)
```

Now Budget Used = "Of your GHS 3,000 budget, you have actually spent GHS 800 = 27%."
This is honest and actionable.

---

## Bug 5 — `savingsRatePct` Uses Inflated Figures

**File:** `lib/data/dashboard.ts` line 325

```typescript
const savingsRatePct = income > 0 ? Math.round((savings / income) * 1000) / 10 : 0;
```

With the current inflated `income` and `savings`, the rate might look reasonable but it's based on ghost numbers. After Bug 1 fix, if actual income = 0 and actual savings = 0, rate = 0% which is correctly honest.

**Fix:** No code change needed — automatically correct after Bug 1 fix. But add a guard:
- If actualIncome = 0 AND actualSavings = 0 → show "No data yet" instead of 0%

---

## Bug 6 — `emergencyFundTarget = expenses * 3` Is Wrong When expenses = 0

**File:** `lib/data/dashboard.ts` line 326

With actual expenses = 0 (new user, no transactions), `emergencyFundTarget = 0` and the money lesson says:
> "Create a baseline monthly expense history first to estimate your emergency buffer."

This is fine text but should use `plannedExpenses` as fallback when actual expenses = 0:

```typescript
const emergencyFundTarget = round2((expenses > 0 ? expenses : plannedExpenses) * 3);
```

---

## Bug 7 — `moneyGist` and Money Lessons Use Inflated Numbers

**File:** `lib/data/dashboard.ts` lines 318–370

All the lesson thresholds compare against `income`, `expenses`, `savings` which are currently inflated. After Bug 1 fix they will use actuals, which is correct.

The `extraIncomeNeeded = max(0, expenses + savings - income)` also naturally becomes correct after Bug 1.

One additional fix: the "Income Gap Plan" lesson currently may always show "good" even when the user is actually not earning anything, because the inflated income >= expenses. After Bug 1 fix, if income=0 and expenses > 0 it will correctly flag as warning.

---

## Bug 8 — Dashboard Page Shows Formula Internals to User

**File:** `app/dashboard/page.tsx` lines 258–261

```tsx
{money(data.moneyStatusBreakdown.baselineNet)} + {money(data.moneyStatusBreakdown.extraNet)}
{view === "ROLLING" ? ` + ${money(data.moneyStatusBreakdown.carryForward)}` : ""}
```

Users don't understand `baselineNet + extraNet`. This is an internal formula, not a user-facing concept. Remove this from the UI entirely.

Also, "Assumes daily baseline depletion plus extra transactions" is developer language. Remove it.

---

## Dashboard Page Layout Issues

1. **Three separate income/expense/savings cards** with no net — user has to do mental math
2. **Net cash flow** is buried in "Money Status" with confusing formula
3. **"Money Status" card title** means nothing to a user — should say "Cash Flow" or "Net Balance"
4. **Budget Used card** has a footnote "Assumes daily baseline depletion plus extra transactions" — confusing and should be removed after the fix
5. **No clear "are you on track?" indicator** at a glance — users have to read multiple cards

---

## Proposed New Layout

```
┌─── Filter bar: weekly / monthly / yearly ────────────────────────┐

┌─── Net Cash Flow ─────────────────────────────────────────────────┐
│  Big number: income − expenses − savings (ACTUAL)                 │
│  Positive = green, Negative = red                                 │
│  Sub-line: "GHS 3,200 in · GHS 1,800 out · GHS 300 saved"       │
│  If ROLLING: shows + carryForward                                 │
└───────────────────────────────────────────────────────────────────┘

┌─── Income ────┐  ┌─── Expenses ──┐  ┌─── Savings ───┐
│  GHS 3,200    │  │  GHS 1,800    │  │  GHS 300      │
│  Plan: 4,000  │  │  Plan: 2,000  │  │  Plan: 500    │
│  (grey small) │  │  (grey small) │  │  (grey small) │
└───────────────┘  └───────────────┘  └───────────────┘

┌─── Budget Used ──────────────────────────────────────────────────┐
│  ████████░░░░░░░░░  43%                                          │
│  GHS 2,100 spent of GHS 4,900 planned · GHS 2,800 remaining     │
└───────────────────────────────────────────────────────────────────┘

┌─── Burn Rate ─────────┐  ┌─── Top Spend ─────────────────────────┐
│  GHS 180/day          │  │  Food · GHS 820                       │
│  avg daily spend      │  │  Biggest category this window         │
└───────────────────────┘  └───────────────────────────────────────┘

[ Cashflow chart ]  [ Budget by category ]
[ Category spend ]
[ Recent transactions ]  [ Goals & reminders ]
```

---

## Files to Change

| File | What to fix |
|------|-------------|
| `lib/data/dashboard.ts` | Bug 1, 2, 3, 4, 5, 6, 7 — data calculations |
| `app/dashboard/page.tsx` | Bug 8 + layout redesign per above |

### dashboard.ts changes summary
- Lines 160–163: change income/expenses/savings to actual-only
- Add `plannedIncome`, `plannedExpenses`, `plannedSavings` to return
- Line 188: fix `used` to be actual only
- Lines 197–212: fix `budgetByCategory.spent` to actual only
- Lines 315–317: fix `moneyStatus` to `net + carryForward`
- Line 326: fix `emergencyFundTarget` fallback
- Return: add `budgetRemaining = budgeted - used`

### dashboard page changes summary
- Replace the 3-card Income/Expenses/Savings + Money Status section with:
  - 1 big Net Cash Flow card
  - 3 smaller actual cards with planned shown as reference
  - 1 honest Budget Used progress bar
  - Burn rate + Top Spend in a row
- Remove formula internals (`baselineNet + extraNet`) from UI
- Remove developer-language footnotes
