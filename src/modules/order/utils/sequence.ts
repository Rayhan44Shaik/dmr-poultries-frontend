// src/modules/order/utils/sequence.ts
// Deterministic sequence generators (no randomness) for order-side records.

let tripCounter = 2040;

/** Monotonic, human-readable trip number for the Order module demo. */
export function nextTripNumber(): string {
  tripCounter += 1;
  return `TRP-${tripCounter}`;
}
