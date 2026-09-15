// src/modules/staff/components/performance/LanguageMiniToggle.tsx
//
// ============================================================================
// EN / తెలుగు MINI LANGUAGE TOGGLE
// ============================================================================
// Compact segmented control with two modes:
//   • Controlled (language + onChange given): flips ONLY the content it is
//     attached to — used inside the performance details pop-up, where Telugu
//     must apply to the pop-up alone, never the whole project. Calls back
//     with the chosen language; does NOT touch the global store.
//   • Uncontrolled (no props): drives the global i18n context exactly like
//     the header language menu (persisted under `dmr-language`).
// ============================================================================

import { useI18n, type Language } from "../../../../i18n";
import { cn } from "../../../../utils/cn";

const OPTIONS = [
  { code: "en", label: "EN" },
  { code: "te", label: "తెలుగు" },
] as const;

interface LanguageMiniToggleProps {
  className?: string;
  /** Controlled language (pop-up scope). Omit to drive the global store. */
  language?: Language;
  /** Controlled change handler. Omit to drive the global store. */
  onChange?: (language: Language) => void;
}

export function LanguageMiniToggle({ className, language, onChange }: LanguageMiniToggleProps) {
  const { language: globalLanguage, setLanguage, t } = useI18n();
  const active = language ?? globalLanguage;
  const choose = (code: Language) => (onChange ?? setLanguage)(code);

  return (
    <div
      role="group"
      aria-label={t("staff.perf.language.toggle_aria")}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const activeOption = active === option.code;
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={activeOption}
            onClick={() => choose(option.code)}
              className={cn(
              "whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold leading-none transition-colors",
              activeOption
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageMiniToggle;
