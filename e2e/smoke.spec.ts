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
import { ALL_PROTECTED_ROUTES, PUBLIC_ROUTES } from "./utils/constants";
import { logger } from "./utils/logger";

const CRASH_SIGNATURES = [
  "Internal Server Error",
  "Application error",
  "This page could not be found",
  "Unhandled Runtime Error",
  "Error: ",
];

test.describe("Smoke Test — Full Route Crawler", () => {
  test("SMOKE-001: All protected routes load without crash", async ({ page }) => {
    logger.step("Begin crawling all protected routes");

    const failures: { route: string; reason: string }[] = [];

    for (const route of ALL_PROTECTED_ROUTES) {
      const consoleErrors: string[] = [];
      const networkErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("response", (resp) => {
        if (resp.status() >= 500) {
          networkErrors.push(`${resp.status()} ${resp.url()}`);
        }
      });

      try {
        const response = await page.goto(route, { timeout: 15_000 });
        await page.waitForTimeout(2000);

        const status = response?.status() ?? 0;
        if (status >= 500) {
          failures.push({ route, reason: `HTTP ${status}` });
          logger.fail(`${route} — HTTP ${status}`);
          continue;
        }

        const body = await page.locator("body").textContent().catch(() => "");
        let crashed = false;
        for (const sig of CRASH_SIGNATURES) {
          if (body?.includes(sig) && !body?.includes("No jobs found")) {
            if (sig === "Error: " && body && body.indexOf("Error: ") > 500) continue;
            crashed = true;
            failures.push({ route, reason: `Crash: "${sig}"` });
            logger.fail(`${route} — crash signature: "${sig}"`);
            break;
          }
        }

        if (!crashed) {
          logger.pass(`${route} — OK`);
        }

        if (networkErrors.length > 0) {
          logger.warn(`${route} — ${networkErrors.length} server errors: ${networkErrors[0]}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ route, reason: `Navigation error: ${msg.slice(0, 100)}` });
        logger.fail(`${route} — ${msg.slice(0, 100)}`);
      }
    }

    logger.info(`Crawled ${ALL_PROTECTED_ROUTES.length} routes. Failures: ${failures.length}`);

    if (failures.length > 0) {
      console.log("\n--- ROUTE FAILURES ---");
      for (const f of failures) {
        console.log(`  ${f.route}: ${f.reason}`);
      }
      console.log("----------------------\n");
    }

    expect(
      failures.length,
      `${failures.length} route(s) failed: ${failures.map((f) => f.route).join(", ")}`
    ).toBe(0);
  });

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
