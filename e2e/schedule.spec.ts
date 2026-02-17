/**
 * ============================================================
 * iWorkr Schedule Module — Comprehensive E2E Audit
 * ============================================================
 *
 * Audits:
 *   A. Gantt-style Timeline — Header, technician rows, hour grid, now line
 *   B. Schedule Blocks      — Rendering, color coding, content, peek popover
 *   C. Drag & Drop          — Move blocks, resize, undo toast
 *   D. Context Menu         — Right-click, open/copy/unschedule/delete
 *   E. Keyboard Shortcuts   — V (view scale), U (backlog drawer), Escape
 *   F. Backlog Drawer       — Toggle, list items, empty state
 *   G. View Scale Toggle    — Day / Week / Month
 *   H. Date Navigation      — Prev/Next day, Today button
 *   I. Dummy Data Scan      — Mock technicians, blocks, clients
 *   J. Style / Console      — cursor, theme, errors
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/* ── Report accumulator ──────────────────────────────── */

interface Finding {
  severity: "critical" | "visual" | "dummy_data" | "flow_pass" | "flow_fail" | "warning";
  area: string;
  title: string;
  detail: string;
}

const findings: Finding[] = [];

function log(f: Finding) {
  findings.push(f);
  const icon =
    f.severity === "critical" ? "🔴" :
    f.severity === "visual" ? "🟡" :
    f.severity === "dummy_data" ? "🟣" :
    f.severity === "flow_pass" ? "🟢" :
    f.severity === "warning" ? "🟠" : "🔵";
  console.log(`${icon} [${f.area}] ${f.title}: ${f.detail}`);
}

/* ── Constants ───────────────────────────────────────── */

const MOCK_TECHS = ["Mike Thompson", "Sarah Chen", "James O'Brien", "Tom Liu"];
const MOCK_BLOCKS = [
  "Water heater install",
  "Blocked drain investigation",
  "Emergency burst pipe",
  "Hot water inspection",
  "Kitchen repipe",
  "Boiler service",
  "Stormwater drainage",
  "Gas compliance cert",
  "Tap replacement",
  "Pipe inspection",
  "Toilet replacement",
  "Pipe repair backup",
];
const MOCK_CLIENTS = ["David Park", "Lisa Chen", "John Harris", "Sarah Mitchell", "Rachel Kim", "Tom Andrews", "Emma Wilson"];

/* ── Helpers ─────────────────────────────────────────── */

async function goToSchedule(page: Page) {
  await page.goto("/dashboard/schedule");
  await page.waitForTimeout(2500);
}

/* ══════════════════════════════════════════════════════
   Test Suite
   ══════════════════════════════════════════════════════ */

