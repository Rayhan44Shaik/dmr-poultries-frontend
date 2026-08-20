// src/modules/order/utils/orderFormat.ts
// Small, reusable formatting helpers for the Order module.

/** "274 km" / "Calculation Pending" for a distance value. */
export function formatDistanceKm(distanceKm: number | null): string {
  if (distanceKm == null) return "Calculation Pending";
  return `${distanceKm.toLocaleString("en-IN", { maximumFractionDigits: 0 })} km`;
}

/** "~2h 15m" from an estimated distance (at a nominal 40 km/h). */
export function formatEtaMinutes(distanceKm: number | null): string {
  if (distanceKm == null) return "—";
  const minutes = Math.round((distanceKm / 40) * 60);
  if (minutes < 60) return `~${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

/** Compact "20 Aug 2026" from an ISO date string. */
export function formatDeliveryDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
