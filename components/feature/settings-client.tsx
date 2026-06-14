"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logout, reauthenticate } from "@/app/auth/actions";

function base64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function toPreview(payload: unknown): string {
  if (!payload || typeof payload !== "object") return String(payload ?? "");
  const obj = payload as Record<string, unknown>;
  const sample = {
    ok: obj.ok,
    mode: obj.mode,
    usersTargeted: obj.usersTargeted,
    reminderCount: obj.reminderCount,
    subscriptionsTargeted: obj.subscriptionsTargeted,
    delivered: obj.delivered,
    failed: obj.failed,
    staleDeactivated: obj.staleDeactivated,
  };
  return JSON.stringify(sample, null, 2);
}

export function SettingsClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [dispatchSecret, setDispatchSecret] = useState("");
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runDispatch = (mode: "dry-run" | "live") => {
    setDispatchMessage(null);
    setDispatchResult(null);
    setDispatchBusy(true);
    void (async () => {
      try {
        const response = await fetch(`/api/push/dispatch?mode=${mode}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(dispatchSecret ? { "x-push-dispatch-secret": dispatchSecret } : {}),
          },
        });
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          const reason =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : `Request failed (${response.status})`;
          throw new Error(reason);
        }
        setDispatchMessage(`${mode === "live" ? "Live" : "Dry-run"} dispatch succeeded.`);
        setDispatchResult(toPreview(payload));
      } catch (error) {
        setDispatchMessage(error instanceof Error ? error.message : "Dispatch failed.");
      } finally {
        setDispatchBusy(false);
      }
    })();
  };

  return (
    <section className="mt-6 space-y-4">
      <div className="card p-5">
        <h2 className="text-sm font-semibold">Security & Integrations</h2>
        <p className="mt-1 text-xs text-black/60">Operational controls for export access, push notifications, diagnostics, and session management.</p>
      </div>

      <article className="card p-5">
        <h2 className="text-sm font-semibold">Export data</h2>
        <p className="mt-1 text-sm text-black/60">Re-authenticate to unlock CSV/JSON export for 5 minutes.</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            placeholder="Confirm password"
            className="h-10 rounded-xl border border-black/15 px-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            loading={pending}
            disabled={pending}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                try {
                  await reauthenticate(password);
                  setMessage("Re-auth confirmed. Export links are now active.");
                } catch (e: unknown) {
                  setMessage(e instanceof Error ? e.message : "Failed");
                }
              });
            }}
          >
            {pending ? "Checking..." : "Re-authenticate"}
          </Button>
        </div>

        <div className="mt-4 flex gap-2">
          <Button asChild><a href="/api/export/csv">Export CSV</a></Button>
          <Button variant="outline" asChild><a href="/api/export/json">Export JSON</a></Button>
        </div>
        {message ? <p className="mt-2 text-sm text-black/70">{message}</p> : null}
      </article>

      <article className="card p-5">
        <h2 className="text-sm font-semibold">Push reminders (beta)</h2>
        <p className="mt-1 text-sm text-black/60">Enable browser push for due reminders. Requires HTTPS and notification permission.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            loading={pushBusy}
            disabled={pushBusy}
            onClick={() => {
              setPushMessage(null);
              setPushBusy(true);
              void (async () => {
                try {
                  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                    throw new Error("Push is not supported in this browser.");
                  }

                  const permission = await Notification.requestPermission();
                  if (permission !== "granted") {
                    throw new Error("Notification permission was not granted.");
                  }

                  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                  if (!vapidPublicKey) {
                    throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
                  }

                  const registration = await navigator.serviceWorker.ready;
                  const current = await registration.pushManager.getSubscription();
                  const subscription =
                    current ??
                    (await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: base64ToUint8Array(vapidPublicKey),
                    }));

                  const response = await fetch("/api/push/subscribe", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(subscription.toJSON()),
                  });
                  if (!response.ok) throw new Error("Failed to register push subscription.");

                  setPushMessage("Push reminders enabled for this browser.");
                } catch (error) {
                  setPushMessage(error instanceof Error ? error.message : "Failed to enable push.");
                } finally {
                  setPushBusy(false);
                }
              })();
            }}
          >
            {pushBusy ? "Working..." : "Enable push"}
          </Button>

          <Button
            type="button"
            loading={pushBusy}
            disabled={pushBusy}
            onClick={() => {
              setPushMessage(null);
              setPushBusy(true);
              void (async () => {
                try {
                  if (!("serviceWorker" in navigator)) throw new Error("Service worker is not available.");

                  const registration = await navigator.serviceWorker.ready;
                  const existing = await registration.pushManager.getSubscription();
                  if (existing) {
                    await fetch("/api/push/unsubscribe", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ endpoint: existing.endpoint }),
                    });
                    await existing.unsubscribe();
                    setPushMessage("Push reminders disabled for this browser.");
                  } else {
                    setPushMessage("No active push subscription found.");
                  }
                } catch (error) {
                  setPushMessage(error instanceof Error ? error.message : "Failed to disable push.");
                } finally {
                  setPushBusy(false);
                }
              })();
            }}
          >
            Disable push
          </Button>
        </div>
        {pushMessage ? <p className="mt-2 text-sm text-black/70">{pushMessage}</p> : null}
      </article>

      <article className="card p-5">
        <h2 className="text-sm font-semibold">Push diagnostics</h2>
        <p className="mt-1 text-sm text-black/60">
          Run dispatch checks from this browser. Add dispatch secret only if your environment requires it.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            placeholder="Dispatch secret (optional)"
            className="h-10 rounded-xl border border-black/15 px-3"
            value={dispatchSecret}
            onChange={(e) => setDispatchSecret(e.target.value)}
          />
          <Button type="button" variant="outline" loading={dispatchBusy} disabled={dispatchBusy} onClick={() => runDispatch("dry-run")}>
            {dispatchBusy ? "Running..." : "Run dry-run"}
          </Button>
          <Button type="button" loading={dispatchBusy} disabled={dispatchBusy} onClick={() => runDispatch("live")}>
            {dispatchBusy ? "Running..." : "Run live"}
          </Button>
        </div>
        {dispatchMessage ? <p className="mt-2 text-sm text-black/70">{dispatchMessage}</p> : null}
        {dispatchResult ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-black/10 bg-black/[0.03] p-3 text-xs text-black/80">
            {dispatchResult}
          </pre>
        ) : null}
      </article>

      <article className="card p-5">
        <h2 className="text-sm font-semibold">Session</h2>
        <Button
          type="button"
          variant="outline"
          loading={pending}
          onClick={() => {
            startTransition(async () => {
              await logout();
              router.push("/login");
              router.refresh();
            });
          }}
        >
          Sign out
        </Button>
      </article>
    </section>
  );
}
