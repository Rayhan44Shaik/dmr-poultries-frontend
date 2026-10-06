import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENUINE_ACTIVITY_EVENTS,
  IDLE_TIMEOUT_MS,
  isGenuineActivityEvent,
  isIdleExpired,
} from './idleActivity';

// The 10-minute rule: exactly 10 minutes of TRUE inactivity logs the user
// out. Genuine interaction resets it; viewing/focus/visibility never do.

test('idle timeout is exactly 10 minutes', () => {
  assert.equal(IDLE_TIMEOUT_MS, 10 * 60 * 1000);
});

test('genuine interaction events reset the timer', () => {
  for (const event of [
    'pointermove', 'pointerdown', 'pointerup',
    'mousemove', 'mousedown', 'mouseup', 'click',
    'keydown', 'keyup', 'keypress',
    'touchstart', 'touchend', 'touchmove',
    'wheel',
    'input', 'change', 'submit',
  ]) {
    assert.equal(isGenuineActivityEvent(event), true, `${event} is genuine activity`);
  }
});

test('viewing, focus, and visibility NEVER reset the timer', () => {
  for (const event of ['focus', 'blur', 'scroll', 'visibilitychange']) {
    assert.equal(isGenuineActivityEvent(event), false, `${event} must not reset the timer`);
  }
  assert.ok(!GENUINE_ACTIVITY_EVENTS.includes('focus'));
  assert.ok(!GENUINE_ACTIVITY_EVENTS.includes('visibilitychange'));
  assert.ok(!GENUINE_ACTIVITY_EVENTS.includes('scroll'));
});

test('9m30s idle is alive, beyond-10m idle is expired', () => {
  const now = Date.now();
  assert.equal(isIdleExpired(now - (9 * 60 * 1000 + 30 * 1000), now), false);
  assert.equal(isIdleExpired(now - (10 * 60 * 1000 + 1000), now), true);
});

test('continuous form editing never expires (each keystroke re-seeds now)', () => {
  let last = Date.now() - 11 * 60 * 1000;
  const now = Date.now();
  // 12 minutes of typing at 5s intervals: every tick is fresh.
  for (let t = last; t < now; t += 5000) last = t;
  assert.equal(isIdleExpired(last, now), false);
});

test('future timestamps never expire early', () => {
  const now = Date.now();
  assert.equal(isIdleExpired(now + 60_000, now), false);
});
