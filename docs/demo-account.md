# Demo accounts

The seed script reads demo account credentials from environment variables. Set these locally before running `pnpm prisma:seed`:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_USER_EMAIL`
- `SEED_USER_PASSWORD`

Never commit real account credentials. The seed command prints the created email addresses but never prints passwords.
