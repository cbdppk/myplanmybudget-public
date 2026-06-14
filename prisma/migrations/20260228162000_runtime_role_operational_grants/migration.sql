-- Runtime role operational grants for shared non-tenant tables.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "RateLimitBucket",
  "FxRateCache"
TO app_runtime;
