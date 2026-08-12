# MyplanMybudget Project Status

Last updated: **2026-08-08**
Owner: Product + Engineering

## 1) Project Snapshot

MyplanMybudget is a Next.js App Router budgeting app with:
- Guided onboarding and auth
- Plan/track/simulate workflows
- Notes and reminders
- Export + re-auth safety controls
- Progressive hardening work (CSP enforced, PWA baseline)

Current maturity: **MVP+ (functional core complete, deep-research enhancements mostly implemented, production hardening pending)**

## 2) Tech Stack

- Framework: Next.js 15 (App Router, Server Actions)
- Language: TypeScript
- Data: Prisma + Postgres
- UI: Tailwind + custom/shadcn-style components
- Auth: custom signed-cookie session + re-auth cookie window
- Testing: Node test runner (`node --test`) for simulation logic

## 3) Current Functional Surface

### Core routes
- `/dashboard`
- `/plan` (+ alias `/budgets`)
- `/track` (+ alias `/transactions`)
- `/simulate` (+ alias `/simulations`)
- `/notes`
- `/reminders`
- `/settings`
- `/admin`
- `/auth` (+ aliases `/login`, `/signup`)

### Implemented capabilities
- Budget targets by category + month
- Quick transaction capture + recurring rule creation
- Dashboard totals + budget usage + burn-rate + due-soon reminders
- Simulation sandbox with deterministic timeline and debt strategy controls
- Notes/reminders CRUD basics
- CSV and JSON exports gated by recent re-auth
- Admin controls for role assignment and account activation/deactivation
- Security baseline headers and middleware protected routes
- PWA baseline manifest + service-worker registration

## 4) Architecture Status

### Done
- Repository/data access layer in `lib/data/*`
- Server Action mutation pattern across major features
- Deterministic simulation engine in `lib/sim/engine.ts`
- Build/test green

### Partial
- Deep-research parity mostly complete; remaining work is production readiness and UX polish
- UI consistency (some native form controls remain)
- Push live dispatch readiness now depends on environment configuration + end-to-end runtime validation

### Missing
- Auth.js/Neon Auth convergence decision
- Observability/monitoring and production runbooks beyond current push dispatch doc

## 5) Quality + Verification

- `pnpm run test`: passing
- `pnpm run build`: passing
- Middleware route protection active
- Export endpoints require recent re-auth

## 6) Priority Backlog (Active Build Path)

1. Validate end-to-end live push delivery in deployed/runtime environment
2. Auth architecture decision and migration path
3. Simulation model depth improvements (stress cases, richer forecast assumptions)
4. UX polish and design consistency pass across forms/states
5. Production observability + operational runbooks

## 7) Living Update Log

### 2026-08-08
- Mobile spacing: header-to-title gap cut from 48px to 28px across all app pages and their loading skeletons; fixed the Money movement card header collapsing to one word per line on phones (`components/shell/app-shell.tsx`, `app/dashboard/page.tsx`).
- Onboarding tour: spotlight now cuts a real hole (target no longer blurred), desktop page steps highlight the matching sidebar entry, and the highlight glides between pages instead of blinking (`components/feature/in-app-onboarding-tour.tsx`, `components/shell/app-shell.tsx`).
- Reminders mark-done: scope writes by userId so they no longer depend on ambient RLS identity; actions return structured errors instead of Next's masked message (`lib/data/reminders.ts`, `app/reminders/actions.ts`, `app/reminders/client.tsx`).
- Button loading states no longer resize: spinner overlays reserved space instead of being inserted into layout flow (`components/ui/button.tsx`, `components/shell/app-shell.tsx`, `app/notes/client.tsx`, `app/simulate/client.tsx`, `app/settings/_components/settings-nav.tsx`, `app/settings/_components/settings-grid.tsx`).

### 2026-07-05
- Assistant answers now use current-month real actuals that reconcile with the dashboard. 'Analyze my month' was quoting prorated window figures (e.g. income 3483 blend) and pace-based budget-used, so it looked like old/wrong months. Assistant context now carries month-anchored monthIncome/monthExpenses/monthSavings/monthNet (= dashboard Money-health card) and actualSpent; every money branch (analyze, budget status, balance, savings, budget used, overspend, focus) rewritten to use them. Fixed 'budget status' being swallowed by the greedy 'status' keyword in the analyze branch, budget-remaining now = budget - actual spend (not pace), and categories with spend but no target are no longer falsely reported as over plan. (`lib/ai/local-assistant.ts`, `app/assistant/page.tsx`, `tests/ledger-integrity.test.mjs`).
- Fix three dashboard/assistant bugs: (1) assistant 'What does this app do?' returned a greeting because keyword matching used substring includes ('this' contains 'hi') — hasAny now matches whole words; (2) month selector only listed months with a budget period (usually just the current one) — userMonths now enumerates every month from first activity/signup to now; (3) all-time chart showed a single lonely monthly dot for new users and truncated the earliest month — all-time window now starts at the signup month, and chart uses daily granularity when the span is under 2 months (`lib/ai/local-assistant.ts`, `lib/data/dashboard.ts`, `tests/ledger-integrity.test.mjs`).
- Dashboard filter-aware income + budget-used fix: Money-health income now responds to the range filter (today/this week show recorded income for that window only; this month shows budget income merged with recorded + extras; year-to-date and all-time accrue budget income across months since signup merged with all recorded income). Budget-used headline is now the plan-released amount (avg/day x days elapsed) that grows daily even before logging, rising further when actual spend runs ahead; bar shows plan-released fill with an actual-spend marker; budget-full warning and money pressure now key off actual spend not time elapsed. Extracted windowIncome() into lib/finance/math.ts with tests. (`lib/data/dashboard.ts`, `lib/finance/math.ts`, `app/dashboard/page.tsx`, `tests/ledger-integrity.test.mjs`).
- Dashboard money-health rework: card now shows the month's TOTAL income (full budget income merged with recorded income + extras, month-anchored, not window-prorated); removed the income/expenses/saved tile row; Avg spend/day = budget daily share + extra spend averaged over elapsed days; Today net detail shows only today's real in/out/count; Budget used bar auto-fills daily at plan pace with actual-spend overlay and real amounts; Money movement chart gained a dashed Expected/day plan line with income-day spikes; Budget by category now shows categories with real spend even without targets (`lib/data/dashboard.ts`, `app/dashboard/page.tsx`, `components/feature/charts.tsx`).

### 2026-07-04
- Tracker completeness pass: CSV import (idempotent via content-hash dedupe, Settings→Privacy), split transactions (repo+UI, parts inherit date/account/cleared), pending/cleared states (new Transaction.cleared, badge+toggle on /track, cleared balances + cleared net worth on accounts), debt/liability accounts (negative opening balance, assets−debts split in net worth), dashboard chart windows and bucketing now use user timezone (`lib/money/csv-import.ts`, `lib/data/import.ts`, `lib/data/transactions.ts`, `lib/data/accounts.ts`, `lib/data/dashboard.ts`, `app/track/feed-client.tsx`, `app/settings/privacy/client.tsx`, `prisma/schema.prisma`).

### 2026-07-03
- Ledger integrity overhaul: transactions now stamp account+currency and are editable with full audit trail; recurring rules actually post (lazy on page load + dispatch cron); month-end carry-in fixed to equal period-end live balance (was double-counting); offline sync is idempotent (OfflineSyncOp dedupe table); goals are ledger-backed (funding creates savings txns, savings txns move goals); account balances computed from openingBalance+transactions with transfers and net worth on /track; FX falls back to base currency honestly when no rate; user timezone drives day/period boundaries; monthStartDay no longer silently resets on budget saves (`lib/data/txn-filters.ts`, `lib/data/recurring.ts`, `lib/data/goal-ledger.ts`, `lib/data/accounts.ts`, `lib/data/transactions.ts`, `lib/data/utils.ts`, `lib/data/money-overview.ts`, `lib/dates.ts`, `app/track/actions.ts`, `app/api/offline/sync/route.ts`, `app/api/push/dispatch/route.ts`, `prisma/schema.prisma`).

### 2026-06-04
- Reconciled the budgeting model end-to-end: dashboard category spend and budget-used now come from real transactions by category (matching /plan); planned budget-category expenses are logged as BASELINE so they consume their category and the live balance instead of double-counting; money-overview surplus/totals are real-spend based with prorated kept only as 'expected by now'; replaced the calendar-only 'Budget pace' card with real 'Budget used %' plus an expected marker; Money health now shows actual cash flow matching the movement chart. (`lib/data/dashboard.ts`, `lib/data/money-overview.ts`, `app/track/client-form.tsx`, `app/dashboard/page.tsx`).

### 2026-03-21
- Restored strict budget onboarding gating so incomplete users are redirected straight to /onboarding after login and from protected app routes, and added a shell-level in-app tour that starts after onboarding to walk new users through the menu and core pages on mobile and desktop. (`app/layout.tsx`, `middleware.ts`, `app/auth/post-login/page.tsx`, `app/onboarding/page.tsx`, `app/onboarding/client.tsx`, `lib/data/onboarding.ts`, `components/shell/app-shell.tsx`, `components/feature/in-app-onboarding-tour.tsx`, `docs/PROJECT_STATUS.md`).
- Swept the app for stale prop-derived client state after router refreshes: settings forms now resync from refreshed server props, categories update immediately on create, budget settings resync after saves, and the note detail editor now tracks refreshed note content. (`app/settings/categories/client.tsx`, `app/settings/appearance/client.tsx`, `app/settings/goals/client.tsx`, `app/settings/profile/client.tsx`, `app/settings/notifications/client.tsx`, `app/settings/privacy/client.tsx`, `app/settings/security/client.tsx`, `app/settings/budget/client.tsx`, `app/notes/[id]/view-client.tsx`, `docs/PROJECT_STATUS.md`).
- Fixed notes and reminders create flows so new items appear immediately without a manual refresh by returning created rows from server actions, syncing client state from refreshed props, and revalidating dashboard note previews to prevent cross-page drift. (`app/notes/client.tsx`, `app/notes/actions.ts`, `lib/data/notes.ts`, `app/reminders/client.tsx`, `app/reminders/actions.ts`, `lib/data/reminders.ts`, `docs/PROJECT_STATUS.md`).
- Aligned dashboard reminders with the reminders page by sharing open-reminder sourcing, updated dashboard copy to match open reminders, and fixed reminder wording in assistant/legacy data helpers. (`lib/data/reminders.ts`, `lib/data/dashboard.ts`, `app/dashboard/page.tsx`, `lib/ai/local-assistant.ts`, `lib/data.ts`, `docs/PROJECT_STATUS.md`).

