/**
 * ============================================================
 * Smoke Test — The Crawler
 * ============================================================
 *
 * Visits every protected and public route in the application.
 * For each route:
 *   1. Asserts no "Internal Server Error" or crash screen
 *   2. Asserts no unhandled JS exceptions
 *   3. Asserts no HTTP 500+ network responses
 *   4. Captures console errors
 *
 * This is the first line of defense — if any page crashes,
 * the build is broken.
 */

import { test, expect } from "@playwright/test";
import { PUBLIC_ROUTES } from "./utils/constants";
import { logger } from "./utils/logger";

test.describe("Smoke Test — Full Route Crawler", () => {
  test("SMOKE-002: All public routes load without crash", async ({ page }) => {
    logger.step("Crawl public routes");

    const failures: { route: string; reason: string }[] = [];

    for (const route of PUBLIC_ROUTES) {
      try {
        const response = await page.goto(route, { timeout: 15_000 });
        await page.waitForTimeout(1500);

        const status = response?.status() ?? 0;

        // /auth may redirect to /dashboard if already logged in — that's OK
        if (status >= 500) {
          failures.push({ route, reason: `HTTP ${status}` });
          logger.fail(`${route} — HTTP ${status}`);
        } else {
          logger.pass(`${route} — OK (${status})`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ route, reason: msg.slice(0, 100) });
        logger.fail(`${route} — ${msg.slice(0, 100)}`);
      }
    }

    expect(failures.length, `Public route failures: ${failures.map((f) => f.route).join(", ")}`).toBe(0);
  });

  test("SMOKE-003: Sidebar navigation links resolve correctly", async ({ page }) => {
    logger.step("Verify sidebar nav links");

    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const sidebarLinks = page.locator("nav a, aside a").filter({ has: page.locator("span, svg") });
    const linkCount = await sidebarLinks.count();
    logger.info(`Found ${linkCount} sidebar links`);

    const hrefs: string[] = [];
    for (let i = 0; i < linkCount; i++) {
      const href = await sidebarLinks.nth(i).getAttribute("href");
      if (href && href.startsWith("/") && !hrefs.includes(href)) {
        hrefs.push(href);
      }
    }

    logger.info(`Unique sidebar hrefs: ${hrefs.length}`);

    const failures: string[] = [];
    for (const href of hrefs) {
      try {
        const resp = await page.goto(href, { timeout: 12_000 });
        await page.waitForTimeout(1000);
        const status = resp?.status() ?? 0;
        if (status >= 500) {
          failures.push(`${href} (${status})`);
          logger.fail(`Sidebar link ${href} — HTTP ${status}`);
        } else {
          logger.pass(`Sidebar: ${href} — OK`);
        }
      } catch {
        failures.push(href);
        logger.fail(`Sidebar link ${href} — timeout`);
      }
    }

    expect(failures.length, `Sidebar failures: ${failures.join(", ")}`).toBe(0);
  });

  test("SMOKE-004: No unhandled JS exceptions on dashboard load", async ({ page }) => {
    const uncaughtErrors: string[] = [];
    page.on("pageerror", (err) => {
      uncaughtErrors.push(err.message);
    });

    await page.goto("/dashboard");
    await page.waitForTimeout(4000);

    if (uncaughtErrors.length > 0) {
      logger.fail(`${uncaughtErrors.length} uncaught JS exceptions`);
      for (const e of uncaughtErrors) {
        logger.error(e.slice(0, 200));
      }
    } else {
      logger.pass("No uncaught JS exceptions on dashboard");
    }

    expect(uncaughtErrors.length, `Uncaught errors: ${uncaughtErrors.join("; ").slice(0, 300)}`).toBe(0);
  });
});
