/**
 * UI journey: organisation self-registration, pending gate, approve and reject (RF-02).
 */
import { test, expect } from '@playwright/test';
import {
  PASSWORD,
  USERS,
  clickNav,
  fillSignup,
  uniqueCedula,
  uniqueEmail,
  uniqueTag,
  openSignIn,
  fillSignIn,
  submitSignIn,
  signIn,
  waitForCompanyPortalAny,
  deactivateE2eUsers,
  apiLogin,
  apiGet,
  apiJson,
} from './helpers';

test.describe('Registration approval and rejection', () => {
  test.afterEach(async () => {
    await deactivateE2eUsers();
  });

  test('new company administrator is pending until an admin approves the request', async ({ browser }) => {
    test.setTimeout(90_000);
    const tag = uniqueTag('reg');
    const email = uniqueEmail('admin');
    const name = `E2E Admin ${tag}`;
    const cedula = uniqueCedula();

    const applicant = await browser.newContext();
    const applicantPage = await applicant.newPage();
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    try {
      await test.step('sign-up uploads the authorization letter and links it to the applicant', async () => {
        await openSignIn(applicantPage);
        const registered = applicantPage.waitForResponse((res) =>
          res.url().includes('/users/register')
          && res.request().method() === 'POST'
          && !res.url().includes('authorization-letter')
          && res.ok(),
        );
        await fillSignup(applicantPage, { name, email, cedula, role: 'admin' });
        await expect(applicantPage.getByLabel(/authorization letter/i)).toBeVisible();
        await applicantPage.getByRole('button', { name: /submit access request/i }).click();
        const response = await registered;
        const payload = await response.json() as { data?: { userId?: number } };
        const requestBody = response.request().postDataJSON() as { cartaAutorizacionFileId?: number };
        expect(requestBody.cartaAutorizacionFileId).toBeGreaterThan(0);
        const admin = await apiLogin(USERS.admin);
        const attachment = await apiGet(`/attachments/${requestBody.cartaAutorizacionFileId}`, admin.accessToken);
        expect(attachment.status).toBe(200);
        const file = (attachment.data as { data?: { userRegistrationId?: number; fileName?: string; category?: string } }).data;
        expect(file?.userRegistrationId).toBe(payload.data?.userId);
        expect(file?.fileName).toContain('authorization-letter');
        expect(file?.category).toBe('CARTA_AUTORIZACION');
        await expect(applicantPage.getByRole('status')).toContainText(/administrator must approve/i);
      });

      await test.step('pending applicant sees the pending-approval message', async () => {
        await fillSignIn(applicantPage, email);
        await submitSignIn(applicantPage);
        await expect(applicantPage.locator('.app-shell')).toHaveCount(0);
        await expect(applicantPage.getByRole('status')).toContainText(/pending approval/i);
        await expect(applicantPage.getByRole('status')).toContainText(/notify you when access is available/i);
      });

      await test.step('administrator finds and approves the applicant', async () => {
        await signIn(adminPage, USERS.admin);
        await clickNav(adminPage, /user validation/i);
        await expect(adminPage.getByRole('heading', { name: /user validation and approval/i })).toBeVisible();
        await adminPage.getByPlaceholder(/search by name, id, or email/i).fill(email);
        const row = adminPage.locator('tr', { hasText: email });
        await expect(row).toBeVisible();
        await expect(row.getByText(/^pending$/i)).toBeVisible();
        await row.locator('button.uap-btn-approve').scrollIntoViewIfNeeded();
        await row.locator('button.uap-btn-approve').click();
        await expect(adminPage.locator('.notice[role="status"], .ops-message[role="status"]')).toBeVisible({ timeout: 15_000 });
      });

      await test.step('approved applicant signs in to the company portal', async () => {
        await openSignIn(applicantPage);
        await fillSignIn(applicantPage, email);
        await submitSignIn(applicantPage);
        await expect(applicantPage.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
        await waitForCompanyPortalAny(applicantPage);
        await expect(applicantPage.getByRole('button', { name: /my bpm requests/i })).toBeVisible();
        await expect(applicantPage.getByRole('heading', { name: /portal de autogestión/i })).toBeVisible();
      });
    } finally {
      await applicant.close();
      await adminCtx.close();
    }
  });

  test('administrator can reject an applicant and the user stays blocked', async ({ browser }) => {
    test.setTimeout(90_000);
    const tag = uniqueTag('rej');
    const email = uniqueEmail('rej');
    const name = `E2E Reject ${tag}`;
    const applicant = await browser.newContext();
    const applicantPage = await applicant.newPage();
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    try {
      await openSignIn(applicantPage);
      await fillSignup(applicantPage, { name, email, cedula: uniqueCedula(), role: 'delegate' });
      await applicantPage.getByRole('button', { name: /submit access request/i }).click();
      await expect(applicantPage.getByRole('status')).toContainText(/administrator must approve/i);

      await signIn(adminPage, USERS.admin);
      await clickNav(adminPage, /user validation/i);
      await adminPage.getByPlaceholder(/search by name, id, or email/i).fill(email);
      const row = adminPage.locator('tr', { hasText: email });
      await expect(row).toBeVisible();
      await row.locator('button.uap-btn-reject').scrollIntoViewIfNeeded();
      await row.locator('button.uap-btn-reject').click();
      await expect(adminPage.getByRole('heading', { name: /reject user request/i })).toBeVisible();
      await adminPage.getByPlaceholder(/illegible id/i).fill('E2E rejection: incomplete authorization package');
      await adminPage.getByRole('button', { name: /confirm rejection/i }).click();
      await expect(adminPage.locator('.notice[role="status"], .ops-message[role="status"]')).toBeVisible({ timeout: 15_000 });

      await openSignIn(applicantPage);
      await fillSignIn(applicantPage, email, PASSWORD);
      await submitSignIn(applicantPage);
      await expect(applicantPage.locator('.app-shell')).toHaveCount(0);
      await expect(applicantPage.getByRole('status')).toContainText(/not approved/i);
      await expect(applicantPage.getByRole('status')).toContainText(/organisation administrator/i);
    } finally {
      await applicant.close();
      await adminCtx.close();
    }
  });

  test('deactivated applicant leaves the pending validation list', async ({ browser }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail('gone');
    const applicant = await browser.newContext();
    const applicantPage = await applicant.newPage();
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    try {
      await openSignIn(applicantPage);
      await fillSignup(applicantPage, {
        name: `E2E Inactive ${uniqueTag('off')}`,
        email,
        cedula: uniqueCedula(),
        role: 'delegate',
      });
      await applicantPage.getByRole('button', { name: /submit access request/i }).click();
      await expect(applicantPage.getByRole('status')).toContainText(/administrator must approve/i);

      await signIn(adminPage, USERS.admin);
      await clickNav(adminPage, /user validation/i);
      await adminPage.getByPlaceholder(/search by name, id, or email/i).fill(email);
      await expect(adminPage.locator('tr', { hasText: email })).toBeVisible();

      const admin = await apiLogin(USERS.admin);
      const listed = await apiGet('/users?status=PENDIENTE_VALIDACION&page=1&pageSize=100', admin.accessToken);
      const items = (listed.data as { data?: { items?: Array<{ userId: number; person?: { email?: string } }> } }).data?.items ?? [];
      const userId = items.find((user) => user.person?.email === email)?.userId;
      expect(userId).toBeTruthy();
      const removed = await apiJson('DELETE', `/users/${userId}`, { token: admin.accessToken });
      expect(removed.status).toBe(200);

      await adminPage.reload();
      await clickNav(adminPage, /user validation/i);
      await adminPage.getByPlaceholder(/search by name, id, or email/i).fill(email);
      await expect(adminPage.locator('tr', { hasText: email })).toHaveCount(0);
    } finally {
      await applicant.close();
      await adminCtx.close();
    }
  });

  test('sign-up blocks empty required fields', async ({ page }) => {
    await openSignIn(page);
    await page.getByRole('button', { name: /create an organisation account/i }).click();
    await page.getByRole('button', { name: /submit access request/i }).click();
    const name = page.getByLabel(/^full name$/i);
    const valid = await name.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });
});
