// src/modules/operations/orders/components/OrdersDeliveryTrackingTab.tsx
// TAB 3 — DELIVERY TRACKING.
//
// EXACTLY TWO TABLES (a trip never sits in both), membership from Trip Entry
// `status` (Pending vs Completed/Approved) — NEVER from shop-delivery %.
//   1. PENDING & IN PROGRESS — every open tracking trip (NOT day-scoped)
//   2. COMPLETED — lifecycle-completed trips inside a controlled
//      [From → To] range (default: last 7 operational days). The
//      backend keeps ALL history; the range picker reaches back to the
//      oldest completed trip. Future dates disabled.
//
// ONE compact table-level search (shop / shop no / village / trip / vehicle /
// supervisor / supervisor mobile / status) + delivery-status + difference
// filters + refresh. Filters stay when the View modal closes (local state).
// Each table paginates 10 rows (existing TripPagination) with "Showing X–Y of Z".

import React, { useMemo, useState } from "react";
import { CalendarRange, Eye, FileText, RefreshCw } from "lucide-react";
import {
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
} from "../../../../shared/ui/operationsStyles";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import TripPagination from "../../vehicle-trips/components/TripPagination";
import {
  deliveryProgressPct,
  formatCount,
  formatDayShort,
  pageRange,
  partitionTrackingTrips,
  trackingSearchHaystack,
} from "../ordersUtils";
import { addLocalDays } from "../ordersUtils";
import {
  paginate,
  shopNumberOf,
  supervisorMobileOf,
  villageOf,
  type ShopDirectory,
  type SupervisorDirectory,
} from "../ordersService";
import { useOrdersI18n } from "../i18n/ordersI18n";
import type { OrdersDeliveryState, OrdersTrip } from "../types";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  ORDERS_TABLE_FONT_CLASS,
  ordersTableZebraRow,
} from "../ordersTableStyles";
import {
  OrdersDropdown,
  OrdersEmptyState,
  OrdersIconButton,
  OrdersLabelButton,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
} from "./OrdersCommon";

const PAGE_SIZE = 10;

type Props = {
  trips: OrdersTrip[];
  loading: boolean;
  /** Operational today (drives the completed [From → To] default). */
  today: string;
  shopDirectory: ShopDirectory;
  supervisorDirectory: SupervisorDirectory;
  pdfBusyId: number | null;
  onPdf: (ot: OrdersTrip) => void;
  onView: (ot: OrdersTrip) => void;
  /** Table-level refresh — page refetches Orders data (soft toast after). */
  onRefresh: () => void;
  /** Refresh in flight (duplicate-call guard + busy icon). */
  refreshing: boolean;
};

/**
 * Per-table page slice (existing pattern). Resets to page 1 whenever the
 * resetKey (search + filters) or the result count changes.
 */
function usePaged<T>(
  items: T[],
  pageSize: number,
  resetKey: string
): [T[], number, number, (p: number) => void] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(`${resetKey}|${items.length}`);
  if (lastKey !== `${resetKey}|${items.length}`) {
    setLastKey(`${resetKey}|${items.length}`);
    if (page !== 1) setPage(1);
  }
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(
    () => paginate(items, safePage, pageSize),
    [items, safePage, pageSize]
  );
  return [slice, safePage, totalPages, setPage];
}

type DeliveryFilter = "all" | OrdersDeliveryState;
type DifferenceFilter = "all" | "none" | "short" | "extra" | "not_listed";

function deliveryMatches(ot: OrdersTrip, f: DeliveryFilter): boolean {
  if (f === "all") return true;
  return (ot.progress?.deliveryState ?? "pending") === f;
}

function differenceMatches(ot: OrdersTrip, f: DifferenceFilter): boolean {
  const p = ot.progress;
  if (!p) return f === "all";
  switch (f) {
    case "all":
      return true;
    case "none":
      return p.deliveredShops > 0 && p.deliveredBoxes === p.totalBoxes;
    case "short":
      return p.deliveredShops > 0 && p.deliveredBoxes < p.totalBoxes;
    case "extra":
      return p.deliveredShops > 0 && p.deliveredBoxes > p.totalBoxes;
    case "not_listed":
      return p.additionalShopCount > 0;
  }
}

