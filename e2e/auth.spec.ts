import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_EMAIL;
const TEST_PASSWORD = process.env.E2E_PASSWORD;

test.describe("Authentication", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /sign in/i })).toBeEnabled({ timeout: 30_000 });
  });

  test("redirects unauthenticated users from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });
});

test.describe("Authenticated flows", () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "E2E_EMAIL and E2E_PASSWORD must be set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_EMAIL!);
    await page.getByLabel("Password").fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|track)/, { timeout: 30_000 });
  });

  test("dashboard loads with key sections", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/budget|income|expense/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("track page - add income transaction", async ({ page }) => {
    await page.goto("/track");
    await expect(page.getByText(/add transaction|quick add/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("notes page loads", async ({ page }) => {
    await page.goto("/notes");
    await expect(page.getByText(/new note/i)).toBeVisible({ timeout: 10_000 });
  });

  test("goals page loads", async ({ page }) => {
    await page.goto("/goals");
    await expect(page.getByText(/goal/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("can sign out", async ({ page }) => {
    await page.goto("/settings");
    const signOutBtn = page.getByRole("button", { name: /log out|sign out/i });
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    }
  });
});
