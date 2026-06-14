"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "rounded-xl border border-slate-200 shadow-md text-sm",
          success: "!border-green-200 !bg-green-50 !text-green-900",
          error: "!border-red-200 !bg-red-50 !text-red-900",
        },
      }}
    />
  );
}
