import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.UX_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/ux-agent',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-report.json' }],
    ['./scripts/playwrightReportEnricher.mjs'],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'VITE_UX_TEST_MODE=1 npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    port: 4173,
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
