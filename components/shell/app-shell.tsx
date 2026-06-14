"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { LoadingLinkButton } from "@/components/ui/loading-link-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logout } from "@/app/auth/actions";
import { IdleLogout } from "@/components/shell/idle-logout";
import { DashboardTourNudge } from "@/components/feature/dashboard-tour-nudge";
import { InAppOnboardingTour } from "@/components/feature/in-app-onboarding-tour";

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[color:var(--page-bg)]">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--border)] border-t-[color:var(--accent)]" aria-hidden="true" />
    </div>
  );
}

const appNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assistant", label: "Assistant" },
  { href: "/budget",    label: "Budget" },
  { href: "/goals",     label: "Goals" },
  { href: "/track",     label: "Transactions" },
  { href: "/simulate",  label: "Simulations" },
  { href: "/notes",     label: "Notes" },
  { href: "/reminders", label: "Reminders" },
  { href: "/settings",  label: "Settings" },
];

const publicNav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const appPrefixes = ["/dashboard", "/assistant", "/ai", "/budget", "/plan", "/goals", "/goal-planner", "/track", "/simulate", "/notes", "/reminders", "/settings", "/transactions", "/budgets", "/simulations", "/admin", "/profile", "/onboarding", "/auth"];

function isPublicNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAppNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  const aliases: Record<string, string[]> = {
    "/assistant": ["/ai"],
    "/budget": ["/plan", "/budgets"],
    "/track": ["/transactions"],
    "/simulate": ["/simulations"],
  };
  const candidates = [href, ...(aliases[href] ?? [])];
  return candidates.some((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
}

function isModifiedClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function AppShell({
  children,
  sessionUser,
  globalNotice,
}: {
  children: React.ReactNode;
  sessionUser: { id: string; email: string; issuedAt: number } | null;
  globalNotice?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(true);
  const [publicMobileOpen, setPublicMobileOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [routePending, startRouteTransition] = useTransition();
  const [logoutPending, startLogout] = useTransition();
  // Track whether the client has hydrated. Before mount we can't reliably
  // determine the correct shell variant, so we show a neutral spinner to
  // prevent the public header/footer flashing briefly with a logged-in user
  // during auth transitions (e.g. right after login before the server
  // re-render delivers new HTML with the app shell).
  const [mounted, setMounted] = useState(false);
  const isAppRoute = appPrefixes.some((prefix) => pathname?.startsWith(prefix));
  const isAuthed = Boolean(sessionUser);
  const initials = (sessionUser?.email?.slice(0, 2) ?? "U").toUpperCase();
  const navLoading = routePending || pendingHref !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setPublicMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!routePending) {
      const clearId = window.setTimeout(() => setPendingHref(null), 180);
      return () => window.clearTimeout(clearId);
    }
    return undefined;
  }, [routePending]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    if (mobileOpen || publicMobileOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, publicMobileOpen]);

  useEffect(() => {
    const openMobileMenu = () => setMobileOpen(true);
    const closeMobileMenu = () => setMobileOpen(false);
    const showDesktopMenu = () => setDesktopMenuOpen(true);

    window.addEventListener("mpb-tour:open-mobile-menu", openMobileMenu);
    window.addEventListener("mpb-tour:close-mobile-menu", closeMobileMenu);
    window.addEventListener("mpb-tour:show-desktop-menu", showDesktopMenu);
    return () => {
      window.removeEventListener("mpb-tour:open-mobile-menu", openMobileMenu);
      window.removeEventListener("mpb-tour:close-mobile-menu", closeMobileMenu);
      window.removeEventListener("mpb-tour:show-desktop-menu", showDesktopMenu);
    };
  }, []);

  const onNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    afterNavigate?: () => void
  ) => {
    afterNavigate?.();
    if (event.defaultPrevented || isModifiedClick(event)) return;
    const target = event.currentTarget.getAttribute("target");
    if (target && target !== "_self") return;
    if (!href.startsWith("/")) return;
    if (pathname === href) return;
    event.preventDefault();
    setPendingHref(href);
    startRouteTransition(() => {
      router.push(href);
    });
  };

  // On app routes, suppress rendering the shell until the client has mounted.
  // This prevents the public header + footer from briefly flashing with a
  // logged-in user's name during auth transitions (login → dashboard redirect).
  if (isAppRoute && !mounted) {
    return <FullScreenSpinner />;
  }

  if (isAppRoute) {
    return (
      <div className="app-shell-bg min-h-dvh overflow-x-clip">
        {navLoading ? (
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 bg-sky-200/70">
            <div className="h-full w-full animate-pulse bg-sky-600" />
          </div>
        ) : null}
        {/* Skip navigation — keyboard accessibility */}
        <a
          href="#main-content"
          className="app-skip-link sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-sky-400"
        >
          Skip to main content
        </a>
        {isAuthed && <IdleLogout />}
        <header className="app-header-surface sticky top-0 z-30 border-b">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
                data-tour="mobile-menu-button"
                className="flex h-9 w-9 items-center justify-center rounded-xl border [border-color:var(--border)] text-[color:var(--text-secondary)] md:hidden"
                onClick={() => setMobileOpen((value) => !value)}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/dashboard" className="font-semibold tracking-tight text-[color:var(--text-primary)]">
                <span className="hidden sm:inline">MyplanMybudget</span>
                <span className="sm:hidden">MPB</span>
              </Link>
              <button
                type="button"
                className="theme-chip ml-2 hidden rounded-xl px-2 py-1 text-xs md:inline-block"
                onClick={() => setDesktopMenuOpen((v) => !v)}
              >
                {desktopMenuOpen ? "Hide menu" : "Show menu"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/profile" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-xs font-semibold text-white shadow-sm">
                {initials}
              </Link>
            </div>
          </div>
          {globalNotice ? (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              {globalNotice}
            </div>
          ) : null}
        </header>

        <div className="mx-auto flex w-full max-w-7xl items-start gap-4 px-2 py-4">
          <aside
            data-tour="desktop-sidebar"
            className={cn(
              "app-sidebar-surface hidden self-start overflow-hidden rounded-2xl p-3 transition-all duration-300 md:sticky md:top-20 md:block md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto",
              desktopMenuOpen ? "w-64 opacity-100" : "w-0 border-transparent p-0 opacity-0"
            )}
          >
            <p className="kicker text-[color:var(--blue-mid)] dark:text-[color:var(--blue-light)]">Menu</p>
            <nav aria-label="App navigation" className="mt-3 space-y-1">
              {appNav.map((item) => {
                const active = isAppNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-busy={pendingHref === item.href || undefined}
                    className={cn(
                      "block rounded-xl border border-transparent px-3 py-2 text-sm text-[color:var(--text-secondary)] transition hover:border-sky-300/60 hover:bg-[color:var(--page-secondary)] hover:text-[color:var(--text-primary)]",
                      pendingHref === item.href && "opacity-90",
                      active &&
                        "border-sky-300/60 bg-[color:var(--page-secondary)] font-semibold text-[color:var(--text-primary)] shadow-sm"
                    )}
                    onClick={(event) => onNavClick(event, item.href)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {pendingHref === item.href ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                      ) : null}
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <Button
              type="button"
              className="mt-3 w-full"
              variant="outline"
              loading={logoutPending}
              onClick={() => {
                startLogout(async () => {
                  await logout();
                  router.push("/login");
                  router.refresh();
                });
              }}
            >
              Log out
            </Button>
          </aside>
          <div id="main-content" data-tour="app-main-content" className="min-w-0 flex-1">{children}</div>
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-black/35 md:hidden" onClick={() => setMobileOpen(false)}>
            <aside data-tour="mobile-sidebar" className="app-mobile-sheet h-full w-72 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[color:var(--text-primary)]">Menu</p>
                <button type="button" className="text-sm text-[color:var(--text-secondary)]" onClick={() => setMobileOpen(false)}>
                  Close
                </button>
              </div>
              <nav aria-label="Mobile app navigation" className="mt-4 space-y-1">
                {appNav.map((item) => {
                  const active = isAppNavActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-busy={pendingHref === item.href || undefined}
                      className={cn(
                        "block rounded-xl border border-transparent px-3 py-2 text-sm text-[color:var(--text-secondary)] transition hover:border-sky-300/60 hover:bg-[color:var(--page-secondary)] hover:text-[color:var(--text-primary)]",
                        pendingHref === item.href && "opacity-90",
                        active &&
                          "border-sky-300/60 bg-[color:var(--page-secondary)] font-semibold text-[color:var(--text-primary)] shadow-sm"
                      )}
                      onClick={(event) => onNavClick(event, item.href, () => setMobileOpen(false))}
                    >
                      <span className="inline-flex items-center gap-2">
                        {pendingHref === item.href ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                        ) : null}
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
                <Link
                  href="/profile"
                  aria-busy={pendingHref === "/profile" || undefined}
                  className="mt-2 block rounded-xl border [border-color:var(--border)] px-3 py-2 text-sm text-[color:var(--text-secondary)]"
                  onClick={(event) => onNavClick(event, "/profile", () => setMobileOpen(false))}
                >
                  <span className="inline-flex items-center gap-2">
                    {pendingHref === "/profile" ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    ) : null}
                    Profile
                  </span>
                </Link>
                <Button
                  type="button"
                  className="mt-2 w-full"
                  variant="outline"
                  loading={logoutPending}
                  onClick={() => {
                    startLogout(async () => {
                      await logout();
                      setMobileOpen(false);
                      router.push("/login");
                      router.refresh();
                    });
                  }}
                >
                  Log out
                </Button>
              </nav>
            </aside>
          </div>
        ) : null}
        <DashboardTourNudge userEmail={sessionUser?.email ?? null} />
        <InAppOnboardingTour userEmail={sessionUser?.email ?? null} />
      </div>
    );
  }

  return (
    <div className="public-shell-bg flex min-h-dvh flex-col overflow-x-clip">
      {navLoading ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 bg-[color:var(--border)]">
          <div className="h-full w-full animate-pulse bg-blue-500" />
        </div>
      ) : null}
      {/* ── Public header ─────────────────────────────────── */}
      <header className="public-header-surface sticky top-0 z-20 border-b transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-[color:var(--text-primary)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-xs font-black text-white shadow-sm">
              M
            </span>
            <span className="hidden sm:inline">MyplanMybudget</span>
            <span className="sm:hidden">MPB</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden gap-1 md:flex">
            {publicNav.map((item) => {
              const active = isPublicNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-busy={pendingHref === item.href || undefined}
                  className={cn(
                    "rounded-2xl border border-transparent px-4 py-2 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--page-secondary)] hover:text-[color:var(--text-primary)]",
                    pendingHref === item.href && "opacity-70",
                    active && "border-[color:var(--border)] bg-[color:var(--page-secondary)] font-semibold text-[color:var(--text-primary)]"
                  )}
                  onClick={(event) => onNavClick(event, item.href)}
                >
                  <span className="inline-flex items-center gap-2">
                    {pendingHref === item.href ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    ) : null}
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* CTAs + mobile menu trigger */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LoadingLinkButton
              href="/login"
              size="sm"
              variant="outline"
              className="hidden rounded-2xl sm:inline-flex [border-color:rgba(0,0,0,0.18)] dark:[border-color:rgba(255,255,255,0.2)]"
            >
              Sign in
            </LoadingLinkButton>
            <LoadingLinkButton href="/signup" size="sm" className="hidden rounded-2xl border-0 font-semibold sm:inline-flex">
              Get started
            </LoadingLinkButton>
            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={publicMobileOpen}
              aria-controls="public-mobile-nav"
              className="flex h-9 w-9 items-center justify-center rounded-xl border [border-color:var(--border)] text-[color:var(--text-secondary)] md:hidden"
              onClick={() => setPublicMobileOpen((value) => !value)}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        {globalNotice ? (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            {globalNotice}
          </div>
        ) : null}
      </header>

      {/* Mobile nav drawer */}
      {publicMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setPublicMobileOpen(false)}
        >
          <div
            id="public-mobile-nav"
            className="app-mobile-sheet absolute right-2 top-2 h-[calc(100dvh-1rem)] w-[min(22rem,calc(100vw-1rem))] rounded-[1.75rem] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[color:var(--text-primary)]">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-xl border [border-color:var(--border)] text-[color:var(--text-secondary)]"
                onClick={() => setPublicMobileOpen(false)}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="mt-6 space-y-1">
              {publicNav.map((item) => {
                const active = isPublicNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-busy={pendingHref === item.href || undefined}
                    onClick={(event) => onNavClick(event, item.href, () => setPublicMobileOpen(false))}
                    className={cn(
                      "block rounded-2xl border border-transparent px-4 py-3 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--page-secondary)] hover:text-[color:var(--text-primary)]",
                      pendingHref === item.href && "opacity-70",
                      active && "border-[color:var(--border)] bg-[color:var(--page-secondary)] font-semibold text-[color:var(--text-primary)]"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {pendingHref === item.href ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                      ) : null}
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-6 rounded-2xl border [border-color:var(--border)] bg-[color:var(--page-secondary)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Appearance</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">Theme</p>
                  <p className="text-xs text-[color:var(--text-secondary)]">Switch the public site between light and dark.</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <LoadingLinkButton href="/login" variant="outline" className="w-full justify-center rounded-2xl" onClick={() => setPublicMobileOpen(false)}>
                Sign in
              </LoadingLinkButton>
              <LoadingLinkButton href="/signup" className="w-full justify-center rounded-2xl border-0 font-semibold" onClick={() => setPublicMobileOpen(false)}>
                Get started
              </LoadingLinkButton>
            </div>
          </div>
        </div>
      ) : null}

      <main className="flex-1">{children}</main>

      {/* ── Public footer ─────────────────────────────────── */}
      <footer className="public-footer-surface border-t">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">

            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center gap-2.5 font-bold text-[color:var(--text-primary)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-sm font-black text-white shadow-sm">
                  M
                </span>
                <span>MyplanMybudget</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[color:var(--text-secondary)]">
                Personal budgeting by EyeHai Technologies. Plan your month, track every transaction, reach your goals.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="public-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                  ● Free to use
                </span>
              </div>
            </div>

            {/* Product */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Product</p>
              <div className="mt-5 space-y-3">
                {[
                  { href: "/",        label: "Home" },
                  { href: "/about",   label: "About" },
                  { href: "/signup",  label: "Get started" },
                  { href: "/login",   label: "Sign in" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="block text-sm text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Company */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Company</p>
              <div className="mt-5 space-y-3">
                {[
                  { href: "/about",   label: "About us" },
                  { href: "/contact", label: "Contact" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="block text-sm text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Legal</p>
              <div className="mt-5 space-y-3">
                {[
                  { href: "/legal/terms",   label: "Terms of service" },
                  { href: "/legal/privacy", label: "Privacy policy" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="block text-sm text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 flex flex-col gap-2 border-t [border-color:var(--nav-border)] pt-8 text-xs text-[color:var(--text-muted)] md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} EyeHai Technologies. All rights reserved.</p>
            <p>MyplanMybudget — built by EyeHai Technologies.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
