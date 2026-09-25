/**
 * LAPCH alert intake: proceeds (generate case) and does not proceed (RF-08).
 */
import { test, expect } from '@playwright/test';
import {
  USERS,
  clickNav,
  navButton,
  openRoleSession,
  signIn,
  uniqueTag,
  selectByOptionText,
  expectNotice,
  intakeItem,
} from './helpers';

test.describe('LAPCH alert workflows', () => {
  test('coordinator records a proceeding alert and a non-proceeding alert', async ({ browser }) => {
    test.setTimeout(90_000);
    const tag = uniqueTag('lapch');
    const procedeNumber = `LAPCH-E2E-${tag}-P`;
    const noProcedeNumber = `LAPCH-E2E-${tag}-N`;

    const coordinator = await openRoleSession(browser, USERS.coordinator);
    const technician = await openRoleSession(browser, USERS.technician);

    try {
      await clickNav(coordinator.page, /operational workflows/i);
      await coordinator.page.getByRole('tab', { name: /intake: complaints/i }).click();
      await expect(coordinator.page.getByRole('heading', { name: /register lapch epidemiological alert/i })).toBeVisible();

      await selectByOptionText(coordinator.page, /involved establishment/i, /lácteos del norte/i);
      await coordinator.page.getByLabel(/lapch alert number/i).fill(procedeNumber);
      await coordinator.page.getByLabel(/affected product or batch/i).fill(`Whole milk ${tag}`);
      await coordinator.page.getByLabel(/description of findings/i).fill(`Laboratory isolation of Listeria ${tag}`);
      await coordinator.page.getByRole('button', { name: /register intake/i }).click();
      await expectNotice(coordinator.page, /lapch health alert/i);

      await intakeItem(coordinator.page, procedeNumber).getByRole('button', { name: /proceeds/i }).click();
      await expectNotice(coordinator.page, /triage result saved/i);
      await intakeItem(coordinator.page, procedeNumber).getByRole('button', { name: /generate priority case/i }).click();
      const generated = coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]').filter({ hasText: /case #\d+ generated/i });
      await expect(generated).toBeVisible({ timeout: 20_000 });
      const caseId = (await generated.innerText()).match(/Case #(\d+)/i)?.[1];
      expect(caseId).toBeTruthy();

      await selectByOptionText(coordinator.page, /involved establishment/i, /lácteos del norte/i);
      await coordinator.page.getByLabel(/lapch alert number/i).fill(noProcedeNumber);
      await coordinator.page.getByLabel(/affected product or batch/i).fill(`Yogurt ${tag}`);
      await coordinator.page.getByLabel(/description of findings/i).fill(`Does not meet outbreak criteria ${tag}`);
      await coordinator.page.getByRole('button', { name: /register intake/i }).click();
      await expect(coordinator.page.getByText(noProcedeNumber)).toBeVisible({ timeout: 15_000 });
      await intakeItem(coordinator.page, noProcedeNumber).getByRole('button', { name: /does not proceed/i }).click();
      await expectNotice(coordinator.page, /NO_PROCEDE|does not proceed|triage result saved/i);
      await expect(intakeItem(coordinator.page, noProcedeNumber).getByRole('button', { name: /generate priority case/i })).toHaveCount(0);

      await clickNav(coordinator.page, /cases & assignments/i);
      await expect(coordinator.page.getByRole('button', { name: new RegExp(`#${caseId}\\b`) })).toBeVisible({ timeout: 20_000 });
      await expect(coordinator.page.getByRole('button', { name: new RegExp(`#${caseId}\\b`) })).toContainText(/alerta lapch|lapch/i);

      await clickNav(coordinator.page, /command center/i);
      await expect(coordinator.page.locator('.metrics')).toBeVisible();

      await expect(navButton(technician.page, /operational workflows/i)).toHaveCount(0);
      await expect(navButton(technician.page, /user validation/i)).toHaveCount(0);
    } finally {
      await coordinator.context.close();
      await technician.context.close();
    }
  });

  test('company users do not see intake or case assignment screens', async ({ page }) => {
    await signIn(page, USERS.company);
    await expect(navButton(page, /operational workflows/i)).toHaveCount(0);
    await expect(navButton(page, /cases & assignments/i)).toHaveCount(0);
  });
});
