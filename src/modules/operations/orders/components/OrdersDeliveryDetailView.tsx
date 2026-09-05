// src/modules/operations/orders/components/OrdersDeliveryDetailView.tsx
// Delivery detail MODAL (opened from Tab 3 "View").
//
// One clean modal sheet — NO duplicate page header (no "Orders", no
// "Delivery Tracking", no "Order Assignment" text inside). The single
// title is the trip number itself.
//
//   TRIP DETAILS — read-only values from the existing Trip Entry data
//   SHOP DELIVERY REPORT — matched (originally listed) shops in ONE
//     paginated table (incl. NOT DELIVERED ones), with ordered vs
//     delivered Birds / Boxes / WEIGHT, separate differences, delivery
//     status and the REAL Step 4 capture timestamp.
//   NOT LISTED SHOP DELIVERIES — shops delivered that were never in the
//     original order get a SEPARATE section below the report (subtle
//     warning styling, never hidden, never mixed into the table).
//   ONE compact table-level search + ONE compact status filter; 10 rows
//   per page (existing global pagination). Below the table: a compact
//   totals summary (TOTAL ORDERED / TOTAL DELIVERED / DIFFERENCE for
//   Boxes, Birds and Weight — a small table, not KPI cards; totals sum
//   the VISIBLE rows and never mix ordered vs delivered quantities).

import React, { useMemo, useState } from "react";
import { Check, FileText, Loader2, Truck, X } from "lucide-react";
import {
  opsTableCardClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
} from "../../../../shared/ui/operationsStyles";
import TripPagination from "../../vehicle-trips/components/TripPagination";
import {
  buildShopBreakdown,
  filterShopBreakdown,
  formatCount,
  formatDeliveredAtLabel,
  rowsInSequence,
  shopRemainingBoxes,
  type ShopDeliveryBreakdown,
} from "../ordersUtils";
import {
  shopMobileOf,
  villageOf,
  type OrdersWhatsAppResult,
  type ShopDirectory,
} from "../ordersService";
import { useOrdersI18n, type OrdersT } from "../i18n/ordersI18n";
import type { OrdersTrip } from "../types";
import OrdersPdfPreview from "./OrdersPdfPreview";
import {
  ORDERS_NO_SPINNER,
  OrdersDropdown,
  OrdersIconButton,
  OrdersSearchInput,
  OrdersStatusBadge,
  WhatsAppIcon,
  onOrdersNumberWheel,
} from "./OrdersCommon";

const PAGE_SIZE = 10;

type Props = {
  orderTrip: OrdersTrip;
  shopDirectory: ShopDirectory;
  supervisorMobile: string;
  pdfBusy: boolean;
  whatsappBusy: boolean;
  onClose: () => void;
  /** Sends the report; resolves with the per-shop outcome for the popup. */
  onWhatsApp: () => Promise<OrdersWhatsAppResult | null>;
  /**
   * Record one shop's delivery (Step 4) — partial allowed. Resolves after the
   * page refetched, so the report re-derives from persisted data.
   */
  onRecordDelivery: (shop: ShopDeliveryBreakdown, boxes: number) => Promise<void>;
  /** Save Progress from the check popup — error message, or null. */
  onSaveProgress: () => Promise<string | null>;
  /** Submit the delivery trip from the check popup — error message, or null. */
  onSubmitTrip: () => Promise<string | null>;
};

type ReportStatusFilter =
  | "all"
  | "delivered"
  | "part_delivered"
  | "delivered_with_diff"
  | "not_delivered"
  | "not_listed";

/** One difference cell: 0 → muted, short → rose, over → emerald. */
function DiffCell({ value, show }: { value: number; show: boolean }) {
  if (!show) return <span className="text-slate-300">—</span>;
  if (value === 0) return <span className="font-semibold text-slate-400">0</span>;
  return (
    <span className={`font-bold ${value < 0 ? "text-rose-600" : "text-emerald-600"}`}>
      {value < 0 ? "−" : "+"}
      {Math.abs(value)}
    </span>
  );
}