function DeliveryStateBadge({ state }: { state: OrdersDeliveryState | undefined }) {
  const { to } = useOrdersI18n();
  const s = state ?? "pending";
  if (s === "complete") {
    return <OrdersStatusBadge status="Delivered" label={to("orders.status_delivered")} />;
  }
  if (s === "partial") {
    return <OrdersStatusBadge status="Part Delivered" label={to("orders.delivery_partial")} />;
  }
  if (s === "in_progress") {
    return <OrdersStatusBadge status="In Progress" label={to("orders.delivery_in_progress")} />;
  }
  return <OrdersStatusBadge status="Pending" label={to("orders.delivery_pending")} />;
}

function ActionButtons({
  ot,
  pdfBusyId,
  onPdf,
  onView,
}: {
  ot: OrdersTrip;
  pdfBusyId: number | null;
  onPdf: (ot: OrdersTrip) => void;
  onView: (ot: OrdersTrip) => void;
}) {
  const { to } = useOrdersI18n();
  const { trip } = ot;
  return (
    <div className="flex items-center gap-1.5">
      <OrdersLabelButton label={to("orders.view")} onClick={() => onView(ot)} tone="emerald">
        <Eye size={13} />
      </OrdersLabelButton>
      <OrdersIconButton
        label={to("orders.view_pdf")}
        onClick={() => onPdf(ot)}
        busy={pdfBusyId === trip.id}
      >
        <FileText size={14} />
      </OrdersIconButton>
    </div>
  );
}

