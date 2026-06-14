"use client";

import { useEffect } from "react";

const CLICKABLE_SELECTOR = [
  "button",
  "a[href]",
  "[role='button']",
  "input[type='button']",
  "input[type='submit']",
  "input[type='reset']",
  "summary",
].join(", ");

type TrackedElement = HTMLElement & {
  __clickFeedbackClear?: number;
  __clickLoadingClear?: number;
  __clickLoadingPoll?: number;
};

function asTrackedElement(target: EventTarget | null): TrackedElement | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest(CLICKABLE_SELECTOR);
  if (!(node instanceof HTMLElement)) return null;
  return node as TrackedElement;
}

function clearPress(el: TrackedElement) {
  if (el.__clickFeedbackClear) {
    window.clearTimeout(el.__clickFeedbackClear);
    el.__clickFeedbackClear = undefined;
  }
  el.removeAttribute("data-clicking");
}

function clearLoading(el: TrackedElement) {
  if (el.__clickLoadingClear) {
    window.clearTimeout(el.__clickLoadingClear);
    el.__clickLoadingClear = undefined;
  }
  if (el.__clickLoadingPoll) {
    window.clearInterval(el.__clickLoadingPoll);
    el.__clickLoadingPoll = undefined;
  }
  el.removeAttribute("data-click-loading");
}

export function InteractionFeedback() {
  useEffect(() => {
    const onPress = (event: Event) => {
      const el = asTrackedElement(event.target);
      if (!el) return;
      clearPress(el);
      el.setAttribute("data-clicking", "1");
      el.__clickFeedbackClear = window.setTimeout(() => clearPress(el), 220);
    };

    const onRelease = () => {
      document
        .querySelectorAll<TrackedElement>("[data-clicking='1']")
        .forEach((el) => clearPress(el));
    };

    const onClick = (event: Event) => {
      const el = asTrackedElement(event.target);
      if (!el) return;
      clearLoading(el);
      el.setAttribute("data-click-loading", "1");

      const startedAt = Date.now();
      const minimumVisibleMs = 220;
      const maxVisibleMs = 10_000;

      const finishWhenReady = () => {
        const elapsed = Date.now() - startedAt;
        const waitMs = Math.max(0, minimumVisibleMs - elapsed);
        el.__clickLoadingClear = window.setTimeout(() => clearLoading(el), waitMs);
      };

      const isBusy =
        el.getAttribute("aria-busy") === "true" ||
        el.getAttribute("disabled") !== null ||
        el.getAttribute("aria-disabled") === "true";

      if (!isBusy) {
        finishWhenReady();
        return;
      }

      el.__clickLoadingPoll = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const stillBusy =
          el.getAttribute("aria-busy") === "true" ||
          el.getAttribute("disabled") !== null ||
          el.getAttribute("aria-disabled") === "true";
        if (!stillBusy || elapsed >= maxVisibleMs) {
          finishWhenReady();
        }
      }, 140);
    };

    document.addEventListener("pointerdown", onPress, { capture: true, passive: true });
    document.addEventListener("touchstart", onPress, { capture: true, passive: true });
    document.addEventListener("mousedown", onPress, { capture: true, passive: true });
    document.addEventListener("pointerup", onRelease, { capture: true, passive: true });
    document.addEventListener("pointercancel", onRelease, { capture: true, passive: true });
    document.addEventListener("mouseup", onRelease, { capture: true, passive: true });
    document.addEventListener("touchend", onRelease, { capture: true, passive: true });
    document.addEventListener("touchcancel", onRelease, { capture: true, passive: true });
    document.addEventListener("click", onClick, { capture: true, passive: true });

    return () => {
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("touchstart", onPress, true);
      document.removeEventListener("mousedown", onPress, true);
      document.removeEventListener("pointerup", onRelease, true);
      document.removeEventListener("pointercancel", onRelease, true);
      document.removeEventListener("mouseup", onRelease, true);
      document.removeEventListener("touchend", onRelease, true);
      document.removeEventListener("touchcancel", onRelease, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
