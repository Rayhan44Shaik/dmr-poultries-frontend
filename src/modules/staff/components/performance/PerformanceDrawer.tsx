// src/modules/staff/components/performance/PerformanceDrawer.tsx
//
// ============================================================================
// PERFORMANCE DETAILS POP-UP — centered modal for one driver/supervisor
// ============================================================================
// Opens from a table row (click / Enter / Space) and shows the grade story:
// summary metrics → WHY THIS GRADE → AREAS TO IMPROVE → RECOMMENDED
// IMPROVEMENT, plus the optional detail sections (vehicle breakdown, recent
// trips) loaded per person by the page.
//
// BEHAVIOUR (all inherited from the global dialog primitives)
//   • Portal to <body>, shared overlay tokens, shared focus trap: focus moves
//     in on open, Tab cycles inside, Escape and the × close, focus returns to
//     the row that opened it.
//   • Centered pop-up: ≥ sm a wide centered card (max-w-2xl, lg:max-w-4xl)
//     with a desktop two-column body; full-width sheet on phones — always
//     fits the viewport, body scrolls, the page underneath keeps its state.
//   • Person navigation: optional ‹ › arrows + "n / total" position flip
//     through the loaded ranking without closing (ArrowLeft/ArrowRight work
//     too). Buttons disable at the ends; hidden when there is nothing to
//     navigate (single-row dataset).
//   • SCOPED LANGUAGE: with `language` + `onLanguageChange` given, the header
//     shows an EN/తెలుగు toggle and the WHOLE pop-up content (child sections
//     included, via context) renders in that language — the page behind and
//     the rest of the app keep the global language. Nothing is persisted.
//   • `rankBadge` (position chip) lives in the header next to the grade.
//   • Renders nothing when closed, so opening/closing never remounts the page
//     and closing via Escape never discards underlying filter state.
//   • Purely presentational: every value and every label arrives already
//     computed/translated by the page — the pop-up makes NO API calls.
// ============================================================================

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useFocusTrap } from "../../../../hooks/useFocusTrap";
import type { Language } from "../../../../i18n";
import { cn } from "../../../../utils/cn";
import LanguageMiniToggle from "./LanguageMiniToggle";
import {
  PerformanceI18nContext,
  performanceScopeFor,
} from "./performanceI18nScope";
import {
  uiDialogCloseClass,
  uiOverlayClass,
} from "../../../../shared/ui/uiTokens";

export interface DrawerSummaryMetric {
  /** Already-translated label. */
  label: string;
  /** Pre-formatted value (already carries ₹ / km / L / % and tabular digits). */
  value: string;
}

export interface DrawerFactor {
  /** Stable key (metric name) — React key + test hook. */
  key: string;
  /** Already-translated explanation sentence (with values interpolated). */
  text: ReactNode;
  band: "strong" | "fair" | "weak" | "unavailable";
}

export interface DrawerImprovement {
  /** Stable key (metric name). */
  key: string;
  /** Already-translated area title. */
  title: string;
  /** Already-translated practical recommendation. */
  recommendation: ReactNode;
}

/** Prev/next traversal across the loaded ranking (wired by the page). */
export interface DrawerNavigation {
  /** 0-based position in the traversal order. */
  index: number;
  /** Traversal size (> 1 — the controls hide themselves otherwise). */
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** Already-translated accessible names for the two arrows. */
  prevLabel: string;
  nextLabel: string;
}

/** All visible pop-up copy, translated by the page. */
export interface DrawerLabels {
  summarySection: string;
  whySection: string;
  improveSection: string;
  improveNone: string;
  recommendSection: string;
  /** Shown when there is nothing to fix — sustain guidance, not filler. */
  recommendSustain: string;
  close: string;
}

const FACTOR_ICON: Record<DrawerFactor["band"], { glyph: string; className: string }> = {
  strong: { glyph: "▲", className: "text-emerald-600" },
  fair: { glyph: "●", className: "text-slate-400" },
  weak: { glyph: "▼", className: "text-amber-600" },
  unavailable: { glyph: "○", className: "text-slate-300" },
};

const navButtonClass = cn(
  uiDialogCloseClass,
  "border border-slate-200/80 disabled:pointer-events-none disabled:opacity-40",
);

interface PerformanceDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Driver/supervisor name. */
  title: string;
  /** Reporting period line. */
  subtitle: string;
  /** Grade badge node (translated label + tone). */
  gradeBadge: ReactNode;
  /** Rank position chip node (e.g. "Rank 2 of 12"). */
  rankBadge?: ReactNode;
  /** Pop-up-scoped language (EN/తెలుగు toggle in the header). When set —
   *  together with `onLanguageChange` — ONLY this pop-up renders in that
   *  language; the app behind keeps the global language. */
  language?: Language;
  /** Controlled change for the pop-up language toggle. */
  onLanguageChange?: (language: Language) => void;
  /** Optional ‹ › person navigation (hidden when absent). */
  navigation?: DrawerNavigation;
  /** Short explanation when the grade could not be scored comparatively. */
  unscoredNote?: ReactNode;
  summary: readonly DrawerSummaryMetric[];
  factors: readonly DrawerFactor[];
  improvements: readonly DrawerImprovement[];
  labels: DrawerLabels;
  /** Extra detail sections (vehicle breakdown / recent trips). */
  children?: ReactNode;
}

