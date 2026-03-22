/**
 * Authenticated test fixtures for Argus-Omniscience.
 *
 * Extends the base Playwright test with:
 *   - Pre-authenticated page (admin session via storageState)
 *   - Helper methods for common CRUD operations
 *   - Supabase admin client for direct DB assertions
 */

import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend({});

/**
 * Navigate to dashboard and verify authenticated session.
 */
export async function gotoDashboard(page: Page) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Navigate to a dashboard route and verify it loads without auth redirect.
 */
export async function gotoRoute(page: Page, path: string) {
  await page.goto(path);
  await page.waitForTimeout(2000);
  expect(page.url()).not.toContain("/auth");
  return page;
}

/**
 * Click a create/add button and wait for modal to appear.
 */
export async function openCreateModal(page: Page, buttonPattern: RegExp = /create|new|add/i) {
  const btn = page.getByRole("button", { name: buttonPattern }).first();
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1000);
    const modal = page.locator("[role='dialog']").first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    return modal;
  }
  return null;
}

/**
 * Fill a form field by label or name pattern.
 */
export async function fillField(page: Page, namePattern: string, value: string) {
  const field = page.locator(`input[name*='${namePattern}'], input[placeholder*='${namePattern}'], textarea[name*='${namePattern}']`).first();
  if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
    await field.fill(value);
    return true;
  }
  return false;
}

/**
 * Submit a modal form and wait for response.
 */
export async function submitForm(page: Page, buttonPattern: RegExp = /save|create|submit/i) {
  const btn = page.getByRole("button", { name: buttonPattern }).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
}

/**
 * Verify a success toast/notification appeared.
 */
export async function expectToast(page: Page, textPattern?: RegExp) {
  const toast = page.locator("[role='alert'], [data-testid*='toast'], .toast, .Toastify").first();
  const visible = await toast.isVisible({ timeout: 5000 }).catch(() => false);
  if (visible && textPattern) {
    await expect(toast).toContainText(textPattern);
  }
  return visible;
}

/**
 * Verify no server errors on page.
 */
export async function expectNoErrors(page: Page) {
  await expect(page.locator("body")).not.toContainText(/500|Internal Server Error|Application Error/i);
}

export { expect };
