import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = '/api';
const EVIDENCE = path.resolve('../../outputs/batch-c3/browser');
const API_EVIDENCE = path.resolve('../../outputs/batch-c3/api');

async function login(page: Page) {
  await page.goto('/');
  await page.locator('#login-username').fill('test-owner-4100');
  await page.locator('#login-password').fill('Test-only-password-123!');
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 30_000 });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true });
}

async function fixtures(page: Page) {
  const [vehicles, employees, farms, birds, shops] = await Promise.all([
    page.request.get(`${API}/masters/vehicles`), page.request.get(`${API}/masters/employees`),
    page.request.get(`${API}/masters/farms`), page.request.get(`${API}/masters/bird-types`),
    page.request.get(`${API}/masters/shops`),
  ]);
  const rows = async (response: typeof vehicles) => {
    const value = await response.json();
    return Array.isArray(value) ? value : value.items ?? value.data ?? [];
  };
  return {
    vehicles: await rows(vehicles), employees: await rows(employees), farms: await rows(farms),
    birds: await rows(birds), shops: await rows(shops),
  };
}

async function createTrip(page: Page, rental: boolean, boxes: Array<{boxNo:number;birds:number;weight:number}>) {
  const f = await fixtures(page);
  const key = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const create = async (url: string, data: Record<string, unknown>) => {
    const response = await page.request.post(`${API}${url}`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const vehicle = await create('/masters/vehicles', { vehicleNumber: `C3-${rental ? 'R' : 'O'}-${key}`, vehicleType:'Truck', noOfBoxes:20, birdCapacity:1000, capacityKg:2000, engineNumber:`C3E${key}`, chassisNumber:`C3C${key}`, status:'Active', isRented:rental });
  const employee = (role: string, suffix: number) => create('/masters/employees', { employeeName:`C3 ${role} ${key}`, department:'Operations', role, phoneNumber:`98${String(key).slice(-6)}${suffix}`.slice(0,10).padEnd(10,'0'), salary:15000, status:'Active', ...(role === 'Driver' ? { licenseNumber:`C3DL${key}` } : {}) });
  const driver = await employee('Driver', 1);
  const supervisor = await employee('Supervisor', 2);
  const helper = await employee('Helper', 3);
  const loader = await employee('Loader', 4);
  const farm = f.farms.find((row: any) => /E2E Source/.test(row.farmName));
  const bird = f.birds.find((row: any) => /E2E Broiler/.test(row.birdType));
  const response = await page.request.post(`${API}/trips`, { data: {
    tripDate: '2026-10-18', status: 'Draft', vehicleId: vehicle.id, vehicleNo: vehicle.vehicleNumber,
    driverId: driver.id, driverName: driver.employeeName, supervisorId: supervisor.id,
    supervisorName: supervisor.employeeName, sourceFarmId: farm.id, sourceFarm: farm.farmName,
    helpers: [helper.employeeName], loaders: [loader.employeeName],
    farmBirdTypeId: bird.id, farmBirdType: bird.birdType, isRentedVehicle: rental,
    openingMeter: rental ? null : 60000, destMeter: rental ? null : 60100,
    startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, boxDetails: boxes,
  }});
  expect(response.ok(), await response.text()).toBeTruthy();
  return { trip: await response.json(), f, bird };
}

test('C3 Step 5 owned and rental diesel persists and reopens in the browser', async ({ page }) => {
  await login(page);
  for (const rental of [false, true]) {
    const { trip } = await createTrip(page, rental, [{ boxNo: 1, birds: 20, weight: 40 }]);
    const response = await page.request.post(`${API}/trips/${trip.id}/diesel`, { data: {
      litres: rental ? 10 : 12.5, amount: rental ? 950 : 1187.5, meter: rental ? null : 60200,
      bunkName: 'E2E Bunk', gpsLat: 17.385044, gpsLon: 78.486671, gpsAccuracy: 1,
      imageData: `data:image/jpeg;base64,${rental ? 'R'.repeat(80) : 'O'.repeat(80)}`,
      imageName: rental ? 'rental.jpg' : 'owned.jpg', clientKey: `c3-${rental ? 'rental' : 'owned'}-${trip.id}`, rowIndex: 1,
    }});
    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json();
    expect(Number(body.dieselEntries[0].rate)).toBe(95);
    await page.goto(`/operations?tab=trip-entry&tripId=${trip.id}`);
    await page.waitForLoadState('networkidle');
    await page.locator('button[aria-label^="Step 5"]').click();
    await expect.poll(async () => page.locator('select').evaluateAll((nodes) => nodes.map((node) => (node as HTMLSelectElement).value))).toContain('E2E Bunk');
    await shot(page, `c3-step5-${rental ? 'rental' : 'owned'}-reopen`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('button[aria-label^="Step 5"]').click();
    await expect.poll(async () => page.locator('select').evaluateAll((nodes) => nodes.map((node) => (node as HTMLSelectElement).value))).toContain('E2E Bunk');
  }
});

test('C3 IMP-12 A erase countdown B delivery and refresh evidence', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const { trip, f, bird } = await createTrip(page, false, []);
  const hashA = '1'.repeat(64), hashB = '2'.repeat(64);
  const save = (boxes: any[], hash: string, name: string) => page.request.put(`${API}/trips/${trip.id}`, { data: {
    boxDetails: boxes,
    importFingerprint: { algorithm: 'SHA-256', version: 1, contentHash: hash, originalFilename: name, byteLength: 128 },
  }});
  expect((await save([{boxNo:1,birds:100,weight:200},{boxNo:2,birds:100,weight:200}], hashA, 'dataset-a.xlsx')).ok()).toBeTruthy();
  await page.goto(`/operations?tab=trip-entry&tripId=${trip.id}`);
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 3"]').click();
  await shot(page, 'c3-imp12-dataset-a');
  await page.getByRole('button', { name: /edit step/i }).click();
  await page.getByRole('button', { name: 'Erase all boxes' }).click();
  await page.getByRole('button', { name: 'Yes, erase all' }).click();
  await expect(page.getByText(/All pickup boxes erased/i)).toBeVisible({ timeout: 20_000 });
  const erased = await page.request.get(`${API}/trips/${trip.id}`);
  expect((await erased.json()).boxDetails).toHaveLength(0);
  expect((await save([{boxNo:1,birds:25,weight:50},{boxNo:2,birds:25,weight:50}], hashB, 'dataset-b.xlsx')).ok()).toBeTruthy();
  const shopA = f.shops.find((s: any) => /Alpha/.test(s.shopName));
  const shopB = f.shops.find((s: any) => /Bravo/.test(s.shopName));
  const delivery = (shop: any, key: string, box: number) => ({ id:0, clientKey:key, shopId:shop.id, shopName:shop.shopName,
    birdTypeId:bird.id, birdType:bird.birdType, birds:25, weight:50, mortality:0, mortKg:0, rate:100,
    amount:2500, remarks:'', deliveryMode:'box', selectedBoxIds:[box] });
  const deliveryRes = await page.request.put(`${API}/trips/${trip.id}/deliveries`, { data: {
    deliveries: [delivery(shopA, 'c3-imp12-a', 1), delivery(shopB, 'c3-imp12-b', 2)],
  }});
  expect(deliveryRes.ok(), await deliveryRes.text()).toBeTruthy();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 4"]').click();
  await expect(page.getByText(shopA.shopName).first()).toBeVisible();
  await expect(page.getByText(shopB.shopName).first()).toBeVisible();
  await shot(page, 'c3-imp12-dataset-b-deliveries');
  const finalResponse = await page.request.get(`${API}/trips/${trip.id}`);
  const final = await finalResponse.json();
  expect(final.boxDetails.map((b: any) => Number(b.birds))).toEqual([25, 25]);
  fs.mkdirSync(API_EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(API_EVIDENCE, 'imp12-final.json'), JSON.stringify(final, null, 2));
});
