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
  weight: number;
  /** Mortality bird count across all delivery modes. */
  mortality: number;
  /** Box-mode mortality birds only. */
  boxMortality: number;
  /** Weight-mode mortality birds only. */
  weightMortality: number;
  /** Mortality weight — box mode only (derived from avg farm weight). */
  mortKg: number;
  /** Weight loss — weight mode only: Σ max(0, farmWeight − deliveryWeight). */
  weightLoss: number;
  lastCaptureTime: string;
}

/** Live Step 4 KPI totals derived from the CURRENT rows (not persisted data)
 * so the cards update instantly as the user edits deliveries. */
export function computeDeliveryKpiTotals(rows: ShopDelivery[]): DeliveryKpiTotals {
  const saved = rows.filter((r) => Number(r.shopId) > 0 && isDeliveredRow(r));
  const totalBirds = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.birds)) ? Number(r.birds) : 0), 0);
  const totalWeight = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.weight)) ? Number(r.weight) : 0), 0);
  const totalMortality = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.mortality)) ? Number(r.mortality) : 0), 0);

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
      const farm = Number(extra.farmWeight || 0);
      const delivered = Number(r.weight || 0);
      if (Number.isFinite(farm) && Number.isFinite(delivered)) {
        totalWeightLoss += Math.max(0, farm - delivered);
      }
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
    weight: totalWeight,
    mortality: totalMortality,
    boxMortality,
    weightMortality,
    mortKg: totalMortKg,
    weightLoss: totalWeightLoss,
    lastCaptureTime: latestIso || latestRaw || "—",
  };
}
