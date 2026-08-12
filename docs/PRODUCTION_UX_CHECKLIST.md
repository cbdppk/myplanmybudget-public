# Production + UX Checklist

Last reviewed: 2026-02-23

## 1) User-friendliness priorities (next sprint)

- Make all core charts readable at a glance:
  - direct labels on bars/lines
  - shared scales for any comparison charts
  - one-line "how to read this chart" text on each chart card
- Improve "new user empty states":
  - first-time tooltips on Dashboard, Expenses, Budget
  - CTA buttons that lead to next step ("Add first expense", "Set first budget")
- Add fast transaction entry UX:
  - quick amount chips (`5`, `10`, `20`, `50`)
  - category recents/favorites
  - mobile numeric keypad optimized flow
- Improve trust messaging:
  - always show "spent vs income" status in green/red with plain language
  - avoid finance jargon in headings/subtitles
- Add per-page help:
  - short info popover explaining terms: burn rate, projection, spend ratio

## 2) Production readiness priorities

- Reliability:
  - Add error tracking (Sentry or equivalent) for server/client/runtime exceptions
  - Add structured request logs and basic audit dashboard
  - Add health endpoint + uptime checks
- Security:
  - Force secure cookies and strict env validation at startup
  - Add automated secret rotation procedure doc
  - Add brute-force and abuse protections to all sensitive routes
- Quality gates:
  - Add CI pipeline with required checks: `pnpm run test`, `pnpm run build`
  - Add smoke tests for auth, expenses add flow, export flow
  - Add regression tests for chart data mapping and projection logic
- Data safety:
  - Add DB backup/restore runbook with restore test cadence
  - Add migration rollback strategy document
  - Add retention policy for logs/audit data
- Operations:
  - Add deploy checklist and rollback checklist
  - Add on-call runbook for critical pages (`/dashboard`, `/track`, `/auth`)

## 3) Done criteria before production launch

- P0/P1 bugs are zero for auth, expenses, budget, export.
- CI checks are required and green on main.
- Runtime monitoring + alerting are active.
- Backup restore test has passed within last 30 days.
- End-to-end push dispatch live test passed with production config.
- Performance baseline:
  - P75 page load under target for dashboard/expenses on mobile network.

## 4) Status file discipline (required)

- Every app change must also update `docs/PROJECT_STATUS.md`.
- Use command:

```bash
pnpm status:update -- "short summary of the update" app/track/page.tsx lib/data/transactions.ts
```

- Keep summary as one bullet, outcome-focused, with touched files listed.
- Run this before final build verification and before handing off.
