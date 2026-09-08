import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import type { Vehicle } from '../../src/modules/masters/vehicles/types/vehicle';
import { buildSampleEmiVehicles } from '../../scripts/fixtures/emi-vehicles.mjs';
import {
  computeEmiOverview, computeKpis, computeVehicleEmiSchedule, getEmiToday,
  msUntilNextEmiDay, normalizeEmiSearch, sortEmiOverview,
  type EmiSortKey,
} from '../../src/modules/fleet-operations/services/emiModel';

const base = buildSampleEmiVehicles(new Date('2026-09-08T12:00:00+05:30'))[0];
const vehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  ...base, status: 'Active', isSample: true, purchaseAmount: 120_000,
  emiStartDate: '2026-09-01', totalEMIs: 12, emiDay: 8, ...overrides,
});
const count = (input: Vehicle, date: string) => computeEmiOverview([input], date)[0].completedEMIs;

test('completion changes on the due day, not a day earlier through UTC conversion', () => {
  const input = vehicle();
  for (const [date, completed] of [['2026-09-07', 0], ['2026-09-08', 1], ['2026-09-30', 1], ['2026-10-07', 1], ['2026-10-08', 2]] as const) {
    assert.equal(count(input, date), completed, date);
  }
  assert.equal(count(vehicle({ emiStartDate: '2027-01-01' }), '2026-12-31'), 0);
  assert.equal(count(vehicle({ emiStartDate: '2020-01-01' }), '2026-09-08'), 12);
});

test('month-end schedules clamp correctly without skipping February or shifting dates', () => {
  const input = vehicle({ emiStartDate: '2024-01-31', totalEMIs: 4, emiDay: 31 });
  assert.deepEqual(computeVehicleEmiSchedule(input, '2024-02-28').map((row) => row.dueDate), [
    '2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30',
  ]);
  assert.equal(count(input, '2024-02-28'), 1);
  assert.equal(count(input, '2024-02-29'), 2);
  const nonLeap = vehicle({ emiStartDate: '2025-01-31', totalEMIs: 3, emiDay: 31 });
  assert.equal(count(nonLeap, '2025-02-27'), 1);
  assert.equal(count(nonLeap, '2025-02-28'), 2);
  assert.deepEqual(computeVehicleEmiSchedule(nonLeap, '2025-03-31').map((row) => row.dueDate), [
    '2025-01-31', '2025-02-28', '2025-03-31',
  ]);
});

test('overview counts and explicit schedules agree for every due day and start day', () => {
  for (const start of ['2024-01-01', '2024-01-31', '2024-02-29', '2025-12-31']) {
    for (const day of [1, 8, 28, 29, 30, 31]) {
      const input = vehicle({ emiStartDate: start, totalEMIs: 36, emiDay: day });
      for (const date of ['2023-12-31', '2024-02-28', '2024-02-29', '2025-03-01', '2026-09-08', '2030-01-01']) {
        const schedule = computeVehicleEmiSchedule(input, date);
        const elapsed = schedule.filter((row) => row.dueDate <= date).length;
        assert.equal(count(input, date), elapsed, `${start} / ${day} / ${date}`);
        assert.equal(schedule.filter((row) => row.status === 'COMPLETED').length, elapsed);
      }
    }
  }
});

test('business date and one-shot rollover delay use IST independently of browser timezone', () => {
  const before = new Date('2026-09-07T18:29:59.999Z');
  const midnight = new Date('2026-09-07T18:30:00.000Z');
  assert.equal(getEmiToday(before), '2026-09-07');
  assert.equal(getEmiToday(midnight), '2026-09-08');
  assert.equal(msUntilNextEmiDay(before.getTime()), 1);
  assert.equal(msUntilNextEmiDay(midnight.getTime()), 86_400_000);
});

test('API ISO date values are normalized to their calendar date, with purchase-date fallback', () => {
  assert.equal(computeEmiOverview([vehicle({ emiStartDate: '2026-09-01T00:00:00.000Z' })], '2026-09-08')[0].emiStartDate, '2026-09-01');
  const input = vehicle({ emiStartDate: undefined, purchaseDate: '2026-09-01' });
  assert.equal(count(input, '2026-09-08'), 1);
});

test('cash/incomplete vehicles are excluded while inactive financed vehicles remain eligible', () => {
  assert.deepEqual(computeEmiOverview([vehicle({ totalEMIs: undefined }), vehicle({ purchaseAmount: 0 }), vehicle({ emiDay: undefined })]), []);
  assert.equal(computeEmiOverview([vehicle({ status: 'Inactive' })]).length, 1);
});

