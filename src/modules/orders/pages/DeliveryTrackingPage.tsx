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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpDown,
  Bird,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Hash,
  Hourglass,
  PackageCheck,
  Route,
  Search,
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
  opsPdfButtonClass,
  opsViewButtonClass,
} from "../../../shared/ui/operationsStyles";
import { uiActionIconMotionClass } from "../../../shared/ui/uiTokens";
import { localizeTripViewText } from "../../operations/vehicle-trips/utils/tripViewLocalization";
import { formatTripListDay } from "../../operations/vehicle-trips/utils/formatTripListDay";

import {
  BrandRefreshButton,
  FilterResetButton,
  Pagination,
  countActiveFilters,
} from "../../../ui";
import MasterDropdown from "../../masters/components/MasterDropdown";
import {
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

/** Column head — the Trip List's 12px bold uppercase word beside a coloured glyph. */
function Th({
  icon,
  label,
  className = "",
  align = "left",
}: {
  icon?: React.ReactNode;
  label: string;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <th
      className={`px-4 py-4 text-[12px] font-bold uppercase tracking-wider whitespace-nowrap ${
        align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      <span
        className={`inline-flex items-center gap-1.5 ${align === "center" ? "justify-center" : ""}`}
      >
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

const TRACKING_COLS = 10;

/**
 * ONE table with the Trip List's anatomy: click a row to select it (✓ replaces
 * the S.No, the row tints blue), ↑/↓ + Enter move the selection by keyboard,
 * and View / PDF for the selected trip sit at the table top.
 */
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
  selectedId,
  onSelect,
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
  selectedId: number | null;
  onSelect: (ot: OrdersTrip, toggle: boolean) => void;
}) {
  const { to, language } = useOrdersI18n();
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const lt = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language) || "—";

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    rowIndex: number,
  ) => {
    if (event.target !== event.currentTarget) return;
    const current = pageSlice[rowIndex];
    if (!current) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(current, true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = pageSlice[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    onSelect(next, false);
    requestAnimationFrame(() => rowRefs.current.get(next.trip.id)?.focus());
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
          <tr className="whitespace-nowrap">
            <Th className="w-10" align="center" label="#" />
            <Th
              icon={<Hash size={14} className="shrink-0 text-slate-400" />}
              label={to("orders.col_trip_no")}
            />
            <Th
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
              align="center"
              icon={
                <ShoppingBag size={14} className="shrink-0 text-cyan-500" />
              }
              label={to("orders.col_total_shops")}
            />
            <Th
              align="center"
              icon={<Box size={14} className="shrink-0 text-emerald-600" />}
              label={to("orders.total_boxes")}
            />
            <Th
              align="center"
              icon={
                <PackageCheck size={14} className="shrink-0 text-teal-500" />
              }
              label={to("orders.col_delivered_boxes")}
            />
            <Th
              align="center"
              icon={<Bird size={14} className="shrink-0 text-blue-500" />}
              label={to("orders.delivered_birds")}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading || refreshing ? (
            <TableLoadingRow label={label} colSpan={TRACKING_COLS} />
          ) : pageSlice.length === 0 ? (
            <tr>
              <td
                colSpan={TRACKING_COLS}
                className="py-12 text-center text-[13px] font-medium text-slate-400"
              >
                {emptyTitle}
              </td>
            </tr>
          ) : (
            pageSlice.map((ot, index) => {
              const { trip, progress } = ot;
              const isSelected = trip.id === selectedId;
              const serialNo = (safePage - 1) * pageSize + index + 1;
              return (
                <tr
                  key={trip.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(trip.id, el);
                    else rowRefs.current.delete(trip.id);
                  }}
                  tabIndex={0}
                  onClick={() => onSelect(ot, true)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                  aria-selected={isSelected}
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 motion-safe:animate-[var(--animate-fade-in-up)] ${
                    isSelected
                      ? "border-l-4 border-l-blue-300 bg-blue-50/70 ring-1 ring-inset ring-blue-200"
                      : `hover:bg-slate-50/60 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`
                  }`}
                >
                  <td className="w-10 px-4 py-5 text-center text-[13px] font-medium text-slate-500">
                    {isSelected ? (
                      <Check size={16} className="inline text-blue-500" />
                    ) : (
                      serialNo
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 pl-9 text-[13px] font-bold text-emerald-600">
                    <span className="inline-flex flex-col leading-tight">
                      {lt(trip.tripNo)}
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
                  <td className="whitespace-nowrap px-4 py-5 pl-9 text-[13px] font-medium text-slate-600">
                    {formatTripListDay(trip.tripDate, language)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 pl-9 text-[13px] font-medium text-slate-700">
                    {trip.vehicleNo
                      ? lt(formatVehicleNumber(trip.vehicleNo))
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 pl-9 text-[13px] text-slate-600">
                    {lt(trip.supervisorName)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 pl-9 text-[13px] text-slate-600">
                    {lt(trip.driverName)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold text-slate-700">
                    {progress ? (
                      <span className="inline-flex flex-col items-center leading-tight">
                        <span>{formatCount(progress.totalShops)}</span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {formatCount(progress.deliveredShops)}{" "}
                          {to("orders.status_delivered")}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold text-emerald-600">
                    {progress ? formatCount(progress.totalBoxes) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold text-teal-600">
                    {progress ? formatCount(progress.deliveredBoxes) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold text-blue-600">
                    {progress && progress.deliveredBirds > 0 ? (
                      formatCount(progress.deliveredBirds)
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
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

/** View / PDF for the selected row — shown at the table top, Trip List style. */
function SelectedActions({
  ot,
  pdfBusyId,
  onPdf,
  onView,
  buttonRef,
}: {
  ot: OrdersTrip;
  pdfBusyId: number | null;
  onPdf: (ot: OrdersTrip) => void;
  onView: (ot: OrdersTrip) => void;
  buttonRef: React.Ref<HTMLDivElement>;
}) {
  const { to } = useOrdersI18n();
  const pdfBusy = pdfBusyId === ot.trip.id;
  return (
    <div
      ref={buttonRef}
      className="flex items-center gap-2 motion-safe:animate-[var(--animate-pop-in)]"
    >
      <button
        type="button"
        onClick={() => onView(ot)}
        className={`group relative ${opsViewButtonClass}`}
        aria-label={`${to("orders.view")} — ${ot.trip.tripNo}`}
      >
        <span className={`inline-flex ${uiActionIconMotionClass.view}`}>
          <Eye size={15} />
        </span>
        {to("orders.view")}
      </button>
      <button
        type="button"
        onClick={() => onPdf(ot)}
        disabled={pdfBusy}
        aria-busy={pdfBusy}
        className={`group relative ${opsPdfButtonClass}`}
        aria-label={`${to("orders.view_pdf")} — ${ot.trip.tripNo}`}
      >
        <span
          className={`inline-flex ${pdfBusy ? "animate-pulse" : uiActionIconMotionClass.pdf}`}
        >
          <FileText size={15} />
        </span>
        PDF
      </button>
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

  // Row selection (Trip List behaviour): one selected trip across both tables;
  // clicking the same row again clears it, clicking outside the tables or
  // their action buttons clears it too.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const tablesRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const handleSelect = useCallback((ot: OrdersTrip, toggle: boolean) => {
    setSelectedId((prev) =>
      toggle && prev === ot.trip.id ? null : ot.trip.id,
    );
  }, []);
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        tablesRef.current?.contains(target) ||
        actionsRef.current?.contains(target)
      )
        return;
      setSelectedId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

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
  const selectedActive = activeFiltered.find((t) => t.trip.id === selectedId);
  const selectedCompleted = completedFiltered.find(
    (t) => t.trip.id === selectedId,
  );

  return (
    <div className="space-y-4" ref={tablesRef}>
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
        >
          {selectedActive && (
            <SelectedActions
              ot={selectedActive}
              pdfBusyId={pdfBusyId}
              onPdf={onPdf}
              onView={onView}
              buttonRef={actionsRef}
            />
          )}
        </SectionTitle>
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
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* ── TABLE 2 — COMPLETED (lifecycle-completed trips in [From → To]) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <SectionTitle
          tone="emerald"
          label={to("orders.tracking_completed_title")}
          note={to("orders.trips_count", { x: completedFiltered.length })}
        >
          {selectedCompleted && (
            <SelectedActions
              ot={selectedCompleted}
              pdfBusyId={pdfBusyId}
              onPdf={onPdf}
              onView={onView}
              buttonRef={actionsRef}
            />
          )}
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
          selectedId={selectedId}
          onSelect={handleSelect}
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
