// Receives Content-Security-Policy violation reports from browsers.
// See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri
import { reportCspViolation } from "@/lib/observability/sentry-runtime";

export async function POST(request: Request) {
  let body: unknown;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    return new Response(null, { status: 204 });
  }

  const report = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const cspReport = report?.["csp-report"] ?? report;

  if (cspReport && typeof cspReport === "object") {
    const r = cspReport as Record<string, unknown>;
    const details = {
      blockedUri: r["blocked-uri"],
      violatedDirective: r["violated-directive"],
      effectiveDirective: r["effective-directive"],
      documentUri: r["document-uri"],
      disposition: r["disposition"],
    };

    void reportCspViolation(details);
  }

  return new Response(null, { status: 204 });
}
