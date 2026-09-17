// src/layouts/DashboardLayout/pageScrollKey.test.ts
// The shell scrolls the content to the top when a different page mounts — and
// for nothing else. Everything here is what a user feels as "it jumped".
import assert from 'node:assert/strict';
import test from 'node:test';
import { pageScrollKey } from './pageScrollKey';

test('a different path is a different page', () => {
  assert.notEqual(pageScrollKey('/operations'), pageScrollKey('/reports'));
  assert.equal(pageScrollKey('/operations'), '/operations');
  assert.equal(pageScrollKey('/masters/shops', '?anything=1'), '/masters/shops', 'unrelated params never enter the key');
});

test('in a hub section the tab IS the page', () => {
  assert.equal(pageScrollKey('/operations', '?tab=shop-sales'), '/operations?tab=shop-sales');
  assert.notEqual(
    pageScrollKey('/operations', '?tab=shop-sales'),
    pageScrollKey('/operations', '?tab=trips'),
    'switching tabs must land at the top of the new page',
  );
  assert.notEqual(pageScrollKey('/reports', '?tab=shopLedger'), pageScrollKey('/reports', '?tab=trips'));
});

test('a bare hub URL and its default tab are the same page', () => {
  // The hub rewrites /operations → /operations?tab=overview; the key must not
  // fire a second scroll-to-top for what is only a URL tidy-up.
  assert.equal(pageScrollKey('/operations', '?tab=overview'), pageScrollKey('/operations', '?tab=overview'));
  assert.notEqual(pageScrollKey('/operations'), pageScrollKey('/operations', '?tab=overview'), 'first paint may reset');
});

test('in-page state never throws the view back to the top', () => {
  const states = [
    '?collectionDate=2026-09-16',
    '?collectionDate=2026-09-15&assignmentDate=2026-09-14',
    '?page=4&size=25',
    '?q=no-such-shop&demo=1',
    '',
  ];
  for (const search of states) {
    assert.equal(
      pageScrollKey('/operations/orders/collection', search),
      pageScrollKey('/operations/orders/collection', ''),
      `${search || '(no query)'} must not reset the scroll of the Orders page`,
    );
  }
});

test('a module that owns its routes is keyed by the route alone', () => {
  const keys = [
    pageScrollKey('/operations/orders/collection', '?demo=1'),
    pageScrollKey('/operations/orders/assignment'),
    pageScrollKey('/operations/orders/delivery-tracking'),
  ];
  assert.deepEqual(new Set(keys).size, 3, 'each Orders page is its own key');
  assert.equal(keys[0], pageScrollKey('/operations/orders/collection'));
});
