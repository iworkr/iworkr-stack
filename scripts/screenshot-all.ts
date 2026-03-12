/**
 * Comprehensive Screenshot Script — Every Page, Both Industries
 * 
 * Takes full-page screenshots of every dashboard page, landing page,
 * onboarding step, settings page, and modal for both Trade and Care orgs.
 * 
 * Usage: npx playwright test scripts/screenshot-all.ts
 */

import { chromium, type Browser, type Page } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");

// ─── Page Definitions ──────────────────────────────────────────────

interface ScreenshotDef {
  name: string;
  path: string;
  /** If true, wait extra for animations */
  waitExtra?: number;
  /** Full page screenshot */
  fullPage?: boolean;
  /** Actions to perform before screenshot */
  actions?: (page: Page) => Promise<void>;
}

// Public/Landing pages (no auth needed)
const PUBLIC_PAGES: ScreenshotDef[] = [
  { name: "landing-hero", path: "/", fullPage: false, waitExtra: 2000 },
  { name: "landing-full", path: "/", fullPage: true, waitExtra: 3000 },
  { name: "ndis-landing-hero", path: "/ndis", fullPage: false, waitExtra: 2000 },
  { name: "ndis-landing-full", path: "/ndis", fullPage: true, waitExtra: 3000 },
  { name: "auth-page", path: "/auth", waitExtra: 1000 },
  { name: "auth-care-page", path: "/auth?sector=care", waitExtra: 1000 },
  { name: "signup-page", path: "/signup", waitExtra: 1000 },
  { name: "privacy-page", path: "/privacy", waitExtra: 500 },
  { name: "terms-page", path: "/terms", waitExtra: 500 },
  { name: "cookies-page", path: "/cookies", waitExtra: 500 },
  { name: "contact-page", path: "/contact", waitExtra: 500 },
  { name: "download-page", path: "/download", waitExtra: 1000 },
  { name: "checkout-page", path: "/checkout", waitExtra: 1000 },
  { name: "style-guide", path: "/style-guide", fullPage: true, waitExtra: 1000 },
];

// Dashboard pages (need auth)
const DASHBOARD_PAGES: ScreenshotDef[] = [
  // Main Dashboard
  { name: "dashboard", path: "/dashboard", waitExtra: 2000 },
  
  // Jobs
  { name: "jobs", path: "/dashboard/jobs", waitExtra: 1500 },
  
  // Schedule
  { name: "schedule", path: "/dashboard/schedule", waitExtra: 2000 },
  
  // Clients
  { name: "clients", path: "/dashboard/clients", waitExtra: 1500 },
  
  // Finance
  { name: "finance-overview", path: "/dashboard/finance", waitExtra: 1500 },
  
  // CRM / Pipeline
  { name: "crm-pipeline", path: "/dashboard/crm", waitExtra: 1500 },
  
  // Team
  { name: "team", path: "/dashboard/team", waitExtra: 1500 },
  
  // Team Credentials
  { name: "team-credentials", path: "/dashboard/team/credentials", waitExtra: 1500 },
  
  // Team Roles
  { name: "team-roles", path: "/dashboard/team/roles", waitExtra: 1000 },
  
  // Dispatch
  { name: "dispatch", path: "/dashboard/dispatch", waitExtra: 2000 },
  
  // Messages / Inbox
  { name: "inbox", path: "/dashboard/inbox", waitExtra: 1500 },
  { name: "messages", path: "/dashboard/messages", waitExtra: 1500 },
  
  // Assets
  { name: "assets", path: "/dashboard/assets", waitExtra: 1500 },
  
  // Forms
  { name: "forms", path: "/dashboard/forms", waitExtra: 1500 },
  
  // Automations
  { name: "automations", path: "/dashboard/automations", waitExtra: 1500 },
  
  // Integrations
  { name: "integrations", path: "/dashboard/integrations", waitExtra: 1500 },
  
  // AI Agent
  { name: "ai-agent", path: "/dashboard/ai-agent", waitExtra: 1500 },
  { name: "ai-agent-phone", path: "/dashboard/ai-agent/phone", waitExtra: 1500 },
  
  // Get App
  { name: "get-app", path: "/dashboard/get-app", waitExtra: 1000 },
  
  // Help
  { name: "help", path: "/dashboard/help", waitExtra: 1000 },
  
  // New Invoice
  { name: "finance-new-invoice", path: "/dashboard/finance/invoices/new", waitExtra: 1500 },
  
  // New Quote
  { name: "finance-new-quote", path: "/dashboard/finance/quotes/new", waitExtra: 1500 },
];

