# Operations Runbook — MyplanMybudget

Last updated: 2026-03-04

---

## 1) DB Backup & Restore

### Backup (Neon / PostgreSQL)

```bash
# Dump full database (run from a machine with psql access)
pg_dump \
  "$DIRECT_URL" \
  --format=custom \
  --no-acl \
  --no-owner \
  -f "backup-$(date +%Y%m%d-%H%M%S).dump"
```

**Retention policy:** Keep daily backups for 7 days, weekly for 4 weeks, monthly for 12 months.

Neon also provides point-in-time restore in the console — enable branch restore for production.

### Restore

```bash
pg_restore \
  --no-acl \
  --no-owner \
  -d "$DIRECT_URL" \
  backup-YYYYMMDD-HHMMSS.dump
```

**Restore test cadence:** Run a restore test into a staging database at minimum once per month. Log the result in a shared doc.

---

## 2) Secret Rotation

### AUTH_SECRET / NEXTAUTH_SECRET
1. Generate new secret: `openssl rand -base64 64`
2. Update the secret in your hosting platform's env vars (Vercel → Settings → Environment Variables)
3. Rotate: old sessions will be invalidated (users will need to log in again — acceptable)
4. Deploy. Monitor error rates for 15 minutes.

### VAPID Keys (Push Notifications)
1. Generate new keys: `npx web-push generate-vapid-keys`
2. Update `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in env
3. Old push subscriptions will fail and be deactivated automatically on next dispatch (410/404 responses)
4. Users will need to re-subscribe to push notifications

### SMTP Credentials
1. Rotate in your email provider dashboard
2. Update `SMTP_USER`, `SMTP_PASS` in env
3. Send a test reminder to confirm delivery

### PUSH_DISPATCH_SECRET
1. Generate: `openssl rand -hex 32`
2. Update in env AND update any cron service headers that use it

---

## 3) Deploy Checklist

Before deploying to production:

- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm build` — clean build (no TypeScript errors)
- [ ] `pnpm run test:smoke` — smoke checks pass
- [ ] `pnpm prisma:generate` — Prisma client generated
- [ ] For schema changes: `pnpm prisma:migrate` has been run against the production DB
- [ ] No new required env vars added without updating Vercel env config
- [ ] Sentry DSN is set and Sentry is receiving events
- [ ] DB backup taken within 24h before the deploy

### Rollback checklist
1. Vercel → Deployments → pick the previous successful deploy → Promote to Production
2. If schema migration was applied: assess whether rollback SQL is safe (use `prisma/migrations/` to identify the migration)
3. Check `/api/auth/health` (admin-only) to confirm DB connectivity + role config after rollback

---

## 4) On-Call Runbook

### `/dashboard` errors
- Check: `app/dashboard/page.tsx`, `lib/data/dashboard.ts`
- Common cause: DB connection timeout → check Neon health dashboard
- Common cause: `DB_IDENTITY_REQUIRED` error → session/cookie issue → check NextAuth config
- Action: Check Sentry for the `digest` error reference; share in incident channel

### `/track` (transactions) errors
- Check: `app/track/page.tsx`, `lib/data/transactions.ts`
- Common cause: Advisory lock timeout → retry is usually sufficient
- Common cause: Category not found → user's categories may have been deleted

### `/auth` (login/signup) errors
- Check: `app/auth/`, `lib/auth/session.ts`, `auth.ts`
- Common cause: `NEXTAUTH_SECRET` / `AUTH_SECRET` mismatch
- Common cause: `DATABASE_URL` (pooled) connection saturation → check Neon connection counts
- Production auth health: GET `/api/auth/health` (requires admin session)

### Push dispatch not delivering
- Check: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` are set
- Run dry-run: `curl -X POST "$APP_URL/api/push/dispatch?mode=dry-run" -H "x-push-dispatch-secret: $PUSH_DISPATCH_SECRET"`
- Run live: change `mode=dry-run` to `mode=live`
- If subscriptions return 404/410 they are auto-deactivated — normal behaviour

### High DB latency (slow_query logs)
- Threshold: `SLOW_QUERY_MS=700` (default), operations: `OP_SLOW_MS=1200`
- Check Neon compute unit scaling — may need to upgrade tier
- Check for missing indexes: `prisma studio` → browse large tables
- Enable `PERF_LOGS=true` in production temporarily to capture slow query details

---

## 5) Performance Baselines

Target for production readiness (from PRODUCTION_UX_CHECKLIST.md):
- P75 page load for `/dashboard` and `/track` under mobile network target (< 3s)
- P75 DB query time < 700ms (`SLOW_QUERY_MS` threshold)

Measure using Vercel Analytics + Sentry Performance traces.

---

## 6) Health Check

`GET /api/auth/health` (admin session required)

Returns: env validation, DB latency for runtime + admin clients, warnings.

Suggested uptime check: ping this endpoint every 5 minutes via an external monitor (UptimeRobot, BetterUptime, etc.) with an admin session cookie, or create a separate unauthenticated `/api/health` endpoint returning HTTP 200.
