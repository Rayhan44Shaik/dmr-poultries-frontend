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

import { useRef, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Languages, X } from "lucide-react";
import AppShellModal from "../../../../ui/AppShellModal";
import { useFocusTrap } from "../../../../hooks/useFocusTrap";
import { useI18n, type Language } from "../../../../i18n";
import {
  CARD_VIEW_HEADER_TONE,
  CARD_VIEW_LANGUAGE_TONE,
  CARD_VIEW_TILE_TONE,
  type PerformanceCardTone,
} from "./performanceCardTone";
import {
  PerformanceI18nContext,
  performanceScopeFor,
} from "./performanceI18nScope";

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

/** Round icon control — the same shape the Trip List view uses. */
const roundControlClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0";

const closeControlClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95";

interface PerformanceDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The page's glyph (Truck for drivers, UserCheck for supervisors). */
  icon: ComponentType<{ className?: string }>;
  /** The page's tone, matching its sidebar entry and card headers. */
  tone: PerformanceCardTone;
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
  icon: Icon,
  tone,
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
  const { t } = useI18n();
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

  // The pop-up's own language switch shows the language it would switch TO,
  // exactly like the Trip List view's toggle.
  const languageLabel = language === "te" ? "ఇంగ్లీష్" : t("settings.telugu");

  const panel = (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-white"
    >
      {/* Header — the Trip List view's band: 48px tile, title + badges, and the
          pop-up controls (scoped language switch, ‹ › people, close). */}
      <div
        className={`shrink-0 rounded-t-2xl border-b border-slate-100 bg-gradient-to-r ${CARD_VIEW_HEADER_TONE[tone]}`}
      >
        <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${CARD_VIEW_TILE_TONE[tone]}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2
                id="performance-drawer-title"
                className="truncate text-lg font-bold tracking-tight text-slate-800 md:text-xl"
              >
                {title}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {gradeBadge}
                {rankBadge}
                <span className="text-xs font-medium text-slate-400">{subtitle}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            {scoped && (
              <button
                type="button"
                onClick={() => onLanguageChange?.(language === "te" ? "en" : "te")}
                aria-label={t("staff.perf.language.toggle_aria")}
                className={`inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-bold shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 ${CARD_VIEW_LANGUAGE_TONE[tone]}`}
              >
                <Languages size={13} aria-hidden="true" />
                {languageLabel}
              </button>
            )}
            {navigation && navigation.total > 1 && (
              <>
                <button
                  type="button"
                  onClick={navigation.onPrev}
                  disabled={!canPrev}
                  className={roundControlClass}
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
                  className={roundControlClass}
                  aria-label={navigation.nextLabel}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className={closeControlClass}
              aria-label={labels.close}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body — two columns on desktop, stacked on phones */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5 md:px-8">
        {unscoredNote && (
          <p className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-500">
            {unscoredNote}
          </p>
        )}

        {/* Performance summary */}
        <section aria-label={labels.summarySection}>
          <h3 className={sectionTitleClass}>{labels.summarySection}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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

      {/* Footer — the Trip List view's soft band with a single Close action */}
      <div className="flex shrink-0 items-center justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-5 md:px-8">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 active:scale-95"
        >
          <X size={15} aria-hidden="true" />
          {labels.close}
        </button>
      </div>
    </div>
  );

  return (
    <AppShellModal
      open={open}
      onClose={onClose}
      panelClassName="bg-white"
      ariaLabelledBy="performance-drawer-title"
    >
      <div onKeyDown={handleKeyDown} className="h-full w-full">
        {scoped ? (
          <PerformanceI18nContext.Provider value={performanceScopeFor(language)}>
            {panel}
          </PerformanceI18nContext.Provider>
        ) : (
          panel
        )}
      </div>
    </AppShellModal>
  );
}

export default PerformanceDrawer;