// Care-only pages
const CARE_ONLY_PAGES: ScreenshotDef[] = [
  { name: "care-medications", path: "/dashboard/care/medications", waitExtra: 1500 },
  { name: "care-incidents", path: "/dashboard/care/incidents", waitExtra: 1500 },
  { name: "care-observations", path: "/dashboard/care/observations", waitExtra: 1500 },
];

// Settings pages
const SETTINGS_PAGES: ScreenshotDef[] = [
  { name: "settings-main", path: "/settings", waitExtra: 1000 },
  { name: "settings-profile", path: "/settings/profile", waitExtra: 1000 },
  { name: "settings-workspace", path: "/settings/workspace", waitExtra: 1000 },
  { name: "settings-members", path: "/settings/members", waitExtra: 1000 },
  { name: "settings-billing", path: "/settings/billing", waitExtra: 1000 },
  { name: "settings-notifications", path: "/settings/notifications", waitExtra: 1000 },
  { name: "settings-security", path: "/settings/security", waitExtra: 1000 },
  { name: "settings-preferences", path: "/settings/preferences", waitExtra: 1000 },
  { name: "settings-labels", path: "/settings/labels", waitExtra: 1000 },
  { name: "settings-statuses", path: "/settings/statuses", waitExtra: 1000 },
  { name: "settings-templates", path: "/settings/templates", waitExtra: 1000 },
  { name: "settings-workflow", path: "/settings/workflow", waitExtra: 1000 },
  { name: "settings-integrations", path: "/settings/integrations", waitExtra: 1000 },
  { name: "settings-connected", path: "/settings/connected", waitExtra: 1000 },
  { name: "settings-communications", path: "/settings/communications", waitExtra: 1000 },
  { name: "settings-branches", path: "/settings/branches", waitExtra: 1000 },
  { name: "settings-developers", path: "/settings/developers", waitExtra: 1000 },
  { name: "settings-import", path: "/settings/import", waitExtra: 1000 },
];

// Onboarding steps
const ONBOARDING_PAGES: ScreenshotDef[] = [
  { name: "setup-page", path: "/setup", waitExtra: 2000 },
];

// ─── Screenshot Helper ─────────────────────────────────────────────

