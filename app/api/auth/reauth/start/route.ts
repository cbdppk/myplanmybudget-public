import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { cookies } from "next/headers";

export async function POST() {
  try {
    await requireUser();
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const nonce = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("reauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 5 * 60,
  });

  return Response.json({ callbackUrl: `/api/auth/reauth/verify?nonce=${encodeURIComponent(nonce)}` });
}
