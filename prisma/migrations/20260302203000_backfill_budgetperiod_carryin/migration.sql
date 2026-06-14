-- Backfill carryIn for existing periods so rolling balance is consistent historically.
WITH period_delta AS (
  SELECT
    bp."id",
    bp."userId",
    bp."startDate",
    (
      COALESCE(up."baselineIncome", 0)
      - COALESCE(up."baselineExpense", 0)
      - COALESCE(up."baselineSavings", 0)
      + COALESCE(tx.income_amount, 0)
      - COALESCE(tx.expense_amount, 0)
    )::DECIMAL(65,30) AS delta
  FROM "BudgetPeriod" bp
  JOIN "UserProfile" up ON up."id" = bp."userId"
  LEFT JOIN LATERAL (
    SELECT
      SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END)::DECIMAL(65,30) AS income_amount,
      SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END)::DECIMAL(65,30) AS expense_amount
    FROM "Transaction" t
    WHERE t."userId" = bp."userId"
      AND t."occurredAt" >= bp."startDate"
      AND t."occurredAt" <= bp."endDate"
  ) tx ON TRUE
),
period_carry AS (
  SELECT
    id,
    COALESCE(
      SUM(delta) OVER (
        PARTITION BY "userId"
        ORDER BY "startDate", id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    )::DECIMAL(65,30) AS carry_in
  FROM period_delta
)
UPDATE "BudgetPeriod" bp
SET "carryIn" = pc.carry_in
FROM period_carry pc
WHERE bp."id" = pc.id
  AND bp."carryIn" IS DISTINCT FROM pc.carry_in;
