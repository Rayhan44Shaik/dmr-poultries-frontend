import { test, expect, type Page } from '@playwright/test';
import { buildSampleEmiVehicles, vehiclesToEmiLoans } from '../../scripts/fixtures/emi-vehicles.mjs';

const NOW = new Date('2026-09-08T12:00:00+05:30');
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
interface Reply {
  status?: number;
  data?: unknown;
  gate?: ReturnType<typeof deferred>;
  started?: ReturnType<typeof deferred>;
}
interface Backend {
  rows: Record<string, unknown>[];
  replies: Reply[];
  requests: { method: string; path: string }[];
  errors: string[];
  gates: ReturnType<typeof deferred>[];
  notificationsAllowed?: boolean;
}
const backends = new WeakMap<Page, Backend>();
const backend = (page: Page) => backends.get(page)!;
// Count only the EMI read itself: the app shell (sidebar badges, pending
// approval poller) legitimately performs other read-only GETs on every page.
const emiReads = (page: Page) => backend(page).requests.filter((request) => request.path === '/api/fleet/emis');
const table = (page: Page) => page.getByRole('table', { name: 'EMI Schedule', exact: true });
const dataRows = (page: Page) => table(page).locator('tbody tr[data-vehicle-id]');
const search = (page: Page) => page.getByRole('textbox', { name: 'Search', exact: true });
const refresh = (page: Page) => page.getByRole('button', { name: 'Refresh', exact: true });
const counts = (page: Page) => page.locator('[data-emi-toolbar-row] dd');
const dataStatus = (page: Page) => page.getByRole('status', { name: 'EMI data status', exact: true });
// The refresh receipt now arrives through the global notification host.
const refreshToast = (page: Page) => page.getByRole('status').filter({ hasText: /EMI data refreshed|EMI డేటా రిఫ్రెష్/ });
const readCount = (page: Page) => emiReads(page).length;