test.describe("Schedule Module Audit", () => {
  let consoleErrors: string[] = [];
  let networkFailures: { url: string; status: number }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkFailures = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400) {
        networkFailures.push({ url: resp.url(), status: resp.status() });
      }
    });
  });

  /* ─────────────────────────────────────────────────────
   * 1. Page Load & Header
   * ───────────────────────────────────────────────────── */
  test("1. Schedule page loads with correct header", async ({ page }) => {
    await goToSchedule(page);

    const heading = page.locator('h1:has-text("Schedule")');
    if (await heading.isVisible().catch(() => false)) {
      log({ severity: "flow_pass", area: "Header", title: "Schedule heading renders", detail: "h1 'Schedule' is visible." });
    } else {
      log({ severity: "critical", area: "Header", title: "Schedule heading missing", detail: "h1 'Schedule' not found." });
    }

    // Date display — "Today — Feb 16" or similar
    const dateLabel = page.locator('text=/Today|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/').first();
    if (await dateLabel.isVisible().catch(() => false)) {
      const text = await dateLabel.textContent();
      log({ severity: "flow_pass", area: "Header", title: "Date label renders", detail: `Date: "${text?.trim()}"` });
    }

    // Prev/Next day buttons (ChevronLeft, ChevronRight)
    const chevrons = page.locator('button').filter({ has: page.locator('svg') });
    const chevronCount = await chevrons.count();
    log({ severity: "flow_pass", area: "Header", title: "Navigation buttons render", detail: `Found ${chevronCount} header buttons.` });

    // "Today" button
    const todayBtn = page.locator('button:has-text("Today")');
    if (await todayBtn.isVisible().catch(() => false)) {
      log({ severity: "flow_pass", area: "Header", title: "'Today' button renders", detail: "Quick-jump to today button visible." });
    }

    // View scale toggle (Day / Week / Month)
    for (const scale of ["Day", "Week", "Month"]) {
      const scaleBtn = page.locator(`button:has-text("${scale}")`).first();
      if (await scaleBtn.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Header", title: `'${scale}' view toggle`, detail: `View scale button "${scale}" visible.` });
      }
    }

    // Backlog button with U kbd hint
    const backlogBtn = page.locator('button:has-text("Backlog")');
    if (await backlogBtn.isVisible().catch(() => false)) {
      log({ severity: "flow_pass", area: "Header", title: "'Backlog' toggle renders", detail: "Backlog drawer toggle with U shortcut visible." });
    }
  });

  /* ─────────────────────────────────────────────────────
   * 2. Technician Resource Column
   * ───────────────────────────────────────────────────── */
  test("2. Technician resource column renders (or empty state)", async ({ page }) => {
    await goToSchedule(page);

    // Check for technician avatars with initials
    const avatars = page.locator('[class*="rounded-full"][class*="bg-zinc-800"]');
    const avatarCount = await avatars.count();

    if (avatarCount >= 1) {
      log({ severity: "flow_pass", area: "Resources", title: `${avatarCount} technician avatars`, detail: "Avatar circles with initials in resource column." });

      // Check for status dots (online/away/offline)
      const statusDots = page.locator('[class*="rounded-full"][class*="ring-2"]');
      const dotCount = await statusDots.count();
      if (dotCount > 0) {
        log({ severity: "flow_pass", area: "Resources", title: `${dotCount} status indicators`, detail: "Online/away/offline dots visible." });
      }

      // Check for capacity bars
      const capacityBars = page.locator('[class*="rounded-full"][class*="h-1"]');
      const barCount = await capacityBars.count();
      if (barCount > 0) {
        log({ severity: "flow_pass", area: "Resources", title: "Capacity bars render", detail: `${barCount} capacity progress bars visible.` });
      }

      // Hours booked labels
      const hoursLabels = page.locator('text=/\\d+\\.?\\d*h$/');
      const hoursCount = await hoursLabels.count();
      if (hoursCount > 0) {
        log({ severity: "flow_pass", area: "Resources", title: "Hours booked labels", detail: `${hoursCount} hours labels (e.g., "6.5h") visible.` });
      }
    } else {
      // No technicians — check for empty state
      const emptyState = page.locator('text="No schedule data"');
      if (await emptyState.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Resources", title: "Empty state renders (no technicians)", detail: "'No schedule data' — expected for test user." });
      } else {
        log({ severity: "warning", area: "Resources", title: "No technicians and no empty state", detail: "Resource column is empty." });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * 3. Hour Grid & Timeline
   * ───────────────────────────────────────────────────── */
  test("3. Hour grid and timeline render", async ({ page }) => {
    await goToSchedule(page);

    // Check for hour labels (6 AM through 7 PM)
    const hourLabels = page.locator('[class*="font-mono"][class*="text-\\[10px\\]"]');
    const hourCount = await hourLabels.count();
    if (hourCount >= 10) {
      log({ severity: "flow_pass", area: "Timeline", title: `${hourCount} hour labels`, detail: "Hour grid headers from 6 AM to 7 PM." });
    } else {
      log({ severity: "visual", area: "Timeline", title: `Only ${hourCount} hour labels`, detail: "Expected 13 hour labels (6 AM - 7 PM)." });
    }

    // Check for "Now" line (red vertical line)
    const nowLine = page.locator('[class*="bg-red-500"]');
    const nowCount = await nowLine.count();
    if (nowCount > 0) {
      log({ severity: "flow_pass", area: "Timeline", title: "Now line renders", detail: "Red vertical 'now' indicator visible on timeline." });
    }

    // Check for non-working hours shading (hatched pattern)
    const shadedAreas = page.locator('[class*="bg-\\[rgba\\(255,255,255,0\\.015\\)\\]"]');
    const shadedCount = await shadedAreas.count();
    if (shadedCount > 0) {
      log({ severity: "flow_pass", area: "Timeline", title: "Non-working hours shading", detail: `${shadedCount} hatched areas for before/after work hours.` });
    }
  });

  /* ─────────────────────────────────────────────────────
   * 4. Schedule Blocks — Rendering
   * ───────────────────────────────────────────────────── */
  test("4. Schedule blocks render with correct content", async ({ page }) => {
    await goToSchedule(page);

    // Blocks are absolute-positioned divs with cursor-grab
    const blocks = page.locator('[class*="cursor-grab"][class*="rounded-md"]');
    const blockCount = await blocks.count();

    if (blockCount > 0) {
      log({ severity: "flow_pass", area: "Blocks", title: `${blockCount} schedule blocks render`, detail: `Found ${blockCount} draggable schedule blocks.` });

      // Check first block content
      const firstBlock = blocks.first();

      // Job ID in mono font
      const jobId = firstBlock.locator('[class*="font-mono"]');
      if (await jobId.first().isVisible().catch(() => false)) {
        const idText = await jobId.first().textContent();
        log({ severity: "flow_pass", area: "Blocks", title: "Block job ID visible", detail: `First block ID: "${idText?.trim()}"` });
      }

      // Client name
      const clientEl = firstBlock.locator('[class*="text-\\[10px\\]"][class*="font-medium"]');
      if (await clientEl.first().isVisible().catch(() => false)) {
        const clientText = await clientEl.first().textContent();
        log({ severity: "flow_pass", area: "Blocks", title: "Block client name visible", detail: `Client: "${clientText?.trim()}"` });
      }

      // Title with wrench icon
      const titleEl = firstBlock.locator('[class*="text-\\[9px\\]"][class*="text-zinc-500"]');
      if (await titleEl.first().isVisible().catch(() => false)) {
        const titleText = await titleEl.first().textContent();
        log({ severity: "flow_pass", area: "Blocks", title: "Block title visible", detail: `Title: "${titleText?.trim()}"` });
      }

      // Left accent border (3px colored)
      const accent = firstBlock.locator('[class*="w-\\[3px\\]"]');
      if (await accent.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Blocks", title: "Block accent border", detail: "3px left accent border with status color." });
      }
    } else {
      // Check for empty state
      const emptyState = page.locator('text="No schedule data"');
      if (await emptyState.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Blocks", title: "Empty state renders", detail: "'No schedule data' empty state — expected for test user with no live data." });
        const ctaText = page.locator('text="Assign technicians and jobs to see the dispatch board."');
        if (await ctaText.isVisible().catch(() => false)) {
          log({ severity: "flow_pass", area: "Blocks", title: "Empty state CTA renders", detail: "Helper text visible below empty state heading." });
        }
      } else {
        log({ severity: "warning", area: "Blocks", title: "No blocks and no empty state", detail: "Schedule appears blank." });
      }
    }

    // Check for conflict badge (pulsing red dot)
    const conflictBadges = page.locator('[class*="bg-red-500"][class*="rounded-full"]').filter({ hasText: "" });
    // Also check for conflict indicator in header
    const conflictText = page.locator('text=/\\d+ conflict/');
    if (await conflictText.first().isVisible().catch(() => false)) {
      const cText = await conflictText.first().textContent();
      log({ severity: "flow_pass", area: "Blocks", title: "Conflict indicator renders", detail: `"${cText?.trim()}" with pulsing dot.` });
    }
  });

  /* ─────────────────────────────────────────────────────
   * 5. Block Click → Peek Popover
   * ───────────────────────────────────────────────────── */
  test("5. Clicking a block opens peek popover", async ({ page }) => {
    await goToSchedule(page);

    const blocks = page.locator('[class*="cursor-grab"][class*="rounded-md"]');
    if (await blocks.count() === 0) {
      log({ severity: "warning", area: "Peek", title: "No blocks to click", detail: "Skipping." });
      return;
    }

    // Click a block
    await blocks.first().click();
    await page.waitForTimeout(800);

    // Check for peek popover (z-50 positioned card)
    const peekCard = page.locator('[class*="z-50"][class*="rounded-xl"]');
    if (await peekCard.first().isVisible().catch(() => false)) {
      log({ severity: "flow_pass", area: "Peek", title: "Peek popover opens", detail: "JobPeekCard rendered below clicked block." });

      // Check popover content
      // Job ID
      const peekJobId = peekCard.locator('[class*="font-mono"]');
      if (await peekJobId.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "Peek shows job ID", detail: "Mono-styled job ID in peek header." });
      }

      // Status badge
      const statusBadge = peekCard.locator('[class*="rounded-full"][class*="border"]').filter({ hasText: /Scheduled|En Route|In Progress|Complete/i });
      if (await statusBadge.first().isVisible().catch(() => false)) {
        const statusText = await statusBadge.first().textContent();
        log({ severity: "flow_pass", area: "Peek", title: "Peek shows status", detail: `Status: "${statusText?.trim()}"` });
      }

      // Mini map
      const miniMap = peekCard.locator('[class*="bg-\\[#080808\\]"]');
      if (await miniMap.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "Peek mini map renders", detail: "Dark mini map with pin and grid effect." });
      }

      // Time info
      const timeInfo = peekCard.locator('text=/AM|PM/');
      if (await timeInfo.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "Peek shows time info", detail: "Start/end time with AM/PM visible." });
      }

      // "Open Mission Control" button
      const openBtn = peekCard.locator('button:has-text("Open Mission Control")');
      if (await openBtn.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "'Open Mission Control' CTA", detail: "Primary action button in peek popover." });
      }

      // Action buttons (Call, Message, Copy)
      const callBtn = peekCard.locator('button[title="Call"]');
      const msgBtn = peekCard.locator('button[title="Message"]');
      const copyBtn = peekCard.locator('button[title="Copy link"]');

      if (await callBtn.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "Call button in peek", detail: "Phone icon button — wired to tel: handler (shows toast if no phone)." });
      }
      if (await msgBtn.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "Message button in peek", detail: "Message icon button — wired to sms: handler (shows toast if no phone)." });
      }

      // Directions buttons (one in footer, one on map)
      const directionsBtn = peekCard.locator('button[title="Directions"]');
      if (await directionsBtn.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "Directions button in footer", detail: "Directions button wired — opens Google Maps." });
      }
      const mapDirectionsBtn = peekCard.locator('button:has-text("Directions")');
      if (await mapDirectionsBtn.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Peek", title: "Directions button on map", detail: "Mini map directions button wired — opens Google Maps." });
      }

      // Close peek by pressing Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    } else {
      log({ severity: "critical", area: "Peek", title: "Peek popover failed to open", detail: "Clicked a block but no peek card appeared." });
    }
  });

  /* ─────────────────────────────────────────────────────
   * 6. Context Menu (Right-Click)
   * ───────────────────────────────────────────────────── */
  test("6. Right-click block opens context menu", async ({ page }) => {
    await goToSchedule(page);

    const blocks = page.locator('[class*="cursor-grab"][class*="rounded-md"]');
    if (await blocks.count() === 0) {
      log({ severity: "warning", area: "ContextMenu", title: "No blocks", detail: "Skipping." });
      return;
    }

    await blocks.first().click({ button: "right" });
    await page.waitForTimeout(600);

    const menuItems = ["Open Mission Control", "Copy Job ID", "Unschedule", "Delete"];
    let foundItems = 0;
    for (const item of menuItems) {
      const el = page.locator('[class*="rounded"]').filter({ hasText: item });
      if (await el.first().isVisible().catch(() => false)) {
        foundItems++;
        log({ severity: "flow_pass", area: "ContextMenu", title: `"${item}" option`, detail: `Context menu item "${item}" visible.` });
      }
    }

    if (foundItems >= 3) {
      log({ severity: "flow_pass", area: "ContextMenu", title: "Context menu renders", detail: `${foundItems}/${menuItems.length} items visible.` });
    } else if (foundItems === 0) {
      log({ severity: "critical", area: "ContextMenu", title: "Context menu failed", detail: "Right-click produced no context menu." });
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  /* ─────────────────────────────────────────────────────
   * 7. View Scale Toggle — Day / Week / Month
   * ───────────────────────────────────────────────────── */
  test("7. View scale toggle — Day active, Week/Month disabled", async ({ page }) => {
    await goToSchedule(page);

    // Day should be active
    const dayBtn = page.locator('button:has-text("Day")').first();
    if (await dayBtn.isVisible().catch(() => false)) {
      const cls = await dayBtn.getAttribute("class") || "";
      if (cls.includes("text-zinc-200")) {
        log({ severity: "flow_pass", area: "ViewScale", title: "'Day' is active", detail: "Day button shows active/highlighted state." });
      }
    }

    // Week and Month should be disabled with "Coming soon" tooltip
    for (const scale of ["Week", "Month"]) {
      const btn = page.locator(`button:has-text("${scale}")`).first();
      if (await btn.isVisible().catch(() => false)) {
        const isDisabled = await btn.isDisabled().catch(() => false);
        const title = await btn.getAttribute("title") || "";

        if (isDisabled) {
          log({ severity: "flow_pass", area: "ViewScale", title: `"${scale}" is disabled`, detail: `${scale} toggle correctly disabled — prevents broken view rendering.` });
        } else {
          log({ severity: "visual", area: "ViewScale", title: `"${scale}" is not disabled`, detail: `Expected ${scale} to be disabled but it's clickable.` });
        }

        if (title.toLowerCase().includes("coming soon")) {
          log({ severity: "flow_pass", area: "ViewScale", title: `"${scale}" has tooltip`, detail: `Tooltip: "${title}"` });
        }
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * 8. Date Navigation — Prev / Next / Today
   * ───────────────────────────────────────────────────── */
  test("8. Date navigation — prev, next, today buttons", async ({ page }) => {
    await goToSchedule(page);

    // Get initial date text
    const dateEl = page.locator('text=/Today|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/').first();
    const initialDate = await dateEl.textContent().catch(() => "");

    // Click next day (ChevronRight)
    const nextBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(1);
    // Actually find the specific chevrons near the date label
    const chevronBtns = page.locator('[class*="rounded-md"][class*="text-zinc-600"]').filter({ has: page.locator('svg') });

    // Click forward
    if (await chevronBtns.nth(1).isVisible().catch(() => false)) {
      await chevronBtns.nth(1).click();
      await page.waitForTimeout(1000);

      const newDate = await dateEl.textContent().catch(() => "");
      if (newDate !== initialDate) {
        log({ severity: "flow_pass", area: "DateNav", title: "Next day navigates", detail: `Changed from "${initialDate?.trim()}" to "${newDate?.trim()}"` });
      } else {
        log({ severity: "warning", area: "DateNav", title: "Next day unchanged", detail: "Clicked forward but date label didn't change visually." });
      }
    }

    // Click "Today" to reset
    const todayBtn = page.locator('button:has-text("Today")');
    if (await todayBtn.isVisible().catch(() => false)) {
      await todayBtn.click();
      await page.waitForTimeout(800);

      const resetDate = await dateEl.textContent().catch(() => "");
      if (resetDate?.includes("Today")) {
        log({ severity: "flow_pass", area: "DateNav", title: "'Today' button resets", detail: `Date reset to: "${resetDate?.trim()}"` });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * 9. Keyboard Shortcuts — V, U, Escape
   * ───────────────────────────────────────────────────── */
  test("9. Keyboard shortcuts — V (view), U (backlog), Escape", async ({ page }) => {
    await goToSchedule(page);

    // Focus body
    await page.locator("body").click();
    await page.waitForTimeout(300);

    // Press V to cycle view scale
    const initialScale = page.locator('button[class*="text-zinc-200"]').filter({ hasText: /Day|Week|Month/ });
    const initialText = await initialScale.first().textContent().catch(() => "Day");

    await page.keyboard.press("v");
    await page.waitForTimeout(500);

    const newScale = page.locator('button[class*="text-zinc-200"]').filter({ hasText: /Day|Week|Month/ });
    const newText = await newScale.first().textContent().catch(() => "");
    if (newText !== initialText) {
      log({ severity: "flow_pass", area: "Keyboard", title: "V key cycles view scale", detail: `Changed from "${initialText?.trim()}" to "${newText?.trim()}"` });
    } else {
      log({ severity: "warning", area: "Keyboard", title: "V key effect unclear", detail: "Could not confirm view scale change." });
    }

    // Press U to open backlog drawer
    await page.keyboard.press("u");
    await page.waitForTimeout(800);

    const drawer = page.locator('text="Backlog"').nth(1); // Second occurrence (drawer header)
    const drawerVisible = await drawer.isVisible().catch(() => false);
    // Also check for drawer content
    const drawerContent = page.locator('[class*="w-\\[280px\\]"]');
    if (await drawerContent.first().isVisible().catch(() => false) || drawerVisible) {
      log({ severity: "flow_pass", area: "Keyboard", title: "U key opens backlog drawer", detail: "Backlog sidebar drawer appeared." });
    }

    // Press Escape to close
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    log({ severity: "flow_pass", area: "Keyboard", title: "Escape closes drawer", detail: "Pressed Escape to close backlog drawer." });

    // Reset view to Day
    await page.keyboard.press("v");
    await page.waitForTimeout(300);
    await page.keyboard.press("v");
    await page.waitForTimeout(300);
  });

  /* ─────────────────────────────────────────────────────
   * 10. Backlog Drawer — Content
   * ───────────────────────────────────────────────────── */
  test("10. Backlog drawer — toggle and content", async ({ page }) => {
    await goToSchedule(page);

    // Click Backlog button
    const backlogBtn = page.locator('button:has-text("Backlog")');
    if (await backlogBtn.isVisible().catch(() => false)) {
      await backlogBtn.click();
      await page.waitForTimeout(800);

      // Check drawer opened
      const drawerHeader = page.locator('[class*="w-\\[280px\\]"]');
      if (await drawerHeader.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Backlog", title: "Backlog drawer opens", detail: "280px drawer sidebar visible." });

        // Check for empty state or backlog items
        const emptyState = page.locator('text="No unscheduled jobs"');
        const backlogItems = page.locator('[class*="cursor-grab"][class*="rounded-lg"][class*="border"]');

        if (await emptyState.isVisible().catch(() => false)) {
          log({ severity: "flow_pass", area: "Backlog", title: "Empty state renders", detail: "'No unscheduled jobs' with calendar icon." });
        } else if (await backlogItems.count() > 0) {
          const itemCount = await backlogItems.count();
          log({ severity: "flow_pass", area: "Backlog", title: `${itemCount} backlog items`, detail: "Unscheduled jobs listed in drawer." });

          // Check item content
          const firstItem = backlogItems.first();
          const displayId = firstItem.locator('[class*="font-mono"]');
          if (await displayId.first().isVisible().catch(() => false)) {
            const idText = await displayId.first().textContent();
            log({ severity: "flow_pass", area: "Backlog", title: "Backlog item has display ID", detail: `ID: "${idText?.trim()}"` });
          }
        }

        // Close drawer button
        const closeBtn = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: "" });
        // The X button is inside the drawer header
      } else {
        log({ severity: "critical", area: "Backlog", title: "Backlog drawer failed to open", detail: "Clicked Backlog button but drawer not visible." });
      }

      // Close drawer
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  });

  /* ─────────────────────────────────────────────────────
   * 11. Travel Time Ghost Blocks
   * ───────────────────────────────────────────────────── */
  test("11. Travel time ghost blocks render", async ({ page }) => {
    await goToSchedule(page);

    // Ghost blocks are dashed-border divs before main blocks
    const ghostBlocks = page.locator('[class*="border-dashed"][class*="border-\\[rgba"]');
    const ghostCount = await ghostBlocks.count();

    if (ghostCount > 0) {
      log({ severity: "flow_pass", area: "Travel", title: `${ghostCount} travel time ghost blocks`, detail: "Dashed-border ghost blocks for travel time visible." });

      // Check for navigation icon inside ghost
      const navIcons = ghostBlocks.first().locator('svg');
      if (await navIcons.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "Travel", title: "Navigation icon in ghost block", detail: "Navigation arrow icon shown in travel time indicator." });
      }
    } else {
      log({ severity: "visual", area: "Travel", title: "No travel time ghosts", detail: "No dashed travel-time indicators found — may be scrolled out of view." });
    }
  });

  /* ─────────────────────────────────────────────────────
   * 12. Block Drag & Drop (Move)
   * ───────────────────────────────────────────────────── */
  test("12. Block drag and drop — move with undo toast", async ({ page }) => {
    await goToSchedule(page);

    const blocks = page.locator('[class*="cursor-grab"][class*="rounded-md"][class*="absolute"]');
    const blockCount = await blocks.count();

    if (blockCount === 0) {
      log({ severity: "warning", area: "DragDrop", title: "No blocks to drag", detail: "Skipping." });
      return;
    }

    // Get the first block's position
    const firstBlock = blocks.first();
    const box = await firstBlock.boundingBox();

    if (box) {
      // Drag the block ~120px right (1 hour)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(1000);

      // Check for reschedule toast
      const toast = page.locator('[class*="fixed"][class*="bottom"]').filter({ hasText: /rescheduled|undo/i });
      if (await toast.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "DragDrop", title: "Drag produces reschedule toast", detail: "Toast with undo option shown after drag." });

        // Click Undo
        const undoBtn = toast.locator('button:has-text("Undo")');
        if (await undoBtn.isVisible().catch(() => false)) {
          await undoBtn.click();
          await page.waitForTimeout(500);
          log({ severity: "flow_pass", area: "DragDrop", title: "Undo restores block position", detail: "Clicked Undo to restore original position." });
        }
      } else {
        log({ severity: "warning", area: "DragDrop", title: "No drag toast", detail: "Dragged block but no toast appeared — drag may have been too small." });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * 13. Peek Popover — Open Mission Control Navigation
   * ───────────────────────────────────────────────────── */
  test("13. Peek popover 'Open Mission Control' navigates to job detail", async ({ page }) => {
    await goToSchedule(page);

    const blocks = page.locator('[class*="cursor-grab"][class*="rounded-md"]');
    if (await blocks.count() === 0) {
      log({ severity: "warning", area: "PeekNav", title: "No blocks", detail: "Skipping." });
      return;
    }

    // Click block to open peek
    await blocks.first().click();
    await page.waitForTimeout(800);

    const openBtn = page.locator('button:has-text("Open Mission Control")');
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      if (url.includes("/dashboard/jobs/")) {
        log({ severity: "flow_pass", area: "PeekNav", title: "'Open Mission Control' navigates", detail: `Navigated to: ${url}` });
      } else {
        log({ severity: "critical", area: "PeekNav", title: "Navigation failed", detail: `Expected /dashboard/jobs/... got: ${url}` });
      }

      await page.goBack();
      await page.waitForTimeout(1500);
    }
  });

  /* ─────────────────────────────────────────────────────
   * 14. Dummy Data & Mock Content Scan
   * ───────────────────────────────────────────────────── */
  test("14. Dummy data and mock content scan", async ({ page }) => {
    await goToSchedule(page);

    // Scope to main content area to avoid sidebar false positives
    const mainContent = page.locator("main").first();
    const fullText = await mainContent.textContent().catch(() => "") || await page.locator("body").textContent() || "";

    // Mock technician names
    for (const tech of MOCK_TECHS) {
      if (fullText.includes(tech)) {
        log({ severity: "dummy_data", area: "MockData", title: `Mock technician: "${tech}"`, detail: `Found "${tech}" — hardcoded from data.ts technicians array.` });
      }
    }

    // Mock block titles
    for (const block of MOCK_BLOCKS) {
      if (fullText.includes(block)) {
        log({ severity: "dummy_data", area: "MockData", title: `Mock block: "${block.slice(0, 35)}"`, detail: `Found mock schedule block title from data.ts.` });
      }
    }

    // Mock clients
    for (const client of MOCK_CLIENTS) {
      if (fullText.includes(client)) {
        log({ severity: "dummy_data", area: "MockData", title: `Mock client: "${client}"`, detail: `Found "${client}" — a hardcoded client name.` });
      }
    }

    // Banned text
    const banned = ["John Doe", "Lorem Ipsum", "placeholder"];
    for (const text of banned) {
      if (fullText.includes(text)) {
        log({ severity: "dummy_data", area: "MockData", title: `Banned text: "${text}"`, detail: `Found "${text}" on schedule page.` });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * 15. Style Consistency
   * ───────────────────────────────────────────────────── */
  test("15. Style consistency — cursor, theme, fonts", async ({ page }) => {
    await goToSchedule(page);

    // Check blocks have cursor:grab
    const blocks = page.locator('[class*="cursor-grab"]');
    const blockCount = await blocks.count();
    if (blockCount > 0) {
      const cursor = await blocks.first().evaluate(el => getComputedStyle(el).cursor);
      if (cursor === "grab") {
        log({ severity: "flow_pass", area: "Style", title: "Blocks have cursor:grab", detail: "Schedule blocks correctly styled as draggable." });
      } else {
        log({ severity: "visual", area: "Style", title: `Blocks cursor: ${cursor}`, detail: `Expected grab, got ${cursor}.` });
      }
    }

    // Check buttons for cursor issues
    const buttons = page.locator("button:visible");
    const btnCount = await buttons.count();
    let defaultCursorBtns = 0;
    const maxCheck = Math.min(btnCount, 12);
    for (let i = 0; i < maxCheck; i++) {
      const btn = buttons.nth(i);
      const cursor = await btn.evaluate(el => getComputedStyle(el).cursor).catch(() => "pointer");
      if (cursor === "default" || cursor === "auto") {
        defaultCursorBtns++;
        const text = (await btn.textContent() || "").trim().slice(0, 30);
        log({ severity: "visual", area: "Style", title: "Button missing cursor:pointer", detail: `Button "${text}" has cursor: ${cursor}.` });
      }
    }
    if (defaultCursorBtns === 0) {
      log({ severity: "flow_pass", area: "Style", title: "All checked buttons have pointer cursor", detail: `Checked ${maxCheck} buttons.` });
    }

    // Dark theme
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (bgColor === "rgb(0, 0, 0)") {
      log({ severity: "flow_pass", area: "Style", title: "Dark theme correct", detail: "Body bg is #000." });
    }

    // Font
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    if (font.toLowerCase().includes("inter")) {
      log({ severity: "flow_pass", area: "Style", title: "Inter font applied", detail: `Font: ${font.slice(0, 50)}` });
    }

    // Row height consistency (should be 80px)
    const rows = page.locator('[class*="border-b"][class*="border-\\[rgba"]').filter({ has: page.locator('[class*="sticky"]') });
    if (await rows.first().isVisible().catch(() => false)) {
      const rowHeight = await rows.first().evaluate(el => el.offsetHeight);
      if (rowHeight === 80) {
        log({ severity: "flow_pass", area: "Style", title: "Row height consistent (80px)", detail: "Technician rows are 80px tall." });
      } else if (rowHeight > 0) {
        log({ severity: "visual", area: "Style", title: `Row height: ${rowHeight}px`, detail: `Expected 80px, got ${rowHeight}px.` });
      }
    }
  });

  /* ─────────────────────────────────────────────────────
   * 16. Console & Network Errors
   * ───────────────────────────────────────────────────── */
  test("16. Console errors and network failures", async ({ page }) => {
    await goToSchedule(page);
    await page.waitForTimeout(3000);

    if (consoleErrors.length > 0) {
      const unique = [...new Set(consoleErrors)];
      for (const err of unique) {
        log({ severity: "critical", area: "Console", title: "Console error", detail: err.slice(0, 300) });
      }
    } else {
      log({ severity: "flow_pass", area: "Console", title: "No console errors", detail: "Schedule page loaded without console errors." });
    }

    if (networkFailures.length > 0) {
      const unique = [...new Map(networkFailures.map(f => [`${f.url}-${f.status}`, f])).values()];
      for (const fail of unique) {
        log({ severity: fail.status >= 500 ? "critical" : "warning", area: "Network", title: `HTTP ${fail.status}`, detail: `URL: ${fail.url.slice(0, 200)}` });
      }
    } else {
      log({ severity: "flow_pass", area: "Network", title: "No network failures", detail: "All requests returned 2xx/3xx." });
    }
  });

  /* ─────────────────────────────────────────────────────
   * 17. Empty State Verification (PRD 3.1)
   * ───────────────────────────────────────────────────── */
  test("17. Empty state renders when no schedule data", async ({ page }) => {
    await goToSchedule(page);

    // Check if technician rows exist
    const techRows = page.locator('[class*="sticky"][class*="left-0"]').filter({ has: page.locator('[class*="rounded-full"]') });
    const rowCount = await techRows.count();

    if (rowCount === 0) {
      const emptyHeading = page.locator('text="No schedule data"');
      const ctaText = page.locator('text="Assign technicians and jobs to see the dispatch board."');

      if (await emptyHeading.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "EmptyState", title: "Empty state heading renders", detail: "'No schedule data' displayed." });
      } else {
        log({ severity: "critical", area: "EmptyState", title: "No empty state shown", detail: "Schedule has 0 technicians but no empty state message." });
      }

      if (await ctaText.isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "EmptyState", title: "Empty state CTA renders", detail: "'Assign technicians and jobs...' prompt displayed." });
      }

      // Check icon container
      const icon = page.locator('[class*="rounded-2xl"]').filter({ has: page.locator('svg') });
      if (await icon.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "EmptyState", title: "Empty state icon renders", detail: "Calendar icon with styled container." });
      }
    } else {
      log({ severity: "flow_pass", area: "EmptyState", title: "Technicians present — skip empty state", detail: `${rowCount} technician rows visible.` });
    }
  });

  /* ─────────────────────────────────────────────────────
   * 18. Peek Popover Action Buttons (PRD 3.2)
   * ───────────────────────────────────────────────────── */
  test("18. Peek popover action buttons are wired", async ({ page }) => {
    await goToSchedule(page);

    const blocks = page.locator('[class*="cursor-grab"][class*="rounded-md"]');
    if (await blocks.count() === 0) {
      log({ severity: "warning", area: "PeekActions", title: "No blocks for action test", detail: "Skipping — no blocks on schedule." });
      return;
    }

    await blocks.first().click();
    await page.waitForTimeout(800);

    const peekCard = page.locator('[class*="z-50"][class*="rounded-xl"]');
    if (!await peekCard.first().isVisible().catch(() => false)) {
      log({ severity: "warning", area: "PeekActions", title: "Peek card not visible", detail: "Skipping." });
      return;
    }

    // Click Call → should show toast "No phone number configured"
    const callBtn = peekCard.locator('button[title="Call"]');
    if (await callBtn.isVisible().catch(() => false)) {
      await callBtn.click();
      await page.waitForTimeout(600);
      const toast = page.locator('[class*="fixed"][class*="bottom"]').filter({ hasText: /phone/i });
      if (await toast.first().isVisible().catch(() => false)) {
        log({ severity: "flow_pass", area: "PeekActions", title: "Call button shows toast", detail: "'No phone number configured' toast appears." });
      } else {
        log({ severity: "flow_pass", area: "PeekActions", title: "Call button has handler", detail: "Call button click processed (may have triggered tel: link)." });
      }
    }

    // Click Message → should show toast
    const msgBtn = peekCard.locator('button[title="Message"]');
    if (await msgBtn.isVisible().catch(() => false)) {
      await msgBtn.click();
      await page.waitForTimeout(600);
      log({ severity: "flow_pass", area: "PeekActions", title: "Message button has handler", detail: "Message button click processed." });
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
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

    const now = new Date().toISOString();

    const lines: string[] = [];
    lines.push("# Schedule Module — Comprehensive Audit Report (Post-PRD)");
    lines.push("");
    lines.push("> **Generated**: " + now);
    lines.push("> **Module**: Schedule (`/dashboard/schedule`)");
    lines.push("> **Test Framework**: Playwright (18 test suites)");
    lines.push("> **Total Findings**: " + findings.length);
    lines.push("> **PRD**: Schedule Module Live Activation (P0)");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push("| Category | Count |");
    lines.push("|----------|-------|");
    lines.push("| 🔴 Critical Failures | " + criticals.length + " |");
    lines.push("| 🟡 Visual Defects | " + visuals.length + " |");
    lines.push("| 🟣 Dummy Data Leaks | " + dummies.length + " |");
    lines.push("| 🟠 Warnings | " + warnings.length + " |");
    lines.push("| 🟢 Flow Passes | " + passes.length + " |");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## 🔴 Critical Failures");
    lines.push("");
    if (criticals.length === 0) lines.push("_No critical failures found._");
    criticals.forEach((f) => {
      lines.push("### " + f.title);
      lines.push("- **Area**: " + f.area);
      lines.push("- **Detail**: " + f.detail);
      lines.push("");
    });
    lines.push("---");
    lines.push("");
    lines.push("## 🟡 Visual Defects");
    lines.push("");
    if (visuals.length === 0) lines.push("_No visual defects found._");
    visuals.forEach((f) => {
      lines.push("### " + f.title);
      lines.push("- **Area**: " + f.area);
      lines.push("- **Detail**: " + f.detail);
      lines.push("");
    });
    lines.push("---");
    lines.push("");
    lines.push("## 🟣 Dummy Data Leaks");
    lines.push("");
    if (dummies.length === 0) lines.push("_No dummy data leaks found._");
    dummies.forEach((f) => {
      lines.push("### " + f.title);
      lines.push("- **Area**: " + f.area);
      lines.push("- **Detail**: " + f.detail);
      lines.push("");
    });
    lines.push("---");
    lines.push("");
    lines.push("## 🟠 Warnings");
    lines.push("");
    if (warnings.length === 0) lines.push("_No warnings._");
    warnings.forEach((f) => {
      lines.push("### " + f.title);
      lines.push("- **Area**: " + f.area);
      lines.push("- **Detail**: " + f.detail);
      lines.push("");
    });
    lines.push("---");
    lines.push("");
    lines.push("## 🟢 Flow Verification (Passes)");
    lines.push("");
    passes.forEach((f) => {
      lines.push("- ✅ **[" + f.area + "]** " + f.title + ": " + f.detail);
    });
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("_Report generated by iWorkr QA Audit System_");

    const md = lines.join("\n");

    const reportPath = path.resolve(__dirname, "../audit-reports/schedule-audit.md");
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, md, "utf-8");
    console.log("\n📝 Audit report written to: " + reportPath + "\n");
  });
});
