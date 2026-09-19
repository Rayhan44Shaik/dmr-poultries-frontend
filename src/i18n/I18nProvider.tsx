import {
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nContext, type Language } from './context';
import {
  STORAGE_KEY,
  dictionaries,
  syncActiveLanguage,
} from './translate';

export type { Language } from './context';

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider = ({ children }: I18nProviderProps) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const initial = stored === 'te' || stored === 'en' ? stored : 'en';
      syncActiveLanguage(initial);
      return initial;
    } catch {
      syncActiveLanguage('en');
      return 'en';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    syncActiveLanguage(lang);
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
