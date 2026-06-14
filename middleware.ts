import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPrefixes = [
  "/dashboard",
  "/budget",
  "/plan",
  "/goals",
  "/goal-planner",
  "/track",
  "/simulate",
  "/notes",
  "/reminders",
  "/settings",
  "/profile",
  "/admin",
  "/onboarding",
  "/auth/post-login",
  "/transactions",
  "/budgets",
  "/simulations",
];

function buildCsp(nonce: string, isProd: boolean) {
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
    "report-uri /api/csp-report",
  ].join("; ");
}

function withSecurityHeaders(response: NextResponse, nonce: string, isProd: boolean) {
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", buildCsp(nonce, isProd));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent SSL stripping on first visit and subsequent requests.
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Restrict access to sensitive browser features.
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
  );
  return response;
}

function hasSessionCookie(request: NextRequest) {
  const names = request.cookies.getAll().map((item) => item.name);
  return names.some((name) => {
    if (!name) return false;
    return (
      name === "authjs.session-token" ||
      name.startsWith("authjs.session-token.") ||
      name === "__Secure-authjs.session-token" ||
      name.startsWith("__Secure-authjs.session-token.") ||
      name === "next-auth.session-token" ||
      name.startsWith("next-auth.session-token.") ||
      name === "__Secure-next-auth.session-token" ||
      name.startsWith("__Secure-next-auth.session-token.")
    );
  });
}

export async function middleware(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const { pathname } = request.nextUrl;

  // All API routes must never be cached — they return dynamic, user-specific data.
  const isApiRoute = pathname.startsWith("/api/");

  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    if (isApiRoute) response.headers.set("Cache-Control", "no-store, private");
    return withSecurityHeaders(response, nonce, isProd);
  }

  const hasSession = hasSessionCookie(request);
  if (hasSession) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    if (isApiRoute) response.headers.set("Cache-Control", "no-store, private");
    return withSecurityHeaders(response, nonce, isProd);
  }

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = "/login";
  nextUrl.searchParams.set("next", pathname);
  const response = NextResponse.redirect(nextUrl);
  response.headers.set("x-request-id", requestId);
  return withSecurityHeaders(response, nonce, isProd);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
