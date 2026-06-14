import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const ipKey = getClientKey(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String((body as { email?: string }).email ?? "").trim().toLowerCase();
  const password = String((body as { password?: string }).password ?? "");

  const routeRate = await checkRateLimit(`auth:login:ip:${ipKey}`, 20, 60_000);
  if (!routeRate.allowed) {
    return Response.json({ error: "Too many login attempts. Please try again shortly." }, { status: 429 });
  }
  if (email) {
    const accountRate = await checkRateLimit(`auth:login:email:${email}`, 10, 60_000);
    if (!accountRate.allowed) {
      return Response.json({ error: "Too many login attempts. Please try again shortly." }, { status: 429 });
    }
  }

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const { signIn } = await import("@/auth");
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }
}
