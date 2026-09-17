// src/modules/orders/utils/ordersTableStyles.ts
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

/**
 * Trip List density: 16px column padding, 20px body and 16px header padding.
 * The header word sits at 14px — a step above the shared 12px and above the
 * table body — so a column name reads at a glance beside its coloured glyph.
 */
export const ORDERS_TABLE_TH_CLASS =
  "px-4 py-4 text-left text-[14px] font-bold uppercase tracking-[0.05em] text-slate-800 whitespace-nowrap";

/**
 * Filter field label for the Orders pages: the Trip List label chrome
 * (uppercase, bold, leading icon) at 13px, and one shade darker — these filter
 * cards hold only a handful of fields, so each name has to read at a glance.
 */
export const ORDERS_FILTER_LABEL_CLASS =
  "mb-2 flex min-h-[17px] items-center gap-2 text-[13px] font-bold uppercase tracking-[0.05em] text-slate-700";
/**
 * A number box inside a Collection / Assignment row: compact (28px, so the row
 * stays tight while its words grow), square-rounded, with a small rise — a soft
 * shadow at rest that lifts a pixel on hover and lights up its ring on focus.
 * Each column passes its own tone classes so the box matches its header glyph.
 */
export const ORDERS_RISE_INPUT_CLASS =
  "h-6 w-full max-w-[86px] rounded-md border px-1.5 text-[13px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-[box-shadow,border-color,transform] duration-150 ease-out hover:shadow-[0_3px_8px_-3px_rgba(15,23,42,0.3)] motion-safe:hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-slate-400/30";

/**
 * The same head, allowed to wrap. Every Collection column but S.No and Action is
 * an equal share of what is left, so a long name like "No. of Boxes *" has to
 * break inside its own cell instead of pushing the row wider than its neighbours
 * — a nowrap head would either overflow its column or quietly win extra width.
 */
export const ORDERS_TABLE_TH_WRAP_CLASS = ORDERS_TABLE_TH_CLASS.replace(
  "whitespace-nowrap",
  "whitespace-normal break-words",
);

export const ORDERS_TABLE_TD_CLASS =
  "px-4 py-5 text-[14px] text-slate-700 align-middle";
