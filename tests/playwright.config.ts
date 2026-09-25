/**
 * playwright.config.ts
 * ---------------------------------------------------------------------------
 * Playwright configuration for RADAR Sanitary E2E tests.
 *
 * Dedicated stack (does not mutate the shared compose database `midb2`):
 *   Frontend: http://127.0.0.1:5174
 *   Backend:  http://127.0.0.1:3010/api/v1
 *   Database: radar_test
 *
 * Two default projects: Chromium desktop and Pixel 5 mobile viewport.
 * Long role-handoff journeys run on Chromium only; Pixel 5 keeps the original
 * auth/navigation coverage plus representative journeys.
 * ---------------------------------------------------------------------------
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPort = process.env.E2E_API_PORT ?? '3010';
const webPort = process.env.E2E_WEB_PORT ?? '5174';
const reuse = process.env.E2E_REUSE === '1';

process.env.TEST_PG_DB ??= 'radar_test';
process.env.API_URL ??= `http://127.0.0.1:${apiPort}/api/v1`;
process.env.BASE_URL ??= `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '../test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: reuse
    ? undefined
    : [
        {
          command: 'node scripts/start-test-backend.mjs',
          cwd: root,
          port: Number(apiPort),
          reuseExistingServer: false,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'node scripts/start-test-frontend.mjs',
          cwd: root,
          url: `http://127.0.0.1:${webPort}`,
          reuseExistingServer: false,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: [
        '**/bpm-lifecycle.spec.ts',
        '**/institutional-scheduling.spec.ts',
        '**/reports-history.spec.ts',
      ],
    },
  ],
});
