import type { ShopDelivery } from "../../types/trip";
import { isDeliveredRow } from "./remainingBoxes";

export interface DeliveryKpiTotals {
  shops: number;
  birds: number;
  weight: number;
  mortality: number;
  mortKg: number;
  lastCaptureTime: string;
}

/** Live Step 4 KPI totals derived from the CURRENT rows (not persisted data)
 * so the cards update instantly as the user edits deliveries. */
export function computeDeliveryKpiTotals(rows: ShopDelivery[]): DeliveryKpiTotals {
  const saved = rows.filter((r) => Number(r.shopId) > 0 && isDeliveredRow(r));
  const totalBirds = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.birds)) ? Number(r.birds) : 0), 0);
  const totalWeight = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.weight)) ? Number(r.weight) : 0), 0);
  const totalMortality = saved.reduce((acc, r) => acc + (Number.isFinite(Number(r.mortality)) ? Number(r.mortality) : 0), 0);
  const totalMortKg = saved.reduce((acc, r) => {
    const kg = Number((r as ShopDelivery & { mortKg?: number }).mortKg || 0);
    return acc + (Number.isFinite(kg) ? kg : 0);
  }, 0);
  // Prefer the chronologically latest ISO capture; fall back to last non-empty.
  let latestIso = "";
  let latestMs = -Infinity;
  let latestRaw = "";
  for (const r of saved) {
    const time = String((r as ShopDelivery & { autoCaptureTime?: string }).autoCaptureTime || "").trim();
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
    mortKg: totalMortKg,
    lastCaptureTime: latestIso || latestRaw || "—",
  };
}