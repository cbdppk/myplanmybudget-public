const sentryEnabled = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

export async function loadSentry() {
  if (!sentryEnabled) return null;
  try {
    return await import("@sentry/nextjs");
  } catch {
    return null;
  }
}
