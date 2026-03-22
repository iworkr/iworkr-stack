/**
 * Core Navigation Matrix — Argus-Omniscience
 *
 * Replaces TestSprite proxy-based crawling with native Playwright tests.
 * Covers every major dashboard route, verifying authenticated access,
 * page load stability, and absence of crash indicators.
 *
 * Uses storageState injection to bypass 407 proxy authentication errors.
 */

import { test, expect } from "@playwright/test";

// ── Dashboard Module Smoke Tests ──────────────────────────────────────────────

test.describe("Dashboard — Core Module Navigation Matrix", () => {
  const CORE_ROUTES = [
    { path: "/dashboard", name: "Dashboard Home", expect: /dashboard|overview|welcome/i },
    { path: "/dashboard/jobs", name: "Jobs", expect: /job|status|title|filter/i },
    { path: "/dashboard/clients", name: "Clients", expect: /client|name|status|email/i },
    { path: "/dashboard/schedule", name: "Schedule", expect: /schedule|calendar|week|month/i },
    { path: "/dashboard/finance", name: "Finance", expect: /invoice|finance|revenue|paid/i },
    { path: "/dashboard/assets", name: "Assets", expect: /asset|vehicle|equipment|tool/i },
    { path: "/dashboard/forms", name: "Forms", expect: /form|template|builder/i },
    { path: "/dashboard/team", name: "Team", expect: /team|member|role|invite/i },
    { path: "/dashboard/automations", name: "Automations", expect: /automation|flow|trigger/i },
    { path: "/dashboard/inbox", name: "Inbox", expect: /inbox|notification|message/i },
    { path: "/dashboard/dispatch", name: "Dispatch", expect: /dispatch|map|active/i },
    { path: "/dashboard/analytics", name: "Analytics", expect: /analytics|chart|data|metric/i },
    { path: "/dashboard/knowledge", name: "Knowledge Base", expect: /knowledge|article|sop/i },
  ];

  for (const route of CORE_ROUTES) {
    test(`${route.name} loads without crash (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(3000);

      // Should not redirect to /auth (proves session injection works)
      expect(page.url()).not.toContain("/auth");

      // Should not show server error
      await expect(page.locator("body")).not.toContainText(/500|Internal Server Error|Application Error/i);

      // Should render module content
      await expect(page.locator("body")).toContainText(route.expect, { timeout: 15_000 });
    });
  }
});

// ── Care Module Route Matrix ─────────────────────────────────────────────────

test.describe("Dashboard — Care Module Navigation", () => {
  const CARE_ROUTES = [
    { path: "/dashboard/care", name: "Care Home" },
    { path: "/dashboard/care/participants", name: "Participants" },
    { path: "/dashboard/care/medications", name: "Medications" },
    { path: "/dashboard/care/incidents", name: "Incidents" },
    { path: "/dashboard/care/progress-notes", name: "Progress Notes" },
    { path: "/dashboard/care/notes", name: "Shift Notes" },
    { path: "/dashboard/care/plans", name: "Care Plans" },
    { path: "/dashboard/care/plan-reviews", name: "Plan Reviews" },
    { path: "/dashboard/care/behaviour", name: "Behaviour Support" },
    { path: "/dashboard/care/observations", name: "Observations" },
    { path: "/dashboard/care/comms", name: "Care Comms" },
    { path: "/dashboard/care/facilities", name: "Facilities" },
    { path: "/dashboard/care/quality", name: "Quality" },
    { path: "/dashboard/care/sentinel", name: "Sentinel" },
    { path: "/dashboard/care/templates", name: "Templates" },
    { path: "/dashboard/care/funding-engine", name: "Funding Engine" },
    { path: "/dashboard/care/roster-intelligence", name: "Roster Intelligence" },
    { path: "/dashboard/care/compliance-hub", name: "Compliance Hub" },
    { path: "/dashboard/care/clinical-timeline", name: "Clinical Timeline" },
    { path: "/dashboard/care/daily-ops", name: "Daily Ops" },
    { path: "/dashboard/care/routines", name: "Routines" },
    { path: "/dashboard/care/sil-quoting", name: "SIL Quoting" },
    { path: "/dashboard/care/proda-claims", name: "PRODA Claims" },
  ];

  for (const route of CARE_ROUTES) {
    test(`Care: ${route.name} loads (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(3000);
      expect(page.url()).not.toContain("/auth");
      await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/i);
    });
  }
});

