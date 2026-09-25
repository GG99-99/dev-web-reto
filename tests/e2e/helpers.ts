/**
 * Shared Playwright helpers. Locators prefer accessible names and labels.
 */
import { expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.TEST_PASSWORD ?? 'Password123!';

export const USERS = {
  admin: 'admin@salud.gob.do',
  coordinator: 'coordinador@salud.gob.do',
  technician: 'tecnico1@salud.gob.do',
  company: 'admin@lacteosdelnorte.do',
  delegate: 'delegado@lacteosdelnorte.do',
};

export async function clearSession(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('radar-session'));
}

export async function openSignIn(page: Page) {
  await clearSession(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: /sign in to your workspace/i })).toBeVisible();
}

export async function fillSignIn(page: Page, usuario: string, password = PASSWORD) {
  await page.getByLabel(/work email or national id/i).fill(usuario);
  await page.getByLabel(/^password$/i).fill(password);
}

export async function submitSignIn(page: Page) {
  await page.getByRole('button', { name: /sign in to radar/i }).click();
}

export async function signIn(page: Page, usuario: string, password = PASSWORD) {
  await openSignIn(page);
  await fillSignIn(page, usuario, password);
  await submitSignIn(page);
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page.getByRole('heading', { name: /sign in to your workspace/i })).toBeVisible();
}

export function navButton(page: Page, label: string | RegExp) {
  return page.locator('aside nav').getByRole('button', { name: label });
}

/** Open the off-canvas sidebar on narrow viewports before navigating. */
export async function ensureNavOpen(page: Page) {
  const hamburger = page.getByRole('button', { name: /open navigation/i });
  if (await hamburger.isVisible()) {
    const sidebar = page.locator('aside.sidebar');
    const open = await sidebar.evaluate((el) => el.classList.contains('sidebar--open'));
    if (!open) await hamburger.click();
    await expect(page.locator('aside.sidebar--open')).toBeVisible();
  }
}

export async function clickNav(page: Page, label: string | RegExp) {
  await ensureNavOpen(page);
  await navButton(page, label).click();
}

/** Wait until the company portal has loaded a linked establishment. */
export async function waitForCompanyPortal(page: Page) {
  await expect(page.locator('.company-portal')).toBeVisible();
  await expect(page.locator('.cp-hero h1')).not.toHaveText(/Portal de Autogestión/i, {
    timeout: 20_000,
  });
}

export async function openNewBpmRequest(page: Page) {
  await waitForCompanyPortal(page);
  await page.locator('.cp-hero-actions').getByRole('button', { name: /new bpm request/i }).click();
  await expect(page.getByRole('heading', { name: /new bpm evaluation request/i })).toBeVisible();
}
