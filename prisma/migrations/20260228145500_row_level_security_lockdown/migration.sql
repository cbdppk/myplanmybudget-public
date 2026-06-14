-- Runtime least-privilege role + row-level security policies.
-- Note: application runtime should connect as a non-bypass role granted membership in app_runtime.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "UserProfile",
  "Account",
  "Category",
  "BudgetPeriod",
  "BudgetTarget",
  "Transaction",
  "RecurringRule",
  "Goal",
  "Sandbox",
  "SandboxOverride",
  "Note",
  "Reminder",
  "PushSubscription",
  "AuditEvent",
  "AuthCredential"
TO app_runtime;

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS text AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_user_email()
RETURNS text AS $$
  SELECT NULLIF(current_setting('app.user_email', true), '');
$$ LANGUAGE sql STABLE;

ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecurringRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sandbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SandboxOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthCredential" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "UserProfile" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BudgetPeriod" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BudgetTarget" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RecurringRule" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Goal" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Sandbox" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SandboxOverride" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Note" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Reminder" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuthCredential" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profile_tenant_policy ON "UserProfile";
CREATE POLICY user_profile_tenant_policy ON "UserProfile"
FOR ALL TO app_runtime
USING (id = app_current_user_id() OR email = app_current_user_email())
WITH CHECK (id = app_current_user_id() OR email = app_current_user_email());

DROP POLICY IF EXISTS account_tenant_policy ON "Account";
CREATE POLICY account_tenant_policy ON "Account"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS category_tenant_policy ON "Category";
CREATE POLICY category_tenant_policy ON "Category"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS budget_period_tenant_policy ON "BudgetPeriod";
CREATE POLICY budget_period_tenant_policy ON "BudgetPeriod"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS budget_target_tenant_policy ON "BudgetTarget";
CREATE POLICY budget_target_tenant_policy ON "BudgetTarget"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS transaction_tenant_policy ON "Transaction";
CREATE POLICY transaction_tenant_policy ON "Transaction"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS recurring_rule_tenant_policy ON "RecurringRule";
CREATE POLICY recurring_rule_tenant_policy ON "RecurringRule"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS goal_tenant_policy ON "Goal";
CREATE POLICY goal_tenant_policy ON "Goal"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS sandbox_tenant_policy ON "Sandbox";
CREATE POLICY sandbox_tenant_policy ON "Sandbox"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS sandbox_override_tenant_policy ON "SandboxOverride";
CREATE POLICY sandbox_override_tenant_policy ON "SandboxOverride"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS note_tenant_policy ON "Note";
CREATE POLICY note_tenant_policy ON "Note"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS reminder_tenant_policy ON "Reminder";
CREATE POLICY reminder_tenant_policy ON "Reminder"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS push_subscription_tenant_policy ON "PushSubscription";
CREATE POLICY push_subscription_tenant_policy ON "PushSubscription"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS audit_event_tenant_policy ON "AuditEvent";
CREATE POLICY audit_event_tenant_policy ON "AuditEvent"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());

DROP POLICY IF EXISTS auth_credential_tenant_policy ON "AuthCredential";
CREATE POLICY auth_credential_tenant_policy ON "AuthCredential"
FOR ALL TO app_runtime
USING ("userId" = app_current_user_id())
WITH CHECK ("userId" = app_current_user_id());
