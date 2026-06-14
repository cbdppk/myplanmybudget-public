import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { markRecentReauth } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// GET /api/auth/reauth/verify?nonce=<nonce>
// Called after Google OAuth callback to verify the reauth nonce.
// Cookie deletion is only allowed in Route Handlers, not Server Components.
export async function GET(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get("nonce") ?? "";
  const cookieStore = await cookies();
  const cookieNonce = cookieStore.get("reauth_nonce")?.value ?? "";

  if (!nonce || !cookieNonce || nonce !== cookieNonce) {
    redirect("/auth/reauth-complete?status=failed");
  }

  cookieStore.delete("reauth_nonce");

  try {
    await markRecentReauth();
  } catch {
    redirect("/auth/reauth-complete?status=failed");
  }

  redirect("/auth/reauth-complete?status=done");
}
