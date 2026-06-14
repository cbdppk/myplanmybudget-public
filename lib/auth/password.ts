import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) return false;
  const computed = scryptSync(password, salt, KEY_LEN);
  const reference = Buffer.from(hashed, "hex");
  if (computed.length !== reference.length) return false;
  return timingSafeEqual(computed, reference);
}
