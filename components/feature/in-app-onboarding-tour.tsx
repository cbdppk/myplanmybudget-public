"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getAppTourStorageKeys } from "@/lib/app-tour";

type TourChromeAction = "open-mobile-menu" | "close-mobile-menu" | "show-desktop-menu";
type TourPlacement = "auto" | "right-start" | "bottom-right" | "top-right" | "bottom-left" | "center";
type SpotlightRect = { top: number; left: number; width: number; height: number };

type TourStep = {
  id: string;
  path: string;
  selector: string;
  title: string;
  description: string;
  detail?: string;
  beforeEnter?: TourChromeAction;
  placement?: TourPlacement;
};

function dispatchTourChrome(action: TourChromeAction) {
  window.dispatchEvent(new CustomEvent(`mpb-tour:${action}`));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value);
}

function readStorage(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage write failures so the tour still works in restrictive browsers.
  }
}

function removeStorage(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function getSpotlightRect(args: {
  targetRect: DOMRect | null;
  viewport: { width: number; height: number };
  isMobile: boolean;
  step: TourStep;
}): SpotlightRect | null {
  const { targetRect, viewport, isMobile, step } = args;
  if (!targetRect && !(isMobile && step.selector === '[data-tour="app-main-content"]')) return null;

  if (isMobile && step.selector === '[data-tour="app-main-content"]') {
    return {
      top: 76,
      left: 8,
      width: Math.max(48, viewport.width - 16),
      height: Math.max(160, viewport.height - 272),
    };
  }

  if (!targetRect) return null;

  const padding = isMobile ? 6 : 10;
  const inset = 8;
  const left = clamp(targetRect.left - padding, inset, Math.max(inset, viewport.width - inset - 48));
  const top = clamp(targetRect.top - padding, inset, Math.max(inset, viewport.height - inset - 48));
  const width = Math.min(viewport.width - left - inset, Math.max(48, targetRect.width + padding * 2));
  const height = Math.min(viewport.height - top - inset, Math.max(48, targetRect.height + padding * 2));

  return {
    top: round(top),
    left: round(left),
    width: round(width),
    height: round(height),
  };
}

function getDesktopTooltipStyle(rect: SpotlightRect | null, viewport: { width: number; height: number }, placement: TourPlacement) {
  const width = 368;
  const heightEstimate = 280;
  const gap = 18;
  const safe = 20;
  const maxLeft = Math.max(safe, viewport.width - width - safe);

  if (!rect || placement === "center") {
    return {
      width,
      left: clamp(viewport.width - width - 28, safe, maxLeft),
      top: clamp(32, safe, Math.max(safe, viewport.height - heightEstimate - safe)),
    };
  }

  const positions: Array<{ left: number; top: number }> = [];

  if (placement === "right-start" || placement === "auto") {
    positions.push({
      left: rect.left + rect.width + gap,
      top: rect.top,
    });
  }
  if (placement === "bottom-right" || placement === "auto") {
    positions.push({
      left: rect.left + rect.width - width,
      top: rect.top + rect.height + gap,
    });
  }
  if (placement === "top-right" || placement === "auto") {
    positions.push({
      left: rect.left + rect.width - width,
      top: rect.top - heightEstimate - gap,
    });
  }
  if (placement === "bottom-left" || placement === "auto") {
    positions.push({
      left: rect.left,
      top: rect.top + rect.height + gap,
    });
  }

  positions.push({
    left: viewport.width - width - 28,
    top: 28,
  });

  const fittingPosition =
    positions.find((position) => {
      const left = clamp(position.left, safe, maxLeft);
      const top = clamp(position.top, safe, Math.max(safe, viewport.height - heightEstimate - safe));
      return left >= safe && top >= safe && left + width <= viewport.width - safe && top + heightEstimate <= viewport.height - safe;
    }) ?? positions[positions.length - 1];

  return {
    width,
    left: clamp(fittingPosition.left, safe, maxLeft),
    top: clamp(fittingPosition.top, safe, Math.max(safe, viewport.height - heightEstimate - safe)),
  };
}

function buildSteps(isMobile: boolean): TourStep[] {
  const menuIntro = isMobile
    ? [
        {
          id: "mobile-menu-button",
          path: "/dashboard",
          selector: '[data-tour="mobile-menu-button"]',
          title: "This opens your menu",
          description: "On phone, this button is your shortcut to the whole app.",
          detail: "Tap here whenever you want to move between Dashboard, Budget, Goals, Transactions, Notes, Reminders, Settings, and more.",
          beforeEnter: "close-mobile-menu" as const,
          placement: "center" as const,
        },
        {
          id: "mobile-menu-panel",
          path: "/dashboard",
          selector: '[data-tour="mobile-sidebar"]',
          title: "Your pages live in this menu",
          description: "Dashboard shows your money snapshot, Budget is your plan, Goals tracks savings targets, Transactions logs real money movement, Simulations lets you test decisions, Notes stores context, Reminders keeps you on schedule, Assistant answers questions, and Settings controls how the app works.",
          detail: "I’ll now walk you through those pages one by one.",
          beforeEnter: "open-mobile-menu" as const,
          placement: "center" as const,
        },
      ]
    : [
        {
          id: "desktop-menu",
          path: "/dashboard",
          selector: '[data-tour="desktop-sidebar"]',
          title: "Your menu is always here",
          description: "Dashboard is your overview, Budget is your plan, Goals tracks savings targets, Transactions logs activity, Simulations tests scenarios, Notes keeps context, Reminders keeps deadlines visible, Assistant helps you understand the app, and Settings controls your setup.",
          detail: "I’ll now guide you through the main pages in order.",
          beforeEnter: "show-desktop-menu" as const,
          placement: "right-start" as const,
        },
      ];

  return [
    ...menuIntro,
    {
      id: "dashboard-page",
      path: "/dashboard",
      selector: '[data-tour="app-main-content"]',
      title: "Dashboard",
      description: "This is your live financial snapshot.",
      detail: "Come here to quickly see your money health, recent activity, goals, reminders, and what needs attention first.",
      beforeEnter: "close-mobile-menu",
      placement: "bottom-right",
    },
    {
      id: "budget-page",
      path: "/budget",
      selector: '[data-tour="app-main-content"]',
      title: "Budget",
      description: "This page is where your plan lives.",
      detail: "Use it to review category budgets, compare your plan against reality, and make sure your monthly setup still fits.",
      beforeEnter: "close-mobile-menu",
      placement: "bottom-right",
    },
    {
      id: "goals-page",
      path: "/goals",
      selector: '[data-tour="app-main-content"]',
      title: "Goals",
      description: "This is where you track savings goals.",
      detail: "Each goal shows progress, remaining amount, and whether your current budget can support it.",
      beforeEnter: "close-mobile-menu",
      placement: "bottom-right",
    },
    {
      id: "transactions-page",
      path: "/track",
      selector: '[data-tour="app-main-content"]',
      title: "Transactions",
      description: "This is where you record what actually happened with your money.",
      detail: "Log income, expenses, and savings here so the rest of the app reflects real activity instead of guesses.",
      beforeEnter: "close-mobile-menu",
      placement: "bottom-right",
    },
    {
      id: "simulations-page",
      path: "/simulate",
      selector: '[data-tour="app-main-content"]',
      title: "Simulations",
      description: "Use this page to test ideas before you commit.",
      detail: "It helps you ask questions like what happens if you spend more, save more, or change your plan over time.",
      beforeEnter: "close-mobile-menu",
      placement: "top-right",
    },
    {
      id: "notes-page",
      path: "/notes",
      selector: '[data-tour="app-main-content"]',
      title: "Notes",
      description: "Notes keeps the story behind your numbers.",
      detail: "Store plans, decisions, reminders to yourself, or context you want to remember when reviewing your budget later.",
      beforeEnter: "close-mobile-menu",
      placement: "bottom-right",
    },
    {
      id: "reminders-page",
      path: "/reminders",
      selector: '[data-tour="app-main-content"]',
      title: "Reminders",
      description: "This is where you stay ahead of deadlines.",
      detail: "Use reminders for bills, transfers, reviews, and recurring check-ins so important money tasks do not slip.",
      beforeEnter: "close-mobile-menu",
      placement: "top-right",
    },
    {
      id: "assistant-page",
      path: "/assistant",
      selector: '[data-tour="app-main-content"]',
      title: "Assistant",
      description: "Assistant explains the app and reads your current data.",
      detail: "Ask what a metric means, what page to use next, or how your budget is doing in plain language.",
      beforeEnter: "close-mobile-menu",
      placement: "bottom-left",
    },
    {
      id: "settings-page",
      path: "/settings",
      selector: '[data-tour="app-main-content"]',
      title: "Settings",
      description: "Settings is where you control how the app behaves.",
      detail: "Update categories, profile, notifications, security, appearance, and budget rules here whenever your life changes.",
      beforeEnter: "close-mobile-menu",
      placement: "top-right",
    },
  ];
}

export function InAppOnboardingTour({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const stepIdRef = useRef<string | null>(null);

  const { completedKey, activeKey, stepKey } = getAppTourStorageKeys(userEmail);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 768);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  const steps = useMemo(() => buildSteps(isMobile), [isMobile]);
  const step = active ? steps[stepIndex] ?? null : null;

  const finishTour = useCallback(() => {
    writeStorage(localStorage, completedKey, "1");
    removeStorage(sessionStorage, activeKey);
    removeStorage(sessionStorage, stepKey);
    dispatchTourChrome("close-mobile-menu");
    stepIdRef.current = null;
    setActive(false);
    setStepIndex(0);
  }, [activeKey, completedKey, stepKey]);

  const goToStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0) return;
    if (nextIndex >= steps.length) {
      finishTour();
      return;
    }
    setStepIndex(nextIndex);
  }, [finishTour, steps.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wantsStart = searchParams.get("tour") === "start";
    if (wantsStart) {
      setActive(true);
      setStepIndex(0);
      writeStorage(sessionStorage, activeKey, "1");
      writeStorage(sessionStorage, stepKey, "0");
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("tour");
      const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
      router.replace(nextUrl);
      return;
    }

    if (readStorage(localStorage, completedKey) === "1") return;
    if (readStorage(sessionStorage, activeKey) !== "1") return;

    const storedStep = Number(readStorage(sessionStorage, stepKey) ?? "0");
    setActive(true);
    setStepIndex(Number.isFinite(storedStep) ? clamp(storedStep, 0, Math.max(0, steps.length - 1)) : 0);
  }, [activeKey, completedKey, pathname, router, searchParams, stepKey, steps.length]);

  useEffect(() => {
    if (!active || !step) return;
    writeStorage(sessionStorage, activeKey, "1");
    writeStorage(sessionStorage, stepKey, String(stepIndex));

    if (pathname !== step.path) {
      dispatchTourChrome("close-mobile-menu");
      router.replace(step.path);
      return;
    }

    if (step.beforeEnter) {
      dispatchTourChrome(step.beforeEnter);
    }

    let frameId = 0;
    const updateRect = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const element = document.querySelector(step.selector);
        if (!(element instanceof HTMLElement)) {
          setTargetRect(null);
          return;
        }

        if (stepIdRef.current !== step.id && step.selector !== '[data-tour="app-main-content"]') {
          const nextRect = element.getBoundingClientRect();
          const topThreshold = isMobile ? 88 : 32;
          const bottomThreshold = isMobile ? 250 : 48;
          const isFullyVisible = nextRect.top >= topThreshold && nextRect.bottom <= viewport.height - bottomThreshold;
          if (!isFullyVisible) {
            element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
          }
        }
        stepIdRef.current = step.id;
        setTargetRect(element.getBoundingClientRect());
      });
    };

    const element = document.querySelector(step.selector);
    const resizeObserver =
      element instanceof HTMLElement
        ? new ResizeObserver(() => {
            updateRect();
          })
        : null;
    if (element instanceof HTMLElement && resizeObserver) {
      resizeObserver.observe(element);
    }

    const visualViewport = window.visualViewport;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishTour();
    };

    const timeoutId = window.setTimeout(() => {
      const element = document.querySelector(step.selector);
      if (!(element instanceof HTMLElement)) {
        setTargetRect(null);
        return;
      }
      updateRect();
    }, step.beforeEnter === "open-mobile-menu" ? 260 : 180);

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("keydown", onEscape);
    visualViewport?.addEventListener("resize", updateRect);
    visualViewport?.addEventListener("scroll", updateRect);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("keydown", onEscape);
      visualViewport?.removeEventListener("resize", updateRect);
      visualViewport?.removeEventListener("scroll", updateRect);
      resizeObserver?.disconnect();
    };
  }, [active, activeKey, finishTour, isMobile, pathname, router, step, stepIndex, stepKey, viewport.height]);

  if (!active || !step) return null;

  const rect = getSpotlightRect({ targetRect, viewport, isMobile, step });
  const desktopTooltipStyle = getDesktopTooltipStyle(rect, viewport, step.placement ?? "auto");
  const progressPercent = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[160]" role="dialog" aria-modal="true" aria-label={`App tour step ${stepIndex + 1}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_32%),rgba(2,6,23,0.82)] backdrop-blur-[2px]" />

      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[1.75rem] border-2 border-sky-300/95 bg-white/[0.02] shadow-[0_0_0_1px_rgba(125,211,252,0.6),0_0_0_9999px_rgba(2,6,23,0.52)] transition-[top,left,width,height] duration-300 ease-out will-change-[top,left,width,height]"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        >
          <div className="absolute -inset-1 rounded-[1.9rem] border border-sky-200/40" />
        </div>
      ) : null}

      <div
        className="absolute rounded-[1.75rem] border border-white/15 bg-slate-950/96 text-white shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl"
        style={
          isMobile
            ? {
                left: 16,
                right: 16,
                bottom: 16,
              }
            : {
                width: desktopTooltipStyle.width,
                left: desktopTooltipStyle.left,
                top: desktopTooltipStyle.top,
              }
        }
      >
        <div className="h-1.5 overflow-hidden rounded-t-[1.75rem] bg-white/5">
          <div className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                App Tour {stepIndex + 1} / {steps.length}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-9 border-white/15 bg-white/5 px-0 text-white hover:bg-white/10"
              onClick={finishTour}
            >
              x
            </Button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-100">{step.description}</p>
          {step.detail ? <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.detail}</p> : null}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {steps.map((item, index) => (
              <span
                key={item.id}
                className={
                  index === stepIndex
                    ? "h-2.5 w-6 rounded-full bg-sky-300"
                    : index < stepIndex
                      ? "h-2.5 w-2.5 rounded-full bg-sky-500/80"
                      : "h-2.5 w-2.5 rounded-full bg-white/20"
                }
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={finishTour}
              >
                Skip tour
              </Button>
              {!isMobile ? <span className="text-[11px] text-slate-400">Esc closes</span> : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={stepIndex === 0}
                onClick={() => goToStep(stepIndex - 1)}
              >
                Back
              </Button>
              <Button type="button" size="sm" className="shadow-lg shadow-sky-950/30" onClick={() => goToStep(stepIndex + 1)}>
                {stepIndex === steps.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
