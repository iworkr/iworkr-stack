import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { logger } from "../utils/logger";
import { SETTINGS_ROUTES } from "../utils/constants";

export class SettingsPage extends BasePage {
  readonly url = "/settings";
  readonly name = "Settings";

  constructor(page: Page) {
    super(page);
  }

  // ── Locators ────────────────────────────────────────────

  get sidebar() {
    return this.page.locator('nav, [class*="sidebar"], aside').first();
  }

  get saveButton() {
    return this.page.locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]').first();
  }

  // ── Actions ─────────────────────────────────────────────

  async navigateToSection(label: string) {
    logger.step(`Navigate to settings: ${label}`, this.name);
    const link = this.page.locator(`a:has-text("${label}")`).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await this.page.waitForTimeout(1500);
      return true;
    }
    logger.warn(`Settings link "${label}" not found`, this.name);
    return false;
  }

  async fillProfileName(name: string) {
    logger.step(`Fill profile name: ${name}`, this.name);
    const input = this.page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill(name);
      return true;
    }
    return false;
  }

  async saveSettings() {
    logger.step("Save settings", this.name);
    if (await this.saveButton.isVisible().catch(() => false)) {
      await this.saveButton.click();
      await this.page.waitForTimeout(1000);
      return true;
    }
    logger.warn("Save button not found", this.name);
    return false;
  }

  async toggleSwitch(index = 0) {
    logger.step(`Toggle switch #${index}`, this.name);
    const switches = this.page.locator('button[role="switch"], [class*="switch"]');
    if ((await switches.count()) > index) {
      await switches.nth(index).click();
      await this.page.waitForTimeout(500);
      return true;
    }
    return false;
  }

  // ── Verifications ───────────────────────────────────────

  async expectSettingsLoaded() {
    logger.step("Verify settings page loaded", this.name);
    await this.page.waitForTimeout(1500);
    const url = this.page.url();
    if (url.includes("/settings")) {
      logger.pass("Settings page loaded", this.name);
      return true;
    }
    return false;
  }

  async expectSidebarLinksVisible() {
    let found = 0;
    for (const route of SETTINGS_ROUTES) {
      const link = this.page.locator(`a:has-text("${route.label}")`).first();
      if (await link.isVisible().catch(() => false)) found++;
    }
    logger.info(`${found}/${SETTINGS_ROUTES.length} settings sidebar links visible`, this.name);
    return found;
  }

  async auditAllSections(): Promise<{ route: string; ok: boolean; error?: string }[]> {
    const results: { route: string; ok: boolean; error?: string }[] = [];

    for (const route of SETTINGS_ROUTES) {
      logger.step(`Audit settings section: ${route.label}`, this.name);
      await this.page.goto(route.href);
      await this.page.waitForTimeout(2000);

      const body = await this.page.locator("body").textContent().catch(() => "");
      const hasError =
        body?.includes("Internal Server Error") ||
        body?.includes("Application error");

      if (hasError) {
        logger.fail(`Server error on ${route.href}`, this.name);
        results.push({ route: route.href, ok: false, error: "Server error" });
      } else {
        logger.pass(`${route.href} loads OK`, this.name);
        results.push({ route: route.href, ok: true });
      }
    }

    return results;
  }
}
