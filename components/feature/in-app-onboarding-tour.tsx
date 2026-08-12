"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  // When true, the spotlight keeps re-measuring the target on a fast cadence so
  // the highlight stays locked on even as the menu animates open / the layout
  // settles. Used for the menu-intro steps where the sidebar slides in.
  trackTarget?: boolean;
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
          trackTarget: true,
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
          trackTarget: true,
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
          trackTarget: true,
        },
      ];

  // On desktop each page step spotlights that page's sidebar entry, so the user
  // learns where the page lives in the menu while the page itself stays readable
  // behind the dimmed overlay. On mobile the sidebar is a sheet that would cover
  // the page, so the step highlights the page body instead.
  const pages: Array<{ id: string; path: string; title: string; description: string; detail: string }> = [
    {
      id: "dashboard-page",
      path: "/dashboard",
      title: "Dashboard",
      description: "This is your live financial snapshot.",
      detail: "Come here to quickly see your money health, recent activity, goals, reminders, and what needs attention first.",
    },
    {
      id: "budget-page",
      path: "/budget",
      title: "Budget",
      description: "This page is where your plan lives.",
      detail: "Use it to review category budgets, compare your plan against reality, and make sure your monthly setup still fits.",
    },
    {
      id: "goals-page",
      path: "/goals",
      title: "Goals",
      description: "This is where you track savings goals.",
      detail: "Each goal shows progress, remaining amount, and whether your current budget can support it.",
    },
    {
      id: "transactions-page",
      path: "/track",
      title: "Transactions",
      description: "This is where you record what actually happened with your money.",
      detail: "Log income, expenses, and savings here so the rest of the app reflects real activity instead of guesses.",
    },
    {
      id: "simulations-page",
      path: "/simulate",
      title: "Simulations",
      description: "Use this page to test ideas before you commit.",
      detail: "It helps you ask questions like what happens if you spend more, save more, or change your plan over time.",
    },
    {
      id: "notes-page",
      path: "/notes",
      title: "Notes",
      description: "Notes keeps the story behind your numbers.",
      detail: "Store plans, decisions, reminders to yourself, or context you want to remember when reviewing your budget later.",
    },
    {
      id: "reminders-page",
      path: "/reminders",
      title: "Reminders",
      description: "This is where you stay ahead of deadlines.",
      detail: "Use reminders for bills, transfers, reviews, and recurring check-ins so important money tasks do not slip.",
    },
    {
      id: "assistant-page",
      path: "/assistant",
      title: "Assistant",
      description: "Assistant explains the app and reads your current data.",
      detail: "Ask what a metric means, what page to use next, or how your budget is doing in plain language.",
    },
    {
      id: "settings-page",
      path: "/settings",
      title: "Settings",
      description: "Settings is where you control how the app behaves.",
      detail: "Update categories, profile, notifications, security, appearance, and budget rules here whenever your life changes.",
    },
  ];

  return [
    ...menuIntro,
    ...pages.map<TourStep>((page) => ({
      ...page,
      selector: isMobile ? '[data-tour="app-main-content"]' : `[data-tour="nav-${page.path}"]`,
      // The desktop sidebar can be collapsed and animates open over ~300ms, so
      // these steps re-measure while it settles.
      beforeEnter: isMobile ? "close-mobile-menu" : "show-desktop-menu",
      placement: isMobile ? "center" : "right-start",
      trackTarget: !isMobile,
    })),
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
  // Set only once a step's target has stayed unresolvable past the grace period.
  // Until then the previous rect is held so the overlay never blanks mid-step.
  const [targetMissing, setTargetMissing] = useState(false);
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

  // Prefetch every page the tour visits as soon as it starts so stepping
  // between pages feels instant instead of waiting on a fresh route load.
  useEffect(() => {
    if (!active) return;
    const uniquePaths = Array.from(new Set(steps.map((item) => item.path)));
    uniquePaths.forEach((path) => router.prefetch(path));
  }, [active, router, steps]);

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
    // The previous rect is deliberately kept: the spotlight is what draws the
    // dimmed backdrop, so clearing it here made the whole overlay blink off and
    // back on between steps. Holding it lets the highlight glide to the next
    // target instead, and it is replaced as soon as that target measures.
    setTargetMissing(false);
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
    let missingId = 0;
    const updateRect = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const element = document.querySelector(step.selector);
        if (!(element instanceof HTMLElement) || (element.offsetWidth === 0 && element.offsetHeight === 0)) {
          // Hold the previous rect while the next page streams in or the sidebar
          // finishes animating; only give up if it stays unresolvable.
          if (!missingId) {
            missingId = window.setTimeout(() => setTargetMissing(true), 1200);
          }
          return;
        }
        window.clearTimeout(missingId);
        missingId = 0;
        setTargetMissing(false);

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

        const next = element.getBoundingClientRect();
        // Skip no-op state updates: trackTarget re-measures on an interval and
        // re-rendering on an identical rect is what made the highlight shimmer.
        setTargetRect((prev) =>
          prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height
            ? prev
            : next
        );
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

    // Measure as soon as the next frame paints so the highlight appears
    // immediately, then re-measure shortly after to catch menu open / layout
    // settle animations. Steps that animate the menu in (trackTarget) keep
    // re-measuring on a short interval so the spotlight stays locked on.
    updateRect();
    const settleId = window.setTimeout(updateRect, step.beforeEnter === "open-mobile-menu" ? 220 : 90);
    const trackingId =
      step.trackTarget
        ? window.setInterval(updateRect, 120)
        : 0;
    const trackingStopId =
      step.trackTarget
        ? window.setTimeout(() => window.clearInterval(trackingId), 900)
        : 0;

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("keydown", onEscape);
    visualViewport?.addEventListener("resize", updateRect);
    visualViewport?.addEventListener("scroll", updateRect);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(missingId);
      window.clearTimeout(settleId);
      if (trackingId) window.clearInterval(trackingId);
      if (trackingStopId) window.clearTimeout(trackingStopId);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("keydown", onEscape);
      visualViewport?.removeEventListener("resize", updateRect);
      visualViewport?.removeEventListener("scroll", updateRect);
      resizeObserver?.disconnect();
    };
  }, [active, activeKey, finishTour, isMobile, pathname, router, step, stepIndex, stepKey, viewport.height]);

  if (!active || !step) return null;

  const rect = targetMissing ? null : getSpotlightRect({ targetRect, viewport, isMobile, step });
  const desktopTooltipStyle = getDesktopTooltipStyle(rect, viewport, step.placement ?? "auto");
  const progressPercent = ((stepIndex + 1) / steps.length) * 100;
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[160] [color-scheme:dark]"
      role="dialog"
      aria-modal="true"
      aria-label={`App tour step ${stepIndex + 1}`}
    >
      {/*
        Transparent capture layer: the tour is modal, so it swallows clicks on
        the app behind it. It must not paint anything — the dimming comes from
        the spotlight's outward box-shadow below, which respects the border
        radius and therefore leaves a genuinely clear hole over the target.
        The previous build stacked an opaque, blurred sheet over the whole
        viewport, so the "highlighted" element was dimmed and blurred exactly
        like everything else.
      */}
      <div className="absolute inset-0" />

      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[1.25rem] border-2 border-sky-300 shadow-[0_0_0_2px_rgba(125,211,252,0.7),0_0_28px_4px_rgba(56,189,248,0.45),0_0_0_9999px_rgba(2,6,23,0.78)] transition-[top,left,width,height] duration-300 ease-out will-change-[top,left,width,height]"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        >
          <div className="absolute -inset-1 rounded-[1.4rem] border border-sky-200/50 motion-safe:animate-pulse" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_32%),rgba(2,6,23,0.82)]" />
      )}

      {/*
        The tour card is intentionally self-contained: it hardcodes a dark
        surface, light text and solid buttons so it is always readable and the
        controls are always visible, regardless of the active app theme
        (previously the primary button used theme accent vars and could wash out
        on the light theme).
      */}
      <div
        className="absolute rounded-[1.75rem] border border-white/15 bg-slate-950 text-white shadow-[0_24px_80px_rgba(2,6,23,0.6)] ring-1 ring-sky-400/20 transition-[top,left] duration-300 ease-out"
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
        <div className="h-1.5 overflow-hidden rounded-t-[1.75rem] bg-white/10">
          <div className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-[width] duration-200" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                App Tour {stepIndex + 1} / {steps.length}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">{step.title}</h2>
            </div>
            <button
              type="button"
              aria-label="Close tour"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-lg leading-none text-white transition hover:bg-white/20"
              onClick={finishTour}
            >
              ×
            </button>
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
                      : "h-2.5 w-2.5 rounded-full bg-white/25"
                }
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                onClick={finishTour}
              >
                Skip tour
              </button>
              {!isMobile ? <span className="text-[11px] text-slate-400">Esc closes</span> : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={stepIndex === 0}
                onClick={() => goToStep(stepIndex - 1)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:bg-sky-400"
                onClick={() => goToStep(stepIndex + 1)}
              >
                {isLastStep ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
