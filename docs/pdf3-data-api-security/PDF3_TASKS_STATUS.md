# MyplanMybudget PDF3 Task Status

Source: `docs/MyplanMybudget_PDF3_Data_API_Security (1).pdf`

## Build status
- `pnpm build`: passing (verified on February 22, 2026)

## PDF3 task checklist

### 1. Data domains and ownership rules
- [x] User-owned records enforced in queries (`where: { userId: sessionUser.id }` pattern in actions/routes)
- [x] No client-supplied `userId` accepted in server actions used for writes
- [x] Unique/index constraints exist in Prisma schema and migration

### 2. API surface (Server Actions first)
- [x] Server Actions with Zod validation are used across features (`track`, `plan`, `notes`, `simulate`, `settings`, `auth`)
- [x] Sensitive export routes require recent re-auth (`hasRecentReauth`)

### 3. Dashboard aggregations
- [x] Monthly totals (income, expense, net)
- [x] Upcoming reminders now aligned to PDF3: due within 7 days
- [x] Burn-rate aggregation added: average daily spend over last 30 days
- [x] Category spend widget on dashboard
- [x] Goal progress aggregation on dashboard

### 4. Data export requirements
- [x] CSV export includes: transactions, budgets, reminders, notes
- [x] JSON export upgraded to full data dump
- [x] JSON export includes schema version for future imports: `myplanmybudget.export.v1`
- [x] Export gated by recent re-auth

## Files updated for PDF3 implementation
- `app/api/export/csv/route.ts`
- `app/api/export/json/route.ts`
- `lib/data.ts`
- `app/dashboard/page.tsx`
- `lib/data/dashboard.ts`

## Notes
- Existing schema names differ from PDF3 example naming, but behavior is aligned for current MVP.
