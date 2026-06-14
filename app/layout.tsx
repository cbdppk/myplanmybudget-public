import "./globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/toaster";
import { CookieBanner } from "@/components/feature/cookie-banner";
import { InteractionFeedback } from "@/components/feature/interaction-feedback";
import { RouteProgress } from "@/components/ui/route-progress";
import { getSessionUser } from "@/lib/auth/session";
import { hasCompletedBudgetOnboarding } from "@/lib/data/onboarding";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=t==='light'?'light':(t==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):'dark');document.documentElement.setAttribute('data-theme',d);document.documentElement.classList.toggle('dark',d==='dark');document.documentElement.style.colorScheme=d;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "MyplanMybudget",
  description: "Simple budget planning, simulations, and reminders.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: ["/icon"],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0369a1",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  let sessionUser: Awaited<ReturnType<typeof getSessionUser>> = null;
  let globalNotice: string | null = null;
  try {
    sessionUser = await getSessionUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const digest = typeof error === "object" && error ? (error as { digest?: string }).digest : undefined;
    const lower = message.toLowerCase();
    const isDynamicServerUsage = digest === "DYNAMIC_SERVER_USAGE" || lower.includes("dynamic server usage");
    if (!isDynamicServerUsage) {
      console.error("root_layout_session_error", { message, digest });
      const isDbUnavailable =
        lower.includes("can't reach database server") ||
        lower.includes("connection") ||
        lower.includes("timeout") ||
        lower.includes("database_unavailable");
      if (isDbUnavailable) {
        globalNotice = "Database is temporarily unavailable. You can browse public pages; app data may fail until the connection recovers.";
      }
    }
  }

  const appRoutePrefixes = [
    "/dashboard",
    "/assistant",
    "/ai",
    "/budget",
    "/plan",
    "/goals",
    "/goal-planner",
    "/track",
    "/simulate",
    "/notes",
    "/reminders",
    "/settings",
    "/transactions",
    "/budgets",
    "/simulations",
    "/admin",
    "/profile",
  ];
  const isProtectedAppRoute = appRoutePrefixes.some((prefix) => pathname.startsWith(prefix));

  if (sessionUser && (isProtectedAppRoute || pathname === "/onboarding")) {
    try {
      const hasBudgetSetup = await hasCompletedBudgetOnboarding(sessionUser.id);
      if (!hasBudgetSetup && pathname !== "/onboarding") {
        redirect("/onboarding");
      }
      if (hasBudgetSetup && pathname === "/onboarding") {
        redirect("/dashboard");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();
      const isDbUnavailable =
        lower.includes("can't reach database server") ||
        lower.includes("connection") ||
        lower.includes("timeout") ||
        lower.includes("database_unavailable");
      if (!isDbUnavailable) {
        throw error;
      }
    }
  }

  return (
      <html lang="en" suppressHydrationWarning>
      {/* Inline theme script runs before first paint — prevents flash of wrong theme */}
      <head>
        <script
          id="theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body suppressHydrationWarning>
        <RouteProgress />
        <InteractionFeedback />
        <AppShell sessionUser={sessionUser} globalNotice={globalNotice}>
          {children}
        </AppShell>
        <Toaster />
        <CookieBanner />
      </body>
    </html>
  );
}
