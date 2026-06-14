"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function InfoPopover({
  content,
  label = "More information",
  align: alignProp,
  buttonClassName,
  panelClassName,
}: {
  content: ReactNode;
  label?: string;
  align?: "left" | "center" | "right";
  buttonClassName?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [autoAlign, setAutoAlign] = useState<"left" | "center" | "right">("right");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  function computeAlign() {
    if (alignProp) return;
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const panelWidth = 240; // w-60
    const fitsRight = rect.left + panelWidth <= vw - 8;
    const fitsLeft = rect.right - panelWidth >= 8;
    if (fitsLeft && !fitsRight) setAutoAlign("right");
    else if (fitsRight && !fitsLeft) setAutoAlign("left");
    else if (fitsLeft) setAutoAlign("right");
    else setAutoAlign("left");
  }

  const resolvedAlign = alignProp ?? autoAlign;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          computeAlign();
          setOpen((value) => !value);
        }}
        className={cn(
          "theme-chip inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition hover:bg-[color:var(--page-secondary)] hover:text-[color:var(--text-primary)]",
          buttonClassName,
        )}
      >
        ?
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          className={cn(
            "theme-tooltip absolute top-full z-20 mt-1 w-60 max-w-[min(15rem,calc(100vw-2rem))] rounded-2xl p-3 text-xs",
            resolvedAlign === "left"
              ? "left-0"
              : resolvedAlign === "center"
                ? "left-1/2 -translate-x-1/2"
                : "right-0",
            panelClassName,
          )}
        >
          {content}
        </div>
      ) : null}
    </div>
  );
}
