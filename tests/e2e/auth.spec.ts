/**
 * E2E: authentication, recovery, sign-up validation, role landing, a11y.
 */
import { test, expect } from '@playwright/test';
import {
  USERS, PASSWORD, openSignIn, fillSignIn, submitSignIn, signIn, signOut, navButton,
} from './helpers';

test.describe('Authentication page', () => {
  test.beforeEach(async ({ page }) => {
    await openSignIn(page);
  });

  test('shows the sign-in heading when logged out', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in to your workspace/i })).toBeVisible();
  });

  test('sign-in form exposes labelled email and password fields', async ({ page }) => {
    await expect(page.getByLabel(/work email or national id/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in to radar/i })).toBeVisible();
  });

  test('shows an error for a wrong password', async ({ page }) => {
    await fillSignIn(page, USERS.admin, 'WRONG_PASSWORD');
    await submitSignIn(page);
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/incorrect|password|try again|could not/i);
  });

  test('blocks empty form submission with required fields', async ({ page }) => {
    await page.getByRole('button', { name: /sign in to radar/i }).click();
    const email = page.getByLabel(/work email or national id/i);
    await expect(email).toBeVisible();
    const valid = await email.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  test('signs in as ADMIN and shows the app shell', async ({ page }) => {
    await fillSignIn(page, USERS.admin);
    await submitSignIn(page);
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /good morning/i })).toBeVisible();
  });

  test('signs in as COORDINADOR', async ({ page }) => {
    await fillSignIn(page, USERS.coordinator);
    await submitSignIn(page);
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  });

  test('signs in as TECNICO_EVALUADOR', async ({ page }) => {
    await fillSignIn(page, USERS.technician);
    await submitSignIn(page);
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
    await expect(navButton(page, /field assessment/i)).toBeVisible();
  });

  test('signs in as ADMIN_EMPRESA', async ({ page }) => {
    await fillSignIn(page, USERS.company);
    await submitSignIn(page);
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
    await expect(navButton(page, /company portal/i)).toBeVisible();
  });

  test('signs in with national ID (cédula)', async ({ page }) => {
    await fillSignIn(page, '001-0000001-1');
    await submitSignIn(page);
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  });

  test('keeps the session after reload', async ({ page }) => {
    await fillSignIn(page, USERS.admin);
    await submitSignIn(page);
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.locator('.app-shell')).toBeVisible();
  });

  test('signs out and returns to the auth page', async ({ page }) => {
    await fillSignIn(page, USERS.admin);
    await submitSignIn(page);
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });
});

test.describe('Sign-up and recovery', () => {
  test.beforeEach(async ({ page }) => {
    await openSignIn(page);
  });

  test('opens the organisation account form', async ({ page }) => {
    await page.getByRole('button', { name: /create an organisation account/i }).click();
    await expect(page.getByRole('heading', { name: /create your organisation account/i })).toBeVisible();
    await expect(page.getByLabel(/full name|your full name/i).or(page.getByPlaceholder(/your full name/i))).toBeVisible();
  });

  test('shows an error when passwords do not match', async ({ page }) => {
    await page.getByRole('button', { name: /create an organisation account/i }).click();
    await page.getByPlaceholder(/your full name/i).fill('Pat Tester');
    await page.getByPlaceholder(/name@organisation.com/i).fill('pat.tester@example.com');
    await page.getByPlaceholder('000-0000000-0').fill('099-1234567-8');
    await page.getByPlaceholder('(000) 000-0000').fill('809-555-0100');
    await page.getByLabel(/create password/i).fill('Password123!');
    await page.getByLabel(/confirm password/i).fill('Different1!');
    await page.getByRole('button', { name: /submit access request/i }).click();
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('rejects a password shorter than 8 characters', async ({ page }) => {
    await page.getByRole('button', { name: /create an organisation account/i }).click();
    const password = page.getByLabel(/create password/i);
    await password.fill('short');
    const valid = await password.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  test('returns to sign-in from the sign-up form', async ({ page }) => {
    await page.getByRole('button', { name: /create an organisation account/i }).click();
    await page.getByRole('button', { name: /already have an account/i }).click();
    await expect(page.getByRole('heading', { name: /sign in to your workspace/i })).toBeVisible();
  });

  test('opens the forgot-password form and accepts a known email', async ({ page }) => {
    await page.getByRole('button', { name: /forgot your password/i }).click();
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    await page.getByLabel(/^work email$/i).fill(USERS.admin);
    await page.getByRole('button', { name: /send recovery instructions/i }).click();
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('returns to sign-in from recovery', async ({ page }) => {
    await page.getByRole('button', { name: /forgot your password/i }).click();
    await page.getByRole('button', { name: /back to sign in/i }).click();
    await expect(page.getByRole('heading', { name: /sign in to your workspace/i })).toBeVisible();
  });
});

test.describe('Role-specific navigation after login', () => {
  test('ADMIN sees Users and Governance', async ({ page }) => {
    await signIn(page, USERS.admin);
    await expect(navButton(page, /user validation/i)).toBeVisible();
    await expect(navButton(page, /governance/i)).toBeVisible();
  });

  test('TECNICO_EVALUADOR sees Field Assessment and Calendar but not Users', async ({ page }) => {
    await signIn(page, USERS.technician);
    await expect(navButton(page, /field assessment/i)).toBeVisible();
    await expect(navButton(page, /calendar agenda/i)).toBeVisible();
    await expect(navButton(page, /user validation/i)).toHaveCount(0);
  });

  test('ADMIN_EMPRESA sees Company portal', async ({ page }) => {
    await signIn(page, USERS.company);
    await expect(navButton(page, /company portal/i)).toBeVisible();
    await expect(navButton(page, /governance/i)).toHaveCount(0);
    await expect(navButton(page, /field assessment/i)).toHaveCount(0);
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await openSignIn(page);
  });

  test('login inputs have accessible names', async ({ page }) => {
    await expect(page.getByLabel(/work email or national id/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test('auth page has a heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('sign-in button is reachable with the keyboard', async ({ page }) => {
    await page.getByLabel(/work email or national id/i).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = page.getByRole('button', { name: /sign in to radar/i });
    await expect(focused).toBeFocused();
  });

  test('error notice uses role=status', async ({ page }) => {
    await fillSignIn(page, USERS.admin, 'WRONG_PASSWORD');
    await submitSignIn(page);
    await expect(page.locator('.auth-notice[role="status"]')).toBeVisible();
  });
});
