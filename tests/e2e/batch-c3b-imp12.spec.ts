import { test, expect, type Page } from '@playwright/test';
import {
  API, login, shot, getTrip, createTrip, openTripStep, refreshTripStep, saveJson,
} from './batch-c3b.helpers';

async function workbookBuffer(rows: Array<[number, number, number]>, sheetName = 'Pickup') {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([['Box', 'Birds', 'Weight'], ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  return XLSX.write(book, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

async function importFile(page: Page, name: string, rows: Array<[number, number, number]>) {
  await page.getByRole('button', { name: /import excel \/ pdf/i }).click();
  await page.locator('input[type="file"][accept=".xlsx,.xls,.pdf"]').setInputFiles({
    name,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await workbookBuffer(rows),
  });
  await expect(page.getByText(name, { exact: false })).toBeVisible({ timeout: 20_000 });
}

function previewScale(page: Page) {
  return page.locator('text=Total birds').locator('..').locator('strong');
}

async function readPickupGrid(page: Page) {
  const grid = page.locator('[data-pickup-boxes]');
  const boxes = await grid.locator('td[data-pickup-box-no]').allInnerTexts();
  const cells = grid.locator('tbody tr td').filter({ has: page.locator('input') });
  const counts = await cells.count();
  const birds: string[] = [];
  const weights: string[] = [];
  for (let i = 0; i < counts; i += 1) {
    if (i % 2 === 0) birds.push((await cells.nth(i).locator('input').first().inputValue()) || '0');
    else weights.push((await cells.nth(i).locator('input').first().inputValue()) || '0');
  }
  return { boxes: boxes.map((b) => b.trim()), birds, weights };
}

test.describe('C3 IMP-12 latest-dataset browser journey', () => {
  test('A import, duplicate reject, 10s erase with cancel, B import, deliveries, no residue', async ({ page }) => {
    test.setTimeout(240_000);
    await login(page);
    const { trip, fixtures } = await createTrip(page.request, { boxes: [], pickupSubmitted: false });
    const datasetA: Array<[number, number, number]> = [[1, 100, 200], [2, 100, 200]];
    const datasetB: Array<[number, number, number]> = [[1, 25, 50], [2, 25, 50]];

    // 1–3. Import dataset A through the UI and commit.
    await openTripStep(page, trip.id, 3);
    await importFile(page, 'dataset-a.xlsx', datasetA);
    await expect(page.getByRole('grid', { name: /imported pickup box entries/i })).toBeVisible();
    await shot(page, 'c3b-imp12-preview-a');
    expect(await previewScale(page).nth(0).textContent()).toBe('200');
    await page.getByRole('button', { name: /replace and save/i }).click();
    await expect(page.getByRole('button', { name: /import excel \/ pdf/i })).toBeVisible({ timeout: 20_000 });

    // 4. Box/bird/weight totals from the API (DB-backed).
    let body = await getTrip(page, trip.id);
    expect(body.boxDetails.map((b: any) => Number(b.birds))).toEqual([100, 100]);
    expect(body.boxDetails.map((b: any) => Number(b.weight))).toEqual([200, 200]);
    saveJson('c3b-imp12-dataset-a', { tripId: trip.id, boxes: body.boxDetails });
    await shot(page, 'c3b-imp12-dataset-a-committed');

    // IMP-04 in the UI: the identical bytes are rejected for the unchanged load.
    await importFile(page, 'dataset-a.xlsx', datasetA);
    await page.getByRole('button', { name: /replace and save/i }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /already.*import|could not be saved/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    const afterDuplicate = await getTrip(page, trip.id);
    expect(afterDuplicate.boxDetails.length).toBe(2);
    expect(afterDuplicate.boxDetails.map((b: any) => Number(b.birds))).toEqual([100, 100]);
    await shot(page, 'c3b-imp12-duplicate-file-rejected');
    await page.getByRole('button', { name: /cancel/i }).first().click();

    // 5. Refresh and reopen.
    await refreshTripStep(page, trip.id, 3);
    const gridA = await readPickupGrid(page);
    expect(gridA.boxes).toEqual(['1', '2']);
    expect(gridA.birds).toEqual(['100', '100']);
    expect(gridA.weights).toEqual(['200', '200']);
    await shot(page, 'c3b-imp12-dataset-a-refresh');

    // 6–7. Start the visible 10-second erase countdown and cancel it.
    await page.getByRole('button', { name: /erase all boxes/i }).click();
    await page.getByRole('button', { name: /yes, erase all/i }).click();
    const countdown = page.getByText(/Erasing in \d+ seconds?/i);
    await expect(countdown).toBeVisible({ timeout: 10_000 });
    await shot(page, 'c3b-imp12-erase-countdown');
    await page.getByRole('dialog').getByRole('button', { name: /^cancel$/i }).click();
    await expect(countdown).toHaveCount(0);
    expect((await getTrip(page, trip.id)).boxDetails.length).toBe(2);

    // 8–9. Repeat and let the erase complete.
    await page.getByRole('button', { name: /erase all boxes/i }).click();
    await page.getByRole('button', { name: /yes, erase all/i }).click();
    await expect(page.getByText(/All pickup boxes erased/i)).toBeVisible({ timeout: 30_000 });
    body = await getTrip(page, trip.id);
    saveJson('c3b-imp12-dataset-a-erased', { tripId: trip.id, boxes: body.boxDetails, totals: body.totals ?? null });
    expect(body.boxDetails).toHaveLength(0);
    await shot(page, 'c3b-imp12-dataset-a-erased');

    // 10–12. Import dataset B (must start at box 1) then refresh and reopen.
    await importFile(page, 'dataset-b.xlsx', datasetB);
    expect(await previewScale(page).nth(0).textContent()).toBe('50');
    await page.getByRole('button', { name: /replace and save/i }).click();
    await expect(page.getByRole('button', { name: /import excel \/ pdf/i })).toBeVisible({ timeout: 20_000 });
    body = await getTrip(page, trip.id);
    expect(body.boxDetails.map((b: any) => Number(b.boxNo))).toEqual([1, 2]);
    expect(body.boxDetails.map((b: any) => Number(b.birds))).toEqual([25, 25]);
    expect(body.boxDetails.map((b: any) => Number(b.weight))).toEqual([50, 50]);
    saveJson('c3b-imp12-dataset-b', { tripId: trip.id, boxes: body.boxDetails });
    await refreshTripStep(page, trip.id, 3);
    const gridB = await readPickupGrid(page);
    expect(gridB.boxes).toEqual(['1', '2']);
    expect(gridB.birds).toEqual(['25', '25']);
    await shot(page, 'c3b-imp12-dataset-b-refresh');

    // 13–15. Shop deliveries must be governed by dataset B only.
    const shopA = fixtures.shops.find((s) => /Alpha/.test(String(s.shopName))) ?? fixtures.shops[0];
    const shopB = fixtures.shops.find((s) => /Bravo/.test(String(s.shopName))) ?? fixtures.shops[1];
    const delivery = (shop: Record<string, any>, key: string, box: number) => ({
      id: 0,
      clientKey: key,
      shopId: shop.id,
      shopName: shop.shopName,
      birdTypeId: body.farmBirdTypeId ?? body.birdTypeId ?? 1,
      birdType: body.farmBirdType ?? 'E2E Broiler',
      birds: 25,
      weight: 50,
      mortality: 0,
      mortKg: 0,
      rate: 100,
      amount: 2500,
      remarks: '',
      deliveryMode: 'box',
      selectedBoxIds: [box],
    });
    const over = await page.request.put(`${API}/trips/${trip.id}/deliveries`, {
      data: { deliveries: [delivery(shopA, 'imp12-over', 1).valueOf()] },
    });
    // Over-capacity against dataset B's 25 birds must be rejected.
    const overBody = await over.json();
    const overAttempt = await page.request.put(`${API}/trips/${trip.id}/deliveries`, {
      data: { deliveries: [{ ...delivery(shopA, 'imp12-over2', 1), birds: 26, amount: 2600 }] },
    });
    expect(overAttempt.status()).toBe(422);
    saveJson('c3b-imp12-over-capacity', { status: overAttempt.status(), body: await overAttempt.json(), first: overBody });

    const saved = await page.request.put(`${API}/trips/${trip.id}/deliveries`, {
      data: { deliveries: [delivery(shopA, 'imp12-a', 1), delivery(shopB, 'imp12-b', 2)] },
    });
    expect(saved.ok(), await saved.text()).toBeTruthy();
    saveJson('c3b-imp12-deliveries', await saved.json());
    // Step 4 locks once the delivery step is committed on the server, so the
    // browser reopens the trip and the delivery state is asserted from the
    // same API payloads the Step 4 UI renders.
    await page.goto(`/operations?tab=trip-entry&tripId=${trip.id}`);
    await page.waitForLoadState('networkidle');
    await shot(page, 'c3b-imp12-dataset-b-deliveries');

    const withDeliveries = await getTrip(page, trip.id);
    const savedDeliveries = withDeliveries.deliveries ?? [];
    expect(savedDeliveries.length).toBe(2);
    const shopNames = savedDeliveries.map((d: any) => String(d.shopName));
    expect(shopNames.some((n: string) => n.includes(String(shopA.shopName)))).toBeTruthy();
    expect(shopNames.some((n: string) => n.includes(String(shopB.shopName)))).toBeTruthy();
    // Available capacity must come from dataset B (25 birds/box), never A (100).
    expect((withDeliveries.boxDetails ?? []).map((b: any) => Number(b.birds))).toEqual([25, 25]);

    // 16. No dataset A fingerprint may remain: re-importing A succeeds again.
    await openTripStep(page, trip.id, 3);
    await importFile(page, 'dataset-a.xlsx', datasetA);
    await page.getByRole('button', { name: /replace and save/i }).click();
    await expect(page.getByRole('button', { name: /import excel \/ pdf/i })).toBeVisible({ timeout: 20_000 });
    const reimported = await getTrip(page, trip.id);
    expect(reimported.boxDetails.map((b: any) => Number(b.birds))).toEqual([100, 100]);
    saveJson('c3b-imp12-reimport-a-after-erase', { tripId: trip.id, boxes: reimported.boxDetails });
    await shot(page, 'c3b-imp12-reimport-a-after-erase');
  });
});
