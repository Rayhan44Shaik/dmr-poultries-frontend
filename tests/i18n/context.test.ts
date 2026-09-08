import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider, useI18n } from '../../src/i18n/index.ts';

type I18nModule = typeof import('../../src/i18n/index.tsx');

// Like a Vite HMR update, a distinct URL re-evaluates the provider/hook module
// while the existing tree can still reference the preceding generation.
const reloadI18n = (generation: string): Promise<I18nModule> =>
  import(new URL(`../../src/i18n/index.tsx?hmr=${generation}`, import.meta.url).href);

function renderLabel(Provider: ComponentType<{ children: ReactNode }>, hook: typeof useI18n) {
  function Consumer() {
    const { t } = hook();
    return createElement('span', null, t('fleet.emi.schedule_title'));
  }
  return renderToStaticMarkup(createElement(Provider, { children: createElement(Consumer) }));
}

test('a refreshed hook still reads the already-mounted provider context', async () => {
  const refreshed = await reloadI18n('consumer');
  assert.notEqual(refreshed.useI18n, useI18n, 'the module must actually be re-evaluated');
  assert.equal(renderLabel(I18nProvider, refreshed.useI18n), '<span>EMI Schedule</span>');
});

test('a refreshed provider still serves consumers from an older lazy route', async () => {
  const refreshed = await reloadI18n('provider');
  assert.notEqual(refreshed.I18nProvider, I18nProvider);
  assert.equal(renderLabel(refreshed.I18nProvider, useI18n), '<span>EMI Schedule</span>');
});

test('repeated translation updates keep one shared context', async () => {
  const first = await reloadI18n('first');
  const second = await reloadI18n('second');
  const third = await reloadI18n('third');
  assert.equal(renderLabel(first.I18nProvider, third.useI18n), '<span>EMI Schedule</span>');
  assert.equal(renderLabel(third.I18nProvider, second.useI18n), '<span>EMI Schedule</span>');
});

test('the saved Telugu language still renders through a refreshed consumer', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => key === 'dmr-language' ? 'te' : null },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  const refreshed = await reloadI18n('telugu');
  assert.equal(renderLabel(I18nProvider, refreshed.useI18n), '<span>EMI షెడ్యూల్</span>');
});

test('useI18n still rejects consumers genuinely outside the provider', () => {
  function OrphanConsumer() {
    const { t } = useI18n();
    return createElement('span', null, t('fleet.emi.schedule_title'));
  }
  assert.throws(
    () => renderToStaticMarkup(createElement(OrphanConsumer)),
    /useI18n must be used within I18nProvider/,
  );
});
