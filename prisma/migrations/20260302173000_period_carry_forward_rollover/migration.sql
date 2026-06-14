-- Persist monthly carry-forward on budget periods.
ALTER TABLE "BudgetPeriod"
ADD COLUMN IF NOT EXISTS "carryIn" DECIMAL(65,30) NOT NULL DEFAULT 0;
