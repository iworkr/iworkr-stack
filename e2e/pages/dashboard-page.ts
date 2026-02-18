import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base-page";
import { logger } from "../utils/logger";

export class DashboardPage extends BasePage {
  readonly path = "/dashboard";

  private get heading() { return this.page.locator('h1:has-text("Dashboard")'); }
  private get liveIndicator() { return this.page.locator('text="Live"'); }
  private get editLayoutBtn() { return this.page.locator('button:has-text("Edit layout")'); }
  private get widgetGrid() { return this.page.locator(".grid").first(); }

  async expectLoaded() {
    logger.step("Verify dashboard loaded", this.page);
    await this.page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15_000 }).catch(() => null);
    await this.page.waitForTimeout(2500);
    await this.expectVisible(this.heading, "Dashboard heading");
    logger.pass("Dashboard loaded");
  }

  async expectLiveIndicator() {
    await this.expectVisible(this.liveIndicator, "Live indicator");
  }

  async expectWidgetGrid() {
    await this.expectVisible(this.widgetGrid, "Widget grid");
  }

  async countWidgets(): Promise<number> {
    const widgets = this.page.locator('[class*="rounded-xl"][class*="border"]').filter({ has: this.page.locator("div") });
    return widgets.count();
  }

  async clickQuickAction(label: string) {
    logger.step(`Click quick action: "${label}"`, this.page);
    const btn = this.page.locator(`text="${label}"`);
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click({ force: true });
      await this.page.waitForTimeout(1000);
      logger.pass(`Quick action "${label}" clicked`);
    } else {
      logger.warn(`Quick action "${label}" not visible`);
    }
  }

  async navigateViaSidebar(label: string, expectedPath: string) {
    logger.step(`Sidebar nav: "${label}"`, this.page);
    const link = this.page.locator(`a:has-text("${label}")`).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await this.page.waitForTimeout(2000);
      const url = this.page.url();
      if (url.includes(expectedPath)) {
        logger.pass(`"${label}" navigated to ${expectedPath}`);
      } else {
        logger.fail(`"${label}" expected ${expectedPath}, got ${url}`, { url });
      }
    } else {
      logger.fail(`Sidebar link "${label}" not visible`, { url: this.page.url() });
    }
  }

  async openCommandPalette() {
    logger.step("Open command palette (Cmd+K)", this.page);
    await this.page.keyboard.press("Meta+k");
    await this.page.waitForTimeout(800);
    const input = this.page.locator('input[type="text"]');
    if (await input.first().isVisible().catch(() => false)) {
      logger.pass("Command palette opened");
    } else {
      logger.warn("Command palette not detected");
    }
  }
}
