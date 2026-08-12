# MyplanMybudget — Production Readiness Roadmap

Last updated: **2026-03-05**

This document tracks every gap between the current MVP+ state and a polished, trustworthy production app. Use it as a living checklist before and after each release. Update status fields as items are completed.

---

## Current Score: ~6 / 10

| Area | Score | Blocker? |
|------|-------|----------|
| Security (auth + server actions) | 8/10 | All critical guards fixed + per-user rate limits |
| Security headers | 8/10 | HSTS + Permissions-Policy + CSP reporting |
| Math / simulation engine | 8/10 | Interest rounding + tie-breaking fixed |
| Observability | 6/10 | Sentry present; audit trail wired into mutations |
| UX polish | 6/10 | Skeleton screens added; toast system live |
| Accessibility | 4/10 | Skip-nav + ARIA on nav added |
| CI/CD | 7/10 | Lint + audit + Dependabot configured |
| Performance | 6/10 | Bundle analyzer added; dynamic imports pending |
| Data safety | 7/10 | Backup + rollback runbook documented |

---

## TIER 1 — Ship Blockers (must be done before public launch)

### ✅ DONE — 2026-03-04

- [x] Remove `allowDangerousEmailAccountLinking` from Google OAuth (`auth.ts`)
- [x] Auth secret strength validation at startup (`auth.ts`) — throws if < 32 chars
- [x] `requireUser()` added as first call in all server actions: goals, notes, plan, reminders, simulate, budget, onboarding
- [x] `requireAdmin()` + rate limiting (20 req/min) added to admin actions (`app/admin/actions.ts`)
- [x] HTML escaping in reminder email templates (`app/reminders/actions.ts`)
- [x] HSTS header (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) added to middleware
- [x] `Permissions-Policy` header added to middleware (restricts camera, mic, geolocation)
- [x] CSP `report-uri /api/csp-report` added — violations now logged server-side
- [x] Rate limiting on export endpoints (10 req/15 min per user) — `app/api/export/csv` + `app/api/export/json`
- [x] Missing DB index on `RecurringRule [active, nextRunAt]` added to schema
- [x] Skip-navigation link added to AppShell for keyboard accessibility
- [x] Viewport meta tag added to layout
- [x] Session idle-timeout (30 min) — auto-logout added to AppShell
- [x] ESLint + `pnpm audit` security scan added to CI pipeline

### 🔲 REMAINING — Tier 1

- [x] **DB backup runbook** — documented in `docs/OPERATIONS.md` (backup, restore, retention, point-in-time restore)
- [x] **Audit trail for financial mutations** — `logAudit()` helper in `lib/data/audit.ts` wired into transaction_create, budget_targets_save, budget_edit_save, goal_create, goal_update_progress, goal_delete
- [x] **Migration rollback strategy** — documented in `docs/OPERATIONS.md` (Vercel rollback + Prisma migration assess)
- [ ] **CSP reporting dashboard** — `/api/csp-report` logs to console; route violations to Sentry or a DB table for review.

---

## TIER 2 — UX Parity with Polished Apps (~3 weeks)

- [x] **Skeleton screens** — `app/loading.tsx` + `app/dashboard/loading.tsx` replaced with layout-matched animate-pulse skeleton cards. `app/simulate/loading.tsx` already had skeletons.
- [ ] **Suspense boundaries** — wrap each data section in dashboard/track with `<Suspense fallback={<Skeleton />}>` so partial content shows while slow queries load.
- [ ] **Optimistic UI** — transaction add and budget save should update the list instantly before server confirms. Use `useOptimistic` hook.
- [x] **Toast / notification system** — `sonner` installed; `<Toaster />` mounted in root layout via `components/ui/toaster.tsx`. Import `toast` from `"sonner"` in any client component.
- [ ] **Wire toasts into form components** — add `toast.success()` / `toast.error()` calls in transaction, budget, goal, reminder, note form submissions.
- [ ] **Empty states with CTAs** — new user sees blank pages. Add illustrated empty states with action buttons: "Add first expense →", "Set first budget →", "Create a goal →"
- [ ] **Fast transaction entry UX** — amount quick-chips ($5, $10, $20, $50), category recents, numeric keypad mode on mobile. Core daily action must be < 3 taps.
- [ ] **Recharts integration** — replace basic SVG charts with interactive Recharts components (bar, line, pie) as specified in deep research PDF. Files: `components/charts/*`
- [ ] **Amortization breakdown in simulation** — show month-by-month principal/interest split table in `/simulate` results.

---

## TIER 3 — Accessibility (WCAG AA target) (~2 weeks)

