"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prismaAdmin } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RESET_IDENTIFIER_PREFIX = "pwd-reset:";

async function getIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function requestPasswordReset(email: string, cfToken?: string): Promise<{ ok: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const genericMessage = "If an account exists for that email, a reset link has been sent.";

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const turnstileOk = await verifyTurnstile(cfToken);
  if (!turnstileOk) {
    return { ok: false, message: "Bot check failed. Please try again." };
  }

  const ip = await getIp();
  const ipRate = await checkRateLimit(`pwd-reset:ip:${ip}`, 5, 15 * 60_000);
  if (!ipRate.allowed) {
    return { ok: false, message: "Too many requests. Please try again in a few minutes." };
  }
  const emailRate = await checkRateLimit(`pwd-reset:email:${normalizedEmail}`, 3, 15 * 60_000);
  if (!emailRate.allowed) {
    return { ok: true, message: genericMessage }; // Silent to avoid leaking
  }

  // Check if user exists AND has a credential (not google-only)
  const profile = await prismaAdmin.userProfile.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, isActive: true },
  });

  if (!profile || !profile.isActive) {
    return { ok: true, message: genericMessage };
  }

  const credential = await prismaAdmin.authCredential.findUnique({
    where: { userId: profile.id },
    select: { userId: true },
  });

  if (!credential) {
    // Google-only user — silently return generic message
    return { ok: true, message: genericMessage };
  }

  // Generate token and store in VerificationToken table
  const token = randomBytes(32).toString("hex");
  const identifier = `${RESET_IDENTIFIER_PREFIX}${normalizedEmail}`;
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Delete any existing reset token for this email before creating a new one
  await prismaAdmin.verificationToken.deleteMany({
    where: { identifier },
  });
  await prismaAdmin.verificationToken.create({
    data: { identifier, token, expires },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await sendEmail({
    to: normalizedEmail,
    subject: "Reset your MyplanMybudget password",
    text: `You requested a password reset.\n\nClick the link below to set a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>You requested a password reset.</p><p>Click the link below to set a new password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });

  return { ok: true, message: genericMessage };
}
