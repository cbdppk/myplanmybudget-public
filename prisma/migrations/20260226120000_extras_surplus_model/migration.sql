-- Create enums for transaction classification
CREATE TYPE "TransactionKind" AS ENUM ('BASELINE', 'EXTRA');
CREATE TYPE "ExtraTxnType" AS ENUM ('EXTRA_INCOME', 'EXTRA_EXPENSE', 'EXTRA_SAVINGS');

-- Add columns to transaction table
ALTER TABLE "Transaction"
ADD COLUMN "kind" "TransactionKind" NOT NULL DEFAULT 'EXTRA',
ADD COLUMN "extraType" "ExtraTxnType";

-- Index for extras/surplus reporting queries
CREATE INDEX "Transaction_userId_kind_extraType_occurredAt_idx"
ON "Transaction"("userId", "kind", "extraType", "occurredAt");