/** Weight difference cell (two decimals). */
function WeightDiffCell({ value, show }: { value: number; show: boolean }) {
  if (!show) return <span className="text-slate-300">—</span>;
  const rounded = Number(value.toFixed(2));
  if (rounded === 0) return <span className="font-semibold text-slate-400">0.00</span>;
  return (
    <span className={`font-bold ${rounded < 0 ? "text-rose-600" : "text-emerald-600"}`}>
      {rounded < 0 ? "−" : "+"}
      {Math.abs(rounded).toFixed(2)}
    </span>
  );
}

/** Delivery Status cell for the report. */
function DeliveryStatusCell({ row, to }: { row: ShopDeliveryBreakdown; to: OrdersT }) {
  switch (row.status) {
    case "delivered":
      return <OrdersStatusBadge status="Delivered" label={to("orders.status_delivered")} />;
    case "part_delivered":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">
          {to("orders.status_part_delivered")}
        </span>
      );
    case "delivered_with_diff":
      return <OrdersStatusBadge status="Delivered with Difference" label={to("orders.status_delivered_diff")} />;
    case "not_delivered":
      return <OrdersStatusBadge status="Not Delivered" label={to("orders.status_not_delivered")} />;
    case "not_listed":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">
          {to("orders.status_not_listed")}
        </span>
      );
  }
}

/**
 * Shop-level delivery capture (last column of the report).
 *
 * The order is already on the row (Ordered Birds / Boxes) — this records what
 * actually reached the shop. PARTIAL: the box input is capped at the balance
 * (ordered − delivered), so a shop can be delivered in several lots, and a
 * shop whose order is fully in shows COMPLETE with no input at all — that is
 * the duplicate guard.
 */
function ShopDeliveryCapture({
  row,
  remaining,
  busy,
  value,
  onValue,
  onSubmit,
  to,
}: {
  row: ShopDeliveryBreakdown;
  remaining: number;
  busy: boolean;
  value: string;
  onValue: (v: string) => void;
  onSubmit: (boxes: number) => void;
  to: OrdersT;
}) {
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 whitespace-nowrap">
        <Check size={12} />
        {to("orders.delivery_complete")}
      </span>
    );
  }
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= remaining;
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        max={remaining}
        value={value}
        placeholder={String(remaining)}
        disabled={busy}
        onChange={(e) => onValue(e.target.value)}
        onWheel={onOrdersNumberWheel}
        aria-label={`${to("orders.delivered_boxes")} — ${row.shopName}`}
        className={`${ORDERS_NO_SPINNER} h-8 w-20 rounded-lg border border-slate-200 px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500`}
      />
      <button
        type="button"
        onClick={() => onSubmit(parsed)}
        disabled={busy || !valid}
        title={to("orders.delivery_balance_hint", { remaining })}
        aria-label={`${to("orders.deliver")} — ${row.shopName}`}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/40 bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />}
        {to("orders.deliver")}
      </button>
      <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
        {to("orders.balance")}: {formatCount(remaining)}
      </span>
    </div>
  );
}

