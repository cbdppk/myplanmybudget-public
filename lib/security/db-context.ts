import { AsyncLocalStorage } from "async_hooks";

type DbIdentity = {
  userId?: string;
  userEmail?: string;
  requestCache?: Map<string, unknown>;
};

const storage = new AsyncLocalStorage<DbIdentity>();

export function getDbIdentity(): DbIdentity {
  return storage.getStore() ?? {};
}

export function setDbIdentity(identity: DbIdentity) {
  const current = storage.getStore() ?? {};
  storage.enterWith({
    ...current,
    ...identity,
  });
}

export function clearDbIdentity() {
  storage.enterWith({});
}

/**
 * Returns the per-request cache map, creating it lazily on first access.
 * Returns null if no request context is active (i.e. setDbIdentity was never
 * called for this async chain), which prevents cache pollution across requests.
 *
 * Next.js App Router executes each incoming request in its own async
 * continuation, so values set via enterWith() are isolated to that request's
 * async tree and do not leak to sibling requests in production.
 */
function getOrCreateCache(): Map<string, unknown> | null {
  const current = storage.getStore();
  if (!current) return null;
  if (!current.requestCache) current.requestCache = new Map<string, unknown>();
  return current.requestCache;
}

export function hasRequestCache(key: string): boolean {
  const cache = getOrCreateCache();
  return cache !== null && cache.has(key);
}

export function getRequestCache<T>(key: string): T | undefined {
  const cache = getOrCreateCache();
  return cache?.get(key) as T | undefined;
}

export function setRequestCache<T>(key: string, value: T): void {
  const cache = getOrCreateCache();
  cache?.set(key, value);
}
