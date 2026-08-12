"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "ghost";
type Size = "default" | "sm" | "lg";

const styles: Record<Variant, string> = {
  default: "bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]",
  outline: "border [border-color:var(--border)] bg-[color:var(--card-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--page-secondary)]",
  ghost: "text-[color:var(--text-secondary)] hover:bg-[color:var(--page-secondary)]",
};

const sizes: Record<Size, string> = {
  default: "h-10 px-4",
  sm: "h-9 px-3 text-sm",
  lg: "h-11 px-6",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
  feedback?: "auto" | "none";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild, loading = false, feedback = "auto", children, disabled, onClick, ...props }, ref) => {
    const [localPending, setLocalPending] = React.useState(false);
    const pendingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const busy = loading || localPending;

    React.useEffect(() => {
      return () => {
        if (pendingTimer.current) clearTimeout(pendingTimer.current);
      };
    }, []);

    const clearPendingSoon = (startedAt: number) => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(60, 180 - elapsed);
      pendingTimer.current = setTimeout(() => setLocalPending(false), waitMs);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      const isSubmitButton = event.currentTarget.type === "submit";
      if (feedback === "none" || loading || isSubmitButton) {
        onClick?.(event);
        return;
      }
      const startedAt = Date.now();
      setLocalPending(true);
      try {
        const result = onClick?.(event);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          Promise.resolve(result).finally(() => clearPendingSoon(startedAt));
        } else {
          clearPendingSoon(startedAt);
        }
      } catch (error) {
        clearPendingSoon(startedAt);
        throw error;
      }
    };

    const base = cn(
      "relative inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
      "disabled:pointer-events-none disabled:opacity-50",
      styles[variant],
      sizes[size],
      className
    );

    if (asChild) {
      const child = children as React.ReactElement<{ className?: string }>;
      if (child?.type === Link) {
        return React.cloneElement(child, { className: cn(base, child.props.className) });
      }
      return <span className={base}>{children}</span>;
    }

    return (
      <button
        ref={ref}
        className={base}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        data-click-loading={busy ? "1" : undefined}
        onClick={handleClick}
        {...props}
      >
        <span className={cn("inline-flex items-center justify-center gap-2", busy && "invisible")}>{children}</span>
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        ) : null}
      </button>
    );
  }
);
Button.displayName = "Button";
