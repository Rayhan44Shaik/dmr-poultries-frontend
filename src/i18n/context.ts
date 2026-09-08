import { createContext } from 'react';

export type Language = 'en' | 'te';

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Keep the context independent of the provider and translation dictionaries.
// Those modules are re-evaluated by Fast Refresh; recreating the context there
// disconnects mounted/lazy consumers from their existing provider.
export const I18nContext = createContext<I18nContextType | undefined>(undefined);
