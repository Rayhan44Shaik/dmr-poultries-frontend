// src/ui/ViewLanguageToggle.tsx
//
// GLOBAL view-popup language switch — one shared EN ⇄ తెలుగు pill for the
// Trip List view popup, the Rate Entry modal, the Driver Performance view
// style, and all three Salary Register popups (popup language only; the app
// behind is never touched).
//
// One identical pill in every view popup: emerald, showing the language a
// click switches TO (తెలుగు / ఇంగ్లీష్). The `tone` + `labelMode` props stay
// for flexibility, but Trip List view and Rate Entry both render the Trip
// style so the switch looks the same everywhere.
//
// The toggle is CONTROLLED — each popup keeps its own scoping mechanism, this
// only renders the pill: pass the popup language + a flipper (the scoped
// `toggleLanguage` from ScopedI18nProvider, or a local `localLanguage` state
// setter).

import type { ReactNode } from "react";
import { Languages } from "lucide-react";
import type { Language } from "../i18n";
import { cn } from "../utils/cn";

export type ViewLanguageToggleProps = {
  /** The popup's current language (scoped/local — never the global one). */
  language: Language;
  /** Flip the popup language. */
  onToggle: () => void;
  /** "emerald" is the one style every view popup uses. */
  tone?: "emerald" | "violet";
  /**
   * "target" shows the language a click switches TO (తెలుగు / ఇంగ్లీష్) —
   * the style every view popup uses · "current" shows the active language.
   */
  labelMode?: "target" | "current";
  ariaLabel?: string;
  title?: string;
  /** Optional tooltip node rendered inside the pill (e.g. <ActionTooltip />). */
  tooltip?: ReactNode;
  className?: string;
};

const TONE_CLASS: Record<"emerald" | "violet", string> = {
  emerald:
    "gap-2 border-emerald-100 bg-white px-3 text-xs text-emerald-700 shadow-sm shadow-emerald-100/60 hover:-translate-y-0.5 hover:bg-emerald-50 active:scale-95",
  violet:
    "gap-1.5 border-violet-200 bg-violet-50 px-3 text-[11px] text-violet-700 hover:border-violet-300 hover:bg-violet-100 btn-anim",
};

export function ViewLanguageToggle({
  language,
  onToggle,
  tone = "emerald",
  labelMode = "target",
  ariaLabel,
  title,
  tooltip,
  className,
}: ViewLanguageToggleProps) {
  const label =
    labelMode === "current"
      ? language === "te"
        ? "తెలుగు"
        : "EN"
      : language === "te"
        ? "ఇంగ్లీష్"
        : "తెలుగు";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "group inline-flex shrink-0 items-center rounded-full border py-1.5 font-bold transition-all",
        tooltip ? "relative" : "",
        TONE_CLASS[tone],
        className
      )}
    >
      <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]">
        <Languages size={tone === "violet" ? 12 : 13} />
      </span>
      {label}
      {tooltip}
    </button>
  );
}

export default ViewLanguageToggle;