/** Progress bar from ACTUAL Step 4 records: fully-delivered shops / total shops. */
function ProgressBar({ ot }: { ot: OrdersTrip }) {
  const { to } = useOrdersI18n();
  const p = ot.progress;
  if (!p) return <span className="text-slate-300 text-xs">—</span>;
  const pct = deliveryProgressPct(p);
  const bar =
    p.deliveryState === "complete"
      ? "bg-emerald-500"
      : p.deliveryState === "partial"
        ? "bg-amber-400"
        : "bg-sky-400";
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
        <span>{to("orders.delivered_of", { x: p.deliveredShops, y: p.totalShops })}</span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionTitle({ label, note }: { label: string; note?: string }) {
  return (
    <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{label}</h3>
      {note ? <span className="text-[11px] font-semibold text-slate-400">{note}</span> : null}
    </div>
  );
}

function ShowingLabel({ total, page }: { total: number; page: number }) {
  const { to } = useOrdersI18n();
  const { from, to: end } = pageRange(total, page, PAGE_SIZE);
  return (
    <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
      {to("orders.showing_range", { from, to: end, total })}
    </span>
  );
}

/** ONE table with the unified tracking column set. */
function TrackingTable({
  trips,
  pageSlice,
  safePage,
  totalPages,
  onPageChange,
  supervisorOf,
  actionProps,
}: {
  trips: OrdersTrip[];
  pageSlice: OrdersTrip[];
  safePage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  supervisorOf: (ot: OrdersTrip) => string;
  actionProps: {
    pdfBusyId: number | null;
    onPdf: (ot: OrdersTrip) => void;
    onView: (ot: OrdersTrip) => void;
  };
}) {
  const { to } = useOrdersI18n();
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[1480px] ${ORDERS_TABLE_FONT_CLASS}`}>
        <thead>
          <tr className={opsTableHeadRowClass}>
            <th className={`${opsTableThClass} w-14`}>{to("orders.col_sno")}</th>
            <th className={opsTableThClass}>{to("orders.col_trip_no")}</th>
            <th className={`${opsTableThClass} w-24`}>{to("orders.col_date")}</th>
            <th className={opsTableThClass}>{to("orders.col_vehicle_no")}</th>
            <th className={opsTableThClass}>{to("orders.supervisor")}</th>
            <th className={opsTableThClass}>{to("orders.driver")}</th>
            <th className={`${opsTableThClass} w-32`}>{to("orders.col_total_shops")}</th>
            <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.total_boxes")}</th>
            <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.col_delivered_boxes")}</th>
            <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.delivered_birds")}</th>
            <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.delivered_weight")}</th>
            <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.pending_boxes")}</th>
            <th className={`${opsTableThClass} w-28`}>{to("orders.col_delivery_status")}</th>
            <th className={`${opsTableThClass} w-36`}>{to("orders.col_action")}</th>
          </tr>
        </thead>
        <tbody className={opsTableDivideClass}>
          {pageSlice.map((ot, index) => {
            const { trip, progress } = ot;
            const mobile = supervisorOf(ot);
            return (
              <tr key={trip.id} className={ordersTableZebraRow(index, "align-middle")}>
                <td className={opsTableTdClass}>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[12px] font-semibold text-slate-600">
                    {(safePage - 1) * PAGE_SIZE + index + 1}
                  </span>
                </td>
                <td className={`${opsTableTdClass} font-semibold text-emerald-700`}>
                  <span className="inline-flex flex-col leading-tight">
                    {trip.tripNo}
                    {ot.assignmentIncomplete && (
                      <span
                        className="mt-0.5 inline-flex w-fit items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700"
                        title={to("orders.assignment_incomplete_warning")}
                      >
                        {to("orders.assignment_incomplete")}
                      </span>
                    )}
                  </span>
                </td>
                <td className={`${opsTableTdClass} text-slate-500 whitespace-nowrap`}>
                  {formatDayShort(trip.tripDate)}
                </td>
                <td className={opsTableTdClass}>{trip.vehicleNo || "—"}</td>
                <td className={opsTableTdClass}>
                  <span className="inline-flex flex-col leading-tight">
                    <span>{trip.supervisorName || "—"}</span>
                    {mobile ? (
                      <span className="text-[10px] font-semibold text-slate-400">{mobile}</span>
                    ) : null}
                  </span>
                </td>
                <td className={opsTableTdClass}>{trip.driverName || "—"}</td>
                <td className={opsTableTdClass}>
                  <ProgressBar ot={ot} />
                </td>
                <td className={`${opsTableTdClass} text-right font-semibold text-emerald-800`}>
                  {progress ? formatCount(progress.totalBoxes) : "—"}
                </td>
                <td className={`${opsTableTdClass} text-right font-medium`}>
                  {progress ? formatCount(progress.deliveredBoxes) : "—"}
                </td>
                <td className={`${opsTableTdClass} text-right font-medium`}>
                  {progress && progress.deliveredBirds > 0 ? (
                    formatCount(progress.deliveredBirds)
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className={`${opsTableTdClass} text-right font-medium`}>
                  {progress && progress.deliveredWeight > 0 ? (
                    progress.deliveredWeight.toFixed(2)
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className={`${opsTableTdClass} text-right`}>
                  {progress ? (
                    progress.pendingBoxes > 0 ? (
                      <span className="inline-flex flex-col items-end leading-tight">
                        <span className="font-semibold text-amber-600">
                          {formatCount(progress.pendingBoxes)} {to("orders.word_boxes")}
                        </span>
                        {progress.pendingShops > 0 && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {progress.pendingShops} {to("orders.col_shops")}
                            {progress.partDeliveredShops > 0
                              ? ` · ${progress.partDeliveredShops} ${to("orders.status_part_delivered")}`
                              : ""}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className={opsTableTdClass}>
                  <DeliveryStateBadge state={progress?.deliveryState} />
                  {progress && progress.additionalShopCount > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-600"
                      title={to("orders.additional_legend")}
                    >
                      +{progress.additionalShopCount}
                    </span>
                  )}
                </td>
                <td className={opsTableTdClass}>
                  <ActionButtons ot={ot} {...actionProps} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {trips.length > 0 && (
        <div className="w-full flex items-center justify-between flex-wrap gap-1.5 px-4 py-3 bg-white border-t border-slate-100">
          <ShowingLabel total={trips.length} page={safePage} />
          {shouldShowPagination(trips.length) ? (
            <TripPagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              hidePageInfo
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function OrdersDeliveryTrackingTab({
  trips,
  loading,
  today,
  shopDirectory,
  supervisorDirectory,
  pdfBusyId,
  onPdf,
  onView,
  onRefresh,
  refreshing,
}: Props) {
  const { to } = useOrdersI18n();

  // Table membership = Trip Entry lifecycle, never shop-delivery %.
  const { pending: active, completed: completedAll } = useMemo(
    () => partitionTrackingTrips(trips),
    [trips]
  );

  // ── COMPLETED range: [From → To] (default = last 7 operational days).
  const [completedFrom, setCompletedFrom] = useState(() =>
    today ? addLocalDays(today, -6) : ""
  );
  const [completedTo, setCompletedTo] = useState(() => today);
  const oldestCompleted = useMemo(() => {
    let min = "";
    for (const t of completedAll) {
      if (t.trip.tripDate && (!min || t.trip.tripDate < min)) min = t.trip.tripDate;
    }
    return min || undefined;
  }, [completedAll]);
  const completed = useMemo(
    () =>
      !today
        ? completedAll
        : completedAll.filter(
            (t) =>
              t.trip.tripDate >= (completedFrom || addLocalDays(today, -6)) &&
              t.trip.tripDate <= (completedTo || today)
          ),
    [completedAll, completedFrom, completedTo, today]
  );

  const [query, setQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [differenceFilter, setDifferenceFilter] = useState<DifferenceFilter>("all");
  const q = query.trim().toLowerCase();

  const deliveryOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "pending", label: to("orders.delivery_pending") },
      { value: "in_progress", label: to("orders.delivery_in_progress") },
      { value: "partial", label: to("orders.delivery_partial") },
      { value: "complete", label: to("orders.status_delivered") },
    ],
    [to]
  );
  const differenceOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "none", label: to("orders.no_difference") },
      { value: "short", label: to("orders.short_delivery") },
      { value: "extra", label: to("orders.extra_delivery") },
      { value: "not_listed", label: to("orders.status_not_listed") },
    ],
    [to]
  );

  const haystackFor = (ot: OrdersTrip): string =>
    trackingSearchHaystack(ot, {
      supervisorMobile: supervisorMobileOf(ot.trip, supervisorDirectory),
      shopNumberOf: (shopId) => shopNumberOf(shopId, shopDirectory),
      villageOf: (shopId, shopName) => villageOf(shopId, shopName, shopDirectory),
    });

  const activeFiltered = useMemo(
    () =>
      active.filter(
        (ot) =>
          deliveryMatches(ot, deliveryFilter) &&
          differenceMatches(ot, differenceFilter) &&
          (!q || haystackFor(ot).includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, deliveryFilter, differenceFilter, q, to, shopDirectory, supervisorDirectory]
  );
  const completedFiltered = useMemo(
    () =>
      completed.filter(
        (ot) =>
          deliveryMatches(ot, deliveryFilter) &&
          differenceMatches(ot, differenceFilter) &&
          (!q || haystackFor(ot).includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completed, deliveryFilter, differenceFilter, q, to, shopDirectory, supervisorDirectory]
  );

  const scope = useMemo(() => {
    const t = {
      totalShops: 0,
      totalBirds: 0,
      totalBoxes: 0,
      totalWeight: 0,
      deliveredBirds: 0,
      deliveredBoxes: 0,
      deliveredWeight: 0,
    };
    for (const ot of [...activeFiltered, ...completedFiltered]) {
      const p = ot.progress;
      if (!p) continue;
      t.totalShops += p.totalShops;
      t.totalBirds += p.totalBirds;
      t.totalBoxes += p.totalBoxes;
      t.totalWeight += p.totalWeight;
      t.deliveredBirds += p.deliveredBirds;
      t.deliveredBoxes += p.deliveredBoxes;
      t.deliveredWeight += p.deliveredWeight;
    }
    t.totalWeight = Number(t.totalWeight.toFixed(2));
    t.deliveredWeight = Number(t.deliveredWeight.toFixed(2));
    return t;
  }, [activeFiltered, completedFiltered]);

  const filterKey = `${q}|${deliveryFilter}|${differenceFilter}|${completedFrom}|${completedTo}`;
  const [activePage, safeActivePage, activeTotalPages, setActivePage] = usePaged(
    activeFiltered,
    PAGE_SIZE,
    filterKey
  );
  const [completedPage, safeCompletedPage, completedTotalPages, setCompletedPage] =
    usePaged(completedFiltered, PAGE_SIZE, filterKey);

  if (loading) return <OrdersTableSkeleton rows={5} />;

  const actionProps = { pdfBusyId, onPdf, onView };
  const filtersActive = q !== "" || deliveryFilter !== "all" || differenceFilter !== "all";
  const supervisorOf = (ot: OrdersTrip) => supervisorMobileOf(ot.trip, supervisorDirectory);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-2.5 flex items-center gap-3 flex-wrap">
        <OrdersSearchInput
          value={query}
          onChange={setQuery}
          placeholder={to("orders.search_tracking")}
          ariaLabel={to("orders.search_tracking")}
          className="w-full sm:w-64"
        />
        <OrdersDropdown
          value={deliveryFilter}
          onChange={(v) => setDeliveryFilter(v as DeliveryFilter)}
          options={deliveryOptions}
          ariaLabel={to("orders.filter_delivery_status")}
          widthClass="w-40"
        />
        <OrdersDropdown
          value={differenceFilter}
          onChange={(v) => setDifferenceFilter(v as DifferenceFilter)}
          options={differenceOptions}
          ariaLabel={to("orders.filter_difference")}
          widthClass="w-40"
        />
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDeliveryFilter("all");
              setDifferenceFilter("all");
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
          >
            {to("orders.clear_filters")}
          </button>
        )}
        <OrdersIconButton
          className="ml-auto"
          label={`${to("orders.refresh")} — ${to("orders.refresh_tracking")}`}
          onClick={onRefresh}
          busy={refreshing}
        >
          <RefreshCw size={14} />
        </OrdersIconButton>
      </div>

      {/* ── TABLE 1 — PENDING & IN PROGRESS (all open trips, not day-scoped) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <SectionTitle
          label={to("orders.tracking_active_title")}
          note={to("orders.trips_count", { x: activeFiltered.length })}
        />
        {activeFiltered.length === 0 ? (
          <OrdersEmptyState
            compact
            title={
              filtersActive && active.length > 0
                ? to("orders.no_search_results")
                : to("orders.no_pending_deliveries")
            }
          />
        ) : (
          <TrackingTable
            trips={activeFiltered}
            pageSlice={activePage}
            safePage={safeActivePage}
            totalPages={activeTotalPages}
            onPageChange={setActivePage}
            supervisorOf={supervisorOf}
            actionProps={actionProps}
          />
        )}
      </div>

      {/* ── TABLE 2 — COMPLETED (lifecycle-completed trips) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {to("orders.tracking_completed_title")}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              <CalendarRange size={12} aria-hidden />
              {to("orders.from_date")}
            </span>
            <DatePicker
              value={completedFrom}
              onChange={(v) => {
                if (v && v <= (completedTo || today)) setCompletedFrom(v);
              }}
              minDate={oldestCompleted}
              maxDate={completedTo || today}
              placeholder="DD/MM/YYYY"
              hideThisWeek
              hideClear
              hideToday
              className="w-44"
              data-testid="orders-completed-from"
            />
            <span className="text-[11px] font-semibold text-slate-400" aria-hidden>
              →
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {to("orders.to_date")}
            </span>
            <DatePicker
              value={completedTo}
              onChange={(v) => {
                if (v && v >= (completedFrom || addLocalDays(today, -6))) setCompletedTo(v);
              }}
              minDate={completedFrom || addLocalDays(today, -6)}
              maxDate={today}
              placeholder="DD/MM/YYYY"
              hideThisWeek
              hideClear
              hideToday
              className="w-44"
              data-testid="orders-completed-to"
            />
            <span className="text-[11px] font-semibold text-slate-400">
              {to("orders.trips_count", { x: completed.length })}
            </span>
          </div>
        </div>
        {completedFiltered.length === 0 ? (
          <OrdersEmptyState
            compact
            title={
              filtersActive && completed.length > 0
                ? to("orders.no_search_results")
                : to("orders.no_completed_window")
            }
          />
        ) : (
          <TrackingTable
            trips={completedFiltered}
            pageSlice={completedPage}
            safePage={safeCompletedPage}
            totalPages={completedTotalPages}
            onPageChange={setCompletedPage}
            supervisorOf={supervisorOf}
            actionProps={actionProps}
          />
        )}
      </div>

      {activeFiltered.length + completedFiltered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-2.5 flex items-center gap-x-5 gap-y-1 flex-wrap text-xs font-semibold text-slate-600">
          {(
            [
              [to("orders.col_total_shops"), formatCount(scope.totalShops)],
              [to("orders.total_birds"), formatCount(scope.totalBirds)],
              [to("orders.total_boxes"), formatCount(scope.totalBoxes)],
              [to("orders.total_weight"), scope.totalWeight.toFixed(2)],
              [to("orders.delivered_birds"), formatCount(scope.deliveredBirds)],
              [to("orders.delivered_boxes"), formatCount(scope.deliveredBoxes)],
              [to("orders.delivered_weight"), scope.deliveredWeight.toFixed(2)],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <span key={label} className="whitespace-nowrap">
              {label}: <b className="text-slate-800">{value}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(OrdersDeliveryTrackingTab);
