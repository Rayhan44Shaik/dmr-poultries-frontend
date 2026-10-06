// src/modules/auth/idleActivity.ts
// -----------------------------------------------------------------------------
// Idle-timeout activity model (framework-free, unit-tested).
//
// TRUE activity — resets the 10-minute inactivity timer:
//   pointer/mouse interaction, keyboard interaction, touch interaction,
//   wheel, and meaningful form interaction (input/change/submit/click).
//
// NOT activity — must never reset the timer: merely viewing a page, React
// rendering, API polling, background GETs, health checks, timer execution,
// route rendering, a tab becoming visible, or browser focus alone.
// -----------------------------------------------------------------------------

/** Sign out after this much time with zero genuine input. */
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// NOTE: no "focus", no "scroll", no visibilitychange. Focus arriving alone
// and a page becoming visible are explicitly NOT genuine activity. "scroll"
// fires on programmatic scrolling; "wheel" is the real device interaction.
export const GENUINE_ACTIVITY_EVENTS: readonly string[] = [
  "pointermove",
  "pointerdown",
  "pointerup",
  "mousemove",
  "mousedown",
  "mouseup",
  "click",
  "keydown",
  "keyup",
  "keypress",
  "wheel",
  "touchstart",
  "touchend",
  "touchmove",
  "input",
  "change",
  "submit",
];

/** Pure helper: is this DOM event genuine user activity? */
export function isGenuineActivityEvent(eventName: string): boolean {
  return GENUINE_ACTIVITY_EVENTS.includes(eventName);
}

/** Pure helper: has a session with this last-activity timestamp expired? */
export function isIdleExpired(lastActivityMs: number, nowMs = Date.now()): boolean {
  if (!Number.isFinite(lastActivityMs)) return false;
  const elapsed = nowMs - lastActivityMs;
  if (elapsed < 0) return false; // future timestamps never expire early
  return elapsed > IDLE_TIMEOUT_MS;
}
