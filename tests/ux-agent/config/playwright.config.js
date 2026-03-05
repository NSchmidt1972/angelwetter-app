import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.UX_BASE_URL || 'http://127.0.0.1:4173';
const artifactsDir = path.resolve(__dirname, '../artifacts');
const screenshotMode = process.env.UX_CAPTURE_SCREENSHOTS === '0' ? 'only-on-failure' : 'on';

export default defineConfig({
  testDir: path.resolve(__dirname, '../specs'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(artifactsDir, 'playwright', 'html') }],
    ['json', { outputFile: path.join(artifactsDir, 'playwright', 'report.json') }],
    [path.resolve(__dirname, '../scripts/playwrightReportEnricher.mjs')],
  ],
  outputDir: path.join(artifactsDir, 'playwright', 'results'),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: screenshotMode,
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'VITE_UX_TEST_MODE=1 npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    port: 4173,
    timeout: 180000,
    // UX tests require a test-mode build; reusing arbitrary local servers makes them flaky.
    reuseExistingServer: false,
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
