// src/modules/staff/components/performance/LanguageMiniToggle.tsx
//
// ============================================================================
// EN / తెలుగు MINI LANGUAGE TOGGLE
// ============================================================================
// Compact segmented control for checking a page in Telugu or English with one
// click. Drives the SAME global i18n context as the header language menu
// (preference persisted under `dmr-language`), so it never creates a second
// source of truth — it just puts the switch where the content is.
//
// Used at the top of the Driver/Supervisor Performance pages (filter bar
// actions slot) and inside the details pop-up header.
// ============================================================================

import { useI18n } from "../../../../i18n";
import { cn } from "../../../../utils/cn";

const OPTIONS = [
  { code: "en", label: "EN" },
  { code: "te", label: "తెలుగు" },
] as const;

export function LanguageMiniToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

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
        const active = language === option.code;
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={active}
            onClick={() => setLanguage(option.code)}
            title={option.code === "en" ? "English" : "తెలుగు"}
            className={cn(
              "whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold leading-none transition-colors",
              active
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
