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
