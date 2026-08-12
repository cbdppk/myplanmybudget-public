"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { runSettingsMutationWithGuards } from "@/lib/security/settings-mutation-guard";
import { hasRecentReauth, requireUser, getSessionUser } from "@/lib/auth/session";
import {
  archiveCategory as archiveCategoryRepo,
  createAccount as createAccountRepo,
  createCategory as createCategoryRepo,
  deleteCategory as deleteCategoryRepo,
  deactivateAccount as deactivateAccountRepo,
  resetAllUserData as resetAllUserDataRepo,
  updateAppearanceSettings as updateAppearanceSettingsRepo,
  updateBudgetPlan as updateBudgetPlanRepo,
  updateBudgetPreferences as updateBudgetPreferencesRepo,
  updateGoalsSettings as updateGoalsSettingsRepo,
  updateNotificationSettings as updateNotificationSettingsRepo,
  updatePrivacySettings as updatePrivacySettingsRepo,
  updateProfile as updateProfileRepo,
  updateProfileDetails as updateProfileDetailsRepo,
  updateSecurityPreferences as updateSecurityPreferencesRepo,
} from "@/lib/data/settings";
import { importTransactionsCsv as importTransactionsCsvRepo } from "@/lib/data/import";

const ProfileSchema = z.object({
  name: z.string().min(2).max(80),
  currency: z.string().min(3).max(5),
});

const ProfileDetailsSchema = z.object({
  name: z.string().min(2).max(80),
  timezone: z.string().min(2).max(80),
  language: z.string().min(2).max(20),
});

const SecurityPrefsSchema = z.object({
  notifyEmail: z.boolean(),
});

const AccountSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.string().min(2).max(30),
  balance: z.number(),
});

const CategorySchema = z.object({
  name: z.string().min(2).max(80),
  kind: z.enum(["expense", "savings"]),
});

const BudgetPlanSchema = z.object({
  baselineIncome: z.number().min(0),
  baselineExpense: z.number().min(0),
  baselineSavings: z.number().min(0),
  dailySpendEstimate: z.number().min(0),
  expectedUpdatedAt: z.string().datetime().optional(),
  items: z.array(
    z.object({
      categoryId: z.string().min(1),
      amount: z.number().min(0),
      cadence: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    })
  ),
});

const BudgetPrefsSchema = z.object({
  preferredCurrency: z.string().min(3).max(5),
  incomeFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  budgetStartMode: z.enum(["CURRENT_MONTH", "NEXT_MONTH"]),
  blockExtrasWhenSurplusNegative: z.boolean(),
  showSimulationSuggestion: z.boolean(),
  dailyEstimateAuto: z.boolean(),
  dailySpendEstimate: z.number().min(0),
  expectedUpdatedAt: z.string().datetime().optional(),
});

const GoalsSettingsSchema = z.object({
  autoCreateGoalsFromSavings: z.boolean(),
  goalFundingSource: z.enum(["SAVINGS_ONLY", "SAVINGS_PLUS_SURPLUS", "SURPLUS_ONLY"]),
});

const NotificationsSchema = z.object({
  notifyDailyCheckIn: z.boolean(),
  notifyWeeklySummary: z.boolean(),
  notifyMonthEndReview: z.boolean(),
  notifyGoalProgress: z.boolean(),
  notifyInApp: z.boolean(),
  notifyEmail: z.boolean(),
  notifyPush: z.boolean(),
});

const PrivacySchema = z.object({
  analyticsOptIn: z.boolean(),
  tipsOptIn: z.boolean(),
});

const AppearanceSchema = z.object({
  themePreference: z.enum(["light", "dark", "system"]),
});

type SettingsActionCode =
  | "REAUTH_REQUIRED"
  | "RATE_LIMITED"
  | "STALE_VERSION"
  | "UNAUTHENTICATED"
  | "ACCOUNT_DISABLED"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export type SettingsActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: SettingsActionCode; error: string };

