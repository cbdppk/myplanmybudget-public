type RateResult = { allowed: boolean };
type GuardOptions = { requireReauth?: boolean; limit?: number; windowMs?: number };
type GuardDeps = {
  requireUser: () => Promise<{ id: string }>;
  hasRecentReauth: () => Promise<boolean>;
  checkRateLimit: (key: string, limit: number, windowMs: number) => Promise<RateResult>;
};

export async function runSettingsMutationWithGuards<T>(
  actionKey: string,
  run: () => Promise<T>,
  deps: GuardDeps,
  options?: GuardOptions
) {
  const user = await deps.requireUser();
  const limit = options?.limit ?? 25;
  const windowMs = options?.windowMs ?? 60_000;
  const rate = await deps.checkRateLimit(`settings:${user.id}:${actionKey}`, limit, windowMs);
  if (!rate.allowed) {
    throw new Error("Too many settings updates. Please wait and try again.");
  }
  if (options?.requireReauth) {
    const allowed = await deps.hasRecentReauth();
    if (!allowed) {
      throw new Error("Please re-authenticate in Security to continue.");
    }
  }
  return run();
}
