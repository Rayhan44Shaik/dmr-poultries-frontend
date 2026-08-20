// src/modules/order/utils/feasibility.ts
// -----------------------------------------------------------------------------
// Delivery buffer / deadline feasibility classification. Thresholds are
// constants (see businessTime.ts) so they can be tuned later without touching
// call sites.
// -----------------------------------------------------------------------------

import type { BufferState, DeadlineFeasibility } from "../types/routeTypes";
import { BUFFER_HEALTHY_MIN, BUFFER_TIGHT_MIN } from "./businessTime";

/**
 * Buffer = deadline - predicted arrival (minutes).
 *   > 30 min          → Healthy
 *   10–30 min         → Tight
 *   0–10 min          → At Risk
 *   < 0               → Late
 */
export function classifyBuffer(bufferMinutes: number | null): BufferState {
  if (bufferMinutes == null || !Number.isFinite(bufferMinutes)) return "Unknown";
  if (bufferMinutes > BUFFER_HEALTHY_MIN) return "Healthy";
  if (bufferMinutes >= BUFFER_TIGHT_MIN) return "Tight";
  if (bufferMinutes >= 0) return "At Risk";
  return "Late";
}

/**
 * Deadline feasibility of a predicted arrival:
 *   buffer >= 10 min  → Can Meet
 *   0 <= buffer < 10  → At Risk
 *   buffer < 0        → Cannot Meet
 */
export function classifyFeasibility(bufferMinutes: number | null): DeadlineFeasibility {
  if (bufferMinutes == null || !Number.isFinite(bufferMinutes)) return "Unknown";
  if (bufferMinutes >= BUFFER_TIGHT_MIN) return "Can Meet";
  if (bufferMinutes >= 0) return "At Risk";
  return "Cannot Meet";
}
