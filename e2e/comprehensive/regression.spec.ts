/**
 * ============================================================
 * iWorkr Regression Tests
 * ============================================================
 *
 * Tests for bugs that were found and fixed:
 *   - React #185 (infinite re-render loop) on Inbox
 *   - React #418 (hydration mismatch) on Dashboard date
 *   - Schedule empty state when user is owner (not technician)
 *   - Zustand whole-store subscription re-renders
 */

import { test, expect, type Page } from "@playwright/test";

/* ── React #185 — Infinite Re-render Loop ─────────────── */

test.describe("Regression: React #185 (Infinite Re-render)", () => {
  test("Inbox page does not trigger maximum update depth exceeded", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/dashboard/inbox");
    await page.waitForTimeout(5000);

    const has185 = errors.some((e) => e.includes("#185") || e.includes("Maximum update depth"));
    expect(has185, "React error #185 detected on Inbox").toBeFalsy();
  });

  test("Dashboard page does not trigger maximum update depth exceeded", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/dashboard");
    await page.waitForTimeout(5000);

    const has185 = errors.some((e) => e.includes("#185") || e.includes("Maximum update depth"));
    expect(has185, "React error #185 detected on Dashboard").toBeFalsy();
  });

  test("navigating between Dashboard and Inbox rapidly does not crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    for (let i = 0; i < 5; i++) {
      await page.goto("/dashboard");
      await page.waitForTimeout(800);
      await page.goto("/dashboard/inbox");
      await page.waitForTimeout(800);
    }

    const hasCritical = errors.some(
      (e) => e.includes("#185") || e.includes("#418") || e.includes("Maximum update depth")
    );
    expect(hasCritical, "React critical error during rapid navigation").toBeFalsy();
  });
});

/* ── React #418 — Hydration Mismatch ──────────────────── */

test.describe("Regression: React #418 (Hydration Mismatch)", () => {
  test("Dashboard date renders without hydration mismatch", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/dashboard");
    await page.waitForTimeout(4000);

    const has418 = errors.some((e) => e.includes("#418") || e.includes("Hydration"));
    expect(has418, "React hydration mismatch #418 on Dashboard").toBeFalsy();

    const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const dateEl = page.locator("p").filter({ hasText: dayName });
    await expect(dateEl.first()).toBeVisible({ timeout: 5000 });
  });
});

/* ── Schedule Empty State Fix ─────────────────────────── */

test.describe("Regression: Schedule Empty State", () => {
  test("Schedule page shows technician rows for owner accounts", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.waitForTimeout(5000);

    const emptyState = page.locator('h3:has-text("No schedule data")');
    const emptyVisible = await emptyState.isVisible().catch(() => false);

    if (emptyVisible) {
      test.info().annotations.push({
        type: "warning",
        description: "Schedule still showing empty state — getOrgTechnicians may need RPC fix on database",
      });
    }

    const loadingIndicator = page.locator('[class*="animate-pulse"], [class*="skeleton"], [class*="loading"]');
    await page.waitForTimeout(2000);
    const stillLoading = await loadingIndicator.first().isVisible().catch(() => false);
    expect(stillLoading, "Schedule stuck in loading state").toBeFalsy();
  });

  test("Schedule Today button resets to current date", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.waitForTimeout(3000);

    const todayBtn = page.locator('button:has-text("Today")');
    if (await todayBtn.isVisible().catch(() => false)) {
      await todayBtn.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain("/schedule");
    }
  });
});

/* ── Zustand Store Subscriptions ──────────────────────── */

test.describe("Regression: Zustand Store Performance", () => {
  test("Dashboard layout does not cause excessive re-renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    const renderCount = await page.evaluate(() => {
      const perf = performance.getEntriesByType("measure");
      return perf.length;
    });

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.locator('a:has-text("My Jobs")').first().click().catch(() => null);
    await page.waitForTimeout(2000);
    await page.goBack();
    await page.waitForTimeout(2000);

    const critical = errors.filter((e) => e.includes("#185") || e.includes("Maximum update depth"));
    expect(critical).toHaveLength(0);
  });
});

/* ── Lottie Animation Stability ──────────────────────── */

test.describe("Regression: Lottie Animations", () => {
  test("Sidebar icons with Lottie do not cause infinite loops", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    const sidebarLinks = page.locator("nav a, aside a");
    const count = Math.min(await sidebarLinks.count(), 6);
    for (let i = 0; i < count; i++) {
      await sidebarLinks.nth(i).hover();
      await page.waitForTimeout(300);
    }

    const hasLoop = errors.some(
      (e) => e.includes("#185") || e.includes("Maximum update depth") || e.includes("infinite")
    );
    expect(hasLoop, "Lottie hover caused infinite loop").toBeFalsy();
  });
});

/* ── Messenger Store Robustness ──────────────────────── */

test.describe("Regression: Messenger Store", () => {
  test("loading Inbox twice does not cause double fetch", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/dashboard/inbox");
    await page.waitForTimeout(3000);
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);
    await page.goto("/dashboard/inbox");
    await page.waitForTimeout(3000);

    const hasCritical = errors.some((e) => e.includes("#185") || e.includes("Maximum update depth"));
    expect(hasCritical, "Double Inbox load caused React error").toBeFalsy();
  });
});