- [x] Skip-navigation link — added to AppShell
- [ ] **ARIA labels on all form inputs** — every `<Input>` must have either `aria-label` or an associated `<Label htmlFor="...">`. Audit all feature form components.
- [ ] **Focus indicators** — verify all interactive elements (links, buttons, inputs) have visible focus rings. Current `focus-visible:ring` on Button + Input is good; verify nav links.
- [ ] **Color contrast audit** — run axe or Lighthouse accessibility audit on dashboard status indicators (green/red). Target WCAG AA (4.5:1 ratio).
- [ ] **Chart accessible fallbacks** — each chart needs an accessible data table alternative or `aria-label` with summary text (e.g. "Total expenses: $1,234 this month").
- [ ] **Semantic HTML forms** — ensure all forms use `<form>` elements with proper `action`/`onSubmit`, not bare `<div>` wrappers.
- [ ] **Keyboard navigation testing** — manually tab through dashboard → add transaction → budget page. Fix any focus traps.
- [ ] **Screen reader testing** — test with VoiceOver (macOS) on the main flows: login, add transaction, view dashboard.

---

## TIER 4 — Security Hardening (~1 week)

- [x] **Session inactivity timeout** — `IdleLogout` component auto-logs out after 30 min of no browser activity
- [ ] **2FA / TOTP** — add `otplib` + QR code setup in `/settings/security`. Require TOTP on re-auth for export. This is essential for a financial app.
- [ ] **Field-level encryption for PII** — encrypt `email` and `baselineIncome` fields using a server-side key. Neon + Prisma support this via client extensions.
- [x] **Rate limiting on offline sync endpoint** — per-user rate limit (120 req/min) added on top of existing IP-based limit.
- [ ] **CSRF token validation** — Server Actions are CSRF-safe by default in Next.js 14+. Verify no plain POST API routes bypass this.
- [x] **Dependency vulnerability scanning** — `pnpm audit` in CI + Dependabot configured (`.github/dependabot.yml`) for weekly npm + GitHub Actions updates.

---

## TIER 5 — Performance & CI (~1 week)

- [x] **Bundle analyzer** — `@next/bundle-analyzer` installed; run `pnpm analyze` to inspect bundle. Target: main JS bundle < 150KB gzipped.
- [ ] **Lazy-load heavy components** — `import dynamic from 'next/dynamic'` for chart components and simulation engine UI.
- [ ] **`Cache-Control` headers on static API responses** — e.g. health endpoint, public pages.
- [ ] **ESLint step in CI** — added 2026-03-04. Fix all warnings surfaced.
- [ ] **Playwright E2E tests** — cover: login → add transaction → view dashboard → export CSV → logout. Run in CI on pull requests.
- [ ] **Lighthouse CI** — add `lhci` to CI; block merges if Performance score drops below 70 or Accessibility below 90.
- [ ] **`@next/bundle-analyzer` size tracking** — alert in CI if bundle grows > 10% between PRs.
- [ ] **DB index review post-launch** — after 30 days of real traffic, run `EXPLAIN ANALYZE` on slow query log and add any missing indexes.

---

## TIER 6 — Future Features (Post-launch)

- [ ] **Multi-account / family sharing** — Workspace/Organization model, invite by email, shared budget view.
- [ ] **Stripe billing integration** — tiered plans (free/pro), usage limits, billing portal.
- [ ] **Feature flags** — integrate `@vercel/flags` or `unleash` for gradual rollout of new features.
- [ ] **Email reminder dispatch** — push channel works; email dispatch via cron needs live runtime validation.
- [ ] **Richer recurring rule engine** — biweekly, quarterly cadences; last-day-of-month support.
- [ ] **Goal auto-funding** — automatically transfer surplus to goal accounts at period close.
- [ ] **Bank import (CSV/OFX)** — let users upload bank exports and auto-categorise transactions.
- [ ] **Currency exchange rates** — live FX rates for multi-currency users (FxRateCache model exists; needs live feed).

---

## Done Criteria Before Public Launch

All of these must be true before inviting real users:

- [ ] Zero CRITICAL/HIGH security issues (see security audit 2026-03-04)
- [ ] CI is green on main (typecheck + unit tests + build + smoke tests + lint)
- [ ] Sentry error tracking active in production with alert rules
- [ ] DB backup confirmed working (restore test passed)
- [ ] HSTS, CSP enforced, Permissions-Policy set (done 2026-03-04)
- [ ] P75 dashboard load < 3s on simulated 4G mobile (Lighthouse)
- [ ] Accessibility score ≥ 80 in Lighthouse
- [ ] Auth flows fully tested: signup, login, Google OAuth, logout, re-auth, export
- [ ] Push dispatch live test passed with production VAPID keys
- [ ] No `.env` secrets committed; secret rotation procedure documented

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-04 | Claude Code | Security audit: fixed CRITICAL auth guards, OAuth flag, HTML escaping, admin rate limiting, sim engine math, 7 new tests |
| 2026-03-04 | Claude Code | Production hardening: HSTS, Permissions-Policy, CSP report endpoint, export rate limits, DB indexes, skip-nav, idle timeout, CI improvements |
| 2026-03-05 | Claude Code | Audit trail (logAudit in transactions/budgets/goals), sonner toasts, skeleton screens, Dependabot, bundle analyzer, per-user offline sync rate limit |
