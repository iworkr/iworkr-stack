import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { logger } from "../utils/logger";

export class LoginPage extends BasePage {
  readonly url = "/auth";
  readonly name = "Login";

  constructor(page: Page) {
    super(page);
  }

  // ── Locators ────────────────────────────────────────────

  get emailInput() {
    return this.page.locator('input[type="email"], input[placeholder*="email" i]').first();
  }

  get googleButton() {
    return this.page.locator('button:has-text("Google")');
  }

  get emailMethodCard() {
    return this.page.locator('text="Email"').first();
  }

  get submitButton() {
    return this.page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")').first();
  }

  get magicLinkSentState() {
    return this.page.locator('text=/check your|magic link|sent/i');
  }

  // ── Actions ─────────────────────────────────────────────

  async selectEmailMethod() {
    logger.step("Select email auth method", this.name);
    const emailCard = this.page.locator('button, div').filter({ hasText: /email/i }).first();
    if (await emailCard.isVisible().catch(() => false)) {
      await emailCard.click();
      await this.page.waitForTimeout(800);
    }
  }

  async enterEmail(email: string) {
    logger.step(`Enter email: ${email}`, this.name);
    const input = this.emailInput;
    if (await input.isVisible().catch(() => false)) {
      await input.fill(email);
      await this.page.waitForTimeout(300);
    } else {
      logger.warn("Email input not found", this.name);
    }
  }

  async submitEmail() {
    logger.step("Submit email form", this.name);
    const btn = this.submitButton;
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await this.page.waitForTimeout(1500);
    }
  }

  async tapGoogleSignIn() {
    logger.step("Tap Google sign-in", this.name);
    if (await this.googleButton.isVisible().catch(() => false)) {
      await this.googleButton.click();
      await this.page.waitForTimeout(1500);
    }
  }

  // ── Verifications ───────────────────────────────────────

  async expectLoginPageVisible() {
    logger.step("Verify login page visible", this.name);
    await this.page.waitForTimeout(2000);
    const url = this.page.url();
    if (url.includes("/auth")) {
      logger.pass("Login page loaded", this.name);
      return true;
    }
    logger.warn(`Expected /auth but got ${url}`, this.name);
    return false;
  }

  async expectGoogleButtonVisible() {
    const visible = await this.googleButton.isVisible().catch(() => false);
    if (visible) {
      logger.pass("Google sign-in button visible", this.name);
    } else {
      logger.fail("Google sign-in button NOT visible", this.name);
    }
    return visible;
  }

  async expectMagicLinkSent() {
    logger.step("Verify magic link sent state", this.name);
    const visible = await this.magicLinkSentState.isVisible().catch(() => false);
    if (visible) {
      logger.pass("Magic link sent confirmation visible", this.name);
    } else {
      logger.warn("Magic link sent state not detected", this.name);
    }
    return visible;
  }

  // ── Full Flows ──────────────────────────────────────────

  async sendMagicLink(email: string) {
    logger.info(`Full magic link flow for: ${email}`, this.name);
    await this.goto();
    await this.expectLoginPageVisible();
    await this.selectEmailMethod();
    await this.enterEmail(email);
    await this.submitEmail();
  }
}
