import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORDER_TABS,
  ordersCanonicalUrl,
  ordersDay,
  ordersQueryForPath,
  ordersTabUrl,
  resolveOrdersTab,
} from './ordersNavigation';
import { ORDERS_PAGES, ORDERS_ROUTE_BASE, ordersPathForTab, ordersTabForPath } from '../routes/ordersRoutes';
import { NAV_CHILD_GROUPS, NAV_SECTIONS, NAV_TONE_CLASS, resolveRoute } from '../../../routes/navigation';
import en from '../../../i18n/en';
import te from '../../../i18n/te';

/** The dictionaries are literal objects; read them by key for assertions. */
type Dict = Record<string, string | undefined>;
import { clampPage, computeTotalPages, pageRecordRange } from '../../../shared/ui/paginationStyles';

test('every Orders page is a real, reloadable route under Operations', () => {
  assert.deepEqual(ORDER_TABS, ['collection', 'assignment', 'tracking']);
  for (const page of ORDERS_PAGES) {
    assert.ok(page.path.startsWith(ORDERS_ROUTE_BASE), `${page.path} lives under ${ORDERS_ROUTE_BASE}`);
    assert.equal(ordersPathForTab(page.tab), page.path);
    assert.equal(ordersTabForPath(page.path), page.tab);
    // The path alone selects the page — no query string required.
    assert.equal(resolveOrdersTab(page.path), page.tab);
  }
  // Three distinct pages, no duplicates.
  assert.equal(new Set(ORDERS_PAGES.map((p) => p.path)).size, 3);
});

test('unknown paths and junk values never render a blank page', () => {
  for (const input of ['/operations', '/operations/orders', '/operations?tab=orders', '/nope']) {
    assert.equal(resolveOrdersTab(input), 'collection');
  }
  for (const tab of [null, '', 'bad', '../tracking', '<script>', 'Assignment']) {
    assert.equal(resolveOrdersTab('/operations', tab ? `?orderTab=${tab}` : ''), 'collection');
  }
});

test('legacy ?tab=orders&orderTab=x deep links canonicalise to the page path', () => {
  for (const tab of ORDER_TABS) {
    const url = new URL(ordersCanonicalUrl('/operations', `?tab=orders&orderTab=${tab}`), 'https://preview.example');
    assert.equal(url.pathname, ordersPathForTab(tab));
    assert.equal(url.searchParams.get('tab'), null);
    assert.equal(url.searchParams.get('orderTab'), null);
  }
  // An unknown legacy value falls back to the first page.
  const fallback = new URL(ordersCanonicalUrl('/operations', '?tab=orders&orderTab=nope'), 'https://preview.example');
  assert.equal(fallback.pathname, `${ORDERS_ROUTE_BASE}/collection`);
});

test('switching pages keeps the two independent dates and unrelated parameters', () => {
  const url = new URL(
    ordersTabUrl('?tab=orders&orderTab=collection&collectionDate=2026-09-15&assignmentDate=2026-09-16&demo=1', 'tracking'),
    'https://preview.example',
  );
  assert.equal(url.pathname, `${ORDERS_ROUTE_BASE}/delivery-tracking`);
  assert.equal(url.searchParams.get('collectionDate'), '2026-09-15');
  assert.equal(url.searchParams.get('assignmentDate'), '2026-09-16');
  assert.equal(url.searchParams.get('demo'), '1');
  assert.equal(url.searchParams.get('tab'), null, 'tab is carried by the path now');
});

test('ordersQueryForPath drops only the params the path replaces', () => {
  assert.equal(ordersQueryForPath('?tab=orders&orderTab=collection&shopId=7'), '?shopId=7');
  assert.equal(ordersQueryForPath('?tab=orders&orderTab=collection'), '');
  assert.equal(ordersQueryForPath(''), '');
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

test('the sidebar shows the module as one Orders group of three rows under Operations', () => {
  const operations = NAV_SECTIONS.find((section) => section.id === 'operations');
  assert.ok(operations, 'Operations section exists');
  const rows = (operations?.children ?? []).filter((child) => child.group === 'orders');
  assert.deepEqual(
    rows.map((child) => child.path),
    ORDERS_PAGES.map((page) => page.path),
    'one nav row per Orders page, in workflow order',
  );

  const group = NAV_CHILD_GROUPS.orders;
  assert.ok(group?.icon, 'the group has its own heading + logo');
  for (const row of rows) {
    assert.ok(row.icon, `${row.label} has its own glyph`);
    assert.ok(NAV_TONE_CLASS[row.tone!], `${row.label} tone is a real nav tone`);
    assert.ok(!row.path.includes('?'), `${row.path} is a real route, not a ?tab= link`);
    // Header breadcrumbs and the browser title come from the same row.
    const resolved = resolveRoute(row.path);
    assert.equal(resolved.page?.label, row.label);
    assert.equal(resolved.section?.id, 'operations');
    // And both dictionaries carry the labels, so the row never renders a raw key.
    for (const dict of [en as Dict, te as Dict]) {
      assert.ok(dict[row.labelKey!], `${row.labelKey} is translated`);
      assert.ok(dict[row.titleKey!], `${row.titleKey} is translated`);
    }
  }
  assert.ok((en as Dict)[group.labelKey] && (te as Dict)[group.labelKey], 'the group heading is translated');
});