### 2026-03-13
- Verified authenticated mobile routes with live user/admin sign-in, made admin dashboard resilient when AssistantFeedback is absent, converted admin user controls to mobile cards, and fixed Goals help tips so opened tooltips stay inside the viewport. (`lib/data/admin.ts`, `components/feature/admin-panel.tsx`, `app/settings/_components/help-tip.tsx`, `docs/PROJECT_STATUS.md`).
- Overhauled public mobile UX with theme-aware landing/about/contact pages, fixed public theme toggle visibility, tightened cookie/header overflow, and patched dashboard/track/goals/budget mobile layouts. (`app/globals.css`, `components/shell/app-shell.tsx`, `components/feature/landing-experience.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `components/feature/contact-form.tsx`, `components/feature/cookie-banner.tsx`, `app/dashboard/page.tsx`, `app/track/feed-client.tsx`, `app/track/client-form.tsx`, `app/goals/client.tsx`, `app/plan/client.tsx`, `components/shell/page-header.tsx`, `docs/PROJECT_STATUS.md`).

### 2026-03-11
- Fixed `/track` quick-transaction write timeouts by removing the long interactive Prisma transaction from category resolution, retrying category creation safely on races, separating expense-vs-savings math in track data/impact calculations, shrinking the live-balance card, renaming the outflow action to an expense/savings action, and reordering the income wizard so note/date comes before the final extra-income explanation (`lib/data/transactions.ts`, `lib/data/budgets.ts`, `app/track/feed-client.tsx`, `app/track/client-form.tsx`, `docs/PROJECT_STATUS.md`).
- Reworked Goals affordability/reporting so funding-source selection now clearly drives goal checks, removed misleading income/spend cards, fixed surplus-available math to use baseline surplus adjusted by extra income/expense instead of the inflated money-overview carry figure, and rebuilt the goal-planner form into grouped fieldsets with a live preview (`lib/data/goals.ts`, `app/goals/page.tsx`, `app/goals/client.tsx`, `docs/PROJECT_STATUS.md`).
- Rebuilt Dashboard around actual Prisma transaction totals instead of mixed planned+actual math: net cash flow now uses real recorded income/expense/savings, budget-used and category spend are actual-only, planned values are shown only as references, and the page layout was simplified to net flow, actual cards, honest budget progress, burn rate, top spend, and core activity panels (`lib/data/dashboard.ts`, `app/dashboard/page.tsx`, `docs/PROJECT_STATUS.md`).

### 2026-03-09
- Redesigned Transactions UX: replaced multi-card summary with a single Balance card + extra-info list, and rebuilt add flow into a question-first step wizard (amount -> type -> category/details) launched from Add income/Add expense actions (`app/track/client-form.tsx`, `app/track/feed-client.tsx`, `docs/PROJECT_STATUS.md`).

### 2026-03-07
- Extended loading UX for long-running raw click actions (notes pin/open, reminders toggle, AI send/starter prompts, simulation stress presets, transaction delete) with explicit busy indicators and disabled states (`app/notes/client.tsx`, `app/reminders/client.tsx`, `app/ai/page.tsx`, `app/simulate/client.tsx`, `app/track/feed-client.tsx`, `docs/PROJECT_STATUS.md`).
- Added global click/touch interaction feedback for all clickables and upgraded shared buttons with automatic loading pulse on onClick actions (`components/feature/interaction-feedback.tsx`, `components/ui/button.tsx`, `app/layout.tsx`, `app/globals.css`, `docs/PROJECT_STATUS.md`).
- Added menu navigation loading states for desktop/mobile with in-link spinners and top transition bar during route switches (`components/shell/app-shell.tsx`, `docs/PROJECT_STATUS.md`).

### 2026-03-06
- Aligned dashboard math with budget target totals for savings/expenses, switched top-spend/category spend to actual expense transactions, exposed money-status formula breakdown on the card, and added loading-state navigation buttons for dashboard filters/actions plus public login/signup CTAs. (`lib/data/dashboard.ts`, `app/dashboard/page.tsx`, `lib/data/budgets.ts`, `components/ui/loading-link-button.tsx`, `components/shell/app-shell.tsx`, `app/page.tsx`, `docs/PROJECT_STATUS.md`).

### 2026-03-05
- Stabilized Playwright E2E by pinning local tests to a dedicated Next dev port (3100), disabling accidental server reuse, and aligning auth spec selectors/expectations to the current login/signup flow. Authenticated E2E flows now skip unless E2E_EMAIL and E2E_PASSWORD are set. (`playwright.config.ts`, `e2e/auth.spec.ts`, `README.md`, `docs/PROJECT_STATUS.md`).

### 2026-03-04
- Fixed dashboard underreported baseline values by using full monthly budget baselines for MONTHLY view cards while keeping budget-used progress based on elapsed-day baseline consumption (`lib/data/dashboard.ts`, `docs/PROJECT_STATUS.md`).
- Fixed onboarding save crash (DB_IDENTITY_REQUIRED:Category) by scoping expense-category lookup with userId so strict identity enforcement always has explicit model ownership (`lib/data/onboarding.ts`, `docs/PROJECT_STATUS.md`).
- Removed manual month-start-day editing from Settings/Budget Edit flows (server now auto-derives current-day month start) and added an onboarding header action button to return to dashboard (`app/onboarding/page.tsx`, `app/settings/actions.ts`, `lib/data/settings.ts`, `app/settings/budget/page.tsx`, `app/settings/budget/client.tsx`, `app/budget/actions.ts`, `app/budget/edit/page.tsx`, `app/budget/edit/client.tsx`, `lib/data/budgets.ts`, `docs/PROJECT_STATUS.md`).
- Marked onboarding as an app-shell route so it uses authenticated header layout instead of public shell/footer during onboarding flow (`components/shell/app-shell.tsx`, `docs/PROJECT_STATUS.md`).
- Refactored onboarding to shadcn-style labeled form sections, removed manual month-start input (auto-derives from current day server-side), added loading states for onboarding/error actions, and added onboarding/dashboard loading screens for smoother post-submit transitions (`app/onboarding/client.tsx`, `app/onboarding/actions.ts`, `lib/data/onboarding.ts`, `components/feature/data-load-error.tsx`, `app/onboarding/loading.tsx`, `app/dashboard/loading.tsx`, `docs/PROJECT_STATUS.md`).
- Executed one-time auth data repair to backfill User.profileId links for existing OAuth rows missing profile linkage in the active Neon database (scanned 2, repaired 2) (`docs/PROJECT_STATUS.md`).
- Fixed Google auth flow by keeping session.user.id on Auth user IDs, signing out stale sessions before Google login/signup, and enforcing post-login auth-user to profile linkage to prevent OAuthAccountNotLinked loops (`auth.ts`, `app/login/view-client.tsx`, `app/signup/view-client.tsx`, `app/auth/post-login/page.tsx`, `docs/PROJECT_STATUS.md`).
- Resolved repeated OAuthAccountNotLinked login failures by enabling safe Google email account linking, removed noisy auth JWT lookup warning logs, and changed public header auth controls to explicit Login and Signup links (no button-driven auto-forward behavior) (`auth.ts`, `components/shell/app-shell.tsx`, `app/login/view-client.tsx`, `docs/PROJECT_STATUS.md`).
- Improved perceived performance and auth UX by reducing dashboard query fan-out (removed duplicate money-overview calls, consolidated range totals, and simplified period reuse logic), removed signed-in warning blocks from login/signup forms, and introduced shadcn-style Card/Input/Label/Alert form boxes (`lib/data/dashboard.ts`, `lib/data/utils.ts`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/login/view-client.tsx`, `app/signup/view-client.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/alert.tsx`, `docs/PROJECT_STATUS.md`).
- Made slow-query/slow-operation terminal logs opt-in only by PERF_LOGS flag (disabled by default), reducing noisy local terminal output while keeping observability available when explicitly enabled (`lib/prisma.ts`, `lib/observability/perf.ts`, `.env.example`, `README.md`, `docs/PROJECT_STATUS.md`).
- Reduced strict-RLS transaction timeout failures by moving identity wiring to interactive transactions with configurable maxWait/timeout and classifying transaction-start failures as transient DB errors across dashboard/onboarding/post-login/session handling (`lib/prisma.ts`, `lib/data/utils.ts`, `app/dashboard/page.tsx`, `app/onboarding/page.tsx`, `app/auth/post-login/page.tsx`, `lib/auth/session.ts`, `.env.example`, `README.md`, `docs/PROJECT_STATUS.md`).
- Fixed recurring post-login UserProfile RLS failures by auto-forcing strict DB identity wiring when DATABASE_URL uses app_runtime role, added runtime-to-admin fallback bootstrap guard in post-login, and removed login/signup auto-redirect so auth pages always open as forms while signed-in users get non-blocking dashboard links (`lib/prisma.ts`, `app/auth/post-login/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `.env.example`, `README.md`, `docs/PROJECT_STATUS.md`).
- Fixed post-login UserProfile RLS failure by bootstrapping profiles through identity-aware runtime Prisma, made login route land on dashboard with non-blocking onboarding-required notice, and aligned auth/profile credential data-paths with DB identity context (`app/auth/post-login/page.tsx`, `app/dashboard/page.tsx`, `auth.ts`, `lib/data/auth.ts`, `lib/data/utils.ts`, `lib/app-user.ts`, `docs/PROJECT_STATUS.md`).
- Added post-login profile bootstrap on missing UserProfile rows so authenticated users can complete onboarding without getting stuck in UNAUTHENTICATED onboarding fallback (`app/auth/post-login/page.tsx`, `docs/PROJECT_STATUS.md`).
- Improved outage resilience by making session resolution trust profileId claims (avoids extra DB checks), removing direct-URL admin upsert fallback during active-user lookup failures, and normalizing runtime DB URLs to verify-full TLS + connect_timeout=5 for faster failure recovery (`lib/auth/session.ts`, `lib/data/utils.ts`, `lib/prisma.ts`, `app/auth/post-login/page.tsx`, `docs/PROJECT_STATUS.md`).

### 2026-03-03
- Reduced outage freeze/noise by trusting profileId claims in session fast-path, removing outage-time admin upsert fallback in active-user resolution, and making post-login DB retry fail fast (`lib/auth/session.ts`, `lib/data/utils.ts`, `app/auth/post-login/page.tsx`, `docs/PROJECT_STATUS.md`).
- Downgraded onboarding non-fatal catch logging from console.error to structured dev-only warning to prevent false runtime error overlays while preserving diagnostics (`app/onboarding/page.tsx`, `docs/PROJECT_STATUS.md`).
- Hardened auth post-login route against transient DB outages by adding retry and non-crashing fallback UI instead of Prisma initialization crash (`app/auth/post-login/page.tsx`, `docs/PROJECT_STATUS.md`).
- Stopped onboarding/login redirect thrash by disabling unsafe request-cache usage in db-context and adding loop-safe auth handling: onboarding only redirects to login when no session cookie exists, while login no longer auto-redirects when a next target is present (`lib/security/db-context.ts`, `app/onboarding/page.tsx`, `app/login/page.tsx`, `docs/PROJECT_STATUS.md`).
- Fixed onboarding/login redirect loop by switching middleware auth gating to robust session-cookie presence detection (including chunked authjs/next-auth cookies) instead of brittle token decode checks (`middleware.ts`, `docs/PROJECT_STATUS.md`).
- Stabilized onboarding/login auth flow by reconciling active user via email fallback + auto-profile upsert, adding JWT profileId backfill throttling, and requiring identity claims in middleware session-token checks (`lib/data/utils.ts`, `auth.ts`, `middleware.ts`, `docs/PROJECT_STATUS.md`).
- Fixed onboarding false 'database unavailable' failures by correcting session profile-id fallback logic, hardening onboarding error classification/redirects, limiting auth JWT profile lookups to sign-in, and protecting onboarding/post-login routes in middleware (`lib/auth/session.ts`, `app/onboarding/page.tsx`, `auth.ts`, `middleware.ts`, `docs/PROJECT_STATUS.md`).

### 2026-03-02
- Locked runtime Prisma to DATABASE_URL-only (pooler) to avoid unintended DIRECT_URL fallback, preventing direct-host outages from taking app traffic down (`lib/prisma.ts`, `docs/PROJECT_STATUS.md`).
- Hardened settings budget/category actions with safe structured server-action results (no expected guard 500s), added user-facing warning/error notifications with Security guidance, and added route-level budget error boundary with digest reference (`app/settings/actions.ts`, `app/settings/budget/client.tsx`, `app/settings/categories/client.tsx`, `app/settings/budget/error.tsx`, `docs/PROJECT_STATUS.md`).
- Fixed auth runtime resilience by sanitizing DATABASE_URL/DIRECT_URL env inputs (trim/quote-safe) and clarified unquoted env formatting in templates/docs to prevent Prisma URL validation failures in production (`lib/prisma.ts`, `.env.example`, `README.md`, `docs/PROJECT_STATUS.md`).
- Configured pnpm onlyBuiltDependencies allowlist (Prisma/Sharp stack) to prevent CI/Vercel ignored build-script warnings under pnpm v10 (`package.json`, `docs/PROJECT_STATUS.md`).
- Added CI pipeline for production readiness (typecheck/tests/build/smoke), pinned pnpm version for reproducible installs, and documented CI checks (`.github/workflows/ci.yml`, `package.json`, `README.md`, `docs/PROJECT_STATUS.md`).
- Hardened protected-route auth by validating signed session tokens in middleware, improved dashboard error classification with request-id context, and added automated end-to-end smoke flow checks (`middleware.ts`, `app/dashboard/page.tsx`, `tools/smoke-check.mjs`, `package.json`, `README.md`, `docs/PROJECT_STATUS.md`).
- Backfilled historical period carryIn values, included carry-forward in surplus validation/overview totals, and made Transactions metric cards responsive with planned-vs-recorded income context (`prisma/migrations/20260302203000_backfill_budgetperiod_carryin/migration.sql`, `lib/data/money-overview.ts`, `lib/data/transactions.ts`, `app/track/feed-client.tsx`, `docs/PROJECT_STATUS.md`).
- Implemented monthly budget rollover carry-forward with persisted period carryIn and prior-target cloning; validated migration, typecheck, tests, and production build (`prisma/schema.prisma`, `prisma/migrations/20260302173000_period_carry_forward_rollover/migration.sql`, `lib/data/utils.ts`, `lib/data/dashboard.ts`, `docs/PROJECT_STATUS.md`).
- Added production-safe observability baseline: slow Prisma query logging, slow operation timing for dashboard/simulate/budget/track, request-id propagation, DB role+latency checks in auth health endpoint, and perf env toggles documentation (`lib/observability/perf.ts`, `lib/prisma.ts`, `lib/data/dashboard.ts`, `lib/data/simulations.ts`, `lib/data/budgets.ts`, `lib/data/transactions.ts`, `app/api/auth/health/route.ts`, `middleware.ts`, `.env.example`, `README.md`, `docs/PROJECT_STATUS.md`).
- Documented DB_IDENTITY_STRICT env toggle for local-performance vs strict-RLS mode in env template and README (`.env.example`, `README.md`, `docs/PROJECT_STATUS.md`).
- Added dev fast-path for DB identity enforcement: strict per-query RLS context wrapping now defaults to production only (or DB_IDENTITY_STRICT=true), reducing heavy query overhead during local development while preserving production lock-down (`lib/prisma.ts`, `docs/PROJECT_STATUS.md`).
- Reduced loaded-route latency by adding request-scoped cache for session/active-user/current-period and removing duplicate period lookups in money overview callers (dashboard/simulate/budget/track) (`lib/security/db-context.ts`, `lib/auth/session.ts`, `lib/data/utils.ts`, `lib/data/money-overview.ts`, `lib/data/dashboard.ts`, `lib/data/simulations.ts`, `lib/data/budgets.ts`, `lib/data/transactions.ts`, `docs/PROJECT_STATUS.md`).
- Reduced per-load latency by making FX rate fetch fail-fast (2.5s timeout), stale-cache-first, and failure-cooldown; prevents repeated external FX blocking on dashboard/simulate pages (`lib/money/fx.ts`, `docs/PROJECT_STATUS.md`).
- Fixed DB_IDENTITY_REQUIRED:SandboxOverride via deep userId extraction in Prisma guard (supports createMany arrays/nested args), reduced auth session lifetime to 12h for auto-logout, and stabilized loading-page layout height/footer positioning (`lib/prisma.ts`, `auth.ts`, `components/shell/app-shell.tsx`, `app/loading.tsx`, `app/simulate/loading.tsx`, `docs/PROJECT_STATUS.md`).
- Resolved DB_IDENTITY_REQUIRED:BudgetPeriod by making ensureCurrentBudgetPeriod updates fully user-scoped (updateMany/findFirst with userId) under strict Prisma identity guard (`lib/data/utils.ts`, `docs/PROJECT_STATUS.md`).
- Fixed DB_IDENTITY_REQUIRED:BudgetPeriod by deriving tenant userId from scoped Prisma args (where/data userId) and reinforcing DB identity context in getActiveUser (`lib/prisma.ts`, `lib/data/utils.ts`, `docs/PROJECT_STATUS.md`).

### 2026-03-01
- Fixed DB_IDENTITY_REQUIRED:UserProfile by allowing strictly-scoped UserProfile id/email lookups to bootstrap Prisma DB identity context when ambient session context is missing (`lib/prisma.ts`, `docs/PROJECT_STATUS.md`).
- Fixed dashboard false 'database unavailable' state by handling auth failures explicitly and improving session profile resolution fallback for stale/mismatched profile IDs (`app/dashboard/page.tsx`, `lib/auth/session.ts`, `docs/PROJECT_STATUS.md`).

### 2026-02-28
- Fixed duplicate DATABASE_URL override in .env that was forcing owner runtime role; revalidated runtime/admin role split and post-change build/audit (`.env`, `docs/PROJECT_STATUS.md`).
- Cut over runtime DB access to non-bypass app_runtime_user with true RLS enforcement; separated prismaAdmin onto DIRECT_URL owner connection; granted runtime access to shared limiter/fx tables; verified runtime/admin role split plus build/test/audit/typecheck (`lib/prisma.ts`, `prisma/migrations/20260228162000_runtime_role_operational_grants/migration.sql`, `docs/PROJECT_STATUS.md`, `README.md`, `.env.example`).
- Completed full DB lock-down migration with RLS policies, request-scoped DB identity enforcement, privileged prismaAdmin paths, and post-hardening security rescan (build/typecheck/audit/tests) (`lib/prisma.ts`, `lib/security/db-context.ts`, `lib/auth/session.ts`, `auth.ts`, `lib/data/auth.ts`, `app/api/push/dispatch/route.ts`, `app/api/contact/route.ts`, `prisma/migrations/20260228145500_row_level_security_lockdown/migration.sql`, `lib/money/currencies.ts`, `app/onboarding/client.tsx`, `app/budget/edit/client.tsx`, `app/settings/budget/page.tsx`, `tests/load-ts-module.mjs`, `tests/settings-hardening.test.mjs`, `README.md`, `.env.example`).
- Applied push-subscription ownership immutability trigger and fail-closed distributed rate-limit behavior; validated migrate+typecheck+build+prod audit (`prisma/migrations/20260228121500_lock_push_subscription_owner/migration.sql`, `app/api/push/subscribe/route.ts`, `lib/security/rate-limit.ts`).
- Added database tenant-integrity triggers to block cross-user foreign-key linkage attacks for BudgetTarget, Transaction, and SandboxOverride records (`prisma/migrations/20260228130000_tenant_integrity_guards/migration.sql`).
- Completed security hardening pass: enabled strict TypeScript build checks, moved CSP to middleware nonce policy (no unsafe-inline), and switched rate limiting to DB-backed shared buckets (`next.config.mjs`, `middleware.ts`, `lib/security/rate-limit.ts`, `lib/security/settings-mutation-guard.ts`, `prisma/schema.prisma`, `prisma/migrations/20260228113000_rate_limit_bucket/migration.sql`).
- Resolved TypeScript blockers exposed by hardening: fixed auth provider typing, session nullability, transaction typing/scope issues, and added web-push type declarations (`auth.ts`, `lib/auth/session.ts`, `lib/data/transactions.ts`, `app/track/feed-client.tsx`, `lib/data/settings.ts`, `app/settings/security/page.tsx`, `package.json`, `pnpm-lock.yaml`).
- Hardened auth abuse protections by adding login/signup rate limiting and secured auth health diagnostics to admin-only (`app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `app/api/auth/health/route.ts`).
- Closed security re-auth bypass by replacing query-only verification with nonce-bound Google re-verification flow (`app/settings/security/page.tsx`, `app/settings/security/client.tsx`, `app/api/auth/reauth/start/route.ts`).
- Resolved transitive audit vulnerabilities by pinning secure minimatch/ajv versions through pnpm overrides and refreshing lockfile (`package.json`, `pnpm-lock.yaml`).

