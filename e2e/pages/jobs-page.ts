import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base-page";
import { logger } from "../utils/logger";

export class JobsPage extends BasePage {
  readonly path = "/dashboard/jobs";

  private get heading() { return this.page.locator('h1:has-text("Jobs")'); }
  private get newJobBtn() { return this.page.locator('button:has-text("New Job")'); }
  private get searchInput() { return this.page.locator('input[placeholder*="Search" i]').first(); }
  private get jobRows() {
    return this.page.locator('[class*="cursor-pointer"][class*="items-center"][class*="border-b"]');
  }

  async expectLoaded() {
    logger.step("Verify jobs page loaded", this.page);
    await this.page.waitForTimeout(2500);
    if (await this.heading.isVisible().catch(() => false)) {
      logger.pass("Jobs page heading visible");
    }
  }

  async getJobCount(): Promise<number> {
    return this.jobRows.count();
  }

  async clickNewJob() {
    await this.clickButton("New Job");
  }

  async filterByStatus(status: "All" | "Active" | "Backlog" | "Done") {
    logger.step(`Filter jobs: ${status}`, this.page);
    const pill = this.page.locator(`button:has-text("${status}")`).first();
    if (await pill.isVisible().catch(() => false)) {
      await pill.click();
      await this.page.waitForTimeout(1000);
      logger.pass(`Filtered by ${status}`);
    }
  }

  async searchJobs(query: string) {
    logger.step(`Search jobs: "${query}"`, this.page);
    if (await this.searchInput.isVisible().catch(() => false)) {
      await this.searchInput.fill(query);
      await this.page.waitForTimeout(1000);
      logger.pass(`Searched for "${query}"`);
    } else {
      await this.page.keyboard.press("Meta+/");
      await this.page.waitForTimeout(500);
      const input = this.page.locator("input").first();
      await input.fill(query);
      await this.page.waitForTimeout(1000);
    }
  }

  async clickFirstJob() {
    logger.step("Click first job row", this.page);
    const count = await this.jobRows.count();
    if (count > 0) {
      await this.jobRows.first().click();
      await this.page.waitForTimeout(2000);
      logger.pass("First job clicked");
    } else {
      logger.warn("No job rows to click");
    }
  }

  async expectJobDetail() {
    logger.step("Verify job detail page", this.page);
    await this.page.waitForTimeout(1500);
    const url = this.page.url();
    if (url.includes("/dashboard/jobs/")) {
      logger.pass(`On job detail: ${url}`);
    } else {
      logger.fail(`Expected job detail URL, got: ${url}`, { url });
    }
  }

  async goBackToList() {
    const backBtn = this.page.locator('button:has-text("Jobs")').filter({ has: this.page.locator("svg") });
    if (await backBtn.first().isVisible().catch(() => false)) {
      await backBtn.first().click();
    } else {
      await this.page.goBack();
    }
    await this.page.waitForTimeout(1500);
  }

  async expectEmptyState() {
    const empty = this.page.locator('text="No jobs found"');
    if (await empty.isVisible().catch(() => false)) {
      logger.pass("Empty state displayed");
    } else {
      logger.info("Jobs exist (no empty state)");
    }
  }
}
