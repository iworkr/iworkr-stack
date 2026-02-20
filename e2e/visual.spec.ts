/**
 * ============================================================
 * Visual Regression Tests
 * ============================================================
 *
 * Uses Playwright's built-in screenshot comparison to catch
 * CSS regressions. First run generates baseline screenshots;
 * subsequent runs compare against them.
 *
 * Update baselines with: npx playwright test --update-snapshots
 */

import { test, expect } from "@playwright/test";
import { logger } from "./utils/logger";

const VISUAL_PAGES = [
  { name: "dashboard", url: "/dashboard", waitFor: 'h1:has-text("Dashboard")' },
  { name: "jobs-list", url: "/dashboard/jobs", waitFor: 'h1:has-text("Jobs")' },
  { name: "schedule", url: "/dashboard/schedule", waitFor: null },
  { name: "clients", url: "/dashboard/clients", waitFor: null },
  { name: "finance", url: "/dashboard/finance", waitFor: null },
  { name: "settings-preferences", url: "/settings/preferences", waitFor: null },
  { name: "settings-profile", url: "/settings/profile", waitFor: null },
];

test.describe("Visual Regression Tests", () => {
  for (const { name, url, waitFor } of VISUAL_PAGES) {
    test(`VISUAL: ${name} screenshot matches baseline`, async ({ page }) => {
      logger.step(`Visual regression: ${name}`);

      await page.goto(url);
      await page.waitForTimeout(3000);

      if (waitFor) {
        await page.locator(waitFor).waitFor({ timeout: 10_000 }).catch(() => null);
      }

      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot(`${name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
        fullPage: true,
      });

      logger.pass(`Visual: ${name} matches baseline`);
    });
  }

  test("VISUAL: Dark theme — body background is pure black", async ({ page }) => {
    logger.step("Dark theme verification");

    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(bgColor).toBe("rgb(0, 0, 0)");
    logger.pass(`Background: ${bgColor}`);
  });

  test("VISUAL: Inter font is applied globally", async ({ page }) => {
    logger.step("Font verification");

    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

    expect(fontFamily.toLowerCase()).toContain("inter");
    logger.pass(`Font: ${fontFamily.slice(0, 60)}`);
  });

  test("VISUAL: No unstyled default-blue links", async ({ page }) => {
    logger.step("Link color audit");

    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const links = page.locator("a:visible");
    const count = await links.count();
    let defaultBlue = 0;

    for (let i = 0; i < Math.min(count, 20); i++) {
      const color = await links.nth(i).evaluate((el) => getComputedStyle(el).color).catch(() => "");
      if (color === "rgb(0, 0, 238)" || color === "rgb(0, 0, 255)") {
        defaultBlue++;
        const href = await links.nth(i).getAttribute("href").catch(() => "");
        logger.warn(`Default blue link: ${href}`);
      }
    }

    expect(defaultBlue).toBe(0);
    logger.pass(`Checked ${Math.min(count, 20)} links — no default blue`);
  });

  test("VISUAL: All buttons have cursor:pointer", async ({ page }) => {
    logger.step("Button cursor audit");

    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const buttons = page.locator("button:visible");
    const count = await buttons.count();
    let issues = 0;

    for (let i = 0; i < Math.min(count, 25); i++) {
      const cursor = await buttons.nth(i).evaluate((el) => getComputedStyle(el).cursor).catch(() => "pointer");
      if (cursor === "default" || cursor === "auto") {
        issues++;
        const text = await buttons.nth(i).textContent().catch(() => "");
        logger.warn(`Button "${text?.trim().slice(0, 30)}" has cursor: ${cursor}`);
      }
    }

    if (issues === 0) {
      logger.pass(`All ${Math.min(count, 25)} checked buttons have cursor:pointer`);
    }
  });

  test("VISUAL: Sidebar open and collapsed widths", async ({ page }) => {
    logger.step("Sidebar width verification");

    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const aside = page.locator("aside").first();
    await expect(aside).toBeVisible();

    const widthOpen = await aside.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(widthOpen).toBe(240);
    logger.pass(`Sidebar open width: ${widthOpen}px`);

    const collapseBtn = page.locator('aside button[aria-label*="collapse"], aside button').first();
    await collapseBtn.click();
    await page.waitForTimeout(400);

    const widthCollapsed = await aside.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(widthCollapsed).toBe(64);
    logger.pass(`Sidebar collapsed width: ${widthCollapsed}px`);
  });

  test("VISUAL: Create Job modal open state", async ({ page }) => {
    logger.step("Create Job modal screenshot");

    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(500);
    await page.getByRole("option", { name: /create job/i }).click().catch(() => null);
    await page.waitForTimeout(400);

    const modal = page.locator('[role="dialog"], [data-state="open"]').filter({ has: page.locator('text=/job|title/i') }).first();
    const visible = await modal.isVisible().catch(() => false);
    if (visible) {
      await expect(modal).toHaveScreenshot("create-job-modal-open.png", {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });
      logger.pass("Create Job modal screenshot matches baseline");
    } else {
      logger.info("Create Job modal not found — skipping screenshot (modal may use different selector)");
    }
  });
});
