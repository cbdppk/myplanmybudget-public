import { loadSentry } from "@/lib/observability/sentry-loader";

export async function reportException(error: unknown) {
  const Sentry = await loadSentry();
  if (!Sentry) return;
  Sentry.captureException(error);
}

export async function reportCspViolation(details: Record<string, unknown>) {
  const Sentry = await loadSentry();
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setTag("csp.directive", String(details.effectiveDirective ?? details.violatedDirective ?? "unknown"));
    scope.setTag("csp.disposition", String(details.disposition ?? "enforce"));
    scope.setContext("csp_report", details);
    Sentry.captureMessage(`CSP violation: ${details.effectiveDirective ?? details.violatedDirective}`, "warning");
  });
}
