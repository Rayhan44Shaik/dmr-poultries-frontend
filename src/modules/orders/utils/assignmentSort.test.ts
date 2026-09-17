import assert from 'node:assert/strict';
import test from 'node:test';
import { compareAssignmentRows, type AssignmentSort, type AssignmentSortRow } from './assignmentSort';

const a: AssignmentSortRow = { name: 'Alpha', city: 'Guntur', birds: 20, boxes: 2, weight: 40, sequence: 1, vehicle: 'AP01', trip: 'TRP-1', assigned: false };
const b: AssignmentSortRow = { name: 'Beta', city: 'Vijayawada', birds: 100, boxes: 10, weight: 200, sequence: 2, vehicle: 'AP02', trip: 'TRP-2', assigned: true };

test('all visible table columns sort in the requested direction', () => {
  const ascending: AssignmentSort[] = ['pending', 'sequence', 'az', 'city_az', 'birds_asc', 'boxes_asc', 'weight_asc', 'vehicle_trip'];
  const descending: AssignmentSort[] = ['za', 'city_za', 'birds_desc', 'boxes_desc', 'weight_desc'];
  for (const mode of ascending) assert.ok(compareAssignmentRows(a, b, mode) < 0, mode);
  for (const mode of descending) assert.ok(compareAssignmentRows(a, b, mode) > 0, mode);
});

test('ties keep original order; bad numeric values do not produce NaN', () => {
  assert.ok(compareAssignmentRows(a, { ...a, sequence: 5 }, 'az') < 0);
  assert.ok(Number.isFinite(compareAssignmentRows({ ...a, weight: NaN }, b, 'weight_asc')));
});

test('numeric sort applies to the complete result before taking a page', () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({ ...a, sequence: index, boxes: index + 1 }));
  const sorted = [...rows].sort((left, right) => compareAssignmentRows(left, right, 'boxes_desc'));
  assert.deepEqual(sorted.slice(0, 10).map(row => row.boxes), [30, 29, 28, 27, 26, 25, 24, 23, 22, 21]);
  assert.equal(rows[0].boxes, 1);
});
