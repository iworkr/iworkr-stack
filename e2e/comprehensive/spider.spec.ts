/**
 * Project Panopticon — Link Spider
 * Scrapes ALL <a> tags from dashboard, visits every link, asserts 200 OK, no 404, no console errors.
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const BAD_SIGNATURES = ["404", "Page Not Found", "This page could not be found", "Server Error", "500", "Internal Server Error"];

test.describe("Link Spider — Navigation & 404s", () => {
  test.setTimeout(120_000);

  test("SPIDER-001: Scrape all links from dashboard and verify each returns 200", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") consoleErrors.push(text);
    });

    await page.goto(`${BASE}/dashboard`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(3000);

    const hrefs = await page.evaluate((base) => {
      const links = document.querySelectorAll<HTMLAnchorElement>("a[href]");
      const out = new Set<string>();
      const baseUrl = new URL(base);
      for (const a of links) {
        const href = (a.getAttribute("href") ?? "").trim();
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
        try {
          const url = new URL(href, base);
          if (url.origin !== baseUrl.origin) continue;
          const path = url.pathname + url.search;
          if (path === "/" || path.startsWith("/auth") || path.startsWith("http")) continue;
          out.add(path);
        } catch {
          if (href.startsWith("/")) out.add(href.split("?")[0]);
        }
      }
      return Array.from(out);
    }, BASE);

    const visited = new Set<string>();
    const failures: { url: string; reason: string }[] = [];

    for (const path of hrefs) {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      const url = `${BASE}${normalized}`;
      if (visited.has(url)) continue;
      visited.add(url);

      consoleErrors.length = 0;
      const response = await page.goto(url, { timeout: 15_000 }).catch(() => null);
      await page.waitForTimeout(800);

      const status = response?.status() ?? 0;
      if (status >= 400) {
        failures.push({ url, reason: `HTTP ${status}` });
        continue;
      }

      const body = await page.locator("body").textContent().catch(() => "") ?? "";
      for (const sig of BAD_SIGNATURES) {
        if (body.includes(sig)) {
          failures.push({ url, reason: `Page contains "${sig}"` });
          break;
        }
      }

      if (consoleErrors.length > 0) {
        failures.push({ url, reason: `Console errors: ${consoleErrors[0].slice(0, 80)}` });
      }
    }

    if (failures.length > 0) {
      console.log("Spider failures:", JSON.stringify(failures, null, 2));
    }
    expect(failures, `Spider found ${failures.length} bad link(s): ${failures.map((f) => f.url).join(", ")}`).toHaveLength(0);
  });
});
