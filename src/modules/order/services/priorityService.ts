// src/modules/order/services/priorityService.ts
// -----------------------------------------------------------------------------
// Transparent, deterministic priority evaluation for the Order module.
//
// This is NOT an "AI" system (requirement #39). Every factor and weight is
// documented below so supervisors understand *why* an order/route is ranked
// the way it is. A future optimization engine can replace this without
// changing the UI.
// -----------------------------------------------------------------------------

import type { OrderPriority } from "../types/orderTypes";
import type { RoutePriorityLevel } from "../types/routeTypes";

/* ------------------------------------------------------------------ */
/*  Order priority                                                      */
/* ------------------------------------------------------------------ */

export const PRIORITY_ORDER: OrderPriority[] = ["Urgent", "Important", "Normal"];

/** Base weight contributed by the explicit priority flag. */
const PRIORITY_SCORE: Record<OrderPriority, number> = {
  Urgent: 3,
  Important: 2,
  Normal: 1,
};

export interface OrderPriorityInput {
  priority: OrderPriority;
  importantCustomer: boolean;
  deadline: string;
  distanceKm: number | null;
  status: string;
}

/**
 * Deterministic order-ranking score (higher = more urgent).
 * Factors, in order of influence:
 *   1. Explicit priority (Urgent > Important > Normal)
 *   2. Important customer flag (+1)
 *   3. Earlier delivery deadline (+0/1 — flagged orders get a nudge)
 *   4. Known short distance (+1, so nearby urgent work surfaces early)
 *
 * The result is a transparent sort key only; the explicit priority flag still
 * drives the visible badge so nothing is hidden behind a magic number.
 */
export function calculateOrderPriorityScore(input: OrderPriorityInput): number {
  let score = PRIORITY_SCORE[input.priority] * 10;
  if (input.importantCustomer) score += 5;
  if (isMorningDeadline(input.deadline)) score += 2;
  if (input.distanceKm != null && input.distanceKm <= 100) score += 1;
  if (input.status === "Cancelled" || input.status === "Delivered") score -= 100;
  return score;
}

/** True when the deadline text implies a morning delivery (before 12:00). */
export function isMorningDeadline(deadline: string): boolean {
  const match = deadline.match(/before\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return false;
  let hour = Number(match[1]);
  const meridiem = (match[3] ?? "").toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour < 12;
}

/* ------------------------------------------------------------------ */
/*  Route priority                                                      */
/* ------------------------------------------------------------------ */

export interface RoutePriorityFactors {
  urgentOrderCount: number;
  importantCustomerCount: number;
  earliestDeadline: string | null;
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  stopCount: number;
  vehicleAvailability: boolean;
  capacitySufficient: boolean;
  routeEfficient: boolean;
}

export interface RoutePriorityResult {
  level: RoutePriorityLevel;
  reasons: string[];
}

/**
 * Route-level priority, derived from transparent factors. A route is HIGH when
 * it contains urgent work, tight deadlines, or important customers; MEDIUM when
 * it carries notable but not critical constraints; LOW otherwise.
 */
export function evaluateRoutePriority(factors: RoutePriorityFactors): RoutePriorityResult {
  const reasons: string[] = [];

  if (factors.urgentOrderCount > 0) {
    reasons.push(`${factors.urgentOrderCount} urgent order${factors.urgentOrderCount > 1 ? "s" : ""}`);
  }
  if (factors.importantCustomerCount > 0) {
    reasons.push(`${factors.importantCustomerCount} important customer${factors.importantCustomerCount > 1 ? "s" : ""}`);
  }
  if (factors.earliestDeadline) {
    reasons.push(`Delivery required ${factors.earliestDeadline}`);
  }
  if (!factors.vehicleAvailability) {
    reasons.push("Vehicle not currently available");
  }
  if (!factors.capacitySufficient) {
    reasons.push("Vehicle capacity is tight");
  }
  if (factors.totalDistanceKm != null && factors.totalDistanceKm > 300) {
    reasons.push("Long-distance delivery route");
  }
  if (factors.stopCount >= 5) {
    reasons.push(`${factors.stopCount} stops — heavy route`);
  }
  if (factors.routeEfficient) {
    reasons.push("Vehicle already near pickup location");
  }
  if (reasons.length === 0) {
    reasons.push("Routine delivery — no critical factors");
  }

  let level: RoutePriorityLevel = "LOW";
  const urgent = factors.urgentOrderCount > 0;
  const deadlineTight = factors.earliestDeadline != null && isMorningDeadline(factors.earliestDeadline);
  const important = factors.importantCustomerCount > 0;
  const heavy = factors.stopCount >= 5;
  const unavailable = !factors.vehicleAvailability || !factors.capacitySufficient;

  if (urgent || (deadlineTight && (important || heavy)) || unavailable) level = "HIGH";
  else if (important || deadlineTight || heavy) level = "MEDIUM";

  return { level, reasons };
}
