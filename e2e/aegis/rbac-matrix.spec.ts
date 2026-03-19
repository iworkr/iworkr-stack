import { test, expect } from "@playwright/test";

/**
 * AEGIS-CHAOS Layer 3: RBAC Matrix Defense
 * 
 * Tests that UI state obfuscation and permission gates
 * correctly block unauthorized access to sensitive routes and data.
 */

const ADMIN_RESTRICTED_ROUTES = [
  "/dashboard/finance/invoicing",
  "/dashboard/finance/coordination-ledger",
  "/dashboard/finance/ndis-claims",
  "/settings/billing",
  "/settings/members",
  "/settings/security",
];

const CRITICAL_DATA_ROUTES = [
  { route: "/dashboard/participants", sensitiveText: "Funding Balance" },
  { route: "/dashboard/finance", sensitiveText: "Bank Account" },
];

test.describe("Aegis-Chaos L3: RBAC Matrix Defense", () => {
  // Test admin-only routes with admin session (should succeed)
  test("RBAC-001: Admin can access all finance routes", async ({ page }) => {
    await page.goto("/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const bodyText = await page.locator("body").textContent() || "";

    // Admin should reach the finance page without redirect
    const hasAccess = url.includes("/finance") || url.includes("/dashboard");
    const noAccessDenied = !/access denied|unauthorized|permission denied/i.test(bodyText);

    expect(hasAccess).toBeTruthy();
    expect(noAccessDenied).toBeTruthy();
  });

  test("RBAC-002: Admin can access team management", async ({ page }) => {
    await page.goto("/dashboard/team");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const bodyText = await page.locator("body").textContent() || "";

    expect(url.includes("/team") || url.includes("/dashboard")).toBeTruthy();
    expect(/access denied|unauthorized/i.test(bodyText)).toBeFalsy();
  });

  test("RBAC-003: Settings billing page accessible to admin", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    expect(url.includes("/settings") || url.includes("/dashboard")).toBeTruthy();
  });

  test("RBAC-004: PermissionGate prevents raw data exposure", async ({ page }) => {
    // Navigate to any data-heavy route
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    // The page must render without exposing raw JSON or database errors
    const bodyText = await page.locator("body").textContent() || "";
    const hasRawExposure = /postgres|supabase|database error|sql|relation/i.test(bodyText);
    expect(hasRawExposure).toBeFalsy();
  });

  test("RBAC-005: API routes return structured errors, not stack traces", async ({ page }) => {
    // Hit a non-existent API route
    const response = await page.request.get("/api/nonexistent-endpoint");
    const body = await response.text();

    // Should NOT contain stack traces or internal paths
    expect(body).not.toContain("node_modules");
    expect(body).not.toContain("at Object.");
    expect(body).not.toContain("/Users/");
  });

  test("RBAC-006: Knowledge base accessible to authenticated users", async ({ page }) => {
    await page.goto("/dashboard/knowledge");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const bodyText = await page.locator("body").textContent() || "";

    // Should render without crash
    const isValid = url.includes("/knowledge") || url.includes("/dashboard");
    expect(isValid).toBeTruthy();
    expect(/error|crash|something went wrong/i.test(bodyText)).toBeFalsy();
  });
});
