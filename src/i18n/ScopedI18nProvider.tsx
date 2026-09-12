import { useMemo, useState, type ReactNode } from "react";
import { I18nContext, type Language } from "./context";
import { makeT } from "./index.tsx";

type ScopedI18nProviderProps = {
  children: ReactNode;
  initialLanguage: Language;
};

/**
 * Local language scope for isolated pop-ups/views.
 * It intentionally does NOT write localStorage and does NOT update
 * document.documentElement.lang, so toggling this scope never changes the
 * outside project language.
 */
export function ScopedI18nProvider({ children, initialLanguage }: ScopedI18nProviderProps) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = useMemo(() => makeT(language), [language]);
  const toggleLanguage = () => setLanguage((current) => (current === "en" ? "te" : "en"));

  return (
    <I18nContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export default ScopedI18nProvider;
