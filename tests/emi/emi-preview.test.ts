import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { buildSampleEmiVehicles } from '../../scripts/fixtures/emi-vehicles.mjs';
import { apiClient } from '../../src/api/client';
import { buildEmiOverview, computeKpis, hasPendingEmiRead, invalidateEmiRead, loadEmiSnapshot } from '../../src/modules/fleet-operations/services/emiService';
import { createVehicle, getVehicles, loadVehicles, updateVehicle } from '../../src/modules/masters/vehicles/services/vehicleService';

function mockVehicles(t: TestContext, rows: unknown) {
  const original = apiClient.defaults.adapter;
  const calls: { method: string; url: string; data: unknown }[] = [];
  apiClient.defaults.adapter = async (config) => {
    calls.push({ method: config.method ?? '', url: config.url ?? '', data: config.data });
    return { data: config.method === 'get' ? rows : Array.isArray(rows) ? rows[0] : rows, status: 200, statusText: 'OK', headers: {}, config };
  };
  t.after(() => { apiClient.defaults.adapter = original; });
  return calls;
}

test('demo has 12 distinct, explicitly marked vehicle records with valid EMI fields', () => {
  const rows = buildSampleEmiVehicles(new Date('2026-09-08T12:00:00'));
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row) => row.id)).size, 12);
  assert.equal(new Set(rows.map((row) => row.vehicleNumber)).size, 12);
  for (const row of rows) {
    assert.equal(row._mock, true);
    assert.ok(row.purchaseAmount > 0);
    assert.ok(Number.isInteger(row.totalEMIs) && row.totalEMIs > 0);
    assert.ok(row.emiDay >= 1 && row.emiDay <= 31);
    assert.ok(row.purchaseDate < row.emiStartDate);
  }
  assert.equal(rows[0].vehicleNumber, 'TS 09 AB 1234');
  assert.equal(rows[1].vehicleNumber, 'TS 09 CD 5678');
  assert.equal(rows[2].vehicleNumber, 'TS 09 EF 9012');
  assert.equal(rows[7].emiDay, 31);
  assert.equal(rows[8].status, 'Inactive');
});

test('the existing API-to-EMI path preserves the sample label and only performs a GET', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-08T12:00:00') });
  const calls = mockVehicles(t, buildSampleEmiVehicles());
  const rows = await buildEmiOverview();
  assert.equal(rows.length, 12);
  assert.ok(rows.every((row) => row.isSample));
  assert.deepEqual(computeKpis(rows), { totalVehicles: 12, completedEmiVehicles: 3, pendingEmiVehicles: 9 });
  for (const row of rows) {
    assert.equal(row.completedEMIs + row.pendingEMIs, row.totalEMIs);
    assert.equal(row.status, row.pendingEMIs === 0 ? 'COMPLETED' : 'PENDING');
  }
  assert.equal(rows.find((row) => row.vehicleId === 6)?.completedEMIs, 0);
  assert.equal(rows.find((row) => row.vehicleId === 7)?.pendingEMIs, 2);
  assert.deepEqual(calls.map(({ method, url }) => ({ method, url })), [{ method: 'get', url: '/masters/vehicles' }]);
});

for (const date of ['2026-12-31', '2027-01-01', '2028-02-29', '2030-07-15']) {
  test(`sample schedules remain useful across month/year boundaries: ${date}`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(`${date}T12:00:00`) });
    mockVehicles(t, buildSampleEmiVehicles());
    assert.deepEqual(computeKpis(await buildEmiOverview()), {
      totalVehicles: 12, completedEmiVehicles: 3, pendingEmiVehicles: 9,
    });
  });
}

test('ordinary API responses are not labeled as sample data', async (t) => {
  mockVehicles(t, buildSampleEmiVehicles().map((row, index) => ({ ...row, _mock: index % 2 ? undefined : 'true' })));
  const rows = await buildEmiOverview();
  assert.equal(rows.length, 12);
  assert.ok(rows.every((row) => row.isSample === false));
});

test('the display-only sample marker is never sent in vehicle mutation payloads', async (t) => {
  const calls = mockVehicles(t, buildSampleEmiVehicles());
  const [vehicle] = await loadVehicles();
  assert.equal(vehicle.isSample, true);
  await createVehicle(vehicle); // Captured by the mock adapter; no real API call.
  const payload = JSON.parse(String(calls.find((call) => call.method === 'post')?.data));
  assert.equal('isSample' in payload, false);
  assert.equal('_mock' in payload, false);
});

test('a failed vehicle API does not silently substitute sample data', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  apiClient.defaults.adapter = async () => { throw new Error('Vehicle API unavailable'); };
  await assert.rejects(() => buildEmiOverview());
});

