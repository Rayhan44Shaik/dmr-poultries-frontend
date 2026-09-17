// src/modules/orders/components/OrdersDeliveryDetailView.tsx
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
import { Check, FileText, ShieldCheck, Truck, X } from "lucide-react";
import { formatVehicleNumber } from "../../../utils/format";
import AppShellModal from "../../../ui/AppShellModal";
import { ViewLanguageToggle } from "../../../ui/ViewLanguageToggle";
import { ActionTooltip } from "../../../ui/ActionTooltip";
import { ScopedI18nProvider, useI18n } from "../../../i18n";
import { uiActionIconMotionClass } from "../../../shared/ui/uiTokens";
import {
  opsTableCardClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
} from "../../../shared/ui/operationsStyles";
import TripPagination from "../../operations/vehicle-trips/components/TripPagination";
import { shouldShowPagination } from "../../../shared/ui/paginationStyles";
import {
  buildDeliveryReportSummary,
  buildShopBreakdown,
  filterShopBreakdown,
  formatCount,
  formatDeliveredAtLabel,
  pageRange,
  rowsInSequence,
  shopDeliveryStatusI18nKey,
  type ShopDeliveryBreakdown,
} from "../utils/ordersUtils";
import {
  shopMobileOf,
  shopNumberOf,
  villageOf,
  type OrdersWhatsAppResult,
  type ShopDirectory,
} from "../services/ordersService";
import { useOrdersI18n, type OrdersT } from "../i18n/ordersI18n";
import type { OrdersTrip } from "../types";
import OrdersPdfPreview from "./OrdersPdfPreview";
import {
  OrdersDropdown,
  OrdersIconButton,
  OrdersSearchInput,
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
  onRecordDelivery: (
    shop: ShopDeliveryBreakdown,
    boxes: number,
  ) => Promise<void>;
  /** Save Progress from the check popup — error message, or null. */
  onSaveProgress: () => Promise<string | null>;
  /** Submit the delivery trip from the check popup — error message, or null. */
  onSubmitTrip: () => Promise<string | null>;
};

type ReportSortKey =
  "time_first" | "time_last" | "sequence" | "shop_az" | "status" | "boxes_desc";

const STATUS_RANK: Record<ShopDeliveryBreakdown["status"], number> = {
  delivered: 0,
  delivered_with_diff: 1,
  part_delivered: 2,
  not_listed: 3,
  not_delivered: 4,
  ordered: 5,
} as Record<ShopDeliveryBreakdown["status"], number>;

function deliveredMs(row: ShopDeliveryBreakdown): number {
  if (!row.deliveredAt) return Number.NaN;
  const t = new Date(row.deliveredAt).getTime();
  return Number.isNaN(t) ? Number.NaN : t;
}

function bySequence(a: ShopDeliveryBreakdown, b: ShopDeliveryBreakdown) {
  return (a.serialNo || 0) - (b.serialNo || 0);
}

/** Stable sort of the report rows; undelivered rows always sink to the end
 *  of a time sort in their original sequence. */
function sortReportRows(
  rows: ShopDeliveryBreakdown[],
  key: ReportSortKey,
): ShopDeliveryBreakdown[] {
  const list = rows.map((row, i) => ({ row, i }));
  const cmp = (
    a: { row: ShopDeliveryBreakdown; i: number },
    b: { row: ShopDeliveryBreakdown; i: number },
  ): number => {
    switch (key) {
      case "time_first":
      case "time_last": {
        const ta = deliveredMs(a.row);
        const tb = deliveredMs(b.row);
        const na = Number.isNaN(ta);
        const nb = Number.isNaN(tb);
        if (na && nb) return bySequence(a.row, b.row) || a.i - b.i;
        if (na) return 1;
        if (nb) return -1;
        return (key === "time_first" ? ta - tb : tb - ta) || a.i - b.i;
      }
      case "sequence":
        return bySequence(a.row, b.row) || a.i - b.i;
      case "shop_az":
        return (
          (a.row.shopName || "").localeCompare(b.row.shopName || "") ||
          a.i - b.i
        );
      case "status":
        return (
          (STATUS_RANK[a.row.status] ?? 9) - (STATUS_RANK[b.row.status] ?? 9) ||
          bySequence(a.row, b.row) ||
          a.i - b.i
        );
      case "boxes_desc":
        return b.row.deliveredBoxes - a.row.deliveredBoxes || a.i - b.i;
      default:
        return a.i - b.i;
    }
  };
  return list.sort(cmp).map((x) => x.row);
}

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
  if (value === 0)
    return <span className="font-semibold text-slate-400">0</span>;
  return (
    <span
      className={`font-bold ${value < 0 ? "text-rose-600" : "text-emerald-600"}`}
    >
      {value < 0 ? "−" : "+"}
      {Math.abs(value)}
    </span>
  );
}

