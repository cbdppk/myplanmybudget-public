-- Tenant integrity guards:
-- Prevent cross-user references even if application-side checks regress.

CREATE OR REPLACE FUNCTION enforce_budget_target_tenant_integrity()
RETURNS trigger AS $$
DECLARE
  period_owner TEXT;
  category_owner TEXT;
BEGIN
  SELECT "userId" INTO period_owner FROM "BudgetPeriod" WHERE id = NEW."periodId";
  IF period_owner IS NULL OR period_owner IS DISTINCT FROM NEW."userId" THEN
    RAISE EXCEPTION 'budget_target_period_user_mismatch';
  END IF;

  SELECT "userId" INTO category_owner FROM "Category" WHERE id = NEW."categoryId";
  IF category_owner IS NULL OR category_owner IS DISTINCT FROM NEW."userId" THEN
    RAISE EXCEPTION 'budget_target_category_user_mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS budget_target_tenant_integrity_trg ON "BudgetTarget";
CREATE TRIGGER budget_target_tenant_integrity_trg
BEFORE INSERT OR UPDATE ON "BudgetTarget"
FOR EACH ROW
EXECUTE FUNCTION enforce_budget_target_tenant_integrity();

CREATE OR REPLACE FUNCTION enforce_transaction_tenant_integrity()
RETURNS trigger AS $$
DECLARE
  category_owner TEXT;
  account_owner TEXT;
  from_account_owner TEXT;
  to_account_owner TEXT;
BEGIN
  IF NEW."categoryId" IS NOT NULL THEN
    SELECT "userId" INTO category_owner FROM "Category" WHERE id = NEW."categoryId";
    IF category_owner IS NULL OR category_owner IS DISTINCT FROM NEW."userId" THEN
      RAISE EXCEPTION 'transaction_category_user_mismatch';
    END IF;
  END IF;

  IF NEW."accountId" IS NOT NULL THEN
    SELECT "userId" INTO account_owner FROM "Account" WHERE id = NEW."accountId";
    IF account_owner IS NULL OR account_owner IS DISTINCT FROM NEW."userId" THEN
      RAISE EXCEPTION 'transaction_account_user_mismatch';
    END IF;
  END IF;

  IF NEW."fromAccountId" IS NOT NULL THEN
    SELECT "userId" INTO from_account_owner FROM "Account" WHERE id = NEW."fromAccountId";
    IF from_account_owner IS NULL OR from_account_owner IS DISTINCT FROM NEW."userId" THEN
      RAISE EXCEPTION 'transaction_from_account_user_mismatch';
    END IF;
  END IF;

  IF NEW."toAccountId" IS NOT NULL THEN
    SELECT "userId" INTO to_account_owner FROM "Account" WHERE id = NEW."toAccountId";
    IF to_account_owner IS NULL OR to_account_owner IS DISTINCT FROM NEW."userId" THEN
      RAISE EXCEPTION 'transaction_to_account_user_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_tenant_integrity_trg ON "Transaction";
CREATE TRIGGER transaction_tenant_integrity_trg
BEFORE INSERT OR UPDATE ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION enforce_transaction_tenant_integrity();

CREATE OR REPLACE FUNCTION enforce_sandbox_override_tenant_integrity()
RETURNS trigger AS $$
DECLARE
  sandbox_owner TEXT;
BEGIN
  SELECT "userId" INTO sandbox_owner FROM "Sandbox" WHERE id = NEW."sandboxId";
  IF sandbox_owner IS NULL OR sandbox_owner IS DISTINCT FROM NEW."userId" THEN
    RAISE EXCEPTION 'sandbox_override_user_mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sandbox_override_tenant_integrity_trg ON "SandboxOverride";
CREATE TRIGGER sandbox_override_tenant_integrity_trg
BEFORE INSERT OR UPDATE ON "SandboxOverride"
FOR EACH ROW
EXECUTE FUNCTION enforce_sandbox_override_tenant_integrity();
