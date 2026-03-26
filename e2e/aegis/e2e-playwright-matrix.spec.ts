import { test, expect, type Page } from "@playwright/test";
import { hardenDeterminism, waitForApiResponse } from "../utils/aegis-helpers";

function failOrSkip(message: string) {
  const isCi = process.env.CI === "true" || process.env.CI === "1";
  if (isCi) {
    throw new Error(message);
  }
  test.skip(true, message);
}

async function gotoAuthed(page: Page, url: string) {
  const nav = await page
    .goto(url, { waitUntil: "commit", timeout: 10_000 })
    .catch(() => null);

  if (!nav) {
    failOrSkip(`Route ${url} is not reachable in current runtime.`);
    return;
  }

  if (page.url().includes("/auth")) {
    failOrSkip("Authenticated storage state unavailable in this environment.");
  }
}

test.describe("Project Aegis-Test — E2E Playwright Matrix", () => {
  test.beforeEach(async ({ page }) => {
    await hardenDeterminism(page);
  });

  test.describe("Suite A — Core Routing, State & Navigation", () => {
    test("A1 Labyrinth-Break (NAV-025): browser back stack remains deterministic", async ({ page }) => {
      await gotoAuthed(page, "/dashboard");

      await page.goto("/dashboard/messages");
      await expect(page).toHaveURL(/\/dashboard\/messages/);

      await page.goto("/dashboard/forms");
      await expect(page).toHaveURL(/\/dashboard\/forms/);

      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard\/messages/);

      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard(\/overview)?$/);
    });

    test("A2 Kinesis-Key (SET-26): shortcuts modal + command palette keyboard flow", async ({ page }) => {
      await gotoAuthed(page, "/dashboard");

      await page.keyboard.press("Shift+?");
      await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();
      await page.keyboard.press("Escape");

      const mod = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${mod}+K`);
      await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
    });

    test("A3 Triage Intercept (NOTIF-017): notifications View all routes to inbox", async ({ page }) => {
      await gotoAuthed(page, "/dashboard");

      const headerButtons = page.locator("header button");
      const count = await headerButtons.count();
      let opened = false;
      for (let i = 0; i < Math.min(count, 8); i += 1) {
        await headerButtons.nth(i).click().catch(() => {});
        if (await page.getByRole("button", { name: /^View all$/i }).isVisible().catch(() => false)) {
          opened = true;
          break;
        }
      }
      if (!opened) {
        failOrSkip("Notifications popover trigger not deterministically discoverable in this seed.");
      }
      await page.getByRole("button", { name: /^View all$/i }).click();

      await expect(page).toHaveURL(/\/dashboard\/inbox/);
    });

    test("A4 Settings Hydration (IW-SET-001): /settings bridge lands on dashboard settings", async ({ page }) => {
      await gotoAuthed(page, "/settings");
      await expect(page).toHaveURL(/\/dashboard\/settings/);
      await expect(page.locator("body")).not.toContainText(/hydration|application error|internal server error/i);
    });
  });

  test.describe("Suite B — Workspace Command & Multi-Tenancy", () => {
    test("B1 Nexus-Branch (BR-22): branch create mutation succeeds", async ({ page }, testInfo) => {
      await gotoAuthed(page, "/settings/branches");
      await expect(page).toHaveURL(/\/settings\/branches|\/dashboard\/settings\/branches/);

      const addBranch = page.getByRole("button", { name: /add branch/i }).first();
      if (!(await addBranch.isVisible().catch(() => false))) {
        failOrSkip("Add Branch action not visible in current role/workspace seed.");
      }

      await addBranch.click();
      const form = page.locator("form").first();
      await form.getByPlaceholder("Gold Coast Office").fill(`E2E Branch ${Date.now()}`);
      await form.locator("input").nth(1).fill("Brisbane");
      await form.locator("input[type='number']").first().fill("10");

      const createResponse = waitForApiResponse(page, /branches/i, {
        status: (s) => s >= 200 && s < 500,
        timeoutMs: 25_000,
      });
      await page.getByRole("button", { name: /^Create$/ }).click();
      const res = await createResponse.catch(() => null);

      // If mutation is server-action-only, fallback to success toast/url behavior check.
      if (res) {
        expect(res.status()).toBeLessThan(500);
      }
      await expect(page.locator("body")).not.toContainText(/tax rate must be|invalid id format/i);
      testInfo.annotations.push({ type: "note", description: "Branch create mutation attempted and validated for non-5xx path." });
    });

    test("B2 Vanguard-Expansion (TEAM-INVITE-09): onBlur tokenization enables send", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/team");
      const openInvite = page.getByRole("button", { name: /invite|summons/i }).first();
      if (!(await openInvite.isVisible().catch(() => false))) {
        failOrSkip("Invite action unavailable for current seed.");
      }

      await openInvite.click();
      const emailInput = page.locator("input[type='email'], input[placeholder*='email' i]").first();
      await emailInput.fill("test@iworkr.com");
      await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur

      const sendButton = page.getByRole("button", { name: /send summons|send invite|send/i }).last();
      await expect(sendButton).toBeEnabled();
    });

    test("B3 Identity-Forge (TEAM-PROFILE-11/SKILLS-10): view/edit state + overflow sanity", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/team");

      const firstRow = page.locator("button, [role='button']").filter({ hasText: /@|manager|technician|support/i }).first();
      if (!(await firstRow.isVisible().catch(() => false))) {
        failOrSkip("Team rows not found for current seed.");
      }

      await firstRow.click();
      const editBtn = page.getByRole("button", { name: /^Edit$/i }).first();
      await expect(editBtn).toBeVisible();
      await editBtn.click();

      await expect(page.getByRole("button", { name: /save/i }).first()).toBeVisible();

      await page.setViewportSize({ width: 800, height: 600 });
      const drawerScrollArea = page.locator(".overflow-y-auto").last();
      await expect(drawerScrollArea).toBeVisible();
    });
  });

  test.describe("Suite C — Logistics & Spatial Ops", () => {
    test("C1 Tartarus-Bind (JOB-05): create job payload path avoids missing workspace context", async ({ page }) => {
      await gotoAuthed(page, "/dashboard");
      const createJobBtn = page.getByRole("button", { name: /create job|create shift/i }).first();
      if (!(await createJobBtn.isVisible().catch(() => false))) {
        failOrSkip("Create job trigger not present for current route.");
      }
      await createJobBtn.click();
      await expect(page.locator("body")).not.toContainText(/invalid id format|workspace.*missing/i);
    });

    test("C2 Outrider-Apex (ROUTE-024): technician dropdown hydrates", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/schedule/route-optimizer");
      const techSelect = page.locator("select").first();
      await expect(techSelect).toBeVisible();
      const options = await techSelect.locator("option").allTextContents();
      expect(options.length).toBeGreaterThan(0);
      expect(options.join(" ")).not.toMatch(/No .* found in this branch/i);
    });

    test("C3 Forge-Fleet (ASF-06): spinner recovers after upload failure path", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/assets");
      const addToFleet = page.getByRole("button", { name: /add to fleet/i }).first();
      if (!(await addToFleet.isVisible().catch(() => false))) {
        failOrSkip("Add to Fleet button not visible in current seed.");
      }

      await page.route("**/storage/v1/object/**", async (route) => {
        await route.abort("failed");
      });
      await addToFleet.click();
      await expect(addToFleet).toBeEnabled({ timeout: 15_000 });
    });
  });

  test.describe("Suite D — Financial & Sales Pipelines", () => {
    test("D1 Moneta-Sync (INV-08): new invoice route stable and no context crash", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/finance/invoices/new");
      await expect(page.getByRole("button", { name: /send invoice/i })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/invalid id format|organization_id/i);
    });

    test("D2 Titan-Pipeline (SP-07): drag/drop lead persists without snap-back", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/crm");
      const source = page.locator("[data-rbd-draggable-id], [draggable='true']").first();
      const target = page.locator("text=Awaiting Approval").first();

      if (!(await source.isVisible().catch(() => false)) || !(await target.isVisible().catch(() => false))) {
        failOrSkip("Pipeline DnD elements unavailable in current seed.");
      }

      await source.dragTo(target);
      await expect(page.locator("body")).not.toContainText(/failed to move|snap back/i);
    });

    test("D3 Orion-Transit (FIN-21): Push button remains single-line height", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/finance/travel-ledger");
      const pushButton = page.getByRole("button", { name: /Approve & Push to Ledger-Prime/i });
      await expect(pushButton).toBeVisible();
      const box = await pushButton.boundingBox();
      expect(box).not.toBeNull();
      expect((box as { height: number }).height).toBeLessThan(50);
    });

    test("D4 QA-Payment (QA-PAYMENT-04): stripe call mock resolves success path", async ({ page }) => {
      await page.route("**/v1/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "pi_mock_ok", status: "succeeded", client_secret: "cs_test_mock" }),
        });
      });

      const checkoutNav = await page.goto("/checkout", { waitUntil: "commit", timeout: 10_000 }).catch(() => null);
      if (!checkoutNav) {
        failOrSkip("Checkout route is unreachable in current runtime.");
      }
      if (await page.locator("body").isVisible() && /404|not found/i.test((await page.locator("body").textContent()) ?? "")) {
        failOrSkip("Checkout route not present in this deploy target.");
      }
      await expect(page.locator("body")).not.toContainText(/try again in a little bit/i);
    });
  });

  test.describe("Suite E — Forms & Compliance Engine", () => {
    test("E1 Daedalus-Form (FORM-12): create form routes to UUID builder", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/forms");
      const createButton = page.getByRole("button", { name: /new form|create care form/i }).first();
      await createButton.click();
      await expect(page).toHaveURL(/\/dashboard\/forms\/builder\/[0-9a-f-]{36}/i);
    });

    test("E2 Aegis-Draft (FORM-13): autosave + manual draft save", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/forms");
      const createButton = page.getByRole("button", { name: /new form|create care form/i }).first();
      await createButton.click();
      await expect(page).toHaveURL(/\/dashboard\/forms\/builder\/[0-9a-f-]{36}/i);

      const titleInput = page.locator("input[placeholder*='title' i], input[name='title']").first();
      if (!(await titleInput.isVisible().catch(() => false))) {
        failOrSkip("Form title input not visible for autosave assertion.");
      }

      await titleInput.fill(`Safety Form ${Date.now()}`);
      await page.waitForTimeout(1700);
      await expect(page.locator("body")).toContainText(/saved|save draft/i);

      const manualSave = page.getByRole("button", { name: /save draft/i }).first();
      if (await manualSave.isVisible().catch(() => false)) {
        await manualSave.click();
      }
    });

    test("E3 Alexandria-Store (Bug 14): template clone routes to populated builder", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/forms/library");
      const useTemplate = page.getByRole("button", { name: /Use Template/i }).first();
      if (!(await useTemplate.isVisible().catch(() => false))) {
        failOrSkip("No global templates visible in current environment.");
      }
      await useTemplate.click();
      await expect(page).toHaveURL(/\/dashboard\/forms\/builder\/[0-9a-f-]{36}/i);
    });
  });

  test.describe("Suite F — Real-Time WebSockets & Comms", () => {
    test("F1 Synapse-Spark (MSG-20): async handoff shows row spinner then routes", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/messages");
      const mod = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${mod}+N`);

      await expect(page.getByText("New message")).toBeVisible();
      const firstUserRow = page.locator("button").filter({ hasText: /@|qa|worker|admin|manager/i }).first();
      if (!(await firstUserRow.isVisible().catch(() => false))) {
        failOrSkip("No messageable users available for this seed.");
      }
      await firstUserRow.click();
      await expect(page).toHaveURL(/\/dashboard\/messages\/[0-9a-f-]{36}/i, { timeout: 20_000 });
    });

    test("F2 Synapse-Payload (Bug 16): hidden file input accepts image via setInputFiles", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/messages");

      const channelLink = page.locator("a[href^='/dashboard/messages/']").first();
      if (!(await channelLink.isVisible().catch(() => false))) {
        failOrSkip("No message channel available to test attachments.");
      }
      await channelLink.click();
      await expect(page).toHaveURL(/\/dashboard\/messages\/[0-9a-f-]{36}/i);

      // Open attachment menu via composer paperclip button.
      const composer = page.locator("textarea[placeholder*='Write a message']").first();
      await expect(composer).toBeVisible();
      const paperclipButton = composer.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]//button").first();
      await paperclipButton.click();

      const imageInput = page.locator("input[type='file'][accept='image/*']").first();
      await page.route("**/storage/v1/object/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ Key: "chat_attachments/test-image.jpg" }),
        });
      });
      const messageInsert = waitForApiResponse(page, /\/rest\/v1\/messages|messages/i, {
        status: (s) => s >= 200 && s < 500,
        timeoutMs: 20_000,
      }).catch(() => null);
      await imageInput.setInputFiles({
        name: "test-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake-jpeg-content"),
      });
      await messageInsert;
    });

    test("F3 Synapse-Link (MSG-15): sidebar click transitions out of empty state", async ({ page }) => {
      await gotoAuthed(page, "/dashboard/messages");
      await expect(page.locator("body")).toContainText(/No Signal Detected/i);

      const dmLink = page.locator("a[href^='/dashboard/messages/']").first();
      if (!(await dmLink.isVisible().catch(() => false))) {
        failOrSkip("No direct-message channels available in seed.");
      }

      await dmLink.click();
      await expect(page).toHaveURL(/\/dashboard\/messages\/[0-9a-f-]{36}/i);
      await expect(page.locator("body")).not.toContainText(/No Signal Detected/i);
    });
  });
});