function mapSettingsActionError(error: unknown): { code: SettingsActionCode; error: string } {
  const message = error instanceof Error ? error.message : "Unexpected settings error.";
  const text = message.toLowerCase();
  if (text.includes("re-authenticate in security")) {
    return {
      code: "REAUTH_REQUIRED",
      error: "Security verification expired. Open Settings > Security and verify again.",
    };
  }
  if (text.includes("too many settings updates")) {
    return { code: "RATE_LIMITED", error: "Too many settings updates. Please wait and try again." };
  }
  if (text.includes("settings changed in another session")) {
    return { code: "STALE_VERSION", error: "Settings changed in another session. Refresh and try again." };
  }
  if (text.includes("unauthenticated")) {
    return { code: "UNAUTHENTICATED", error: "Your session expired. Please sign in again." };
  }
  if (
    text.includes("database_unavailable") ||
    text.includes("can't reach database server") ||
    text.includes("connection") ||
    text.includes("timeout")
  ) {
    return { code: "UNKNOWN_ERROR", error: "Database is temporarily unavailable. Please retry in a moment." };
  }
  if (text.includes("account_disabled")) {
    return { code: "ACCOUNT_DISABLED", error: "Your account is disabled. Contact support or an administrator." };
  }
  if (text.includes("invalid")) {
    return { code: "VALIDATION_ERROR", error: message };
  }
  return { code: "UNKNOWN_ERROR", error: message };
}

async function runSettingsMutationSafe<T>(
  actionName: string,
  run: () => Promise<T>
): Promise<SettingsActionResult<T>> {
  try {
    const data = await run();
    return { ok: true, data };
  } catch (error) {
    const mapped = mapSettingsActionError(error);
    console.warn("settings_action_failed", JSON.stringify({ actionName, code: mapped.code, error: mapped.error }));
    return { ok: false, ...mapped };
  }
}

async function runSettingsMutation<T>(
  actionKey: string,
  run: () => Promise<T>,
  options?: { requireReauth?: boolean; limit?: number; windowMs?: number }
) {
  return runSettingsMutationWithGuards(
    actionKey,
    run,
    { requireUser, hasRecentReauth, checkRateLimit },
    options
  );
}

