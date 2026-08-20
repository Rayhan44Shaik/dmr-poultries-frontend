// src/modules/order/utils/orderFormat.ts
// Small, reusable formatting helpers for the Order module.

import type { Address } from "../types/orderTypes";
import { formatDuration } from "./businessTime";

/** "274 km" / "Calculation Pending" for a distance value. */
export function formatDistanceKm(distanceKm: number | null): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return "Calculation Pending";
  return `${Math.round(distanceKm).toLocaleString("en-IN")} km`;
}

/** "~2h 15m" from travel minutes. */
export function formatTravelMinutes(travelMinutes: number | null): string {
  if (travelMinutes == null || !Number.isFinite(travelMinutes)) return "—";
  return `~${formatDuration(travelMinutes)}`;
}

/** Single-line address, e.g. "12-34, MG Road, Vijayawada, Andhra Pradesh 520001". */
export function formatAddress(address: Address | null | undefined): string {
  if (!address) return "—";
  const parts = [address.line1, address.line2, address.area, address.city, address.district, address.state, address.pinCode]
    .filter((p) => p && p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** City + state + pin, e.g. "Vijayawada, Andhra Pradesh 520001". */
export function formatAddressShort(address: Address | null | undefined): string {
  if (!address) return "—";
  const parts = [address.city, address.state, address.pinCode].filter((p) => p && p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** "20 Aug 2026" from an ISO date string (no Date timezone shift). */
export function formatDeliveryDate(isoDate: string): string {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return isoDate;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(day).padStart(2, "0")} ${months[month - 1]} ${year}`;
}
