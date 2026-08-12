import { prisma } from "@/lib/prisma";

const FX_CACHE_HOURS = 12;
const FX_FETCH_TIMEOUT_MS = 2_500;
const FX_FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
const lastFxFailureByBase = new Map<string, number>();

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function convertAmount(amount: number, rate: number) {
  return round6(amount * (Number.isFinite(rate) && rate > 0 ? rate : 1));
}

async function fetchLiveRates(base: string): Promise<Record<string, number> | null> {
  const lastFailure = lastFxFailureByBase.get(base) ?? 0;
  if (Date.now() - lastFailure < FX_FAILURE_COOLDOWN_MS) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FX_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`, {
      cache: "no-store",
      next: { revalidate: 0 },
      signal: controller.signal,
    });
    if (!res.ok) {
      lastFxFailureByBase.set(base, Date.now());
      return null;
    }
    const payload = (await res.json()) as { rates?: Record<string, number> };
    if (!payload?.rates || typeof payload.rates !== "object") {
      lastFxFailureByBase.set(base, Date.now());
      return null;
    }
    const normalized: Record<string, number> = { [base]: 1 };
    for (const [code, raw] of Object.entries(payload.rates)) {
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
      normalized[code.toUpperCase()] = round6(raw);
    }
    lastFxFailureByBase.delete(base);
    return normalized;
  } catch {
    lastFxFailureByBase.set(base, Date.now());
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getFxRateMap(baseCurrency: string) {
  const base = baseCurrency.toUpperCase();
  const now = new Date();
  const existing = await prisma.fxRateCache.findUnique({ where: { base } });
  const ttlMs = FX_CACHE_HOURS * 60 * 60 * 1000;
  const fresh = existing && now.getTime() - existing.fetchedAt.getTime() <= ttlMs;

  if (fresh) {
    return existing.rates as Record<string, number>;
  }

  // Serve stale cache immediately; refresh in background.
  if (existing) {
    void fetchLiveRates(base).then(async (live) => {
      if (!live) return;
      await prisma.fxRateCache.upsert({
        where: { base },
        update: { rates: live, fetchedAt: new Date() },
        create: { base, rates: live, fetchedAt: new Date() },
      });
    }).catch(() => undefined);
    return existing.rates as Record<string, number>;
  }

  const live = await fetchLiveRates(base);
  if (live) {
    await prisma.fxRateCache.upsert({
      where: { base },
      update: { rates: live, fetchedAt: now },
      create: { base, rates: live, fetchedAt: now },
    });
    return live;
  }
  return { [base]: 1 };
}

export async function getUserFxContext(baseCurrency: string, preferredCurrency: string) {
  const base = baseCurrency.toUpperCase();
  const preferred = preferredCurrency.toUpperCase();
  if (base === preferred) {
    return { baseCurrency: base, preferredCurrency: preferred, fxRate: 1, rates: { [base]: 1 }, rateAvailable: true };
  }
  const rates = await getFxRateMap(base);
  const rate = rates[preferred];
  if (typeof rate === "number" && rate > 0) {
    return { baseCurrency: base, preferredCurrency: preferred, fxRate: rate, rates, rateAvailable: true };
  }
  // No live rate: showing base-currency numbers under the preferred currency's
  // symbol would be a lie. Fall back to displaying the base currency honestly.
  return { baseCurrency: base, preferredCurrency: base, fxRate: 1, rates, rateAvailable: false };
}
