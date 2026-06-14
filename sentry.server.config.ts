import { loadSentry } from "@/lib/observability/sentry-loader";

void loadSentry().then((Sentry) => {
  if (!Sentry) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.2,
    enabled: process.env.NODE_ENV === "production",
  });
});
