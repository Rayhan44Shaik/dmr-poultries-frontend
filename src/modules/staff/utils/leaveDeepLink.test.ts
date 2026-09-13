import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEAVE_STATUS_VALUES,
  PENDING_LEAVES_PATH,
  leaveFiltersFromSearch,
} from './leaveDeepLink';

test('the pending-leave link the tiles send opens the Leave page on the queue', () => {
  const url = new URL(PENDING_LEAVES_PATH, 'http://localhost:5173');
  assert.equal(url.pathname, '/staff');
  assert.equal(url.searchParams.get('tab'), 'leaves');
  assert.deepEqual(leaveFiltersFromSearch(url.search), { status: 'Pending', month: '' });
});

test('a pending link means every month, not just the current one', () => {
  // The page's own default is this month; a request raised in July would
  // otherwise vanish from the very list the tile counted.
  assert.deepEqual(leaveFiltersFromSearch('?status=Pending&month=all'), {
    status: 'Pending',
    month: '',
  });
  assert.deepEqual(leaveFiltersFromSearch('?status=Pending&month='), {
    status: 'Pending',
    month: '',
  });
});

test('any status the toggle owns can be asked for', () => {
  for (const status of LEAVE_STATUS_VALUES) {
    assert.deepEqual(leaveFiltersFromSearch(`?status=${status}`), { status });
  }
});

test('a specific month is honoured when the link names one', () => {
  assert.deepEqual(leaveFiltersFromSearch('?status=Pending&month=2026-07'), {
    status: 'Pending',
    month: '2026-07',
  });
  assert.deepEqual(leaveFiltersFromSearch('?month=2026-12'), { month: '2026-12' });
});

test('a link carrying nothing usable leaves the page on its own defaults', () => {
  assert.equal(leaveFiltersFromSearch(''), undefined);
  assert.equal(leaveFiltersFromSearch('?tab=leaves'), undefined);
});

test('rubbish in the link is ignored rather than half-applied', () => {
  assert.equal(leaveFiltersFromSearch('?status=Bogus'), undefined);
  assert.equal(leaveFiltersFromSearch('?status=pending'), undefined);
  assert.equal(leaveFiltersFromSearch('?month=september'), undefined);
  assert.equal(leaveFiltersFromSearch('?month=2026-13'), undefined);
  assert.equal(leaveFiltersFromSearch('?month=26-07'), undefined);
  // …and a bad month must not drag a good status down with it.
  assert.deepEqual(leaveFiltersFromSearch('?status=Pending&month=nonsense'), {
    status: 'Pending',
  });
});
