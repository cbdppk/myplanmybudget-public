"use server";

import { clearSession } from "@/lib/auth/session";

export async function signup() {
  throw new Error("Signup is handled by Google OAuth. Use /login.");
}

export async function login() {
  throw new Error("Login is handled by Google OAuth. Use /login.");
}

export async function logout() {
  await clearSession();
  return { ok: true };
}

export async function reauthenticate(password: string) {
  const _ = password;
  throw new Error("Password re-authentication is disabled. Use Verify with Google in Security.");
}
