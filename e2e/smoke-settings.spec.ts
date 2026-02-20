/**
 * Smoke Test — Settings Routes
 * Crawls all settings protected routes with a longer timeout to avoid cascading failures.
 */

import { test, expect } from "@playwright/test";
import { PROTECTED_ROUTES_SETTINGS } from "./utils/constants";
import { logger } from "./utils/logger";

const CRASH_SIGNATURES = [
  "Internal Server Error",
  "Application error",
  "This page could not be found",
  "Unhandled Runtime Error",
  "Error: ",
];

test.describe("Smoke Test — Settings Routes", () => {
  test("SMOKE-001-SETTINGS: All settings routes load without crash", async ({ page }) => {
    test.setTimeout(120_000);

    logger.step("Begin crawling settings protected routes");

    const failures: { route: string; reason: string }[] = [];

    for (const route of PROTECTED_ROUTES_SETTINGS) {
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
        await page.waitForTimeout(1500);

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

    logger.info(`Crawled ${PROTECTED_ROUTES_SETTINGS.length} settings routes. Failures: ${failures.length}`);

    if (failures.length > 0) {
      console.log("\n--- SETTINGS ROUTE FAILURES ---");
      for (const f of failures) {
        console.log(`  ${f.route}: ${f.reason}`);
      }
      console.log("--------------------------------\n");
    }

    expect(
      failures.length,
      `${failures.length} route(s) failed: ${failures.map((f) => f.route).join(", ")}`
    ).toBe(0);
  });
});
