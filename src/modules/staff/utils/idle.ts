// src/modules/staff/utils/idle.ts
//
// ============================================================================
// RUN WHEN IDLE — low-priority work that must never block a first paint
// ============================================================================
// Small helper for the driver / supervisor performance pages: warm-up work
// (prefetching the ‹ › neighbours of an open pop-up) is useful but never
// urgent, so it runs when the browser is genuinely idle instead of competing
// with the click that opened it.
//
//   • Uses `requestIdleCallback` where it exists (Chrome/Edge/Safari 17+),
//     with a timeout so the work still happens on a busy page.
//   • Falls back to a short `setTimeout` elsewhere (Firefox, jsdom) — a
//     missing browser API must never break the page.
//   • Returns a cancel function, so it is safe inside `useEffect` cleanup and
//     can never fire after the component unmounts.
// ============================================================================

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Schedule `task` for the browser's next idle slice.
 *
 * @param task      work to run once the main thread is free
 * @param timeoutMs hard deadline so the task still runs on a busy page
 * @returns cancel function (idempotent)
 */
export function runWhenIdle(task: () => void, timeoutMs = 400): () => void {
  const scope = window as IdleCapableWindow;

  if (typeof scope.requestIdleCallback === "function") {
    const handle = scope.requestIdleCallback(task, { timeout: timeoutMs });
    return () => {
      if (typeof scope.cancelIdleCallback === "function") scope.cancelIdleCallback(handle);
    };
  }

  const handle = window.setTimeout(task, 120);
  return () => window.clearTimeout(handle);
}
