// src/modules/operations/orders/components/ordersUiConstants.ts
// Non-component constants shared by the Orders tables. They live in their own
// module so OrdersCommon.tsx exports components only (Fast Refresh rule).

/** Rows-per-page choices offered by every Orders table. */
export const ORDERS_PAGE_SIZES = [10, 15, 20, 25, 30] as const;

/** Default page size for every Orders list (requirement: 10 rows per page). */
export const ORDERS_DEFAULT_PAGE_SIZE = 10;

// ─── Shared tones for the Assignment tiles and the vehicle table ───────────

export type Tone = "sky" | "emerald" | "amber" | "rose";

/** Icon chip: border + tint + glyph colour. */
export const TONE_ICON: Record<Tone, string> = {
  sky: "border-sky-100 bg-sky-50 text-sky-600",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-600",
  amber: "border-amber-100 bg-amber-50 text-amber-600",
  rose: "border-rose-100 bg-rose-50 text-rose-600",
};

/** Headline figure colour. */
export const TONE_VALUE: Record<Tone, string> = {
  sky: "text-sky-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
};

/** Meter fill colour. */
export const TONE_BAR: Record<Tone, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

/** Deterministic 0-100 fill; a zero denominator is an EMPTY bar, never NaN. */
export function fillPercent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}