/** Weight difference cell (two decimals). */
function WeightDiffCell({ value, show }: { value: number; show: boolean }) {
  if (!show) return <span className="text-slate-300">—</span>;
  const rounded = Number(value.toFixed(2));
  if (rounded === 0)
    return <span className="font-semibold text-slate-400">0.00</span>;
  return (
    <span
      className={`font-bold ${rounded < 0 ? "text-rose-600" : "text-emerald-600"}`}
    >
      {rounded < 0 ? "−" : "+"}
      {Math.abs(rounded).toFixed(2)}
    </span>
  );
}

/** Report table geometry — same anatomy as the Trip List table. */
const reportThClass =
  "px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap";
const reportTdClass =
  "px-4 py-3.5 text-[13px] text-slate-700 align-middle border-b border-slate-100";

/** Bold tabular count; keyed on the value so a change pops in. */
function CountCell({
  value,
  tone,
  zero = "—",
}: {
  value: number;
  tone: string;
  zero?: string;
}) {
  if (!(value > 0)) {
    return <span className="text-slate-300 tabular-nums">{zero}</span>;
  }
  return (
    <span
      key={value}
      className={`inline-block text-[14px] font-extrabold tabular-nums animate-pop-in ${tone}`}
    >
      {formatCount(value)}
    </span>
  );
}

const statusPillBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-transform duration-200 animate-pop-in";

