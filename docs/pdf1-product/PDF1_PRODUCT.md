# MyplanMybudget Product & UX Specification
Version: 0.2
Updated: 2026-02-20
Role: PDF1-PRODUCT

## 1. Product Vision
MyplanMybudget is a click-first budgeting web app for users who want fast planning and safe, predictable money workflows.

Core promises:
- Simple: guided setup with templates and fast forms.
- Visual: dashboard charts for cashflow and trend review.
- Safe-feeling: explicit export controls and destructive-action confirmation.
- Sandbox-first: scenario simulation before applying changes.

Non-goals for this version:
- Bank account linking.
- Investment/trading workflows.
- Double-entry accounting complexity.

## 2. Target Users
- Starter Saver: wants a guided first budget.
- Busy Worker: needs quick capture and clear monthly summary.
- Planner Nerd: wants simulation controls and comparison-ready outputs.

## 3. Information Architecture
Primary navigation:
- Dashboard
- Budgets
- Transactions
- Simulations
- Notes
- Settings

Global actions:
- Add expense
- Add income
- Add note
- New simulation
- Export

## 4. Core User Flows
Auth:
- Email/password signup and login.
- Signed cookie session.

Onboarding wizard:
- Step 1: currency and cycle start.
- Step 2: template selection.
- Step 3: categories and optional goal.

Daily capture:
- Add expense with amount, category, memo, date.
- Optional recurring rule creation.

Monthly review:
- End-of-month review CTA from dashboard.

Simulation flow:
- Start from baseline income/expense.
- Tune sliders for assumptions.
- Save/compare/apply with explicit confirmation.

## 5. Screen Inventory Status
Implemented now:
- Auth page with login/signup tabs.
- Onboarding wizard.
- Dashboard with dynamic cards, trend chart, recent activity.
- Budgets with editable category limits and progress bars.
- Transactions with add form, filters UI, recent log.
- Simulation sandbox with sliders and line chart.
- Notes and reminders board.
- Settings with re-auth gate and export links.

## 6. Security and Trust Rules
- Protected routes via middleware.
- Server-side auth checks for data reads/writes.
- Re-auth requirement for export APIs.
- Explicit danger zone actions in settings.

## 7. Accessibility and UX Rules
- Keyboard-accessible forms and controls.
- Primary action visible on every key page.
- Empty states prompt immediate next action.
- Post-save hints guide the next step.

## 8. Design Tokens (Current)
- Primary: #111827
- Accent: #2563eb
- Success: #16a34a
- Warning: #f59e0b
- Danger: #dc2626
- Radius: 2xl
- Spacing scale: 8 / 12 / 16 / 24

## 9. Known Runtime Note (Current Environment)
In this offline environment, Prisma engine downloads are unavailable. A local Prisma-compatible shim is used for runtime continuity and demo flow validation.

## 10. Definition of Done for PDF1-PRODUCT
Done when:
- All core screens exist and are navigable.
- Auth + protected routes are enforced.
- Dashboard, transactions, notes, reminders, and simulations are data-backed.
- Export and re-auth controls are present.
- Product spec is regenerated from this markdown source.
