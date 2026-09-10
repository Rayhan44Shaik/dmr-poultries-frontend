// src/modules/staff/components/performance/PerformanceDrawer.tsx
//
// ============================================================================
// PERFORMANCE DETAILS DRAWER — side panel for one driver/supervisor
// ============================================================================
// Opens from a table row (click / Enter / Space) and shows the grade story:
// summary metrics → WHY THIS GRADE → AREAS TO IMPROVE → RECOMMENDED
// IMPROVEMENT, plus the optional detail sections (vehicle breakdown, recent
// trips) only when the applied selection actually returned them.
//
// BEHAVIOUR (all inherited from the global dialog primitives)
//   • Portal to <body>, shared overlay tokens, shared focus trap: focus moves
//     in on open, Tab cycles inside, Escape and the × close, focus returns to
//     the row that opened it.
//   • Right-side panel ≥ sm; full-width bottom sheet on phones — always fits
//     the viewport, body scrolls, the page underneath keeps its state.
//   • Renders nothing when closed, so opening/closing never remounts the page
//     and closing via Escape never discards underlying filter state.
//   • Purely presentational: every value and every label arrives already
//     computed/translated from the page — the drawer makes NO API calls and
//     contains no hardcoded copy (full i18n).
// ============================================================================

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "../../../../hooks/useFocusTrap";
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

/** All visible drawer copy, translated by the page. */
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

interface PerformanceDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Driver/supervisor name. */
  title: string;
  /** Reporting period line. */
  subtitle: string;
  /** Grade badge node (translated label + tone). */
  gradeBadge: ReactNode;
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

  // Escape/Tab/focus are handled by the shared trap. Focus restoration on
  // close is also owned by the trap (returns to the row that opened us).

  if (!open) return null;

  const drawer = (
    <div
      className={`${uiOverlayClass} z-[70] flex justify-end`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="performance-drawer-title"
        tabIndex={-1}
        className="relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-slate-200/70 bg-white shadow-overlay animate-fade-in inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-full sm:w-full sm:max-w-md sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0"
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
            <div className="mt-2">{gradeBadge}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={uiDialogCloseClass}
            aria-label={labels.close}
            title={labels.close}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {unscoredNote && (
            <p className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-500">
              {unscoredNote}
            </p>
          )}

          {/* Performance summary */}
          <section aria-label={labels.summarySection}>
            <h3 className={sectionTitleClass}>{labels.summarySection}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {summary.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-2"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {metric.label}
                  </dt>
                  <dd className="mt-0.5 truncate text-sm font-bold tabular-nums text-slate-900" title={metric.value}>
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

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

          {/* Optional detail sections (already loaded data only) */}
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return drawer;
  return createPortal(drawer, document.body);
}

export default PerformanceDrawer;
