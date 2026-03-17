/**
 * RBAC Worker Role Tests
 *
 * Uses the `worker.json` storageState (qa-worker@iworkrapp.com / technician role).
 * Verifies that restricted routes correctly redirect or deny access.
 *
 * The `test.use({ storageState })` is set in playwright.config.ts at the
 * project level — these tests inherit it automatically.
 */

import { test, expect } from "@playwright/test";

// Routes that a TECHNICIAN role should NOT be able to access
const RESTRICTED_ROUTES = [
  "/dashboard/finance",
  "/dashboard/finance/coordination-ledger",
  "/dashboard/finance/ndis-claims",
  "/dashboard/team",
  "/dashboard/automations",
  "/settings/billing",
  "/settings/members",
];

// Routes a technician SHOULD be able to reach
const ALLOWED_ROUTES = [
  "/dashboard",
  "/dashboard/jobs",
  "/dashboard/schedule",
];

test.describe("RBAC: Worker role access control", () => {
  for (const route of RESTRICTED_ROUTES) {
    test(`Worker is blocked from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => null);

      const url = page.url();

      // Accept any of: redirect to unauthorized, redirect to dashboard, or
      // a visible "Access Denied" / "Unauthorized" element on the page.
      const isBlocked =
        url.includes("/unauthorized") ||
        url.includes("/dashboard") && !url.includes(route.split("/").pop()!) ||
        (await page.locator("text=Access Denied").count()) > 0 ||
        (await page.locator("text=Unauthorized").count()) > 0 ||
        (await page.locator("text=Permission denied").count()) > 0;

      expect(
        isBlocked,
        `Expected ${route} to be blocked for worker role, but landed on ${url}`
      ).toBeTruthy();
    });
  }

  for (const route of ALLOWED_ROUTES) {
    test(`Worker can access ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => null);

      const url = page.url();
      const isAllowed = url.includes(route) || url.includes("/dashboard");

      expect(
        isAllowed,
        `Expected ${route} to be accessible for worker, but landed on ${url}`
      ).toBeTruthy();
    });
  }
});
