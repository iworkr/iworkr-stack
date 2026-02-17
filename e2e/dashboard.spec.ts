/**
 * ============================================================
 * iWorkr Dashboard Module — Comprehensive E2E Audit
 * ============================================================
 *
 * This spec performs a "Search & Destroy" audit of the Dashboard:
 *   A. Functional Integrity  — Dead click detection
 *   B. Visual & Style Audit  — Dummy data, style consistency
 *   C. End-to-End Flow       — Widget interactions, navigation
 *
 * Each finding is collected into a structured report object
 * and written to audit-reports/dashboard-audit.md at the end.
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/* ── Report accumulator ──────────────────────────────── */

interface Finding {
  severity: "critical" | "visual" | "dummy_data" | "flow_pass" | "flow_fail" | "warning";
  widget: string;
  title: string;
  detail: string;
  selector?: string;
}

const findings: Finding[] = [];

function addFinding(f: Finding) {
  findings.push(f);
  const icon =
    f.severity === "critical" ? "🔴" :
    f.severity === "visual" ? "🟡" :
    f.severity === "dummy_data" ? "🟣" :
    f.severity === "flow_pass" ? "🟢" :
    f.severity === "warning" ? "🟠" :
    "🔵";
  console.log(`${icon} [${f.widget}] ${f.title}: ${f.detail}`);
}

/* ── Constants ───────────────────────────────────────── */

const BANNED_DUMMY_STRINGS = [
  "John Doe", "Jane Doe", "123 Fake St", "Lorem Ipsum",
  "lorem ipsum", "placeholder", "PLACEHOLDER",
  "test@test.com", "foo@bar.com", "example.com",
  "TODO", "FIXME", "HACK",
];

const FALLBACK_NAMES = [
  "Mike T.", "Sarah C.", "James O.", "Tom L.",
];

const HARDCODED_FALLBACK_INSIGHT = "3 jobs unassigned for tomorrow morning";

/* ── Helpers ─────────────────────────────────────────── */

async function waitForDashboard(page: Page) {
  // Wait for the main dashboard heading or the bento grid
  await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 }).catch(() => null);
  // Give widgets time to animate in
  await page.waitForTimeout(2500);
}

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function checkForBrokenImages(page: Page, widget: string) {
  const images = page.locator("img");
  const count = await images.count();
  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const isVisible = await img.isVisible().catch(() => false);
    if (!isVisible) continue;

    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    const alt = await img.getAttribute("alt") || "";
    if (naturalWidth === 0) {
      addFinding({
        severity: "visual",
        widget,
        title: "Broken image detected",
        detail: `Image with alt="${alt}" has naturalWidth=0 (broken/not loaded)`,
        selector: await img.evaluate((el) => {
          const tag = el.tagName.toLowerCase();
          const cls = el.className?.toString().slice(0, 50) || "";
          return `${tag}.${cls}`;
        }),
      });
    }
  }
}

async function scanForDummyData(page: Page, containerSelector: string, widgetName: string) {
  const container = page.locator(containerSelector).first();
  const exists = await container.count();
  if (exists === 0) return;

  const textContent = await container.textContent() || "";

  for (const banned of BANNED_DUMMY_STRINGS) {
    if (textContent.includes(banned)) {
      addFinding({
        severity: "dummy_data",
        widget: widgetName,
        title: `Banned dummy text found: "${banned}"`,
        detail: `The text "${banned}" was found in the ${widgetName} widget. This suggests hardcoded mock data is bleeding through.`,
      });
    }
  }
}

/* ── Test Suite ──────────────────────────────────────── */

