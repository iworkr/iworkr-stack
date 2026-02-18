import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { logger } from "../utils/logger";

export class DashboardPage extends BasePage {
  readonly url = "/dashboard";
  readonly name = "Dashboard";

  constructor(page: Page) {
    super(page);
  }

  // ── Locators ────────────────────────────────────────────

  get heading() {
    return this.page.locator('h1:has-text("Dashboard")');
  }

  get liveIndicator() {
    return this.page.locator('text="Live"');
  }

  get editLayoutButton() {
    return this.page.locator('button:has-text("Edit layout")');
  }

  get widgetGrid() {
    return this.page.locator(".grid").first();
  }

  // ── Actions ─────────────────────────────────────────────

  async openCommandPalette() {
    logger.step("Open command palette (Cmd+K)", this.name);
    await this.page.keyboard.press("Meta+k");
    await this.page.waitForTimeout(800);
    return this.isModalOpen();
  }

  async toggleEditLayout() {
    logger.step("Toggle edit layout mode", this.name);
    return this.clickButton("Edit layout");
  }

  async createJob() {
    logger.step("Quick action: New Job", this.name);
    return this.clickButton("New Job");
  }

  async createInvoice() {
    logger.step("Quick action: New Invoice", this.name);
    return this.clickButton("New Invoice");
  }

  async addClient() {
    logger.step("Quick action: Add Client", this.name);
    return this.clickButton("Add Client");
  }

  // ── Verifications ───────────────────────────────────────

  async expectDashboardLoaded() {
    logger.step("Verify dashboard loaded", this.name);
    await this.page.waitForTimeout(2500);

    const headingVisible = await this.heading.isVisible().catch(() => false);
    if (headingVisible) {
      logger.pass("Dashboard heading visible", this.name);
    } else {
      logger.fail("Dashboard heading NOT visible", this.name);
    }
    return headingVisible;
  }

  async expectLiveIndicator() {
    const visible = await this.liveIndicator.isVisible().catch(() => false);
    if (visible) logger.pass("Live indicator visible", this.name);
    return visible;
  }

  async expectWidgetsRendered(minCount = 4) {
    const widgets = this.page.locator('[class*="rounded-xl"][class*="border"]').filter({
      has: this.page.locator("div"),
    });
    const count = await widgets.count();
    if (count >= minCount) {
      logger.pass(`${count} widgets rendered (min: ${minCount})`, this.name);
    } else {
      logger.warn(`Only ${count} widgets (expected ${minCount}+)`, this.name);
    }
    return count;
  }

  async expectQuickActionsVisible() {
    const actions = ["New Job", "New Invoice", "Add Client", "Broadcast"];
    let found = 0;
    for (const label of actions) {
      const btn = this.page.locator(`text="${label}"`);
      if (await btn.isVisible().catch(() => false)) found++;
    }
    if (found >= 3) {
      logger.pass(`${found}/4 quick actions visible`, this.name);
    } else {
      logger.warn(`Only ${found}/4 quick actions visible`, this.name);
    }
    return found;
  }
}
