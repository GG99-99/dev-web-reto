/**
 * Report visibility, history search, and company isolation (RF-16–RF-20).
 * Full approve/return/correct/close coverage lives in bpm-lifecycle.spec.ts.
 */
import { test, expect } from '@playwright/test';
import {
  USERS,
  clickNav,
  navButton,
  openRoleSession,
  signIn,
  uniqueTag,
  waitForCompanyPortal,
  selectByOptionText,
} from './helpers';

test.describe('Reports, history, and isolation', () => {
  test('history search finds a newly created institutional case', async ({ browser }) => {
    test.setTimeout(90_000);
    const tag = uniqueTag('hist');
    const coordinator = await openRoleSession(browser, USERS.coordinator);

    try {
      await clickNav(coordinator.page, /cases & assignments/i);
      await selectByOptionText(coordinator.page, /establishment \/ company/i, /lácteos del norte/i);
      await coordinator.page.getByLabel(/scheduling reason/i).fill(`E2E history case ${tag}`);
      await coordinator.page.getByRole('button', { name: /create institutional case/i }).click();
      const created = coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]');
      await expect(created).toContainText(/institutional case #\d+/i, { timeout: 20_000 });
      const caseId = (await created.innerText()).match(/Case #(\d+)/i)?.[1];
      expect(caseId).toBeTruthy();

      await clickNav(coordinator.page, /operational workflows/i);
      await coordinator.page.getByRole('tab', { name: /history 360/i }).click();
      await expect(coordinator.page.getByRole('heading', { name: /cross-entity history search/i })).toBeVisible();
      await coordinator.page.getByLabel(/record type/i).selectOption('CASE');
      await coordinator.page.getByRole('button', { name: /search records/i }).click();
      await expect(coordinator.page.getByText(new RegExp(`Case #${caseId}\\b`))).toBeVisible({ timeout: 20_000 });
    } finally {
      await coordinator.context.close();
    }
  });

  test('company portal certificates stay scoped to the signed-in organisation', async ({ browser }) => {
    const company = await openRoleSession(browser, USERS.company);
    const delegate = await openRoleSession(browser, USERS.delegate);

    try {
      await waitForCompanyPortal(company.page);
      await company.page.getByRole('button', { name: /official certificates/i }).click();
      await expect(company.page.getByRole('heading', { name: /official decisions/i })).toBeVisible();
      await expect(company.page.getByText(/panadería el sol/i)).toHaveCount(0);

      await waitForCompanyPortal(delegate.page);
      await delegate.page.getByRole('button', { name: /official certificates/i }).click();
      await expect(delegate.page.getByText(/panadería el sol/i)).toHaveCount(0);
    } finally {
      await company.context.close();
      await delegate.context.close();
    }
  });

  test('technicians cannot open history explorer', async ({ page }) => {
    await signIn(page, USERS.technician);
    await expect(navButton(page, /operational workflows/i)).toHaveCount(0);
  });
});