test('concurrent snapshot consumers share exactly one GET and one immutable result, without a stale result cache', async (t) => {
  const calls = mockVehicles(t, buildSampleEmiVehicles());
  const first = loadEmiSnapshot();
  const second = loadEmiSnapshot();
  const third = loadEmiSnapshot();
  assert.equal(first, second);
  assert.equal(second, third);
  const [a, b, c] = await Promise.all([first, second, third]);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(calls.length, 1);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.rows) && Object.isFrozen(a.rows[0]));
  await loadEmiSnapshot();
  assert.equal(calls.length, 2, 'a completed read is not reused as a stale TTL fallback');
});

test('a shared failure is cleared and a later explicit retry can succeed', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  let fail = true;
  let calls = 0;
  apiClient.defaults.adapter = async (config) => {
    calls++;
    if (fail) throw new Error('Offline');
    return { data: buildSampleEmiVehicles(), status: 200, statusText: 'OK', headers: {}, config };
  };
  const results = await Promise.allSettled([loadEmiSnapshot(), loadEmiSnapshot()]);
  assert.ok(results.every((result) => result.status === 'rejected'));
  assert.equal(calls, 1);
  fail = false;
  assert.equal((await loadEmiSnapshot()).rows.length, 12);
  assert.equal(calls, 2);
});

for (const invalid of [null, { items: [] }, [null], [42], [[]]]) {
  test(`malformed successful API responses fail instead of claiming an empty list: ${JSON.stringify(invalid)}`, async (t) => {
    mockVehicles(t, buildSampleEmiVehicles());
    const previous = await loadVehicles();
    apiClient.defaults.adapter = async (config) => ({ data: invalid, status: 200, statusText: 'OK', headers: {}, config });
    await assert.rejects(() => loadEmiSnapshot(), /array of records/);
    assert.equal(getVehicles(), previous, 'a malformed response cannot replace the last valid master cache');
  });
}

test('invalidation during a GET coalesces into one sequential fresh read and never resolves the old snapshot', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  let finish!: () => void;
  const held = new Promise<void>((resolve) => { finish = resolve; });
  let calls = 0;
  let price = 1800000;
  apiClient.defaults.adapter = async (config) => {
    calls++;
    const data = buildSampleEmiVehicles().map((row) => ({ ...row, purchaseAmount: price }));
    if (calls === 1) await held;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const first = loadEmiSnapshot();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  price = 2400000;
  for (let i = 0; i < 20; i++) invalidateEmiRead();
  assert.equal(loadEmiSnapshot(), first, 'new consumers still join the same coalesced operation');
  finish();
  const snapshot = await first;
  assert.equal(calls, 2);
  assert.ok(snapshot.rows.every((row) => row.purchaseAmount === 2400000));
});

test('a committed master edit invalidates an older read even when no EMI view is mounted', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  let finish!: () => void;
  const held = new Promise<void>((resolve) => { finish = resolve; });
  let data = buildSampleEmiVehicles();
  let reads = 0;
  let writes = 0;
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'put') {
      writes++;
      data = data.map((row) => row.id === 1 ? { ...row, purchaseAmount: 2500000 } : row);
      return { data: data[0], status: 200, statusText: 'OK', headers: {}, config };
    }
    reads++;
    const snapshot = structuredClone(data);
    if (reads === 1) await held;
    return { data: snapshot, status: 200, statusText: 'OK', headers: {}, config };
  };
  const pending = loadEmiSnapshot();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await updateVehicle(1, { purchaseAmount: 2500000 });
  finish();
  const snapshot = await pending;
  assert.equal(snapshot.rows.find((row) => row.vehicleId === 1)?.purchaseAmount, 2500000);
  assert.equal(reads, 2);
  assert.equal(writes, 1, 'read invalidation must never replay a mutation');
});


for (const fields of [{ totalEMIs: 'invalid' }, { emiDay: true }, { purchaseAmount: {} }, { vehicleNumber: {} }]) {
  test(`invalid API finance/registration fields are not silently converted into missing data: ${JSON.stringify(fields)}`, async (t) => {
    mockVehicles(t, [{ ...buildSampleEmiVehicles()[0], ...fields }]);
    await assert.rejects(() => loadEmiSnapshot());
  });
}


test('different auth contexts never share a pending financial response', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  const firstScope = {};
  const secondScope = {};
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  apiClient.defaults.adapter = async (config) => {
    const request = ++calls;
    const data = buildSampleEmiVehicles().map((row) => ({ ...row, purchaseAmount: request === 1 ? 1800000 : 2800000 }));
    if (request === 1) await held;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const first = loadEmiSnapshot(firstScope);
  const second = loadEmiSnapshot(secondScope);
  assert.notEqual(first, second);
  assert.equal(loadEmiSnapshot(secondScope), second);
  const current = await second;
  assert.equal(calls, 2);
  assert.equal(current.rows[0].purchaseAmount, 2800000);
  assert.equal(hasPendingEmiRead(firstScope), true);
  assert.equal(hasPendingEmiRead(secondScope), false);
  release();
  assert.equal((await first).rows[0].purchaseAmount, 1800000);
  assert.equal(current.rows[0].purchaseAmount, 2800000, 'a late response from another context cannot alter the current snapshot');
});
