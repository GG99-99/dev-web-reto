/**
 * Complaint intake outcomes: proceeds, does not proceed, and referral (RF-09).
 * There is no unauthenticated public intake page; coordinators register complaints.
 */
import { test, expect } from '@playwright/test';
import {
  USERS,
  clickNav,
  navButton,
  openRoleSession,
  signIn,
  uniqueTag,
  expectNotice,
  intakeItem,
  selectByOptionText,
} from './helpers';

test.describe('Complaint intake workflows', () => {
  test('coordinator records proceeding, non-proceeding, and referred complaints', async ({ browser }) => {
    test.setTimeout(90_000);
    const tag = uniqueTag('den');
    const coordinator = await openRoleSession(browser, USERS.coordinator);

    try {
      await clickNav(coordinator.page, /operational workflows/i);
      await coordinator.page.getByRole('tab', { name: /intake: complaints/i }).click();
      await coordinator.page.getByRole('button', { name: /public complaints/i }).click();
      await expect(coordinator.page.getByRole('heading', { name: /register health complaint/i })).toBeVisible();

      await selectByOptionText(coordinator.page, /involved establishment/i, /lácteos del norte/i);
      await coordinator.page.getByLabel(/complaint type/i).fill(`Expired dairy ${tag}`);
      await coordinator.page.getByLabel(/complainant \/ source/i).fill(`Anonymous ${tag}`);
      await coordinator.page.getByLabel(/description of findings/i).fill(`Citizen reported spoiled milk ${tag}`);
      await coordinator.page.getByRole('button', { name: /register intake/i }).click();
      await expectNotice(coordinator.page, /public complaint/i);

      const first = intakeItem(coordinator.page, `Expired dairy ${tag}`);
      await first.getByRole('button', { name: /proceeds/i }).click();
      await expectNotice(coordinator.page, /triage result saved/i);
      await intakeItem(coordinator.page, `Expired dairy ${tag}`).getByRole('button', { name: /generate priority case/i }).click();
      const generated = coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]').filter({ hasText: /case #\d+ generated/i });
      await expect(generated).toBeVisible({ timeout: 20_000 });
      const caseId = (await generated.innerText()).match(/Case #(\d+)/i)?.[1];
      expect(caseId).toBeTruthy();

      await coordinator.page.getByLabel(/complaint type/i).fill(`Noise complaint ${tag}`);
      await coordinator.page.getByLabel(/complainant \/ source/i).fill(`Neighbour ${tag}`);
      await coordinator.page.getByLabel(/description of findings/i).fill(`Out of sanitary scope ${tag}`);
      await coordinator.page.getByRole('button', { name: /register intake/i }).click();
      const second = intakeItem(coordinator.page, `Noise complaint ${tag}`);
      await expect(second).toBeVisible({ timeout: 15_000 });
      await second.getByRole('button', { name: /does not proceed/i }).click();
      await expect(intakeItem(coordinator.page, `Noise complaint ${tag}`).getByRole('button', { name: /generate priority case/i })).toHaveCount(0);

      await coordinator.page.getByLabel(/complaint type/i).fill(`Tax referral ${tag}`);
      await coordinator.page.getByLabel(/complainant \/ source/i).fill(`DGII desk ${tag}`);
      await coordinator.page.getByLabel(/description of findings/i).fill(`Should go to another process ${tag}`);
      await coordinator.page.getByRole('button', { name: /register intake/i }).click();
      const third = intakeItem(coordinator.page, `Tax referral ${tag}`);
      await expect(third).toBeVisible({ timeout: 15_000 });
      await third.getByRole('button', { name: /refer/i }).click();
      await expectNotice(coordinator.page, /REMISION|triage result saved/i);
      await expect(intakeItem(coordinator.page, `Tax referral ${tag}`).getByRole('button', { name: /generate priority case/i })).toHaveCount(0);

      await clickNav(coordinator.page, /cases & assignments/i);
      const caseBtn = coordinator.page.getByRole('button', { name: new RegExp(`#${caseId}\\b`) });
      await expect(caseBtn).toBeVisible({ timeout: 20_000 });
      await expect(caseBtn).toContainText(/denuncia|complaint/i);
    } finally {
      await coordinator.context.close();
    }
  });

  test('technicians cannot open complaint intake', async ({ page }) => {
    await signIn(page, USERS.technician);
    await expect(navButton(page, /operational workflows/i)).toHaveCount(0);
  });
});
