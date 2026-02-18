import { type Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { logger } from "../utils/logger";

export class JobsPage extends BasePage {
  readonly url = "/dashboard/jobs";
  readonly name = "Jobs";

  constructor(page: Page) {
    super(page);
  }

  // ── Locators ────────────────────────────────────────────

  get heading() {
    return this.page.locator('h1:has-text("Jobs")');
  }

  get newJobButton() {
    return this.page.locator('button:has-text("New Job")');
  }

  get searchInput() {
    return this.page.locator('input[placeholder*="Search" i], input[placeholder*="Filter" i]').first();
  }

  get jobRows() {
    return this.page.locator('[class*="cursor-pointer"][class*="items-center"][class*="border-b"]');
  }

  get emptyState() {
    return this.page.locator('text="No jobs found"');
  }

  // ── Actions ─────────────────────────────────────────────

  async clickNewJob() {
    logger.step("Click New Job", this.name);
    await this.newJobButton.click();
    await this.page.waitForTimeout(1000);
  }

  async searchJobs(query: string) {
    logger.step(`Search jobs: "${query}"`, this.name);
    const input = this.searchInput;
    if (await input.isVisible().catch(() => false)) {
      await input.fill(query);
      await this.page.waitForTimeout(800);
    } else {
      await this.page.keyboard.press("Meta+/");
      await this.page.waitForTimeout(500);
      const inputAfter = this.searchInput;
      if (await inputAfter.isVisible().catch(() => false)) {
        await inputAfter.fill(query);
        await this.page.waitForTimeout(800);
      }
    }
  }

  async clearSearch() {
    const input = this.searchInput;
    if (await input.isVisible().catch(() => false)) {
      await input.fill("");
      await this.page.waitForTimeout(500);
    }
  }

  async clickFirstJob() {
    logger.step("Click first job row", this.name);
    const rows = this.jobRows;
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await this.page.waitForTimeout(2000);
      return true;
    }
    logger.warn("No job rows to click", this.name);
    return false;
  }

  async clickJobByIndex(index: number) {
    logger.step(`Click job row #${index}`, this.name);
    const rows = this.jobRows;
    if ((await rows.count()) > index) {
      await rows.nth(index).click();
      await this.page.waitForTimeout(2000);
      return true;
    }
    return false;
  }

  async filterByStatus(status: string) {
    logger.step(`Filter by status: ${status}`, this.name);
    const pill = this.page.locator(`button:has-text("${status}")`).first();
    if (await pill.isVisible().catch(() => false)) {
      await pill.click();
      await this.page.waitForTimeout(600);
      return true;
    }
    return false;
  }

  async rightClickFirstJob() {
    logger.step("Right-click first job row", this.name);
    const rows = this.jobRows;
    if ((await rows.count()) > 0) {
      await rows.first().click({ button: "right" });
      await this.page.waitForTimeout(600);
      return true;
    }
    return false;
  }

  async deleteFirstJob() {
    logger.step("Delete first job via context menu", this.name);
    const opened = await this.rightClickFirstJob();
    if (!opened) return false;
    return this.clickText("Delete");
  }

  // ── Verifications ───────────────────────────────────────

  async expectJobsLoaded() {
    logger.step("Verify jobs page loaded", this.name);
    await this.page.waitForTimeout(2000);
    const headingVisible = await this.heading.isVisible().catch(() => false);
    if (headingVisible) logger.pass("Jobs heading visible", this.name);
    return headingVisible;
  }

  async getJobCount() {
    const count = await this.jobRows.count();
    logger.info(`Job row count: ${count}`, this.name);
    return count;
  }

  async expectEmptyState() {
    const visible = await this.emptyState.isVisible().catch(() => false);
    if (visible) {
      logger.pass("Empty state rendered", this.name);
    }
    return visible;
  }

  // ── Job Detail (after click) ────────────────────────────

  async expectOnJobDetail() {
    const url = this.page.url();
    const onDetail = url.includes("/dashboard/jobs/") && !url.endsWith("/jobs");
    if (onDetail) {
      logger.pass(`On job detail: ${url}`, this.name);
    } else {
      logger.fail(`Not on job detail: ${url}`, this.name);
    }
    return onDetail;
  }

  async changeStatus(newStatus: string) {
    logger.step(`Change status to: ${newStatus}`, this.name);
    const statusPill = this.page
      .locator("button")
      .filter({ hasText: /Backlog|Todo|In Progress|Done|Cancelled/i })
      .filter({ has: this.page.locator("svg") });

    if (await statusPill.first().isVisible().catch(() => false)) {
      await statusPill.first().click();
      await this.page.waitForTimeout(600);

      const option = this.page.locator('[class*="rounded"]').filter({ hasText: newStatus });
      if (await option.first().isVisible().catch(() => false)) {
        await option.first().click();
        await this.page.waitForTimeout(800);
        logger.pass(`Status changed to ${newStatus}`, this.name);
        return true;
      }
    }
    logger.warn("Could not change status", this.name);
    return false;
  }

  async completeJob() {
    logger.step("Click Complete Job", this.name);
    return this.clickButton("Complete Job");
  }
}
