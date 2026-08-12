# Production Readiness Audit

**Date:** 2026-03-11
**Status:** Pre-launch — NOT production-ready yet
**Build:** ✓ Compiles clean

---

## Summary

| Category | Status | Priority |
|---|---|---|
| Security — auth & RLS | ✓ Solid | — |
| Security — CSP & headers | ✓ Solid | — |
| Security — AsyncLocalStorage cache | ⚠ Disabled | HIGH |
| Missing images (9 image slots) | ⚠ Placeholders only | HIGH |
| Google OAuth callback URL | ⚠ Not confirmed in Google Console | HIGH |
| `ANTHROPIC_API_KEY` not set | ⚠ AI on standby | MEDIUM |
| "Free forever" messaging removed | ✓ Done | — |
| Landing page — no real images | ⚠ Placeholders | HIGH |
| About page — old amber/gold styling | ⚠ Not yet on blue theme | MEDIUM |
| Rate limiting (AI route) | ✓ Implemented | — |
| Environment vars — production | ⚠ Check all required | HIGH |
| No `.env` committed to git | ✓ (verify .gitignore) | — |
| Push notifications VAPID keys | ⚠ Check if set | MEDIUM |
| SMTP credentials | ⚠ Check if set | MEDIUM |
| Demo account seeded | ⚠ Needs review | LOW |
| Admin email configured | ⚠ `ppk@example.com` is a placeholder | HIGH |

---

## Critical Blockers (must fix before launch)

### 1. AsyncLocalStorage cache is disabled — potential request leak in dev

**File:** `lib/security/db-context.ts`
**Risk:** The per-request cache that isolates DB identity between concurrent requests is commented out. In development, `AsyncLocalStorage.enterWith()` is used without `storage.run()`, which can leak RLS context across requests in some Node.js concurrency situations.
**Fix needed:** Wrap each request in `storage.run(...)` at the middleware or route handler level before calling `enterWith()`. Until this is fixed, avoid running in high-concurrency production without verifying isolation is correct.

---

### 2. ADMIN_EMAILS is a placeholder

**File:** `.env`
**Current value:** `ppk@example.com`
**Risk:** Admin routes/actions would grant admin access to the wrong email.
**Fix:** Change to the real admin email before deploying.

---

### 3. Google OAuth redirect URI not confirmed

The Google Cloud Console must have **exactly** this registered:
```
https://your-production-domain.com/api/auth/callback/google
```
And for local dev: `http://localhost:3000/api/auth/callback/google`

Also set in `.env`:
```
AUTH_URL=https://your-production-domain.com
NEXTAUTH_URL=https://your-production-domain.com
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

---

### 4. All 9 landing page images are placeholders

The landing page shows placeholder boxes for all hero and feature images. These must be replaced before any public launch.

**Images needed in `/public/images/`:**

| File | Where used |
|---|---|
| `hero-bg.jpg` | Full-screen hero background |
| `hero-card-1.jpg` | Hero "Budget" card |
| `hero-card-2.jpg` | Hero "Goals" card |
| `hero-card-3.jpg` | Hero "Freedom" card |
| `feature-budget.jpg` | Budget section |
| `feature-track.jpg` | Transactions section |
| `feature-goals.jpg` | Goals section |
| `feature-ai.jpg` | AI assistant section |
| `feature-sim.jpg` | Simulations section |

Plus the about page still references:
- `about-hero.png` (needs replacing)
- `about-team.png` (needs replacing or removing)

---

### 5. Environment variables — full production checklist

| Variable | Dev | Production |
|---|---|---|
| `DATABASE_URL` | ✓ Neon pooled | Must be set |
| `DIRECT_URL` | ✓ Neon direct | Must be set |
| `AUTH_SECRET` | ✓ Set | Rotate to a new strong secret |
| `NEXTAUTH_SECRET` | ✓ Set | Same as AUTH_SECRET |
| `AUTH_URL` | ✓ localhost:3000 | Set to production domain |
| `NEXTAUTH_URL` | ✓ localhost:3000 | Set to production domain |
| `GOOGLE_CLIENT_ID` | ✓ Set | Same (if same app) |
| `GOOGLE_CLIENT_SECRET` | ✓ Set | Same (if same app) |
| `ADMIN_EMAILS` | ⚠ Placeholder | **Must change** |
| `ANTHROPIC_API_KEY` | ✗ Not set | Set to enable AI features |
| `VAPID_PUBLIC_KEY` | ? | Check .env.example |
| `VAPID_PRIVATE_KEY` | ? | Check .env.example |
| `SMTP_*` | ? | Set for email reminders |

---

## Non-blocking Issues

### UI — About page uses old amber/gold styling
The about page still renders amber-coloured elements (kicker text, button) from the pre-blue design. It should be updated to match the new dark blue theme.

### UI — Landing page CTA buttons in about page use `bg-amber-500`
Needs updating to `bg-[#2563eb]` to match the new brand.

### Data — Daily Flex Room shows 0 when no budget surplus
If planned income equals planned expenses + savings exactly, the Daily Flex Room shows GHS 0/day. This is mathematically correct but can confuse new users. Add a tooltip hint when this is zero.

### AI page — local assistant doesn't have conversational context
The local assistant reads live data but cannot remember previous messages beyond the current page session. Users who navigate away lose their conversation. This is by design (no DB persistence) but users may find it confusing.

### Missing `ANTHROPIC_API_KEY` = AI route returns 503
The `/api/ai/chat` route returns HTTP 503 when the key is not set. The `/ai` page (Money Coach) currently uses the local assistant and doesn't call this route, so it works without the key. When the Anthropic integration is activated, the key must be set.

### Simulations — sandbox data isolation
The simulation engine writes to a `Sandbox` table, not the main transaction table. Verify that no simulation data can leak into live budget data — especially through the `ensureCurrentBudgetPeriod` logic.

### Push notifications — unverified in production
Push subscriptions are stored and VAPID keys are referenced in `.env.example`. If VAPID keys are not set in production, push notification registration will fail silently. Add a health check that verifies the keys are present.

---

## Security Posture (what IS solid)

| Protection | Status |
|---|---|
| JWT auth with AUTH_SECRET validation | ✓ |
| Row-Level Security (RLS) per user | ✓ |
| CSP headers (strict in production) | ✓ |
| HSTS, X-Frame-Options, Referrer-Policy | ✓ |
| Rate limiting on AI route (8/24h per user) | ✓ |
| TOTP 2FA support built in | ✓ |
| No secrets in schema or client code | ✓ |
| Account disabled check on every request | ✓ |
| Idle logout (30 min inactivity) | ✓ |
| Audit log on sensitive actions | ✓ |
| Input validation via Zod on all server actions | ✓ |
| No SQL injection (Prisma parameterized) | ✓ |

---

## Production Launch Sequence

```
1. Replace ADMIN_EMAILS in .env
2. Set AUTH_URL and NEXTAUTH_URL to production domain
3. Rotate AUTH_SECRET to a new 64-char random string
4. Add Google OAuth production redirect URI in Google Console
5. Set ANTHROPIC_API_KEY (when AI goes live)
6. Set VAPID keys for push notifications
7. Set SMTP credentials for email reminders
8. Drop all 9 landing page images into /public/images/
9. Replace about-hero.png and about-team.png
10. Fix AsyncLocalStorage cache in lib/security/db-context.ts
11. Run: pnpm build && pnpm start (verify no runtime errors)
12. Test Google login end-to-end
13. Test a full budget cycle (onboard → budget → transaction → dashboard)
14. Load test with > 10 concurrent users to verify RLS isolation
```
