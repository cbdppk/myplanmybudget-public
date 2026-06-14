"use client";

import { useState, useRef, useEffect } from "react";

export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [align, setAlign] = useState<"left" | "center" | "right">("center");

  function computeAlign() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    // Need 224px (w-56) on each side — use left-aligned if near right edge
    if (vw - rect.right < 230) setAlign("right");
    else if (rect.left < 120) setAlign("left");
    else setAlign("center");
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const tipClass =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        aria-label="Help"
        onClick={() => {
          computeAlign();
          setOpen((v) => !v);
        }}
        className="theme-chip inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full text-[11px] font-semibold transition hover:opacity-80"
      >
        ?
      </button>
      {open && (
        <div
          className={`theme-tooltip absolute top-full z-50 mt-2 w-56 max-w-[min(14rem,calc(100vw-2rem))] rounded-xl p-3 text-xs shadow-lg ${tipClass}`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