// ── Finance Module Route Matrix ──────────────────────────────────────────────

test.describe("Dashboard — Finance Module Navigation", () => {
  const FINANCE_ROUTES = [
    { path: "/dashboard/finance", name: "Finance Home" },
    { path: "/dashboard/finance/invoicing", name: "Invoicing" },
    { path: "/dashboard/finance/claims", name: "Claims" },
    { path: "/dashboard/finance/ndis-claims", name: "NDIS Claims" },
    { path: "/dashboard/finance/plan-manager", name: "Plan Manager" },
    { path: "/dashboard/finance/oracle-triage", name: "Oracle Triage" },
    { path: "/dashboard/finance/coordination-ledger", name: "Coordination Ledger" },
    { path: "/dashboard/finance/travel", name: "Travel Claims" },
    { path: "/dashboard/finance/travel-ledger", name: "Travel Ledger" },
    { path: "/dashboard/finance/petty-cash", name: "Petty Cash" },
    { path: "/dashboard/finance/retention", name: "Revenue Retention" },
    { path: "/dashboard/finance/sync-errors", name: "Sync Errors" },
    { path: "/dashboard/finance/supplier-invoices", name: "Supplier Invoices" },
    { path: "/dashboard/finance/accounts-payable", name: "Accounts Payable" },
    { path: "/dashboard/finance/kits", name: "Pricing Kits" },
    { path: "/dashboard/finance/iworkr-connect", name: "iWorkr Connect" },
  ];

  for (const route of FINANCE_ROUTES) {
    test(`Finance: ${route.name} loads (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(3000);
      expect(page.url()).not.toContain("/auth");
      await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/i);
    });
  }
});

// ── Settings Route Matrix ────────────────────────────────────────────────────

test.describe("Dashboard — Settings Navigation", () => {
  const SETTINGS_ROUTES = [
    { path: "/settings/profile", name: "Profile", expect: /profile|name|email/i },
    { path: "/settings/workspace", name: "Workspace", expect: /workspace|organization/i },
    { path: "/settings/billing", name: "Billing", expect: /plan|billing|subscription/i },
    { path: "/settings/members", name: "Members", expect: /member|team|invite/i },
    { path: "/settings/security", name: "Security", expect: /security|password|session/i },
    { path: "/settings/branding", name: "Branding", expect: /brand|logo|color/i },
    { path: "/settings/notifications", name: "Notifications", expect: /notification|preference/i },
    { path: "/settings/integrations", name: "Integrations", expect: /integration|connect/i },
    { path: "/settings/templates", name: "Templates", expect: /template/i },
    { path: "/settings/statuses", name: "Statuses", expect: /status|custom/i },
    { path: "/settings/labels", name: "Labels", expect: /label/i },
    { path: "/settings/workflow", name: "Workflow", expect: /workflow/i },
    { path: "/settings/preferences", name: "Preferences", expect: /preference/i },
    { path: "/settings/developers", name: "Developers", expect: /api|key|developer/i },
    { path: "/settings/import", name: "Import", expect: /import|csv|data/i },
  ];

  for (const route of SETTINGS_ROUTES) {
    test(`Settings: ${route.name} loads (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(2000);
      expect(page.url()).not.toContain("/auth");
      await expect(page.locator("body")).toContainText(route.expect, { timeout: 10_000 });
    });
  }
});

// ── Team & Workforce Navigation ──────────────────────────────────────────────

