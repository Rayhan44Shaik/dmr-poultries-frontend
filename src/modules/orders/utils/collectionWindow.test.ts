// src/modules/orders/utils/collectionWindow.test.ts
// The Order Collection day window: how long it stays open, when it locks, and
// when it files itself. There is no "Finish Collection" button — the deadline
// is the only thing that submits a day — so this window IS the business rule
// and it is pinned here (see OrderCollectionPage's auto-submit effect).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COLLECTION_GRACE_DAYS,
  collectionAutoSubmitDelay,
  collectionDeadline,
  formatCollectionDeadline,
  formatCountdown,
  isCollectionAutoClosed,
} from './ordersUtils';

test('a collection day stays open for two extra calendar days', () => {
  assert.equal(COLLECTION_GRACE_DAYS, 2);
  // 16/09 is still editable on 17/09 and closes at the start of 18/09.
  assert.deepEqual(collectionDeadline('2026-09-16'), new Date('2026-09-18T00:00:00'));
});

test('the deadline is printed with the clock time it actually is', () => {
  // Midnight, because the window ends at the start of the third day — and the
  // copy derives it from the Date rather than hardcoding "12:00 AM".
  assert.equal(formatCollectionDeadline('2026-09-16'), '18/09 12:00 AM');
  assert.equal(formatCollectionDeadline('not-a-day'), '');
});

test('the day locks on the deadline, not the day after it', () => {
  assert.equal(isCollectionAutoClosed('2026-09-16', new Date('2026-09-17T23:59:59')), false);
  assert.equal(isCollectionAutoClosed('2026-09-16', new Date('2026-09-18T00:00:00')), true);
  assert.equal(isCollectionAutoClosed('2026-09-16', new Date('2026-09-18T00:00:01')), true);
});

test('auto-submit fires exactly at the deadline, and at once if it passed', () => {
  const now = new Date('2026-09-17T18:00:00');
  // 6 hours left on the 16th's window.
  assert.equal(collectionAutoSubmitDelay('2026-09-16', now), 6 * 60 * 60 * 1000);
  // Past the deadline → 0 means "submit as soon as the page can", never negative.
  assert.equal(collectionAutoSubmitDelay('2026-09-14', now), 0);
  assert.equal(collectionAutoSubmitDelay('2026-09-16', new Date('2026-09-18T00:00:00')), 0);
  // A day that is still far away is scheduled, not submitted early.
  assert.ok(collectionAutoSubmitDelay('2026-09-17', now)! > 0);
  // An unparsable day schedules nothing at all.
  assert.equal(collectionAutoSubmitDelay('garbage', now), null);
});

test('every selectable day fits inside a real setTimeout window', () => {
  // setTimeout overflows past ~24.8 days; the picker offers 10 days back to
  // today, and the furthest legal deadline is 10 + 2 days away.
  const today = new Date('2026-09-17T00:00:00');
  const oldest = '2026-09-08'; // today - 9
  const delay = collectionAutoSubmitDelay(oldest, today);
  assert.equal(delay, 0, 'an old day is already closed — it submits on load');
  const latest = collectionAutoSubmitDelay('2026-09-26', today)!;
  assert.ok(latest <= 2 ** 31 - 1, 'a day inside the picker window always arms a timer');
});

test('the chip counts the window down in d/h/m', () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  // A full day left shows the day first — the unit that matters when deciding
  // whether there is still time to enter a shop.
  assert.equal(formatCountdown(DAY + 4 * HOUR + 12 * 60_000), '1d 04h 12m');
  assert.equal(formatCountdown(6 * HOUR + 1 * 60_000), '6h 01m');
  assert.equal(formatCountdown(9 * 60_000), '9m');
  // Past the deadline the day is filed, so nothing counts down any more.
  assert.equal(formatCountdown(0), 'moments');
  assert.equal(formatCountdown(-5_000), 'moments');
  assert.equal(formatCountdown(Number.NaN), 'moments');
});
