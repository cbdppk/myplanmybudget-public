# Push Dispatch Cron

Last updated: 2026-02-20

## Purpose

Trigger reminder push dispatch preview/run via:
- `POST /api/push/dispatch`

The route:
- Authenticates with `x-push-dispatch-secret` if `PUSH_DISPATCH_SECRET` is set.
- Falls back to normal app auth when the secret is not configured.
- Scans active push subscriptions and reminders due in the next 24 hours.
- Supports two modes:
  - `dry-run` (default): preview only
  - `live`: attempts actual web-push sends

## Required env

- `PUSH_DISPATCH_SECRET` (recommended for machine-triggered runs)
- `VAPID_SUBJECT` (required for `live`)
- `VAPID_PUBLIC_KEY` (required for `live`)
- `VAPID_PRIVATE_KEY` (required for `live`)

## Example local/manual command

```bash
curl -X POST "http://localhost:3000/api/push/dispatch" \
  -H "x-push-dispatch-secret: $PUSH_DISPATCH_SECRET" \
  -H "content-type: application/json"
```

Live mode example:

```bash
curl -X POST "http://localhost:3000/api/push/dispatch?mode=live" \
  -H "x-push-dispatch-secret: $PUSH_DISPATCH_SECRET" \
  -H "content-type: application/json"
```

## Vercel Cron example

If using Vercel cron, configure a schedule and hit:

- Path: `/api/push/dispatch`
- Method: `POST`
- Header: `x-push-dispatch-secret: <same value as PUSH_DISPATCH_SECRET>`
- Query: `?mode=live` (if you want actual sends; omit for dry-run)

Suggested schedule to start:
- `0 */6 * * *` (every 6 hours)

Then tighten cadence after monitoring.

## Current behavior

Live mode requires the `web-push` package to be installed in the runtime environment.
If it is unavailable, the endpoint returns `501` with an actionable error message.