function holdNext(page: Page, overrides: Omit<Reply, 'gate' | 'started'> = {}) {
  const gate = deferred();
  const started = deferred();
  backend(page).gates.push(gate);
  backend(page).replies.push({ ...overrides, gate, started });
  return { release: gate.resolve, started: started.promise };
}
async function ready(page: Page) {
  await expect(refresh(page)).toBeEnabled();
  await expect(table(page)).toHaveAttribute('aria-busy', 'false');
}
async function navigateTab(page: Page, tab: 'emi' | 'fastag') {
  await page.evaluate((tab) => {
    history.pushState(null, '', `/fleet?tab=${tab}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, tab);
}

// Every request is intercepted; these tests never reach a real database or
// exercise order/assignment/vehicle mutation endpoints.
test.beforeEach(async ({ page, baseURL }) => {
  const state: Backend = { rows: buildSampleEmiVehicles(NOW), replies: [], requests: [], errors: [], gates: [] };
  backends.set(page, state);
  await page.clock.setFixedTime(NOW);
  page.on('pageerror', (error) => state.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /ErrorBoundary|must be used within|same key/.test(message.text())) state.errors.push(message.text());
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(url.origin).toBe(new URL(baseURL!).origin);
    state.requests.push({ method: request.method(), path: url.pathname });
    if (url.pathname !== '/api/fleet/emis') {
      await route.fulfill({ json: [] });
      return;
    }
    const reply = state.replies.shift() ?? {};
    // `rows` stays in Vehicle-Master shape so tests keep editing familiar
    // fields; the wire payload is the /api/fleet/emis loans DTO.
    const payload = Object.hasOwn(reply, 'data') ? reply.data : vehiclesToEmiLoans(structuredClone(state.rows), NOW);
    reply.started?.resolve();
    if (reply.gate) await reply.gate.promise;
    if (page.isClosed()) return;
    // A held request may be canceled only by test/context cleanup.
    await route.fulfill({ status: reply.status ?? 200, json: payload }).catch(() => {});
  });
});

test.afterEach(async ({ page }) => {
  const state = backend(page);
  for (const gate of state.gates) gate.resolve();
  expect(state.errors).toEqual([]);
  // The EMI page itself must stay strictly read-only. Other app-shell reads
  // (sidebar badges, pending-approval polling) are GET-only as well.
  expect(state.requests.every((request) => request.method === 'GET')).toBe(true);
});

test('one StrictMode GET, truthful loading, slightly larger search and no input/layout loss on first response', async ({ page }) => {
  const held = holdNext(page);
  await page.goto('/fleet?tab=emi');
  await held.started;
  expect(readCount(page)).toBe(1);
  await expect(refresh(page)).toBeDisabled();
  await expect(table(page)).toHaveAttribute('aria-busy', 'true');
  await expect(counts(page)).toHaveText(['—', '—', '—']);
  // The search now fills its Trip-List grid column — at least as wide as the
  // old fixed 224px box.
  expect((await search(page).boundingBox())!.width).toBeGreaterThanOrEqual(224);
  const input = await search(page).elementHandle();
  const frame = (await page.locator('[data-emi-table-frame]').boundingBox())!;
  const footer = (await page.getByRole('navigation', { name: 'EMI pages' }).boundingBox())!;
  await search(page).fill('AP16');
  await page.locator('.emi-status__control').click();
  await page.getByRole('option', { name: 'Pending', exact: true }).click();
  held.release();
  await ready(page);
  await expect(dataRows(page)).toHaveCount(3);
  await expect(search(page)).toHaveValue('AP16');
  expect(await input!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(counts(page)).toHaveText(['12', '3', '9']);
  const frameAfter = (await page.locator('[data-emi-table-frame]').boundingBox())!;
  const footerAfter = (await page.getByRole('navigation', { name: 'EMI pages' }).boundingBox())!;
  expect(Math.abs(frameAfter.y - frame.y)).toBeLessThan(1);
  expect(Math.abs(frameAfter.height - frame.height)).toBeLessThan(1);
  expect(Math.abs(footerAfter.y - footer.y)).toBeLessThan(1);
  expect(readCount(page)).toBe(1);
});

test('rapid refreshes share one request while mounted rows and focused user input remain usable', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await search(page).fill('AP39');
  await expect(dataRows(page)).toHaveCount(4);
  const input = await search(page).elementHandle();
  const row = await dataRows(page).first().elementHandle();
  const before = await dataRows(page).allTextContents();
  const held = holdNext(page);
  await search(page).focus();
  await refresh(page).evaluate((button: HTMLButtonElement) => { for (let i = 0; i < 40; i++) button.click(); });
  await held.started;
  expect(readCount(page)).toBe(2);
  await expect(table(page)).toHaveAttribute('aria-busy', 'true');
  await expect(dataRows(page)).toHaveText(before);
  await expect(counts(page)).toHaveText(['12', '3', '9']);
  await expect(dataStatus(page)).toContainText('Existing data remains visible');
  await expect(search(page)).toBeFocused();
  await search(page).press('End');
  await search(page).pressSequentially(' UA');
  await expect(dataRows(page)).toHaveCount(1);
  held.release();
  await ready(page);
  await expect(search(page)).toHaveValue('AP39 UA');
  expect(await input!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await row!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(search(page)).toBeFocused();
  expect(readCount(page)).toBe(2);
});

test('refresh failure preserves rows and filters with a persistent stale-data warning, then the single Refresh action replaces them', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await search(page).fill('AP16TC4101');
  const previous = await dataRows(page).allTextContents();
  backend(page).replies.push({ status: 503, data: { message: 'Private backend details must not appear in the UI' } });
  await refresh(page).click();
  await expect(dataStatus(page)).toContainText('Refresh failed. Showing last loaded data');
  await expect(dataRows(page)).toHaveText(previous);
  await expect(search(page)).toHaveValue('AP16TC4101');
  await expect(page.getByText('Private backend details must not appear in the UI')).toHaveCount(0);
  await expect(page.getByText('No EMI records found')).toHaveCount(0);
  backend(page).rows = backend(page).rows.map((row) => row.id === 4 ? { ...row, purchaseAmount: 2450000 } : row);
  await refresh(page).click();
  await ready(page);
  await expect(dataRows(page)).toContainText(['₹24,50,000']);
  await expect(refreshToast(page)).toContainText('EMI data refreshed');
  await expect(search(page)).toHaveValue('AP16TC4101');
  expect(readCount(page)).toBe(3);
});

test('initial failure is not a false empty state and retry does not clear typed input', async ({ page }) => {
  const held = holdNext(page, { status: 503, data: { error: 'unavailable' } });
  await page.goto('/fleet?tab=emi');
  await held.started;
  await search(page).fill('TS09CD5678');
  held.release();
  await expect(dataStatus(page)).toContainText('Unable to load EMI data.');
  await expect(counts(page)).toHaveText(['—', '—', '—']);
  await expect(dataRows(page)).toHaveCount(0);
  await expect(page.getByText('No EMI records found')).toHaveCount(0);
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await refresh(page).click();
  await ready(page);
  await expect(dataRows(page)).toHaveCount(1);
  await expect(search(page)).toHaveValue('TS09CD5678');
  expect(readCount(page)).toBe(2);
});

test('in-flight invalidations are coalesced and an obsolete response is never published', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await search(page).fill('AP16TC4101');
  const previous = await dataRows(page).allTextContents();
  backend(page).rows = backend(page).rows.map((row) => row.id === 4 ? { ...row, purchaseAmount: 2222222 } : row);
  const obsolete = holdNext(page);
  await refresh(page).click();
  await obsolete.started;
  backend(page).rows = backend(page).rows.map((row) => row.id === 4 ? { ...row, purchaseAmount: 2600000 } : row);
  const fresh = holdNext(page);
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('dmr:vehicles-changed')); });
  expect(readCount(page)).toBe(2);
  obsolete.release();
  await fresh.started;
  expect(readCount(page)).toBe(3);
  await expect(dataRows(page)).toHaveText(previous);
  await expect(table(page)).toHaveAttribute('aria-busy', 'true');
  fresh.release();
  await ready(page);
  await expect(dataRows(page)).toContainText(['₹26,00,000']);
  await expect(page.getByText('₹22,22,222')).toHaveCount(0);
  expect(readCount(page)).toBe(3);
});

test('tab re-entry preserves the same input node and revalidates instead of accepting a hidden-view response', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await search(page).fill('AP16TC4101');
  const input = await search(page).elementHandle();
  backend(page).rows = backend(page).rows.map((row) => row.id === 4 ? { ...row, purchaseAmount: 2222222 } : row);
  const obsolete = holdNext(page);
  await refresh(page).click();
  await obsolete.started;
  await navigateTab(page, 'fastag');
  await expect(table(page)).toHaveCount(0);
  backend(page).rows = backend(page).rows.map((row) => row.id === 4 ? { ...row, purchaseAmount: 2700000 } : row);
  const fresh = holdNext(page);
  await navigateTab(page, 'emi');
  await expect(search(page)).toHaveValue('AP16TC4101');
  await expect(table(page)).toHaveAttribute('aria-busy', 'true');
  obsolete.release();
  await fresh.started;
  await expect(page.getByText('₹22,22,222')).toHaveCount(0);
  fresh.release();
  await ready(page);
  await expect(dataRows(page)).toContainText(['₹27,00,000']);
  expect(await input!.evaluate((element) => element.isConnected)).toBe(true);
  expect(readCount(page)).toBe(3);
});

test('identical duplicate rows are collapsed while malformed/conflicting data is not silently accepted', async ({ page }) => {
  backend(page).rows.push({ ...backend(page).rows[0] });
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await expect(counts(page)).toHaveText(['12', '3', '9']);
  const firstIds = await dataRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-vehicle-id')));
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  const lastIds = await dataRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-vehicle-id')));
  expect(new Set([...firstIds, ...lastIds]).size).toBe(12);
  backend(page).rows.push({ ...backend(page).rows[0], purchaseAmount: 111111 });
  await refresh(page).click();
  await expect(dataStatus(page)).toContainText('Refresh failed. Showing last loaded data');
  await expect(counts(page)).toHaveText(['12', '3', '9']);
  await expect(page.getByText('₹1,11,111')).toHaveCount(0);
});

test('malformed 200 responses show an error, but a genuine empty response shows real zero totals', async ({ page }) => {
  backend(page).replies.push({ data: { items: [] } });
  await page.goto('/fleet?tab=emi');
  await expect(dataStatus(page)).toContainText('Unable to load EMI data.');
  await expect(counts(page)).toHaveText(['—', '—', '—']);
  await expect(page.getByText('No EMI records found')).toHaveCount(0);
  backend(page).rows = [];
  await refresh(page).click();
  await ready(page);
  await expect(counts(page)).toHaveText(['0', '0', '0']);
  await expect(page.getByText('No EMI records found')).toBeVisible();
});

test('dataset shrink/grow does not resurrect an old page or move the table footer', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(dataRows(page)).toHaveCount(2);
  const footer = (await page.getByRole('navigation', { name: 'EMI pages' }).boundingBox())!;
  backend(page).rows = backend(page).rows.slice(0, 5);
  await refresh(page).click();
  await expect(counts(page).first()).toHaveText('5');
  await expect(page.getByRole('button', { name: 'Go to page 1', exact: true })).toHaveAttribute('aria-current', 'page');
  backend(page).rows = buildSampleEmiVehicles(NOW);
  await refresh(page).click();
  await expect(counts(page).first()).toHaveText('12');
  await expect(page.getByRole('button', { name: 'Go to page 1', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(dataRows(page)).toHaveCount(10);
  expect(Math.abs((await page.getByRole('navigation', { name: 'EMI pages' }).boundingBox())!.y - footer.y)).toBeLessThan(1);
});

test('focus/visibility bursts are throttled into one deliberate revalidation', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('focus')); });
  expect(readCount(page)).toBe(1);
  await page.clock.setFixedTime(new Date(NOW.getTime() + 31_000));
  const held = holdNext(page);
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  await held.started;
  expect(readCount(page)).toBe(2);
  held.release();
  await ready(page);
  expect(readCount(page)).toBe(2);
});

test('20,000 vehicles keep a small DOM and searchable registration input without more requests', async ({ page }) => {
  const template = backend(page).rows[0];
  backend(page).rows = Array.from({ length: 20_000 }, (_, index) => ({
    ...template, id: index + 1, vehicleNo: index + 1, vehicleNumber: `AP 16 TEST ${index + 1}`, totalEMIs: 1_000_000_000,
  }));
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await expect(dataRows(page)).toHaveCount(10);
  await expect(counts(page).first()).toHaveText('20000');
  const start = Date.now();
  await search(page).fill('AP16TEST19999');
  await expect(dataRows(page)).toHaveCount(1);
  await expect(dataRows(page)).toContainText(['AP 16 TEST 19999']);
  expect(Date.now() - start).toBeLessThan(1500);
  await expect(search(page)).toHaveValue('AP16TEST19999');
  expect(readCount(page)).toBe(1);
});

test('backend strings render as text, search is bounded, and the page makes no mutation requests', async ({ page }) => {
  const malicious = '<img data-emi-xss src=x onerror="window.__emiXss=1">';
  backend(page).rows = [{ ...backend(page).rows[0], vehicleNumber: malicious }];
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await expect(dataRows(page).locator('td').nth(1)).toHaveText(malicious);
  await expect(page.locator('img[data-emi-xss]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __emiXss?: number }).__emiXss)).toBeUndefined();
  await expect(search(page)).toHaveAttribute('maxlength', '80');
  expect(emiReads(page)).toEqual([{ method: 'GET', path: '/api/fleet/emis' }]);
});


test('global collection alerts load only on demand and do not duplicate their initialization', async ({ page }) => {
  const state = backend(page);
  state.notificationsAllowed = true;
  await page.goto('/fleet?tab=emi');
  await ready(page);
  expect(readCount(page)).toBe(1);
  await search(page).fill('AP16');
  const input = await search(page).elementHandle();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByText("You're all caught up", { exact: true })).toBeVisible();
  const paths = new Set(state.requests.map((request) => request.path));
  for (const expected of ['/api/fleet/emis', '/api/masters/shops', '/api/operations/collection-entry', '/api/operations/shop-sales']) {
    expect(paths.has(expected)).toBe(true);
  }
  await page.getByRole('heading', { name: 'EMI Schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByText("You're all caught up", { exact: true })).toBeVisible();
  // Reopening the bell must not trigger a second EMI read.
  expect(readCount(page)).toBe(1);
  expect(await input!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(search(page)).toHaveValue('AP16');
});


for (const status of [401, 403]) {
  test(`HTTP ${status} clears previously loaded financial rows instead of retaining an unauthorized snapshot`, async ({ page }) => {
    await page.goto('/fleet?tab=emi');
    await ready(page);
    await search(page).fill('AP16TC4101');
    await expect(dataRows(page)).toHaveCount(1);
    backend(page).replies.push({ status, data: { message: 'Private permission detail' } });
    await refresh(page).click();
    await expect(dataStatus(page)).toContainText('Previously loaded rows have been cleared');
    await expect(dataRows(page)).toHaveCount(0);
    await expect(counts(page)).toHaveText(['—', '—', '—']);
    await expect(page.getByText('Private permission detail')).toHaveCount(0);
    await expect(search(page)).toHaveValue('AP16TC4101');
    await refresh(page).click();
    await ready(page);
    await expect(dataRows(page)).toHaveCount(1);
    expect(readCount(page)).toBe(3);
  });
}

test('larger synchronized headings, plain registrations and the section mark stay stable at desktop widths', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'EMI Schedule', exact: true })).toHaveCSS('font-size', '16px');
  await expect(page.locator('[data-emi-logo]')).toBeVisible();
  await expect(page.locator('[data-emi-logo]')).toHaveAttribute('viewBox', '0 0 40 40');
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1050 });
    const headings = table(page).getByRole('columnheader');
    // Leading serial column, then the registration column — the Trip List
    // ordering — all headers at the shared 12px header type size.
    await expect(headings.nth(0)).toHaveText('S.No');
    await expect(headings.nth(1)).toContainText('Vehicle No');
    await expect(headings.nth(0).locator('span')).toHaveCSS('font-size', '12px');
    for (const button of await table(page).locator('thead button').all()) await expect(button).toHaveCSS('font-size', '12px');
    const firstRow = dataRows(page).first();
    // The serial cell is plain text and the registration is plain text with
    // no per-row icon; the registration column starts where its header does.
    await expect(dataRows(page).locator('td:nth-child(2) svg')).toHaveCount(0);
    const registration = (await firstRow.locator('td:nth-child(2) [title]').boundingBox())!;
    const headerCell = (await headings.nth(1).boundingBox())!;
    expect(registration.x).toBeGreaterThanOrEqual(headerCell.x);
    expect(registration.x + registration.width).toBeLessThanOrEqual(headerCell.x + headerCell.width + 1);
    // The purchase amount stays in the next column, right of the registration.
    const price = await firstRow.locator('td:nth-child(3)').evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().x;
    });
    expect(price - (registration.x + registration.width)).toBeGreaterThan(0);
  }
});

test('one Refresh action and a clearly distinct clear-filter icon, including error recovery', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await expect(refresh(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  // Reset is the Trip List's spin-on-click control, visually distinct from
  // Refresh (the brand hen pill, which carries no RefreshCw arrow at all).
  const clear = page.getByRole('region', { name: 'EMI filters and vehicle totals' }).getByRole('button', { name: /^Reset/ });
  await expect(clear.locator('svg')).not.toHaveClass(/refresh-cw/);
  await expect(refresh(page).locator('svg')).toHaveCount(0);
  backend(page).replies.push({ status: 503 });
  await refresh(page).click();
  await expect(dataStatus(page)).toContainText('Refresh failed');
  await expect(refresh(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  await expect(refreshToast(page)).toHaveCount(0);
  await refresh(page).click();
  await ready(page);
  await expect(refreshToast(page)).toContainText('EMI data refreshed');
  expect(readCount(page)).toBe(3);
});

test('successful manual refresh shows one popup only after completion and does not move the table', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await expect(refreshToast(page)).toHaveCount(0);
  await search(page).fill('AP16');
  const input = await search(page).elementHandle();
  const footerY = (await page.getByRole('navigation', { name: 'EMI pages' }).boundingBox())!.y;
  const first = holdNext(page);
  await refresh(page).click();
  await first.started;
  await expect(refreshToast(page)).toHaveCount(0);
  first.release();
  await ready(page);
  await expect(refreshToast(page)).toBeVisible();
  await expect(refreshToast(page)).toHaveCount(1);
  await expect(refreshToast(page)).toContainText('EMI data refreshed');
  await expect(dataStatus(page)).not.toContainText('EMI data refreshed');
  expect(Math.abs((await page.getByRole('navigation', { name: 'EMI pages' }).boundingBox())!.y - footerY)).toBeLessThan(1);
  const oldPopup = await refreshToast(page).elementHandle();
  // The fixed test clock gives both reads the same timestamp. The new receipt
  // still gets its own popup/timer, rather than reusing a timestamp as identity.
  const second = holdNext(page);
  await refresh(page).click();
  await second.started;
  await expect(refreshToast(page)).toHaveCount(0);
  second.release();
  await ready(page);
  await expect(refreshToast(page)).toHaveCount(1);
  expect(await oldPopup!.evaluate((element) => element.isConnected)).toBe(false);
  await refreshToast(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(refreshToast(page)).toHaveCount(0);
  await expect(search(page)).toHaveValue('AP16');
  expect(await input!.evaluate((element) => element.isConnected)).toBe(true);
  expect(readCount(page)).toBe(3);
});

test('refresh popup auto-dismisses without fetching again', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await refresh(page).click();
  await expect(refreshToast(page)).toBeVisible();
  await expect(refreshToast(page)).toHaveCount(0, { timeout: 7_000 });
  await expect(dataRows(page)).toHaveCount(10);
  expect(readCount(page)).toBe(2);
});

test('refresh popup is not replayed by switching tabs or background revalidation', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await refresh(page).click();
  await expect(refreshToast(page)).toBeVisible();
  await navigateTab(page, 'fastag');
  await expect(table(page)).toHaveCount(0);
  await expect(refreshToast(page)).toHaveCount(0);
  await navigateTab(page, 'emi');
  await ready(page);
  await expect(refreshToast(page)).toHaveCount(0);
  expect(readCount(page)).toBe(3);
});

test('two-page pagination is compact and every control shows the correct rows and range', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  const nav = page.getByRole('navigation', { name: 'EMI pages', exact: true });
  const buttons = nav.getByRole('button');
  await expect(buttons).toHaveCount(4);
  const boxes = await Promise.all((await buttons.all()).map((button) => button.boundingBox()));
  for (let index = 1; index < boxes.length; index++) {
    const previous = boxes[index - 1]!;
    const current = boxes[index]!;
    expect(Math.abs(current.y - previous.y)).toBeLessThan(1);
    expect(current.x - previous.x - previous.width).toBeGreaterThanOrEqual(5);
    expect(current.x - previous.x - previous.width).toBeLessThanOrEqual(7);
  }
  const first = await dataRows(page).locator('td:first-child').allTextContents();
  await expect(page.getByText('Showing 1–10 of 12 vehicles', { exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
  await nav.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(dataRows(page)).toHaveCount(2);
  const last = await dataRows(page).locator('td:first-child').allTextContents();
  expect(new Set([...first, ...last]).size).toBe(12);
  await expect(page.getByText('Showing 11–12 of 12 vehicles', { exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Go to page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  await nav.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(dataRows(page).locator('td:first-child')).toHaveText(first);
  await nav.getByRole('button', { name: 'Go to page 2', exact: true }).press('Enter');
  await expect(dataRows(page).locator('td:first-child')).toHaveText(last);
  await nav.getByRole('button', { name: 'Go to page 1', exact: true }).click();
  await expect(dataRows(page).locator('td:first-child')).toHaveText(first);
  expect(readCount(page)).toBe(1);
});

function useManyVehicles(page: Page) {
  const template = backend(page).rows[0];
  backend(page).rows = Array.from({ length: 80 }, (_, index) => ({
    ...template, id: index + 1, vehicleNo: index + 1, vehicleNumber: `AP 16 PG ${String(index + 1).padStart(4, '0')}`,
  }));
}

test('the page window reaches later pages and filters reset its range without another GET', async ({ page }) => {
  useManyVehicles(page);
  await page.goto('/fleet?tab=emi');
  await ready(page);
  const nav = page.getByRole('navigation', { name: 'EMI pages', exact: true });
  await expect(nav.getByRole('button', { name: /Go to page/ })).toHaveCount(5);
  await nav.getByRole('button', { name: 'Go to page 5', exact: true }).click();
  await expect(page.getByText('Showing 41–50 of 80 vehicles', { exact: true })).toBeVisible();
  await expect(dataRows(page).first()).toContainText('AP 16 PG 0041');
  await nav.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByText('Showing 51–60 of 80 vehicles', { exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Go to page 8', exact: true }).click();
  await expect(page.getByText('Showing 71–80 of 80 vehicles', { exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  await expect(dataRows(page).first()).toContainText('AP 16 PG 0071');
  await nav.getByRole('button', { name: 'Previous page', exact: true }).press('Space');
  await expect(page.getByText('Showing 61–70 of 80 vehicles', { exact: true })).toBeVisible();
  await search(page).fill('PG0001');
  await expect(dataRows(page)).toHaveCount(1);
  await expect(page.getByText('Showing 1–1 of 1 vehicles', { exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: /Go to page/ })).toHaveCount(1);
  await expect(nav.getByRole('button', { name: 'Go to page 1', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
  await expect(nav.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  expect(readCount(page)).toBe(1);
});

test('pagination fits small screens with a visible current page and working next/previous controls', async ({ page }) => {
  useManyVehicles(page);
  await page.goto('/fleet?tab=emi');
  await ready(page);
  const nav = page.getByRole('navigation', { name: 'EMI pages', exact: true });
  await nav.getByRole('button', { name: 'Go to page 4', exact: true }).click();
  for (const width of [320, 390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await nav.scrollIntoViewIfNeeded();
    await expect(nav.getByRole('button', { name: /Go to page/ })).toHaveCount(width < 640 ? 3 : 5);
    await expect(nav.locator('[aria-current="page"]')).toBeVisible();
    const boxes = await Promise.all((await nav.getByRole('button').all()).map((button) => button.boundingBox()));
    for (const box of boxes) {
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const before = await dataRows(page).first().getAttribute('data-vehicle-id');
    await nav.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(dataRows(page).first()).not.toHaveAttribute('data-vehicle-id', before!);
    await nav.getByRole('button', { name: 'Previous page', exact: true }).click();
    await expect(dataRows(page).first()).toHaveAttribute('data-vehicle-id', before!);
  }
  expect(readCount(page)).toBe(1);
});

test('loading and empty lists disable pagination without a misleading active page', async ({ page }) => {
  backend(page).rows = [];
  const held = holdNext(page);
  await page.goto('/fleet?tab=emi');
  await held.started;
  const nav = page.getByRole('navigation', { name: 'EMI pages', exact: true });
  for (const button of await nav.getByRole('button').all()) await expect(button).toBeDisabled();
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  held.release();
  await ready(page);
  await expect(page.getByText('Showing 0–0 of 0 vehicles', { exact: true })).toBeVisible();
  for (const button of await nav.getByRole('button').all()) await expect(button).toBeDisabled();
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  expect(readCount(page)).toBe(1);
});

test('refresh confirmation stays in the viewport top-right corner on desktop and mobile', async ({ page }) => {
  await page.goto('/fleet?tab=emi');
  await ready(page);
  await refresh(page).click();
  const toast = refreshToast(page);
  await expect(toast).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('navigation', { name: 'EMI pages', exact: true }).scrollIntoViewIfNeeded();
    await expect(toast).toHaveCSS('position', 'fixed');
    await expect(toast).toHaveCSS('top', '16px');
    await expect(toast).toHaveCSS('right', '16px');
    const box = (await toast.boundingBox())!;
    expect(box.y).toBe(16);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
  await toast.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(toast).toHaveCount(0);
  expect(readCount(page)).toBe(2);
});
