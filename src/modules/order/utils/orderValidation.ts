// src/modules/order/utils/orderValidation.ts
// -----------------------------------------------------------------------------
// Pure, strongly-typed validation for the Order form. Returns readable,
// field-scoped error messages (requirement #30).
// -----------------------------------------------------------------------------

import type { OrderDraft, OrderPriority, RequirementType } from "../types/orderTypes";

export type OrderValidationErrors = Partial<Record<keyof OrderDraft | "form", string>>;

export interface OrderValidationResult {
  valid: boolean;
  errors: OrderValidationErrors;
}

export const BIRD_TYPES: readonly string[] = ["Broiler", "Layer", "Country Chicken", "Breeder"];
export const REQUIREMENT_TYPES: readonly RequirementType[] = ["Birds", "Boxes", "Birds + Boxes"];
export const PRIORITIES: readonly OrderPriority[] = ["Normal", "Important", "Urgent"];

function isWholeNumber(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

/**
 * Validate an order draft. Rules:
 *  - Shop required
 *  - Bird type required
 *  - Birds/boxes must be whole numbers >= 0
 *  - At least one quantity (birds or boxes) must be > 0
 *  - Priority required
 *  - Delivery date required and must be a valid, non-empty date
 *  - Deadline required
 *  - Expected weight (optional) must be >= 0
 */
export function validateOrderDraft(draft: OrderDraft): OrderValidationResult {
  const errors: OrderValidationErrors = {};

  if (!draft.shopId) {
    errors.shopId = "Shop is required.";
  }

  if (!draft.birdType) {
    errors.birdType = "Bird type is required.";
  }

  if (!Number.isFinite(draft.birds) || draft.birds < 0) {
    errors.birds = "Number of birds cannot be negative.";
  } else if (!isWholeNumber(draft.birds)) {
    errors.birds = "Number of birds must be a whole number.";
  }

  if (!Number.isFinite(draft.boxes) || draft.boxes < 0) {
    errors.boxes = "Number of boxes cannot be negative.";
  } else if (!isWholeNumber(draft.boxes)) {
    errors.boxes = "Number of boxes must be a whole number.";
  }

  const hasBirds = draft.birds > 0;
  const hasBoxes = draft.boxes > 0;
  if (!hasBirds && !hasBoxes) {
    errors.form = "Provide at least one quantity — birds or boxes.";
  }

  if (!draft.priority) {
    errors.priority = "Priority is required.";
  }

  if (!draft.deliveryDate) {
    errors.deliveryDate = "Delivery date is required.";
  } else if (Number.isNaN(new Date(draft.deliveryDate).getTime())) {
    errors.deliveryDate = "Delivery date is invalid.";
  }

  if (!draft.deliveryDeadline) {
    errors.deliveryDeadline = "Delivery deadline is required.";
  }

  if (draft.expectedWeightKg != null && draft.expectedWeightKg < 0) {
    errors.expectedWeightKg = "Expected weight cannot be negative.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Deadline presets shown in the New Order form. */
export const DEADLINE_PRESETS: readonly string[] = [
  "Before 08:00",
  "Before 10:00",
  "Before 12:00",
  "Before 14:00",
  "Before 16:00",
  "Before 18:00",
];

/** Next-generation order number for a new order given the current count. */
export function nextOrderNumber(existing: number): string {
  const base = 1000 + existing + 1;
  return `ORD-${base}`;
}
