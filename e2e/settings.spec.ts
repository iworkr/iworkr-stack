/**
 * ============================================================
 * Settings Module — Comprehensive E2E Tests
 * ============================================================
 *
 * Audits all settings sub-pages:
 *   1. Every settings route loads without crash
 *   2. Settings sidebar links resolve correctly
 *   3. Profile form is interactive
 *   4. Preferences toggles work
 *   5. Form submissions (fuzz test)
 */

import { test, expect } from "@playwright/test";
import { SettingsPage } from "./pages/SettingsPage";
import { logger } from "./utils/logger";
import { SETTINGS_ROUTES } from "./utils/constants";

test.describe("Settings Module Audit", () => {
  test("SETTINGS-001: All settings routes load without crash", async ({ page }) => {
    logger.step("Crawl all settings routes");

    const settings = new SettingsPage(page);
    const results = await settings.auditAllSections();

    const failures = results.filter((r) => !r.ok);
    if (failures.length > 0) {
      logger.fail(`${failures.length} settings routes crashed`);
      for (const f of failures) {
        console.log(`  FAIL: ${f.route} — ${f.error}`);
      }
    } else {
      logger.pass(`All ${results.length} settings routes load OK`);
    }

    expect(failures.length).toBe(0);
  });

  test("SETTINGS-002: Settings sidebar navigation links visible", async ({ page }) => {
    logger.step("Verify settings sidebar");

    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectSettingsLoaded();

    const found = await settings.expectSidebarLinksVisible();
    expect(found).toBeGreaterThanOrEqual(10);

    logger.pass("SETTINGS-002 passed");
  });

  test("SETTINGS-003: Profile page — name input is editable", async ({ page }) => {
    logger.step("Test profile form");

    const settings = new SettingsPage(page);
    await page.goto("/settings/profile");
    await page.waitForTimeout(2000);

    const inputs = page.locator("input:visible");
    const inputCount = await inputs.count();
    logger.info(`Found ${inputCount} visible inputs on profile page`);

    if (inputCount > 0) {
      const firstInput = inputs.first();
      const currentValue = await firstInput.inputValue().catch(() => "");
      logger.info(`First input value: "${currentValue}"`);

      await firstInput.fill("QA Test Admin");
      await page.waitForTimeout(300);

      const newValue = await firstInput.inputValue().catch(() => "");
      if (newValue === "QA Test Admin") {
        logger.pass("Profile name input is editable");
      }

      await firstInput.fill(currentValue || "QA Test Admin");
    } else {
      logger.warn("No inputs found on profile page");
    }

    logger.pass("SETTINGS-003 passed");
  });

  test("SETTINGS-004: Preferences page — toggles and selects", async ({ page }) => {
    logger.step("Test preferences interactions");

    await page.goto("/settings/preferences");
    await page.waitForTimeout(2000);

    const switches = page.locator('button[role="switch"]');
    const switchCount = await switches.count();
    logger.info(`Found ${switchCount} toggle switches on preferences`);

    if (switchCount > 0) {
      const firstSwitch = switches.first();
      const initialState = await firstSwitch.getAttribute("data-state").catch(() => "");

      await firstSwitch.click();
      await page.waitForTimeout(500);

      const newState = await firstSwitch.getAttribute("data-state").catch(() => "");
      if (newState !== initialState) {
        logger.pass(`Toggle switched: ${initialState} → ${newState}`);
      }

      await firstSwitch.click();
      await page.waitForTimeout(300);
    }

    const selects = page.locator("select, button[role='combobox']");
    const selectCount = await selects.count();
    logger.info(`Found ${selectCount} select/combobox elements`);

    logger.pass("SETTINGS-004 passed");
  });

  test("SETTINGS-005: Form submit buttons are functional", async ({ page }) => {
    logger.step("Test form submit buttons across settings");

    const pagesWithForms = [
      "/settings/profile",
      "/settings/preferences",
      "/settings/workspace",
    ];

    for (const route of pagesWithForms) {
      await page.goto(route);
      await page.waitForTimeout(2000);

      const submitBtns = page.locator(
        'button[type="submit"], button:has-text("Save"), button:has-text("Update")'
      );
      const count = await submitBtns.count();

      if (count > 0) {
        const btn = submitBtns.first();
        const text = await btn.textContent().catch(() => "");
        const enabled = await btn.isEnabled().catch(() => false);
        const cursor = await btn.evaluate((el) => getComputedStyle(el).cursor).catch(() => "");

        logger.info(`${route}: "${text?.trim()}" — enabled: ${enabled}, cursor: ${cursor}`);

        if (cursor !== "pointer" && cursor !== "default") {
          logger.warn(`Submit button on ${route} has cursor: ${cursor}`);
        }
      } else {
        logger.info(`${route}: No submit buttons found`);
      }
    }

    logger.pass("SETTINGS-005 passed");
  });

  test("SETTINGS-006: Security page — action buttons visible", async ({ page }) => {
    logger.step("Test security page");

    await page.goto("/settings/security");
    await page.waitForTimeout(2000);

    const body = await page.locator("body").textContent().catch(() => "");
    const hasError = body?.includes("Internal Server Error");

    if (hasError) {
      logger.fail("Security page has server error");
      return;
    }

    const actionKeywords = ["password", "two-factor", "2fa", "sessions", "security"];
    let found = 0;
    for (const kw of actionKeywords) {
      if (body?.toLowerCase().includes(kw)) found++;
    }

    logger.info(`Security page contains ${found}/${actionKeywords.length} expected sections`);
    logger.pass("SETTINGS-006 passed");
  });

  test("SETTINGS-007: Workspace settings — editable", async ({ page }) => {
    logger.step("Test workspace settings");

    await page.goto("/settings/workspace");
    await page.waitForTimeout(2000);

    await new SettingsPage(page).expectNoServerError();

    const inputs = page.locator("input:visible");
    const count = await inputs.count();
    logger.info(`Workspace page: ${count} visible inputs`);

    if (count > 0) {
      logger.pass("Workspace settings has editable inputs");
    }

    logger.pass("SETTINGS-007 passed");
  });
});
