import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared Batch C3 browser helpers. Isolated harness only:
 * Vite :5199 (same-origin /api proxy) -> PGlite harness :4100.
 */
export const API = '/api';
export const EVIDENCE = process.env.C3_EVIDENCE_DIR
  ? path.resolve(process.env.C3_EVIDENCE_DIR)
  : path.resolve('../../outputs/batch-c3-provisional/browser');
export const BROWSER_DIR = path.join(EVIDENCE, 'browser');
export const API_DIR = path.join(EVIDENCE, 'api');

export function ensureDirs() {
  fs.mkdirSync(BROWSER_DIR, { recursive: true });
  fs.mkdirSync(API_DIR, { recursive: true });
}

export async function shot(page: Page, name: string) {
  ensureDirs();
  await page.screenshot({ path: path.join(BROWSER_DIR, `${name}.png`), fullPage: true });
}

export function saveJson(name: string, value: unknown) {
  ensureDirs();
  fs.writeFileSync(path.join(API_DIR, `${name}.json`), JSON.stringify(value, null, 2));
}

export async function login(page: Page) {
  await page.goto('/');
  await page.locator('#login-username').fill('test-owner-4100');
  await page.locator('#login-password').fill('Test-only-password-123!');
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 30_000 });
  // The PGlite test gateway shares one session across pool connections, so let
  // the post-login burst finish before issuing API writes from the test.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_500);
}

export async function rows(response: { json: () => Promise<unknown> }) {
  const value = (await response.json()) as unknown;
  const record = value as Record<string, unknown>;
  if (Array.isArray(value)) return value as Array<Record<string, any>>;
  for (const key of ['items', 'data', 'rows', 'results']) {
    if (Array.isArray(record[key])) return record[key] as Array<Record<string, any>>;
  }
  return [] as Array<Record<string, any>>;
}

export type Fixtures = {
  vehicles: Array<Record<string, any>>;
  employees: Array<Record<string, any>>;
  farms: Array<Record<string, any>>;
  birds: Array<Record<string, any>>;
  shops: Array<Record<string, any>>;
};

export async function fixtures(page: Page): Promise<Fixtures> {
  const [vehicles, employees, farms, birds, shops] = await Promise.all([
    page.request.get(`${API}/masters/vehicles`),
    page.request.get(`${API}/masters/employees`),
    page.request.get(`${API}/masters/farms`),
    page.request.get(`${API}/masters/bird-types`),
    page.request.get(`${API}/masters/shops`),
  ]);
  return {
    vehicles: await rows(vehicles),
    employees: await rows(employees),
    farms: await rows(farms),
    birds: await rows(birds),
    shops: await rows(shops),
  };
}

export async function createTrip(
  request: APIRequestContext | Page['request'],
  options: {
    rental?: boolean;
    boxes?: Array<{ boxNo: number; birds: number; weight: number }>;
    openingMeter?: number;
    destMeter?: number;
    /** Step 3 stays editable only while its step is not yet submitted. */
    pickupSubmitted?: boolean;
  } = {},
) {
  const rental = Boolean(options.rental);
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const post = async (url: string, data: Record<string, unknown>) => {
    const response = await request.post(`${API}${url}`, { data });
    expect(response.ok(), `${url} -> ${response.status()} ${await response.text()}`).toBeTruthy();
    return response.json();
  };
  const vehicle = await post('/masters/vehicles', {
    vehicleNumber: `C3B-${rental ? 'R' : 'O'}-${suffix}`,
    vehicleType: 'Truck',
    noOfBoxes: 20,
    birdCapacity: 1000,
    capacityKg: 2000,
    engineNumber: `C3BE${suffix}`,
    chassisNumber: `C3BC${suffix}`,
    status: 'Active',
    isRented: rental,
  });
  const employee = (role: string, index: number) =>
    post('/masters/employees', {
      employeeName: `C3B ${role} ${suffix}-${index}`,
      department: 'Operations',
      role,
      phoneNumber: `97${String(suffix).slice(-6)}${index}`.slice(0, 10).padEnd(10, '0'),
      salary: 15000,
      status: 'Active',
      ...(role === 'Driver' ? { licenseNumber: `C3BDL${suffix}` } : {}),
    });
  const driver = await employee('Driver', 1);
  const supervisor = await employee('Supervisor', 2);
  const helper = await employee('Helper', 3);
  const loader = await employee('Loader', 4);
  const list = await fixturesFor(request);
  const farm = list.farms.find((row) => /E2E Source/.test(String(row.farmName))) ?? list.farms[0];
  const bird = list.birds.find((row) => /E2E Broiler/.test(String(row.birdType))) ?? list.birds[0];
  const openingMeter = options.openingMeter ?? 60000;
  const trip = await post('/trips', {
    tripDate: '2026-10-18',
    status: 'Draft',
    vehicleId: vehicle.id,
    vehicleNo: vehicle.vehicleNumber,
    driverId: driver.id,
    driverName: driver.employeeName,
    supervisorId: supervisor.id,
    supervisorName: supervisor.employeeName,
    sourceFarmId: farm.id,
    sourceFarm: farm.farmName,
    farmBirdTypeId: bird.id,
    farmBirdType: bird.birdType,
    helpers: [helper.employeeName],
    loaders: [loader.employeeName],
    isRentedVehicle: rental,
    openingMeter: rental ? null : openingMeter,
    destMeter: rental ? null : (options.destMeter ?? openingMeter + 100),
    startStepSubmitted: true,
    farmStepSubmitted: true,
    pickupStepSubmitted: options.pickupSubmitted !== false,
    boxDetails: options.boxes ?? [],
  });
  return { trip, vehicle, driver, supervisor, farm, bird, fixtures: list };
}

async function fixturesFor(request: APIRequestContext | Page['request']): Promise<Fixtures> {
  const [farms, birds, shops] = await Promise.all([
    request.get(`${API}/masters/farms`),
    request.get(`${API}/masters/bird-types`),
    request.get(`${API}/masters/shops`),
  ]);
  return {
    vehicles: [],
    employees: [],
    farms: await rows(farms),
    birds: await rows(birds),
    shops: await rows(shops),
  };
}

export async function openTripStep(page: Page, tripId: number, step: number) {
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await page.locator(`button[aria-label^="Step ${step}"]`).click();
  await page.waitForTimeout(600);
}

export async function ensureDieselRow(page: Page) {
  // The table renders one draft row for a trip with no diesel yet; the Add
  // button only enables after the last row is submitted.
  if ((await page.locator('input[aria-label="Ltr"]').count()) === 0) {
    await page.getByRole('button', { name: /add diesel entry/i }).first().click();
  }
  await expect(page.locator('input[aria-label="Ltr"]').first()).toBeVisible();
}

export async function refreshTripStep(page: Page, tripId: number, step: number) {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const button = page.locator(`button[aria-label^="Step ${step}"]`);
  if ((await button.count()) === 0) {
    await openTripStep(page, tripId, step);
    return;
  }
  await button.first().click();
  await page.waitForTimeout(600);
}

export async function getTrip(page: Page, tripId: number) {
  const response = await page.request.get(`${API}/trips/${tripId}`);
  expect(response.ok(), `GET ${API}/trips/${tripId} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  const body = await response.json();
  saveJson(`trip-${tripId}-latest`, body);
  return body;
}
