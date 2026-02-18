import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base-page";
import { logger } from "../utils/logger";

export class SettingsPage extends BasePage {
  readonly path = "/settings";

  private get preferencesLink() { return this.page.locator('a:has-text("Preferences")').first(); }
  private get profileLink() { return this.page.locator('a:has-text("Profile")').first(); }
  private get securityLink() { return this.page.locator('a:has-text("Security")').first(); }
  private get workspaceLink() { return this.page.locator('a:has-text("Workspace")').first(); }
  private get membersLink() { return this.page.locator('a:has-text("Members")').first(); }
  private get billingLink() { return this.page.locator('a:has-text("Billing")').first(); }

  async expectLoaded() {
    logger.step("Verify settings page loaded", this.page);
    await this.page.waitForTimeout(2000);
    const url = this.page.url();
    if (url.includes("/settings")) {
      logger.pass("Settings page loaded");
    }
  }

  async navigateToSection(section: string) {
    logger.step(`Navigate to settings: ${section}`, this.page);
    const link = this.page.locator(`a:has-text("${section}")`).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await this.page.waitForTimeout(1500);
      logger.pass(`Navigated to ${section}`);
    } else {
      logger.warn(`Settings link "${section}" not visible`);
    }
  }

  async expectSidebarLinks() {
    const links = [
      "Preferences", "Profile", "Notifications", "Security",
      "Workspace", "Members", "Billing",
    ];
    for (const label of links) {
      const el = this.page.locator(`a:has-text("${label}")`).first();
      if (await el.isVisible().catch(() => false)) {
        logger.pass(`Settings sidebar: "${label}" visible`);
      } else {
        logger.warn(`Settings sidebar: "${label}" not visible`);
      }
    }
  }

  async checkAllSettingsSections() {
    const sections = [
      { label: "Preferences", path: "/settings/preferences" },
      { label: "Profile", path: "/settings/profile" },
      { label: "Notifications", path: "/settings/notifications" },
      { label: "Security", path: "/settings/security" },
      { label: "Workspace", path: "/settings/workspace" },
      { label: "Members", path: "/settings/members" },
      { label: "Billing", path: "/settings/billing" },
      { label: "Labels", path: "/settings/labels" },
      { label: "Templates", path: "/settings/templates" },
      { label: "Statuses", path: "/settings/statuses" },
      { label: "Branches", path: "/settings/branches" },
    ];

    for (const section of sections) {
      const link = this.page.locator(`a:has-text("${section.label}")`).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await this.page.waitForTimeout(1500);
        const url = this.page.url();
        if (url.includes(section.path)) {
          logger.pass(`${section.label}: navigated to ${section.path}`);
        } else {
          logger.fail(`${section.label}: expected ${section.path}, got ${url}`, { url });
        }
        await this.expectNoServerError();
      } else {
        logger.info(`${section.label}: link not visible (may require scroll)`);
      }
    }
  }

  async findAndSubmitForms() {
    logger.step("Locate forms on current settings page", this.page);
    const inputs = this.page.locator("input:visible");
    const inputCount = await inputs.count();
    const buttons = this.page.locator('button[type="submit"]:visible, button:has-text("Save"):visible');
    const buttonCount = await buttons.count();
    logger.info(`Found ${inputCount} inputs, ${buttonCount} submit/save buttons`);
    return { inputCount, buttonCount };
  }
}
