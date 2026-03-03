import process from 'node:process';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const clubSlug = process.env.UX_CLUB_SLUG || 'asv-rotauge';
const authPath = `/${clubSlug}/auth`;

function formatViolations(violations) {
  return violations
    .map((item) => `${item.id} (${item.impact || 'unknown'}): ${item.nodes.length} node(s)`)
    .join('\n');
}

async function authRouteAvailable(page) {
  const authHeading = page.getByRole('heading', { name: /anmeldung|registrierung/i });
  if (await authHeading.isVisible({ timeout: 4000 }).catch(() => false)) return true;

  const clubNotFound = page.getByText(/club not found/i);
  if (await clubNotFound.isVisible({ timeout: 1000 }).catch(() => false)) return false;

  return false;
}

test('auth flow smoke: login/register toggle works without runtime crash', async ({ page }) => {
  const uncaughtErrors = [];
  page.on('pageerror', (error) => {
    uncaughtErrors.push(error?.message || String(error));
  });

  await page.goto(authPath, { waitUntil: 'domcontentloaded' });

  const available = await authRouteAvailable(page);
  test.skip(!available, `Auth page not reachable. Set UX_CLUB_SLUG to a valid slug (current: "${clubSlug}").`);

  await expect(page.getByRole('heading', { name: /anmeldung/i })).toBeVisible();
  await page.getByRole('button', { name: /jetzt registrieren/i }).click();
  await expect(page.getByRole('heading', { name: /registrierung/i })).toBeVisible();
  await expect(page.getByPlaceholder(/vor und nachname/i)).toBeVisible();

  await page.getByRole('button', { name: /zur anmeldung/i }).click();
  await expect(page.getByRole('heading', { name: /anmeldung/i })).toBeVisible();

  expect(uncaughtErrors, `Uncaught runtime errors:\n${uncaughtErrors.join('\n')}`).toEqual([]);
});

test('ux baseline: reset-done has no horizontal overflow and primary target is touch-friendly', async ({ page }) => {
  await page.goto('/reset-done', { waitUntil: 'domcontentloaded' });

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  const primaryAction = page.getByRole('link', { name: /zurück zur startseite/i });
  await expect(primaryAction).toBeVisible();

  const box = await primaryAction.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
});

test('public password-recovery route renders core controls', async ({ page }) => {
  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /passwort vergessen/i })).toBeVisible();
  await expect(page.getByPlaceholder(/deine e-mail-adresse/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /link zum zurücksetzen senden/i })).toBeVisible();
});

test('a11y audit: no serious/critical axe violations on reset-done', async ({ page }) => {
  await page.goto('/reset-done', { waitUntil: 'domcontentloaded' });

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const seriousOrCritical = results.violations.filter((item) =>
    ['serious', 'critical'].includes(item.impact || '')
  );

  expect(
    seriousOrCritical,
    `Serious/Critical accessibility violations:\n${formatViolations(seriousOrCritical)}`
  ).toEqual([]);
});
