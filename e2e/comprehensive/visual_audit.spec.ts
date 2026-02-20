/**
 * Project Panopticon — Obsidian Visual Audit
 * Top 10 screens: snapshot with < 1% pixel diff from golden baseline.
 */

import { test, expect } from "@playwright/test";

const TOP_SCREENS = [
  { name: "dashboard", url: "/dashboard" },
  { name: "jobs", url: "/dashboard/jobs" },
  { name: "schedule", url: "/dashboard/schedule" },
  { name: "clients", url: "/dashboard/clients" },
  { name: "finance", url: "/dashboard/finance" },
  { name: "assets", url: "/dashboard/assets" },
  { name: "forms", url: "/dashboard/forms" },
  { name: "inbox", url: "/dashboard/inbox" },
  { name: "settings", url: "/settings" },
  { name: "team", url: "/dashboard/team" },
];

test.describe("Visual Audit — Obsidian Standard", () => {
  for (const { name, url } of TOP_SCREENS) {
    test(`VISUAL-AUDIT: ${name} — pixelmatch < 1%`, async ({ page }) => {
      await page.goto(url);
      await page.waitForTimeout(3000);

      await expect(page).toHaveScreenshot(`panopticon-${name}.png`, {
        maxDiffPixelRatio: 0.01,
        animations: "disabled",
        fullPage: false,
      });
    });
  }

  test("VISUAL-AUDIT: Background is #050505 (Obsidian)", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(5,\s*5,\s*5\)|#050505/);
  });

  test("VISUAL-AUDIT: Typography — Inter or JetBrains Mono", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font.toLowerCase()).toMatch(/inter|jetbrains/);
  });
});
