import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.resolve(__dirname, '../artifacts');

export default defineConfig({
  testDir: path.resolve(__dirname, '../specs'),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(artifactsDir, 'html') }],
    ['json', { outputFile: path.join(artifactsDir, 'report.json') }],
  ],
  outputDir: path.join(artifactsDir, 'results'),
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
});
