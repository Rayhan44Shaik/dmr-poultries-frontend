import type { Language } from './context';

import enCommon from './en';
import teCommon from './te';
import enLayout from './modules/layout.en';
import teLayout from './modules/layout.te';
import enDashboard from './modules/dashboard.en';
import teDashboard from './modules/dashboard.te';
import enOperations from './modules/operations.en';
import teOperations from './modules/operations.te';
import enAccounts from './modules/accounts.en';
import teAccounts from './modules/accounts.te';
import enFleet from './modules/fleet.en';
import teFleet from './modules/fleet.te';
import enMasters from './modules/masters.en';
import teMasters from './modules/masters.te';
import enStaff from './modules/staff.en';
import teStaff from './modules/staff.te';
import enReports from './modules/reports.en';
import teReports from './modules/reports.te';
import enSettings from './modules/settings.en';
import teSettings from './modules/settings.te';
import enAuth from './modules/auth.en';
import teAuth from './modules/auth.te';
import enSupervisorMobile from './modules/supervisor-mobile.en';
import teSupervisorMobile from './modules/supervisor-mobile.te';
import enShared from './modules/shared.en';
import teShared from './modules/shared.te';

export const STORAGE_KEY = 'dmr-language';

export const dictionaries: Record<Language, Record<string, string>> = {
  en: {
    ...enCommon,
    ...enLayout,
    ...enDashboard,
    ...enOperations,
    ...enAccounts,
    ...enFleet,
    ...enMasters,
    ...enStaff,
    ...enReports,
    ...enSettings,
    ...enAuth,
    ...enSupervisorMobile,
    ...enShared,
  },
  te: {
    ...teCommon,
    ...teLayout,
    ...teDashboard,
    ...teOperations,
    ...teAccounts,
    ...teFleet,
    ...teMasters,
    ...teStaff,
    ...teReports,
    ...teSettings,
    ...teAuth,
    ...teSupervisorMobile,
    ...teShared,
  },
};

let activeLanguage: Language = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'te' ? 'te' : 'en';
  } catch {
    return 'en';
  }
})();

let activeDict: Record<string, string> = dictionaries[activeLanguage];

const interpolate = (
  text: string,
  params?: Record<string, string | number>
): string => {
  if (!params) return text;
  let out = text;
  Object.entries(params).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  });
  return out;
};

/** Keep non-React helpers in sync when the provider changes language. */
export function syncActiveLanguage(lang: Language): void {
  activeLanguage = lang;
  activeDict = dictionaries[lang];
}

/** Build a standalone translator for an EXPLICIT language — reads the same
 *  dictionaries but never touches global state or persistence. */
export const makeT = (language: Language) => {
  const dict = dictionaries[language] ?? dictionaries.en;
  return (key: string, params?: Record<string, string | number>): string =>
    interpolate(dict[key] ?? dictionaries.en[key] ?? key, params);
};

/** Translate outside React components (services, utils, PDF generation). */
export const translate = (
  key: string,
  params?: Record<string, string | number>
): string =>
  interpolate(activeDict[key] ?? dictionaries.en[key] ?? key, params);

/** Current active language, readable outside React. */
export const getLanguage = (): Language => activeLanguage;

/**
 * Platform roles arrive as `OWNER`, `Accountant`, `supervisor`, … — normalise
 * them to `role.<lowercase>` and fall back to the raw value when there is no
 * copy for that role yet (same contract as `translateStatus`).
 */
export const translateRole = (
  t: (key: string) => string,
  value: string
): string => {
  if (!value) return value;
  const key = `role.${value.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? value : translated;
};

export const translateStatus = (
  t: (key: string) => string,
  value: string
): string => {
  if (!value) return value;
  const key = `status.${value.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? value : translated;
};
