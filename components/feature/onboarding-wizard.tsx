"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = ["Currency", "Template", "Categories & goals"] as const;

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [cycleStart, setCycleStart] = useState("1");
  const [template, setTemplate] = useState("Salary");
  const [goal, setGoal] = useState("Build $1,000 emergency fund");

  const done = useMemo(() => step === steps.length - 1, [step]);

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2 text-xs text-black/60">
        {steps.map((name, idx) => (
          <div key={name} className={`rounded-full px-2 py-1 ${idx === step ? "bg-[var(--accent)] text-white" : "bg-black/[0.05]"}`}>
            {idx + 1}. {name}
          </div>
        ))}
      </div>

      <div className="mt-5">
        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-black/70">Currency</span>
              <select className="mt-1 h-10 w-full rounded-2xl border border-black/15 px-3" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>USD</option>
                <option>EUR</option>
                <option>GHS</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-black/70">Monthly cycle start day</span>
              <input className="mt-1 h-10 w-full rounded-2xl border border-black/15 px-3" inputMode="numeric" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {["Student", "Salary", "Small business", "Custom"].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTemplate(name)}
                className={`rounded-2xl border p-4 text-left text-sm ${template === name ? "border-[var(--accent)] bg-blue-50" : "border-black/10"}`}
              >
                <p className="font-medium">{name}</p>
                <p className="mt-1 text-black/60">Preset category starter</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-black/10 p-4 text-sm">
              <p className="font-medium">Template selected: {template}</p>
              <p className="mt-1 text-black/60">Core categories: Housing, Food, Transport, Savings.</p>
            </div>
            <label className="block text-sm">
              <span className="text-black/70">Optional first goal</span>
              <input className="mt-1 h-10 w-full rounded-2xl border border-black/15 px-3" value={goal} onChange={(e) => setGoal(e.target.value)} />
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((v) => Math.max(0, v - 1))}>
          Back
        </Button>
        {done ? (
          <Button asChild>
            <Link href="/dashboard">Finish onboarding</Link>
          </Button>
        ) : (
          <Button type="button" onClick={() => setStep((v) => Math.min(steps.length - 1, v + 1))}>
            Continue
          </Button>
        )}
      </div>
    </section>
  );
}