### 2026-02-27
- Auth callback failure diagnostics + UX hardening:
  - reproduced local/prod Google OAuth start flow using CSRF+PKCE exchange and confirmed healthy provider redirect behavior on both environments (Google auth URL + PKCE cookie issuance),
  - traced local callback `500` reports to stale/conflicting dev server instances and callback requests without matching PKCE cookies (invalid-check path),
  - added Auth.js error-page routing to `/login` so provider/callback failures return users to login instead of generic server-error page (`auth.ts`).
- Landing-page CTA visibility fix shipped:
  - fixed shared outline button contrast by enforcing explicit dark text + stronger border/background hover, resolving invisible `See product story` button in dark hero/footer CTA sections (`components/ui/button.tsx`).
- Google sign-in AccessDenied hardening shipped:
  - removed fragile OAuth profile-link write in Auth.js `signIn` callback that could fail and deny login during provider callback flow; profile linkage remains email-based through session resolution,
  - added explicit redirect errors for missing OAuth email and inactive accounts (`/login?error=OAuthEmailMissing` / `/login?error=AccountInactive`) for clearer diagnostics (`auth.ts`).

### 2026-02-26
- Auth configuration diagnostics hardening shipped:
  - normalized/trimmed auth env parsing (including quoted-value cleanup) for `NEXTAUTH_SECRET`/`AUTH_SECRET` and Google credentials to reduce production misconfiguration edge cases caused by copied env formatting (`auth.ts`),
  - added safe runtime auth health endpoint (`/api/auth/health`) that reports presence of required auth env vars and warnings without exposing secret values, to speed production diagnosis (`app/api/auth/health/route.ts`).
