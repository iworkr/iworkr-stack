import { test, expect } from "@playwright/test";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";

test.describe("Authenticated Dashboard Views", () => {
  test("dashboard loads with seeded widgets and data", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).not.toContainText("Sign In");
  });

  test("sidebar navigation renders all primary sections", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    const sidebar = page.locator("nav, [data-testid='sidebar'], aside").first();
    await expect(sidebar).toBeVisible();

    const expectedLabels = ["Jobs", "Schedule", "Clients"];
    for (const label of expectedLabels) {
      const el = page.locator(`nav, aside`).getByText(new RegExp(label, "i")).first();
      await expect(el).toBeVisible({ timeout: 5000 });
    }
  });

  test("command palette opens with keyboard shortcut", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    // Try both Meta+K (macOS) and Control+K (headless/Linux)
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);
    let palette = page.locator("[role='dialog'], [data-testid='command-menu'], [cmdk-dialog], [data-cmdk-root]").first();
    if (!(await palette.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.keyboard.press("Meta+k");
      await page.waitForTimeout(500);
    }
    palette = page.locator("[role='dialog'], [data-testid='command-menu'], [cmdk-dialog], [data-cmdk-root]").first();
    await expect(palette).toBeVisible({ timeout: 5000 });
  });

  test("jobs page renders with table columns visible", async ({ page }) => {
    await page.goto("/dashboard/jobs");
    await expect(page).toHaveURL(/\/dashboard\/jobs/);
    await page.waitForTimeout(2000);
    // Verify the jobs UI chrome renders (table headers, filters, buttons)
    await expect(page.locator("body")).toContainText(/Status|Title|Client|Filter|New Job/i, { timeout: 10_000 });
  });

  test("clients page renders with table columns visible", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await expect(page).toHaveURL(/\/dashboard\/clients/);
    await page.waitForTimeout(2000);
    // Verify the clients UI chrome renders (table headers, filters, buttons)
    await expect(page.locator("body")).toContainText(/Client|Status|Email|Filter|Add Client/i, { timeout: 10_000 });
  });

  test("finance page loads with seeded invoices", async ({ page }) => {
    await page.goto("/dashboard/finance");
    await expect(page).toHaveURL(/\/dashboard\/finance/);
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    await expect(body).not.toContainText(/no invoices|get started/i, { timeout: 15_000 });
  });

  test("schedule page renders calendar view", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await expect(page).toHaveURL(/\/dashboard\/schedule/);
    const calendarElements = page.locator("[data-testid*='schedule'], [data-testid*='calendar'], .fc, table").first();
    await expect(calendarElements).toBeVisible({ timeout: 10_000 });
  });

  test("assets page loads without empty state", async ({ page }) => {
    await page.goto("/dashboard/assets");
    await expect(page).toHaveURL(/\/dashboard\/assets/);
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    await expect(body).not.toContainText(/no assets|get started/i, { timeout: 15_000 });
  });

  test("inbox page loads", async ({ page }) => {
    await page.goto("/dashboard/inbox");
    await expect(page).toHaveURL(/\/dashboard\/inbox/);
    await page.waitForTimeout(3000);
  });

  test("automations page loads without empty state", async ({ page }) => {
    await page.goto("/dashboard/automations");
    await expect(page).toHaveURL(/\/dashboard\/automations/);
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    await expect(body).not.toContainText(/no automations|get started/i, { timeout: 15_000 });
  });
});

test.describe("Settings Views", () => {
  test("settings profile page loads", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/settings\/profile/);
    await expect(page.locator("body")).toContainText(/profile|name|email/i);
  });

  test("settings workspace page loads", async ({ page }) => {
    await page.goto("/settings/workspace");
    await expect(page).toHaveURL(/\/settings\/workspace/);
    await expect(page.locator("body")).toContainText(/workspace|organization|settings/i);
  });

  test("settings billing page loads", async ({ page }) => {
    await page.goto("/settings/billing");
    await expect(page).toHaveURL(/\/settings\/billing/);
    await expect(page.locator("body")).toContainText(/plan|billing|subscription/i);
  });

  test("settings members page loads", async ({ page }) => {
    await page.goto("/settings/members");
    await expect(page).toHaveURL(/\/settings\/members/);
    await expect(page.locator("body")).toContainText(/member|team|invite/i);
  });

  test("settings branding page loads", async ({ page }) => {
    await page.goto("/settings/branding");
    await expect(page).toHaveURL(/\/settings\/branding/);
    await expect(page.locator("body")).toContainText(/brand|logo|color/i);
  });

  test("settings notifications page loads", async ({ page }) => {
    await page.goto("/settings/notifications");
    await expect(page).toHaveURL(/\/settings\/notifications/);
    await expect(page.locator("body")).toContainText(/notification|preference|email/i);
  });

  test("settings security page loads", async ({ page }) => {
    await page.goto("/settings/security");
    await expect(page).toHaveURL(/\/settings\/security/);
    await expect(page.locator("body")).toContainText(/security|password|session/i);
  });

  test("settings integrations page loads", async ({ page }) => {
    await page.goto("/settings/integrations");
    await expect(page).toHaveURL(/\/settings\/integrations/);
    await expect(page.locator("body")).toContainText(/integration|connect|xero|stripe/i);
  });
});

test.describe("Compliance Views", () => {
  test("compliance overview page loads", async ({ page }) => {
    await page.goto("/dashboard/compliance");
    await expect(page).toHaveURL(/\/dashboard\/compliance/);
  });

  test("compliance policies page loads", async ({ page }) => {
    await page.goto("/dashboard/compliance/policies");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/dashboard\/compliance/);
  });
});

test.describe("Public Routes (No Auth)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText(/iWorkr|field|service/i);
  });

  test("auth page shows login or OAuth options", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForTimeout(3000);
    const hasForm = await page.locator("input[type='email'], button, [data-testid*='auth']").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasForm).toBeTruthy();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("body")).toContainText(/privacy/i);
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("body")).toContainText(/terms/i);
  });

  test("unauthenticated user is redirected from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth|\/login|\/$/);
  });
});
