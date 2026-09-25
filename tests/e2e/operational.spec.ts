/**
 * E2E: remaining operational screens by role (users, governance, cases,
 * reports, operations, calendar, field assessment).
 */
import { test, expect } from '@playwright/test';
import { USERS, signIn, navButton, clickNav, waitForCompanyPortal } from './helpers';

test.describe('Admin operational screens', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.admin);
  });

  test('User validation loads search and status tabs', async ({ page }) => {
    await clickNav(page, /user validation/i);
    await expect(page.getByRole('heading', { name: /user validation and approval/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search by name, id, or email/i)).toBeVisible();
    await page.locator('.uap-filter-tabs').getByRole('button', { name: /approved/i }).click();
    await expect(page.getByRole('columnheader', { name: /user \/ applicant/i })).toBeVisible();
  });

  test('Governance loads risk rules and catalog tabs', async ({ page }) => {
    await clickNav(page, /governance/i);
    await expect(page.getByRole('heading', { name: /governance of rules/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /risk rules matrix/i })).toBeVisible();
    await page.getByRole('button', { name: /food & risk catalog/i }).click();
    await expect(page.getByRole('button', { name: /food & risk catalog/i })).toHaveClass(/active/);
  });

  test('Cases workbench lists dossiers and create-case form', async ({ page }) => {
    await clickNav(page, /cases & assignments/i);
    await expect(page.getByRole('heading', { name: /operations/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /cases & multi-origin/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /active dossiers/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /create institutional case/i })).toBeVisible();
  });

  test('Reports & closure opens the report review tab', async ({ page }) => {
    await clickNav(page, /reports & closure/i);
    await expect(page.getByRole('tab', { name: /report review/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('Operational workflows open the institutions tab', async ({ page }) => {
    await clickNav(page, /operational workflows/i);
    await expect(page.getByRole('tab', { name: /^institutions$/i })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /intake: complaints/i }).click();
    await expect(page.getByRole('heading', { name: /register health complaint|register lapch/i })).toBeVisible();
  });

  test('Calendar agenda shows the schedule heading', async ({ page }) => {
    await clickNav(page, /calendar agenda/i);
    await expect(page.getByRole('heading', { name: /schedule and evaluation calendar/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^today$/i })).toBeVisible();
  });
});

test.describe('Coordinator workspace', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.coordinator);
  });

  test('sees Cases, Reports, Calendar, and Operations', async ({ page }) => {
    await expect(navButton(page, /cases & assignments/i)).toBeVisible();
    await expect(navButton(page, /reports & closure/i)).toBeVisible();
    await expect(navButton(page, /calendar agenda/i)).toBeVisible();
    await expect(navButton(page, /operational workflows/i)).toBeVisible();
  });

  test('does not see User validation, Governance, or Field assessment', async ({ page }) => {
    await expect(navButton(page, /user validation/i)).toHaveCount(0);
    await expect(navButton(page, /governance/i)).toHaveCount(0);
    await expect(navButton(page, /field assessment/i)).toHaveCount(0);
  });

  test('can open Cases and History explorer', async ({ page }) => {
    await clickNav(page, /cases & assignments/i);
    await expect(page.getByRole('heading', { name: /active dossiers/i })).toBeVisible();
    await clickNav(page, /operational workflows/i);
    await page.getByRole('tab', { name: /history 360/i }).click();
    await expect(page.getByRole('heading', { name: /cross-entity history search/i })).toBeVisible();
  });
});

test.describe('Technician field assessment', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.technician);
  });

  test('field assessment shows an assigned evaluation or an empty state', async ({ page }) => {
    await clickNav(page, /field assessment/i);
    const empty = page.getByText(/you do not have an assessment assigned/i);
    const hero = page.locator('.field-hero-panel');
    await expect(empty.or(hero)).toBeVisible();
  });

  test('calendar is usable from the technician workspace', async ({ page }) => {
    await clickNav(page, /calendar agenda/i);
    await expect(page.getByRole('heading', { name: /schedule and evaluation calendar/i })).toBeVisible();
  });
});

test.describe('Company establishment dialog', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.company);
    await waitForCompanyPortal(page);
  });

  test('opens the register establishment form', async ({ page }) => {
    await page.locator('.cp-hero-actions').getByRole('button', { name: /register establishment/i }).click();
    await expect(page.getByRole('heading', { name: /register establishment/i })).toBeVisible();
    await expect(page.getByLabel(/legal company name/i)).toBeVisible();
    await expect(page.getByLabel(/^rnc/i)).toBeVisible();
  });

  test('blocks an empty establishment registration', async ({ page }) => {
    await page.locator('.cp-hero-actions').getByRole('button', { name: /register establishment/i }).click();
    const name = page.getByLabel(/legal company name/i);
    await name.fill('');
    await page.getByRole('button', { name: /register establishment/i }).last().click();
    const valid = await name.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });
});
