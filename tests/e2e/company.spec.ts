/**
 * E2E: company portal forms, tabs, and empty/error handling.
 */
import { test, expect } from '@playwright/test';
import { USERS, signIn, waitForCompanyPortal, openNewBpmRequest } from './helpers';

test.describe('Company portal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.company);
    await waitForCompanyPortal(page);
  });

  test('shows BPM, establishments, and certificates tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /my bpm requests/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /establishments & representatives/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /official certificates & evaluations/i })).toBeVisible();
  });

  test('switches to establishments tab', async ({ page }) => {
    await page.getByRole('button', { name: /establishments & representatives/i }).click();
    await expect(page.getByRole('heading', { name: /establishment/i }).first()).toBeVisible();
  });

  test('opens the new BPM request dialog', async ({ page }) => {
    await openNewBpmRequest(page);
    await expect(page.getByLabel(/requesting establishment/i)).toBeVisible();
    await expect(page.getByLabel(/establishment type/i)).toBeVisible();
    await expect(page.getByLabel(/request reason/i)).toBeVisible();
  });

  test('blocks an empty BPM request submission', async ({ page }) => {
    await openNewBpmRequest(page);
    const type = page.getByLabel(/establishment type/i);
    await type.fill('');
    await page.getByRole('button', { name: /create request/i }).click();
    const valid = await type.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  test('creates a draft BPM request', async ({ page }) => {
    await openNewBpmRequest(page);
    await page.getByLabel(/establishment type/i).fill('Dairy processing plant');
    await page.getByLabel(/request reason/i).fill('Automated E2E draft request');
    await page.getByLabel(/submission mode/i).selectOption('false');
    await page.getByRole('button', { name: /create request/i }).click();
    await expect(page.getByRole('button', { name: /create request/i })).toHaveCount(0, { timeout: 15_000 });
  });

  test('refresh reloads the request list', async ({ page }) => {
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByRole('heading', { name: /registered requests/i })).toBeVisible();
  });
});
