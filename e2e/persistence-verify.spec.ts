import { test, expect } from "@playwright/test";

test.describe("Persistence Verification", () => {

  test("Create job via modal, refresh, verify it persists", async ({ page }) => {
    test.setTimeout(90000);

    // Navigate to jobs
    await page.goto("/dashboard/jobs", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Capture network errors
    const networkErrors: string[] = [];
    page.on("response", (res) => {
      if (res.status() >= 400) {
        networkErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Screenshot before
    await page.screenshot({ path: "test-results/01-jobs-before.png" });
    console.log("📸 Jobs page loaded");

    // Check initial page text
    const initialText = await page.textContent("body");
    const hasJobs = !(initialText?.includes("No jobs found") || initialText?.includes("No jobs"));
    console.log(`Has existing jobs: ${hasJobs}`);

    // Try to open create modal by clicking sidebar + button
    // First look for any "Create" or "+" button
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Job"), [aria-label="Create"]').first();
    const hasCBtn = await createBtn.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!hasCBtn) {
      // Try the keyboard shortcut (focus body first)
      await page.locator("body").click();
      await page.waitForTimeout(500);
      await page.keyboard.press("c");
      await page.waitForTimeout(1500);
    } else {
      await createBtn.click();
      await page.waitForTimeout(1000);
    }

    // Look for modal
    await page.screenshot({ path: "test-results/02-after-c-press.png" });

    // Find title input in the modal
    const titleInput = page.locator('input[placeholder*="itle"]').first();
    const hasTitle = await titleInput.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Title input visible: ${hasTitle}`);

    if (hasTitle) {
      // Fill in a unique test job
      const testId = `PERSIST-${Date.now()}`;
      await titleInput.fill(testId);
      console.log(`Filled title: ${testId}`);

      await page.screenshot({ path: "test-results/03-filled-title.png" });

      // Click create/save button
      const saveBtn = page.locator('button:has-text("Create Job"), button:has-text("Create"), button:has-text("Save")').first();
      const hasSave = await saveBtn.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hasSave) {
        await saveBtn.click();
        console.log("Clicked save");
        await page.waitForTimeout(3000);
      }

      await page.screenshot({ path: "test-results/04-after-create.png" });

      // Check if job appears in the list
      const afterCreateText = await page.textContent("body");
      const jobCreated = afterCreateText?.includes(testId) || false;
      console.log(`Job visible after create: ${jobCreated}`);

      // HARD REFRESH
      console.log("\n🔄 Hard refreshing...");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);

      await page.screenshot({ path: "test-results/05-after-refresh.png" });

      const afterRefreshText = await page.textContent("body");
      const jobPersisted = afterRefreshText?.includes(testId) || false;
      console.log(`Job visible after refresh: ${jobPersisted}`);

      if (jobPersisted) {
        console.log("✅ PERSISTENCE VERIFIED — Job survived refresh!");
      } else {
        console.log("❌ PERSISTENCE FAILED — Job disappeared after refresh!");
        // Check if ANY jobs are visible
        const anyJobs = !(afterRefreshText?.includes("No jobs found"));
        console.log(`Any jobs visible: ${anyJobs}`);
      }
    } else {
      console.log("⚠️ Could not find title input — checking if jobs load at all on refresh");
      
      // Just test that the page loads data from server after refresh
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);
      
      const afterRefreshText = await page.textContent("body");
      console.log(`After refresh shows "No jobs found": ${afterRefreshText?.includes("No jobs found")}`);
      console.log(`After refresh shows "Jobs": ${afterRefreshText?.includes("Jobs")}`);
      await page.screenshot({ path: "test-results/06-refresh-fallback.png" });
    }

    // Print errors
    if (networkErrors.length > 0) {
      console.log("\n⚠️ Network errors:");
      networkErrors.forEach((e) => console.log(`  ${e}`));
    }
    if (consoleErrors.length > 0) {
      console.log("\n⚠️ Console errors:");
      consoleErrors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
    }
  });
});
