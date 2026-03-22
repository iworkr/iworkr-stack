import { test, expect, type Page } from "@playwright/test";

async function clickByTestIdOrText(page: Page, testId: string, textPattern: RegExp) {
  const byId = page.getByTestId(testId);
  if (await byId.count()) {
    await byId.first().click();
    return;
  }
  await page.getByRole("button", { name: textPattern }).first().click();
}

test("Golden Thread Care: participant intake to roster render", async ({ page }) => {
  await page.goto("/dashboard/care/participants");

  await clickByTestIdOrText(page, "btn-new-participant", /new participant|add participant/i);

  const unique = Date.now();
  const firstName = page.getByPlaceholder(/first name/i).first();
  const lastName = page.getByPlaceholder(/last name/i).first();
  await firstName.fill(`PW-${unique}`);
  await lastName.fill("Golden");
  await lastName.press("Enter");

  await page.getByRole("button", { name: /ndia managed|plan managed|self managed/i }).first().click();
  await page.getByRole("button", { name: /continue/i }).first().click();
  await page.getByRole("button", { name: /activate now/i }).first().click();

  const toastByText = page.getByText(/activated|success|participant/i);
  const participantRow = page.getByText(`PW-${unique} Golden`);
  const overlayHeading = page.getByText(/participants\s*\/\s*new|participant intake/i);

  await Promise.race([
    toastByText.first().waitFor({ state: "visible", timeout: 15_000 }),
    participantRow.first().waitFor({ state: "visible", timeout: 15_000 }),
    overlayHeading.first().waitFor({ state: "hidden", timeout: 15_000 }),
  ]);

  await page.goto("/dashboard/roster");
  await expect(page).toHaveURL(/\/dashboard\/roster|\/dashboard\/schedule/);

  const backlog = page.getByRole("button", { name: /backlog|unassigned/i }).first();
  try {
    await backlog.waitFor({ state: "visible", timeout: 6_000 });
  } catch {
    await page.goto("/dashboard/schedule");
    await expect(page).toHaveURL(/\/dashboard\/schedule/);
  }

  await expect(page.getByRole("button", { name: /backlog|unassigned/i }).first()).toBeVisible({
    timeout: 20_000,
  });
});

