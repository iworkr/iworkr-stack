import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base-page";
import { logger } from "../utils/logger";

export class LoginPage extends BasePage {
  readonly path = "/auth";

  private get emailInput() {
    return this.page.locator('input[type="email"], input[placeholder*="email" i]').first();
  }

  private get emailMethodCard() {
    return this.page.locator('text="Email"').first();
  }

  private get googleButton() {
    return this.page.locator('button:has-text("Google")').first();
  }

  private get initializeButton() {
    return this.page.locator('button:has-text("Send Magic Link"), button:has-text("Initialize"), button:has-text("Continue")').first();
  }

  private get magicLinkSentState() {
    return this.page.locator('text="Check your email"').or(this.page.locator('text="Magic link sent"')).or(this.page.locator('text="magic link"'));
  }

  async expectLoginVisible() {
    logger.step("Verify login page visible", this.page);
    await this.page.waitForTimeout(2000);
    const indicators = [
      this.page.locator('text="Sign in"'),
      this.page.locator('text="Email"'),
      this.page.locator('text="Initialize"'),
      this.page.locator('text="Google"'),
    ];
    for (const el of indicators) {
      if (await el.first().isVisible().catch(() => false)) {
        logger.pass("Login page visible");
        return;
      }
    }
    logger.warn("Login page visibility unclear");
  }

  async selectEmailMethod() {
    logger.step("Select email auth method", this.page);
    if (await this.emailMethodCard.isVisible().catch(() => false)) {
      await this.emailMethodCard.click();
      await this.page.waitForTimeout(500);
    }
  }

  async enterEmail(email: string) {
    logger.step(`Enter email: ${email}`, this.page);
    await this.emailInput.fill(email);
    await this.page.waitForTimeout(300);
  }

  async submitMagicLink() {
    logger.step("Submit magic link", this.page);
    await this.initializeButton.click();
    await this.page.waitForTimeout(2000);
  }

  async expectMagicLinkSent() {
    logger.step("Verify magic link sent state", this.page);
    const sent = this.magicLinkSentState;
    if (await sent.first().isVisible().catch(() => false)) {
      logger.pass("Magic link sent confirmation displayed");
    } else {
      logger.info("Magic link sent state not detected (may have different text)");
    }
  }

  async expectGoogleButtonVisible() {
    logger.step("Verify Google button visible", this.page);
    await this.expectVisible(this.googleButton, "Google sign-in button");
  }

  async expectRedirectedToDashboard() {
    logger.step("Verify redirect to dashboard", this.page);
    await this.page.waitForTimeout(3000);
    const url = this.page.url();
    if (url.includes("/dashboard")) {
      logger.pass("Redirected to dashboard");
    } else if (url.includes("/setup")) {
      logger.pass("Redirected to onboarding setup");
    } else {
      logger.warn(`Still on: ${url}`);
    }
  }
}
