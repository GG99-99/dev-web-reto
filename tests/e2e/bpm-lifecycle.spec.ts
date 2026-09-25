/**
 * Complete BPM request → field evaluation → report correction → case closure
 * through real UI actions and separate role sessions (RF-04–RF-07, RF-10–RF-19).
 */
import { test, expect } from '@playwright/test';
import {
  USERS,
  TECH_NAMES,
  TINY_PNG,
  LETTER_BYTES,
  acceptNextDialog,
  answerVisibleCriteria,
  apiGet,
  apiLogin,
  clickNav,
  createApprovedCompanyUser,
  deactivateE2eUsers,
  expectedRisk,
  expectNotice,
  localDateTimeInput,
  openNewBpmRequest,
  openRoleSession,
  selectByOptionText,
  uniqueTag,
  waitForCompanyPortal,
  waitForCompanyPortalAny,
} from './helpers';

test.describe('BPM request through final closure', () => {
  test.afterEach(async () => {
    await deactivateE2eUsers();
  });

  test('company, coordinator, and technician complete one request across role handoffs', async ({ browser }) => {
    test.setTimeout(300_000);
    const tag = uniqueTag('bpm');
    const motivo = `E2E BPM lifecycle ${tag}`;
    const observaciones = `Morning shift window ${tag}`;
    let caseId = '';
    let evaluationId = '';
    let recorded: Array<'C' | 'CP' | 'NC' | 'N/A'> = [];
    const outsider = await createApprovedCompanyUser('bpmiso');

    const company = await openRoleSession(browser, USERS.company);
    const coordinator = await openRoleSession(browser, USERS.coordinator);
    const otherCompany = await openRoleSession(browser, outsider.email);
    let technician: Awaited<ReturnType<typeof openRoleSession>> | null = null;

    try {
      await test.step('company saves a draft, reopens it, attaches a document, and submits', async () => {
        await waitForCompanyPortal(company.page);
        await openNewBpmRequest(company.page);
        await selectByOptionText(company.page, /requesting establishment/i, /lácteos del norte/i);
        await company.page.getByLabel(/establishment type/i).fill('Dairy processing plant');
        await company.page.getByLabel(/request reason/i).fill(motivo);
        await company.page.getByLabel(/technical observations/i).fill(observaciones);
        await company.page.getByLabel(/submission mode/i).selectOption('false');
        await company.page.getByLabel(/required health document/i).setInputFiles({
          name: `auth-letter-${tag}.txt`,
          mimeType: 'text/plain',
          buffer: LETTER_BYTES,
        });
        await company.page.getByRole('button', { name: /create request/i }).click();
        const draftNotice = company.page.locator('.notice[role="status"], .ops-message[role="status"]').filter({ hasText: /saved as draft/i });
        await expect(draftNotice).toContainText(/saved as draft/i, { timeout: 20_000 });
        const requestId = (await draftNotice.innerText()).match(/Request #(\d+)/i)?.[1];
        expect(requestId, 'draft notice should include the request id').toBeTruthy();

        const rows = company.page.locator('.cp-request-row');
        if ((await rows.count()) > 1) {
          await rows.nth(1).click();
        }
        await company.page.locator('.cp-request-row', { hasText: `#${requestId}` }).first().click();
        await expect(company.page.getByRole('heading', { name: new RegExp(`Request Detail #${requestId}`) })).toBeVisible();
        await expect(company.page.getByText(motivo)).toBeVisible();
        await expect(company.page.getByText(/draft/i).first()).toBeVisible();
        await expect(company.page.getByText(observaciones)).toBeVisible();
        await expect(company.page.getByText(`auth-letter-${tag}.txt`)).toBeVisible();
        await company.page.reload();
        await waitForCompanyPortal(company.page);
        await company.page.locator('.cp-request-row', { hasText: `#${requestId}` }).first().click();
        await expect(company.page.getByText(`auth-letter-${tag}.txt`)).toBeVisible();

        const companyToken = (await apiLogin(USERS.company)).accessToken;
        const detail = await apiGet(`/bpm-requests/${requestId}`, companyToken);
        expect(detail.status).toBe(200);
        const attachments = (
          detail.data as { data?: { attachments?: Array<{ fileName?: string }> } }
        ).data?.attachments ?? [];
        expect(attachments.some((file) => String(file.fileName ?? '').includes('auth-letter'))).toBe(true);

        acceptNextDialog(company.page);
        await company.page.getByRole('button', { name: /submit for health evaluation/i }).click();
        const submitted = company.page.locator('.notice[role="status"], .ops-message[role="status"]').filter({ hasText: /submitted successfully/i });
        await expect(submitted).toContainText(/submitted successfully/i, { timeout: 20_000 });
        const text = (await submitted.innerText()).replace(/\s+/g, ' ');
        const match = text.match(/Case #(\d+)/i);
        expect(match, `submit notice should include the case id: ${text}`).toBeTruthy();
        caseId = match![1];
        await expect(company.page.getByText(/pending assignment/i).first()).toBeVisible();
      });

      await test.step('another company session does not see the private request', async () => {
        await waitForCompanyPortalAny(otherCompany.page);
        await expect(otherCompany.page.getByText(motivo)).toHaveCount(0);
      });

      await test.step('coordinator finds the case, assigns, and schedules the technician', async () => {
        await clickNav(coordinator.page, /cases & assignments/i);
        const caseButton = coordinator.page.getByRole('button', { name: new RegExp(`#${caseId}\\b`) });
        await expect(caseButton).toBeVisible({ timeout: 20_000 });
        await caseButton.click();
        await expect(coordinator.page.getByRole('heading', { name: new RegExp(`Assignment · Case #${caseId}`) })).toBeVisible();
        await selectByOptionText(coordinator.page, /accredited field evaluator/i, TECH_NAMES.technician);
        await coordinator.page.getByLabel(/assignment instructions/i).fill(`Primary evaluator ${tag}`);
        await coordinator.page.getByRole('button', { name: /assign evaluator/i }).click();
        await expectNotice(coordinator.page, /field evaluator assigned/i);
        await expect(coordinator.page.getByText(/assignment history/i)).toBeVisible();

        await selectByOptionText(coordinator.page, /^field evaluator/i, TECH_NAMES.technician);
        await coordinator.page.getByLabel(/scheduled date & time/i).fill(localDateTimeInput(2));
        await coordinator.page.getByLabel(/health priority/i).selectOption('ALTA');
        await coordinator.page.getByLabel(/technical reason/i).fill(`Scheduled from BPM ${tag}`);
        await coordinator.page.getByLabel(/inspector notes/i).fill('Bring thermometer kit');
        await coordinator.page.getByRole('button', { name: /schedule on calendar/i }).click();
        const scheduled = coordinator.page.locator('.notice[role="status"], .ops-message[role="status"]').filter({ hasText: /field evaluation #\d+ scheduled/i });
        await expect(scheduled).toContainText(/field evaluation #\d+ scheduled/i, { timeout: 20_000 });
        const schedText = await scheduled.innerText();
        evaluationId = schedText.match(/#(\d+)/)?.[1] ?? '';
        expect(evaluationId).toBeTruthy();
      });

      await test.step('technician opens the evaluation from calendar, starts it, and saves progress', async () => {
        technician = await openRoleSession(browser, USERS.technician);
        await clickNav(technician!.page, /calendar agenda/i);
        await expect(technician!.page.getByRole('heading', { name: /schedule and evaluation calendar/i })).toBeVisible();
        await technician!.page.locator(`button.tc-event-pill[title^="#${evaluationId}:"]`).click();
        await technician!.page.getByRole('button', { name: /open field form/i }).click();
        await expect(technician!.page.locator('.field-hero-panel')).toBeVisible({ timeout: 20_000 });
        await technician!.page.getByLabel(/present plant representative/i).selectOption({ index: 1 });
        await selectByOptionText(technician!.page, /food category/i, /lácteos/i);
        await expect(technician!.page.getByLabel(/specific food item/i)).toBeEnabled();
        await technician!.page.getByLabel(/specific food item/i).selectOption({ index: 1 });
        await technician!.page.getByRole('button', { name: /start good practices assessment/i }).click();
        await expect(technician!.page.getByText(/inspection in progress/i)).toBeVisible({ timeout: 20_000 });

        recorded = await answerVisibleCriteria(technician!.page, (index) => {
          if (index === 0) return 'NC';
          if (index === 1) return 'N/A';
          if (index === 2) return 'CP';
          return 'C';
        });
        expect(recorded.length).toBeGreaterThan(5);
        await technician!.page.locator('article.criteria-card').first().locator('input[type="file"]').setInputFiles({
          name: `finding-${tag}.png`,
          mimeType: 'image/png',
          buffer: TINY_PNG,
        });
        await technician!.page.getByRole('button', { name: /save draft on server/i }).click();
        await expect(technician!.page.getByText(/last saved|saved:/i).first()).toBeVisible({ timeout: 15_000 });
      });

      await test.step('offline transition keeps the started inspection and local save', async () => {
        await technician!.page.context().setOffline(true);
        await expect(technician!.page.getByText(/inspection in progress/i)).toBeVisible();
        await expect(technician!.page.getByRole('button', { name: /save draft on device/i })).toBeEnabled();
        await technician!.page.locator('.chapter-nav-btn').first().click();
        await expect(technician!.page.getByRole('button', { name: /\[ NC \] Does Not Comply/ }).first()).toHaveClass(/active/);

        await clickNav(technician!.page, /calendar agenda/i);
        await clickNav(technician!.page, /field assessment/i);
        await expect(technician!.page.getByText(/inspection in progress/i)).toBeVisible({ timeout: 20_000 });
        if (await technician!.page.locator('#eval-select').count()) {
          await selectByOptionText(technician!.page, /assigned assessment/i, new RegExp(`#${evaluationId}\\b`));
        }
        await technician!.page.locator('.chapter-nav-btn').first().click();
        await expect(technician!.page.getByRole('button', { name: /\[ NC \] Does Not Comply/ }).first()).toHaveClass(/active/, { timeout: 20_000 });
        await expect(technician!.page.getByRole('button', { name: /save draft on device/i })).toBeEnabled();
        await technician!.page.getByRole('button', { name: /save draft on device/i }).click();
        await expectNotice(technician!.page, /saved in local indexeddb|saved locally/i);

        await technician!.page.context().setOffline(false);
        await expect(technician!.page.getByRole('button', { name: /save draft on server/i })).toBeEnabled({ timeout: 20_000 });
      });

      await test.step('reopen field assessment, verify persisted answers, finish and lock', async () => {
        await clickNav(technician!.page, /calendar agenda/i);
        await clickNav(technician!.page, /field assessment/i);
        await expect(technician!.page.locator('.field-hero-panel')).toBeVisible({ timeout: 20_000 });
        if (await technician!.page.locator('#eval-select').count()) {
          await selectByOptionText(technician!.page, /assigned assessment/i, new RegExp(`#${evaluationId}\\b`));
        }
        await expect(technician!.page.getByRole('button', { name: /\[ NC \] Does Not Comply/ }).first()).toHaveClass(/active/, { timeout: 20_000 });
        acceptNextDialog(technician!.page);
        await technician!.page.getByRole('button', { name: /finish and calculate final risk/i }).click();
        const summary = technician!.page.getByText(/assessment finished and verdict/i);
        await expect(summary).toBeVisible({ timeout: 20_000 });
        const expected = expectedRisk(recorded);
        await expect(technician!.page.getByText(new RegExp(`Score:\\s*${expected.puntajeObtenido}`))).toBeVisible();
        await expect(technician!.page.getByText(new RegExp(`Compliance:\\s*${expected.porcentajeCumplimiento}`))).toBeVisible();
        await expect(technician!.page.getByText(new RegExp(`Risk Level:\\s*${expected.nivelRiesgo}`))).toBeVisible();
        await expect(technician!.page.getByRole('button', { name: /\[ C \] Complies/ }).first()).toBeDisabled();

        const token = (await apiLogin(USERS.technician)).accessToken;
        const score = await apiGet(`/evaluations/${evaluationId}/score`, token);
        const payload = score.data as { valid?: boolean; data?: { puntajeObtenido: number; porcentajeCumplimiento: number; nivelRiesgo: string } };
        expect(score.status).toBe(200);
        expect(payload.data?.puntajeObtenido).toBe(expected.puntajeObtenido);
        expect(payload.data?.porcentajeCumplimiento).toBe(expected.porcentajeCumplimiento);
        expect(payload.data?.nivelRiesgo).toBe(expected.nivelRiesgo);
      });

      await test.step('technician submits the report; coordinator returns it for correction', async () => {
        await clickNav(technician!.page, /reports & closure/i);
        await selectByOptionText(technician!.page, /^evaluation/i, new RegExp(`#${evaluationId}\\b`));
        await expect(technician!.page.getByText(/locked for review|editable draft|findings/i).first()).toBeVisible({ timeout: 15_000 });
        await technician!.page.getByRole('button', { name: /submit for review/i }).click();
        await expectNotice(technician!.page, /submitted for coordinator review/i);

        await clickNav(coordinator.page, /reports & closure/i);
        await selectByOptionText(coordinator.page, /^evaluation/i, new RegExp(`#${evaluationId}\\b`));
        await expect(coordinator.page.getByRole('heading', { name: /coordinator review/i })).toBeVisible();
        await coordinator.page.getByLabel(/health decision/i).selectOption('SOLICITAR_CORRECCION');
        await coordinator.page.getByLabel(/review observations/i).fill(`Please expand the non-conformity narrative ${tag}`);
        await coordinator.page.getByRole('button', { name: /record decision/i }).click();
        await expectNotice(coordinator.page, /review decision recorded/i);
      });

      await test.step('technician reads feedback, corrects, and resubmits', async () => {
        await clickNav(technician!.page, /reports & closure/i);
        await selectByOptionText(technician!.page, /^evaluation/i, new RegExp(`#${evaluationId}\\b`));
        await expect(technician!.page.getByText(new RegExp(tag))).toBeVisible({ timeout: 15_000 });
        await technician!.page.getByLabel(/non-conformities/i).fill(`Corrected non-conformity write-up ${tag}`);
        await technician!.page.getByLabel(/recommendations/i).fill(`Corrective action plan ${tag}`);
        await technician!.page.getByRole('button', { name: /save changes/i }).click();
        await expectNotice(technician!.page, /correction saved/i);
        await expect(technician!.page.getByRole('button', { name: /submit for review/i })).toBeDisabled();
        await expect(technician!.page.getByRole('button', { name: /resubmit correction/i })).toBeEnabled();
        await technician!.page.getByRole('button', { name: /resubmit correction/i }).click();
        await expectNotice(technician!.page, /corrected report resubmitted/i);
      });

      await test.step('coordinator approves, closes the case, and downloads the official PDF', async () => {
        await clickNav(coordinator.page, /reports & closure/i);
        await selectByOptionText(coordinator.page, /^evaluation/i, new RegExp(`#${evaluationId}\\b`));
        await coordinator.page.getByLabel(/health decision/i).selectOption('APROBAR');
        await coordinator.page.getByLabel(/review observations/i).fill(`Approved after correction ${tag}`);
        await coordinator.page.getByRole('button', { name: /record decision/i }).click();
        await expectNotice(coordinator.page, /review decision recorded/i);
        await expect(coordinator.page.getByText(/official certificate approved/i)).toBeVisible();

        await clickNav(coordinator.page, /cases & assignments/i);
        await coordinator.page.getByRole('button', { name: new RegExp(`#${caseId}\\b`) }).click();
        await coordinator.page.getByLabel(/final case closure decision/i).fill(`Closed after approved BPM evaluation ${tag}`);
        await coordinator.page.getByRole('button', { name: /close case/i }).click();
        await expectNotice(coordinator.page, /case closed/i);

        const coordToken = (await apiLogin(USERS.coordinator)).accessToken;
        const closed = await apiGet(`/cases/${caseId}`, coordToken);
        const caseBody = closed.data as { valid?: boolean; data?: { status?: string; closedAt?: string } };
        expect(closed.status).toBe(200);
        expect(caseBody.data?.status).toBe('CERRADO');
        expect(caseBody.data?.closedAt).toBeTruthy();

        const pdf = await fetch(`${process.env.API_URL ?? 'http://127.0.0.1:3010/api/v1'}/cases/${caseId}/close/pdf`, {
          headers: { Authorization: `Bearer ${coordToken}` },
          redirect: 'manual',
        });
        expect(pdf.status).toBe(200);
        expect(pdf.headers.get('content-type') ?? '').toContain('application/pdf');
        const bytes = Buffer.from(await pdf.arrayBuffer());
        expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        const text = bytes.toString('latin1');
        expect(text).toContain(`Case #${caseId}`);
        expect(text).toContain('Official case report');
        expect(text).toContain(`Closed after approved BPM evaluation ${tag}`);
      });

      await test.step('company sees the closed outcome and not another organisation\'s records', async () => {
        await company.page.reload();
        await waitForCompanyPortal(company.page);
        await company.page.getByRole('button', { name: /official certificates/i }).click();
        await expect(company.page.getByText(/lácteos del norte/i).first()).toBeVisible();
        await otherCompany.page.reload();
        await waitForCompanyPortalAny(otherCompany.page);
        await expect(otherCompany.page.getByText(motivo)).toHaveCount(0);
      });
    } finally {
      await company.context.close();
      await coordinator.context.close();
      if (technician) await technician.context.close();
      await otherCompany.context.close();
    }
  });
});
