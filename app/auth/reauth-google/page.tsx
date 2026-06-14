"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense } from "react";

function ReauthGoogleInner() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/settings/security";
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    signIn("google", { callbackUrl });
  }, [callbackUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-500">Redirecting to Google…</p>
    </div>
  );
}

export default function ReauthGooglePage() {
  return (
    <Suspense>
      <ReauthGoogleInner />
    </Suspense>
  );
}
