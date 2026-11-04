import type { ShopLedgerCumulativeRow } from "../components/ShopLedgerPDF";

/**
 * Which cumulative quantity a tooltip cell explains. Delivered birds, delivered
 * weight and weight loss come from the per-load delivery breakdown; mortality
 * birds/weight come from the per-load mortality breakdown (box vs weight mode).
 * Financial columns (opening/sale/collection/closing) never get a breakdown.
 */
export type CumulativeQuantityMetric =
  | "birds"
  | "mortalityBirds"
  | "weight"
  | "mortalityWeight"
  | "weightLoss";

export interface CumulativeLoadLine {
  load: number;
  /** Raw per-load actual (birds count or kg — the caller formats it). */
  value: number;
  /** Secondary context line, e.g. the box/weight-mode split for mortality. */
  sub?: string;
}

const loadNo = (load: number): number =>
  Number.isFinite(load) && load > 0 ? Math.floor(load) : 1;

/** Per-load lines for delivered birds / delivered weight / weight loss. */
function deliveryLines(
  row: ShopLedgerCumulativeRow,
  pick: (load: NonNullable<ShopLedgerCumulativeRow["deliveriesByLoad"]>[number]) => number,
): CumulativeLoadLine[] {
  return (row.deliveriesByLoad ?? []).map((load) => ({
    load: loadNo(load.load),
    value: pick(load),
  }));
}

/**
 * Ordered per-load lines for one metric. Sums of these lines always equal the
 * shop's cumulative total because the backend groups the same normalized
 * delivery rows — nothing is invented, split or double-counted here.
 */
export function cumulativeLoadLines(
  row: ShopLedgerCumulativeRow,
  metric: CumulativeQuantityMetric,
): CumulativeLoadLine[] {
  switch (metric) {
    case "birds":
      return deliveryLines(row, (load) => load.birds);
    case "weight":
      return deliveryLines(row, (load) => load.weight);
    case "weightLoss":
      return deliveryLines(row, (load) => load.weightLoss);
    case "mortalityBirds":
      // Each line names how many box birds and how much box weight (kg) that
      // load contributed, plus any weight-mode birds — zero parts are left
      // out so a pure box load never reads "Wt-mode 0".
      return (row.mortalityByLoad ?? []).map((load) => {
        const box = Math.round(load.boxBirds ?? 0);
        const boxKg = Number(load.boxWeight ?? 0);
        const weightMode = Math.round(load.weightModeBirds ?? 0);
        const parts: string[] = [];
        if (box > 0) parts.push(`Box ${box} birds · ${boxKg.toFixed(2)} kg`);
        if (weightMode > 0) parts.push(`Wt-mode ${weightMode} birds`);
        return {
          load: loadNo(load.load),
          value: box + weightMode,
          sub: parts.length > 0 ? parts.join(" · ") : undefined,
        };
      });
    case "mortalityWeight":
      // Weight-mode mortality is counted in birds only — it never has kg.
      return (row.mortalityByLoad ?? []).map((load) => ({
        load: loadNo(load.load),
        value: load.boxWeight ?? 0,
      }));
  }
}

/**
 * A tooltip is only meaningful when a shop genuinely has more than one load
 * in the selected range. Single-load shops (including legacy leg-less trips,
 * which always sit on Load 1) render their plain value with no tooltip.
 */
export function hasCumulativeLoadBreakdown(
  row: ShopLedgerCumulativeRow,
  metric: CumulativeQuantityMetric,
): boolean {
  return cumulativeLoadLines(row, metric).length > 1;
}
