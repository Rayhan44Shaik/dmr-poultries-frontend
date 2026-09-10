// src/modules/staff/components/performance/performanceI18nScope.ts
//
// ============================================================================
// PERFORMANCE POP-UP LANGUAGE SCOPE
// ============================================================================
// The details pop-up carries its own EN/తెలుగు toggle. It must translate ONLY
// the pop-up — the page behind it and the rest of the app keep the global
// language. This module holds the (optional) scope: when the pop-up provides
// one, `usePerformanceI18n()` returns the scoped translator/language; outside
// the pop-up it transparently falls back to the global i18n context.
//
// No global state and no persistence are touched — `makeT` reads the shared
// dictionaries without mutating the active language, so nothing leaks.
// ============================================================================

import { createContext, useContext } from "react";
import { makeT, useI18n, type Language } from "../../../../i18n";

export type ScopedT = (key: string, params?: Record<string, string | number>) => string;

export interface PerformanceI18nScopeValue {
  t: ScopedT;
  language: Language;
}

export const PerformanceI18nContext = createContext<PerformanceI18nScopeValue | null>(null);

/** t/language for pop-up content: the pop-up's scope when set, the global app
 *  language otherwise. Always safe to call anywhere under the provider tree. */
export function usePerformanceI18n(): PerformanceI18nScopeValue {
  const scope = useContext(PerformanceI18nContext);
  const global = useI18n();
  return scope ?? { t: global.t, language: global.language };
}

/** Convenience: the scoped value for an explicit language (provider input). */
export function performanceScopeFor(language: Language): PerformanceI18nScopeValue {
  return { t: makeT(language), language };
}
