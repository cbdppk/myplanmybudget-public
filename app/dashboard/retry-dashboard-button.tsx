"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RetryDashboardButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      loading={pending}
      disabled={pending}
      onClick={() => {
        start(() => {
          router.refresh();
        });
      }}
    >
      {pending ? "Retrying..." : "Try again"}
    </Button>
  );
}
