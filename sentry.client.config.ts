// Use a regular webpack-bundled import for the browser — the new Function()
// trick in sentry-loader bypasses webpack but breaks in browser contexts.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      tracesSampleRate: 0.2,
      integrations: [Sentry.replayIntegration()],
      enabled: process.env.NODE_ENV === "production",
    });
  });
}
