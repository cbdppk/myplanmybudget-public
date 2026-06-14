import { prisma } from "@/lib/prisma";

/**
 * Pre-login check: is TOTP required for this email?
 * Returns { totpRequired: boolean }.
 * Does NOT verify credentials — only indicates if 2FA is enrolled.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return Response.json({ totpRequired: false });

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { email },
      select: { totpEnabled: true },
    });
    return Response.json({ totpRequired: Boolean(profile?.totpEnabled) });
  } catch {
    return Response.json({ totpRequired: false });
  }
}
