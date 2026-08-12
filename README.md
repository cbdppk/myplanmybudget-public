# MyplanMybudget — Product MVP (Next.js + Prisma)

This repository now contains a working MVP for **MyplanMybudget** aligned to PDF1 Product scope.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma data layer (Postgres schema + local offline shim runtime in this environment)
- Server Actions pattern
- Cookie-based auth/session + route protection middleware

## Quick start
```bash
pnpm i
cp .env.example .env
```

Set DB URLs in `.env`:
- `DATABASE_URL` = primary app runtime connection string (non-bypass RLS role)
- `DIRECT_URL` = direct owner/admin connection string (migrations only)
- For Vercel project env vars, paste raw URLs without wrapping quotes.

Optional push dispatch vars:
- `PUSH_DISPATCH_SECRET` = secret for `/api/push/dispatch` machine calls
- `VAPID_SUBJECT` = mailto/url subject for web-push
- `VAPID_PUBLIC_KEY` = VAPID public key (used by client subscribe flow)
- `VAPID_PRIVATE_KEY` = VAPID private key (used for live dispatch mode)

Optional admin bootstrap var:
- `ADMIN_EMAILS` = comma-separated emails that should be auto-promoted to admin on signup/login

Required for `pnpm prisma:seed`:
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` = local seeded administrator credentials
- `SEED_USER_EMAIL` and `SEED_USER_PASSWORD` = local seeded user credentials
- Keep these values in your untracked `.env`; the seed command never prints passwords.

Optional DB identity strictness var:
- `DB_IDENTITY_STRICT` = `true` to force per-query strict DB identity/RLS wiring. When `DATABASE_URL` uses an RLS runtime user (for example `app_runtime_user`), strict mode is auto-forced even in local dev.

Optional observability vars:
- `PERF_LOGS` = `true` to emit slow-query/slow-operation logs (default off)
- `SLOW_QUERY_MS` = Prisma query slow threshold (ms)
- `OP_SLOW_MS` = high-level route/data operation slow threshold (ms)
- `DB_TX_MAX_WAIT_MS` = max wait for identity-wrapped Prisma transactions to acquire DB resources
- `DB_TX_TIMEOUT_MS` = timeout for identity-wrapped Prisma transactions

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

## Verification commands
```bash
pnpm run test
pnpm build
pnpm run test:smoke
```

## E2E (Playwright)
Install Chromium once:
```bash
pnpm exec playwright install --with-deps chromium
```

Run E2E:
```bash
pnpm test:e2e
```

Notes:
- Do not append inline text/comments on the install command line.
- By default, Playwright now runs this app on `http://127.0.0.1:3100` to avoid port `3000` conflicts with other local projects.

## CI
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Runs on each push to `main` and all pull requests:
  - install
  - prisma generate
  - typecheck
  - tests
  - production build
  - smoke flow check

## Product docs
Regenerate PDF1 Product spec from source:
```bash
python3 docs/pdf1-product/generate_pdf.py
```

Source file:
- `docs/pdf1-product/PDF1_PRODUCT.md`
- `docs/PUSH_DISPATCH_CRON.md` (push dispatch schedule/run guide)

Generated outputs:
- `docs/MyplanMybudget_PDF1_Product_UX.pdf`
- `docs/MyplanMybudget_PDF1_Product_UX (1).pdf`

## Status update workflow (required)
Every implementation update should append a bullet in `docs/PROJECT_STATUS.md`.

Use:
```bash
pnpm status:update "short summary of what changed" path/to/file1 path/to/file2
```

Reference checklist:
- `docs/PRODUCTION_UX_CHECKLIST.md`

## Notes
- Auth/session utilities are implemented in `lib/auth`.
- Protected routes are enforced in `middleware.ts`.
- Admin control page is available at `/admin` for users with `ADMIN` role.
- When network access is unavailable, Prisma engine downloads may fail; local shim files are used for runtime continuity.
