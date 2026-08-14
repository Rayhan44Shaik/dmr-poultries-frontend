import { useCallback, useState, type ReactNode } from "react";
import { LanguageContext } from "./languageContext";
import { translations, type Locale, type TranslationCatalog } from "../i18n/translations";

const STORAGE_KEY = "dmr_language";

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "te") return stored;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

function getByPath(catalog: TranslationCatalog, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = catalog;
  for (const part of parts) {
    if (node === null || typeof node !== "object") return undefined;
    const next = (node as Record<string, unknown>)[part];
    if (next === undefined) return undefined;
    node = next;
  }
  return typeof node === "string" ? node : undefined;
}

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      return (
        getByPath(translations[locale], key) ??
        getByPath(translations.en, key) ??
        key
      );
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};
