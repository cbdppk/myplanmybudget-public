"use client";

import { useEffect } from "react";
import { reportException } from "@/lib/observability/sentry-runtime";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1.5rem", padding: "2rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ fontSize: "2rem" }}>!</div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
            <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "#6b7280" }}>
              An unexpected error occurred. Please refresh or try again.
            </p>
            {error.digest ? (
              <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#9ca3af", fontFamily: "monospace" }}>
                ref: {error.digest}
              </p>
            ) : null}
          </div>
          <button
            onClick={reset}
            style={{ background: "#0284c7", color: "white", border: "none", borderRadius: "0.75rem", padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
