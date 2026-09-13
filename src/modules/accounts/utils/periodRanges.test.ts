import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  customRange,
  daysInWindow,
  monthRange,
  periodForWindow,
  quarterRange,
  toISODate,
  weekAnchorFor,
  weekRange,
} from './periodRanges';

/* A fixed "today" so the chips' own ranges are predictable: Sunday 13 Sep 2026,
   which makes the current week Mon 07 Sep → Sun 13 Sep. */
const NOW = new Date(2026, 8, 13, 10, 30);
const iso = (range: { start: Date; end: Date }) => `${toISODate(range.start)}..${toISODate(range.end)}`;
const mondayOf = (date?: Date) => (date ? toISODate(date) : undefined);

test('each chip means the dates it has always meant', () => {
  assert.equal(iso(weekRange(NOW)), '2026-09-07..2026-09-13');
  assert.equal(iso(quarterRange(NOW)), '2026-01-01..2026-12-31');
  // September 2026 snaps out to whole weeks: Mon 31 Aug → Sun 27 Sep.
  assert.equal(iso(monthRange(new Date(2026, 8, 1))), '2026-08-31..2026-09-27');
  assert.equal(iso(monthRange(new Date(2026, 7, 1))), '2026-07-27..2026-08-30');
  assert.equal(iso(customRange('2026-09-07', '2026-09-13')), '2026-09-07..2026-09-13');
});

test('the week chip follows its anchor, so it can show any week', () => {
  assert.equal(iso(weekRange(new Date(2026, 8, 9))), '2026-09-07..2026-09-13');
  assert.equal(iso(weekRange(new Date(2026, 8, 3))), '2026-08-31..2026-09-06');
  assert.equal(iso(weekRange(new Date(2026, 0, 1))), '2025-12-29..2026-01-04');
});

test('window lengths are counted inclusive of both ends', () => {
  assert.equal(daysInWindow('2026-09-13', '2026-09-13'), 1);
  assert.equal(daysInWindow('2026-09-07', '2026-09-13'), 7);
  assert.equal(daysInWindow('2026-08-30', '2026-09-13'), 15);
  assert.equal(daysInWindow('2026-08-14', '2026-09-13'), 31);
});

test('a rolling seven days belongs to the week that holds most of it', () => {
  // Wed 09 Sep → Tue 15 Sep: five of its days sit in the week of Mon 07 Sep.
  assert.equal(mondayOf(weekAnchorFor('2026-09-09', '2026-09-15')), '2026-09-07');
  // A window that is already a Mon–Sun week anchors to itself.
  assert.equal(mondayOf(weekAnchorFor('2026-08-31', '2026-09-06')), '2026-08-31');
});

test('a week or less lands on the Week chip, anchored to that week', () => {
  const thisWeek = periodForWindow('2026-09-07', '2026-09-13', NOW);
  assert.equal(thisWeek?.period, 'week');
  assert.equal(mondayOf(thisWeek?.weekAnchor), '2026-09-07');

  // The dashboard's default window is LAST week — the chip shows that week now,
  // not the current one, and not a Custom range.
  const lastWeek = periodForWindow('2026-08-31', '2026-09-06', NOW);
  assert.equal(lastWeek?.period, 'week');
  assert.equal(mondayOf(lastWeek?.weekAnchor), '2026-08-31');
  assert.equal(iso(weekRange(lastWeek!.weekAnchor!)), '2026-08-31..2026-09-06');

  // A single day is a week's worth of chip too.
  assert.equal(periodForWindow('2026-09-11', '2026-09-11', NOW)?.period, 'week');
});

test('a window no chip means — fifteen days — keeps its exact dates on Custom', () => {
  const landing = periodForWindow('2026-08-30', '2026-09-13', NOW);
  assert.equal(landing?.period, 'custom');
  assert.equal(`${landing?.customStart}..${landing?.customEnd}`, '2026-08-30..2026-09-13');
});

test('a month-ish window lands on the Month chip, on the month it ends in', () => {
  // The dashboard's rolling 1M preset: 14 Aug → 13 Sep.
  const rolling = periodForWindow('2026-08-14', '2026-09-13', NOW);
  assert.equal(rolling?.period, 'month');
  assert.equal(mondayOf(rolling?.monthDate), '2026-09-01');

  // A whole calendar month picked on the dashboard.
  const calendar = periodForWindow('2026-09-01', '2026-09-30', NOW);
  assert.equal(calendar?.period, 'month');
  assert.equal(mondayOf(calendar?.monthDate), '2026-09-01');

  // And a window the Month chip shows exactly still lands there.
  assert.equal(periodForWindow('2026-08-31', '2026-09-27', NOW)?.period, 'month');
});

test('a quarter-ish window lands on the Quarter chip, which is this year', () => {
  // The dashboard's rolling QTR preset: 14 Jun → 13 Sep.
  assert.equal(periodForWindow('2026-06-14', '2026-09-13', NOW)?.period, 'quarter');
  assert.equal(periodForWindow('2026-01-01', '2026-12-31', NOW)?.period, 'quarter');
});

test('the Quarter chip cannot show another year, so that window stays Custom', () => {
  const landing = periodForWindow('2025-06-14', '2025-09-13', NOW);
  assert.equal(landing?.period, 'custom');
  assert.equal(`${landing?.customStart}..${landing?.customEnd}`, '2025-06-14..2025-09-13');
});

test('whatever the chip, the window that arrived comes back with it', () => {
  for (const [from, to] of [
    ['2026-09-07', '2026-09-13'],
    ['2026-08-30', '2026-09-13'],
    ['2026-08-14', '2026-09-13'],
    ['2026-06-14', '2026-09-13'],
  ]) {
    const landing = periodForWindow(from, to, NOW)!;
    assert.equal(landing.customStart, from);
    assert.equal(landing.customEnd, to);
  }
});

test('a window that is not two well-ordered dates is refused', () => {
  assert.equal(periodForWindow('2026-09-13', '2026-09-07', NOW), null);
  assert.equal(periodForWindow('2026-9-7', '2026-09-13', NOW), null);
  assert.equal(periodForWindow('', '2026-09-13', NOW), null);
  assert.equal(periodForWindow('yesterday', 'today', NOW), null);
});
