import { createContext, useContext } from "react";
import type { Locale } from "../i18n/translations";

export interface LanguageContextType {
  locale: Locale;
  /** Translation helper. Resolves "a.b.c" against the active catalog,
   * falling back to the English catalog, then to the raw key. */
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
