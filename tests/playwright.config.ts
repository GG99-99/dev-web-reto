/**
 * playwright.config.ts
 * ---------------------------------------------------------------------------
 * Playwright configuration for RADAR Sanitary E2E tests.
 * Frontend: http://localhost:5173 (Vite dev server)
 * Backend:  http://localhost:3000/api/v1
 *
 * Two projects: Chromium desktop and Pixel 5 mobile viewport. Specs are
 * listed once; Playwright executes each spec in every project, so
 * `playwright test --list` counts executions, not unique spec titles.
 * ---------------------------------------------------------------------------
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '../test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
