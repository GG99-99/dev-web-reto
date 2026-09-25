/**
 * Shared Playwright helpers. Locators prefer accessible names and labels.
 */
import { expect, type Browser, type Page } from '@playwright/test';

export const PASSWORD = process.env.TEST_PASSWORD ?? 'Password123!';
export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3010/api/v1';

export const USERS = {
  admin: 'admin@salud.gob.do',
  coordinator: 'coordinador@salud.gob.do',
  technician: 'tecnico1@salud.gob.do',
  technician2: 'tecnico2@salud.gob.do',
  company: 'admin@lacteosdelnorte.do',
  delegate: 'delegado@lacteosdelnorte.do',
  companyB: 'admin@panaderiaelsol.do',
};

export const TECH_NAMES = {
  technician: 'Luis Fernández',
  technician2: 'Rosa Jiménez',
};

export async function clearSession(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('radar-session'));
}

export async function openSignIn(page: Page) {
  await clearSession(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: /sign in to your workspace/i })).toBeVisible();
}

export async function fillSignIn(page: Page, usuario: string, password = PASSWORD) {
  await page.getByLabel(/work email or national id/i).fill(usuario);
  await page.getByLabel(/^password$/i).fill(password);
}

export async function submitSignIn(page: Page) {
  await page.getByRole('button', { name: /sign in to radar/i }).click();
}

export async function signIn(page: Page, usuario: string, password = PASSWORD) {
  await openSignIn(page);
  await fillSignIn(page, usuario, password);
  await submitSignIn(page);
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page.getByRole('heading', { name: /sign in to your workspace/i })).toBeVisible();
}

export function navButton(page: Page, label: string | RegExp) {
  return page.locator('aside nav').getByRole('button', { name: label });
}

/** Open the off-canvas sidebar on narrow viewports before navigating. */
export async function ensureNavOpen(page: Page) {
  const hamburger = page.getByRole('button', { name: /open navigation/i });
  if (await hamburger.isVisible()) {
    const sidebar = page.locator('aside.sidebar');
    const open = await sidebar.evaluate((el) => el.classList.contains('sidebar--open'));
    if (!open) await hamburger.click();
    await expect(page.locator('aside.sidebar--open')).toBeVisible();
  }
}

export async function clickNav(page: Page, label: string | RegExp) {
  await ensureNavOpen(page);
  await navButton(page, label).click();
}

/** Wait until the company portal has loaded a linked establishment. */
export async function waitForCompanyPortal(page: Page) {
  await expect(page.locator('.company-portal')).toBeVisible();
  await expect(page.locator('.cp-hero h1')).not.toHaveText(/Portal de Autogestión/i, {
    timeout: 20_000,
  });
}

export async function waitForCompanyPortalAny(page: Page) {
  await expect(page.locator('.company-portal')).toBeVisible({ timeout: 20_000 });
}

export async function openNewBpmRequest(page: Page) {
  await waitForCompanyPortal(page);
  await page.locator('.cp-hero-actions').getByRole('button', { name: /new bpm request/i }).click();
  await expect(page.getByRole('heading', { name: /new bpm evaluation request/i })).toBeVisible();
}

export function uniqueTag(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function uniqueEmail(prefix = 'e2e') {
  return `${uniqueTag(prefix)}@e2e.radar.test`;
}

export function uniqueCedula() {
  const n = String(Date.now()).slice(-7).padStart(7, '0');
  const d = Math.floor(Math.random() * 10);
  return `088-${n}-${d}`;
}

export function uniqueRnc() {
  return `1${String(Date.now()).slice(-8)}`;
}

export function localDateTimeInput(hoursAhead = 3) {
  const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const LETTER_BYTES = Buffer.from(
  'RADAR E2E authorization letter / commercial registry placeholder\n',
  'utf8',
);

export async function openRoleSession(browser: Browser, usuario: string, password = PASSWORD) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, usuario, password);
  return { context, page };
}

export function statusNotice(page: Page) {
  return page.locator('.notice[role="status"], .auth-notice[role="status"], .ops-message[role="status"]');
}

export async function notice(page: Page) {
  return statusNotice(page);
}

