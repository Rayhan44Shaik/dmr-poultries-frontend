/**
 * EMI read pipeline — contract tests against the CURRENT backend DTO.
 *
 * Production path under test (unchanged by this file):
 *   EmiLoansPage / useEmiData
 *     → emiService.loadEmiSnapshot / buildEmiOverview
 *       → emiApi.list (GET /fleet/emis)
 *         → emiMappers.mapEmiListResponse (VehicleEMI loans DTO)
 *           { id, vehicleId, vehicleNo, financeCompany, loanAmount, emiAmount,
 *             startDate, endDate, nextEMIDate, status, paidEMIs, pendingEMIs,
 *             totalEMIs, createdBy, createdAt, updatedAt }
 *
 * The previous version of this file fed Vehicle-Master rows
 * (purchaseAmount / emiDay / emiStartDate / _mock) into that pipeline and
 * asserted master-table URLs and sample labels. That contract no longer
 * exists: the page reads the loans DTO, completion comes from the backend
 * paidEMIs count, and there is no sample marker on real rows. Every test
 * below drives the pipeline with loans-DTO rows (via vehiclesToEmiLoans,
 * the same converter the EMI toolbar spec uses) and asserts exactly one
 * GET against /fleet/emis.
 */
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { buildSampleEmiVehicles, vehiclesToEmiLoans } from '../../scripts/fixtures/emi-vehicles.mjs';
import { apiClient } from '../../src/api/client';
import { emiApi } from '../../src/modules/fleet-operations/services/emiApi';
import {
  mapEmiListResponse,
  mapEmiResponse,
  mapEmiScheduleResponse,
} from '../../src/modules/fleet-operations/services/emiMappers';
import { buildEmiOverview, computeKpis, hasPendingEmiRead, invalidateEmiRead, loadEmiSnapshot } from '../../src/modules/fleet-operations/services/emiService';

type Call = { method: string; url: string; params: unknown; data: unknown };

const FIXED_DATE = new Date('2026-09-08T12:00:00');

function loansAt(asOf: Date = FIXED_DATE) {
  return vehiclesToEmiLoans(buildSampleEmiVehicles(asOf), asOf);
}

/** Route-aware axios adapter mock. The handler returns the response body. */
function mockApi(t: TestContext, handler: (call: Call) => unknown) {
  const original = apiClient.defaults.adapter;
  const calls: Call[] = [];
  apiClient.defaults.adapter = async (config) => {
    const call: Call = { method: config.method ?? '', url: config.url ?? '', params: config.params, data: config.data };
    calls.push(call);
    return { data: await handler(call), status: 200, statusText: 'OK', headers: {}, config };
  };
  t.after(() => { apiClient.defaults.adapter = original; });
  return calls;
}

function mockLoans(t: TestContext, rows: unknown) {
  return mockApi(t, (call) => {
    assert.equal(call.method, 'get');
    assert.equal(call.url, '/fleet/emis');
    return rows;
  });
}

/** Persisted-schedule-shaped installments for one loan row (mirrors the
 * backend invariant: every amount finite, statuses paid/pending, and the
 * amounts sum exactly to the loan amount). */
