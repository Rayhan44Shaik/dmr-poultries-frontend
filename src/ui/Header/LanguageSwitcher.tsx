// src/ui/Header/LanguageSwitcher.tsx
// Compact language selector (English / తెలుగు) matching the header design.
// Preference is persisted by the i18n provider under `dmr-language`.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useI18n, type Language } from "../../i18n";

const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "te", label: "తెలుగు", short: "తెలుగు" },
];

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code: Language) => {
    setLanguage(code);
    setOpen(false);
  };

  const shortLabel = active.code === "en" ? "EN" : "తెలుగు";
  const chevronClass = `text-slate-400 transition-transform ${open ? "rotate-180" : ""}`;
  const getLangButtonClass = (langCode: Language) =>
    `flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
      langCode === language
        ? "text-brand-700 dark:text-brand-300"
        : "text-slate-600 dark:text-slate-300"
    }`;
  const buttonClass = `flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors ${
    open
      ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('header.changeLanguage')}
        title={active.label}
        className={buttonClass}
      >
        <Globe size={15} className="shrink-0" />
        <span className="whitespace-nowrap">{shortLabel}</span>
        <ChevronDown
          size={13}
          className={chevronClass}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-pop animate-scale-in dark:border-slate-700 dark:bg-slate-800">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => choose(lang.code)}
              className={getLangButtonClass(lang.code)}
            >
              <span className="flex-1">{lang.short}</span>
              {lang.code === language && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}