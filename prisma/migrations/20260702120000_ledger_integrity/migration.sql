-- Ledger integrity: currency stamping, recurring-rule bookkeeping, offline sync
-- idempotency, and opening-balance semantics for computed account balances.

-- AlterTable
ALTER TABLE "RecurringRule" ADD COLUMN     "lastRunAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "currency" TEXT;

-- CreateTable
CREATE TABLE "OfflineSyncOp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSyncOp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfflineSyncOp_createdAt_idx" ON "OfflineSyncOp"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncOp_userId_opId_key" ON "OfflineSyncOp"("userId", "opId");

-- Runtime role access + tenant row-level security, matching the lockdown pattern.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OfflineSyncOp" TO app_runtime;

ALTER TABLE "OfflineSyncOp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfflineSyncOp" FORCE ROW LEVEL SECURITY;

CREATE POLICY offline_sync_op_tenant_policy ON "OfflineSyncOp"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

-- Accounts: "openingBalance" is the anchor for computed balances
-- (balance = openingBalance + signed sum of linked transactions). Legacy rows
-- only ever wrote "balance" at creation, so treat that as the opening amount.
UPDATE "Account" SET "openingBalance" = "balance"
WHERE "openingBalance" = 0 AND "balance" <> 0;
