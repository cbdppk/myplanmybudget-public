"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ReauthCompleteInner() {
  const params = useSearchParams();
  const status = params.get("status") ?? "done";

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      // Popup path: notify the parent window and close.
      window.opener.postMessage(
        { type: "reauth-complete", status },
        window.location.origin,
      );
      window.close();
    } else {
      // Full-page fallback path.
      // Store the result in sessionStorage so the security page can read it
      // without URL params, then navigate back to security with location.replace
      // (replaces this history entry so the user doesn't land here on back).
      try {
        sessionStorage.setItem("reauth_verified_status", status);
      } catch {
        // sessionStorage unavailable — security page will fall back to URL param.
      }
      window.location.replace("/settings/security");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-neutral-950">
      <p className="text-sm text-gray-500">Completing verification…</p>
    </div>
  );
}

export default function ReauthCompletePage() {
  return (
    <Suspense>
      <ReauthCompleteInner />
    </Suspense>
  );
}
