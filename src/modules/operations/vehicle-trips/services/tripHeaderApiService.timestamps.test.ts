import assert from 'node:assert/strict';
import test from 'node:test';
import { formatIstStamp } from './tripHeaderApiService';

test('shared formatter retains IST seconds and crosses calendar boundaries correctly', () => {
  assert.equal(formatIstStamp('2026-09-16T20:00:01Z'), '17-09-2026 01:30:01 IST');
  assert.equal(formatIstStamp('2025-12-31T18:30:00Z'), '01-01-2026 00:00:00 IST');
  assert.equal(formatIstStamp('2026-09-16T10:00:00+05:30'), '16-09-2026 10:00:00 IST');
});

test('canonical, empty and legacy stamps retain the existing pass-through behavior', () => {
  for (const value of ['16-09-2026 10:00:00 IST', '16-09-2026 10:00 IST', '09:30', 'invalid']) {
    assert.equal(formatIstStamp(value), value);
  }
  assert.equal(formatIstStamp(null), '');
  assert.equal(formatIstStamp(undefined), '');
  assert.equal(formatIstStamp(''), '');
});

test('formatter reuse never leaks the date from a previous row', () => {
  for (let i = 0; i < 200; i++) {
    assert.equal(formatIstStamp('2026-09-16T20:00:01Z'), '17-09-2026 01:30:01 IST');
    assert.equal(formatIstStamp('2025-12-31T18:30:00Z'), '01-01-2026 00:00:00 IST');
  }
});