for (const overrides of [
  { purchaseAmount: Number.MAX_SAFE_INTEGER + 1 }, { vehicleNumber: '' }, { vehicleNumber: 'A'.repeat(121) },
  { purchaseAmount: Infinity }, { purchaseAmount: -1 }, { purchaseAmount: NaN },
  { totalEMIs: Infinity }, { totalEMIs: NaN }, { totalEMIs: 2.5 }, { totalEMIs: -1 },
  { emiDay: Infinity }, { emiDay: NaN }, { emiDay: 32 }, { emiDay: 2.5 },
  { id: NaN }, { id: 0 }, { emiStartDate: '2026-02-30' }, { emiStartDate: '2026-13-01' },
  { emiStartDate: 'invalid' }, { emiStartDate: '2026-09-01T25:00:00Z' },
] satisfies Partial<Vehicle>[]) {
  test(`invalid EMI details fail closed: ${Object.keys(overrides)[0]} = ${String(Object.values(overrides)[0])}`, () => {
    assert.throws(() => computeEmiOverview([vehicle(overrides)], '2026-09-08'));
  });
}

test('identical IDs are deduplicated, conflicting duplicates fail instead of picking financial data arbitrarily', () => {
  const input = vehicle();
  const rows = computeEmiOverview([input, { ...input }], '2026-09-08');
  assert.equal(rows.length, 1);
  assert.equal(computeKpis(rows).totalVehicles, 1);
  const conflict = vehicle({ purchaseAmount: 999_999 });
  assert.throws(() => computeEmiOverview([input, conflict]), /Conflicting duplicate/);
  assert.throws(() => computeEmiOverview([conflict, input]), /Conflicting duplicate/);
});

test('ties sort deterministically regardless of response order and without mutating inputs', () => {
  const rows = computeEmiOverview([
    vehicle({ id: 3, vehicleNumber: 'AP 10' }),
    vehicle({ id: 1, vehicleNumber: 'AP 2' }),
    vehicle({ id: 2, vehicleNumber: 'AP 02' }),
  ], '2026-09-08');
  const original = structuredClone(rows);
  const keys: EmiSortKey[] = ['vehicleNumber', 'purchaseAmount', 'totalEMIs', 'completedEMIs', 'pendingEMIs', 'emiStartDate', 'status'];
  for (const key of keys) {
    for (const direction of ['asc', 'desc'] as const) {
      assert.deepEqual(sortEmiOverview(rows, key, direction), sortEmiOverview([...rows].reverse(), key, direction));
    }
  }
  assert.deepEqual(sortEmiOverview(rows, 'purchaseAmount', 'asc').map((row) => row.vehicleId), [1, 2, 3]);
  assert.deepEqual(rows, original);
});

test('search normalization is literal, case-insensitive and ignores registration spacing/dashes', () => {
  assert.equal(normalizeEmiSearch(' ap-16 TC 4101 '), 'ap16tc4101');
  assert.equal(normalizeEmiSearch('[.*]+'), '[.*]+');
});

test('large terms do not generate installment arrays; oversized details are bounded', () => {
  const input = vehicle({ totalEMIs: Number.MAX_SAFE_INTEGER });
  const [row] = computeEmiOverview([input], '2026-09-08');
  assert.equal(row.completedEMIs, 1);
  assert.equal(row.pendingEMIs, Number.MAX_SAFE_INTEGER - 1);
  assert.throws(() => computeVehicleEmiSchedule(input), /safe display limit/);
});

test('20,000 vehicles remain a bounded linear overview plus deterministic sort', { timeout: 10_000 }, (t) => {
  const inputs = Array.from({ length: 20_000 }, (_, index) => vehicle({
    id: index + 1, vehicleNo: index + 1, vehicleNumber: `AP 16 TEST ${index + 1}`, totalEMIs: 1_000_000_000,
  }));
  const start = performance.now();
  const rows = computeEmiOverview(inputs, '2026-09-08');
  const sorted = sortEmiOverview(rows, 'purchaseAmount', 'asc');
  const elapsed = performance.now() - start;
  assert.equal(sorted.length, 20_000);
  assert.equal(new Set(sorted.map((row) => row.vehicleId)).size, 20_000);
  assert.ok(elapsed < 5_000, `20,000 rows took ${elapsed.toFixed(1)} ms`);
  t.diagnostic(`20,000 vehicle overviews + sort: ${elapsed.toFixed(1)} ms; no installment expansion`);
});
