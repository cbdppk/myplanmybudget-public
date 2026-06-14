"use server";

import { headers } from "next/headers";
import { prismaAdmin } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { saveCredentialHash } from "@/lib/data/auth";
import { setDbIdentity } from "@/lib/security/db-context";

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

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  if (!token || !newPassword) {
    return { ok: false, message: "Invalid request." };
  }
  if (newPassword.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const ip = await getIp();
  const ipRate = await checkRateLimit(`pwd-reset-use:ip:${ip}`, 10, 15 * 60_000);
  if (!ipRate.allowed) {
    return { ok: false, message: "Too many attempts. Please try again in a few minutes." };
  }

  const record = await prismaAdmin.verificationToken.findFirst({
    where: { token },
  });

  if (!record) {
    return { ok: false, message: "This reset link is invalid or has already been used." };
  }

  if (!record.identifier.startsWith(RESET_IDENTIFIER_PREFIX)) {
    return { ok: false, message: "This reset link is invalid." };
  }

  if (record.expires < new Date()) {
    await prismaAdmin.verificationToken.delete({
      where: { identifier_token: { identifier: record.identifier, token: record.token } },
    });
    return { ok: false, message: "This reset link has expired. Please request a new one." };
  }

  const email = record.identifier.slice(RESET_IDENTIFIER_PREFIX.length);
  const profile = await prismaAdmin.userProfile.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!profile) {
    return { ok: false, message: "Account not found." };
  }

  // Delete the token before updating the password to prevent reuse
  await prismaAdmin.verificationToken.delete({
    where: { identifier_token: { identifier: record.identifier, token: record.token } },
  });

  setDbIdentity({ userId: profile.id, userEmail: profile.email });
  await saveCredentialHash(profile.id, hashPassword(newPassword));

  return { ok: true, message: "Password updated. You can now sign in with your new password." };
}

export async function validateResetToken(token: string): Promise<{ valid: boolean }> {
  if (!token) return { valid: false };
  const record = await prismaAdmin.verificationToken.findFirst({
    where: {
      token,
      identifier: { startsWith: RESET_IDENTIFIER_PREFIX },
      expires: { gt: new Date() },
    },
    select: { token: true },
  });
  return { valid: Boolean(record) };
}