- Verification after auth diagnostics hardening: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Public-auth UX polish shipped:
  - added Google icon branding on login/signup Google CTA buttons for clearer provider affordance (`app/login/view-client.tsx`, `app/signup/view-client.tsx`).
- Public-site copy simplification pass shipped:
  - removed technical jargon from Home/About/Contact and rewrote sections to user-consumable everyday language while preserving strong conversion visuals and free-product positioning (`app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`).
- Verification after UX simplification pass: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Auth old-account login redirect remediation shipped:
  - hardened NextAuth runtime for local/prod parity by enabling JWT session strategy and explicit dev-safe cookie handling (`useSecureCookies` by environment + `trustHost`) to prevent successful credentials callbacks from failing to persist a usable session in local runtime,
  - removed client-side post-login race by forcing a full navigation to callback URL only after credential sign-in succeeds and session endpoint is read (`app/login/view-client.tsx`, `app/signup/view-client.tsx`, `auth.ts`).
- Verification after redirect remediation: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Public-site conversion polish pass shipped (free-only positioning):
  - strengthened Home/About/Contact narrative and visual density with richer trust messaging, free-product positioning (no pricing), additional graph-style sections, and subtle motion accents (`app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `app/globals.css`).
- Middleware auth UX guardrail improved:
  - fixed post-login false redirects by recognizing chunked NextAuth session cookie names (`*.session-token.0`, `*.session-token.1`, etc.), preventing valid sessions from being redirected back to `/login` (`middleware.ts`).
- Verification after polish + redirect guard update: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Auth redirect-loop fix shipped:
  - middleware auth-session detection now supports chunked NextAuth cookie names (e.g., `.0`, `.1`) to prevent false unauthenticated redirects after successful credentials sign-in on existing accounts (`middleware.ts`).
- Public-site redesign shipped for production-facing conversion quality:
  - rebuilt Home, About, and Contact pages with richer visual hierarchy, chart-style SVG visuals, stronger product narrative copy, and clearer conversion CTAs to make public pages more informative and convincing (`app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`).
- Verification after redirect fix + public redesign: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Auth API compatibility patch shipped:
  - restored `/api/auth/login` credential behavior by delegating to Auth.js credentials sign-in path instead of returning deprecation status, so legacy clients hitting this endpoint can authenticate without immediate breakage (`app/api/auth/login/route.ts`).
- Verification after compatibility patch: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Auth stability hardening follow-up shipped:
  - made Google provider registration conditional on env availability to prevent provider misconfiguration crashes while keeping credentials login always available (`auth.ts`),
  - updated `/login` and `/signup` UIs to gracefully show/hide Google CTA based on server-side provider availability (`app/login/page.tsx`, `app/login/view-client.tsx`, `app/signup/page.tsx`, `app/signup/view-client.tsx`),
  - updated Security re-auth messaging/CTA behavior to handle both modes (Google verify when enabled, generic security re-auth guidance otherwise) and normalized sensitive-action errors to generic re-auth wording (`app/settings/security/page.tsx`, `app/settings/security/client.tsx`, `lib/security/settings-mutation-guard.ts`, `lib/data/settings.ts`, `app/api/export/csv/route.ts`, `app/api/export/json/route.ts`).
- Verification after auth hardening follow-up: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Auth UX correction shipped after product feedback:
  - restored full credential-based login/signup UX while keeping Google OAuth as optional on both screens (hybrid auth),
  - `/login` now supports email/password sign-in via NextAuth Credentials provider plus `Continue with Google`,
  - `/signup` now supports email/password account creation and then signs in through credentials, with Google signup as alternative (`app/login/page.tsx`, `app/login/view-client.tsx`, `app/signup/page.tsx`, `app/signup/view-client.tsx`, `auth.ts`, `app/api/auth/signup/route.ts`).
- Added Credentials provider integration in Auth.js runtime with profile linkage:
  - credentials authorization validates password hash from `AuthCredential`, checks account active state, and upserts Auth.js `User` linkage to existing `UserProfile` (`auth.ts`, `lib/data/auth.ts`).
- Middleware compatibility fix shipped:
  - removed Auth.js edge-wrapper dependency from middleware to avoid bundling Node crypto/password hashing into edge build path after enabling credentials; middleware now uses NextAuth session-cookie presence for redirect UX while server-side `requireUser()` remains the source of truth for access control (`middleware.ts`).
- Verification after login/signup restoration: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Re-authentication model upgraded for OAuth users:
  - added `UserProfile.reauthenticatedAt` and migrated DB (`20260226201000_oauth_reauth_timestamp`) so sensitive-action gating no longer depends on password-hash credentials for Google-only accounts (`prisma/schema.prisma`, `prisma/migrations/20260226201000_oauth_reauth_timestamp/migration.sql`).
- Implemented Security-page OAuth re-verification flow:
  - added `Verify with Google` action on `/settings/security` using `signIn("google", { callbackUrl: "/settings/security?verified=1" })`,
  - on callback return, server stamps `reauthenticatedAt=now` and normalizes URL to `/settings/security?verified=done`,
  - security UI now reports verification status and success state for the 10-minute sensitive-action window (`app/settings/security/page.tsx`, `app/settings/security/client.tsx`).
- Sensitive-action gate now uses DB timestamp window (`now - reauthenticatedAt < 10 minutes`) through shared `hasRecentReauth` checks across settings mutation guards and export APIs, with updated user-facing guidance to verify with Google (`lib/auth/session.ts`, `lib/security/settings-mutation-guard.ts`, `lib/data/settings.ts`, `app/api/export/csv/route.ts`, `app/api/export/json/route.ts`, `app/settings/danger/client.tsx`).
- Deprecated password reauth pathway explicitly disabled in auth actions to avoid mixed UX expectations in Google-first auth mode (`app/auth/actions.ts`).
- Verification after OAuth reauth update: `pnpm prisma migrate deploy` pass (applied `20260226201000_oauth_reauth_timestamp`), `pnpm prisma:generate` pass, `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Auth architecture upgrade shipped: migrated app auth runtime to Auth.js/NextAuth v5 with Google provider, Prisma adapter, and App Router handler exports (`auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `package.json`).
- Prisma auth schema integration shipped:
  - added Auth.js required models (`User`, `Account`, `Session`, `VerificationToken`) with safe table mapping for account collision avoidance (`Account` mapped to `AuthAccount`),
  - renamed financial account model to `FinancialAccount` while preserving legacy DB table mapping (`@@map("Account")`) and rewired data/seed queries from `prisma.account` to `prisma.financialAccount`,
  - applied migration `20260226190000_authjs_google_v5` via `pnpm prisma migrate deploy` (`prisma/schema.prisma`, `prisma/migrations/20260226190000_authjs_google_v5/migration.sql`, `lib/data/settings.ts`, `lib/data/onboarding.ts`, `lib/data/exports.ts`, `prisma/seed.ts`).
- Session/access-control bridge upgraded:
  - `lib/auth/session.ts` now resolves user identity through Auth.js `auth()` and keeps server-side protection semantics (`requireUser`) for server components/actions/routes,
  - middleware now uses Auth.js wrapper and redirects protected-route unauthenticated access to `/login` (`middleware.ts`, `lib/auth/session.ts`).
- Auth UX update shipped:
  - new `/login` Google-first page with loading/error states and legal links,
  - `/signup` and `/auth` now route to `/login`,
  - added post-auth router gate (`/auth/post-login`) to redirect users to `/onboarding` if baseline budget is not set, otherwise `/dashboard`,
  - added basic legal pages (`/legal/terms`, `/legal/privacy`) and aligned app login links to `/login` (`app/login/page.tsx`, `app/login/view-client.tsx`, `app/auth/page.tsx`, `app/signup/page.tsx`, `app/auth/post-login/page.tsx`, `app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx`, `components/shell/app-shell.tsx`, `app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `app/onboarding/page.tsx`).
- Deprecated credential endpoints/actions now return explicit migration guidance to `/login` Google flow instead of relying on removed signed-cookie session creation (`app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `app/auth/actions.ts`).
- Environment template updated for Auth.js + Google vars (`.env.example`).
- Verification after Auth.js migration: `pnpm prisma:generate` pass, `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Settings hardening Phase 4 shipped:
  - extracted mutation access control into reusable helper (`runSettingsMutationWithGuards`) to centralize auth + re-auth + rate-limit enforcement for settings server actions,
  - refactored `app/settings/actions.ts` to use the shared guard helper while preserving existing behavior/messages (`app/settings/actions.ts`, `lib/security/settings-mutation-guard.ts`).
- Added integration-style guard tests for settings mutation paths:
  - unauthenticated access blocks mutation execution,
  - required re-auth blocks mutation execution when missing,
  - rate-limit denial blocks mutation execution,
  - success path executes mutation when all guards pass (`tests/settings-hardening.test.mjs`).
- Verification after Settings hardening Phase 4: `pnpm run test` pass (11 tests), `pnpm run build` pass.
- Settings production-hardening Phase 3 shipped:
  - extracted deterministic settings version guard helpers (`parseSettingsVersion`, `isExpectedVersionMatch`) and wired settings data layer to use those guards for stale-write validation paths,
  - added regression tests for settings version parsing/matching and rate-limit window behavior to harden mutation safety expectations (`lib/data/settings-guards.ts`, `lib/data/settings.ts`, `tests/settings-hardening.test.mjs`).
- Verification after Settings hardening Phase 3: `pnpm run test` pass (7 tests), `pnpm run build` pass.
- Settings production-hardening Phase 2 shipped:
  - added optimistic concurrency/stale-write protection on budget settings saves using `expectedUpdatedAt` version checks so outdated tabs/sessions cannot overwrite newer settings,
  - serialized budget-core settings writes with per-user DB advisory transaction locks in budget plan and budget behavior updates,
  - returned server-side `updatedAt` versions to the budget settings client and wired the form to pass/refresh version tokens on each successful save (`app/settings/actions.ts`, `lib/data/settings.ts`, `app/settings/budget/page.tsx`, `app/settings/budget/client.tsx`).
- Verification after Settings hardening Phase 2: `pnpm run test` pass, `pnpm run build` pass.
- Settings production-hardening Phase 1 shipped:
  - added server-action rate limiting across Settings mutations with per-user/action buckets and mutation-specific limits/windows,
  - expanded recent re-auth requirements for budget-core and security-sensitive settings writes (`updateProfile`, `updateSecurityPreferences`, `updateBudgetPlan`, `updateBudgetPreferences`, plus existing danger actions),
  - added audit logging for key settings mutations (profile, category create/archive/delete, budget preferences, budget plan) with before/after metadata snapshots for operational traceability (`app/settings/actions.ts`, `lib/data/settings.ts`).
- Verification after Settings hardening Phase 1: `pnpm run test` pass, `pnpm run build` pass.
- Restored Budget page visual experience after regression report: `/budget` now renders the rich budget planner UI (cards, graph, auto-spend, pie, guidance panels) by wiring back to `getBudgetPlannerData` + `BudgetPlanner` instead of the stripped read-only summary layout (`app/budget/page.tsx`, `app/plan/client.tsx`).
- Verification after budget-page restore: `pnpm run test` pass, `pnpm run build` pass.
- Added hardening regression test suite for financial integrity helpers:
  - custom period-day boundary math,
  - carry-forward transfer exclusion,
  - offline queue fallback policy (business-rule vs network-failure distinction),
  and verified all pass under `node --test` (`tests/finance-hardening.test.mjs`, `tests/load-ts-module.mjs`).
- Refactored shared financial logic into reusable pure utilities for testability and consistency (`lib/finance/math.ts`, `lib/offline/sync-policy.ts`) and wired production paths to those helpers (`lib/data/money-overview.ts`, `lib/data/budgets.ts`, `lib/data/dashboard.ts`, `lib/data/transactions.ts`, `app/track/client-form.tsx`).
- Verification after test-hardening rollout: `pnpm run test` pass (4 tests), `pnpm run build` pass.
- Production hardening pass completed on budgeting/transactions math integrity:
  - normalized period-day math to custom budget windows (`monthStartDay` aware) in money overview and budget impact calculations (replacing calendar-month day counters for pace/surplus/remaining metrics),
  - aligned transactions period aggregates to active budget period bounds (instead of calendar-month start) for period cards/impact consistency (`lib/data/money-overview.ts`, `lib/data/budgets.ts`, `lib/data/transactions.ts`).
- Concurrency safety added for extras validation: extra expense/savings writes now run inside a DB transaction with per-user advisory lock and revalidated surplus/budget-use checks before insert, preventing concurrent overspend race conditions (`lib/data/transactions.ts`).
- Rolling carry-forward fix shipped: dashboard carry-forward now ignores `TRANSFER` rows (only `INCOME` adds, `EXPENSE` subtracts), preventing false negative carry-forward drift (`lib/data/dashboard.ts`).
- Offline-queue behavior tightened: client now only queues failed transaction writes for likely network/offline faults; business-rule validation failures (e.g., surplus/budget constraints) are surfaced directly and not queued (`app/track/client-form.tsx`).
- Transaction category normalization hardening: transaction category creation now trims/collapses whitespace and reuses existing categories case-insensitively to reduce duplicate analytical splits (`lib/data/transactions.ts`).
- Verification after hardening pass: `pnpm run test` pass, `pnpm run build` pass.
- Seed integrity fix shipped for baseline/allocation consistency: seeded user now includes non-zero baseline fields (`baselineIncome`, `baselineExpense`, `baselineSavings`, frequency/start settings) aligned with seeded budget-target totals so settings no longer opens with `0.00` baseline values and false over-allocation for fixture accounts (`prisma/seed.ts`).
- Seed transaction-quality fix shipped: seeded baseline transactions are now explicitly `kind=BASELINE`; extras are seeded explicitly as `EXTRA_INCOME`, `EXTRA_EXPENSE`, and `EXTRA_SAVINGS` so extras dashboards/forms validate against realistic test data (`prisma/seed.ts`).
- Category hardening fix shipped: category creation now blocks reserved/noise names (`misc`, `savings`, `planned item`) to prevent reintroducing invalid budget-category rows from UI paths (`lib/data/settings.ts`).
- Post-fix reseed validation completed: `pnpm prisma:seed` pass; direct DB check confirms seeded baseline/allocation coherence (`baselineExpense 1500 >= expenseAllocated 1370`, `baselineSavings 500 >= savingsAllocated 450`).
- Verification after this update: `pnpm run test` pass, `pnpm run build` pass.
- Transactions extras wiring clarification shipped: `Extra Income`, `Extra Expense`, and `Extra Savings` page metrics are now explicitly aggregated from `Transaction` records (`kind=EXTRA`, grouped by `extraType`) for both today and month windows, decoupling those extra cards/data from baseline budget math (`lib/data/transactions.ts`).
- Verification after extras-source update: `pnpm run test` pass, `pnpm run build` pass.
- Budget settings UX/control hardening shipped: cards now default to read-only and require explicit per-card `Edit` mode before changes (Budget behavior, Baseline budget, Category allocations), with cancel/edit state controls and save actions gated to edit mode (`app/settings/budget/client.tsx`).
- Enforced no-overspend save path end-to-end: allocation overages now show inline warning state and block both baseline/allocation saves in UI, with an additional client-side save guard before mutation dispatch (`app/settings/budget/client.tsx`).
- Category cleanup pass shipped per product model: removed `Planned item` from default savings category seeds and hidden-category filters now exclude legacy/noise rows (`misc`, `savings`, `planned item`) from settings/budget allocation surfaces while preserving database history (`lib/data/settings.ts`, `lib/data/budgets.ts`, `app/plan/client.tsx`).
- Auth/bootstrap + seed data cleanup shipped: new users now receive proper savings-kind starter categories (`Emergency Fund`, `Investments`) instead of expense-kind `Savings`; fixture seed updated accordingly for connected cross-page test flows (`lib/data/auth.ts`, `prisma/seed.ts`).
- Runtime data reset + reseed executed: `pnpm prisma migrate reset --force` completed, then `pnpm prisma:seed` completed with refreshed admin/user fixture credentials and connected budgeting/transactions/goals/notes/reminders/push/contact data.
- Verification after this update: `pnpm run test` pass, `pnpm run build` pass (pre-reset on final code), and post-reset `pnpm run test` pass.
- Settings Categories-tab UX polish shipped with shadcn-style collapsible behavior: Expense and Savings category cards are now vertically stacked full-width, each shows only the first 5 rows by default, and long lists expand via `Show all categories (N)` / `Show less` trigger with chevron state icons so one list cannot visually push the other card off screen (`app/settings/budget/client.tsx`, `components/ui/collapsible.tsx`, `package.json`).
- Kept category add action always visible in each card header and preserved row edit/archive/delete controls inside the collapsible flow (`app/settings/budget/client.tsx`).
- Verification after this update: `pnpm run test` pass, `pnpm run build` pass.
- Budget settings flow refinement shipped per product feedback: renamed baseline section to `Baseline budget`, removed manual daily-spend field from baseline inputs, added a dedicated `Save baseline budget` action, and now auto-derive daily estimate internally from baseline expenditure for preference/baseline saves (`app/settings/budget/client.tsx`).
- Category allocation UX redesign shipped: each category is now rendered as its own card row with inline contextual notes, cadence/amount editors, row-level `Archive` and `Delete` actions with loading/warning states, over-allocation warning surfaces for expense/savings pools, and explicit remaining-baseline indicators (`app/settings/budget/client.tsx`, `app/settings/actions.ts`, `lib/data/settings.ts`).
- Budget model cohesion update: changing income frequency now automatically syncs category allocation cadence to keep baseline/category math aligned end-to-end (`app/settings/budget/client.tsx`).
- Settings navigation breadcrumb path shipped for nested pages so users can navigate back across settings sections without relying on browser history (`app/settings/layout.tsx`, `app/settings/_components/settings-path.tsx`).
- Verification after this update: `pnpm run test` pass, `pnpm run build` pass.
- Fixed Settings Budget hydration mismatch caused by server/client currency-list divergence (`SLE` vs `SLL`): currency options are now sourced from a server-side snapshot and passed into the client form to guarantee deterministic SSR/CSR rendering (`app/settings/budget/page.tsx`, `app/settings/budget/client.tsx`).
- Verification after hydration fix: `pnpm run build` pass.
- Settings budget-card redesign shipped: `Baseline plan values` now uses explicit labeled inputs (no placeholder-only fields), clear helper text, monthly-normalization preview for income, and a smart daily/weekly helper that can auto-fill monthly expense+savings from per-cycle averages plus monthly bills (`app/settings/budget/client.tsx`).
- Category management consolidated into Budget settings: category allocations now support inline add (expense/savings), inline archive, and direct wiring to baseline allocation save flow so category editing happens in one place (`app/settings/budget/client.tsx`, `app/settings/actions.ts`).
- Removed standalone Categories settings entrypoint from primary navigation and made `/settings/categories` redirect to `/settings/budget` to enforce single-source category allocation workflow (`app/settings/page.tsx`, `app/settings/_components/settings-nav.tsx`, `app/settings/categories/page.tsx`).
- Restored/ensured legacy savings category list in baseline category seeding path and settings load path (including `Personal savings` and `Planned item`) so savings categories remain consistent while syncing across budget/goals/transactions flows (`lib/data/budgets.ts`, `lib/data/settings.ts`).
- Verification after this update: `pnpm run test` pass, `pnpm run build` pass.
- Goals/Transactions savings-category wiring update shipped: transaction savings category options now include live goal-linked savings category names so add-transaction forms read current category state instead of stale static lists (`lib/data/transactions.ts`).
- Simulation livelihood baseline realism fix shipped: livelihood mode now defaults `Current savings` from live `actualSavings` aggregates (instead of zero), and mode copy/tooltip now reflects real-balance semantics for meaningful projections/graph output (`lib/data/simulations.ts`, `app/simulate/client.tsx`).
- Notes upgraded to journal-style note-detail workflow with per-note route and in-place edit/save: added note detail fetch/update data methods, note update action, and dedicated `/notes/[id]` page with richer single-note reading/edit experience (`lib/data/notes.ts`, `app/notes/actions.ts`, `app/notes/[id]/page.tsx`, `app/notes/[id]/view-client.tsx`, `app/notes/client.tsx`).
- Reminders system enhancement shipped: recurring reminder model (`NONE|DAILY|WEEKLY|MONTHLY` + interval), recurrence-aware create/action flow, recurrence UI controls, and per-reminder calendar export support with RRULE-aware single-reminder `.ics` generation (`prisma/schema.prisma`, `prisma/migrations/20260226173000_reminder_recurrence/migration.sql`, `lib/validators/reminders.ts`, `lib/data/reminders.ts`, `app/reminders/actions.ts`, `app/reminders/client.tsx`, `app/api/reminders/ics/route.ts`, `app/api/offline/sync/route.ts`).
- Onboarding reminder opt-in now included: onboarding step now supports daily end-of-day reminder consent + hour selection and auto-creates recurring daily reminders when enabled (`app/onboarding/client.tsx`, `app/onboarding/actions.ts`, `lib/data/onboarding.ts`).
- Settings IA behavior aligned to list-first requirement: removed persistent in-layout settings side navigation and retained tap/click-through overview cards as primary section entry (`app/settings/layout.tsx`, `app/settings/page.tsx`).
- Verification after this batch: `pnpm prisma migrate deploy` pass (applied `20260226173000_reminder_recurrence`), `pnpm prisma generate` pass, `pnpm run test` pass, `pnpm run build` pass.
- Dashboard UI fit/glitch fix shipped: reduced top summary-card density for stable responsive layout, added `?` explainer tooltip on `Include carry-forward` filter toggle, and validated build after layout adjustments (`app/dashboard/page.tsx`).
- Budget layout refinement shipped: moved `How extras affected this month` card to appear under the budget pie/preferred-spending row for better section flow (`app/plan/client.tsx`).
- Tightened dashboard rolling-mode carry-forward math: rolling view now combines pre-window transaction carry-forward with baseline carry-forward accumulated across prior custom budget periods (month-start aware), improving continuity accuracy for `Include carry-forward` mode (`lib/data/dashboard.ts`).
- Shipped phase-2 currency conversion foundation with DB-backed FX cache (`FxRateCache`), live-rate fetch with safe cached fallback, supported-currency helpers, and user display-currency context resolution (`prisma/schema.prisma`, `prisma/migrations/20260226161000_fx_rate_cache/migration.sql`, `lib/money/fx.ts`, `lib/data/currency.ts`).
- Wired preferred-currency conversion across major money surfaces using base->preferred FX rate propagation: Dashboard, Budget, Transactions, Goals, and Simulations now render converted money values while preserving stored base values (`lib/data/dashboard.ts`, `app/dashboard/page.tsx`, `lib/data/budgets.ts`, `app/plan/page.tsx`, `app/plan/client.tsx`, `lib/data/transactions.ts`, `app/track/page.tsx`, `app/track/feed-client.tsx`, `lib/data/goals.ts`, `app/goals/page.tsx`, `app/goals/client.tsx`, `lib/data/simulations.ts`, `app/simulate/page.tsx`, `app/simulate/client.tsx`).
- Added dashboard period controls with query-driven filters (`weekly|monthly|yearly`) and view mode toggle (`this period only` vs `include carry-forward`) for clearer rolling-vs-period reporting behavior (`lib/data/dashboard.ts`, `app/dashboard/page.tsx`).
- Upgraded onboarding/settings currency UX from free-text entry to currency-dropdown selection sourced from supported currency lists, aligned to preferred/base currency model (`app/onboarding/client.tsx`, `app/settings/budget/client.tsx`).
- Implemented frequency-driven baseline engine foundation: added user-level `baseCurrency`/`preferredCurrency` and `budgetStartMode`, plus budget-target `cadence` persistence for daily/weekly/monthly category allocations, with migration applied in runtime DB (`prisma/schema.prisma`, `prisma/migrations/20260226152000_frequency_baseline_engine/migration.sql`).
- Upgraded period-window logic to honor configurable `monthStartDay` and onboarding start mode (`current` vs `next` period) using start-day based budget windows instead of fixed calendar-month boundaries (`lib/data/utils.ts`, `lib/data/onboarding.ts`).
- Rebuilt onboarding flow to 3-step production model: account identity, frequency-aware baseline input (daily/weekly/monthly) with live monthly normalization/surplus preview, and starter expense+savings category setup (`app/onboarding/client.tsx`, `app/onboarding/actions.ts`, `lib/data/onboarding.ts`, `lib/money/frequency.ts`).
- Refactored Settings Budget section to baseline-engine behavior model: removed scope dependency, added budget start mode control, wired preferred currency + income frequency controls, and upgraded category allocations to amount + cadence with computed monthly-equivalent validation context (`app/settings/budget/client.tsx`, `app/settings/budget/page.tsx`, `app/settings/actions.ts`, `lib/data/settings.ts`).
- Budget data layer now carries category cadence + entered amount + monthly equivalent, and budget-category rendering on Budget page now shows cadence-aware allocations with monthly equivalent context per row (`lib/data/budgets.ts`, `app/plan/client.tsx`).
- Rebuilt Settings into production-grade sectioned IA with dedicated routes (`/settings/account`, `/profile`, `/security`, `/budget`, `/categories`, `/goals`, `/notifications`, `/privacy`, `/appearance`, `/help`, `/danger`) and shared sidebar navigation/layout for desktop/mobile parity (`app/settings/layout.tsx`, `app/settings/_components/settings-nav.tsx`, `app/settings/page.tsx`, `app/settings/*/page.tsx`).
- Added full settings persistence model fields on `UserProfile` (timezone/language, budget behavior toggles, goal funding preferences, notification/privacy/appearance options), shipped migration, and wired server actions + data layer updates for per-card saves (`prisma/schema.prisma`, `prisma/migrations/20260226133000_settings_sections/migration.sql`, `app/settings/actions.ts`, `lib/data/settings.ts`).
- Hardened Settings safety controls: destructive Danger Zone actions now require recent re-auth in repository layer, explicit typed confirmations are enforced in UI, and archived categories are hidden from active budget/category management views (`lib/data/settings.ts`, `app/settings/danger/client.tsx`, `app/settings/categories/client.tsx`).
- Completed Settings UX polish pass: improved active-nav highlighting, sticky section nav, clearer card hierarchy, reusable `?` help-tip component across settings cards, and cleaner inline success badges for save feedback (`app/settings/_components/help-tip.tsx`, `app/settings/_components/settings-nav.tsx`, `app/settings/budget/client.tsx`, `app/settings/profile/client.tsx`, `app/settings/security/client.tsx`, `app/settings/goals/client.tsx`, `app/settings/notifications/client.tsx`, `app/settings/privacy/client.tsx`, `app/settings/appearance/client.tsx`, `app/settings/account/page.tsx`).
- Cleaned obsolete settings implementation path by removing the deprecated monolithic client panel file (`app/settings/client.tsx`).
- Verification checkpoints after settings restructure and baseline-engine/currency upgrade: `pnpm prisma migrate deploy` pass (applied `20260226133000_settings_sections`, `20260226152000_frequency_baseline_engine`, and `20260226161000_fx_rate_cache`), `pnpm prisma generate` pass, `pnpm run test` pass, `pnpm run build` pass.

### 2026-02-25
- Budget refinement follow-up shipped: fixed savings/expenditure category separation with normalized savings classification, restored auto-spend and preferred-spending cards on Budget page, replaced split charting with a single dual-line income-vs-expenditure graph, and added `?` hover/tap explainer tooltips on budget cards for clearer user guidance (`app/plan/client.tsx`, `components/feature/charts.tsx`, `lib/data/budgets.ts`, `lib/data/settings.ts`, `docs/PROJECT_STATUS.md`).
- Budget UX restructure completed per product direction: Budget page reverted to lively visual reporting mode (cards + progress + charts + badges, no inline editing), expenditure/savings panels are explicitly split with separate totals, and budget-plan editing was moved into Settings with a dedicated edit card for baseline fields plus category allocations (`app/plan/client.tsx`, `app/settings/client.tsx`, `app/settings/actions.ts`, `lib/data/settings.ts`, `app/settings/page.tsx`, `docs/PROJECT_STATUS.md`).
- Streamlined Simulation + Goals integration shipped: simulation form reduced to core fields (scenario/income/expenses/starting savings/horizon/optional target), goals now provide per-goal `Run in Simulation` deep links that prefill simulation inputs, and simulation output now emphasizes simple line projection + summary cards + plain-language advice for affordability decisions (`app/simulate/page.tsx`, `app/simulate/client.tsx`, `app/goals/client.tsx`, `lib/data/simulations.ts`, `docs/PROJECT_STATUS.md`).
- Rebuilt app page responsibilities around fixed-plan + live-actual model: Budget page is now baseline/reporting focused (non-daily-edit flow), Transactions page is now the real-time money feed with top money cards, simple spend-vs-plan progress bar, quick actions, filterable feed, and plain-language budget-impact drift messaging, and Goals page now computes affordability guidance from baseline + actual transaction flow with monthly/weekly save suggestions and time-to-goal indicators (`app/plan/client.tsx`, `app/plan/page.tsx`, `app/track/page.tsx`, `app/track/feed-client.tsx`, `app/track/client-form.tsx`, `lib/data/budgets.ts`, `lib/data/transactions.ts`, `app/goals/page.tsx`, `app/goals/client.tsx`, `lib/data/goals.ts`, `docs/PROJECT_STATUS.md`).
- Added onboarding baseline-plan capture fields and persistence (`baselineIncome`, `baselineExpense`, `baselineSavings`, `dailySpendEstimate`) with optional auto-derivation of daily spend estimate from baseline budget category allocations (Food/Transport/Utilities), plus migration scaffold for production rollout (`prisma/schema.prisma`, `prisma/migrations/20260225113000_baseline_plan_fields/migration.sql`, `app/onboarding/client.tsx`, `app/onboarding/actions.ts`, `lib/data/onboarding.ts`).

### 2026-02-23
- Simplified Budget page to target-driven flow only: removed transaction-spent dependencies/cards from planner UI and data query path, replaced with expenditure/savings target-alignment status cards, and kept category totals directly compared to budgeted targets for clear over-target guidance (`app/plan/client.tsx`, `lib/data/budgets.ts`, `docs/PROJECT_STATUS.md`).
- Budget page refinement pass shipped: graph now renders explicit axis tick values/point labels, budgeted expense+savings cards are clickable jump links to new read-only breakdown cards, setup inputs were simplified and now include a `Daily` scope, pace cards auto-hide when baseline data is missing/non-distinct, and preferred spending schedule now recalculates across daily/weekly/monthly/yearly/horizon windows with 1-75 year phase totals (`app/plan/client.tsx`, `components/feature/charts.tsx`, `docs/PROJECT_STATUS.md`).
- Resolved budget save transaction timeout by replacing interactive per-item lookups with batched upsert/delete operations and added friendly plan action error messages (`lib/data/budgets.ts`, `app/plan/actions.ts`, `docs/PROJECT_STATUS.md`).
- Redesigned Budget page flow per product model: top projection cards+single budget graph, read-only input bar with edit jump, scoped preferred spending schedule, and typed expenditure/savings allocation editor with add-new categories (`app/plan/client.tsx`, `app/plan/actions.ts`, `lib/data/budgets.ts`, `docs/PROJECT_STATUS.md`).
- Implemented unified budget model enhancements (future goals + rollover controls), added dedicated Goals/Goal-Planner pages, and tuned navigation/protected routes for smoother budgeting workflow (`app/plan/client.tsx`, `app/goals/page.tsx`, `app/goals/client.tsx`, `app/goals/actions.ts`, `app/goal-planner/page.tsx`, `lib/data/goals.ts`, `components/shell/app-shell.tsx`, `middleware.ts`, `components/feature/quick-actions.tsx`, `app/dashboard/page.tsx`, `docs/PROJECT_STATUS.md`).
- Rebuilt Budget page core form around monthly income, expenditure, and savings with wired category allocation distribution and improved plan-vs-actual usability (`app/plan/client.tsx`, `docs/PROJECT_STATUS.md`).
- Restructured Budget page into a plan-vs-actual command center with live cards, clearer flow links to Transactions/Simulations, and chart guidance to make budgeting easier to operate (`app/plan/page.tsx`, `app/plan/client.tsx`, `docs/PROJECT_STATUS.md`).
- Added explicit graph explanations and X/Y axis descriptions across Transactions and Simulations chart sections (`app/track/page.tsx`, `app/simulate/client.tsx`, `docs/PROJECT_STATUS.md`).
- Enhanced simulations with scenario ID re-access links/query loading and added expanded stress preset pack for tougher multi-case projection testing (`app/simulate/page.tsx`, `app/simulate/client.tsx`, `app/simulate/actions.ts`, `lib/data/simulations.ts`, `docs/PROJECT_STATUS.md`).
- Converted /track into Transactions flow with income+expense capture, unified transaction feed, and fully data-driven today/month cards and charts (`app/track/page.tsx`, `app/track/client-form.tsx`, `app/track/actions.ts`, `lib/data/transactions.ts`, `app/api/offline/sync/route.ts`, `lib/offline/quick-expense-queue.ts`, `components/shell/app-shell.tsx`, `components/feature/quick-actions.tsx`, `app/dashboard/page.tsx`, `docs/PROJECT_STATUS.md`).
- Fixed Today running total ingestion by saving same-day entries with current timestamp to avoid date-only timezone drift (`app/track/client-form.tsx`, `docs/PROJECT_STATUS.md`).
- Hardened status-update script to support optional -- and aligned README command usage (`tools/update-status.mjs`, `README.md`, `docs/PROJECT_STATUS.md`).
- Added production+UX readiness checklist and status-update automation command (`tools/update-status.mjs`, `docs/PRODUCTION_UX_CHECKLIST.md`, `package.json`, `README.md`).

### 2026-02-22
- Closed remaining PDF3 dashboard gaps by adding a dedicated category-spend widget (including top spend category summary) and explicit goal-progress aggregation metrics on Dashboard (`lib/data/dashboard.ts`, `app/dashboard/page.tsx`, `docs/pdf3-data-api-security/PDF3_TASKS_STATUS.md`).
- Security hardening pass completed across auth/session/API boundaries: removed unauthenticated demo fallback in standard flows, enforced auth on offline sync route, tightened push dispatch authorization, added constant-time secret comparison, and added rate limiting on high-risk endpoints (`lib/data/utils.ts`, `app/api/offline/sync/route.ts`, `app/api/push/dispatch/route.ts`, `app/api/contact/route.ts`, `lib/security/rate-limit.ts`).
- Strengthened session and re-auth logic: production-safe `AUTH_SECRET` handling, signed/timestamp-validated re-auth cookies, and improved sensitive-gate integrity (`lib/auth/session.ts`).
- Migrated password hash storage out of audit metadata into a dedicated credential table with migration scaffold and backward-compatible reads (`prisma/schema.prisma`, `prisma/migrations/20260221120000_auth_credentials/migration.sql`, `lib/data/auth.ts`).
- Stabilized auth UX/runtime after Server Action ID drift issues by moving login/signup flows to explicit API routes and wiring `/auth` client to those endpoints (`app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `app/auth/page.tsx`).
- Improved deployment reliability for Vercel/pnpm: build now generates Prisma client explicitly before Next build (`package.json` build script updated to `pnpm prisma:generate && next build`), with type dependency alignment for React 18.
- Product UX upgrade pass shipped: dashboard now includes money-status framing, income-vs-expense trend visuals, budget-pressure charts, and money-learning insight cards; Expenses, Budget, and Simulation pages now expose stronger planning/projection guidance (`app/dashboard/page.tsx`, `lib/data/dashboard.ts`, `app/track/page.tsx`, `lib/data/transactions.ts`, `app/plan/client.tsx`, `lib/data/budgets.ts`, `app/simulate/client.tsx`, `lib/data/simulations.ts`).
- Added reusable DB-failure fallback component and page-level graceful fetch error handling with retry UX across key dynamic routes (`components/feature/data-load-error.tsx`, `app/plan/page.tsx`, `app/track/page.tsx`, `app/simulate/page.tsx`, `app/notes/page.tsx`, `app/reminders/page.tsx`, `app/settings/page.tsx`, `app/profile/page.tsx`, `app/onboarding/page.tsx`).
- Budget input/output precision was standardized to two decimal places across planner entry, calculations, and saves (`app/plan/client.tsx`).
- App shell navigation behavior updated: desktop sidebar set to persistent on-scroll behavior; authenticated header logo now routes users to dashboard instead of marketing home (`components/shell/app-shell.tsx`).
- Verification checkpoints completed after the above updates: local `pnpm run build` passes and includes explicit Prisma client generation in build workflow.

### 2026-02-20
- Added initial living status document and consolidated whole-project summary.
- This file is now the single running build log and will be updated after each implementation update.
- Added offline queue foundation module for quick-expense capture using IndexedDB (`lib/offline/quick-expense-queue.ts`).
- Added offline sync API endpoint to replay queued quick-expense operations (`app/api/offline/sync/route.ts`).
- Wired quick-expense UI to queue on failure, auto-sync on reconnect, and manual sync controls (`app/track/client-form.tsx`).
- Verified after offline queue update: `pnpm run test` pass, `pnpm run build` pass.
- Refactored offline queue to a generic operation queue (`quick_expense_create`, `note_create`, `reminder_create`) with backward-compatible wrappers (`lib/offline/quick-expense-queue.ts`).
- Expanded offline sync API to process note and reminder creates in addition to quick expenses (`app/api/offline/sync/route.ts`).
- Wired notes/reminders UIs to queue failed creates, auto-sync on reconnect, and provide manual sync controls (`app/notes/client.tsx`, `app/reminders/client.tsx`).
- Added push subscription API endpoints (subscribe/unsubscribe) backed by audited server events (`app/api/push/subscribe/route.ts`, `app/api/push/unsubscribe/route.ts`).
- Added service-worker push and notification-click handlers (`public/sw.js`).
- Added settings UI controls to enable/disable browser push subscriptions (`components/feature/settings-client.tsx`).
- Verified after offline+push update: `pnpm run test` pass, `pnpm run build` pass.
- Added offline operation types for state toggles (`note_set_pinned`, `reminder_set_done`) and retry/backoff in sync flush with partial-failure reporting (`lib/offline/quick-expense-queue.ts`).
- Expanded offline sync route handlers to apply pinned/done state updates server-side (`app/api/offline/sync/route.ts`, `lib/data/notes.ts`, `lib/data/reminders.ts`).
- Wired offline fallback for note pin toggles and reminder done toggles in Notes and Reminders screens (`app/notes/client.tsx`, `app/reminders/client.tsx`, `app/track/client-form.tsx`).
- Added push dispatch preview endpoint for scheduled reminder targeting (header-secret aware, audit-logged) (`app/api/push/dispatch/route.ts`).
- Verified after toggle+dispatch updates: `pnpm run test` pass, `pnpm run build` pass.
- Improved sync conflict UX to include first failure reason in queue-sync messages on Track/Notes/Reminders.
- Verified after sync-conflict UX update: `pnpm run test` pass, `pnpm run build` pass.
- Added persistent `PushSubscription` data model and migration scaffold (`prisma/schema.prisma`, `prisma/migrations/20260220134000_push_subscriptions/migration.sql`).
- Switched push subscribe/unsubscribe/dispatch APIs to persistent subscription records instead of audit-log reconstruction (`app/api/push/subscribe/route.ts`, `app/api/push/unsubscribe/route.ts`, `app/api/push/dispatch/route.ts`).
- Added cron-dispatch usage guide + example command (`docs/PUSH_DISPATCH_CRON.md`).
- Moved CSP from report-only to enforced `Content-Security-Policy` header (`next.config.mjs`).
- Verified after push-table + CSP-enforce update: `pnpm run prisma:generate` pass, `pnpm run test` pass, `pnpm run build` pass.
- Release update: push subscriptions are now persisted as first-class records, dispatch is cron-ready, and CSP is in enforced mode with build/test/generate all green.
- Extended push dispatch to support explicit `dry-run/live` modes, VAPID env checks, live send attempts, and stale subscription deactivation in live mode (`app/api/push/dispatch/route.ts`).
- Updated dispatch runbook with live-mode command/query/header guidance and VAPID requirements (`docs/PUSH_DISPATCH_CRON.md`).
- Added README env guidance for push dispatch and VAPID keys (`README.md`).
- Verified after dispatch-live update: `pnpm run prisma:generate` pass, `pnpm run test` pass, `pnpm run build` pass (with one non-blocking warning: dynamic dependency expression in push dispatch for optional `web-push` loading).
- Installed `web-push` dependency successfully (`pnpm add web-push`).
- Refactored push dispatch route to static `web-push` import and removed dynamic module loading warning path (`app/api/push/dispatch/route.ts`).
- Verified after web-push/static-import update: `pnpm run prisma:generate` pass, `pnpm run test` pass, `pnpm run build` pass (no push dispatch warning).
- Added in-app Push Diagnostics controls in Settings for dry-run/live dispatch checks with optional dispatch-secret header and JSON result output (`components/feature/settings-client.tsx`).
- Added admin authorization model (`UserRole`, `isActive`) and migration scaffold for user access control (`prisma/schema.prisma`, `prisma/migrations/20260220171000_admin_role_controls/migration.sql`).
- Added admin permission guard and protected `/admin` route with user control panel (role updates + account enable/disable) (`lib/auth/permissions.ts`, `lib/data/admin.ts`, `app/admin/page.tsx`, `components/feature/admin-panel.tsx`, `app/admin/actions.ts`).
- Enforced inactive-account blocking in auth/session checks and login path, plus optional admin bootstrap via `ADMIN_EMAILS` (`lib/auth/session.ts`, `app/auth/actions.ts`, `lib/data/auth.ts`).
- Verified after admin-controls update: `pnpm run prisma:generate` pass, `pnpm run test` pass, `pnpm run build` pass.
- Added public marketing pages and company-facing site flow before login (`app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`).
- Upgraded shell to dual public/app navigation with authenticated user header badge and global footer branding for EyeHai Technologies (`components/shell/app-shell.tsx`, `app/layout.tsx`).
- Enhanced auth page cross-links to About/Contact for pre-login context (`app/auth/page.tsx`).
- Expanded landing page with explicit Features and FAQ sections, keeping pricing out for now (`app/page.tsx`).
- Added dedicated contact form backend and admin inbox pipeline for public inquiries (`app/api/contact/route.ts`, `components/feature/contact-form.tsx`, `prisma/schema.prisma`, `prisma/migrations/20260220182000_contact_inquiries/migration.sql`, `lib/data/admin.ts`, `app/admin/actions.ts`, `components/feature/admin-panel.tsx`).
- Improved public header mobile responsiveness with visible mobile nav links on non-app routes (`components/shell/app-shell.tsx`).
- Replaced seed script with deterministic admin + power-user fixture data covering auth, budgets, transactions, recurring rules, goals, notes, reminders, sandbox overrides, push subscription, and contact inbox records (`prisma/seed.ts`).
- Verified after seed update: `pnpm run prisma:generate` pass, `pnpm run test` pass.
- Updated seed runner command to `ts-node/esm/transpile-only` for reliable execution and clearer runtime errors (`package.json`).
- Verified seeded fixtures end-to-end: `pnpm prisma:seed` completed successfully with admin and test-user credentials printed.
- Updated app labeling and flow to emphasize budgeting and daily expenses: nav now shows `Budget` and `My Expenses`, with matching page/header language updates (`components/shell/app-shell.tsx`, `app/plan/page.tsx`, `app/track/page.tsx`, `app/dashboard/page.tsx`, `components/feature/quick-actions.tsx`).
- Refactored Notes into a dedicated notes-only workspace with better UX (search, pinned filter, saved-note access framing, cleaner layout) and removed reminder controls from Notes page (`app/notes/page.tsx`, `app/notes/client.tsx`, `app/notes/actions.ts`, `lib/data/notes.ts`).
- Added reminders calendar export for Apple/iOS via authenticated `.ics` endpoint and one-click export button on Reminders page (`app/api/reminders/ics/route.ts`, `app/reminders/page.tsx`).
- Verified after budget/notes/reminder-import update: `pnpm run test` pass, `pnpm run build` pass.
- Fixed transient Next.js runtime chunk error (`Cannot find module './754.js'`) by clearing stale build artifacts (`rm -rf .next`) and rebuilding successfully.
- Fixed hydration mismatch from locale-dependent date rendering in client components by switching note/reminder/admin timestamps to deterministic UTC string formatting (`app/notes/client.tsx`, `app/reminders/client.tsx`, `components/feature/admin-panel.tsx`).
- Encountered and resolved a follow-up transient Next page-module cache issue (`PageNotFoundError` for existing routes) via clean rebuild (`rm -rf .next && pnpm run build`).
- Hardened reminders creation UX/validation: blocked empty reminder submits client-side and converted server-side parse failure to friendly validation message (`app/reminders/client.tsx`, `app/reminders/actions.ts`).
- Recovered from dev-time `.next/routes-manifest.json` ENOENT cache corruption by restarting dev with clean `.next` (`rm -rf .next && pnpm dev`).
- Added consistent loading states across async buttons using shared `Button` support (`loading` prop + spinner), wired through auth/onboarding/budget/expenses/notes/reminders/simulations/settings/admin/contact flows (`components/ui/button.tsx` and related client components).
- Verified after loading-state rollout: `pnpm run build` pass.
- Simplified app header for user experience: removed `Admin` tab from top nav, removed signed-in email bar, removed top-right `Add expense` CTA, and renamed nav label `My Expenses` -> `Expenses` (`components/shell/app-shell.tsx`).
- Removed global-actions panels across app pages to reduce clutter (`app/dashboard/page.tsx`, `app/plan/page.tsx`, `app/notes/page.tsx`, `app/reminders/page.tsx`, `app/settings/page.tsx`, `app/simulate/page.tsx`).
- Hardened settings diagnostics rendering to avoid UI stalls from large payloads by showing a compact result preview (`components/feature/settings-client.tsx`).
- Reworked Expenses page into daily-expenditure workflow with today summary cards, today-only expenditure log, and cleaner recent/recurring sections (`lib/data/transactions.ts`, `app/track/page.tsx`).
- Verified after UX simplification + expenses redesign: `pnpm run test` pass, `pnpm run build` pass.
- Added friendly non-admin redirect messaging for admin route access: `/admin` now redirects unauthorized users to dashboard with clear notice (`app/admin/page.tsx`, `app/dashboard/page.tsx`).
- Verified after admin-redirect UX hardening: `pnpm run build` pass.
- Added global route loading UI via App Router `loading.tsx` so page transitions show a consistent loading state (`app/loading.tsx`).
- Improved public-header `Open app` / `Login` CTA to use explicit client-side navigation loading state instead of bare link behavior (`components/shell/app-shell.tsx`).
- Hardened dashboard against temporary DB outages with graceful fallback messaging and recovery actions instead of hard failure (`app/dashboard/page.tsx`).
- Verified after loading + DB fallback update: `pnpm run build` pass.
- Reworked authenticated app layout to match requested structure: desktop sidebar nav (`Dashboard`, `Budget`, `Expenses`, `Simulations`, `Notes`, `Reminders`), header with logo left and profile avatar right, and mobile slide-out side menu (`components/shell/app-shell.tsx`).
- Added dedicated personal profile page linked from header avatar (`app/profile/page.tsx`) and protected it via middleware (`middleware.ts`).
- Verified after sidebar/profile layout update: `pnpm run build` pass.
- Enhanced sidebar behavior and visual theming: desktop sidebar is now dynamically collapsible (open/close), does not stretch full page height, and content area expands smoothly; app shell uses lively blue gradient/background accents for warmer UI feel (`components/shell/app-shell.tsx`).
- Verified after dynamic sidebar + blue theming update: `pnpm run build` pass.
- Operational stability note: recurring `Cannot find module './754.js'` / manifest route chunk errors in dev were traced to stale `.next` artifacts and concurrent `next dev` processes for the same project. Reliable recovery is: stop all project dev processes, `rm -rf .next`, start a single `pnpm dev`.
- Restored `Settings` item in authenticated sidebar/menu navigation (`components/shell/app-shell.tsx`).
- Added `Log out` button to desktop sidebar and mobile side menu with loading-state feedback, wired to existing auth logout action (`components/shell/app-shell.tsx`).
- Updated public-header auth flow so CTA always routes to `/auth` (prevents bypassing login via conditional “Open app” behavior) and aligned footer login link (`components/shell/app-shell.tsx`).
- Rebuilt `/ai` into a local assistant that explains app pages, budget terms, and live Prisma-backed money data without calling an external AI API; added modern chat UI, guided prompts, app-map rail, and goal-aware help context (`app/ai/page.tsx`, `components/feature/app-assistant.tsx`, `lib/ai/local-assistant.ts`, `docs/AI_ASSISTANT.md`).
- Fixed public/auth dark-theme polish: menu toggles now actually flip state, public `Sign in` no longer renders with a white fill on dark surfaces, login/signup now sit in dark-friendly form shells with loading-state auth links, shared outline/alert components honor dark mode, and Terms contact/footer cards now use dark surfaces (`components/shell/app-shell.tsx`, `components/ui/theme-toggle.tsx`, `components/ui/button.tsx`, `components/ui/alert.tsx`, `app/login/page.tsx`, `app/login/view-client.tsx`, `app/signup/page.tsx`, `app/signup/view-client.tsx`, `app/legal/terms/page.tsx`).
- Rebuilt the client theme plumbing so the toggle applies a resolved theme consistently on the root element and shared form controls now read theme variables instead of depending only on Tailwind `dark:` classes; auth shells now use explicit theme-surface classes, which fixes white login/signup form backgrounds under dark mode (`components/ui/theme-toggle.tsx`, `app/layout.tsx`, `app/globals.css`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`).
- Closed the remaining theme leaks by moving shared `.card` and `Card` component surfaces onto theme variables, updating auth notice cards to those same surfaces, and rebuilding the dashboard cards/chart for dark-light parity; the dashboard also drops the confusing "Actual logged vs budget plan" block and now uses denser animated Y-axis chart ticks with extra top padding so peak points remain visible (`app/globals.css`, `components/ui/card.tsx`, `app/login/page.tsx`, `app/login/view-client.tsx`, `app/signup/view-client.tsx`, `app/dashboard/page.tsx`, `components/feature/charts.tsx`).
- Corrected dashboard planning math so planned expense budget usage excludes extra expense and extra savings, while savings rate now combines budgeted savings pace with extra savings contributions; renamed the user-facing `/ai` experience to `Assistant` with `/ai` redirect compatibility, added an Assistant complaint/feedback submission flow backed by a new `AssistantFeedback` Prisma model, and rebuilt the admin page with a searchable Assistant inbox for bulk complaint handling (`lib/data/dashboard.ts`, `app/dashboard/page.tsx`, `app/assistant/page.tsx`, `app/ai/page.tsx`, `components/shell/app-shell.tsx`, `components/feature/app-assistant.tsx`, `lib/ai/local-assistant.ts`, `app/assistant/actions.ts`, `lib/data/assistant-feedback.ts`, `prisma/schema.prisma`, `prisma/migrations/20260312121000_assistant_feedback_inbox/migration.sql`, `lib/data/admin.ts`, `app/admin/page.tsx`, `components/feature/admin-panel.tsx`, `docs/AI_ASSISTANT.md`).
- Reworked the shared app theme to behave uniformly across dark and light mode with a blue-inspired dark palette: added global rescue overrides for leftover light-only Tailwind tokens, gave native form controls theme-aware defaults, rebuilt internal app shell/header/sidebar surfaces around theme variables, refreshed auth/loading/error shells, and replaced the most visible light-only gradient cards so logged-in pages no longer keep unreadable dark text or white backgrounds after toggle (`app/globals.css`, `components/shell/app-shell.tsx`, `components/ui/button.tsx`, `components/shell/page-header.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx`, `app/plan/client.tsx`, `app/track/client-form.tsx`, `app/simulate/client.tsx`, `app/settings/_components/help-tip.tsx`, `app/settings/_components/settings-path.tsx`).
- Rebuilt the Assistant page UI for dark-mode reliability and better accessibility: deduped quick prompts, switched the summary cards to theme-safe tinted surfaces, added status/help context, stabilized message keys, and improved chat/feed semantics; also replaced dashboard help bubbles with outside-click/Escape popovers, added question-mark explanations to nearly every dashboard card group, and moved the Goal/Simulate confirmation dialogs onto a shared modal shell that closes on backdrop tap or Escape (`components/feature/app-assistant.tsx`, `components/ui/info-popover.tsx`, `components/ui/modal-dialog.tsx`, `app/dashboard/page.tsx`, `app/goals/client.tsx`, `app/simulate/client.tsx`).

## 8) Critical Handoff Notes (For New Chat)

### What is already done
- Core app flows (dashboard/plan/track/simulate/notes/reminders/settings/auth) are implemented and build cleanly.
- Offline queue + reconnect sync for creates/toggles is implemented across Track, Notes, and Reminders.
- Push subscriptions are persisted in database via `PushSubscription` model and migration.
- Push dispatch route supports `dry-run` and `live` modes with stale-endpoint deactivation logic.
- CSP is enforced (not report-only) and PWA baseline is present.
- Latest checks in this environment: `pnpm run prisma:generate`, `pnpm run test`, and `pnpm run build` all pass.

### Current blocker
- No package-level blocker remains for push dispatch.
- Remaining push risk is operational: live validation requires real subscriptions plus valid VAPID/dispatch-secret configuration in target runtime.

### Non-blocking warning
- Previously seen push-dispatch dynamic dependency warning is resolved after static `web-push` import update.

### Required environment variables (push)
- `PUSH_DISPATCH_SECRET`
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

### First actions in the next chat
1. Run verification in target environment: `pnpm run prisma:generate`, `pnpm run test`, `pnpm run build`.
2. Validate push flow end-to-end:
   - subscribe from Settings UI
   - run `/api/push/dispatch?mode=dry-run`
   - run `/api/push/dispatch?mode=live` with `x-push-dispatch-secret`
3. Capture live dispatch results in this status file (success/failure counts and stale deactivations).
ions).
