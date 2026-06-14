import type { UserProfile } from "@prisma/client";
import { getUserFxContext } from "@/lib/money/fx";

export async function getDisplayCurrencyContext(user: Pick<UserProfile, "baseCurrency" | "preferredCurrency" | "currency">) {
  const base = user.baseCurrency || user.currency || "USD";
  const preferred = user.preferredCurrency || user.currency || base;
  return getUserFxContext(base, preferred);
}
