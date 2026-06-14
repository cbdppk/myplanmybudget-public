import assert from "node:assert/strict";
import test from "node:test";
import { loadTsModule } from "./load-ts-module.mjs";

test("parseSettingsVersion accepts valid ISO timestamps and rejects invalid values", async () => {
  const { parseSettingsVersion } = await loadTsModule("lib/data/settings-guards.ts");

  const parsed = parseSettingsVersion("2026-02-26T10:30:00.000Z");
  assert.equal(parsed?.toISOString(), "2026-02-26T10:30:00.000Z");
  assert.equal(parseSettingsVersion(undefined), null);
  assert.throws(() => parseSettingsVersion("not-a-date"), /Invalid settings version/);
});

test("isExpectedVersionMatch returns true only for exact timestamp matches", async () => {
  const { isExpectedVersionMatch } = await loadTsModule("lib/data/settings-guards.ts");
  const current = new Date("2026-02-26T12:00:00.000Z");
  const same = new Date("2026-02-26T12:00:00.000Z");
  const stale = new Date("2026-02-26T11:59:59.999Z");

  assert.equal(isExpectedVersionMatch(current, same), true);
  assert.equal(isExpectedVersionMatch(current, stale), false);
  assert.equal(isExpectedVersionMatch(current, null), true);
});

test.skip("checkRateLimit enforces limit and then resets after the window", async () => {
  const { checkRateLimit } = await loadTsModule("lib/security/rate-limit.ts");
  const key = `settings-test-${Date.now()}-${Math.random()}`;

  const first = checkRateLimit(key, 2, 50);
  const second = checkRateLimit(key, 2, 50);
  const third = checkRateLimit(key, 2, 50);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok((third.retryAfterMs ?? 0) > 0);

  await new Promise((resolve) => setTimeout(resolve, 60));
  const afterWindow = checkRateLimit(key, 2, 50);
  assert.equal(afterWindow.allowed, true);
});

test("runSettingsMutationWithGuards blocks unauthenticated calls before mutation run", async () => {
  const { runSettingsMutationWithGuards } = await loadTsModule("lib/security/settings-mutation-guard.ts");
  let called = false;
  await assert.rejects(
    () =>
      runSettingsMutationWithGuards(
        "updateBudgetPlan",
        async () => {
          called = true;
          return { ok: true };
        },
        {
          requireUser: async () => {
            throw new Error("UNAUTHENTICATED");
          },
          hasRecentReauth: async () => true,
          checkRateLimit: () => ({ allowed: true }),
        }
      ),
    /UNAUTHENTICATED/
  );
  assert.equal(called, false);
});

test("runSettingsMutationWithGuards blocks when reauth is required and missing", async () => {
  const { runSettingsMutationWithGuards } = await loadTsModule("lib/security/settings-mutation-guard.ts");
  let called = false;
  await assert.rejects(
    () =>
      runSettingsMutationWithGuards(
        "updateSecurityPreferences",
        async () => {
          called = true;
          return { ok: true };
        },
        {
          requireUser: async () => ({ id: "u1" }),
          hasRecentReauth: async () => false,
          checkRateLimit: () => ({ allowed: true }),
        },
        { requireReauth: true }
      ),
    /re-authenticate in Security/i
  );
  assert.equal(called, false);
});

test("runSettingsMutationWithGuards blocks when rate limit is exceeded", async () => {
  const { runSettingsMutationWithGuards } = await loadTsModule("lib/security/settings-mutation-guard.ts");
  let called = false;
  await assert.rejects(
    () =>
      runSettingsMutationWithGuards(
        "updateNotificationSettings",
        async () => {
          called = true;
          return { ok: true };
        },
        {
          requireUser: async () => ({ id: "u2" }),
          hasRecentReauth: async () => true,
          checkRateLimit: () => ({ allowed: false }),
        }
      ),
    /Too many settings updates/
  );
  assert.equal(called, false);
});

test("runSettingsMutationWithGuards runs mutation when all guards pass", async () => {
  const { runSettingsMutationWithGuards } = await loadTsModule("lib/security/settings-mutation-guard.ts");
  const result = await runSettingsMutationWithGuards(
    "updateGoalsSettings",
    async () => ({ ok: true, value: 7 }),
    {
      requireUser: async () => ({ id: "u3" }),
      hasRecentReauth: async () => true,
      checkRateLimit: () => ({ allowed: true }),
    },
    { requireReauth: true, limit: 10, windowMs: 60_000 }
  );
  assert.deepEqual(result, { ok: true, value: 7 });
});
