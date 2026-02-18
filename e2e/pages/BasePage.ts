import { type Page, type Locator, expect } from "@playwright/test";
import { logger } from "../utils/logger";

export abstract class BasePage {
  readonly page: Page;
  abstract readonly url: string;
  abstract readonly name: string;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ──────────────────────────────────────────

  async goto() {
    logger.step(`Navigate to ${this.name}`, this.name);
    await this.page.goto(this.url);
    await this.page.waitForTimeout(1500);
  }

  async waitForLoad(timeout = 10_000) {
    await this.page.waitForLoadState("domcontentloaded", { timeout });
    await this.page.waitForTimeout(500);
  }

  async verifyUrl(expected?: string) {
    const target = expected ?? this.url;
    const current = this.page.url();
    if (current.includes(target)) {
      logger.pass(`URL contains "${target}"`, this.name);
    } else {
      logger.fail(`Expected URL "${target}" but got "${current}"`, this.name);
    }
    return current.includes(target);
  }

  async goBack() {
    logger.step("Navigate back", this.name);
    await this.page.goBack();
    await this.page.waitForTimeout(1000);
  }

  // ── Interactions ────────────────────────────────────────

  async clickButton(text: string) {
    logger.step(`Click button: "${text}"`, this.name);
    const btn = this.page.locator(`button:has-text("${text}")`);
    if ((await btn.count()) === 0) {
      logger.actionFailed(`click button "${text}"`, `button:has-text("${text}")`, this.page.url());
      return false;
    }
    await btn.first().click();
    await this.page.waitForTimeout(600);
    return true;
  }

  async clickLink(text: string) {
    logger.step(`Click link: "${text}"`, this.name);
    const link = this.page.locator(`a:has-text("${text}")`);
    if ((await link.count()) === 0) {
      logger.actionFailed(`click link "${text}"`, `a:has-text("${text}")`, this.page.url());
      return false;
    }
    await link.first().click();
    await this.page.waitForTimeout(800);
    return true;
  }

  async clickText(text: string) {
    logger.step(`Click text: "${text}"`, this.name);
    const el = this.page.locator(`text="${text}"`);
    if ((await el.count()) === 0) {
      logger.actionFailed(`click "${text}"`, `text="${text}"`, this.page.url());
      return false;
    }
    await el.first().click();
    await this.page.waitForTimeout(600);
    return true;
  }

  async fillInput(selector: string, value: string) {
    logger.step(`Fill input: ${selector} = "${value}"`, this.name);
    await this.page.locator(selector).first().fill(value);
    await this.page.waitForTimeout(300);
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(400);
  }

  async pressEscape() {
    await this.pressKey("Escape");
  }

  // ── Assertions ──────────────────────────────────────────

  async expectVisible(text: string) {
    const el = this.page.locator(`text="${text}"`);
    const visible = await el.first().isVisible().catch(() => false);
    if (visible) {
      logger.pass(`"${text}" is visible`, this.name);
    } else {
      logger.fail(`"${text}" is NOT visible`, this.name);
    }
    return visible;
  }

  async expectHeading(text: string) {
    const heading = this.page.locator(`h1:has-text("${text}"), h2:has-text("${text}")`);
    const visible = await heading.first().isVisible().catch(() => false);
    if (visible) {
      logger.pass(`Heading "${text}" visible`, this.name);
    } else {
      logger.fail(`Heading "${text}" NOT visible`, this.name);
    }
    return visible;
  }

  async expectNoServerError() {
    const body = await this.page.locator("body").textContent().catch(() => "");
    const hasError =
      body?.includes("Internal Server Error") ||
      body?.includes("Application error") ||
      body?.includes("500");
    if (!hasError) {
      logger.pass("No server error on page", this.name);
    } else {
      logger.fail("Server error detected on page!", this.name);
    }
    return !hasError;
  }

  async expectNoConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    return errors;
  }

  // ── Sidebar Navigation ─────────────────────────────────

  async navigateViaSidebar(label: string) {
    logger.step(`Sidebar nav: "${label}"`, this.name);
    const link = this.page.locator(`a:has-text("${label}")`).first();
    if ((await link.count()) === 0) {
      logger.warn(`Sidebar link "${label}" not found`, this.name);
      return false;
    }
    await link.click();
    await this.page.waitForTimeout(1500);
    return true;
  }

  // ── Modal Handling ─────────────────────────────────────

  async isModalOpen(): Promise<boolean> {
    const modal = this.page.locator('[class*="fixed"][class*="z-50"]');
    return (await modal.first().isVisible().catch(() => false));
  }

  async dismissModal() {
    for (let i = 0; i < 3; i++) {
      await this.pressEscape();
    }
  }

  // ── Screenshot ─────────────────────────────────────────

  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `playwright-report/screenshots/${name}.png`,
      fullPage: true,
    });
    logger.info(`Screenshot: ${name}`, this.name);
  }
}
