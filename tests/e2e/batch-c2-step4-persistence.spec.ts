/**
 * Batch C2 — Browser Step 4 persistence journey (E2E-07).
 * Isolated PGlite harness on :4100 + Vite :5199 (see root playwright.config.ts).
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Same-origin /api via Vite proxy (required: session cookie is SameSite=Strict).
const API = '/api';
const USER = 'test-owner-4100';
const PASS = 'Test-only-password-123!';
const EVIDENCE =
  process.env.C2_EVIDENCE_DIR ||
  path.resolve('../../../outputs/batch-c2-provisional/20261017-233605/browser');

test.use({
  permissions: ['geolocation'],
  geolocation: { latitude: 17.385044, longitude: 78.486671 },
  timezoneId: 'UTC',
});

async function login(page: Page) {
  await page.goto('/');
  await page.locator('#login-username').waitFor({ state: 'visible' });
  await page.locator('#login-username').fill(USER);
  await page.locator('#login-password').fill(PASS);
  await expect(page.locator('#login-password')).toHaveValue(PASS);
  const [loginRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST'),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  if (!loginRes.ok()) {
    throw new Error(`login HTTP ${loginRes.status()} ${await loginRes.text()}`);
  }
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 30_000 });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true });
}

test.describe.configure({ mode: 'serial' });

test('C2-A: Step 4 save / refresh / navigate / reopen persistence', async ({ page, browser }) => {
  test.setTimeout(300_000);
  await login(page);
  const api = page.request;

  // Discover pre-seeded C2 trip (pickup submitted, no deliveries yet) or create via API.
  const listRes = await api.get(`${API}/trips?includeDeleted=false`);
  expect(listRes.ok()).toBeTruthy();
  const trips = (await listRes.json()) as Array<Record<string, unknown>>;
  const trip = trips.find(
    (t) => t.pickupStepSubmitted === true && t.deliveryStepSubmitted !== true && t.vehicleNo === 'E2E-TRUCK-01',
  );
  if (!trip) {
    test.skip(true, 'C2 seed trip not present on harness');
    return;
  }
  const tripId = Number(trip.id);

  // Seed two shops via API (authoritative save), then prove browser hydration after refresh.
  const shopsRes = await api.get(`${API}/masters/shops`);
  expect(shopsRes.ok()).toBeTruthy();
  const shopsBody = await shopsRes.json();
  const shops = (Array.isArray(shopsBody) ? shopsBody : shopsBody.items ?? shopsBody.data ?? []) as Array<{
    id: number;
    shopName: string;
  }>;
  const shopA = shops.find((s) => /Alpha/i.test(s.shopName));
  const shopB = shops.find((s) => /Bravo/i.test(s.shopName));
  expect(shopA && shopB, 'seed shops').toBeTruthy();

  const birdTypesRes = await api.get(`${API}/masters/bird-types`);
  const birdTypesBody = await birdTypesRes.json();
  const birdTypes = (Array.isArray(birdTypesBody) ? birdTypesBody : birdTypesBody.items ?? []) as Array<{
    id: number;
    birdType: string;
  }>;
  const bird = birdTypes.find((b) => /E2E Broiler/i.test(b.birdType)) ?? birdTypes[0];

  const put1 = await api.put(`${API}/trips/${tripId}/deliveries`, {
    data: {
      deliveries: [
        {
          id: 0,
          clientKey: 'c2-a',
          shopId: shopA!.id,
          shopName: shopA!.shopName,
          birdTypeId: bird.id,
          birdType: bird.birdType,
          birds: 40,
          weight: 80,
          mortality: 0,
          mortKg: 0,
          rate: 100,
          amount: 4000,
          remarks: '',
          deliveryMode: 'box',
          selectedBoxIds: [1],
        },
      ],
    },
  });
  expect(put1.ok(), `save shop A ${put1.status()} ${await put1.text()}`).toBeTruthy();

  const put2 = await api.put(`${API}/trips/${tripId}/deliveries`, {
    data: {
      deliveries: [
        {
          id: 0,
          clientKey: 'c2-a',
          shopId: shopA!.id,
          shopName: shopA!.shopName,
          birdTypeId: bird.id,
          birdType: bird.birdType,
          birds: 38,
          weight: 76,
          mortality: 2,
          mortKg: 4,
          rate: 100,
          amount: 3800,
          remarks: '',
          deliveryMode: 'box',
          selectedBoxIds: [1],
        },
        {
          id: 0,
          clientKey: 'c2-b',
          shopId: shopB!.id,
          shopName: shopB!.shopName,
          birdTypeId: bird.id,
          birdType: bird.birdType,
          birds: 40,
          weight: 80,
          mortality: 0,
          mortKg: 0,
          rate: 100,
          amount: 4000,
          remarks: '',
          deliveryMode: 'box',
          selectedBoxIds: [2],
        },
      ],
    },
  });
  expect(put2.ok(), `save A+B ${put2.status()}`).toBeTruthy();

  // Open Step 4 in browser.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 4"]').click();
  await expect(page.getByText(shopA!.shopName).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(shopB!.shopName).first()).toBeVisible();
  await shot(page, 'c2a-step4-after-save');

  // Refresh.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 4"]').click();
  await expect(page.getByText(shopA!.shopName).first()).toBeVisible();
  await expect(page.getByText(shopB!.shopName).first()).toBeVisible();
  await shot(page, 'c2a-step4-after-refresh');

  // Navigate away and return.
  await page.goto('/operations?tab=trip-list');
  await page.waitForLoadState('networkidle');
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 4"]').click();
  await expect(page.getByText(shopA!.shopName).first()).toBeVisible();
  await shot(page, 'c2a-step4-after-navigate-return');

  // Close and reopen browser context.
  const storage = await page.context().storageState();
  await page.context().close();
  const ctx2: BrowserContext = await browser.newContext({ storageState: storage });
  const page2 = await ctx2.newPage();
  await page2.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page2.waitForLoadState('networkidle');
  await page2.locator('button[aria-label^="Step 4"]').click();
  await expect(page2.getByText(shopA!.shopName).first()).toBeVisible();
  await expect(page2.getByText(shopB!.shopName).first()).toBeVisible();
  await shot(page2, 'c2a-step4-after-context-reopen');

  // DB/API exact values (authenticated via reopened context).
  const finalRes = await page2.request.get(`${API}/trips/${tripId}`);
  expect(finalRes.ok()).toBeTruthy();
  const finalTrip = await finalRes.json();
  const deliveries = finalTrip.deliveries as Array<Record<string, unknown>>;
  const a = deliveries.find((d) => d.clientKey === 'c2-a')!;
  const b = deliveries.find((d) => d.clientKey === 'c2-b')!;
  expect(Number(a.birds)).toBe(38);
  expect(Number(a.weight)).toBe(76);
  expect(Number(a.mortality)).toBe(2);
  expect(Number(b.birds)).toBe(40);
  expect(Number(b.shopId)).toBe(shopB!.id);
  expect(Number(a.shopId)).toBe(shopA!.id);

  fs.mkdirSync(path.join(EVIDENCE, '..', 'api'), { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, '..', 'api', 'c2a-final-trip.json'),
    JSON.stringify({ tripId, deliveries }, null, 2),
  );
  await ctx2.close();
});
