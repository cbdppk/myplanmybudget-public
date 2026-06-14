"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deactivateAccount, resetAllUserData } from "../actions";

export function DangerSettingsPanel() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmReset, setConfirmReset] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const canReset = confirmReset.trim().toUpperCase() === "RESET";
  const canDeactivate = confirmDeactivate.trim().toUpperCase() === "DEACTIVATE";

  return (
    <div className="space-y-4">
      <section className="card border border-amber-300/60 bg-amber-500/10 p-5 dark:border-amber-700/40">
        <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Danger Zone</h2>
        <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-400">These actions are permanent and cannot be undone.</p>
        <p className="mt-2 text-xs text-amber-700/70 dark:text-amber-500">
          Some actions require identity verification first.{" "}
          <a href="/settings/security" className="font-medium underline underline-offset-2">
            Verify your identity in Security settings →
          </a>
        </p>
      </section>

      <section className="card border border-rose-200/60 dark:border-rose-800/40 p-5">
        <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Reset all personal data</h3>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          Deletes your transactions, accounts, goals, notes, reminders, and budget allocations.
        </p>
        <label className="mt-3 block text-xs text-[color:var(--text-secondary)]">
          Type <span className="font-semibold">RESET</span> to confirm
          <input
            value={confirmReset}
            onChange={(e) => setConfirmReset(e.target.value)}
            className="mt-1 h-10 w-full max-w-sm rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
        </label>
        <div className="mt-3">
          <Button
            variant="outline"
            className="border-rose-300 text-rose-700 hover:bg-rose-500/10 dark:border-rose-700 dark:text-rose-400"
            loading={pending}
            disabled={pending || !canReset}
            onClick={() => {
              setMessage(null);
              start(async () => {
                try {
                  await resetAllUserData();
                  setConfirmReset("");
                  router.push("/onboarding");
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Failed.");
                }
              });
            }}
          >
            Reset data
          </Button>
        </div>
      </section>

      <section className="card border border-rose-300/60 bg-rose-500/10 dark:border-rose-800/40 dark:bg-rose-900/20 p-5">
        <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300">Deactivate account</h3>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          Disables login for this account until an admin reactivates it.
        </p>
        <label className="mt-3 block text-xs text-[color:var(--text-secondary)]">
          Type <span className="font-semibold">DEACTIVATE</span> to confirm
          <input
            value={confirmDeactivate}
            onChange={(e) => setConfirmDeactivate(e.target.value)}
            className="mt-1 h-10 w-full max-w-sm rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
        </label>
        <div className="mt-3">
          <Button
            className="bg-rose-700 text-white hover:bg-rose-800"
            loading={pending}
            disabled={pending || !canDeactivate}
            onClick={() => {
              setMessage(null);
              start(async () => {
                try {
                  await deactivateAccount();
                  setConfirmDeactivate("");
                  setMessage("Account deactivated. Log out now and contact admin for reactivation.");
                  router.refresh();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Failed.");
                }
              });
            }}
          >
            Deactivate account
          </Button>
        </div>
      </section>

      {message ? (
        <p className="rounded-xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
