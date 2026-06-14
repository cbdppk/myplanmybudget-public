-- Prevent cross-account endpoint takeover by keeping PushSubscription.userId immutable.
CREATE OR REPLACE FUNCTION prevent_push_subscription_owner_change()
RETURNS trigger AS $$
BEGIN
  IF OLD."userId" IS DISTINCT FROM NEW."userId" THEN
    RAISE EXCEPTION 'push_subscription_owner_immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS push_subscription_owner_immutable_trg ON "PushSubscription";

CREATE TRIGGER push_subscription_owner_immutable_trg
BEFORE UPDATE ON "PushSubscription"
FOR EACH ROW
EXECUTE FUNCTION prevent_push_subscription_owner_change();