const sectionTitleClass =
  "text-[11px] font-bold uppercase tracking-widest text-slate-400";

export function PerformanceDrawer({
  open,
  onClose,
  title,
  subtitle,
  gradeBadge,
  rankBadge,
  language,
  onLanguageChange,
  navigation,
  unscoredNote,
  summary,
  factors,
  improvements,
  labels,
  children,
}: PerformanceDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    initialFocus: "first",
    onEscape: onClose,
  });

  if (!open) return null;

  const scoped = language != null && onLanguageChange != null;
  const canPrev = navigation != null && navigation.index > 0;
  const canNext = navigation != null && navigation.index < navigation.total - 1;

  // Arrow keys flip people while the pop-up is open (no modifiers, so plain
  // left/right anywhere inside the dialog — Tab/Escape stay with the trap).
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (navigation == null || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" && canPrev) {
      event.preventDefault();
      navigation.onPrev();
    } else if (event.key === "ArrowRight" && canNext) {
      event.preventDefault();
      navigation.onNext();
    }
  };

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="performance-drawer-title"
      tabIndex={-1}
      className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-overlay animate-scale-in sm:max-w-2xl lg:max-w-4xl"
    >
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2
            id="performance-drawer-title"
            className="truncate text-[15px] font-bold leading-snug tracking-tight text-slate-900"
          >
            {title}
          </h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
            {subtitle}
          </p>
          {(gradeBadge || rankBadge) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {gradeBadge}
              {rankBadge}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {scoped && (
            <LanguageMiniToggle language={language} onChange={onLanguageChange} />
          )}
          {navigation && navigation.total > 1 && (
            <>
              <button
                type="button"
                onClick={navigation.onPrev}
                disabled={!canPrev}
                className={navButtonClass}
                aria-label={navigation.prevLabel}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <span
                aria-hidden="true"
                className="min-w-[3.25rem] text-center text-[11px] font-bold tabular-nums text-slate-400"
              >
                {navigation.index + 1} / {navigation.total}
              </span>
              <button
                type="button"
                onClick={navigation.onNext}
                disabled={!canNext}
                className={navButtonClass}
                aria-label={navigation.nextLabel}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className={uiDialogCloseClass}
            aria-label={labels.close}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Scrollable body — two columns on desktop, stacked on phones */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        {unscoredNote && (
          <p className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-500">
            {unscoredNote}
          </p>
        )}

        {/* Performance summary */}
        <section aria-label={labels.summarySection}>
          <h3 className={sectionTitleClass}>{labels.summarySection}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {summary.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-2"
              >
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {metric.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-bold tabular-nums text-slate-900">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Grade story: why (left) + areas/recommendations (right) on desktop */}
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-6 lg:items-start">
          {/* Why this grade */}
          <section aria-label={labels.whySection}>
            <h3 className={sectionTitleClass}>{labels.whySection}</h3>
            <ul className="mt-2 space-y-2">
              {factors.map((factor) => {
                const icon = FACTOR_ICON[factor.band];
                return (
                  <li
                    key={factor.key}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600"
                  >
                    <span className={`mt-0.5 shrink-0 text-[9px] ${icon.className}`} aria-hidden="true">
                      {icon.glyph}
                    </span>
                    <span>{factor.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="space-y-5">
            {/* Areas to improve — only metrics the data actually flags */}
            <section aria-label={labels.improveSection}>
              <h3 className={sectionTitleClass}>{labels.improveSection}</h3>
              {improvements.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                  {labels.improveNone}
                </p>
              ) : (
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {improvements.map((improvement) => (
                    <li key={improvement.key} className="text-xs font-medium text-slate-700">
                      {improvement.title}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recommended improvement — practical next steps for weak metrics */}
            <section aria-label={labels.recommendSection}>
              <h3 className={sectionTitleClass}>{labels.recommendSection}</h3>
              {improvements.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                  {labels.recommendSustain}
                </p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {improvements.map((improvement) => (
                    <li
                      key={improvement.key}
                      className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5"
                    >
                      <p className="text-xs font-bold text-slate-800">{improvement.title}</p>
                      <p className="mt-1 text-xs font-medium text-amber-800">{improvement.recommendation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* Optional detail sections (already loaded data only) */}
        {children}
      </div>
    </div>
  );

  const drawer = (
    <div
      className={`${uiOverlayClass} z-[70] flex items-center justify-center p-3 sm:p-6`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      {scoped ? (
        <PerformanceI18nContext.Provider value={performanceScopeFor(language)}>
          {panel}
        </PerformanceI18nContext.Provider>
      ) : (
        panel
      )}
    </div>
  );

  if (typeof document === "undefined") return drawer;
  return createPortal(drawer, document.body);
}

export default PerformanceDrawer;
