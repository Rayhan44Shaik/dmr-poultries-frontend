// src/modules/staff/components/performance/performanceCardTone.ts
//
// ============================================================================
// PERFORMANCE CARD TONES — the colours of a perf card's logo and header band
// ============================================================================
// Every page carries its own tone, the same one its sidebar entry uses:
// drivers = orange (Truck), supervisors = sky (UserCheck). The strings are
// written out in full because Tailwind only generates classes it can see.
// ============================================================================

export type PerformanceCardTone = "orange" | "sky";

/** The 36px logo chip — copied from the Trip List / Rate Entry card headers. */
export const CARD_MARK_TONE: Record<PerformanceCardTone, string> = {
  orange: "border-orange-100 bg-orange-50 text-orange-500",
  sky: "border-sky-100 bg-sky-50 text-sky-500",
};

/** The soft header band those same cards wear (tone-50 → white → tone-50). */
export const CARD_HEADER_TONE: Record<PerformanceCardTone, string> = {
  orange: "border-slate-100 bg-gradient-to-r from-orange-50/60 via-white to-orange-50/40",
  sky: "border-slate-100 bg-gradient-to-r from-sky-50/60 via-white to-sky-50/40",
};

/* ---------------------------------------------------------------------------
 * The row-click VIEW pop-up (same shell as the Trip List view)
 * ------------------------------------------------------------------------- */

/** Header band of the view pop-up — the Trip List view's gradient recipe. */
export const CARD_VIEW_HEADER_TONE: Record<PerformanceCardTone, string> = {
  orange: "from-orange-50/80 via-white to-orange-50/80",
  sky: "from-sky-50/80 via-white to-sky-50/80",
};

/** The 48px tile that holds the page glyph (Trip List view uses emerald). */
export const CARD_VIEW_TILE_TONE: Record<PerformanceCardTone, string> = {
  orange: "from-orange-400 to-amber-400 shadow-orange-400/20",
  sky: "from-sky-400 to-cyan-400 shadow-sky-400/20",
};

/** The pop-up's own language switch (Trip List view's pill, page tone). */
export const CARD_VIEW_LANGUAGE_TONE: Record<PerformanceCardTone, string> = {
  orange: "border-orange-100 text-orange-700 shadow-orange-100/60 hover:bg-orange-50",
  sky: "border-sky-100 text-sky-700 shadow-sky-100/60 hover:bg-sky-50",
};
