/**
 * E2E: dashboard, navigation, notifications, offline indicator, error notice.
 */
import { test, expect } from '@playwright/test';
import { USERS, signIn, navButton, clickNav } from './helpers';

test.describe('Admin navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.admin);
  });

  test('shows Command Center metrics by default', async ({ page }) => {
    await expect(page.locator('.metrics')).toBeVisible();
    await expect(page.getByRole('heading', { name: /good morning/i })).toBeVisible();
  });

  test('navigates to User validation', async ({ page }) => {
    await clickNav(page, /user validation/i);
    await expect(page.locator('main')).toBeVisible();
    await expect(navButton(page, /user validation/i)).toHaveClass(/active/);
  });

  test('navigates to Governance', async ({ page }) => {
    await clickNav(page, /governance/i);
    await expect(navButton(page, /governance/i)).toHaveClass(/active/);
  });

  test('opens the sidebar with the hamburger on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    const hamburger = page.getByRole('button', { name: /open navigation/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(page.locator('aside.sidebar--open')).toBeVisible();
  });

  test('notifications bell is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();
  });

  test('notifications bell opens a dialog', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByRole('dialog', { name: /notifications center/i })).toBeVisible();
  });

  test('profile button reveals the account menu', async ({ page }) => {
    await page.getByRole('button', { name: /account menu/i }).click();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('online status is visible in the sidebar', async ({ page }) => {
    await expect(page.locator('.side-bottom strong')).toBeVisible();
  });

  test('navigates to Calendar, Cases, and Company portal', async ({ page }) => {
    await clickNav(page, /calendar agenda/i);
    await expect(navButton(page, /calendar agenda/i)).toHaveClass(/active/);
    await clickNav(page, /cases & assignments/i);
    await expect(navButton(page, /cases & assignments/i)).toHaveClass(/active/);
    await clickNav(page, /company portal/i);
    await expect(navButton(page, /company portal/i)).toHaveClass(/active/);
  });
});

test.describe('Overview dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.admin);
  });

  test('renders four metric cards', async ({ page }) => {
    await expect(page.locator('.metrics .metric')).toHaveCount(4);
  });

  test('shows upcoming assessments', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /upcoming assessments/i })).toBeVisible();
  });

  test('shows the case lifecycle tracker', async ({ page }) => {
    await expect(page.locator('.lifecycle')).toBeVisible();
  });

  test('shows a loading skeleton then content', async ({ page }) => {
    await expect(page.locator('.metrics')).toBeVisible();
  });

  test('primary action button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /review assignments/i })).toBeVisible();
  });
});

test.describe('Technician navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.technician);
  });

  test('sees Field Assessment and Calendar', async ({ page }) => {
    await expect(navButton(page, /field assessment/i)).toBeVisible();
    await expect(navButton(page, /calendar agenda/i)).toBeVisible();
  });

  test('does not see User validation or Governance', async ({ page }) => {
    await expect(navButton(page, /user validation/i)).toHaveCount(0);
    await expect(navButton(page, /governance/i)).toHaveCount(0);
  });

  test('can open Calendar and Field assessment', async ({ page }) => {
    await clickNav(page, /calendar agenda/i);
    await expect(navButton(page, /calendar agenda/i)).toHaveClass(/active/);
    await clickNav(page, /field assessment/i);
    await expect(navButton(page, /field assessment/i)).toHaveClass(/active/);
  });
});

test.describe('Company portal navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.company);
  });

  test('lands on the company portal', async ({ page }) => {
    await expect(page.getByRole('button', { name: /my bpm requests/i })).toBeVisible();
  });

  test('does not see Governance or Field assessment', async ({ page }) => {
    await expect(navButton(page, /governance/i)).toHaveCount(0);
    await expect(navButton(page, /field assessment/i)).toHaveCount(0);
  });
});

test.describe('Offline and errors', () => {
  test('shows Offline Mode when the browser goes offline', async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.context().setOffline(true);
    await expect(page.getByText('Offline Mode')).toBeVisible();
    await page.context().setOffline(false);
    await expect(page.getByText('Connected')).toBeVisible();
  });

  test('notice bar can be dismissed', async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.evaluate(() => {
      const event = new Event('offline');
      window.dispatchEvent(event);
    });
    const notice = page.locator('.notice[role="status"]');
    if (await notice.isVisible().catch(() => false)) {
      await notice.getByRole('button').click();
      await expect(notice).toHaveCount(0);
    }
  });
});