function OrdersDeliveryDetailView({
  orderTrip,
  shopDirectory,
  supervisorMobile,
  pdfBusy,
  whatsappBusy,
  onClose,
  onWhatsApp,
  onRecordDelivery,
  onSaveProgress,
  onSubmitTrip,
}: Props) {
  const { to } = useOrdersI18n();
  const { trip, progress, originalShopIds } = orderTrip;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("all");
  // "Check PDF" popup (preview -> download / send / correct).
  const [pdfOpen, setPdfOpen] = useState(false);
  // Shop-level capture: per-shop box entry + one in-flight shop at a time.
  const [qty, setQty] = useState<Record<number, string>>({});
  const [busyShopId, setBusyShopId] = useState<number | null>(null);
  // A completed trip is closed — its deliveries are history, not editable.
  const canDeliver = (progress?.status ?? "Assigned") !== "Completed";

  const breakdown = useMemo(
    () =>
      buildShopBreakdown(
        rowsInSequence(trip),
        originalShopIds,
        (shopId, shopName) => villageOf(shopId, shopName, shopDirectory),
        orderTrip.originalQuantities,
        (shopId) => shopMobileOf(shopId, shopDirectory)
      ),
    [trip, originalShopIds, shopDirectory, orderTrip.originalQuantities]
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "delivered", label: to("orders.status_delivered") },
      { value: "part_delivered", label: to("orders.status_part_delivered") },
      { value: "delivered_with_diff", label: to("orders.status_delivered_diff") },
      { value: "not_delivered", label: to("orders.status_not_delivered") },
      { value: "not_listed", label: to("orders.status_not_listed") },
    ],
    [to]
  );

  /** One shop's (partial) delivery — the balance is the hard maximum. */
  const handleDeliver = async (row: ShopDeliveryBreakdown) => {
    if (busyShopId !== null) return;
    const remaining = shopRemainingBoxes(row);
    const boxes = Math.floor(Number(qty[row.shopId] ?? ""));
    if (!Number.isFinite(boxes) || boxes < 1 || boxes > remaining) return;
    setBusyShopId(row.shopId);
    try {
      await onRecordDelivery(row, boxes);
      setQty((prev) => {
        const next = { ...prev };
        delete next[row.shopId];
        return next;
      });
    } finally {
      setBusyShopId(null);
    }
  };

  // One table-level search over the WHOLE report (listed + unlisted rows).
  const searched = useMemo(
    () =>
      filterShopBreakdown(
        breakdown,
        query,
        {
          ordered: to("orders.status_ordered"),
          notListed: to("orders.status_not_listed"),
          delivered: to("orders.status_delivered"),
          partDelivered: to("orders.status_part_delivered"),
          deliveredWithDiff: to("orders.status_delivered_diff"),
          notDelivered: to("orders.status_not_delivered"),
        },
        trip.tripNo,
        trip.vehicleNo ?? ""
      ),
    [breakdown, query, to, trip.tripNo, trip.vehicleNo]
  );

  // ── Split: shops LISTED in the original order (main paginated table) vs
  //    shops delivered that were NEVER listed — NOT LISTED rows always live
  //    in their own section below, never hidden, never mixed into the
  //    matched-shop table. The status filter applies to the main table;
  //    the NOT LISTED section is only narrowed by the shared search.
  const listedRows = useMemo(
    () =>
      searched.filter(
        (row) =>
          row.status !== "not_listed" &&
          (statusFilter === "all" || row.status === statusFilter)
      ),
    [searched, statusFilter]
  );
  const unlistedRows = useMemo(
    () => searched.filter((row) => row.status === "not_listed"),
    [searched]
  );

  // ── Pagination (existing global component; 10 rows per page; resets to
  //    page 1 whenever the search / status filter changes) ─────────────────
  const totalPages = Math.max(1, Math.ceil(listedRows.length / PAGE_SIZE));
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(
    `${query}|${statusFilter}|${listedRows.length}`
  );
  if (lastKey !== `${query}|${statusFilter}|${listedRows.length}`) {
    setLastKey(`${query}|${statusFilter}|${listedRows.length}`);
    if (page !== 1) setPage(1);
  }
  const safePage = Math.min(page, totalPages);
  const pageRows = listedRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const startIndex = listedRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE;

  // ── Totals over ALL matched rows (listed + unlisted) — ordered sums
  //    ordered, delivered sums delivered (NOT LISTED rows have no ordered
  //    quantity → ordered 0).
  const totals = useMemo(() => {
    const t = {
      orderedBoxes: 0,
      orderedBirds: 0,
      orderedWeight: 0,
      deliveredBoxes: 0,
      deliveredBirds: 0,
      deliveredWeight: 0,
    };
    for (const row of [...listedRows, ...unlistedRows]) {
      const isListed = row.status !== "not_listed";
      if (isListed) {
        t.orderedBoxes += row.orderedBoxes;
        t.orderedBirds += row.orderedBirds;
        t.orderedWeight += row.orderedWeight;
      }
      t.deliveredBoxes += row.deliveredBoxes;
      t.deliveredBirds += row.deliveredBirds;
      t.deliveredWeight += row.deliveredWeight;
    }
    t.orderedWeight = Number(t.orderedWeight.toFixed(2));
    t.deliveredWeight = Number(t.deliveredWeight.toFixed(2));
    return t;
  }, [listedRows, unlistedRows]);

  const notListedCount = breakdown.filter((b) => b.status === "not_listed").length;
  const notDeliveredCount = breakdown.filter((b) => b.status === "not_delivered").length;

  const status = progress?.status ?? "Assigned";
  const statusLabel =
    status === "In Progress"
      ? to("orders.status_in_progress")
      : status === "Completed"
        ? to("orders.status_completed")
        : to("orders.status_assigned");

  const details: Array<[string, string]> = [
    [to("orders.col_date"), trip.tripDate || "—"],
    [to("orders.col_vehicle_no"), trip.vehicleNo || "—"],
    [
      to("orders.farm_address"),
      `${trip.sourceFarm || "—"}${trip.farmAddress ? ` · ${trip.farmAddress}` : ""}`,
    ],
    [to("orders.bird_type"), trip.birdType || "—"],
    [to("orders.supervisor"), trip.supervisorName || "—"],
    [to("orders.driver"), trip.driverName || "—"],
    [to("orders.supervisor_mobile"), supervisorMobile || "—"],
    [
      to("orders.avg_bird_weight"),
      trip.avgBirdWeight ? `${Number(trip.avgBirdWeight).toFixed(2)} KG` : "—",
    ],
    [to("orders.col_completed_at"), formatDeliveredAtLabel(trip.submittedAtTimestamp)],
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop (click to close) */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />

      <div className="relative min-h-full flex items-start justify-center p-3 md:p-8">
        <div className="relative bg-slate-100 w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Modal header — ONE concise title (the trip number), no
              duplicated Orders/Tracking/Assignment page headers. */}
          <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{trip.tripNo}</h2>
              <OrdersStatusBadge status={status} label={statusLabel} />
              {notListedCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                  {to("orders.additional_count", { n: notListedCount })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Check the report in a popup first — it holds the download
                  and the send, so what you verify is what goes out. */}
              <OrdersIconButton label={to("orders.pdf_check_title")} onClick={() => setPdfOpen(true)} busy={pdfBusy}>
                <FileText size={15} />
              </OrdersIconButton>
              <OrdersIconButton
                label={to("orders.whatsapp")}
                onClick={onWhatsApp}
                busy={whatsappBusy}
                tone="emerald"
              >
                <WhatsAppIcon size={15} />
              </OrdersIconButton>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors active:scale-95"
                aria-label={to("orders.close")}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-3 md:p-4 space-y-3 md:space-y-4">
            {/* Trip details (read-only — existing Trip Entry data) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {to("orders.trip_details")}
                </h3>
              </div>
              <div className="px-4 py-3">
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                  {details.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-400">{label}</dt>
                      <dd className="text-sm font-semibold text-slate-800 truncate" title={value}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {/* Shop delivery report — combines the original order with the
                ACTUAL Step 4 deliveries (authoritative). */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {to("orders.shop_delivery_details")}
                  {notDeliveredCount > 0 && (
                    <span className="ml-2 font-semibold text-rose-500 normal-case">
                      {to("orders.status_not_delivered")}: {notDeliveredCount}
                    </span>
                  )}
                </h3>
                <div className="ml-auto flex items-center gap-2.5 flex-wrap">
                  <OrdersSearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder={to("orders.search_report")}
                    ariaLabel={to("orders.search_report")}
                    className="w-full sm:w-56"
                  />
                  <OrdersDropdown
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as ReportStatusFilter)}
                    options={statusOptions}
                    ariaLabel={to("orders.filter_status")}
                    widthClass="w-40"
                  />
                </div>
              </div>
              <div className={`${opsTableCardClass} overflow-x-auto`}>
                <table className="w-full min-w-[1620px] text-xs md:text-sm">
                  <thead>
                    <tr className={opsTableHeadRowClass}>
                      <th className={`${opsTableThClass} w-14`}>{to("orders.col_sno")}</th>
                      <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                      <th className={opsTableThClass}>{to("orders.col_village")}</th>
                      <th className={`${opsTableThClass} w-32`}>{to("orders.shop_mobile")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.ordered_birds")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.ordered_boxes")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.delivered_birds")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.delivered_boxes")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.delivered_weight")}</th>
                      <th className={`${opsTableThClass} w-40`}>{to("orders.delivery_time")}</th>
                      <th className={`${opsTableThClass} w-20 text-right`}>{to("orders.col_difference")}</th>
                      <th className={`${opsTableThClass} w-40`}>{to("orders.col_delivery_status")}</th>
                      {/* Shop-level capture: the order is on this row, the
                          delivery is entered here (partial allowed). */}
                      <th className={`${opsTableThClass} w-64`}>{to("orders.record_delivery")}</th>
                    </tr>
                  </thead>
                  <tbody className={opsTableDivideClass}>
                    {pageRows.length === 0 && (
                      <tr>
                        <td className={opsTableTdClass} colSpan={13}>
                          <span className="text-slate-400 text-sm py-4 block text-center">
                            {query || statusFilter !== "all"
                              ? to("orders.no_results")
                              : to("orders.no_saved_collection")}
                          </span>
                        </td>
                      </tr>
                    )}
                    {pageRows.map((row, index) => {
                      // Difference is only meaningful once a Step 4 capture
                      // exists (part / delivered / delivered-with-diff rows).
                      const showDiff =
                        row.status === "delivered" ||
                        row.status === "part_delivered" ||
                        row.status === "delivered_with_diff";
                      const remaining = shopRemainingBoxes(row);
                      return (
                        <tr key={row.shopId} className="align-middle transition-colors">
                          <td className={opsTableTdClass}>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold bg-emerald-50 text-emerald-700">
                              {startIndex + index + 1}
                            </span>
                          </td>
                          <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                            {row.shopName || "—"}
                          </td>
                          <td className={opsTableTdClass}>{row.village || "—"}</td>
                          <td className={`${opsTableTdClass} text-slate-600 whitespace-nowrap`}>
                            {row.mobile || "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-semibold`}>
                            {row.orderedBirds > 0 ? formatCount(row.orderedBirds) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-bold text-emerald-800`}>
                            {row.orderedBoxes > 0 ? formatCount(row.orderedBoxes) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-semibold`}>
                            {row.deliveredBirds > 0 ? formatCount(row.deliveredBirds) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-semibold`}>
                            {row.deliveredBoxes > 0 ? formatCount(row.deliveredBoxes) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-semibold`}>
                            {row.deliveredWeight > 0 ? row.deliveredWeight.toFixed(2) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-slate-500 whitespace-nowrap`}>
                            {formatDeliveredAtLabel(row.deliveredAt)}
                          </td>
                          <td className={`${opsTableTdClass} text-right`}>
                            <DiffCell value={row.boxDifference} show={showDiff} />
                          </td>
                          <td className={opsTableTdClass}>
                            <DeliveryStatusCell row={row} to={to} />
                          </td>
                          <td className={opsTableTdClass}>
                            {canDeliver && !row.additional ? (
                              <ShopDeliveryCapture
                                row={row}
                                remaining={remaining}
                                busy={busyShopId === row.shopId}
                                value={qty[row.shopId] ?? ""}
                                onValue={(v) =>
                                  setQty((prev) => ({ ...prev, [row.shopId]: v }))
                                }
                                onSubmit={() => void handleDeliver(row)}
                                to={to}
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Global pagination (existing component) */}
              {listedRows.length > PAGE_SIZE && (
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <TripPagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}

              {/* Totals — compact table summary BELOW the report (not KPI
                  cards). Sums ALL matched rows (listed + unlisted); ordered
                  and delivered are summed separately and never mixed. */}
              {listedRows.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                  <table className="w-full max-w-xl text-xs md:text-sm">
                    <thead>
                      <tr className={opsTableHeadRowClass}>
                        <th className={opsTableThClass} />
                        <th className={`${opsTableThClass} text-right`}>{to("orders.total_ordered")}</th>
                        <th className={`${opsTableThClass} text-right`}>{to("orders.total_delivered")}</th>
                        <th className={`${opsTableThClass} text-right`}>{to("orders.pending_boxes")}</th>
                        <th className={`${opsTableThClass} text-right`}>{to("orders.col_difference")}</th>
                      </tr>
                    </thead>
                    <tbody className={opsTableDivideClass}>
                      <tr className="align-middle">
                        <td className={`${opsTableTdClass} font-semibold text-slate-600`}>{to("orders.word_boxes")}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>{formatCount(totals.orderedBoxes)}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>{formatCount(totals.deliveredBoxes)}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>
                          {/* PART DELIVERY: 25 ordered, 10 in → 15 box pending */}
                          {totals.orderedBoxes - totals.deliveredBoxes > 0 ? (
                            <b className="text-amber-600">{formatCount(totals.orderedBoxes - totals.deliveredBoxes)}</b>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className={opsTableTdClass}>
                          <DiffCell value={totals.deliveredBoxes - totals.orderedBoxes} show />
                        </td>
                      </tr>
                      <tr className="align-middle">
                        <td className={`${opsTableTdClass} font-semibold text-slate-600`}>{to("orders.word_birds")}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>{formatCount(totals.orderedBirds)}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>{formatCount(totals.deliveredBirds)}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>
                          {totals.orderedBirds - totals.deliveredBirds > 0 ? (
                            <b className="text-amber-600">{formatCount(totals.orderedBirds - totals.deliveredBirds)}</b>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className={opsTableTdClass}>
                          <DiffCell value={totals.deliveredBirds - totals.orderedBirds} show />
                        </td>
                      </tr>
                      <tr className="align-middle">
                        <td className={`${opsTableTdClass} font-semibold text-slate-600`}>{to("orders.weight_kg")}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>{totals.orderedWeight.toFixed(2)}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>{totals.deliveredWeight.toFixed(2)}</td>
                        <td className={`${opsTableTdClass} text-right font-semibold`}>
                          {totals.orderedWeight - totals.deliveredWeight > 0 ? (
                            <b className="text-amber-600">{(totals.orderedWeight - totals.deliveredWeight).toFixed(2)}</b>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className={opsTableTdClass}>
                          <WeightDiffCell value={totals.deliveredWeight - totals.orderedWeight} show />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── NOT LISTED SHOP DELIVERIES — separate section, always
                visible (never mixed into / hidden inside the matched-shop
                table above). Subtle warning styling; short by definition,
                so no separate pagination. ── */}
            {unlistedRows.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-300/70 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    {to("orders.not_listed_deliveries")}
                  </h3>
                  <span className="text-[11px] font-semibold text-amber-700/80">
                    {to("orders.not_listed_note")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className={opsTableHeadRowClass}>
                        <th className={`${opsTableThClass} w-14`}>{to("orders.col_sno")}</th>
                        <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                        <th className={opsTableThClass}>{to("orders.col_village")}</th>
                        <th className={`${opsTableThClass} w-32`}>{to("orders.shop_mobile")}</th>
                        <th className={`${opsTableThClass} w-32 text-right`}>{to("orders.delivered_birds")}</th>
                        <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.col_boxes")}</th>
                        <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.delivered_weight")}</th>
                        <th className={`${opsTableThClass} w-44`}>{to("orders.col_delivered_at")}</th>
                      </tr>
                    </thead>
                    <tbody className={opsTableDivideClass}>
                      {unlistedRows.map((row, uIndex) => (
                        <tr key={row.shopId} className="align-middle bg-amber-50/40">
                          <td className={opsTableTdClass}>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-[12px] font-bold text-amber-700">
                              {uIndex + 1}
                            </span>
                          </td>
                          <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                            <span className="inline-flex items-center gap-2 flex-wrap">
                              {row.shopName || "—"}
                              <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">
                                {to("orders.added_during_delivery")}
                              </span>
                            </span>
                          </td>
                          <td className={opsTableTdClass}>{row.village || "—"}</td>
                          <td className={`${opsTableTdClass} text-slate-600 whitespace-nowrap`}>
                            {row.mobile || "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-semibold`}>
                            {row.deliveredBirds > 0 ? formatCount(row.deliveredBirds) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-bold text-emerald-800`}>
                            {row.deliveredBoxes > 0 ? formatCount(row.deliveredBoxes) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-semibold`}>
                            {row.deliveredWeight > 0 ? row.deliveredWeight.toFixed(2) : "—"}
                          </td>
                          <td className={`${opsTableTdClass} text-slate-500`}>
                            {formatDeliveredAtLabel(row.deliveredAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Check PDF popup — verify the report, then download / send, or go
          back and correct an entry. */}
      {pdfOpen && (
        <OrdersPdfPreview
          orderTrip={orderTrip}
          breakdown={breakdown}
          supervisorMobile={supervisorMobile}
          ordersTranslate={to}
          onWhatsApp={onWhatsApp}
          onSaveProgress={onSaveProgress}
          onSubmitTrip={onSubmitTrip}
          onDownload={(res) => {
            const anchor = document.createElement("a");
            anchor.href = res.url;
            anchor.download = res.fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
          }}
          onCorrect={() => setPdfOpen(false)}
          onClose={() => setPdfOpen(false)}
        />
      )}
    </div>
  );
}

export default React.memo(OrdersDeliveryDetailView);