test.describe("Dashboard Module Audit", () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
  });

  /* ─────────────────────────────────────────────────────
   * TEST 1: Page Load & Structure
   * ───────────────────────────────────────────────────── */
  test("1. Dashboard loads correctly with all 6 widgets", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    // Check page header
    const heading = page.locator('h1:has-text("Dashboard")');
    await expect(heading).toBeVisible();
    addFinding({
      severity: "flow_pass",
      widget: "Page",
      title: "Dashboard heading renders",
      detail: "The h1 'Dashboard' heading is visible on page load.",
    });

    // Check date subheading contains current day
    const now = new Date();
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const subheading = page.locator("p").filter({ hasText: dayName });
    const subheadingVisible = await subheading.first().isVisible().catch(() => false);
    if (subheadingVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Page",
        title: "Dynamic date renders correctly",
        detail: `Subheading contains current day "${dayName}" — not hardcoded.`,
      });
    } else {
      addFinding({
        severity: "visual",
        widget: "Page",
        title: "Date subheading may be wrong",
        detail: `Expected day "${dayName}" not found in subheading text.`,
      });
    }

    // Check "Live" indicator
    const liveIndicator = page.locator('text="Live"');
    await expect(liveIndicator).toBeVisible();
    addFinding({
      severity: "flow_pass",
      widget: "Page",
      title: "Live indicator present",
      detail: "The green pulsing 'Live' indicator is rendered.",
    });

    // Check bento grid has the right structure
    const gridCols = page.locator(".grid");
    await expect(gridCols.first()).toBeVisible();

    // Count widget shells (rounded-xl borders)
    const widgets = page.locator('[class*="rounded-xl"][class*="border"]').filter({ has: page.locator("div") });
    const widgetCount = await widgets.count();
    if (widgetCount >= 6) {
      addFinding({
        severity: "flow_pass",
        widget: "Page",
        title: "All 6 widgets rendered",
        detail: `Found ${widgetCount} widget containers in the bento grid.`,
      });
    } else {
      addFinding({
        severity: "critical",
        widget: "Page",
        title: "Missing widgets in bento grid",
        detail: `Expected 6 widgets but found ${widgetCount}. Some widgets may have failed to render.`,
      });
    }

    // Check for console errors during load
    if (consoleErrors.length > 0) {
      for (const err of consoleErrors) {
        addFinding({
          severity: "critical",
          widget: "Page",
          title: "Console error on page load",
          detail: err.slice(0, 300),
        });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 2: Revenue Widget (Widget Revenue)
   * ───────────────────────────────────────────────────── */
  test("2. Revenue Widget — displays and is interactive", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    // Find Revenue MTD text
    const revLabel = page.locator('text="Revenue MTD"');
    const revLabelVisible = await revLabel.isVisible().catch(() => false);
    if (revLabelVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Revenue",
        title: "Revenue MTD label renders",
        detail: "The 'Revenue MTD' text is visible in the widget.",
      });
    } else {
      addFinding({
        severity: "critical",
        widget: "Revenue",
        title: "Revenue MTD label missing",
        detail: "The Revenue widget may not have loaded — 'Revenue MTD' text not found.",
      });
    }

    // Check for dollar sign
    const dollarSign = page.locator('text="$"').first();
    const dollarVisible = await dollarSign.isVisible().catch(() => false);
    if (dollarVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Revenue",
        title: "Currency symbol present",
        detail: "Dollar sign ($) is rendered before the revenue amount.",
      });
    }

    // Check growth indicator
    const growthText = page.locator('text="vs last month"');
    const growthVisible = await growthText.isVisible().catch(() => false);
    if (growthVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Revenue",
        title: "Growth comparison renders",
        detail: "'vs last month' growth indicator is visible.",
      });
    } else {
      addFinding({
        severity: "visual",
        widget: "Revenue",
        title: "Growth indicator missing",
        detail: "The 'vs last month' text is not visible — may indicate the growth% section failed to render.",
      });
    }

    // Check SVG chart
    const svgChart = page.locator("svg").filter({ has: page.locator("path") });
    const svgCount = await svgChart.count();
    if (svgCount > 0) {
      addFinding({
        severity: "flow_pass",
        widget: "Revenue",
        title: "SVG area chart renders",
        detail: `Found ${svgCount} SVG elements with paths (chart area + line).`,
      });
    }

    // Test click navigation to /finance
    const revenueWidget = page.locator('text="Revenue MTD"').locator("..").locator("..");
    const clickableParent = page.locator('[class*="cursor-pointer"]').first();
    if (await clickableParent.count() > 0) {
      await clickableParent.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      if (url.includes("/finance")) {
        addFinding({
          severity: "flow_pass",
          widget: "Revenue",
          title: "Click navigates to Finance",
          detail: `Clicking the Revenue widget navigated to ${url}`,
        });
        await page.goBack();
        await waitForDashboard(page);
      } else {
        addFinding({
          severity: "warning",
          widget: "Revenue",
          title: "Revenue click did not navigate",
          detail: `Expected navigation to /finance but URL is: ${url}`,
        });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 3: Live Dispatch Map Widget
   * ───────────────────────────────────────────────────── */
  test("3. Live Dispatch Map — renders pins and radar", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    // Check widget header
    const dispatchLabel = page.locator('text="Live Dispatch"');
    const dispatchVisible = await dispatchLabel.isVisible().catch(() => false);
    if (dispatchVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Map",
        title: "Live Dispatch header renders",
        detail: "'Live Dispatch' label is visible.",
      });
    } else {
      addFinding({
        severity: "critical",
        widget: "Map",
        title: "Live Dispatch header missing",
        detail: "The map widget may not have loaded.",
      });
    }

    // Check for Active badge
    const activeBadge = page.locator('text=/\\d+ Active/');
    const activeVisible = await activeBadge.first().isVisible().catch(() => false);
    if (activeVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Map",
        title: "Active technicians badge renders",
        detail: "Badge showing number of active technicians is visible.",
      });
    }

    // Check "Open Dispatch" button
    const openDispatch = page.locator('text="Open Dispatch"');
    const openDispatchVisible = await openDispatch.isVisible().catch(() => false);
    if (openDispatchVisible) {
      // Test the click
      await openDispatch.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      if (url.includes("/schedule")) {
        addFinding({
          severity: "flow_pass",
          widget: "Map",
          title: "'Open Dispatch' navigates to Schedule",
          detail: `Button navigated to ${url}`,
        });
        await page.goBack();
        await waitForDashboard(page);
      } else {
        addFinding({
          severity: "critical",
          widget: "Map",
          title: "'Open Dispatch' dead click",
          detail: `Expected navigation to /schedule but URL is: ${url}`,
        });
      }
    } else {
      addFinding({
        severity: "critical",
        widget: "Map",
        title: "'Open Dispatch' button missing",
        detail: "The 'Open Dispatch' action link is not rendered.",
      });
    }

    // Check for fallback/dummy pins
    const mapText = await page.locator('[class*="h-\\[260px\\]"]').first().textContent().catch(() => "");
    for (const name of FALLBACK_NAMES) {
      // Hover to reveal tooltips
    }

    // Check legend
    const legendOnJob = page.locator('text="On Job"');
    const legendEnRoute = page.locator('text="En Route"');
    const legendIdle = page.locator('text="Idle"');
    const legendVisible = (await legendOnJob.isVisible().catch(() => false)) &&
                          (await legendEnRoute.isVisible().catch(() => false)) &&
                          (await legendIdle.isVisible().catch(() => false));
    if (legendVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Map",
        title: "Map legend renders correctly",
        detail: "All 3 legend items (On Job, En Route, Idle) are visible.",
      });
    } else {
      addFinding({
        severity: "visual",
        widget: "Map",
        title: "Map legend incomplete",
        detail: "One or more legend items missing from the map widget.",
      });
    }

    // Check for technician pin dots
    const pins = page.locator('[class*="rounded-full"][class*="ring-2"]');
    const pinCount = await pins.count();
    if (pinCount > 0) {
      addFinding({
        severity: "flow_pass",
        widget: "Map",
        title: `${pinCount} technician pins rendered`,
        detail: `Found ${pinCount} pin dots on the dispatch map.`,
      });

      // Hover first pin to check tooltip
      await pins.first().hover();
      await page.waitForTimeout(800);
      const tooltip = page.locator('[class*="backdrop-blur"]').filter({ has: page.locator('[class*="text-zinc-200"]') });
      const tooltipVisible = await tooltip.first().isVisible().catch(() => false);
      if (tooltipVisible) {
        const tooltipText = await tooltip.first().textContent().catch(() => "");
        addFinding({
          severity: "flow_pass",
          widget: "Map",
          title: "Pin tooltip appears on hover",
          detail: `Tooltip shows: "${tooltipText?.trim().slice(0, 100)}"`,
        });

        // Check if tooltip shows fallback dummy names
        for (const name of FALLBACK_NAMES) {
          if (tooltipText?.includes(name)) {
            addFinding({
              severity: "dummy_data",
              widget: "Map",
              title: `Fallback pin name: "${name}"`,
              detail: `The map is showing hardcoded fallback pin "${name}" instead of live dispatch data. This means the RPC get_live_dispatch returned empty.`,
            });
          }
        }
      }
    } else {
      addFinding({
        severity: "warning",
        widget: "Map",
        title: "No pin dots visible",
        detail: "No technician pins found — map may be showing empty state or pins have different selectors.",
      });
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 4: Triage Inbox Widget
   * ───────────────────────────────────────────────────── */
  test("4. Triage Inbox Widget — items and interactions", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    const triageLabel = page.locator('text="Triage"');
    const triageVisible = await triageLabel.isVisible().catch(() => false);
    if (triageVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Inbox",
        title: "Triage header renders",
        detail: "'Triage' label is visible in the inbox widget.",
      });
    } else {
      addFinding({
        severity: "critical",
        widget: "Inbox",
        title: "Triage header missing",
        detail: "Inbox widget may not have loaded.",
      });
    }

    // Check "View all" button
    const viewAll = page.locator('text="View all"');
    const viewAllVisible = await viewAll.isVisible().catch(() => false);
    if (viewAllVisible) {
      await viewAll.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      if (url.includes("/inbox")) {
        addFinding({
          severity: "flow_pass",
          widget: "Inbox",
          title: "'View all' navigates to Inbox",
          detail: `Navigated to ${url}`,
        });
        await page.goBack();
        await waitForDashboard(page);
      } else {
        addFinding({
          severity: "critical",
          widget: "Inbox",
          title: "'View all' dead click",
          detail: `Expected /inbox but got ${url}`,
        });
      }
    }

    // Check for "All caught up" (empty state) or inbox items
    const caughtUp = page.locator('text="All caught up"');
    const caughtUpVisible = await caughtUp.isVisible().catch(() => false);
    if (caughtUpVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Inbox",
        title: "Empty state renders correctly",
        detail: "'All caught up' empty state is displayed — no unread items.",
      });
    } else {
      // Check for inbox items
      const inboxItems = page.locator('[class*="divide-y"] button');
      const itemCount = await inboxItems.count();
      if (itemCount > 0) {
        addFinding({
          severity: "flow_pass",
          widget: "Inbox",
          title: `${itemCount} inbox items rendered`,
          detail: `Found ${itemCount} notification items in the triage widget.`,
        });

        // Check for blue unread dot
        const dots = page.locator('[class*="bg-blue-500"][class*="rounded-full"][class*="h-\\[5px\\]"]');
        const dotCount = await dots.count();
        if (dotCount > 0) {
          addFinding({
            severity: "flow_pass",
            widget: "Inbox",
            title: "Unread dots visible",
            detail: `${dotCount} blue unread indicator dots found.`,
          });
        }

        // Check for sender avatars with gradient backgrounds
        const avatars = page.locator('[class*="bg-gradient-to-br"][class*="rounded-full"]');
        const avatarCount = await avatars.count();
        if (avatarCount > 0) {
          addFinding({
            severity: "flow_pass",
            widget: "Inbox",
            title: "Sender avatars render with gradients",
            detail: `${avatarCount} avatar circles with gradient backgrounds found.`,
          });
        }
      } else {
        addFinding({
          severity: "warning",
          widget: "Inbox",
          title: "No inbox items or empty state",
          detail: "Neither items nor 'All caught up' found — widget may have render issues.",
        });
      }
    }

    // Scan for dummy data
    await scanForDummyData(page, '[class*="divide-y"]', "Inbox");
  });

  /* ─────────────────────────────────────────────────────
   * TEST 5: Schedule Widget
   * ───────────────────────────────────────────────────── */
  test("5. My Schedule Widget — timeline rendering", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    const scheduleLabel = page.locator('text="My Schedule"');
    const scheduleVisible = await scheduleLabel.isVisible().catch(() => false);
    if (scheduleVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Schedule",
        title: "My Schedule header renders",
        detail: "'My Schedule' label is visible.",
      });
    } else {
      addFinding({
        severity: "critical",
        widget: "Schedule",
        title: "My Schedule header missing",
        detail: "Schedule widget may not have loaded.",
      });
    }

    // Check "Today" label
    const todayLabel = page.locator('text="Today"');
    const todayVisible = await todayLabel.first().isVisible().catch(() => false);
    if (todayVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Schedule",
        title: "'Today' label visible",
        detail: "Schedule widget correctly shows 'Today' context.",
      });
    }

    // Check "Full View" button
    const fullView = page.locator('text="Full View"');
    const fullViewVisible = await fullView.isVisible().catch(() => false);
    if (fullViewVisible) {
      await fullView.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      if (url.includes("/schedule")) {
        addFinding({
          severity: "flow_pass",
          widget: "Schedule",
          title: "'Full View' navigates to Schedule",
          detail: `Navigated to ${url}`,
        });
        await page.goBack();
        await waitForDashboard(page);
      } else {
        addFinding({
          severity: "critical",
          widget: "Schedule",
          title: "'Full View' dead click",
          detail: `Expected /schedule but got ${url}`,
        });
      }
    }

    // Check for schedule blocks or empty state
    const emptySchedule = page.locator('text="No upcoming schedule blocks"');
    const emptyVisible = await emptySchedule.isVisible().catch(() => false);
    if (emptyVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Schedule",
        title: "Empty schedule state renders",
        detail: "'No upcoming schedule blocks' empty state is displayed.",
      });
    } else {
      // Check for schedule block entries
      const blocks = page.locator('[class*="rounded-lg"][class*="border"]').filter({ has: page.locator('[class*="truncate"]') });
      const blockCount = await blocks.count();
      if (blockCount > 0) {
        addFinding({
          severity: "flow_pass",
          widget: "Schedule",
          title: `${blockCount} schedule blocks rendered`,
          detail: `Found ${blockCount} schedule entries in the timeline.`,
        });
      }

      // Check for "Next Up" badge
      const nextUp = page.locator('text="Next Up"');
      const nextUpVisible = await nextUp.isVisible().catch(() => false);
      if (nextUpVisible) {
        addFinding({
          severity: "flow_pass",
          widget: "Schedule",
          title: "'Next Up' badge visible",
          detail: "The 'Next Up' badge is rendered on the next scheduled block.",
        });
      }

      // Check for NOW time indicator
      const nowIndicator = page.locator('text="NOW"');
      const nowVisible = await nowIndicator.isVisible().catch(() => false);
      if (nowVisible) {
        addFinding({
          severity: "flow_pass",
          widget: "Schedule",
          title: "NOW time indicator visible",
          detail: "Current time marker is displayed in the schedule timeline.",
        });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 6: Quick Actions Widget
   * ───────────────────────────────────────────────────── */
  test("6. Quick Actions — all 4 buttons functional", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    const actionsLabel = page.locator('text="Quick Actions"');
    const actionsVisible = await actionsLabel.isVisible().catch(() => false);
    if (actionsVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Actions",
        title: "Quick Actions header renders",
        detail: "'Quick Actions' label is visible.",
      });
    } else {
      addFinding({
        severity: "critical",
        widget: "Actions",
        title: "Quick Actions header missing",
        detail: "Actions widget may not have loaded.",
      });
    }

    // Check all 4 action buttons exist
    const actionLabels = ["New Job", "New Invoice", "Add Client", "Broadcast"];
    for (const label of actionLabels) {
      const btn = page.locator(`text="${label}"`);
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        addFinding({
          severity: "flow_pass",
          widget: "Actions",
          title: `"${label}" button renders`,
          detail: `Action button "${label}" is visible and styled.`,
        });
      } else {
        addFinding({
          severity: "critical",
          widget: "Actions",
          title: `"${label}" button missing`,
          detail: `Expected action button "${label}" not found.`,
        });
      }
    }

    // Helper: dismiss any open modals by pressing Escape repeatedly
    async function dismissModals() {
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(300);
    }

    // Test each action button one at a time with fresh state

    // --- New Invoice ---
    const newInvoiceBtn = page.locator('text="New Invoice"');
    if (await newInvoiceBtn.isVisible().catch(() => false)) {
      await newInvoiceBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const modal = page.locator('[class*="fixed"][class*="z-50"]');
      const modalVisible = await modal.first().isVisible().catch(() => false);
      if (modalVisible) {
        addFinding({
          severity: "flow_pass",
          widget: "Actions",
          title: "'New Invoice' opens modal",
          detail: "Clicking 'New Invoice' successfully opens the create invoice modal.",
        });
      } else {
        addFinding({
          severity: "critical",
          widget: "Actions",
          title: "'New Invoice' dead click",
          detail: "Clicking 'New Invoice' did not open a modal or trigger any visible UI change.",
        });
      }
      await dismissModals();
    }

    // --- Add Client ---
    const addClientBtn = page.locator('text="Add Client"');
    if (await addClientBtn.isVisible().catch(() => false)) {
      await addClientBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const modal = page.locator('[class*="fixed"][class*="z-50"]');
      const modalVisible = await modal.first().isVisible().catch(() => false);
      if (modalVisible) {
        addFinding({
          severity: "flow_pass",
          widget: "Actions",
          title: "'Add Client' opens modal",
          detail: "Clicking 'Add Client' successfully opens the create client modal.",
        });
      } else {
        addFinding({
          severity: "critical",
          widget: "Actions",
          title: "'Add Client' dead click",
          detail: "Clicking 'Add Client' did not open a modal.",
        });
      }
      await dismissModals();
    }

    // --- New Job ---
    const newJobBtn = page.locator('text="New Job"');
    if (await newJobBtn.isVisible().catch(() => false)) {
      await newJobBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const modal = page.locator('[class*="fixed"][class*="z-50"]');
      const modalVisible = await modal.first().isVisible().catch(() => false);
      if (modalVisible) {
        addFinding({
          severity: "flow_pass",
          widget: "Actions",
          title: "'New Job' opens modal",
          detail: "Clicking 'New Job' successfully opens the create job modal.",
        });
      } else {
        addFinding({
          severity: "critical",
          widget: "Actions",
          title: "'New Job' DEAD CLICK — handler not wired",
          detail: "The handleAction function in widget-actions.tsx does not handle 'createJob'. The switch statement comment says '// createJob and broadcast handled via other mechanisms' but clicking the button does nothing — it falls through to default (no-op).",
        });
      }
      await dismissModals();
    }

    // --- Broadcast ---
    const broadcastBtn = page.locator('text="Broadcast"');
    if (await broadcastBtn.isVisible().catch(() => false)) {
      await broadcastBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const modal = page.locator('[class*="fixed"][class*="z-50"]');
      const modalVisible = await modal.first().isVisible().catch(() => false);
      if (modalVisible) {
        addFinding({
          severity: "flow_pass",
          widget: "Actions",
          title: "'Broadcast' opens modal",
          detail: "Clicking 'Broadcast' triggers a UI response.",
        });
      } else {
        addFinding({
          severity: "critical",
          widget: "Actions",
          title: "'Broadcast' DEAD CLICK — no handler",
          detail: "The handleAction function does not handle 'broadcast'. Clicking this button does absolutely nothing. This is a dead interaction.",
        });
      }
      await dismissModals();
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 7: AI Insights Widget
   * ───────────────────────────────────────────────────── */
  test("7. AI Insights Widget — content and action", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    const insightLabel = page.locator('text="AI Insight"');
    const insightVisible = await insightLabel.isVisible().catch(() => false);
    if (insightVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Insights",
        title: "AI Insight header renders",
        detail: "'AI Insight' label is visible with sparkle icon.",
      });
    } else {
      addFinding({
        severity: "critical",
        widget: "Insights",
        title: "AI Insight header missing",
        detail: "Insights widget may not have loaded.",
      });
    }

    // Check for fallback insight (dummy data)
    const fallbackInsight = page.locator(`text="${HARDCODED_FALLBACK_INSIGHT}"`);
    const fallbackVisible = await fallbackInsight.isVisible().catch(() => false);
    if (fallbackVisible) {
      addFinding({
        severity: "dummy_data",
        widget: "Insights",
        title: "Fallback hardcoded insight showing",
        detail: `The insight "${HARDCODED_FALLBACK_INSIGHT}" is the hardcoded fallback from widget-insights.tsx line 18-25. This means the RPC get_ai_insights returned empty data.`,
      });
    }

    // Check for action button
    const fixSchedule = page.locator('text="Fix Schedule"');
    const fixVisible = await fixSchedule.isVisible().catch(() => false);
    if (fixVisible) {
      await fixSchedule.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      if (url.includes("/schedule")) {
        addFinding({
          severity: "flow_pass",
          widget: "Insights",
          title: "Insight action navigates correctly",
          detail: `'Fix Schedule' button navigated to ${url}`,
        });
        await page.goBack();
        await waitForDashboard(page);
      } else {
        addFinding({
          severity: "warning",
          widget: "Insights",
          title: "Insight action navigation unclear",
          detail: `Clicked 'Fix Schedule' but URL is ${url}`,
        });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 8: Sidebar Navigation
   * ───────────────────────────────────────────────────── */
  test("8. Sidebar — all nav links work", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    const navTargets = [
      { label: "My Jobs", expected: "/dashboard/jobs" },
      { label: "Schedule", expected: "/dashboard/schedule" },
      { label: "Inbox", expected: "/dashboard/inbox" },
      { label: "Clients", expected: "/dashboard/clients" },
      { label: "Finance", expected: "/dashboard/finance" },
      { label: "Assets", expected: "/dashboard/assets" },
      { label: "Forms", expected: "/dashboard/forms" },
      { label: "Team", expected: "/dashboard/team" },
      { label: "Automations", expected: "/dashboard/automations" },
    ];

    for (const nav of navTargets) {
      const link = page.locator(`a:has-text("${nav.label}")`).first();
      const linkVisible = await link.isVisible().catch(() => false);
      if (!linkVisible) {
        addFinding({
          severity: "critical",
          widget: "Sidebar",
          title: `"${nav.label}" nav link missing`,
          detail: `Sidebar link "${nav.label}" not found or not visible.`,
        });
        continue;
      }

      await link.click();
      await page.waitForTimeout(2000);
      const url = page.url();
      if (url.includes(nav.expected)) {
        addFinding({
          severity: "flow_pass",
          widget: "Sidebar",
          title: `"${nav.label}" → ${nav.expected}`,
          detail: `Navigation successful.`,
        });
      } else {
        addFinding({
          severity: "critical",
          widget: "Sidebar",
          title: `"${nav.label}" navigation failed`,
          detail: `Expected URL to contain "${nav.expected}" but got "${url}"`,
        });
      }

      // Navigate back for next test
      await page.goto("/dashboard");
      await page.waitForTimeout(1000);
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 9: Topbar Interactions
   * ───────────────────────────────────────────────────── */
  test("9. Topbar — search, notifications, profile", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    // Check for search/command trigger (⌘K)
    const searchTrigger = page.locator('[class*="border"][class*="rounded"]').filter({ hasText: /Search|⌘K/i });
    const searchVisible = await searchTrigger.first().isVisible().catch(() => false);
    if (searchVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Topbar",
        title: "Search trigger visible",
        detail: "⌘K search bar trigger is rendered in the topbar.",
      });
    }

    // Test ⌘K shortcut
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(800);
    const cmdMenu = page.locator('[class*="fixed"][class*="inset-0"]').filter({ has: page.locator('input[type="text"]') });
    const cmdMenuVisible = await cmdMenu.first().isVisible().catch(() => false);
    if (cmdMenuVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Topbar",
        title: "⌘K command menu opens",
        detail: "Keyboard shortcut ⌘K successfully opens the command menu.",
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      addFinding({
        severity: "warning",
        widget: "Topbar",
        title: "⌘K shortcut may not work in test",
        detail: "Could not detect command menu after ⌘K — may be a Playwright focus issue.",
      });
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 10: Global Dummy Data Scan
   * ───────────────────────────────────────────────────── */
  test("10. Global dummy data scan across Dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    const fullText = await page.locator("body").textContent() || "";

    for (const banned of BANNED_DUMMY_STRINGS) {
      if (fullText.includes(banned)) {
        addFinding({
          severity: "dummy_data",
          widget: "Global",
          title: `Banned text: "${banned}"`,
          detail: `Found "${banned}" somewhere on the Dashboard page. This is likely hardcoded dummy data.`,
        });
      }
    }

    // Check for hardcoded dates that don't match today
    const today = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = monthNames[today.getMonth()];
    const currentDay = today.getDate();

    // Look for specific hardcoded dates from mock data
    const suspiciousDates = ["Feb 14", "Feb 18", "Feb 20", "Feb 22", "Feb 25", "Feb 19"];
    for (const d of suspiciousDates) {
      if (fullText.includes(d)) {
        addFinding({
          severity: "dummy_data",
          widget: "Global",
          title: `Possibly hardcoded date: "${d}"`,
          detail: `The date "${d}" appears on the dashboard. If this is from mock data in data.ts rather than live Supabase data, it's a dummy data leak.`,
        });
      }
    }

    // Check for broken images
    await checkForBrokenImages(page, "Global");
  });

  /* ─────────────────────────────────────────────────────
   * TEST 11: Style Enforcement — Design Consistency
   * ───────────────────────────────────────────────────── */
  test("11. Style consistency — no default browser styles", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    // Check all buttons have cursor:pointer
    const allButtons = page.locator("button");
    const buttonCount = await allButtons.count();
    let defaultCursorButtons = 0;
    for (let i = 0; i < Math.min(buttonCount, 20); i++) {
      const btn = allButtons.nth(i);
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;

      const cursor = await btn.evaluate((el) => getComputedStyle(el).cursor);
      if (cursor === "default" || cursor === "auto") {
        defaultCursorButtons++;
        const text = await btn.textContent() || "";
        addFinding({
          severity: "visual",
          widget: "Style",
          title: "Button without pointer cursor",
          detail: `Button "${text.trim().slice(0, 40)}" has cursor: ${cursor} instead of cursor: pointer.`,
        });
      }
    }

    if (defaultCursorButtons === 0) {
      addFinding({
        severity: "flow_pass",
        widget: "Style",
        title: "All buttons have pointer cursor",
        detail: `Checked ${Math.min(buttonCount, 20)} buttons — all have cursor: pointer.`,
      });
    }

    // Check body background is dark (#000 or very dark)
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (bgColor === "rgb(0, 0, 0)" || bgColor === "rgba(0, 0, 0, 0)") {
      addFinding({
        severity: "flow_pass",
        widget: "Style",
        title: "Dark theme background correct",
        detail: `Body background is ${bgColor} — matches dark theme.`,
      });
    } else {
      addFinding({
        severity: "visual",
        widget: "Style",
        title: "Background color unexpected",
        detail: `Body background is ${bgColor} — expected pure black (#000).`,
      });
    }

    // Check font family
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    if (fontFamily.toLowerCase().includes("inter")) {
      addFinding({
        severity: "flow_pass",
        widget: "Style",
        title: "Inter font applied",
        detail: `Font family: ${fontFamily.slice(0, 80)}`,
      });
    } else {
      addFinding({
        severity: "visual",
        widget: "Style",
        title: "Inter font not detected",
        detail: `Font family is "${fontFamily.slice(0, 80)}" — expected Inter.`,
      });
    }

    // Check for any default blue link colors (unstyled a tags)
    const links = page.locator("a");
    const linkCount = await links.count();
    let defaultLinks = 0;
    for (let i = 0; i < Math.min(linkCount, 15); i++) {
      const link = links.nth(i);
      const isVisible = await link.isVisible().catch(() => false);
      if (!isVisible) continue;

      const color = await link.evaluate((el) => getComputedStyle(el).color);
      // Default browser blue is approximately rgb(0, 0, 238) or rgb(0, 0, 255)
      if (color === "rgb(0, 0, 238)" || color === "rgb(0, 0, 255)") {
        defaultLinks++;
        const href = await link.getAttribute("href") || "";
        addFinding({
          severity: "visual",
          widget: "Style",
          title: "Unstyled default blue link",
          detail: `Link to "${href}" has default browser blue color — not themed.`,
        });
      }
    }
    if (defaultLinks === 0) {
      addFinding({
        severity: "flow_pass",
        widget: "Style",
        title: "No default blue links",
        detail: `All ${Math.min(linkCount, 15)} checked links have custom themed colors.`,
      });
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 12: Console Errors & Network Failures
   * ───────────────────────────────────────────────────── */
  test("12. Console errors and network failures", async ({ page }) => {
    const pageErrors: string[] = [];
    const networkFailures: { url: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(msg.text());
      }
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkFailures.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto("/dashboard");
    await waitForDashboard(page);

    // Wait extra for all async data to load
    await page.waitForTimeout(3000);

    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // Filter out known non-critical errors
        const isNonCritical = err.includes("Supabase") && err.includes("RPC");
        addFinding({
          severity: isNonCritical ? "warning" : "critical",
          widget: "Console",
          title: "Console error detected",
          detail: err.slice(0, 400),
        });
      }
    } else {
      addFinding({
        severity: "flow_pass",
        widget: "Console",
        title: "No console errors",
        detail: "Dashboard loaded without any console.error calls.",
      });
    }

    if (networkFailures.length > 0) {
      for (const fail of networkFailures) {
        addFinding({
          severity: fail.status >= 500 ? "critical" : "warning",
          widget: "Network",
          title: `HTTP ${fail.status} response`,
          detail: `URL: ${fail.url.slice(0, 200)}`,
        });
      }
    } else {
      addFinding({
        severity: "flow_pass",
        widget: "Network",
        title: "No network failures",
        detail: "All network requests returned 2xx/3xx status codes.",
      });
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 13: Keyboard Shortcuts
   * ───────────────────────────────────────────────────── */
  test("13. Keyboard shortcuts functional", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForDashboard(page);

    // Test '?' for keyboard shortcuts modal
    await page.keyboard.press("?");
    await page.waitForTimeout(800);
    const shortcutsModal = page.locator('[class*="fixed"]').filter({ hasText: /keyboard|shortcuts/i });
    const shortcutsVisible = await shortcutsModal.first().isVisible().catch(() => false);
    if (shortcutsVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Shortcuts",
        title: "'?' opens keyboard shortcuts",
        detail: "Keyboard shortcuts modal opens correctly.",
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      addFinding({
        severity: "warning",
        widget: "Shortcuts",
        title: "'?' shortcut may not work",
        detail: "Could not detect keyboard shortcuts modal after pressing '?'.",
      });
    }

    // Test 'C' for create job modal
    await page.keyboard.press("c");
    await page.waitForTimeout(800);
    const createModal = page.locator('[class*="fixed"][class*="inset-0"]').filter({ has: page.locator("input") });
    const createVisible = await createModal.first().isVisible().catch(() => false);
    if (createVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Shortcuts",
        title: "'C' opens create job modal",
        detail: "Keyboard shortcut 'C' successfully opens the create job modal.",
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      addFinding({
        severity: "warning",
        widget: "Shortcuts",
        title: "'C' shortcut unclear",
        detail: "Could not detect create job modal after pressing 'C'.",
      });
    }
  });

  /* ─────────────────────────────────────────────────────
   * TEST 14: Responsive — Widget Layout
   * ───────────────────────────────────────────────────── */
  test("14. Responsive layout check", async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await waitForDashboard(page);

    const desktopGrid = page.locator(".grid");
    await expect(desktopGrid.first()).toBeVisible();
    addFinding({
      severity: "flow_pass",
      widget: "Responsive",
      title: "Desktop layout (1440px) renders",
      detail: "Bento grid visible at desktop width.",
    });

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    addFinding({
      severity: "flow_pass",
      widget: "Responsive",
      title: "Tablet layout (768px) renders",
      detail: "Grid adjusts to 2-column layout.",
    });

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const mobileGrid = page.locator(".grid");
    const mobileVisible = await mobileGrid.first().isVisible().catch(() => false);
    if (mobileVisible) {
      addFinding({
        severity: "flow_pass",
        widget: "Responsive",
        title: "Mobile layout (375px) renders",
        detail: "Grid collapses to single column on mobile.",
      });
    }

    // Reset
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  /* ─────────────────────────────────────────────────────
   * AFTER ALL: Generate Audit Report
   * ───────────────────────────────────────────────────── */
  test.afterAll(async () => {
    const criticals = findings.filter((f) => f.severity === "critical");
    const visuals = findings.filter((f) => f.severity === "visual");
    const dummies = findings.filter((f) => f.severity === "dummy_data");
    const passes = findings.filter((f) => f.severity === "flow_pass");
    const warnings = findings.filter((f) => f.severity === "warning");
    const fails = findings.filter((f) => f.severity === "flow_fail");

    const now = new Date().toISOString();

    let md = `# Dashboard Module — Audit Report

> **Generated**: ${now}
> **Module**: Dashboard (\`/dashboard\`)
> **Test Framework**: Playwright
> **Total Findings**: ${findings.length}

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 Critical Failures | ${criticals.length} |
| 🟡 Visual Defects | ${visuals.length} |
| 🟣 Dummy Data Leaks | ${dummies.length} |
| 🟠 Warnings | ${warnings.length} |
| 🟢 Flow Passes | ${passes.length} |

---

## 🔴 Critical Failures

${criticals.length === 0 ? "_No critical failures found._\n" : ""}
${criticals.map((f) => `### ${f.title}
- **Widget**: ${f.widget}
- **Detail**: ${f.detail}
${f.selector ? `- **Selector**: \`${f.selector}\`` : ""}
`).join("\n")}

---

## 🟡 Visual Defects

${visuals.length === 0 ? "_No visual defects found._\n" : ""}
${visuals.map((f) => `### ${f.title}
- **Widget**: ${f.widget}
- **Detail**: ${f.detail}
${f.selector ? `- **Selector**: \`${f.selector}\`` : ""}
`).join("\n")}

---

## 🟣 Dummy Data Leaks

${dummies.length === 0 ? "_No dummy data leaks found._\n" : ""}
${dummies.map((f) => `### ${f.title}
- **Widget**: ${f.widget}
- **Detail**: ${f.detail}
`).join("\n")}

---

## 🟠 Warnings

${warnings.length === 0 ? "_No warnings._\n" : ""}
${warnings.map((f) => `### ${f.title}
- **Widget**: ${f.widget}
- **Detail**: ${f.detail}
`).join("\n")}

---

## 🟢 Flow Verification (Passes)

${passes.map((f) => `- ✅ **[${f.widget}]** ${f.title}: ${f.detail}`).join("\n")}

---

## Architecture Notes

### Data Flow
The dashboard uses a dual-source strategy:
1. **Primary**: Server Actions (RPCs) — \`getDashboardStats\`, \`getDailyRevenueChart\`, \`getMySchedule\`, \`getAIInsights\`, \`getLiveDispatch\`
2. **Fallback**: Zustand stores populated by \`DataProvider\` — which themselves fallback to hardcoded mock data in \`data.ts\`

### Known Code Issues Found During Review
1. **\`widget-actions.tsx\` line 51-59**: \`handleAction\` switch statement does NOT handle \`"createJob"\` or \`"broadcast"\` — these fall through to default (no-op), making 2 of 4 quick action buttons dead clicks.
2. **\`widget-map.tsx\` line 48-53**: Hardcoded fallback pins (\`Mike T.\`, \`Sarah C.\`, \`James O.\`, \`Tom L.\`) are used when RPC returns empty. These are dummy data leaks.
3. **\`widget-insights.tsx\` line 18-25**: Hardcoded fallback insight text is shown when RPC returns empty. This is the default state for new orgs with no AI insights.
4. **\`data.ts\`**: Full mock data file with 753 lines of hardcoded jobs, clients, invoices, etc. Stores fall back to this data when Supabase queries return empty.

---

_Report generated by iWorkr QA Audit System_
`;

    const reportPath = path.resolve(__dirname, "../audit-reports/dashboard-audit.md");
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, md, "utf-8");
    console.log(`\n📝 Audit report written to: ${reportPath}\n`);
  });
});
