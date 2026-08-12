-- Pending vs cleared transactions: pending rows count in budgets but are
-- excluded from account "cleared balance" used for statement reconciliation.

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cleared" BOOLEAN NOT NULL DEFAULT true;
