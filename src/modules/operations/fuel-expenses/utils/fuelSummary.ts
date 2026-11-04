import type { FuelExpense, FuelTripLoad } from "../types/fuelExpense";

/**
 * Right-side action order for the Fuel Bill toolbar, single-sourced so the
 * layout and the tests pin the same sequence: Add Fuel Bill → Reset →
 * Refresh → PDF → Excel.
 */
export const FUEL_TOOLBAR_ORDER = ["add", "reset", "refresh", "pdf", "excel"] as const;

export interface FuelBillSummary {
  totalLitres: number;
  totalAmount: number;
  /** Deduped per-trip saved distance over the filtered set; null when no trip distance. */
  totalDistance: number | null;
  /** Total Distance ÷ Total Fuel Litres; null when litres are zero. */
  avgMileage: number | null;
  pendingCount: number;
  approvedCount: number;
}

/**
 * Canonical filtered-set totals for the Fuel Bill table footer and KPI cards.
 *
 * Distance comes only from the backend-saved trip distance (`travelDistance`)
 * — Fuel Expenses never stores its own distance — deduplicated per trip so a
 * multi-bill trip counts its distance once. Mileage is Total Distance ÷
 * Total Fuel Litres with a divide-by-zero guard (null → renders "—").
 */
export function summarizeFuelBills(rows: readonly FuelExpense[]): FuelBillSummary {
  const totalLitres = rows.reduce((sum, row) => sum + (Number(row.litres) || 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const pendingCount = rows.filter((row) => row.status === "Pending").length;
  const approvedCount = rows.filter((row) => row.status === "Approved").length;

  const tripDistanceMap = new Map<number, number>();
  for (const row of rows) {
    if (row.sourceType === "TRIP" && row.tripId != null && row.travelDistance != null) {
      if (!tripDistanceMap.has(row.tripId)) {
        tripDistanceMap.set(row.tripId, Number(row.travelDistance) || 0);
      }
    }
  }
  const totalDistance =
    tripDistanceMap.size > 0
      ? [...tripDistanceMap.values()].reduce((sum, distance) => sum + distance, 0)
      : null;
  const avgMileage =
    totalDistance != null && totalLitres > 0
      ? Number((totalDistance / totalLitres).toFixed(2))
      : null;

  return { totalLitres, totalAmount, totalDistance, avgMileage, pendingCount, approvedCount };
}

/** Loads backing the per-trip breakdown, in display order. */
export function fuelTripLoads(bill: Pick<FuelExpense, "tripLoads">): FuelTripLoad[] {
  return (bill.tripLoads ?? [])
    .filter((load) => load && load.load > 0)
    .sort((left, right) => left.load - right.load);
}

/**
 * A load-breakdown tooltip exists only for two or more loads — mirroring the
 * Trip List idiom. Single-load and unlinked/manual bills render their plain
 * trip label with no duplicate "Load 1" text and no tooltip.
 */
export function hasFuelLoadBreakdown(bill: Pick<FuelExpense, "tripLoads">): boolean {
  return fuelTripLoads(bill).length > 1;
}

/** Plain trip label for the Trip / Load cell: the linked trip or an em dash. */
export function fuelTripLabel(bill: Pick<FuelExpense, "tripNo">): string {
  const tripNo = String(bill.tripNo ?? "").trim();
  return tripNo || "—";
}
