import { generateSecret, generateURI, verifySync } from "otplib";
import qrcode from "qrcode";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/data/utils";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const APP_NAME = "MyplanMybudget";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function verifyTotpCode(secret: string, token: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = verifySync({ secret, token: token.replace(/\s/g, ""), strategy: "totp" }) as any;
    return typeof result === "object" && result !== null ? Boolean(result.valid) : Boolean(result);
  } catch {
    return false;
  }
}

export async function generateTotpQrCode(email: string, secret: string): Promise<string> {
  const otpauth = generateURI({ issuer: APP_NAME, label: email, secret, strategy: "totp" });
  return qrcode.toDataURL(otpauth);
}

/** Store a new secret (not yet enabled) and return the QR code data URL. */
export async function setupTotp(): Promise<{ qrCode: string; secret: string }> {
  const user = await getActiveUser();
  const secret = generateTotpSecret();

  await prisma.userProfile.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  const qrCode = await generateTotpQrCode(user.email, secret);
  return { qrCode, secret };
}

const BACKUP_CODE_COUNT = 10;

// Codes are stored/verified without the display dash (e.g. "ABCD1234").
// The formatted version "ABCD-1234" is shown to the user once for readability.
function makeBackupCode(): { raw: string; display: string } {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return { raw: hex, display: `${hex.slice(0, 4)}-${hex.slice(4)}` };
}

async function storeBackupCodes(userId: string, rawCodes: string[]): Promise<void> {
  await prisma.totpBackupCode.deleteMany({ where: { userId } });
  await prisma.totpBackupCode.createMany({
    data: rawCodes.map((raw) => ({ userId, codeHash: hashPassword(raw) })),
  });
}

/** Verify the user's code against the stored pending secret, then enable TOTP. Returns one-time backup codes. */
export async function confirmEnableTotp(code: string): Promise<{ backupCodes: string[] }> {
  const user = await getActiveUser();
  const profile = await prisma.userProfile.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!profile.totpSecret) throw new Error("No TOTP setup in progress. Start setup first.");
  if (!verifyTotpCode(profile.totpSecret, code)) throw new Error("Invalid code. Check your authenticator app and try again.");

  const generated = Array.from({ length: BACKUP_CODE_COUNT }, makeBackupCode);
  await storeBackupCodes(user.id, generated.map((c) => c.raw));
  const backupCodes = generated.map((c) => c.display);

  await prisma.userProfile.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });

  return { backupCodes };
}

/** Use one backup code (case-insensitive, dashes/spaces stripped) instead of TOTP. Marks it as used. */
export async function useBackupCode(userId: string, rawCode: string): Promise<boolean> {
  // Normalise input: uppercase, strip dashes and spaces → matches stored raw (e.g. "ABCD1234")
  const normalised = rawCode.toUpperCase().replace(/[\s-]/g, "");
  const unused = await prisma.totpBackupCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  });
  for (const row of unused) {
    if (verifyPassword(normalised, row.codeHash)) {
      await prisma.totpBackupCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}

/** Disable TOTP — requires a valid current TOTP code as confirmation. */
export async function disableTotp(code: string): Promise<void> {
  const user = await getActiveUser();
  const profile = await prisma.userProfile.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!profile.totpEnabled || !profile.totpSecret) throw new Error("TOTP is not enabled.");
  if (!verifyTotpCode(profile.totpSecret, code)) throw new Error("Invalid code. TOTP not disabled.");

  await prisma.userProfile.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null },
  });
}