/** Delivery Status cell for the report — animated pill with a state dot. */
function DeliveryStatusCell({
  row,
  to,
}: {
  row: ShopDeliveryBreakdown;
  to: OrdersT;
}) {
  const label = to(shopDeliveryStatusI18nKey(row.status));
  switch (row.status) {
    case "delivered":
    case "delivered_with_diff":
      return (
        <span
          key={row.status}
          className={`${statusPillBase} border-emerald-200 bg-emerald-50 text-emerald-700`}
        >
          <Check size={11} strokeWidth={3} />
          {label}
        </span>
      );
    case "part_delivered":
      return (
        <span
          key={row.status}
          className={`${statusPillBase} border-amber-300 bg-amber-50 text-amber-700`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          {label}
        </span>
      );
    case "not_listed":
      return (
        <span
          key={row.status}
          className={`${statusPillBase} border-orange-200 bg-orange-50 text-orange-700`}
        >
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          {label}
        </span>
      );
    default:
      return (
        <span
          key={row.status}
          className={`${statusPillBase} border-slate-200 bg-slate-50 text-slate-600`}
        >
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          {label}
        </span>
      );
  }
}

function OrdersDeliveryDetailView({
  orderTrip,
  shopDirectory,
  supervisorMobile,
  pdfBusy,
  whatsappBusy: _whatsappBusy,
  onClose,
  onWhatsApp,
  onSaveProgress,
  onSubmitTrip,
}: Props) {
  const { to, language } = useOrdersI18n();
  const { toggleLanguage } = useI18n();
  const { trip, progress, originalShopIds } = orderTrip;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("all");
  const [sortKey, setSortKey] = useState<ReportSortKey>("time_first");
  // "Check PDF" popup (preview -> download / send / correct).
  const [pdfOpen, setPdfOpen] = useState(false);

  const breakdown = useMemo(
    () =>
      buildShopBreakdown(
        rowsInSequence(trip),
        originalShopIds,
        (shopId, shopName) => villageOf(shopId, shopName, shopDirectory),
        orderTrip.originalQuantities,
        (shopId) => shopMobileOf(shopId, shopDirectory),
        (shopId) => shopNumberOf(shopId, shopDirectory),
      ),
    [trip, originalShopIds, shopDirectory, orderTrip.originalQuantities],
  );

  const sortOptions = useMemo(
    () => [
      { value: "time_first", label: to("orders.sort_time_first") },
      { value: "time_last", label: to("orders.sort_time_last") },
      { value: "sequence", label: to("orders.sort_sequence") },
      { value: "shop_az", label: to("orders.sort_shop_az") },
      { value: "status", label: to("orders.sort_status") },
      { value: "boxes_desc", label: to("orders.sort_boxes_desc") },
    ],
    [to],
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "delivered", label: to("orders.status_delivered") },
      { value: "part_delivered", label: to("orders.status_part_delivered") },
      {
        value: "delivered_with_diff",
        label: to("orders.status_delivered_diff"),
      },
      { value: "not_delivered", label: to("orders.status_pending") },
      { value: "not_listed", label: to("orders.status_not_listed") },
    ],
    [to],
  );

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
          notDelivered: to("orders.status_pending"),
        },
        trip.tripNo,
        trip.vehicleNo ?? "",
      ),
    [breakdown, query, to, trip.tripNo, trip.vehicleNo],
  );

  // ── ONE table: listed shops (green) and NOT LISTED shops (orange) live
  //    together; the status filter narrows it and the sort orders it.
  //    Default sort: first delivery on top (undelivered rows sink to the
  //    bottom in their original sequence).
  const listedRows = useMemo(() => {
    const rows = searched.filter(
      (row) => statusFilter === "all" || row.status === statusFilter,
    );
    return sortReportRows(rows, sortKey);
  }, [searched, statusFilter, sortKey]);

  // ── Pagination (existing global component; 10 rows per page; resets to
  //    page 1 whenever the search / status filter changes) ─────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(listedRows.length / pageSize));
  const [lastKey, setLastKey] = useState(
    `${query}|${statusFilter}|${listedRows.length}`,
  );
  if (lastKey !== `${query}|${statusFilter}|${listedRows.length}`) {
    setLastKey(`${query}|${statusFilter}|${listedRows.length}`);
    if (page !== 1) setPage(1);
  }
  const safePage = Math.min(page, totalPages);
  const pageRows = listedRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const startIndex = listedRows.length === 0 ? 0 : (safePage - 1) * pageSize;

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
    for (const row of listedRows) {
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
  }, [listedRows]);

  const notListedCount = breakdown.filter(
    (b) => b.status === "not_listed",
  ).length;
  const notDeliveredCount = breakdown.filter(
    (b) => b.status === "not_delivered",
  ).length;
  const report = buildDeliveryReportSummary(progress, breakdown);
  const shopPage = pageRange(listedRows.length, safePage, pageSize);

  const status = progress?.status ?? "Assigned";
  const statusLabel =
    status === "In Progress"
      ? to("orders.status_in_progress")
      : status === "Completed"
        ? to("orders.status_completed")
        : to("orders.status_assigned");

  const details: Array<[string, string]> = [
    [to("orders.col_trip_no"), trip.tripNo || "—"],
    [to("orders.col_date"), trip.tripDate || "—"],
    [to("orders.col_vehicle_no"), trip.vehicleNo || "—"],
    [to("orders.supervisor"), trip.supervisorName || "—"],
    [to("orders.supervisor_mobile"), supervisorMobile || "—"],
    [to("orders.driver"), trip.driverName || "—"],
  ];

  const isCompleted = status === "Completed";

  return (
    <AppShellModal open onClose={onClose} panelClassName="bg-white">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white">
        {/* Header — the Trip View header, verbatim: emerald tile, trip number,
            status pill, language toggle and the round close. */}
        <div className="rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-400/20">
                <Truck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold tracking-tight text-slate-800 md:text-xl">
                    {trip.tripNo || to("orders.pdf_report_title")}
                  </h2>
                  <span className="hidden items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 sm:inline-flex">
                    {to("orders.pdf_report_title")} •{" "}
                    {language === "te" ? "తెలుగు" : "EN"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {isCompleted ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      <ShieldCheck size={11} /> {statusLabel}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-100 bg-amber-50/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                      {statusLabel}
                    </span>
                  )}
                  {notListedCount > 0 && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      {to("orders.additional_count", { n: notListedCount })}
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-400">
                    {trip.vehicleNo ? formatVehicleNumber(trip.vehicleNo) : ""}
                    {trip.supervisorName ? ` · ${trip.supervisorName}` : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
              {/* Check the report in a popup first — it holds the download
                  and the send, so what you verify is what goes out. */}
              <OrdersIconButton
                label={to("orders.pdf_check_title")}
                onClick={() => setPdfOpen(true)}
                busy={pdfBusy}
              >
                <FileText size={15} />
              </OrdersIconButton>
              <ViewLanguageToggle
                language={language}
                onToggle={toggleLanguage}
                tone="emerald"
                labelMode="target"
                ariaLabel={to("ops.trip.popup_language_toggle")}
                tooltip={
                  <ActionTooltip
                    label={to("ops.trip.popup_language_tooltip")}
                    side="bottom"
                  />
                }
              />
              <button
                type="button"
                onClick={onClose}
                className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
                aria-label={to("ops.trip.close_view")}
              >
                <span
                  className={`inline-flex ${uiActionIconMotionClass.close}`}
                >
                  <X size={16} />
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100">
          <div className="p-3 md:p-4 space-y-3 md:space-y-4">
            {orderTrip.assignmentIncomplete && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-semibold text-orange-800">
                {to("orders.assignment_incomplete_warning")}
              </div>
            )}

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
                      <dt className="text-[11px] font-semibold text-slate-400">
                        {label}
                      </dt>
                      <dd
                        className="text-sm font-semibold text-slate-800 truncate"
                        title={value}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {to("orders.delivery_summary")}
                </h3>
              </div>
              <div className="px-4 py-3">
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                  {(
                    [
                      [
                        to("orders.col_delivered"),
                        to("orders.delivered_of", {
                          x: report.deliveredShops,
                          y: report.totalShops,
                        }),
                      ],
                      [
                        to("orders.collected_boxes"),
                        formatCount(report.collectedBoxes),
                      ],
                      [
                        to("orders.col_assigned_boxes"),
                        formatCount(report.assignedBoxes),
                      ],
                      [
                        to("orders.delivered_boxes"),
                        formatCount(report.deliveredBoxes),
                      ],
                      [
                        to("orders.pending_boxes"),
                        formatCount(report.pendingBoxes),
                      ],
                      [
                        to("orders.delivered_birds"),
                        formatCount(report.deliveredBirds),
                      ],
                      [
                        to("orders.delivered_weight"),
                        report.deliveredWeight.toFixed(2),
                      ],
                      [
                        to("orders.col_pending"),
                        formatCount(report.pendingShops),
                      ],
                      [
                        to("orders.status_part_delivered"),
                        formatCount(report.partDeliveredShops),
                      ],
                    ] as Array<[string, string]>
                  ).map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-400">
                        {label}
                      </dt>
                      <dd className="text-sm font-semibold text-slate-800">
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
                    <span className="ml-2 font-semibold text-amber-600 normal-case">
                      {to("orders.status_pending")}: {notDeliveredCount}
                    </span>
                  )}
                </h3>
                <span className="inline-flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {to("orders.legend_listed")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                    {to("orders.legend_not_listed")}
                    {notListedCount > 0 ? ` (${notListedCount})` : ""}
                  </span>
                </span>
                <div className="ml-auto flex items-center gap-2.5 flex-wrap">
                  <OrdersDropdown
                    value={sortKey}
                    onChange={(v) => setSortKey(v as ReportSortKey)}
                    options={sortOptions}
                    ariaLabel={to("orders.sort")}
                    widthClass="w-56"
                  />
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
                <table className="w-full min-w-[72rem] table-fixed text-xs md:text-sm">
                  <colgroup>
                    <col className="w-[3.5rem]" />
                    <col className="w-[5.5rem]" />
                    <col className="w-[15rem]" />
                    <col className="w-[9rem]" />
                    <col className="w-[6.25rem]" />
                    <col className="w-[6.25rem]" />
                    <col className="w-[6.25rem]" />
                    <col className="w-[6.5rem]" />
                    <col className="w-[6.25rem]" />
                    <col className="w-[6.75rem]" />
                    <col className="w-[11rem]" />
                    <col className="w-[10rem]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                      <th className={reportThClass}>{to("orders.col_sno")}</th>
                      <th className={reportThClass}>
                        {to("orders.col_shop_no")}
                      </th>
                      <th className={reportThClass}>
                        {to("orders.col_shop_name")}
                      </th>
                      <th className={reportThClass}>
                        {to("orders.col_village")}
                      </th>
                      <th
                        className={`${reportThClass} text-right`}
                        title={to("orders.collected_boxes")}
                      >
                        {to("orders.th_coll_boxes")}
                      </th>
                      <th
                        className={`${reportThClass} text-right`}
                        title={to("orders.col_assigned_boxes")}
                      >
                        {to("orders.th_ass_boxes")}
                      </th>
                      <th
                        className={`${reportThClass} text-right`}
                        title={to("orders.delivered_boxes")}
                      >
                        {to("orders.th_del_boxes")}
                      </th>
                      <th
                        className={`${reportThClass} text-right`}
                        title={to("orders.pending_boxes")}
                      >
                        {to("orders.th_pend_boxes")}
                      </th>
                      <th
                        className={`${reportThClass} text-right`}
                        title={to("orders.delivered_birds")}
                      >
                        {to("orders.th_del_birds")}
                      </th>
                      <th
                        className={`${reportThClass} text-right`}
                        title={to("orders.delivered_weight")}
                      >
                        {to("orders.th_del_wt")}
                      </th>
                      <th
                        className={reportThClass}
                        title={to("orders.delivery_time")}
                      >
                        {to("orders.th_time")}
                      </th>
                      <th className={reportThClass}>
                        {to("orders.col_delivery_status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={opsTableDivideClass}>
                    {pageRows.length === 0 && (
                      <tr>
                        <td className={reportTdClass} colSpan={12}>
                          <span className="text-slate-400 text-sm py-4 block text-center">
                            {query || statusFilter !== "all"
                              ? to("orders.no_results")
                              : to("orders.no_saved_collection")}
                          </span>
                        </td>
                      </tr>
                    )}
                    {pageRows.map((row, index) => {
                      const unlisted = row.status === "not_listed";
                      const done =
                        row.status === "delivered" ||
                        row.status === "delivered_with_diff";
                      const rowTone = unlisted
                        ? "bg-orange-50/50 border-l-4 border-l-orange-400 hover:bg-orange-50"
                        : done
                          ? "bg-emerald-50/30 border-l-4 border-l-emerald-400 hover:bg-emerald-50/50"
                          : "border-l-4 border-l-transparent hover:bg-slate-50/70";
                      return (
                        <tr
                          key={row.shopId}
                          className={`align-middle transition-colors animate-fade-in-up ${rowTone}`}
                          style={{
                            animationDelay: `${Math.min(index, 12) * 28}ms`,
                          }}
                        >
                          <td className={reportTdClass}>
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold ${
                                unlisted
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {unlisted
                                ? "+"
                                : row.serialNo || startIndex + index + 1}
                            </span>
                          </td>
                          <td
                            className={`${reportTdClass} font-semibold text-slate-700 tabular-nums`}
                          >
                            {row.shopNumber || "—"}
                          </td>
                          <td
                            className={`${reportTdClass} font-bold text-slate-900 truncate`}
                            title={row.shopName || undefined}
                          >
                            {row.shopName || "—"}
                          </td>
                          <td
                            className={`${reportTdClass} font-medium text-slate-700 truncate`}
                            title={row.village || undefined}
                          >
                            {row.village || "—"}
                          </td>
                          <td className={`${reportTdClass} text-right`}>
                            <CountCell
                              value={row.collectedBoxes}
                              tone="text-emerald-700"
                            />
                          </td>
                          <td className={`${reportTdClass} text-right`}>
                            <CountCell
                              value={row.assignedBoxes}
                              tone="text-slate-900"
                            />
                          </td>
                          <td className={`${reportTdClass} text-right`}>
                            <CountCell
                              value={row.deliveredBoxes}
                              tone="text-teal-700"
                            />
                          </td>
                          <td className={`${reportTdClass} text-right`}>
                            <CountCell
                              value={row.pendingBoxes}
                              tone="text-amber-600"
                              zero="0"
                            />
                          </td>
                          <td className={`${reportTdClass} text-right`}>
                            <CountCell
                              value={row.deliveredBirds}
                              tone="text-blue-700"
                            />
                          </td>
                          <td
                            className={`${reportTdClass} text-right font-bold text-slate-900 tabular-nums`}
                          >
                            {row.deliveredWeight > 0
                              ? row.deliveredWeight.toFixed(2)
                              : "—"}
                          </td>
                          <td
                            className={`${reportTdClass} whitespace-nowrap text-[12px] font-semibold text-slate-600 tabular-nums`}
                          >
                            {formatDeliveredAtLabel(row.deliveredAt)}
                          </td>
                          <td className={reportTdClass}>
                            <DeliveryStatusCell row={row} to={to} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {listedRows.length > 0 && (
                <div className="w-full flex items-center justify-between flex-wrap gap-1.5 px-4 py-3 bg-white border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                    {to("orders.showing_range", {
                      from: shopPage.from,
                      to: shopPage.to,
                      total: listedRows.length,
                    })}
                  </span>
                  {shouldShowPagination(listedRows.length) ? (
                    <TripPagination
                      currentPage={safePage}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      hidePageInfo
                      pageSize={pageSize}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    />
                  ) : null}
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
                        <th className={`${opsTableThClass} text-right`}>
                          {to("orders.total_ordered")}
                        </th>
                        <th className={`${opsTableThClass} text-right`}>
                          {to("orders.total_delivered")}
                        </th>
                        <th className={`${opsTableThClass} text-right`}>
                          {to("orders.pending_boxes")}
                        </th>
                        <th className={`${opsTableThClass} text-right`}>
                          {to("orders.col_difference")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className={opsTableDivideClass}>
                      <tr className="align-middle">
                        <td
                          className={`${opsTableTdClass} font-semibold text-slate-600`}
                        >
                          {to("orders.word_boxes")}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {formatCount(totals.orderedBoxes)}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {formatCount(totals.deliveredBoxes)}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {/* PART DELIVERY: 25 ordered, 10 in → 15 box pending */}
                          {totals.orderedBoxes - totals.deliveredBoxes > 0 ? (
                            <b className="text-amber-600">
                              {formatCount(
                                totals.orderedBoxes - totals.deliveredBoxes,
                              )}
                            </b>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className={opsTableTdClass}>
                          <DiffCell
                            value={totals.deliveredBoxes - totals.orderedBoxes}
                            show
                          />
                        </td>
                      </tr>
                      <tr className="align-middle">
                        <td
                          className={`${opsTableTdClass} font-semibold text-slate-600`}
                        >
                          {to("orders.word_birds")}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {formatCount(totals.orderedBirds)}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {formatCount(totals.deliveredBirds)}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {totals.orderedBirds - totals.deliveredBirds > 0 ? (
                            <b className="text-amber-600">
                              {formatCount(
                                totals.orderedBirds - totals.deliveredBirds,
                              )}
                            </b>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className={opsTableTdClass}>
                          <DiffCell
                            value={totals.deliveredBirds - totals.orderedBirds}
                            show
                          />
                        </td>
                      </tr>
                      <tr className="align-middle">
                        <td
                          className={`${opsTableTdClass} font-semibold text-slate-600`}
                        >
                          {to("orders.weight_kg")}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {totals.orderedWeight.toFixed(2)}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {totals.deliveredWeight.toFixed(2)}
                        </td>
                        <td
                          className={`${opsTableTdClass} text-right font-semibold`}
                        >
                          {totals.orderedWeight - totals.deliveredWeight > 0 ? (
                            <b className="text-amber-600">
                              {(
                                totals.orderedWeight - totals.deliveredWeight
                              ).toFixed(2)}
                            </b>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className={opsTableTdClass}>
                          <WeightDiffCell
                            value={
                              totals.deliveredWeight - totals.orderedWeight
                            }
                            show
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
    </AppShellModal>
  );
}

/** Scoped language: the toggle in the header changes only this view. */
function ScopedOrdersDeliveryDetailView(props: Props) {
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <OrdersDeliveryDetailView {...props} />
    </ScopedI18nProvider>
  );
}

export default React.memo(ScopedOrdersDeliveryDetailView);
