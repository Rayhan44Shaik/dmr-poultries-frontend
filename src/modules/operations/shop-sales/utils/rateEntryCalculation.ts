export interface RateEntryAmountRow {
  weight?: number | null;
  rate?: number | null;
}

/** Matches the backend persistence rule for trip_deliveries.amount. */
export function rateEntryRowAmount(row: RateEntryAmountRow): number {
  const weight = Number(row.weight || 0);
  const rate = Number(row.rate || 0);
  if (!Number.isFinite(weight) || !Number.isFinite(rate)) return 0;
  return Number((weight * rate).toFixed(2));
}

/**
 * Sum saved paise-precision row amounts before converting the final total to
 * whole rupees for display. Rounding every shop to rupees before summing can
 * drift by one or more rupees across a trip.
 */
export function rateEntryTotalAmount(rows: RateEntryAmountRow[]): number {
  return Number(rows.reduce((sum, row) => sum + rateEntryRowAmount(row), 0).toFixed(2));
}
