// src/modules/operations/orders/ordersTableStyles.ts
// Universal table style for ALL Orders tables (Order Collection, Order
// Assignment, Delivery Tracking) — mirrors the Recent table look:
//
//   • ONE universal body font size (text-xs → md:text-sm) on every table.
//   • Two-tone ("2D colour") zebra rows — even rows white, odd rows a soft
//     slate tint, hover preserved.
//   • Standard body type — regular/medium cells, never all-bold; only one
//     key column per table (shop name / trip no) may be semi-bold.
//
// Pure style constants/functions (no React), so this file stays outside the
// react-refresh component-only-export rule.

import { opsTableRowClass } from "../../../shared/ui/operationsStyles";

/** Universal body font for every Orders table (the Recent-table standard). */
export const ORDERS_TABLE_FONT_CLASS = "text-xs md:text-sm";

/** Zebra tone for one row — even rows white, odd rows a soft slate tint. */
export function ordersZebraTone(index: number): string {
  return index % 2 === 0 ? "bg-white" : "bg-slate-50/40";
}

/**
 * Two-tone (zebra) body row like the Recent table. Rows that carry their own
 * state colour (selected / drop-target) should instead use `ordersZebraTone`
 * directly and give the state colour priority.
 */
export function ordersTableZebraRow(index: number, extraClass = ""): string {
  return `${opsTableRowClass} ${ordersZebraTone(index)}${extraClass ? ` ${extraClass}` : ""}`;
}