export async function updateProfile(input: z.infer<typeof ProfileSchema>) {
  await runSettingsMutation(
    "updateProfile",
    () => updateProfileRepo(ProfileSchema.parse(input)),
    { requireReauth: true, limit: 12, windowMs: 60_000 }
  );
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateProfileDetails(input: z.infer<typeof ProfileDetailsSchema>) {
  await runSettingsMutation("updateProfileDetails", () => updateProfileDetailsRepo(ProfileDetailsSchema.parse(input)));
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateSecurityPreferences(input: z.infer<typeof SecurityPrefsSchema>) {
  await runSettingsMutation(
    "updateSecurityPreferences",
    () => updateSecurityPreferencesRepo(SecurityPrefsSchema.parse(input)),
    { requireReauth: true, limit: 10, windowMs: 60_000 }
  );
  revalidatePath("/settings");
  return { ok: true };
}

export async function createAccount(input: z.infer<typeof AccountSchema>) {
  await runSettingsMutation("createAccount", () => createAccountRepo(AccountSchema.parse(input)), { limit: 8, windowMs: 60_000 });
  revalidatePath("/settings");
  return { ok: true };
}

export async function createCategory(
  input: z.infer<typeof CategorySchema>
): Promise<SettingsActionResult<{ category: { id: string; name: string; kind: string } | null }>> {
  return runSettingsMutationSafe("createCategory", async () => {
    const result = await runSettingsMutation("createCategory", () => createCategoryRepo(CategorySchema.parse(input)), { limit: 12, windowMs: 60_000 });
    revalidatePath("/settings");
    revalidatePath("/budget");
    revalidatePath("/plan");
    revalidatePath("/track");
    return { category: result?.category ?? null };
  });
}

export async function archiveCategory(categoryId: string): Promise<SettingsActionResult> {
  return runSettingsMutationSafe("archiveCategory", async () => {
    await runSettingsMutation("archiveCategory", () => archiveCategoryRepo(categoryId), { limit: 12, windowMs: 60_000 });
    revalidatePath("/settings");
    revalidatePath("/budget");
    revalidatePath("/plan");
    revalidatePath("/track");
    return undefined;
  });
}

export async function deleteCategory(categoryId: string): Promise<SettingsActionResult> {
  return runSettingsMutationSafe("deleteCategory", async () => {
    await runSettingsMutation("deleteCategory", () => deleteCategoryRepo(categoryId), { limit: 8, windowMs: 60_000 });
    revalidatePath("/settings");
    revalidatePath("/budget");
    revalidatePath("/plan");
    revalidatePath("/track");
    return undefined;
  });
}

export async function updateBudgetPlan(
  input: z.infer<typeof BudgetPlanSchema>
): Promise<SettingsActionResult<{ updatedAt?: string }>> {
  return runSettingsMutationSafe("updateBudgetPlan", async () => {
    const result = await runSettingsMutation(
      "updateBudgetPlan",
      () => updateBudgetPlanRepo(BudgetPlanSchema.parse(input)),
      { requireReauth: true, limit: 10, windowMs: 60_000 }
    );
    revalidatePath("/settings");
    revalidatePath("/budget");
    revalidatePath("/plan");
    revalidatePath("/track");
    revalidatePath("/dashboard");
    revalidatePath("/goals");
    revalidatePath("/simulate");
    return { updatedAt: result?.updatedAt };
  });
}

export async function updateBudgetPreferences(
  input: z.infer<typeof BudgetPrefsSchema>
): Promise<SettingsActionResult<{ updatedAt?: string }>> {
  return runSettingsMutationSafe("updateBudgetPreferences", async () => {
    const result = await runSettingsMutation(
      "updateBudgetPreferences",
      () => updateBudgetPreferencesRepo(BudgetPrefsSchema.parse(input)),
      { requireReauth: true, limit: 10, windowMs: 60_000 }
    );
    revalidatePath("/settings");
    revalidatePath("/budget");
    revalidatePath("/plan");
    revalidatePath("/track");
    revalidatePath("/dashboard");
    return { updatedAt: result?.updatedAt };
  });
}

export async function updateGoalsSettings(input: z.infer<typeof GoalsSettingsSchema>) {
  await runSettingsMutation("updateGoalsSettings", () => updateGoalsSettingsRepo(GoalsSettingsSchema.parse(input)));
  revalidatePath("/settings");
  revalidatePath("/goals");
  return { ok: true };
}

export async function updateNotificationSettings(input: z.infer<typeof NotificationsSchema>) {
  await runSettingsMutation("updateNotificationSettings", () => updateNotificationSettingsRepo(NotificationsSchema.parse(input)));
  revalidatePath("/settings");
  return { ok: true };
}

export async function updatePrivacySettings(input: z.infer<typeof PrivacySchema>) {
  await runSettingsMutation("updatePrivacySettings", () => updatePrivacySettingsRepo(PrivacySchema.parse(input)));
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateAppearanceSettings(input: z.infer<typeof AppearanceSchema>) {
  await runSettingsMutation("updateAppearanceSettings", () => updateAppearanceSettingsRepo(AppearanceSchema.parse(input)));
  revalidatePath("/settings");
  return { ok: true };
}

const ImportCsvSchema = z.object({ csv: z.string().min(1).max(600_000) });

export async function importTransactionsFromCsv(input: z.infer<typeof ImportCsvSchema>) {
  const { csv } = ImportCsvSchema.parse(input);
  let result: Awaited<ReturnType<typeof importTransactionsCsvRepo>> = { imported: 0, skipped: 0, errors: [] };
  await runSettingsMutation(
    "importTransactionsFromCsv",
    async () => {
      result = await importTransactionsCsvRepo(csv);
    },
    { limit: 6, windowMs: 60_000 }
  );
  revalidatePath("/settings");
  revalidatePath("/track");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/goals");
  return { ok: true, ...result };
}

export async function resetAllUserData() {
  await runSettingsMutation("resetAllUserData", () => resetAllUserDataRepo(), { requireReauth: true, limit: 4, windowMs: 60_000 });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/track");
  revalidatePath("/plan");
  revalidatePath("/goals");
  revalidatePath("/simulate");
  return { ok: true };
}

export async function deactivateAccount() {
  await runSettingsMutation("deactivateAccount", () => deactivateAccountRepo(), { requireReauth: true, limit: 4, windowMs: 60_000 });
  revalidatePath("/settings");
  return { ok: true };
}

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function changePassword(input: z.infer<typeof ChangePasswordSchema>): Promise<SettingsActionResult> {
  return runSettingsMutationSafe("changePassword", async () => {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(input);

    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) throw new Error("UNAUTHENTICATED");

    const { getStoredPasswordHash, saveCredentialHash } = await import("@/lib/data/auth");
    const { verifyPassword, hashPassword } = await import("@/lib/auth/password");

    const storedHash = await getStoredPasswordHash(sessionUser.id);
    if (!storedHash) throw new Error("No password credential found for this account.");

    const valid = verifyPassword(currentPassword, storedHash);
    if (!valid) throw new Error("Current password is incorrect.");

    await saveCredentialHash(sessionUser.id, hashPassword(newPassword));
    revalidatePath("/settings/security");
    return undefined;
  });
}
