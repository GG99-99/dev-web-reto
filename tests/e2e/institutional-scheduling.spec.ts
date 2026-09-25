/**
 * Institutional case origin: assign, reassign, schedule, calendar visibility (RF-06, RF-07, RF-10, RF-11).
 * Coordinator reschedule and cancel are exercised on the calendar for the same evaluation.
 */
import { test, expect } from '@playwright/test';
import {
  USERS,
  TECH_NAMES,
  acceptNextDialog,
  clickNav,
  expectNotice,
  localDateTimeInput,
  openRoleSession,
  selectByOptionText,
  uniqueTag,
} from './helpers';

test.describe('Institutional scheduling', () => {
  test('coordinator creates, assigns, reassigns, and schedules an institutional evaluation', async ({ browser }) => {
    test.setTimeout(180_000);
    const tag = uniqueTag('inst');
    const reason = `E2E institutional inspection ${tag}`;

    const coordinator = await openRoleSession(browser, USERS.coordinator);
    let tech1: Awaited<ReturnType<typeof openRoleSession>> | null = null;
    let tech2: Awaited<ReturnType<typeof openRoleSession>> | null = null;

    try {
      await clickNav(coordinator.page, /cases & assignments/i);
      await expect(coordinator.page.getByRole('heading', { name: /create institutional case/i })).toBeVisible();
      await selectByOptionText(coordinator.page, /establishment \/ company/i, /lácteos del norte/i);
      await coordinator.page.getByLabel(/audit priority/i).selectOption('ALTA');
      await coordinator.page.getByLabel(/scheduling reason/i).fill(reason);
      await coordinator.page.getByRole('button', { name: /create institutional case/i }).click();
      const created = coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]');
      await expect(created).toContainText(/institutional case #\d+/i, { timeout: 20_000 });
      const caseId = (await created.innerText()).match(/Case #(\d+)/i)?.[1];
      expect(caseId).toBeTruthy();

      await coordinator.page.getByRole('button', { name: new RegExp(`#${caseId}\\b`) }).click();
      await selectByOptionText(coordinator.page, /accredited field evaluator/i, TECH_NAMES.technician);
      await coordinator.page.getByLabel(/assignment instructions/i).fill(`First assignee ${tag}`);
      await coordinator.page.getByRole('button', { name: /assign evaluator/i }).click();
      await expect(coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]')).toBeVisible({ timeout: 20_000 });

      await selectByOptionText(coordinator.page, /accredited field evaluator/i, TECH_NAMES.technician2);
      await coordinator.page.getByLabel(/assignment instructions/i).fill(`Coverage reassignment ${tag}`);
      await coordinator.page.getByRole('button', { name: /reassign evaluator/i }).click();
      await expect(coordinator.page.getByText(/reassigned/i).first()).toBeVisible({ timeout: 20_000 });

      await selectByOptionText(coordinator.page, /^field evaluator/i, TECH_NAMES.technician2);
      await coordinator.page.getByLabel(/scheduled date & time/i).fill(localDateTimeInput(2));
      await coordinator.page.getByLabel(/health priority/i).selectOption('ALTA');
      await coordinator.page.getByLabel(/technical reason/i).fill(reason);
      await coordinator.page.getByRole('button', { name: /schedule on calendar/i }).click();
      const scheduled = coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]');
      await expect(scheduled).toContainText(/field evaluation #\d+ scheduled/i, { timeout: 20_000 });
      const evaluationId = (await scheduled.innerText()).match(/#(\d+)/)?.[1];
      expect(evaluationId).toBeTruthy();

      await clickNav(coordinator.page, /calendar agenda/i);
      const pill = coordinator.page.locator(`button.tc-event-pill[title^="#${evaluationId}:"]`);
      await expect(pill).toBeVisible({ timeout: 20_000 });
      await pill.click();
      await coordinator.page.getByRole('button', { name: /^reschedule$/i }).click();
      await expect(coordinator.page.getByRole('alert')).toContainText(/date and time/i);
      await coordinator.page.getByLabel(/new date and time/i).fill(localDateTimeInput(5));
      await coordinator.page.getByLabel(/reschedule note/i).fill(`Moved for coverage ${tag}`);
      await coordinator.page.getByRole('button', { name: /^reschedule$/i }).click();
      await expectNotice(coordinator.page, /evaluation rescheduled/i);
      await expect(coordinator.page.locator(`button.tc-event-pill[title^="#${evaluationId}:"]`)).toHaveAttribute('title', /REPROGRAMADA/);

      tech2 = await openRoleSession(browser, USERS.technician2);
      await clickNav(tech2.page, /calendar agenda/i);
      const techPill = tech2.page.locator(`button.tc-event-pill[title^="#${evaluationId}:"]`);
      await expect(techPill).toBeVisible({ timeout: 20_000 });
      await techPill.click();
      await expect(tech2.page.getByRole('button', { name: /^reschedule$/i })).toHaveCount(0);
      await expect(tech2.page.getByRole('button', { name: /^cancel evaluation$/i })).toHaveCount(0);
      await tech2.page.getByRole('button', { name: /^close$/i }).click();

      tech1 = await openRoleSession(browser, USERS.technician);
      await clickNav(tech1.page, /calendar agenda/i);
      await expect(tech1.page.locator(`button.tc-event-pill[title^="#${evaluationId}:"]`)).toHaveCount(0);

      await clickNav(coordinator.page, /calendar agenda/i);
      await coordinator.page.locator(`button.tc-event-pill[title^="#${evaluationId}:"]`).click();
      acceptNextDialog(coordinator.page);
      await coordinator.page.getByRole('button', { name: /^cancel evaluation$/i }).click();
      await expectNotice(coordinator.page, /evaluation cancelled/i);
      await expect(coordinator.page.locator(`button.tc-event-pill[title^="#${evaluationId}:"]`)).toHaveAttribute('title', /CANCELADA/);
    } finally {
      await coordinator.context.close();
      if (tech1) await tech1.context.close();
      if (tech2) await tech2.context.close();
    }
  });
});
