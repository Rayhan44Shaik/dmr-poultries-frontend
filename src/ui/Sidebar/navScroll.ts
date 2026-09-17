// src/ui/Sidebar/navScroll.ts
// -----------------------------------------------------------------------------
// The math behind "keep the current page's row visible" — kept pure so it can
// be tested without a DOM, and so the policy is written down once:
//
//   • the nav list only moves when the row is genuinely off-screen;
//   • it then moves the MINIMUM distance — never centred, never to the top;
//   • and it never moves at all when the user is the one who navigated
//     (a click or a keypress inside the list), because that is what used to
//     drag the list back to the active row ~700 ms after you had scrolled away.
//
// The list itself is a bounded flex child with `overflow-y-auto` (see Sidebar
// renderNav), so `scrollTop` is the list's own scroll — the page never scrolls
// because the navigation scrolled, and vice versa.
// -----------------------------------------------------------------------------

export interface ScrollBox {
  top: number;
  bottom: number;
}

/**
 * Pixels the list has to move so `row` is inside `nav`.
 * `0` means it is already visible → the caller must not scroll.
 * Negative = scroll up, positive = scroll down.
 */
export function navRevealDelta(nav: ScrollBox, row: ScrollBox): number {
  if (row.top < nav.top) return row.top - nav.top;
  if (row.bottom > nav.bottom) return row.bottom - nav.bottom;
  return 0;
}

/** One reveal per (nav instance, sidebar mode, route). Re-runs of the same
 *  effect — extra renders, a query tweak — must not scroll again. */
export function navRevealKey(scope: string, mode: string, pathname: string): string {
  return `${scope}|${mode}|${pathname}`;
}

/** Should the list move at all right now? */
export function shouldRevealNavRow(input: {
  delta: number;
  userInitiated: boolean;
  alreadyRevealed: boolean;
}): boolean {
  if (input.userInitiated) return false;
  if (input.alreadyRevealed) return false;
  return input.delta !== 0;
}