/** Playwright `selectOption({ label })` only accepts a string; use this for partial option text. */
export async function selectByOptionText(page: Page, field: string | RegExp, optionText: string | RegExp) {
  const combobox = page.getByRole('combobox', { name: field });
  const select = (await combobox.count()) > 0 ? combobox.first() : page.getByLabel(field);
  await expect(select).toBeVisible();
  const option = select.locator('option').filter({ hasText: optionText });
  await expect(option.first()).toBeAttached();
  const value = await option.first().getAttribute('value');
  expect(value, `option matching ${optionText} should have a value`).toBeTruthy();
  await select.selectOption(value!);
}

export async function expectNotice(page: Page, pattern: RegExp) {
  await expect(statusNotice(page).filter({ hasText: pattern }).first()).toBeVisible({
    timeout: 20_000,
  });
}

export function intakeItem(page: Page, text: string | RegExp) {
  return page.locator('.ops-list > div').filter({ hasText: text });
}

export async function acceptNextDialog(page: Page) {
  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
}

export async function apiJson(method: string, path: string, options: {
  token?: string | null;
  body?: unknown;
  redirect?: RequestRedirect;
} = {}) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    redirect: options.redirect ?? 'follow',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers, text };
}

export async function createApprovedCompanyUser(namePrefix = 'iso') {
  const admin = await apiLogin(USERS.admin);
  const email = uniqueEmail(namePrefix);
  const cedula = uniqueCedula();
  const rolesRes = await apiJson('GET', '/roles', { token: admin.accessToken });
  const rolesBody = rolesRes.data as { valid?: boolean; data?: Array<{ roleId: number; name: string }> };
  const roleId = (Array.isArray(rolesBody.data) ? rolesBody.data : []).find((r) => r.name === 'ADMIN_EMPRESA')?.roleId;
  if (!roleId) throw new Error('ADMIN_EMPRESA role not found');
  const created = await apiJson('POST', '/users/register', {
    token: null,
    body: {
      person: { name: `E2E ${namePrefix} ${uniqueTag('n')}`, email, cedula, phone: '809-555-0188' },
      password: PASSWORD,
      roleId,
    },
  });
  const createdBody = created.data as { valid?: boolean; data?: { userId?: number; user?: { userId?: number } } };
  const userId = createdBody.data?.userId ?? createdBody.data?.user?.userId;
  if (!userId) throw new Error(`register failed: ${JSON.stringify(created.data)}`);
  const approved = await apiJson('PATCH', `/users/${userId}/status`, {
    token: admin.accessToken,
    body: { status: 'APROBADO' },
  });
  if (approved.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approved.data)}`);
  return { email, userId, cedula };
}

export async function deactivateE2eUsers() {
  try {
    const admin = await apiLogin(USERS.admin);
    const listed = await apiJson('GET', '/users?page=1&pageSize=100', { token: admin.accessToken });
    const body = listed.data as { valid?: boolean; data?: { items?: Array<{ userId: number; person?: { email?: string } }> } };
    for (const user of body.data?.items ?? []) {
      if (user.person?.email?.endsWith('@e2e.radar.test')) {
        await apiJson('DELETE', `/users/${user.userId}`, { token: admin.accessToken });
      }
    }
  } catch {
    // Teardown must not hide the original failure.
  }
}

export async function apiLogin(usuario: string, password = PASSWORD) {
  const res = await apiJson('POST', '/auth/login', {
    token: null,
    body: { usuario, password },
  });
  if (res.status !== 200) {
    throw new Error(`apiLogin(${usuario}) failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  const payload = res.data as { valid?: boolean; data?: { accessToken?: string; user?: { userId?: number }; requiresTwoFactor?: boolean } };
  if (!payload.valid || payload.data?.requiresTwoFactor || !payload.data?.accessToken) {
    throw new Error(`apiLogin(${usuario}) unexpected payload: ${JSON.stringify(res.data)}`);
  }
  return payload.data as { accessToken: string; user?: { userId?: number } };
}

export async function apiGet(path: string, token: string) {
  return apiJson('GET', path, { token });
}

export function expectedRisk(values: Array<'C' | 'CP' | 'NC' | 'N/A'>) {
  const applicable = values.filter((v) => v !== 'N/A');
  const weight = { C: 1, CP: 0.5, NC: 0 };
  const avg = applicable.reduce((sum, v) => sum + weight[v], 0) / applicable.length;
  const porcentajeCumplimiento = Number((avg * 100).toFixed(2));
  const puntajeObtenido = Number(((1 - avg) * 10).toFixed(2));
  let nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' = 'BAJO';
  let frecuenciaInspeccion: 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL' = 'ANUAL';
  if (puntajeObtenido > 6.3) {
    nivelRiesgo = 'ALTO';
    frecuenciaInspeccion = 'TRIMESTRAL';
  } else if (puntajeObtenido > 3.6) {
    nivelRiesgo = 'MEDIO';
    frecuenciaInspeccion = 'SEMESTRAL';
  }
  return { porcentajeCumplimiento, puntajeObtenido, nivelRiesgo, frecuenciaInspeccion };
}

