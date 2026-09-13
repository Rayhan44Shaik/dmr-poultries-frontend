import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analysisLinkKey, buildAnalysisPath, readAnalysisLink } from './analysisLink';

const WEEK = { from: '2026-09-07', to: '2026-09-13' };

test('every KPI tile builds the same Analysis link, comparison on by default', () => {
  assert.equal(
    buildAnalysisPath(WEEK),
    '/accounts?tab=summary&from=2026-09-07&to=2026-09-13&compare=1'
  );
  assert.equal(
    buildAnalysisPath(WEEK, false),
    '/accounts?tab=summary&from=2026-09-07&to=2026-09-13&compare=0'
  );
});

test('a link reads back as the window that built it', () => {
  const link = readAnalysisLink('?tab=summary&from=2026-09-07&to=2026-09-13&compare=1');
  assert.deepEqual(link, { from: '2026-09-07', to: '2026-09-13', compare: true });
  assert.deepEqual(readAnalysisLink(new URL(buildAnalysisPath(WEEK)!, 'http://localhost').search), {
    from: '2026-09-07',
    to: '2026-09-13',
    compare: true,
  });
});

test('compare is off only when the link says so', () => {
  assert.equal(readAnalysisLink('?from=2026-09-07&to=2026-09-13&compare=0')?.compare, false);
  assert.equal(readAnalysisLink('?from=2026-09-07&to=2026-09-13&compare=false')?.compare, false);
  // No compare param at all still means "compare", which is why the tile is clicked.
  assert.equal(readAnalysisLink('?from=2026-09-07&to=2026-09-13')?.compare, true);
});

test('anything that is not a usable window is refused, not guessed at', () => {
  assert.equal(buildAnalysisPath({ from: '', to: '2026-09-13' }), null);
  assert.equal(buildAnalysisPath({ from: '2026-9-7', to: '2026-09-13' }), null);
  assert.equal(buildAnalysisPath({ from: '2026-09-13', to: '2026-09-07' }), null);
  assert.equal(readAnalysisLink('?tab=summary'), null);
  assert.equal(readAnalysisLink('?tab=summary&from=2026-09-07&to=nope'), null);
  assert.equal(readAnalysisLink(''), null);
});

test('the key changes when the window or the comparison changes, and only then', () => {
  const base = readAnalysisLink('?from=2026-09-07&to=2026-09-13&compare=1');
  assert.equal(analysisLinkKey(base), analysisLinkKey(readAnalysisLink('?from=2026-09-07&to=2026-09-13&compare=1')));
  assert.notEqual(analysisLinkKey(base), analysisLinkKey(readAnalysisLink('?from=2026-08-31&to=2026-09-06&compare=1')));
  assert.notEqual(analysisLinkKey(base), analysisLinkKey(readAnalysisLink('?from=2026-09-07&to=2026-09-13&compare=0')));
  assert.equal(analysisLinkKey(null), '');
});
