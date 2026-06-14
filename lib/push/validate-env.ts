export interface PushEnvStatus {
  ready: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validates that all required VAPID environment variables are present.
 * Call this at the start of push-related API routes to fail fast with clear diagnostics.
 */
export function validatePushEnv(): PushEnvStatus {
  const required = ["VAPID_SUBJECT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const warnings: string[] = [];

  if (!process.env.PUSH_DISPATCH_SECRET?.trim()) {
    warnings.push("PUSH_DISPATCH_SECRET is not set — dispatch endpoint is unprotected.");
  }

  if (missing.length > 0) {
    const isDev = process.env.NODE_ENV !== "production";
    const level = isDev ? "warn" : "error";
    console[level](
      "push_env_missing",
      JSON.stringify({ missing, hint: "Set these in .env. Run: npx web-push generate-vapid-keys" }),
    );
  }

  return { ready: missing.length === 0, missing, warnings };
}
