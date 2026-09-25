/**
 * E2E: PWA manifest, service worker registration policy, and offline shell.
 * Vite dev does not register the service worker (`import.meta.env.PROD` in main.tsx).
 */
import { test, expect } from '@playwright/test';
import { USERS, openSignIn, signIn } from './helpers';

test.describe('PWA surface', () => {
  test('document links a web manifest', async ({ page }) => {
    await openSignIn(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toMatch(/manifest\.webmanifest/);
  });

  test('manifest is reachable and names RADAR Sanitary', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/manifest.webmanifest`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toMatch(/RADAR/i);
    expect(body.display).toBe('standalone');
    expect(body.start_url).toBe('/');
  });

  test('service worker file is served', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/sw.js`);
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/radar-shell/);
  });

  test('dev build does not control the page with a service worker', async ({ page }) => {
    await openSignIn(page);
    const controller = await page.evaluate(() => navigator.serviceWorker?.controller?.scriptURL ?? null);
    expect(controller).toBeNull();
  });

  test('offline indicator updates after login', async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.context().setOffline(true);
    await expect(page.getByText('Offline Mode')).toBeVisible();
    await expect(page.getByText(/local storage active/i)).toBeVisible();
    await page.context().setOffline(false);
    await expect(page.getByText('Connected')).toBeVisible();
  });
});