async function takeScreenshot(
  page: Page,
  def: ScreenshotDef,
  industry: "trades" | "care",
  subdir?: string,
) {
  const dir = path.join(SCREENSHOT_DIR, industry, subdir || "");
  fs.mkdirSync(dir, { recursive: true });
  
  const filePath = path.join(dir, `${def.name}.png`);
  
  try {
    await page.goto(`${BASE_URL}${def.path}`, { 
      waitUntil: "networkidle",
      timeout: 15000,
    });
  } catch {
    // networkidle can timeout on some pages, still take screenshot
    console.log(`  ⚠ Timeout loading ${def.path}, taking screenshot anyway...`);
  }
  
  // Wait for animations
  if (def.waitExtra) {
    await page.waitForTimeout(def.waitExtra);
  }
  
  // Execute any custom actions
  if (def.actions) {
    await def.actions(page);
    await page.waitForTimeout(500);
  }
  
  await page.screenshot({
    path: filePath,
    fullPage: def.fullPage ?? false,
  });
  
  console.log(`  ✓ ${industry}/${subdir ? subdir + "/" : ""}${def.name}.png`);
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("\n🎯 iWorkr Screenshot Suite — Starting...\n");
  
  const browser = await chromium.launch({ 
    headless: true,
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();
  
  // ─── 1. Public Pages (no auth needed) ────────────────────────────
  console.log("📸 PUBLIC PAGES (no auth)\n");
  
  for (const def of PUBLIC_PAGES) {
    // Public pages are industry-neutral, save to both dirs
    await takeScreenshot(page, def, "trades", "public");
  }
  
  // ─── 2. Try to authenticate ──────────────────────────────────────
  console.log("\n🔐 Attempting authentication...\n");
  
  // Navigate to auth page and try to sign in
  // We'll use the Supabase auth cookie approach
  // First, check if there's a session we can use
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  
  // Try to find email input and sign in
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log("  Found auth form, attempting login...");
    // We'll try to sign in - user may need to configure test credentials
    // For now, proceed without auth and capture what we can
  }
  
  // Check if we're already authenticated by trying to go to dashboard
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  const currentUrl = page.url();
  const isAuthenticated = currentUrl.includes("/dashboard") && !currentUrl.includes("/auth") && !currentUrl.includes("/setup");
  
  if (isAuthenticated) {
    console.log("  ✅ Authenticated! Taking dashboard screenshots...\n");
    
    // ─── 3. TRADES Dashboard Pages ─────────────────────────────────
    console.log("📸 TRADES DASHBOARD PAGES\n");
    
    // Ensure we're in trades mode - set industry via localStorage
    await page.evaluate(() => {
      // Access the auth store to check current org type
      const authStore = localStorage.getItem("iworkr-auth");
      if (authStore) {
        try {
          const parsed = JSON.parse(authStore);
          if (parsed?.state?.currentOrg) {
            console.log("Current org industry:", parsed.state.currentOrg.industry_type);
          }
        } catch {}
      }
    });
    
    for (const def of DASHBOARD_PAGES) {
      await takeScreenshot(page, def, "trades", "dashboard");
    }
    
    // Settings
    console.log("\n📸 TRADES SETTINGS PAGES\n");
    for (const def of SETTINGS_PAGES) {
      await takeScreenshot(page, def, "trades", "settings");
    }
    
    // ─── 4. Switch to CARE and take all dashboard screenshots ──────
    console.log("\n📸 CARE DASHBOARD PAGES\n");
    
    // Switch to care mode by modifying the persisted auth store
    await page.evaluate(() => {
      const authStore = localStorage.getItem("iworkr-auth");
      if (authStore) {
        try {
          const parsed = JSON.parse(authStore);
          if (parsed?.state?.currentOrg) {
            parsed.state.currentOrg.industry_type = "care";
            localStorage.setItem("iworkr-auth", JSON.stringify(parsed));
          }
        } catch {}
      }
    });
    
    // Reload to pick up the change
    await page.reload({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    
    for (const def of DASHBOARD_PAGES) {
      await takeScreenshot(page, def, "care", "dashboard");
    }
    
    // Care-only pages
    console.log("\n📸 CARE-ONLY PAGES\n");
    for (const def of CARE_ONLY_PAGES) {
      await takeScreenshot(page, def, "care", "dashboard");
    }
    
    // Care Settings
    console.log("\n📸 CARE SETTINGS PAGES\n");
    for (const def of SETTINGS_PAGES) {
      await takeScreenshot(page, def, "care", "settings");
    }
    
    // ─── 5. Switch back to trades ──────────────────────────────────
    await page.evaluate(() => {
      const authStore = localStorage.getItem("iworkr-auth");
      if (authStore) {
        try {
          const parsed = JSON.parse(authStore);
          if (parsed?.state?.currentOrg) {
            parsed.state.currentOrg.industry_type = "trades";
            localStorage.setItem("iworkr-auth", JSON.stringify(parsed));
          }
        } catch {}
      }
    });
    
  } else {
    console.log("  ⚠ Not authenticated — capturing unauthenticated views...\n");
    
    // Still capture what we can see (redirected pages, setup, etc.)
    console.log("📸 UNAUTHENTICATED DASHBOARD VIEWS\n");
    for (const def of DASHBOARD_PAGES) {
      await takeScreenshot(page, def, "trades", "dashboard");
    }
  }
  
  // ─── 6. Onboarding Pages ────────────────────────────────────────
  console.log("\n📸 ONBOARDING PAGES\n");
  for (const def of ONBOARDING_PAGES) {
    await takeScreenshot(page, def, "trades", "onboarding");
  }
  
  await browser.close();
  
  // Count screenshots
  let total = 0;
  function countFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
      else if (entry.name.endsWith(".png")) total++;
    }
  }
  countFiles(SCREENSHOT_DIR);
  
  console.log(`\n✅ Done! ${total} screenshots saved to /screenshots/\n`);
}

main().catch(console.error);