function scheduleFor(loan: Record<string, number>) {
  const total = loan.totalEMIs;
  const base = Math.floor((loan.loanAmount * 100) / total);
  const remainder = Math.round(loan.loanAmount * 100) - base * total;
  return Array.from({ length: total }, (_, index) => ({
    id: index + 1,
    vehicleEmiId: loan.id,
    installmentNo: index + 1,
    dueDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-05`,
    amount: (base + (index === total - 1 ? remainder : 0)) / 100,
    status: index < loan.paidEMIs ? 'paid' : 'pending',
    paidAt: index < loan.paidEMIs ? '2026-09-01T00:00:00.000Z' : null,
  }));
}

test('the loans fixture matches the backend VehicleEMI DTO field for field', () => {
  const rows = loansAt();
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row) => row.id)).size, 12);
  assert.equal(new Set(rows.map((row) => row.vehicleId)).size, 12);
  assert.equal(new Set(rows.map((row) => row.vehicleNo)).size, 12);
  for (const row of rows) {
    assert.ok(Number.isInteger(row.id) && row.id > 0);
    assert.ok(Number.isInteger(row.vehicleId) && row.vehicleId > 0);
    assert.ok(typeof row.vehicleNo === 'string' && row.vehicleNo.length > 0);
    assert.ok(typeof row.financeCompany === 'string' && row.financeCompany.length > 0);
    assert.ok(row.loanAmount > 0);
    assert.ok(row.emiAmount > 0);
    assert.ok(Number.isInteger(row.totalEMIs) && row.totalEMIs > 0);
    assert.ok(Number.isInteger(row.paidEMIs) && row.paidEMIs >= 0 && row.paidEMIs <= row.totalEMIs);
    assert.equal(row.paidEMIs + row.pendingEMIs, row.totalEMIs);
    assert.ok(['active', 'paid', 'overdue'].includes(row.status));
    assert.match(row.startDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(row.endDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!('_mock' in row) && !('isSample' in row), 'real DTO rows carry no sample marker');
  }
  assert.equal(rows[0].vehicleNo, 'TS 09 AB 1234');
});

test('the loans-DTO read path maps one GET into overview rows with backend completion', async (t) => {
  const calls = mockLoans(t, loansAt());
  const rows = await buildEmiOverview();
  assert.equal(rows.length, 12);
  assert.deepEqual(computeKpis(rows), { totalVehicles: 12, completedEmiVehicles: 3, pendingEmiVehicles: 9 });
  for (const row of rows) {
    assert.equal(row.completedEMIs + row.pendingEMIs, row.totalEMIs);
    assert.equal(row.status, row.pendingEMIs === 0 ? 'COMPLETED' : 'PENDING');
    assert.equal(row.vehicleNumber, row.vehicleNo);
    assert.ok(row.purchaseAmount != null && row.purchaseAmount > 0, 'purchaseAmount mirrors the backend loanAmount');
  }
  const first = rows.find((row) => row.vehicleId === 1)!;
  assert.equal(first.purchaseAmount, 1800000);
  assert.equal(first.completedEMIs, 15);
  assert.equal(first.pendingEMIs, 21);
  assert.deepEqual(calls.map(({ method, url }) => ({ method, url })), [{ method: 'get', url: '/fleet/emis' }]);
});

test('backend statuses map onto the two display states: only paid is COMPLETED', async (t) => {
  const rows = loansAt();
  const overdue = { ...rows[0], id: 901, vehicleId: 901, status: 'overdue' };
  mockLoans(t, [...rows, overdue]);
  const overview = await buildEmiOverview();
  assert.equal(overview.find((row) => row.vehicleId === 901)?.status, 'PENDING');
  assert.ok(overview.filter((row) => row.status === 'COMPLETED').every((row) => row.pendingEMIs === 0));
});

test('list forwards vehicle/status/search filters as query params', async (t) => {
  const calls = mockLoans(t, loansAt());
  await emiApi.list({ vehicleId: 6, status: 'active', search: ' TS 09 ' });
  assert.deepEqual(calls[0].params, { vehicleId: 6, status: 'active', search: 'TS 09' });
  await emiApi.list({ vehicleId: 'all', status: 'all', search: '   ' });
  assert.deepEqual(calls[1].params, {});
});

test('create sends the authoritative inputs with a trimmed finance company', async (t) => {
  const loan = loansAt()[0];
  const calls = mockApi(t, () => loan);
  const created = await emiApi.create({
    vehicleId: 7, financeCompany: '  HDFC Bank  ', loanAmount: 120000, totalEMIs: 12, startDate: '2026-09-01',
  });
  assert.equal(created.vehicleId, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(String(calls[0].data)), {
    vehicleId: 7, financeCompany: 'HDFC Bank', loanAmount: 120000, totalEMIs: 12, startDate: '2026-09-01',
  }, 'derived endDate/emiAmount are never sent unless explicitly provided');
  await emiApi.create({
    vehicleId: 7, financeCompany: 'HDFC', loanAmount: 120000, totalEMIs: 12,
    startDate: '2026-09-01', endDate: '2027-09-01', emiAmount: 10000,
  });
  const second = JSON.parse(String(calls[1].data));
  assert.equal(second.endDate, '2027-09-01');
  assert.equal(second.emiAmount, 10000);
});

test('update sends only the provided fields, trimmed', async (t) => {
  const loan = loansAt()[0];
  const calls = mockApi(t, () => loan);
  await emiApi.update(3, { financeCompany: '  HDFC Ltd  ' });
  assert.equal(calls[0].url, '/fleet/emis/3');
  assert.deepEqual(JSON.parse(String(calls[0].data)), { financeCompany: 'HDFC Ltd' });
  await emiApi.update(3, { loanAmount: 900000, totalEMIs: 24 });
  assert.deepEqual(JSON.parse(String(calls[1].data)), { loanAmount: 900000, totalEMIs: 24 });
});

test('pay forwards the idempotency key and the paid-by actor untouched', async (t) => {
  const loan = loansAt()[0];
  const calls = mockApi(t, () => loan);
  await emiApi.pay(5, { paidBy: 'cashier-1', idempotencyKey: '3d813cbb-47fb-4d2f-8f3f-50f48346b529' });
  assert.equal(calls[0].url, '/fleet/emis/5/pay');
  assert.deepEqual(JSON.parse(String(calls[0].data)), {
    paidBy: 'cashier-1', idempotencyKey: '3d813cbb-47fb-4d2f-8f3f-50f48346b529',
  });
  await emiApi.pay(5, {});
  assert.deepEqual(JSON.parse(String(calls[1].data)), {}, 'no key is synthesized client-side');
});

test('schedule rows map installment-for-installment with backend amounts and states', async (t) => {
  const loan = loansAt()[0] as unknown as Record<string, number>;
  const schedule = scheduleFor(loan);
  const calls = mockApi(t, (call) => {
    assert.equal(call.url, '/fleet/emis/1/schedule');
    return schedule;
  });
  const rows = await emiApi.listSchedule(1);
  assert.equal(rows.length, loan.totalEMIs);
  assert.equal(rows.filter((row) => row.status === 'paid').length, loan.paidEMIs);
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), loan.loanAmount);
  assert.deepEqual(rows[0], {
    id: 1, vehicleEmiId: 1, installmentNo: 1, dueDate: '2026-01-05',
    amount: rows[0].amount, status: 'paid', paidAt: '2026-09-01T00:00:00.000Z',
  });
  assert.equal(calls.length, 1);
});

test('identical duplicate loan rows collapse; conflicting duplicates fail closed', async (t) => {
  const [first] = loansAt();
  mockLoans(t, [first, { ...first }]);
  assert.equal((await buildEmiOverview()).length, 1);
  assert.equal(computeKpis(await buildEmiOverview()).totalVehicles, 1);
});

test('conflicting financial duplicates never resolve to an arbitrary record', async (t) => {
  const [first] = loansAt();
  mockLoans(t, [first, { ...first, loanAmount: 999999 }]);
  await assert.rejects(() => loadEmiSnapshot(), /Conflicting duplicate/);
});

for (const invalid of [null, { items: [] }, [null], [42], [[]]]) {
  test(`malformed loans responses fail instead of claiming an empty list: ${JSON.stringify(invalid)}`, async (t) => {
    mockLoans(t, invalid);
    await assert.rejects(() => loadEmiSnapshot());
  });
}

for (const row of [
  { note: 'missing id', patch: { id: undefined } },
  { note: 'missing vehicleId', patch: { vehicleId: undefined } },
  { note: 'unsupported status', patch: { status: 'COMPLETED' } },
  { note: 'blank finance company', patch: { financeCompany: '  ' } },
  { note: 'non-numeric loan', patch: { loanAmount: 'a lot' } },
]) {
  test(`invalid loan finance fields fail closed, never defaulted: ${row.note}`, () => {
    const [first] = loansAt();
    const candidate = { ...first, ...row.patch };
    if (row.patch.id === undefined) delete (candidate as Record<string, unknown>).id;
    if (row.patch.vehicleId === undefined) delete (candidate as Record<string, unknown>).vehicleId;
    assert.throws(() => mapEmiResponse(candidate));
    assert.throws(() => mapEmiListResponse([candidate]));
  });
}

test('unsupported installment states fail closed', () => {
  const loan = loansAt()[0] as unknown as Record<string, number>;
  const [bad] = scheduleFor(loan);
  assert.throws(() => mapEmiScheduleResponse([{ ...bad, status: 'COMPLETED' }]), /unsupported status/);
  assert.throws(() => mapEmiScheduleResponse({ items: [] } as unknown as never), /must be an array/);
});

test('a failed loans API does not silently substitute cached data', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  apiClient.defaults.adapter = async () => { throw new Error('EMI API unavailable'); };
  await assert.rejects(() => buildEmiOverview());
});

test('concurrent snapshot consumers share exactly one GET and one immutable result, without a stale result cache', async (t) => {
  const calls = mockLoans(t, loansAt());
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
    return { data: loansAt(), status: 200, statusText: 'OK', headers: {}, config };
  };
  const results = await Promise.allSettled([loadEmiSnapshot(), loadEmiSnapshot()]);
  assert.ok(results.every((result) => result.status === 'rejected'));
  assert.equal(calls, 1);
  fail = false;
  assert.equal((await loadEmiSnapshot()).rows.length, 12);
  assert.equal(calls, 2);
});

test('invalidation during a GET coalesces into one sequential fresh read and never resolves the old snapshot', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  let finish!: () => void;
  const held = new Promise<void>((resolve) => { finish = resolve; });
  let calls = 0;
  let loanAmount = 1800000;
  apiClient.defaults.adapter = async (config) => {
    calls++;
    const data = loansAt().map((row) => (row.id === 1 ? { ...row, loanAmount, pendingEMIs: row.pendingEMIs } : row));
    if (calls === 1) await held;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const first = loadEmiSnapshot();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  loanAmount = 2400000;
  for (let i = 0; i < 20; i++) invalidateEmiRead();
  assert.equal(loadEmiSnapshot(), first, 'new consumers still join the same coalesced operation');
  finish();
  const snapshot = await first;
  assert.equal(calls, 2);
  assert.ok(snapshot.rows.every((row) => (row.vehicleId === 1 ? row.purchaseAmount === 2400000 : true)));
});

test('a committed EMI edit invalidates an older read even when no EMI view is mounted', async (t) => {
  const original = apiClient.defaults.adapter;
  t.after(() => { apiClient.defaults.adapter = original; });
  let finish!: () => void;
  const held = new Promise<void>((resolve) => { finish = resolve; });
  let financeCompany = 'Sample Finance';
  let reads = 0;
  let writes = 0;
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'put') {
      writes++;
      financeCompany = 'HDFC Ltd';
      const [row] = loansAt();
      return { data: { ...row, financeCompany }, status: 200, statusText: 'OK', headers: {}, config };
    }
    reads++;
    const snapshot = loansAt().map((row) => (row.id === 1 ? { ...row, financeCompany } : row));
    if (reads === 1) await held;
    return { data: snapshot, status: 200, statusText: 'OK', headers: {}, config };
  };
  const pending = loadEmiSnapshot();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await emiApi.update(1, { financeCompany: 'HDFC Ltd' });
  invalidateEmiRead();
  finish();
  const snapshot = await pending;
  assert.equal(snapshot.rows.find((row) => row.vehicleId === 1)?.purchaseAmount, 1800000);
  assert.equal(reads, 2);
  assert.equal(writes, 1, 'read invalidation must never replay a mutation');
});

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
    const data = loansAt().map((row) => ({ ...row, loanAmount: request === 1 ? 1800000 : 2800000 }));
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
