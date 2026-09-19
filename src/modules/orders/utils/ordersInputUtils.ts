import type React from "react";

/** Prevent quantity fields from changing accidentally while the table scrolls. */
export const ORDERS_NO_SPINNER = "no-spinner";

export function onOrdersNumberWheel(
  event: React.WheelEvent<HTMLInputElement>,
): void {
  event.currentTarget.blur();
}
