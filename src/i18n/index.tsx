import {
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nContext, type Language } from './context';

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

export type { Language } from './context';

interface I18nProviderProps {
  children: ReactNode;
}

export const STORAGE_KEY = 'dmr-language';

const dictionaries: Record<Language, Record<string, string>> = {
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

export const I18nProvider = ({ children }: I18nProviderProps) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'te' || stored === 'en' ? stored : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    activeLanguage = lang;
    activeDict = dictionaries[lang];
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable — language stays for this session */
    }
    document.documentElement.lang = lang === 'te' ? 'te' : 'en';
  };

  const toggleLanguage = () => setLanguage(language === 'en' ? 'te' : 'en');

  /**
   * Keep `<html lang>` in step with the active language — including the case
   * where Telugu comes from `localStorage` rather than the switcher. The
   * attribute decides which font the browser picks for Telugu script, so it has
   * to be right on the first paint, not only after someone flips the toggle.
   */
  useEffect(() => {
    document.documentElement.lang = language === 'te' ? 'te' : 'en';
  }, [language]);

  const t = useMemo(
    () =>
      (key: string, params?: Record<string, string | number>): string => {
        let translation =
          dictionaries[language][key] ?? dictionaries.en[key] ?? key;

        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            translation = translation.replace(
              new RegExp(`\\{${k}\\}`, 'g'),
              String(v)
            );
          });
        }

        return translation;
      },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
};

/* ------------------------------------------------------------------ */
/* Non-hook helpers for utility modules (formatting, services, PDFs)   */
/* ------------------------------------------------------------------ */

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

/** Build a standalone translator for an EXPLICIT language — reads the same
 *  dictionaries but never touches global state or persistence. Used for
 *  language-SCOPED UI (e.g. the performance pop-up toggle, which must
 *  translate only the pop-up, not the whole project). */
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
 * Translate a status value coming from the backend/database.
 * Only the display string changes — the underlying value is untouched.
 */
export const translateStatus = (
  t: (key: string) => string,
  value: string
): string => {
  if (!value) return value;
  const key = `status.${value.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? value : translated;
};