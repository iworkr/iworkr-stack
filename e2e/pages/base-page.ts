import { type Page, type Locator, expect } from "@playwright/test";
import { logger } from "../utils/logger";

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  abstract readonly path: string;

  async goto() {
    logger.step(`Navigate to ${this.path}`, this.page);
    await this.page.goto(this.path);
    await this.page.waitForTimeout(1500);
  }

  async waitForLoad(timeout = 10_000) {
    await this.page.waitForLoadState("networkidle", { timeout });
  }

  async verifyUrl(expected: string) {
    const url = this.page.url();
    if (url.includes(expected)) {
      logger.pass(`URL contains "${expected}"`);
    } else {
      logger.fail(`URL mismatch: expected "${expected}", got "${url}"`, { url });
    }
    expect(url).toContain(expected);
  }

  async clickButton(text: string) {
    logger.step(`Click button: "${text}"`, this.page);
    const btn = this.page.locator(`button:has-text("${text}")`);
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click();
      await this.page.waitForTimeout(500);
      logger.pass(`Clicked "${text}"`);
    } else {
      logger.clickFail(text, this.constructor.name, this.page.url());
      throw new Error(`Button "${text}" not found on ${this.page.url()}`);
    }
  }

  async clickLink(text: string) {
    logger.step(`Click link: "${text}"`, this.page);
    const link = this.page.locator(`a:has-text("${text}")`).first();
    await link.click();
    await this.page.waitForTimeout(1000);
  }

  async expectVisible(locator: Locator, label?: string) {
    await expect(locator.first()).toBeVisible({ timeout: 8_000 });
    if (label) logger.pass(`Visible: ${label}`);
  }

  async expectText(text: string) {
    const el = this.page.locator(`text="${text}"`);
    await expect(el.first()).toBeVisible({ timeout: 5_000 });
    logger.pass(`Text visible: "${text}"`);
  }

  async expectNoServerError() {
    const body = await this.page.locator("body").textContent() || "";
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
    logger.pass("No server errors on page");
  }

  async fillInput(placeholder: string, value: string) {
    logger.step(`Fill input "${placeholder}" with "${value}"`, this.page);
    const input = this.page.locator(`input[placeholder*="${placeholder}"]`).first();
    await input.fill(value);
    await this.page.waitForTimeout(300);
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(400);
  }

  async dismissModals() {
    for (let i = 0; i < 3; i++) {
      await this.page.keyboard.press("Escape");
      await this.page.waitForTimeout(300);
    }
  }

  async getConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    return errors;
  }

  async checkNoNetworkFailures() {
    const failures: { url: string; status: number }[] = [];
    this.page.on("response", (resp) => {
      if (resp.status() >= 500) {
        failures.push({ url: resp.url(), status: resp.status() });
      }
    });
    return failures;
  }
}