export async function fillSignup(page: Page, data: {
  name: string;
  email: string;
  cedula: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  role?: 'admin' | 'delegate';
}) {
  await page.getByRole('button', { name: /create an organisation account/i }).click();
  await expect(page.getByRole('heading', { name: /create your organisation account/i })).toBeVisible();
  await page.getByLabel(/^full name$/i).fill(data.name);
  await page.getByLabel(/^work email$/i).fill(data.email);
  await page.getByLabel(/national id/i).fill(data.cedula);
  await page.getByLabel(/phone number/i).fill(data.phone ?? '809-555-0199');
  await page.getByLabel(/account type/i).selectOption(data.role === 'delegate' ? '3' : '2');
  await page.getByLabel(/create password/i).fill(data.password ?? PASSWORD);
  await page.getByLabel(/confirm password/i).fill(data.confirmPassword ?? data.password ?? PASSWORD);
  await page.getByLabel(/authorization letter/i).setInputFiles({
    name: 'authorization-letter.txt',
    mimeType: 'text/plain',
    buffer: LETTER_BYTES,
  });
}

export async function registerEstablishment(page: Page, data: {
  name: string;
  rnc: string;
  tradeName?: string;
  activity?: string;
  province?: string;
  municipality?: string;
  street?: string;
  streetNum?: string;
  phone?: string;
  email?: string;
}) {
  await page.locator('.cp-hero-actions').getByRole('button', { name: /register establishment/i }).click();
  await expect(page.getByRole('heading', { name: /register establishment/i })).toBeVisible();
  await page.getByLabel(/legal company name/i).fill(data.name);
  if (data.tradeName) await page.getByLabel(/trade name/i).fill(data.tradeName);
  await page.getByLabel(/^rnc/i).fill(data.rnc);
  await page.getByLabel(/economic activity/i).fill(data.activity ?? 'Food processing');
  await page.getByLabel(/^province/i).selectOption({ label: data.province ?? 'Santiago' });
  await expect(page.getByLabel(/^municipality/i)).toBeEnabled();
  await page.getByLabel(/^municipality/i).selectOption({ label: data.municipality ?? 'Santiago de los Caballeros' });
  await page.getByLabel(/street \/ avenue/i).fill(data.street ?? 'Calle E2E');
  await page.getByLabel(/street number/i).fill(data.streetNum ?? '10');
  await page.getByLabel(/^phone/i).fill(data.phone ?? '809-555-4400');
  await page.getByLabel(/^email/i).fill(data.email ?? uniqueEmail('plant'));
  await page.getByRole('button', { name: /^register establishment$/i }).last().click();
}

export async function answerVisibleCriteria(page: Page, choose: (index: number) => 'C' | 'CP' | 'NC' | 'N/A') {
  const chapterButtons = page.locator('.chapter-nav-btn');
  await expect(chapterButtons.first()).toBeVisible({ timeout: 20_000 });
  const chapterCount = await chapterButtons.count();
  const recorded: Array<'C' | 'CP' | 'NC' | 'N/A'> = [];
  let questionIndex = 0;
  for (let i = 0; i < chapterCount; i++) {
    await chapterButtons.nth(i).click();
    const cards = page.locator('article.criteria-card');
    await expect(cards.first()).toBeVisible();
    const n = await cards.count();
    for (let j = 0; j < n; j++) {
      const card = cards.nth(j);
      const value = choose(questionIndex);
      recorded.push(value);
      const name =
        value === 'C'
          ? /\[ C \] Complies/
          : value === 'CP'
            ? /\[ CP \] Partial/
            : value === 'NC'
              ? /\[ NC \] Does Not Comply/
              : /\[ N\/A \] Exempt/;
      await card.getByRole('button', { name }).click();
      if (value === 'NC' || value === 'CP') {
        await card.locator('textarea').fill(`E2E observation for criterion ${questionIndex + 1}`);
      }
      questionIndex += 1;
    }
  }
  return recorded;
}
