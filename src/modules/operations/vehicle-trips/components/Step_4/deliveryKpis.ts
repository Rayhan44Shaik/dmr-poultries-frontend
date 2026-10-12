import type { ShopDelivery } from "../../types/trip";
import { isDeliveredRow } from "./remainingBoxes";

type DeliveryRowExtra = ShopDelivery & {
  mortKg?: number;
  farmWeight?: number;
  deliveryMode?: string;
  autoCaptureTime?: string;
};

export interface DeliveryKpiTotals {
  shops: number;
  birds: number;
  /** Unique pickup boxes completed across genuinely saved deliveries. */
  completedBoxes: number;
  weight: number;
  /** Mortality bird count across all delivery modes. */
  mortality: number;
  /** Box-mode mortality birds only. */
  boxMortality: number;
  /** Weight-mode mortality birds only. */
  weightMortality: number;
  /** Mortality weight — box mode only (derived from avg farm weight). */
  mortKg: number;
  /** Weight loss — weight mode only: Σ max(0, farm − delivered − mortality kg). */
  weightLoss: number;
  lastCaptureTime: string;
}

/** Canonical row loss used by the form, table row and total KPI. */
export function deliveryWeightLoss(row: Pick<ShopDelivery, "weight" | "mortKg" | "farmWeight" | "deliveryMode">): number {
  if ((row.deliveryMode ?? "box") !== "weight") return 0;
  const farm = Number(row.farmWeight || 0);
  const delivered = Number(row.weight || 0);
  const mortalityWeight = Number(row.mortKg || 0);
  if (![farm, delivered, mortalityWeight].every(Number.isFinite)) return 0;
  return Math.max(0, Math.round((farm - delivered - mortalityWeight) * 100) / 100);
}

/** Live Step 4 KPI totals derived from the CURRENT rows (not persisted data)
 * so the cards update instantly as the user edits deliveries. */
export function computeDeliveryKpiTotals(rows: ShopDelivery[]): DeliveryKpiTotals {
  const saved = rows.filter(
    (r) =>
      Number(r.shopId) > 0 &&
      Number(r.birds) > 0 &&
      Number(r.weight) > 0 &&
      isDeliveredRow(r)
  );
  const totalBirds = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.birds)) ? Number(r.birds) : 0), 0);
  const totalWeight = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.weight)) ? Number(r.weight) : 0), 0);
  const totalMortality = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.mortality)) ? Number(r.mortality) : 0), 0);
  const completedBoxNumbers = new Set<number>();
  let legacyCompletedBoxes = 0;
  for (const row of saved) {
    const selected = Array.isArray(row.selectedBoxIds)
      ? row.selectedBoxIds.map(Number).filter((boxNo) => Number.isInteger(boxNo) && boxNo > 0)
      : [];
    if (selected.length > 0) {
      for (const boxNo of selected) completedBoxNumbers.add(boxNo);
    } else {
      // Legacy rows may have only the saved box count, without child links.
      legacyCompletedBoxes += Math.max(0, Number(row.boxNo) || 0);
    }
  }

  let boxMortality = 0;
  let weightMortality = 0;
  let totalMortKg = 0;
  let totalWeightLoss = 0;
  for (const r of saved) {
    const extra = r as DeliveryRowExtra;
    const mode = (extra.deliveryMode ?? "box") === "weight" ? "weight" : "box";
    const mortBirds = Number.isFinite(Number(r.mortality)) ? Number(r.mortality) : 0;
    if (mode === "box") {
      boxMortality += mortBirds;
      const kg = Number(extra.mortKg || 0);
      if (Number.isFinite(kg)) totalMortKg += kg;
    } else {
      weightMortality += mortBirds;
      totalWeightLoss += deliveryWeightLoss(extra);
    }
  }
  totalMortKg = Math.round(totalMortKg * 1000) / 1000;
  totalWeightLoss = Math.round(totalWeightLoss * 100) / 100;

  // Prefer the chronologically latest ISO capture; fall back to last non-empty.
  let latestIso = "";
  let latestMs = -Infinity;
  let latestRaw = "";
  for (const r of saved) {
    const time = String((r as DeliveryRowExtra).autoCaptureTime || "").trim();
    if (!time) continue;
    latestRaw = time;
    const ms = Date.parse(time);
    if (Number.isFinite(ms) && ms >= latestMs) {
      latestMs = ms;
      latestIso = time;
    }
  }
  return {
    shops: saved.length,
    birds: totalBirds,
    completedBoxes: completedBoxNumbers.size + legacyCompletedBoxes,
    weight: totalWeight,
    mortality: totalMortality,
    boxMortality,
    weightMortality,
    mortKg: totalMortKg,
    weightLoss: totalWeightLoss,
    lastCaptureTime: latestIso || latestRaw || "—",
  };
}
