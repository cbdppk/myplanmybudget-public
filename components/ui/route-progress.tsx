"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
//route
export function RouteProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    // Navigation completed — sweep to 100% then fade out
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    setWidth(100);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 400);
  }, [pathname]);

  if (!visible && width === 0) return null;

  return (
    <div
      className="route-progress-bar"
      style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      aria-hidden="true"
    />
  );
}
