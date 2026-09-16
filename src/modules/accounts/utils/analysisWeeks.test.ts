import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisWeeks } from './analysisWeeks';
import { parseBusinessDate } from '../../../utils/businessDate';

test('week groups include all Monday and Sunday records exactly once', () => {
  const start = new Date(2026, 8, 14);
  const end = new Date(2026, 8, 27, 23, 59, 59, 999);
  const groups = analysisWeeks(start, end);
  assert.equal(groups.length, 2);
  for (let day = 14; day <= 27; day++) {
    const date = parseBusinessDate(`2026-09-${day}`)!;
    assert.equal(groups.filter(g => date >= g.start && date <= g.end).length, 1, `day ${day}`);
  }
  assert.equal(groups[0].end.getHours(), 23);
  assert.equal(groups[1].start.getHours(), 0);
});
test('custom weeks never include dates outside the chosen range', () => {
  const start = new Date(2026, 8, 16);
  const end = new Date(2026, 8, 23, 23, 59, 59, 999);
  const groups = analysisWeeks(start, end);
  assert.equal(+groups[0].start, +start);
  assert.equal(+groups[groups.length - 1].end, +end);
  assert.equal(+groups[1].start - +groups[0].end, 1);
});
