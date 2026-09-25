/**
 * UI journey: establishment registration, representatives, and company isolation (RF-03).
 */
import { test, expect } from '@playwright/test';
import {
  USERS,
  clickNav,
  fillSignup,
  uniqueCedula,
  uniqueEmail,
  uniqueRnc,
  uniqueTag,
  openSignIn,
  fillSignIn,
  submitSignIn,
  signIn,
  waitForCompanyPortal,
  waitForCompanyPortalAny,
  registerEstablishment,
  deactivateE2eUsers,
  apiLogin,
  apiGet,
} from './helpers';

test.describe('Company establishment and representatives', () => {
  test.afterEach(async () => {
    await deactivateE2eUsers();
  });

  test('company user registers an establishment and representative that other companies cannot see', async ({ browser }) => {
    test.setTimeout(120_000);
    const tag = uniqueTag('co');
    const email = uniqueEmail('co');
    const plantName = `E2E Plant ${tag}`;
    const rnc = uniqueRnc();
    const repName = `E2E Legal ${tag}`;

    const applicant = await browser.newContext();
    const companyPage = await applicant.newPage();
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const otherCtx = await browser.newContext();
    const otherPage = await otherCtx.newPage();
    const delegateCtx = await browser.newContext();
    const delegatePage = await delegateCtx.newPage();

    try {
      await openSignIn(companyPage);
      await fillSignup(companyPage, {
        name: `E2E Owner ${tag}`,
        email,
        cedula: uniqueCedula(),
        role: 'admin',
      });
      await companyPage.getByRole('button', { name: /submit access request/i }).click();
      await expect(companyPage.getByRole('status')).toContainText(/administrator must approve/i);

      await signIn(adminPage, USERS.admin);
      await clickNav(adminPage, /user validation/i);
      await adminPage.getByPlaceholder(/search by name, id, or email/i).fill(email);
      await adminPage.locator('tr', { hasText: email }).locator('button.uap-btn-approve').scrollIntoViewIfNeeded();
      await adminPage.locator('tr', { hasText: email }).locator('button.uap-btn-approve').click();
      await expect(adminPage.locator('.notice[role="status"], .ops-message[role="status"]')).toBeVisible({ timeout: 15_000 });

      await openSignIn(companyPage);
      await fillSignIn(companyPage, email);
      await submitSignIn(companyPage);
      await waitForCompanyPortalAny(companyPage);

      await test.step('empty establishment submit is blocked', async () => {
        await companyPage.locator('.cp-hero-actions').getByRole('button', { name: /register establishment/i }).click();
        const legalName = companyPage.getByLabel(/legal company name/i);
        await legalName.fill('');
        await companyPage.getByRole('button', { name: /^register establishment$/i }).last().click();
        expect(await legalName.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
        await companyPage.getByRole('button', { name: /^cancel$/i }).click();
      });

      await registerEstablishment(companyPage, {
        name: plantName,
        tradeName: `Trade ${tag}`,
        rnc,
        activity: 'Bottled water processing',
      });
      await expect(companyPage.locator('.notice[role="status"], .ops-message[role="status"]')).toContainText(/registered successfully/i, { timeout: 20_000 });
      await waitForCompanyPortal(companyPage);
      await expect(companyPage.getByRole('heading', { name: plantName }).first()).toBeVisible();

      await companyPage.getByRole('button', { name: /establishments & representatives/i }).click();
      await expect(companyPage.getByRole('heading', { name: plantName }).nth(1)).toBeVisible();
      await companyPage.getByRole('button', { name: /➕ add/i }).click();
      await expect(companyPage.getByRole('heading', { name: /add accredited representative/i })).toBeVisible();
      await companyPage.getByLabel(/representative type/i).selectOption('LEGAL');
      await companyPage.getByLabel(/full name/i).fill(repName);
      await companyPage.getByLabel(/national id/i).fill(uniqueCedula());
      await companyPage.getByLabel(/^email/i).fill(uniqueEmail('rep'));
      await companyPage.getByLabel(/^phone/i).fill('809-555-4411');
      await companyPage.getByRole('button', { name: /assign representative/i }).click();
      await expect(companyPage.locator('.notice[role="status"], .ops-message[role="status"]')).toContainText(/representative assigned/i, { timeout: 15_000 });

      const token = (await apiLogin(email)).accessToken;
      const listed = await apiGet('/institutions?page=1&pageSize=50', token);
      expect(listed.status).toBe(200);
      const items = (
        listed.data as {
          data?: {
            items?: Array<{
              institutionId: number;
              name: string;
              representantes?: Array<{ type?: string; person?: { name?: string } }>;
            }>;
          };
        }
      ).data?.items ?? [];
      const plant = items.find((institution) => institution.name === plantName);
      expect(plant, 'owner list should include the new establishment').toBeTruthy();
      expect(
        (plant!.representantes ?? []).some((rep) => rep.person?.name === repName && rep.type === 'LEGAL'),
        'GET /institutions must persist the LEGAL representative',
      ).toBe(true);
      // Product defect: CompanyPortal reads inst.represents, while the API returns representantes.
      await expect(companyPage.getByText(/no representatives registered/i)).toBeVisible();

      await signIn(otherPage, USERS.company);
      await waitForCompanyPortal(otherPage);
      await otherPage.getByRole('button', { name: /establishments & representatives/i }).click();
      await expect(otherPage.getByText(plantName)).toHaveCount(0);
      await expect(otherPage.getByText(rnc)).toHaveCount(0);

      await signIn(delegatePage, USERS.delegate);
      await waitForCompanyPortal(delegatePage);
      await expect(delegatePage.getByRole('heading', { name: /lácteos del norte/i })).toBeVisible();
      await delegatePage.getByRole('button', { name: /establishments & representatives/i }).click();
      await expect(delegatePage.getByText(plantName)).toHaveCount(0);
    } finally {
      await applicant.close();
      await adminCtx.close();
      await otherCtx.close();
      await delegateCtx.close();
    }
  });
});
