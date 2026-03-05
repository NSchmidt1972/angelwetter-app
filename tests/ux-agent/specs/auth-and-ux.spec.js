import process from 'node:process';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { navItemsFor } from '../../../src/config/navItems';

const clubSlug = process.env.UX_CLUB_SLUG || 'asv-rotauge';
const authPath = `/${clubSlug}/auth`;
const mockedClub = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: clubSlug,
};
const mockedWeather = {
  current: {
    temp: 12.4,
    weather: [{ description: 'leicht bewölkt', icon: '03d' }],
    wind_speed: 2.7,
    wind_deg: 135,
    humidity: 78,
    pressure: 1014,
  },
  daily: [{ moon_phase: 0.42 }],
};
const visitedUrlsByPage = new WeakMap();
const menuPathToUxPath = {
  '/': '/__ux/menu/dashboard',
  '/new-catch': '/__ux/menu/new-catch',
  '/crayfish': '/__ux/menu/crayfish',
  '/catches': '/__ux/menu/catches',
  '/leaderboard': '/__ux/menu/leaderboard',
  '/regeln': '/__ux/menu/regeln',
  '/analysis': '/__ux/menu/analysis',
  '/top-fishes': '/__ux/menu/top-fishes',
  '/fun': '/__ux/menu/fun',
  '/forecast': '/__ux/menu/forecast',
  '/calendar': '/__ux/menu/calendar',
  '/map': '/__ux/menu/map',
  '/downloads': '/__ux/menu/downloads',
  '/vorstand': '/__ux/menu/vorstand',
};

function formatViolations(violations) {
  return violations
    .map((item) => `${item.id} (${item.impact || 'unknown'}): ${item.nodes.length} node(s)`)
    .join('\n');
}

function flattenNavPaths(items) {
  return items.flatMap((item) => {
    if (Array.isArray(item.children) && item.children.length > 0) {
      return flattenNavPaths(item.children);
    }
    return item.path ? [item.path] : [];
  });
}

function resolveMenuCoverage() {
  const menuPaths = [
    ...new Set(flattenNavPaths(navItemsFor({ isAdmin: true, canAccessBoard: true }))),
  ];
  const missingMappings = menuPaths.filter((path) => !menuPathToUxPath[path]);
  const uxRoutes = [...new Set(menuPaths.map((path) => menuPathToUxPath[path]).filter(Boolean))];
  return { menuPaths, missingMappings, uxRoutes };
}

async function mockExternalApisForMenuSweep(page) {
  await page.route('**/api.openweathermap.org/data/3.0/onecall**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockedWeather),
    });
  });

  await page.route('**/nominatim.openstreetmap.org/reverse**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        address: { city_district: 'Lobberich' },
        display_name: 'Lobberich, Nettetal',
      }),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const accept = String(request.headers().accept || '').toLowerCase();
    const wantsObject = accept.includes('vnd.pgrst.object+json');

    if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fulfill({
      status: method === 'POST' ? 201 : 200,
      contentType: 'application/json',
      body: wantsObject ? '{}' : '[]',
    });
  });
}

async function verifyVisibleButtonsAreActionable(page) {
  const failures = [];
  let visibleCount = 0;
  let testedCount = 0;
  const buttons = page.getByRole('button');
  const totalCount = await buttons.count();

  for (let index = 0; index < totalCount; index += 1) {
    const button = buttons.nth(index);
    let label = `button-${index + 1}`;

    try {
      if (!(await button.isVisible())) continue;
      visibleCount += 1;

      label = (
        (await button.getAttribute('aria-label')) ||
        (await button.textContent()) ||
        label
      ).replace(/\s+/g, ' ').trim();

      const disabled =
        (await button.isDisabled()) ||
        (await button.getAttribute('aria-disabled')) === 'true';

      if (disabled) continue;

      await button.scrollIntoViewIfNeeded();
      await button.click({ trial: true, timeout: 3000 });
      testedCount += 1;
    } catch (error) {
      const shortMessage = String(error?.message || error).split('\n')[0];
      failures.push(`${label}: ${shortMessage}`);
    }
  }

  return {
    visibleCount,
    testedCount,
    failures,
  };
}

