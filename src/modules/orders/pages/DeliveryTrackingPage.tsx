// src/modules/orders/pages/DeliveryTrackingPage.tsx
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
import {
  ArrowUpDown,
  Bird,
  Box,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Hash,
  Hourglass,
  PackageCheck,
  Route,
  Scale,
  Search,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  User,
  UserCog,
} from "lucide-react";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
} from "../../../shared/ui/operationsStyles";

import {
  BrandRefreshButton,
  FilterResetButton,
  Pagination,
  countActiveFilters,
} from "../../../ui";
import MasterDropdown from "../../masters/components/MasterDropdown";
import {
  deliveryProgressPct,
  formatCount,
  formatDayShort,
  partitionTrackingTrips,
  trackingSearchHaystack,
} from "../utils/ordersUtils";
import { addLocalDays } from "../utils/ordersUtils";
import { formatVehicleNumber } from "../../../utils/format";
import {
  paginate,
  shopNumberOf,
  supervisorMobileOf,
  villageOf,
  type ShopDirectory,
  type SupervisorDirectory,
} from "../services/ordersService";
import { useOrdersI18n } from "../i18n/ordersI18n";
import type { OrdersDeliveryState, OrdersTrip } from "../types";
import { DatePicker } from "../../../components/common/DatePicker";
import {
  ORDERS_TABLE_FONT_CLASS,
  ordersTableZebraRow,
} from "../utils/ordersTableStyles";
import {
  OrdersIconButton,
  OrdersLabelButton,
  OrdersStatusBadge,
} from "../components/OrdersCommon";

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
  resetKey: string,
): [T[], number, number, (p: number) => void] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    if (page !== 1) setPage(1);
  }
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(
    () => paginate(items, safePage, pageSize),
    [items, safePage, pageSize],
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

function DeliveryStateBadge({
  state,
}: {
  state: OrdersDeliveryState | undefined;
}) {
  const { to } = useOrdersI18n();
  const s = state ?? "pending";
  if (s === "complete") {
    return (
      <OrdersStatusBadge
        status="Delivered"
        label={to("orders.status_delivered")}
      />
    );
  }
  if (s === "partial") {
    return (
      <OrdersStatusBadge
        status="Part Delivered"
        label={to("orders.delivery_partial")}
      />
    );
  }
  if (s === "in_progress") {
    return (
      <OrdersStatusBadge
        status="In Progress"
        label={to("orders.delivery_in_progress")}
      />
    );
  }
  return (
    <OrdersStatusBadge status="Pending" label={to("orders.delivery_pending")} />
  );
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
      <OrdersLabelButton
        label={to("orders.view")}
        onClick={() => onView(ot)}
        tone="emerald"
      >
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
    <div className="min-w-[6.875rem]">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
        <span>
          {to("orders.delivered_of", { x: p.deliveredShops, y: p.totalShops })}
        </span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Table heading — icon tile + title + count, the Collection / Assignment anatomy. */
function SectionTitle({
  label,
  note,
  tone,
  children,
}: {
  label: string;
  note?: string;
  tone: "amber" | "emerald";
  children?: React.ReactNode;
}) {
  const tile =
    tone === "amber"
      ? "border-amber-100 bg-amber-50 text-amber-600"
      : "border-emerald-100 bg-emerald-50 text-emerald-600";
  const bar = tone === "amber" ? "bg-amber-50/40" : "bg-emerald-50/40";
  const Icon = tone === "amber" ? Hourglass : CheckCircle2;
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3 ${bar}`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-inner ${tile}`}
      >
        <Icon size={20} aria-hidden />
      </span>
      <h3 className="text-base font-bold tracking-tight text-slate-800">
        {label}
      </h3>
      {note ? (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
          {note}
        </span>
      ) : null}
      {children ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Column head with the Trip List's coloured glyph. */
function Th({
  icon,
  label,
  className = "",
  align = "left",
}: {
  icon?: React.ReactNode;
  label: string;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const just =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "";
  return (
    <th className={`${opsTableThClass} ${className}`}>
      <span className={`inline-flex items-center gap-1.5 ${just}`}>
        {icon}
        <span>{label}</span>
      </span>
    </th>
  );
}

/** Spinner row shown INSIDE the table while its rows load / refresh. */
function TableLoadingRow({
  label,
  colSpan,
}: {
  label: string;
  colSpan: number;
}) {
  const { to } = useOrdersI18n();
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-400">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
            aria-hidden="true"
          />
          {to("orders.loading_records", { table: label })}
        </span>
      </td>
    </tr>
  );
}

/** ONE table with the unified tracking column set. */
function TrackingTable({
  trips,
  pageSlice,
  safePage,
  refreshing,
  loading = false,
  label,
  emptyTitle,
  onPageChange,
  pageSize,
  onPageSizeChange,
  supervisorOf,
  actionProps,
}: {
  trips: OrdersTrip[];
  pageSlice: OrdersTrip[];
  safePage: number;
  totalPages: number;
  refreshing: boolean;
  /** First load — the frame is drawn, rows say "Loading …". */
  loading?: boolean;
  /** Table name spoken by the loading row. */
  label: string;
  /** Empty-state copy when there are no rows to show. */
  emptyTitle: string;
  onPageChange: (p: number) => void;
  pageSize: number;
  onPageSizeChange?: (pageSize: number) => void;
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
      <table className={`w-full min-w-[92.5rem] ${ORDERS_TABLE_FONT_CLASS}`}>
        <thead>
          <tr className={opsTableHeadRowClass}>
            <Th className="w-14" label={to("orders.col_sno")} />
            <Th
              icon={<Hash size={14} className="shrink-0 text-slate-400" />}
              label={to("orders.col_trip_no")}
            />
            <Th
              className="w-24"
              icon={<Calendar size={14} className="shrink-0 text-blue-500" />}
              label={to("orders.col_date")}
            />
            <Th
              icon={<Truck size={14} className="shrink-0 text-indigo-500" />}
              label={to("orders.col_vehicle_no")}
            />
            <Th
              icon={<UserCog size={14} className="shrink-0 text-purple-500" />}
              label={to("orders.supervisor")}
            />
            <Th
              icon={<User size={14} className="shrink-0 text-emerald-500" />}
              label={to("orders.driver")}
            />
            <Th
              className="w-32"
              icon={
                <ShoppingBag size={14} className="shrink-0 text-cyan-500" />
              }
              label={to("orders.col_total_shops")}
            />
            <Th
              className="w-24"
              align="right"
              icon={<Box size={14} className="shrink-0 text-emerald-600" />}
              label={to("orders.total_boxes")}
            />
            <Th
              className="w-24"
              align="right"
              icon={
                <PackageCheck size={14} className="shrink-0 text-teal-500" />
              }
              label={to("orders.col_delivered_boxes")}
            />
            <Th
              className="w-24"
              align="right"
              icon={<Bird size={14} className="shrink-0 text-blue-500" />}
              label={to("orders.delivered_birds")}
            />
            <Th
              className="w-28"
              align="right"
              icon={<Scale size={14} className="shrink-0 text-orange-500" />}
              label={to("orders.delivered_weight")}
            />
            <Th
              className="w-24"
              align="right"
              icon={<Hourglass size={14} className="shrink-0 text-amber-500" />}
              label={to("orders.pending_boxes")}
            />
            <Th
              className="w-28"
              icon={
                <ClipboardCheck size={14} className="shrink-0 text-rose-500" />
              }
              label={to("orders.col_delivery_status")}
            />
            <Th
              className="w-36"
              icon={<Settings2 size={14} className="shrink-0 text-slate-400" />}
              label={to("orders.col_action")}
            />
          </tr>
        </thead>
        <tbody className={opsTableDivideClass}>
          {loading || refreshing ? (
            <TableLoadingRow label={label} colSpan={14} />
          ) : pageSlice.length === 0 ? (
            <tr>
              <td colSpan={14} className="px-4 py-10 text-center">
                <span className="text-[13px] font-medium text-slate-400">
                  {emptyTitle}
                </span>
              </td>
            </tr>
          ) : (
            pageSlice.map((ot, index) => {
              const { trip, progress } = ot;
              const mobile = supervisorOf(ot);
              return (
                <tr
                  key={trip.id}
                  className={ordersTableZebraRow(index, "align-middle")}
                >
                  <td className={opsTableTdClass}>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[12px] font-semibold text-slate-600">
                      {(safePage - 1) * pageSize + index + 1}
                    </span>
                  </td>
                  <td
                    className={`${opsTableTdClass} font-semibold text-emerald-700`}
                  >
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
                  <td
                    className={`${opsTableTdClass} text-slate-500 whitespace-nowrap`}
                  >
                    {formatDayShort(trip.tripDate)}
                  </td>
                  <td
                    className={`${opsTableTdClass} font-semibold tabular-nums text-slate-800 whitespace-nowrap`}
                  >
                    {trip.vehicleNo ? formatVehicleNumber(trip.vehicleNo) : "—"}
                  </td>
                  <td className={opsTableTdClass}>
                    <span className="inline-flex flex-col leading-tight">
                      <span>{trip.supervisorName || "—"}</span>
                      {mobile ? (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {mobile}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={opsTableTdClass}>{trip.driverName || "—"}</td>
                  <td className={opsTableTdClass}>
                    <ProgressBar ot={ot} />
                  </td>
                  <td
                    className={`${opsTableTdClass} text-right font-semibold text-emerald-800`}
                  >
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
                            {formatCount(progress.pendingBoxes)}{" "}
                            {to("orders.word_boxes")}
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
            })
          )}
        </tbody>
      </table>
      {trips.length > 0 && (
        <Pagination
          page={safePage}
          pageSize={pageSize}
          totalItems={trips.length}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          disabled={refreshing || loading}
        />
      )}
    </div>
  );
}

function DeliveryTrackingPage({
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
    [trips],
  );

  // ── COMPLETED range: [From → To] (default = last 7 operational days).
  const [completedFrom, setCompletedFrom] = useState(() =>
    today ? addLocalDays(today, -6) : "",
  );
  const [completedTo, setCompletedTo] = useState(() => today);
  const oldestCompleted = useMemo(() => {
    let min = "";
    for (const t of completedAll) {
      if (t.trip.tripDate && (!min || t.trip.tripDate < min))
        min = t.trip.tripDate;
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
              t.trip.tripDate <= (completedTo || today),
          ),
    [completedAll, completedFrom, completedTo, today],
  );

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("newest");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [differenceFilter, setDifferenceFilter] =
    useState<DifferenceFilter>("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const q = query.trim().toLowerCase();

  const deliveryOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "pending", label: to("orders.delivery_pending") },
      { value: "in_progress", label: to("orders.delivery_in_progress") },
      { value: "partial", label: to("orders.delivery_partial") },
      { value: "complete", label: to("orders.status_delivered") },
    ],
    [to],
  );
  const differenceOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "none", label: to("orders.no_difference") },
      { value: "short", label: to("orders.short_delivery") },
      { value: "extra", label: to("orders.extra_delivery") },
      { value: "not_listed", label: to("orders.status_not_listed") },
    ],
    [to],
  );

  const sortOptions = useMemo(
    () => [
      { value: "newest", label: to("orders.sort_newest") },
      { value: "oldest", label: to("orders.sort_oldest") },
      { value: "vehicle", label: to("orders.sort_vehicle_trip") },
    ],
    [to],
  );

  const haystackFor = (ot: OrdersTrip): string =>
    trackingSearchHaystack(ot, {
      supervisorMobile: supervisorMobileOf(ot.trip, supervisorDirectory),
      shopNumberOf: (shopId) => shopNumberOf(shopId, shopDirectory),
      villageOf: (shopId, shopName) =>
        villageOf(shopId, shopName, shopDirectory),
    });

  const activeFiltered = useMemo(
    () =>
      active
        .filter(
          (ot) =>
            deliveryMatches(ot, deliveryFilter) &&
            differenceMatches(ot, differenceFilter) &&
            (!q || haystackFor(ot).includes(q)),
        )
        .sort((a, b) =>
          sortMode === "oldest"
            ? a.trip.tripDate.localeCompare(b.trip.tripDate) ||
              a.trip.id - b.trip.id
            : sortMode === "vehicle"
              ? String(a.trip.vehicleNo).localeCompare(
                  String(b.trip.vehicleNo),
                ) || a.trip.id - b.trip.id
              : b.trip.tripDate.localeCompare(a.trip.tripDate) ||
                b.trip.id - a.trip.id,
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      active,
      sortMode,
      deliveryFilter,
      differenceFilter,
      q,
      to,
      shopDirectory,
      supervisorDirectory,
    ],
  );
  const completedFiltered = useMemo(
    () =>
      completed
        .filter(
          (ot) =>
            deliveryMatches(ot, deliveryFilter) &&
            differenceMatches(ot, differenceFilter) &&
            (!q || haystackFor(ot).includes(q)),
        )
        .sort((a, b) =>
          sortMode === "oldest"
            ? a.trip.tripDate.localeCompare(b.trip.tripDate) ||
              a.trip.id - b.trip.id
            : sortMode === "vehicle"
              ? String(a.trip.vehicleNo).localeCompare(
                  String(b.trip.vehicleNo),
                ) || a.trip.id - b.trip.id
              : b.trip.tripDate.localeCompare(a.trip.tripDate) ||
                b.trip.id - a.trip.id,
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      completed,
      sortMode,
      deliveryFilter,
      differenceFilter,
      q,
      to,
      shopDirectory,
      supervisorDirectory,
    ],
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

  const filterKey = `${q}|${sortMode}|${pageSize}|${deliveryFilter}|${differenceFilter}|${completedFrom}|${completedTo}`;
  const [activePage, safeActivePage, activeTotalPages, setActivePage] =
    usePaged(activeFiltered, pageSize, filterKey);
  const [
    completedPage,
    safeCompletedPage,
    completedTotalPages,
    setCompletedPage,
  ] = usePaged(completedFiltered, pageSize, filterKey);

  const actionProps = { pdfBusyId, onPdf, onView };
  const defaultFrom = today ? addLocalDays(today, -6) : "";
  const rangeChanged =
    Boolean(today) &&
    ((completedFrom || defaultFrom) !== defaultFrom ||
      (completedTo || today) !== today);
  const activeFilterCount = countActiveFilters(
    sortMode !== "newest",
    q !== "",
    deliveryFilter !== "all",
    differenceFilter !== "all",
    rangeChanged,
  );
  const resetFilters = () => {
    setQuery("");
    setSortMode("newest");
    setDeliveryFilter("all");
    setDifferenceFilter("all");
    setCompletedFrom(defaultFrom);
    setCompletedTo(today);
  };
  const supervisorOf = (ot: OrdersTrip) =>
    supervisorMobileOf(ot.trip, supervisorDirectory);

  return (
    <div className="space-y-4">
      {/* Filter card — the Trip List / Order Assignment anatomy: From · To ·
          Delivery Status · Difference on row 1; Sort · Search · Reset · Refresh
          on row 2. It never unmounts while the tables load. */}
      <section
        className={`${opsFilterCardClass} motion-safe:animate-[var(--animate-fade-in-up)]`}
        aria-label={to("orders.tracking_filters")}
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{to("orders.from_date")}</span>
            </label>
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
              className="w-full text-xs font-medium"
              data-testid="orders-completed-from"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{to("orders.to_date")}</span>
            </label>
            <DatePicker
              value={completedTo}
              onChange={(v) => {
                if (v && v >= (completedFrom || defaultFrom)) setCompletedTo(v);
              }}
              minDate={completedFrom || defaultFrom}
              maxDate={today}
              placeholder="DD/MM/YYYY"
              hideThisWeek
              hideClear
              hideToday
              className="w-full text-xs font-medium"
              data-testid="orders-completed-to"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <ClipboardCheck
                size={17}
                className="text-sky-500 flex-shrink-0"
              />
              <span>{to("orders.filter_delivery_status")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={to("orders.filter_delivery_status")}
              value={deliveryFilter === "all" ? "" : deliveryFilter}
              options={deliveryOptions.filter((o) => o.value !== "all")}
              onChange={(next) =>
                setDeliveryFilter((next as DeliveryFilter) || "all")
              }
              placeholder={to("orders.all")}
              allowClear
              className="w-full"
              triggerClassName="h-10 rounded-lg text-[13px]"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <SlidersHorizontal
                size={17}
                className="text-amber-500 flex-shrink-0"
              />
              <span>{to("orders.filter_difference")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={to("orders.filter_difference")}
              value={differenceFilter === "all" ? "" : differenceFilter}
              options={differenceOptions.filter((o) => o.value !== "all")}
              onChange={(next) =>
                setDifferenceFilter((next as DifferenceFilter) || "all")
              }
              placeholder={to("orders.all")}
              allowClear
              className="w-full"
              triggerClassName="h-10 rounded-lg text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 items-end pt-1 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <label className={opsFilterLabelClass}>
              <ArrowUpDown
                size={17}
                className="text-violet-500 flex-shrink-0"
              />
              <span>{to("orders.sort")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={to("orders.sort")}
              value={sortMode}
              options={sortOptions}
              onChange={(next) => setSortMode(next || "newest")}
              placeholder={to("orders.sort_newest")}
              className="w-full"
              triggerClassName="h-10 rounded-lg text-[13px]"
            />
          </div>
          <div className="lg:col-span-5">
            <label className={opsFilterLabelClass}>
              <Search size={17} className="text-slate-400 flex-shrink-0" />
              <span>{to("orders.search_label")}</span>
            </label>
            <div className="group relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={to("orders.search_tracking")}
                aria-label={to("orders.search_tracking")}
                className={`${opsInputClass} pl-10`}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-4">
            <FilterResetButton
              count={activeFilterCount}
              onClick={resetFilters}
            />
            <BrandRefreshButton
              onClick={onRefresh}
              loading={refreshing}
              ariaLabel={to("orders.refresh")}
            />
          </div>
        </div>
      </section>

      {/* ── TABLE 1 — PENDING & IN PROGRESS (all open trips, not day-scoped) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <SectionTitle
          tone="amber"
          label={to("orders.tracking_active_title")}
          note={to("orders.trips_count", { x: activeFiltered.length })}
        />
        <TrackingTable
          loading={loading}
          refreshing={refreshing}
          label={to("orders.tracking_active_title")}
          emptyTitle={
            activeFilterCount > 0 && active.length > 0
              ? to("orders.no_search_results")
              : to("orders.no_pending_deliveries")
          }
          trips={activeFiltered}
          pageSlice={activePage}
          safePage={safeActivePage}
          totalPages={activeTotalPages}
          onPageChange={setActivePage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setActivePage(1);
            setCompletedPage(1);
          }}
          supervisorOf={supervisorOf}
          actionProps={actionProps}
        />
      </div>

      {/* ── TABLE 2 — COMPLETED (lifecycle-completed trips in [From → To]) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <SectionTitle
          tone="emerald"
          label={to("orders.tracking_completed_title")}
          note={to("orders.trips_count", { x: completedFiltered.length })}
        >
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-700">
            <Route size={13} aria-hidden />
            {formatDayShort(completedFrom || defaultFrom)} →{" "}
            {formatDayShort(completedTo || today)}
          </span>
        </SectionTitle>
        <TrackingTable
          loading={loading}
          refreshing={refreshing}
          label={to("orders.tracking_completed_title")}
          emptyTitle={
            activeFilterCount > 0 && completed.length > 0
              ? to("orders.no_search_results")
              : to("orders.no_completed_window")
          }
          trips={completedFiltered}
          pageSlice={completedPage}
          safePage={safeCompletedPage}
          totalPages={completedTotalPages}
          onPageChange={setCompletedPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setActivePage(1);
            setCompletedPage(1);
          }}
          supervisorOf={supervisorOf}
          actionProps={actionProps}
        />
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

export default React.memo(DeliveryTrackingPage);
