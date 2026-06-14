import { randomBytes } from "node:crypto";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/send";

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const VERIFY_IDENTIFIER_PREFIX = "email-verify:";

export async function POST(request: Request) {
  const ipKey = getClientKey(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String((body as { email?: string }).email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email is required." }, { status: 400 });
  }

  const ipRate = await checkRateLimit(`resend-verify:ip:${ipKey}`, 5, 15 * 60_000);
  if (!ipRate.allowed) {
    return Response.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }
  const emailRate = await checkRateLimit(`resend-verify:email:${email}`, 3, 15 * 60_000);
  if (!emailRate.allowed) {
    // Silent to avoid leaking whether email exists
    return Response.json({ ok: true });
  }

  const { prismaAdmin } = await import("@/lib/prisma");

  const profile = await prismaAdmin.userProfile.findUnique({
    where: { email },
    select: { id: true, isActive: true, emailVerified: true },
  });

  // Silent if not found, inactive, or already verified
  if (!profile || !profile.isActive || profile.emailVerified) {
    return Response.json({ ok: true });
  }

  // Check they have a credential (not Google-only)
  const credential = await prismaAdmin.authCredential.findUnique({
    where: { userId: profile.id },
    select: { userId: true },
  });
  if (!credential) {
    return Response.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  const identifier = `${VERIFY_IDENTIFIER_PREFIX}${email}`;
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await prismaAdmin.verificationToken.deleteMany({ where: { identifier } });
  await prismaAdmin.verificationToken.create({
    data: { identifier, token, expires },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Confirm your MyplanMybudget email",
    text: `Please confirm your email address by clicking the link below. This link expires in 24 hours.\n\n${verifyUrl}\n\nIf you did not create an account, you can safely ignore this email.`,
    html: `<p>Please confirm your email address by clicking the link below. This link expires in 24 hours.</p><p><a href="${verifyUrl}">Confirm email address</a></p><p>If you did not create an account, you can safely ignore this email.</p>`,
  });

  return Response.json({ ok: true });
}