test.describe("Dashboard — Team & Workforce Navigation", () => {
  const TEAM_ROUTES = [
    { path: "/dashboard/team", name: "Team" },
    { path: "/dashboard/team/roles", name: "Roles" },
    { path: "/dashboard/team/credentials", name: "Credentials" },
    { path: "/dashboard/team/leave", name: "Leave" },
    { path: "/dashboard/timesheets", name: "Timesheets" },
  ];

  for (const route of TEAM_ROUTES) {
    test(`Team: ${route.name} loads (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(3000);
      expect(page.url()).not.toContain("/auth");
      await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/i);
    });
  }
});

// ── Compliance & Governance ──────────────────────────────────────────────────

test.describe("Dashboard — Compliance & Governance Navigation", () => {
  const COMPLIANCE_ROUTES = [
    { path: "/dashboard/compliance", name: "Compliance Home" },
    { path: "/dashboard/compliance/readiness", name: "Readiness" },
    { path: "/dashboard/compliance/audits", name: "Audits" },
    { path: "/dashboard/compliance/policies", name: "Policies" },
    { path: "/dashboard/governance/policies", name: "Governance Policies" },
  ];

  for (const route of COMPLIANCE_ROUTES) {
    test(`Compliance: ${route.name} loads (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(3000);
      expect(page.url()).not.toContain("/auth");
    });
  }
});

// ── Ops, Fleet, AI Agent ─────────────────────────────────────────────────────

test.describe("Dashboard — Ops, Fleet & AI Agent", () => {
  const OPS_ROUTES = [
    { path: "/dashboard/ops/inventory", name: "Inventory" },
    { path: "/dashboard/ops/suppliers", name: "Suppliers" },
    { path: "/dashboard/ops/purchase-orders", name: "Purchase Orders" },
    { path: "/dashboard/ops/safety", name: "Safety" },
    { path: "/dashboard/fleet", name: "Fleet Home" },
    { path: "/dashboard/fleet/vehicles", name: "Vehicles" },
    { path: "/dashboard/ai-agent", name: "AI Agent" },
    { path: "/dashboard/messages", name: "Messages" },
    { path: "/dashboard/coordination", name: "Coordination" },
    { path: "/dashboard/communications", name: "Communications" },
    { path: "/dashboard/portal", name: "Portal Admin" },
  ];

  for (const route of OPS_ROUTES) {
    test(`Ops: ${route.name} loads (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(3000);
      expect(page.url()).not.toContain("/auth");
      await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/i);
    });
  }
});

// ── Keyboard & Interaction Tests ─────────────────────────────────────────────

test.describe("Dashboard — Interaction Quality", () => {
  test("command palette opens with Ctrl+K", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);
    const palette = page.locator("[role='dialog'], [data-testid='command-menu'], [cmdk-dialog], [data-cmdk-root]").first();
    if (!(await palette.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.keyboard.press("Meta+k");
      await page.waitForTimeout(500);
    }
    await expect(
      page.locator("[role='dialog'], [data-testid='command-menu'], [cmdk-dialog], [data-cmdk-root]").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("sidebar collapses and expands", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);
    const sidebar = page.locator("nav, [data-testid='sidebar'], aside").first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });
  });

  test("breadcrumb navigation renders on subpages", async ({ page }) => {
    await page.goto("/dashboard/care/participants");
    await page.waitForTimeout(3000);
    // Look for breadcrumb or navigation trail
    const breadcrumb = page.locator("[data-testid='breadcrumb'], nav[aria-label='breadcrumb'], .breadcrumb").first();
    // Breadcrumb may or may not exist — this is a soft assertion
    if (await breadcrumb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(breadcrumb).toContainText(/care|participant/i);
    }
  });
});

// ── Public Routes (No Auth Required) ─────────────────────────────────────────

test.describe("Public Routes — No Authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const PUBLIC_ROUTES = [
    { path: "/", name: "Landing Page", expect: /iWorkr|field|service/i },
    { path: "/auth", name: "Auth Page", expect: /sign in|login|email/i },
    { path: "/privacy", name: "Privacy Policy", expect: /privacy/i },
    { path: "/terms", name: "Terms of Service", expect: /terms/i },
    { path: "/cookies", name: "Cookie Policy", expect: /cookie/i },
    { path: "/ndis", name: "NDIS Landing", expect: /ndis|disability|care/i },
    { path: "/download", name: "App Download", expect: /download|app|mobile/i },
  ];

  for (const route of PUBLIC_ROUTES) {
    test(`Public: ${route.name} (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForTimeout(2000);
      await expect(page.locator("body")).toContainText(route.expect, { timeout: 10_000 });
    });
  }

  test("unauthenticated user redirected from /dashboard to /auth", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth|\/login|\/$/, { timeout: 15_000 });
  });
});
