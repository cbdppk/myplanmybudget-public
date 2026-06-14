/**
 * Cloudflare Turnstile server-side verification.
 * Set TURNSTILE_SECRET_KEY in .env to enable.
 * When not set (local dev), verification is skipped and returns true.
 */
export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  // In non-production environments, skip verification entirely.
  // Turnstile site keys are domain-scoped and won't work on localhost.
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true; // unconfigured — skip

  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    // Fail closed — if Cloudflare is unreachable, deny the request rather than let bots through
    console.error("turnstile_verification_failed: Cloudflare unreachable");
    return false;
  }
}