async function mockClubLookup(page) {
  await page.route('**/rest/v1/clubs*', async (route) => {
    const url = route.request().url();
    if (url.includes(`slug=eq.${encodeURIComponent(clubSlug)}`) || url.includes(`slug=eq.${clubSlug}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockedClub]),
      });
      return;
    }
    await route.continue();
  });
}

test.beforeEach(async ({ page }) => {
  const visitedUrls = [];
  visitedUrlsByPage.set(page, visitedUrls);

  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (!url || url === 'about:blank') return;
    visitedUrls.push(url);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const visitedUrls = visitedUrlsByPage.get(page) || [];

  try {
    const currentUrl = page.url();
    if (currentUrl && currentUrl !== 'about:blank') {
      visitedUrls.push(currentUrl);
    }
  } catch (_) {
    // Ignore URL lookup errors if the page is already closed.
  }

  const uniqueVisitedUrls = [...new Set(visitedUrls)];
  await testInfo.attach('visited-routes.txt', {
    body: Buffer.from(
      uniqueVisitedUrls.length ? uniqueVisitedUrls.join('\n') : 'Keine Navigation erfasst.'
    ),
    contentType: 'text/plain',
  });
});

test('auth flow smoke: login/register toggle works without runtime crash', async ({ page }) => {
  await mockClubLookup(page);

  const uncaughtErrors = [];
  page.on('pageerror', (error) => {
    uncaughtErrors.push(error?.message || String(error));
  });

  await page.goto(authPath, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /anmeldung/i })).toBeVisible();
  await page.getByRole('button', { name: /jetzt registrieren/i }).click();
  await expect(page.getByRole('heading', { name: /registrierung/i })).toBeVisible();
  await expect(page.getByPlaceholder(/vor und nachname/i)).toBeVisible();

  await page.getByRole('button', { name: /zur anmeldung/i }).click();
  await expect(page.getByRole('heading', { name: /anmeldung/i })).toBeVisible();

  expect(uncaughtErrors, `Uncaught runtime errors:\n${uncaughtErrors.join('\n')}`).toEqual([]);
});

test('view smoke: zentrale Views rendern ohne Runtime-Fehler', async ({ page }) => {
  const uncaughtErrors = [];
  page.on('pageerror', (error) => {
    uncaughtErrors.push(error?.message || String(error));
  });

  await page.goto('/reset-done', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /link gesendet/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /zurück zur startseite/i })).toBeVisible();

  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /passwort vergessen/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /link zum zurücksetzen senden/i })).toBeVisible();

  await page.goto('/auth-verified', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /e-mail bestätigt/i })).toBeVisible();

  await mockClubLookup(page);
  await page.goto(authPath, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /anmeldung/i })).toBeVisible();

  expect(uncaughtErrors, `Uncaught runtime errors:\n${uncaughtErrors.join('\n')}`).toEqual([]);
});

test('form flow: Fangformular nutzt Testfisch Aal mit 200 cm', async ({ page, context }) => {
  const uncaughtErrors = [];
  const dialogs = [];
  let capturedFishInsert = null;

  page.on('pageerror', (error) => {
    uncaughtErrors.push(error?.message || String(error));
  });

  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 51.3135, longitude: 6.256 });

  await page.route('**/api.openweathermap.org/data/3.0/onecall**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockedWeather),
    });
  });

  await page.route('**/nominatim.openstreetmap.org/reverse**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        address: { city_district: 'Lobberich' },
        display_name: 'Lobberich, Nettetal',
      }),
    });
  });

  await page.route('**/rest/v1/fishes*', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const raw = route.request().postData() || '[]';
    const payload = JSON.parse(raw);
    capturedFishInsert = Array.isArray(payload) ? payload[0] : payload;

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-fish-aal-200',
        ...capturedFishInsert,
      }),
    });
  });

  await page.goto('/__ux/fish-form', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /fang eintragen/i })).toBeVisible();

  await page.locator('select').nth(1).selectOption('Aal');
  await page.getByPlaceholder(/z\. B\. 35 cm/i).fill('200');
  await page.getByPlaceholder(/besondere umstände/i).fill('Playwright Testfisch Aal 200cm');

  await page.getByRole('button', { name: /fang speichern/i }).click();
  await expect(page.getByRole('heading', { name: /wurde der fisch entnommen/i })).toBeVisible();

  const saveResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'POST' && response.url().includes('/rest/v1/fishes');
  });

  await page.getByRole('button', { name: /nein/i }).click();
  await saveResponsePromise;

  expect(capturedFishInsert?.fish).toBe('Aal');
  expect(capturedFishInsert?.size).toBe(200);
  expect(dialogs, `Unexpected browser dialogs:\n${dialogs.join('\n')}`).toEqual([]);
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

test('menu sweep: alle Menüpunkte und Buttons sind erreichbar', async ({ page, context }) => {
  test.setTimeout(120000);

  const { missingMappings, uxRoutes } = resolveMenuCoverage();
  expect(missingMappings, `Missing UX route mapping for menu paths:\n${missingMappings.join('\n')}`).toEqual([]);

  const uncaughtErrors = [];
  page.on('pageerror', (error) => {
    uncaughtErrors.push(error?.message || String(error));
  });

  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 51.3135, longitude: 6.256 });
  await mockExternalApisForMenuSweep(page);
  await mockClubLookup(page);

  const routeSummaries = [];
  for (const route of uxRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page
      .waitForFunction(() => !document.body?.innerText?.includes('⏳ Lädt...'), null, {
        timeout: 7000,
      })
      .catch(() => {});
    await expect(page.getByText(/seite nicht gefunden/i)).toHaveCount(0);
    await expect(page.getByText(/club not found/i)).toHaveCount(0);

    const buttonResult = await verifyVisibleButtonsAreActionable(page);
    routeSummaries.push({
      route,
      ...buttonResult,
    });
  }

  const buttonFailures = routeSummaries
    .filter((summary) => summary.failures.length > 0)
    .map((summary) => `${summary.route}:\n${summary.failures.join('\n')}`);

  expect(buttonFailures, `Nicht klickbare Buttons gefunden:\n${buttonFailures.join('\n\n')}`).toEqual([]);
  expect(
    routeSummaries.some((summary) => summary.visibleCount > 0),
    `Keine sichtbaren Buttons im Menue-Sweep gefunden.\n${JSON.stringify(routeSummaries, null, 2)}`
  ).toBeTruthy();
  expect(uncaughtErrors, `Uncaught runtime errors:\n${uncaughtErrors.join('\n')}`).toEqual([]);
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
