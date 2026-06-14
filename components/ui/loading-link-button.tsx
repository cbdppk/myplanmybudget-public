"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

type LoadingLinkButtonProps = Omit<ButtonProps, "asChild"> & {
  href: string;
  replace?: boolean;
  scroll?: boolean;
};

export function LoadingLinkButton({
  href,
  replace = false,
  scroll = true,
  onClick,
  loading,
  disabled,
  type,
  ...props
}: LoadingLinkButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isLoading = Boolean(loading) || pending;

  return (
    <Button
      {...props}
      type={type ?? "button"}
      loading={isLoading}
      disabled={disabled || isLoading}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        startTransition(() => {
          if (replace) router.replace(href, { scroll });
          else router.push(href, { scroll });
        });
      }}
    />
  );
}
