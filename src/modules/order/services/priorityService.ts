// src/modules/order/services/priorityService.ts
// -----------------------------------------------------------------------------
// Transparent, deterministic priority evaluation for the Order module.
//
// Two distinct concepts live here (and are deliberately kept separate from the
// vehicle recommendation score — see vehicleRecommendationService.ts):
//
//   1. ORDER priority — the explicit Normal / Important / Urgent flag.
//   2. ROUTE priority — HIGH / MEDIUM / LOW, derived from actual deadlines,
//      predicted arrivals, stop count, and capacity/availability.
//
// This is NOT an "AI" system (requirement #39). Every factor is documented so
// supervisors understand *why* a route is ranked the way it is.
// -----------------------------------------------------------------------------

import type { Order, OrderPriority } from "../types/orderTypes";
import type { BufferState, RoutePriorityLevel } from "../types/routeTypes";
import { parseHHmm } from "../utils/businessTime";

/* ------------------------------------------------------------------ */
/*  Order priority (explicit flag)                                      */
/* ------------------------------------------------------------------ */

export const PRIORITY_ORDER: OrderPriority[] = ["Urgent", "Important", "Normal"];

export function priorityRank(priority: OrderPriority): number {
  switch (priority) {
    case "Urgent":
      return 3;
    case "Important":
      return 2;
    default:
      return 1;
  }
}

/** Comparator for delivery sequencing: earliest deadline first, then priority. */
export function compareOrdersByDeadlineThenPriority(a: Order, b: Order): number {
  const timeA = parseHHmm(a.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
  const timeB = parseHHmm(b.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
  if (timeA !== timeB) return timeA - timeB;
  const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
  if (priorityDelta !== 0) return priorityDelta;
  return a.orderNumber.localeCompare(b.orderNumber);
}

/* ------------------------------------------------------------------ */
/*  Route priority                                                      */
/* ------------------------------------------------------------------ */

export interface RoutePriorityFactors {
  urgentOrderCount: number;
  importantCustomerCount: number;
  earliestDeadlineLabel: string | null;
  /** Smallest delivery buffer across all stops (minutes) — null if unknown. */
  minBufferMinutes: number | null;
  hasLateStop: boolean;
  hasAtRiskStop: boolean;
  totalTravelMinutes: number | null;
  stopCount: number;
  vehicleAvailability: boolean;
  capacitySufficient: boolean;
}

export interface RoutePriorityResult {
  level: RoutePriorityLevel;
  reasons: string[];
}

/**
 * Route-level priority, derived from transparent factors. A route is HIGH when
 * a stop cannot meet its deadline, or an urgent order is at risk, or the
 * vehicle is unavailable/over-capacity. MEDIUM when it carries notable but not
 * critical constraints. LOW otherwise.
 */
export function evaluateRoutePriority(factors: RoutePriorityFactors): RoutePriorityResult {
  const reasons: string[] = [];

  if (factors.urgentOrderCount > 0) {
    reasons.push(`${factors.urgentOrderCount} urgent order${factors.urgentOrderCount > 1 ? "s" : ""}`);
  }
  if (factors.importantCustomerCount > 0) {
    reasons.push(`${factors.importantCustomerCount} important customer${factors.importantCustomerCount > 1 ? "s" : ""}`);
  }
  if (factors.earliestDeadlineLabel) {
    reasons.push(`Earliest deadline ${factors.earliestDeadlineLabel}`);
  }
  if (factors.hasLateStop) {
    reasons.push("A stop is predicted to arrive after its deadline");
  }
  if (factors.hasAtRiskStop) {
    reasons.push("A stop has a tight delivery buffer");
  }
  if (!factors.vehicleAvailability) {
    reasons.push("Vehicle not currently available");
  }
  if (!factors.capacitySufficient) {
    reasons.push("Vehicle capacity is tight");
  }
  if (factors.stopCount >= 5) {
    reasons.push(`${factors.stopCount} stops — heavy route`);
  }
  if (factors.minBufferMinutes != null && factors.minBufferMinutes <= 20) {
    reasons.push("Predicted arrival is close to the deadline");
  }
  if (reasons.length === 0) {
    reasons.push("Routine delivery — no critical factors");
  }

  let level: RoutePriorityLevel = "LOW";
  const urgent = factors.urgentOrderCount > 0;
  const late = factors.hasLateStop;
  const atRisk = factors.hasAtRiskStop;
  const important = factors.importantCustomerCount > 0;
  const heavy = factors.stopCount >= 5;
  const unavailable = !factors.vehicleAvailability || !factors.capacitySufficient;

  if (late || unavailable || (urgent && atRisk)) level = "HIGH";
  else if (urgent || important || atRisk || heavy) level = "MEDIUM";

  return { level, reasons };
}

/** Format a buffer state into a short readable label for route reasons. */
export function bufferStateLabel(state: BufferState): string {
  switch (state) {
    case "Healthy":
      return "healthy buffer";
    case "Tight":
      return "tight buffer";
    case "At Risk":
      return "at-risk buffer";
    case "Late":
      return "already late";
    default:
      return "unknown buffer";
  }
}
