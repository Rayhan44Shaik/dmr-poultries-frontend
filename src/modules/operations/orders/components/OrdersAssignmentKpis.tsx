// src/modules/operations/orders/components/OrdersAssignmentKpis.tsx
// TAB 2 — ORDER ASSIGNMENT · key figures.
//
// Order Assignment answers ONE question: "of everything the shops ordered
// today, how much is already on a vehicle and how much is still waiting?"
// So the board is six tiles in that exact reading order:
//
//   SHOPS ordered → assigned → pending  ·  BOXES ordered → assigned → pending
//
// Every figure comes from the SERVER summary for the whole filtered day
// (never the visible page), so `ordered = assigned + pending` holds exactly,
// at every page size. Nothing is recomputed from the rows the table happens
// to be showing.
//
// LAYOUT — the tiles are deliberately DENSE and horizontal: icon, then the
// label, then the figure hard against the right edge, with a full-bleed
// meter along the tile's bottom edge. No descriptive sentence under the
// label — it names the figure already. On a wide ERP screen all six sit on
// ONE row and each tile is filled edge to edge; they fold to three, then
// two, then one as the viewport narrows.
//
// Rendering rules that keep the board stable (no blink, no jump):
//   · every tile has the same fixed geometry and a shared min height —
//     values change, geometry never does;
//   · the first load shows a skeleton in the figure slot; afterwards the
//     last known-good numbers stay on screen, so they never blank out;
//   · pure props in, no effects, no timers, memoised — it cannot remount
//     itself or re-render on unrelated parent state.
//
// The vehicles themselves live in the workspace below, one expandable row
// each. This file is only the day's totals.

import React from "react";
import { CheckCircle2, Clock, Package, PackageOpen, Store, Truck } from "lucide-react";
import type { OrdersT } from "../i18n/ordersI18n";
import {
  fillPercent,
  TONE_BAR,
  TONE_ICON,
  TONE_VALUE,
  type Tone,
} from "./ordersUiConstants";

type KpiTile = {
  key: string;
  label: string;
  value: number;
  /** Denominator for the meter + the percentage (omit → no meter). */
  total?: number;
  /** The ONLY sub-line a tile ever shows: the unsaved-draft projection. */
  note?: string;
  tone: Tone;
  icon: React.ReactNode;
};

function Tile({ tile, ready }: { tile: KpiTile; ready: boolean }) {
  const hasMeter = typeof tile.total === "number";
  const percent = hasMeter ? fillPercent(tile.value, tile.total as number) : 0;
  return (
    <div
      // The label truncates on a narrow tile, so it stays readable as a
      // native tooltip.
      title={tile.note ? `${tile.label} — ${tile.note}` : tile.label}
      className="relative flex min-h-[68px] items-center gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${
          TONE_ICON[tile.tone]
        }`}
        aria-hidden
      >
        {tile.icon}
      </span>

      {/* Label only. The sub-line appears solely for an unsaved edit, and
          fits inside the tile's min height, so showing it shifts nothing. */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-bold uppercase leading-4 tracking-wider text-slate-500">
          {tile.label}
        </div>
        {tile.note && (
          <div className="truncate text-[10.5px] font-semibold leading-4 text-amber-700">
            {tile.note}
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 flex-col items-end justify-center">
        {ready ? (
          <span
            className={`text-[26px] font-extrabold leading-none tabular-nums ${
              TONE_VALUE[tile.tone]
            }`}
          >
            {tile.value}
          </span>
        ) : (
          <span className="h-6 w-12 animate-pulse rounded-md bg-slate-100" />
        )}
        {hasMeter && (
          <span className="mt-1 text-[10px] font-bold leading-none tabular-nums text-slate-400">
            {ready ? `${percent}%` : " "}
          </span>
        )}
      </div>

      {/* Full-bleed meter along the tile's bottom edge. */}
      {hasMeter && (
        <span
          className="absolute inset-x-0 bottom-0 h-[3px] bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ready ? percent : undefined}
          aria-label={tile.label}
        >
          <span
            className={`block h-full ${TONE_BAR[tile.tone]} transition-[width] duration-300 ease-out motion-reduce:transition-none`}
            style={{ width: ready ? `${percent}%` : "0%" }}
          />
        </span>
      )}
    </div>
  );
}

const MemoTile = React.memo(Tile);

export type OrdersAssignmentKpisProps = {
  /** Shops that ordered ≥1 box today (server summary, whole filtered day). */
  shopsOrdered: number;
  /** Shops whose entire ordered quantity sits on a vehicle trip. */
  shopsAssigned: number;
  /** Shops still waiting (shopsOrdered − shopsAssigned, server-computed). */
  shopsPending: number;
  boxesOrdered: number;
  boxesAssigned: number;
  boxesPending: number;
  /** Boxes every unsaved draft adds to (or removes from) the day. */
  draftBoxesDelta: number;
  /** false = the very first load (skeletons); true = real figures on screen. */
  ready: boolean;
  /** true = a refetch is in flight; the figures shown are the previous ones. */
  syncing: boolean;
  t: OrdersT;
};

function OrdersAssignmentKpis({
  shopsOrdered,
  shopsAssigned,
  shopsPending,
  boxesOrdered,
  boxesAssigned,
  boxesPending,
  draftBoxesDelta,
  ready,
  syncing,
  t,
}: OrdersAssignmentKpisProps) {
  // The unsaved-draft projection is shown as a sub-line, never folded into
  // the headline figure: the big number always states what the server holds,
  // so the board and the database never disagree.
  const projectedAssigned = Math.max(0, boxesAssigned + draftBoxesDelta);
  const projectedPending = Math.max(0, boxesOrdered - projectedAssigned);
  const dirty = draftBoxesDelta !== 0;

  const tiles: KpiTile[] = [
    {
      key: "shopsOrdered",
      label: t("orders.kpi_shops_ordered"),
      value: shopsOrdered,
      tone: "sky",
      icon: <Store size={16} />,
    },
    {
      key: "shopsAssigned",
      label: t("orders.kpi_shops_assigned"),
      value: shopsAssigned,
      total: shopsOrdered,
      tone: "emerald",
      icon: <CheckCircle2 size={16} />,
    },
    {
      key: "shopsPending",
      label: t("orders.kpi_shops_pending"),
      value: shopsPending,
      total: shopsOrdered,
      tone: shopsPending > 0 ? "amber" : "emerald",
      icon: <Clock size={16} />,
    },
    {
      key: "boxesOrdered",
      label: t("orders.kpi_boxes_ordered"),
      value: boxesOrdered,
      tone: "sky",
      icon: <Package size={16} />,
    },
    {
      key: "boxesAssigned",
      label: t("orders.kpi_boxes_assigned"),
      value: boxesAssigned,
      total: boxesOrdered,
      note: dirty ? t("orders.kpi_unsaved", { value: projectedAssigned }) : undefined,
      tone: "emerald",
      icon: <Truck size={16} />,
    },
    {
      key: "boxesPending",
      label: t("orders.kpi_boxes_pending"),
      value: boxesPending,
      total: boxesOrdered,
      note: dirty ? t("orders.kpi_unsaved", { value: projectedPending }) : undefined,
      tone: boxesPending > 0 ? "amber" : "emerald",
      icon: <PackageOpen size={16} />,
    },
  ];

  return (
    <section
      aria-label={t("orders.kpi_board_aria")}
      aria-busy={syncing || !ready}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
    >
      {tiles.map((tile) => (
        <MemoTile key={tile.key} tile={tile} ready={ready} />
      ))}
    </section>
  );
}

export default React.memo(OrdersAssignmentKpis);
