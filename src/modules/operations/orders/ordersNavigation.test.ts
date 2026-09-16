import assert from 'node:assert/strict';
import test from 'node:test';
import { ORDER_TABS, ordersDay, ordersTabUrl, resolveOrdersTab } from './ordersNavigation';
import { clampPage, computeTotalPages, pageRecordRange } from '../../../shared/ui/paginationStyles';

test('all Orders tabs resolve to distinct, reloadable Operations URLs', () => {
  for (const tab of ORDER_TABS) {
    const url = new URL(ordersTabUrl('?tab=orders', tab), 'https://preview.example');
    assert.equal(url.pathname, '/operations');
    assert.equal(url.searchParams.get('tab'), 'orders');
    assert.equal(resolveOrdersTab(url.searchParams.get('orderTab')), tab);
  }
});

test('invalid/missing tab values safely resolve to collection', () => {
  for (const tab of [null, '', 'bad', '../tracking', '<script>', 'Assignment']) {
    assert.equal(resolveOrdersTab(tab), 'collection');
  }
});

test('tab changes keep the two independent dates and unrelated parameters', () => {
  const url = new URL(ordersTabUrl('?tab=orders&collectionDate=2026-09-15&assignmentDate=2026-09-16&demo=1', 'tracking'), 'https://preview.example');
  assert.equal(url.searchParams.get('collectionDate'), '2026-09-15');
  assert.equal(url.searchParams.get('assignmentDate'), '2026-09-16');
  assert.equal(url.searchParams.get('demo'), '1');
  assert.equal(url.searchParams.getAll('tab').length, 1);
});

test('dates are real calendar days in the available window, never future', () => {
  const today = '2026-09-16';
  const days = ['2026-09-15', today];
  assert.equal(ordersDay('2026-09-15', today, days), '2026-09-15');
  for (const date of [null, '', '2026-09-31', '2026-09-17', '2026-01-01', '16/09/2026']) {
    assert.equal(ordersDay(date, today, days), today);
  }
});

test('global pagination clamps after filtering and counts the full result set', () => {
  assert.equal(computeTotalPages(200, 15), 14);
  assert.deepEqual(pageRecordRange(14, 15, 200), { from: 196, to: 200 });
  assert.equal(clampPage(14, computeTotalPages(2, 15)), 1);
  assert.deepEqual(pageRecordRange(1, 15, 0), { from: 0, to: 0 });
});
