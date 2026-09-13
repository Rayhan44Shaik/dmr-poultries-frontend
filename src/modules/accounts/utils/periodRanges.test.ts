import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  customRange,
  monthRange,
  periodForWindow,
  quarterRange,
  toISODate,
  weekRange,
} from './periodRanges';

/* A fixed "today" so the chips' own ranges are predictable: Sunday 13 Sep 2026,
   which makes the current week Mon 07 Sep → Sun 13 Sep. */
const NOW = new Date(2026, 8, 13, 10, 30);
const iso = (range: { start: Date; end: Date }) => `${toISODate(range.start)}..${toISODate(range.end)}`;

test('each chip means the dates it has always meant', () => {
  assert.equal(iso(weekRange(NOW)), '2026-09-07..2026-09-13');
  assert.equal(iso(quarterRange(NOW)), '2026-01-01..2026-12-31');
  // September 2026 snaps out to whole weeks: Mon 31 Aug → Sun 27 Sep.
  assert.equal(iso(monthRange(new Date(2026, 8, 1))), '2026-08-31..2026-09-27');
  assert.equal(iso(monthRange(new Date(2026, 7, 1))), '2026-07-27..2026-08-30');
  assert.equal(iso(customRange('2026-09-07', '2026-09-13')), '2026-09-07..2026-09-13');
});

test('a window the current-week chip already shows lands on that chip', () => {
  const landing = periodForWindow('2026-09-07', '2026-09-13', NOW);
  assert.equal(landing?.period, 'week');
  assert.equal(landing?.customStart, '2026-09-07');
  assert.equal(landing?.customEnd, '2026-09-13');
});

test('last week is NOT the "This Week" chip — it keeps its own seven days', () => {
  const landing = periodForWindow('2026-08-31', '2026-09-06', NOW);
  assert.equal(landing?.period, 'custom');
  assert.equal(landing?.customStart, '2026-08-31');
  assert.equal(landing?.customEnd, '2026-09-06');
});

test('fifteen days, and any other span, arrive exactly as they were', () => {
  const landing = periodForWindow('2026-08-30', '2026-09-13', NOW);
  assert.equal(landing?.period, 'custom');
  assert.equal(`${landing?.customStart}..${landing?.customEnd}`, '2026-08-30..2026-09-13');
});

test('a calendar month is not forced onto the Month chip when that chip would move it', () => {
  // The Month chip shows September as 31 Aug → 27 Sep, so 1–30 Sep stays Custom
  // and the analysis keeps the exact month the dashboard was showing.
  const landing = periodForWindow('2026-09-01', '2026-09-30', NOW);
  assert.equal(landing?.period, 'custom');
  assert.equal(`${landing?.customStart}..${landing?.customEnd}`, '2026-09-01..2026-09-30');
});

test('the Month chip is used when it genuinely shows the same dates', () => {
  const landing = periodForWindow('2026-08-31', '2026-09-27', NOW);
  assert.equal(landing?.period, 'month');
  assert.equal(toISODate(landing!.monthDate!), '2026-09-01');
});

test('the whole-year window lands on the Quarter chip, which is what it shows', () => {
  assert.equal(periodForWindow('2026-01-01', '2026-12-31', NOW)?.period, 'quarter');
});

test('a window that is not two well-ordered dates is refused', () => {
  assert.equal(periodForWindow('2026-09-13', '2026-09-07', NOW), null);
  assert.equal(periodForWindow('2026-9-7', '2026-09-13', NOW), null);
  assert.equal(periodForWindow('', '2026-09-13', NOW), null);
  assert.equal(periodForWindow('yesterday', 'today', NOW), null);
});
