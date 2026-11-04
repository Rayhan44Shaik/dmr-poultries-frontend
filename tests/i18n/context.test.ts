import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider, useI18n } from '../../src/i18n/index.ts';

type I18nProviderModule = typeof import('../../src/i18n/I18nProvider.tsx');
type I18nHookModule = typeof import('../../src/i18n/useI18n.ts');

// Like a Vite HMR update, a distinct URL re-evaluates a module while the
// existing tree can still reference the preceding generation. Provider and
// hook reload independently; they stay connected through `./context`, which is
// deliberately never re-evaluated here.
const reloadI18nProvider = (generation: string): Promise<I18nProviderModule> =>
  import(new URL(`../../src/i18n/I18nProvider.tsx?hmr=${generation}`, import.meta.url).href);
const reloadI18nHook = (generation: string): Promise<I18nHookModule> =>
  import(new URL(`../../src/i18n/useI18n.ts?hmr=${generation}`, import.meta.url).href);

function renderLabel(Provider: ComponentType<{ children: ReactNode }>, hook: typeof useI18n) {
  function Consumer() {
    const { t } = hook();
    return createElement('span', null, t('fleet.emi.schedule_title'));
  }
  return renderToStaticMarkup(createElement(Provider, { children: createElement(Consumer) }));
}

test('a refreshed hook still reads the already-mounted provider context', async () => {
  const refreshedHook = await reloadI18nHook('consumer');
  assert.notEqual(refreshedHook.useI18n, useI18n, 'the module must actually be re-evaluated');
  assert.equal(renderLabel(I18nProvider, refreshedHook.useI18n), '<span>EMI Schedule</span>');
});

test('a refreshed provider still serves consumers from an older lazy route', async () => {
  const refreshedProvider = await reloadI18nProvider('provider');
  assert.notEqual(refreshedProvider.I18nProvider, I18nProvider);
  assert.equal(renderLabel(refreshedProvider.I18nProvider, useI18n), '<span>EMI Schedule</span>');
});

test('repeated translation updates keep one shared context', async () => {
  const secondHook = await reloadI18nHook('second');
  const thirdHook = await reloadI18nHook('third');
  const firstProvider = await reloadI18nProvider('first');
  const thirdProvider = await reloadI18nProvider('third');
  assert.equal(renderLabel(firstProvider.I18nProvider, thirdHook.useI18n), '<span>EMI Schedule</span>');
  assert.equal(renderLabel(thirdProvider.I18nProvider, secondHook.useI18n), '<span>EMI Schedule</span>');
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
  const refreshedHook = await reloadI18nHook('telugu');
  assert.equal(renderLabel(I18nProvider, refreshedHook.useI18n), '<span>EMI షెడ్యూల్</span>');
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
