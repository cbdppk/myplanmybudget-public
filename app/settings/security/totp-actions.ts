"use server";

import { requireUser } from "@/lib/auth/session";
import { setupTotp, confirmEnableTotp, disableTotp } from "@/lib/data/totp";
import { logAudit } from "@/lib/data/audit";
import { revalidatePath } from "next/cache";

export async function startTotpSetup(): Promise<{ qrCode: string; secret: string }> {
  const user = await requireUser();
  const result = await setupTotp();
  logAudit(user.id, "totp_setup_started");
  return result;
}

export async function verifyAndEnableTotp(code: string): Promise<{ ok: boolean; backupCodes?: string[]; error?: string }> {
  const user = await requireUser();
  try {
    const { backupCodes } = await confirmEnableTotp(code);
    logAudit(user.id, "totp_enabled");
    revalidatePath("/settings/security");
    return { ok: true, backupCodes };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function disableTotpAction(code: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  try {
    await disableTotp(code);
    logAudit(user.id, "totp_disabled");
    revalidatePath("/settings/security");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed." };
  }
}
