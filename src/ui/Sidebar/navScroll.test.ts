// src/ui/Sidebar/navScroll.test.ts
// The sidebar list must scroll on its own and must never move by itself when
// you navigate from within it. These are the rules, as numbers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { navRevealDelta, navRevealKey, shouldRevealNavRow } from './navScroll';

const here = path.dirname(fileURLToPath(import.meta.url));

/** A 400px-tall list showing rows 0…400 of a 1200px list. */
const nav = { top: 80, bottom: 480 };

test('a row already on screen leaves the list exactly where the user put it', () => {
  assert.equal(navRevealDelta(nav, { top: 100, bottom: 132 }), 0);
  assert.equal(navRevealDelta(nav, { top: 80, bottom: 112 }), 0, 'flush with the top edge counts as visible');
  assert.equal(navRevealDelta(nav, { top: 448, bottom: 480 }), 0, 'flush with the bottom edge counts as visible');
  assert.equal(
    shouldRevealNavRow({ delta: 0, userInitiated: false, alreadyRevealed: false }),
    false,
    'nothing to correct → no scroll at all',
  );
});

test('a row below the fold is pulled up by the minimum distance — not centred, never to the top', () => {
  // Reports sits under the visible area: its bottom edge is 252px past it.
  const row = { top: 700, bottom: 732 };
  const delta = navRevealDelta(nav, row);
  assert.equal(delta, row.bottom - nav.bottom, 'moves the row fully inside, no further');
  assert.ok(delta < row.top - nav.top, 'it does NOT drag the list up to put the row at the centre');
  assert.equal(shouldRevealNavRow({ delta, userInitiated: false, alreadyRevealed: false }), true);
});

test('a row scrolled past above the fold is nudged back down, only as far as needed', () => {
  assert.equal(navRevealDelta(nav, { top: -40, bottom: -8 }), -120, 'negative = scroll up');
});

test('navigating from inside the list never moves the list', () => {
  // This is the bug users feel as "it scrolls back to the top on its own":
  // clicking a row at the bottom re-centred the whole list a moment later.
  const delta = navRevealDelta(nav, { top: 640, bottom: 672 });
  assert.notEqual(delta, 0, 'the row would otherwise need a move');
  assert.equal(shouldRevealNavRow({ delta, userInitiated: true, alreadyRevealed: false }), false);
});

test('one reveal per route and shape — a re-render cannot yank the list back', () => {
  const key = navRevealKey('desktop', 'expanded', '/reports?tab=shopLedger');
  assert.equal(key, navRevealKey('desktop', 'expanded', '/reports?tab=shopLedger'));
  assert.notEqual(key, navRevealKey('popup', 'expanded', '/reports?tab=shopLedger'), 'each list reveals for itself');
  assert.notEqual(key, navRevealKey('desktop', 'rail', '/reports?tab=shopLedger'), 'switching shape may re-reveal once');
  assert.equal(shouldRevealNavRow({ delta: 220, userInitiated: false, alreadyRevealed: true }), false);
  // Same route, in-page query churn → same key → still no second move.
  assert.equal(
    navRevealKey('desktop', 'expanded', '/operations/orders/collection'),
    navRevealKey('desktop', 'expanded', '/operations/orders/collection'),
  );
});

test('the list is a bounded scroll box in the rail, the panel and the popup', () => {
  // Normalise CRLF so the slice end-marker `"\n        }` matches on any OS.
  const source = fs.readFileSync(path.join(here, 'Sidebar.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const navTag = source.slice(source.indexOf('<nav'), source.indexOf('>', source.indexOf('<nav')) + 1);
  assert.match(navTag, /data-nav-scope/, 'one implementation, two shapes, addressable for the reveal');
  assert.match(navTag, /onClick=\{markUserNavigation\}/, 'a click on a row must suppress the reveal');
  assert.match(navTag, /onKeyDown=\{markUserKeyNavigation\}/, '…and so must Enter on the focused row');
  const navClass = source.slice(source.indexOf('The list IS the scroll area'), source.indexOf('"\n        }'));
  assert.match(navClass, /h-full/, 'fills its flex parent instead of guessing its height');
  assert.match(navClass, /min-h-0/, 'so the parent can actually shrink below the content');
  assert.match(navClass, /overflow-y-auto/);
  assert.match(navClass, /overscroll-contain/, 'the wheel stops at the list, never chains to the page');
  assert.doesNotMatch(navClass, /max-h-\[calc/, 'no hardcoded chrome-height arithmetic');
  assert.doesNotMatch(navClass, /lg:max-h-none/, 'an unbounded nav on desktop is what made it unscrollable');
  // The popup dialog must be bounded too, or h-full has nothing to fill.
  assert.match(source, /flex max-h-\[calc\(100dvh-6rem\)\] .*flex-col/, 'popup is a bounded flex column');
});
