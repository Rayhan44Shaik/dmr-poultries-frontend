import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Egg, TrendingDown } from 'lucide-react';
import en from '../i18n/en.ts';
import te from '../i18n/te.ts';
import { FLAT_NAV, resolveRoute } from './navigation.ts';

const birdTypesPath = '/masters?tab=birdTypes';
const mortalityPath = '/operations?tab=mortality';
const lossLabel = 'Weight Loss / Mortality';

describe('Bird Types and Weight Loss / Mortality navigation', () => {
  it('uses the new loss label consistently in navigation, translations, and browser titles', () => {
    const mortality = resolveRoute(mortalityPath).page;
    assert.ok(mortality);
    assert.equal(mortality.label, lossLabel);
    assert.equal(mortality.titleKey, 'page_title.mortality');

    for (const [dictionary, label] of [[en, lossLabel], [te, 'బరువు నష్టం / మరణాలు']] as const) {
      assert.equal(dictionary['nav.mortalityEntry'], label);
      assert.equal(dictionary['operations.mortality_entry'], label);
      assert.equal(dictionary['operations.mortality'], label);
      assert.equal(dictionary['page_title.mortality'], `DMR Poultries - ${label}`);
    }
  });

  it('uses distinct egg and downward-trend icons with different accent colors', () => {
    const birdTypes = resolveRoute(birdTypesPath).page;
    const mortality = resolveRoute(mortalityPath).page;
    assert.ok(birdTypes);
    assert.ok(mortality);

    assert.equal(birdTypes.labelKey, 'nav.birdTypes');
    assert.equal(birdTypes.icon, Egg);
    assert.equal(birdTypes.tone, 'sky');
    assert.equal(mortality.labelKey, 'nav.mortalityEntry');
    assert.equal(mortality.icon, TrendingDown);
    assert.equal(mortality.tone, 'orange');
    assert.notEqual(birdTypes.icon, mortality.icon);
  });

  it('carries the updated name and icons into search without changing destinations', () => {
    const birdTypes = FLAT_NAV.find((entry) => entry.labelKey === 'nav.birdTypes');
    const mortality = FLAT_NAV.find((entry) => entry.labelKey === 'nav.mortalityEntry');
    assert.ok(birdTypes);
    assert.ok(mortality);

    assert.equal(birdTypes.icon, Egg);
    assert.equal(birdTypes.path, birdTypesPath);
    assert.equal(mortality.label, lossLabel);
    assert.equal(mortality.icon, TrendingDown);
    assert.equal(mortality.path, mortalityPath);
    assert.match(mortality.keywords ?? '', /weight loss/i);
  });
});
