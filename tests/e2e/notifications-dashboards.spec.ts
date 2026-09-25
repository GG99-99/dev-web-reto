/**
 * Notifications and role dashboards after a real assignment event (RF-04).
 */
import { test, expect } from '@playwright/test';
import {
  USERS,
  TECH_NAMES,
  clickNav,
  openRoleSession,
  uniqueTag,
  waitForCompanyPortal,
  selectByOptionText,
} from './helpers';

test.describe('Notifications and dashboards', () => {
  test('assigned technician receives a notification that the company user does not see', async ({ browser }) => {
    test.setTimeout(90_000);
    const tag = uniqueTag('ntf');
    const coordinator = await openRoleSession(browser, USERS.coordinator);
    const technician = await openRoleSession(browser, USERS.technician);
    const company = await openRoleSession(browser, USERS.company);

    try {
      await clickNav(coordinator.page, /cases & assignments/i);
      await selectByOptionText(coordinator.page, /establishment \/ company/i, /lácteos del norte/i);
      await coordinator.page.getByLabel(/scheduling reason/i).fill(`E2E notification case ${tag}`);
      await coordinator.page.getByRole('button', { name: /create institutional case/i }).click();
      const created = coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]');
      await expect(created).toContainText(/institutional case #\d+/i, { timeout: 20_000 });
      const caseId = (await created.innerText()).match(/Case #(\d+)/i)?.[1];
      expect(caseId).toBeTruthy();
      await coordinator.page.getByRole('button', { name: new RegExp(`#${caseId}\\b`) }).click();
      await selectByOptionText(coordinator.page, /accredited field evaluator/i, TECH_NAMES.technician);
      await coordinator.page.getByLabel(/assignment instructions/i).fill(`Notify technician ${tag}`);
      await coordinator.page.getByRole('button', { name: /assign evaluator/i }).click();
      await expect(coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]')).toBeVisible({ timeout: 20_000 });

      await technician.page.getByRole('button', { name: /notifications/i }).click();
      const dialog = technician.page.getByRole('dialog', { name: /notifications center/i });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(new RegExp(`New assigned case: #${caseId}`))).toBeVisible({ timeout: 15_000 });
      const mark = dialog.getByRole('button', { name: /mark all as read/i });
      if (await mark.isVisible().catch(() => false)) {
        await mark.click();
        await expect(technician.page.locator('.notice[role="status"], .ops-message[role="status"]')).toContainText(/marked as read/i, { timeout: 10_000 });
      }

      await company.page.getByRole('button', { name: /notifications/i }).click();
      const companyDialog = company.page.getByRole('dialog', { name: /notifications center/i });
      await expect(companyDialog).toBeVisible();
      await expect(companyDialog.getByText(new RegExp(`New assigned case: #${caseId}`))).toHaveCount(0);

      await waitForCompanyPortal(company.page);
      await expect(company.page.getByText(/total requests/i)).toBeVisible();
      await clickNav(coordinator.page, /command center/i);
      await expect(coordinator.page.locator('.metrics .metric')).toHaveCount(4);
    } finally {
      await coordinator.context.close();
      await technician.context.close();
      await company.context.close();
    }
  });
});
