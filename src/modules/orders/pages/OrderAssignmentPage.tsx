// src/modules/orders/pages/OrderAssignmentPage.tsx
// TAB 2 — ORDER ASSIGNMENT (day-based, vehicle-first).
//
// Today (editable):
//   1. select a vehicle (existing trip, Step 2 complete)
//   2. see the day's AVAILABLE shops (collected, not yet assigned to any
//      vehicle for this day — a shop already on another vehicle for the
//      same day is excluded and shown as "Assigned TRP-…/vehicle")
//   3. tick shops ONE BY ONE (compact checkbox table, paginated 10/page —
//      scales to 40+/100+ shops, no huge cards)
//   4. selected shops move to "SELECTED FOR VEHICLE" in delivery order
//   5. set the delivery sequence with ↑/↓ (no typed numbers)
//   6. assign boxes (1 … ordered; ordered vs assigned shown together)
//   7. Save Progress (partial persists, no validation) / Finish Assignment
//      (validated: ≥ 1 shop, boxes in range, hard capacity block, and a
//      fresh persisted-data conflict re-check before writing)
//
// PAST DAYS: read-only — per-vehicle assignment cards from the persisted
// data (inspect only; no edits, no new assignments).
//
// Capacity is a HARD BLOCK with the exact numbers (Capacity / Already
// Assigned / Available / Requested). No invalid state is ever saved.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCheck,
  PackageCheck,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  Loader2,
  RotateCcw,
  ArrowUpDown,
  Calendar,
  MapPin,
  Save,
  Search,
  SlidersHorizontal,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../masters/components/MasterDropdown";
import type { Trip } from "../../../shared/trip";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
  opsSectionTitleClass,
  opsTableCardClass,
  opsTableDivideClass,
  opsTableHeaderBarClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../shared/ui/operationsStyles";
import { BrandRefreshButton, Pagination } from "../../../ui";
import { formatVehicleNumber } from "../../../utils/format";
import { uiActionIconMotionClass } from "../../../shared/ui/uiTokens";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import {
  collectionTotals,
  farmCityOf,
  formatCount,
  formatKg,
  isCapturedRow,
  moveInSequence,
  orderRowsOnTrip,
  planShareBoxes,
  rowBoxes,
  uniqueShopRows,
  weightForBirds,
  type AssignmentSheetRow,
} from "../utils/ordersUtils";
import {
  findDayOverAssignments,
  finishAssignment,
  saveAssignment,
  sendOrdersWhatsApp,
  shopMobileOf,
  supervisorMobileOf,
  villageOf,
  type OrdersWhatsAppResult,
  type ShopDirectory,
  type SupervisorDirectory,
} from "../services/ordersService";
import { useOrdersI18n } from "../i18n/ordersI18n";
import type {
  DayShopAssignmentPart,
  DayVehicleView,
  OrderShopRow,
  OrdersDayCollection,
  OrdersEligibleVehicle,
} from "../types";
import {
  ORDERS_TABLE_FONT_CLASS,
  ordersZebraTone,
  ordersTableZebraRow,
} from "../utils/ordersTableStyles";
import {
  ORDERS_NO_SPINNER,
  OrdersEmptyState,
  OrdersMultiSelect,
  OrdersTableSkeleton,
  OrdersDateControl,
  OrdersDropdown,
  WhatsAppIcon,
  onOrdersNumberWheel,
} from "../components/OrdersCommon";
import {
  compareAssignmentRows,
  type AssignmentSort,
} from "../utils/assignmentSort";
import OrdersWhatsAppConfirmPopup from "../components/OrdersWhatsAppConfirmPopup";

let clientKeySeq = 0;
function newClientKey(): string {
  clientKeySeq += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ak-${Date.now()}-${clientKeySeq}`;
}

/** One shop in the vehicle's delivery order (after selection). */
type SelectedRow = {
  clientKey: string;
  shopId: number;
  shopName: string;
  village: string;
  orderedBirds: number;
  orderedBoxes: number;
  /**
   * Boxes of this shop's order already assigned to OTHER vehicles (from the
   * day's persisted data) — this vehicle can take at most
   * `orderedBoxes − assignedElsewhere`, so two vehicles can split 40 into
   * 20 + 20 but never into 20 + 40.
   */
  assignedElsewhere: number;
  assigned: number; // 1 … orderedBoxes − assignedElsewhere
};

/** Boxes one selected shop may still take on this vehicle. */
function maxAssignable(
  row: Pick<SelectedRow, "orderedBoxes" | "assignedElsewhere">,
): number {
  return Math.max(0, row.orderedBoxes - row.assignedElsewhere);
}

function assignedBirdsFor(row: SelectedRow): number {
  if (row.assigned <= 0 || row.orderedBoxes <= 0) return 0;
  return Math.round((row.orderedBirds * row.assigned) / row.orderedBoxes);
}

function toOrderShopRows(rows: SelectedRow[]): OrderShopRow[] {
  return uniqueShopRows(rows.filter((r) => r.assigned > 0)).map((r, i) => {
    const birds = assignedBirdsFor(r);
    return {
      id: 0,
      clientKey: r.clientKey,
      serialNo: i + 1,
      boxNo: r.assigned,
      shopId: r.shopId,
      shopName: r.shopName,
      birdTypeId: 0,
      birdType: "",
      birds,
      weight: 0,
      mortality: 0,
      mortKg: 0,
      rate: null,
      amount: 0,
      remarks: "[ORDER]",
      deliveryMode: "box" as const,
      selectedBoxIds: [],
      village: r.village,
    };
  });
}

function selectionSnapshot(
  vehicleTripId: number | null,
  rows: SelectedRow[],
): string {
  return JSON.stringify([
    vehicleTripId,
    rows.map((r) => [r.shopId, r.assigned]),
  ]);
}

/** Status facet of the filter card — same vocabulary as the pool toggle. */
type AssignmentStatusFilter = "all" | "pending" | "assigned";

type Props = {
  loading: boolean;
  /** Selected operational day (YYYY-MM-DD). */
  day: string;
  /** Operational today (YYYY-MM-DD). */
  today: string;
  /** Day changed from the global date selector. */
  onDaySelect: (day: string) => void;
  /** The selected day's persisted collection (null = nothing collected yet). */
  collection: OrdersDayCollection | null;
  /** Vehicle trips eligible for assignment. */
  eligibleVehicles: OrdersEligibleVehicle[];
  /** Per-day read-only assignment views (persisted vehicle trips). */
  dayVehicleViews: DayVehicleView[];
  shopDirectory: ShopDirectory;
  supervisorDirectory: SupervisorDirectory;
  /** Data refetched after a mutation. */
  onChanged: () => void;
  /** Assignment finished — page moves to Tab 3. */
  onFinished: (vehicleTrip: Trip) => void;
  /** Table-level refresh — page refetches Orders data (soft toast after). */
  onRefresh: () => void;
  /** Refresh in flight (duplicate-call guard + busy icon). */
  refreshing: boolean;
};

/** Trip-List-style in-table loading row: the filter card and the table
 *  header stay put, only the record surface says it is fetching. */
function AssignmentLoadingRows() {
  const { to } = useOrdersI18n();
  return (
    <div
      role="status"
      aria-busy="true"
      className="py-16 text-center text-sm font-medium text-slate-400 motion-safe:animate-[var(--animate-fade-in)]"
    >
      <span className="inline-flex items-center gap-2">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
          aria-hidden="true"
        />
        {to("orders.loading_assignment")}
      </span>
    </div>
  );
}

/** Historical days are inspection-only; never mount a writable editor. */
function AssignmentHistory({
  views,
  query,
  sortMode,
  refreshing,
  cityFilters,
  vehicleFilter,
  supervisorFilter,
  statusFilter,
  shopDirectory,
  resetVersion,
}: {
  views: DayVehicleView[];
  query: string;
  sortMode: AssignmentSort;
  refreshing: boolean;
  cityFilters: string[];
  vehicleFilter: string;
  supervisorFilter: string;
  statusFilter: AssignmentStatusFilter;
  shopDirectory: ShopDirectory;
  resetVersion: number;
}) {
  const { to } = useOrdersI18n();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const rows = useMemo(() => {
    const result = views
      .flatMap((view) => view.rows.map((row) => ({ ...row, trip: view.trip })))
      .filter((row) => {
        const city = villageOf(row.shopId, row.shopName, shopDirectory);
        if (vehicleFilter && String(row.trip.id) !== vehicleFilter)
          return false;
        if (
          supervisorFilter &&
          (row.trip.supervisorName ?? "").trim().toLowerCase() !==
            supervisorFilter
        )
          return false;
        // History rows are all assigned; "pending" here = not yet delivered.
        if (statusFilter === "pending" && row.delivered) return false;
        if (statusFilter === "assigned" && !row.delivered) return false;
        return (
          (!cityFilters.length || cityFilters.includes(city)) &&
          [
            row.shopName,
            city,
            row.trip.tripNo,
            row.trip.vehicleNo,
            row.trip.supervisorName,
            row.trip.driverName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );
      });
    const sortable = (row: (typeof result)[number]) => ({
      name: row.shopName,
      city: villageOf(row.shopId, row.shopName, shopDirectory),
      birds: row.birds,
      boxes: row.boxes,
      weight: 0,
      sequence: row.sequence,
      vehicle: row.trip.vehicleNo ?? "",
      trip: row.trip.tripNo,
      assigned: row.delivered,
    });
    return result.sort((a, b) =>
      compareAssignmentRows(sortable(a), sortable(b), sortMode),
    );
  }, [
    views,
    query,
    sortMode,
    cityFilters,
    vehicleFilter,
    supervisorFilter,
    statusFilter,
    shopDirectory,
  ]);
  const resetKey = `${query}|${sortMode}|${pageSize}|${cityFilters.join(",")}|${vehicleFilter}|${supervisorFilter}|${statusFilter}|${resetVersion}`;
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPage(1);
  }
  const safePage = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / pageSize)),
  );
  return (
    <>
      <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
        {to("orders.read_only_note")}
      </div>
      <div className="overflow-x-auto" aria-busy={refreshing}>
        <table className={`w-full ${ORDERS_TABLE_FONT_CLASS}`}>
          <thead>
            <tr className={opsTableHeadRowClass}>
              {[
                "orders.col_sno",
                "orders.col_shop_name",
                "orders.col_village",
                "orders.col_trip_no",
                "orders.col_vehicle_no",
                "orders.col_boxes",
                "orders.col_birds",
              ].map((key) => (
                <th
                  key={key}
                  className={`${opsTableThClass} ${
                    key === "orders.col_boxes" || key === "orders.col_birds"
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  {to(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {refreshing ? (
              <tr>
                <td colSpan={7}>
                  <OrdersTableSkeleton rows={5} />
                </td>
              </tr>
            ) : (
              rows
                .slice((safePage - 1) * pageSize, safePage * pageSize)
                .map((row, index) => (
                  <tr
                    key={`${row.trip.id}-${row.shopId}`}
                    className={`${ordersTableZebraRow(index)} motion-safe:animate-[var(--animate-fade-in-up)]`}
                    style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
                  >
                    <td className={opsTableTdClass}>
                      {(safePage - 1) * pageSize + index + 1}
                    </td>
                    <td className={opsTableTdClass}>{row.shopName}</td>
                    <td className={opsTableTdClass}>
                      {villageOf(row.shopId, row.shopName, shopDirectory)}
                    </td>
                    <td className={opsTableTdClass}>{row.trip.tripNo}</td>
                    <td
                      className={`${opsTableTdClass} whitespace-nowrap tracking-wide`}
                    >
                      {formatVehicleNumber(row.trip.vehicleNo)}
                    </td>
                    <td
                      className={`${opsTableTdClass} text-right tabular-nums`}
                    >
                      {row.boxes}
                    </td>
                    <td
                      className={`${opsTableTdClass} text-right tabular-nums`}
                    >
                      {row.birds}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
        {!refreshing && rows.length === 0 && (
          <OrdersEmptyState title={to("orders.no_search_results")} />
        )}
      </div>
      <Pagination
        page={safePage}
        pageSize={pageSize}
        totalItems={rows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        disabled={refreshing}
      />
    </>
  );
}

function OrderAssignmentPage({
  loading,
  day,
  today,
  onDaySelect,
  collection,
  eligibleVehicles,
  dayVehicleViews,
  shopDirectory,
  supervisorDirectory,
  onChanged,
  onFinished,
  onRefresh,
  refreshing,
}: Props) {
  const { to } = useOrdersI18n();
  // One compact table-level search (shop / village / trip / vehicle /
  // supervisor) — filters the available-shop list AND the past-day table.
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Sorting applies to the full matching pool before pagination.
  const [sortMode, setSortMode] = useState<AssignmentSort>("pending");
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  // Trip-List-style facets: one vehicle trip, one supervisor, one status.
  const [vehicleFilterState, setVehicleFilter] = useState("");
  const [supervisorFilterState, setSupervisorFilter] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AssignmentStatusFilter>("all");
  const [resetVersion, setResetVersion] = useState(0);
  const cityOptions = useMemo(() => {
    const rows =
      day < today
        ? dayVehicleViews.flatMap((view) => view.rows)
        : (collection?.rows ?? []);
    return [
      ...new Set(
        rows
          .map((row) =>
            villageOf(row.shopId, row.shopName, shopDirectory).trim(),
          )
          .filter(Boolean),
      ),
    ]
      .sort((a, b) => a.localeCompare(b))
      .map((city) => ({ value: city, label: city }));
  }, [day, today, dayVehicleViews, collection, shopDirectory]);

  // Vehicle facet — today: the trucks ready for assignment; past days: the
  // trucks that carried that day's orders. Value = trip id (stable), label =
  // vehicle no · trip no so two trips of one truck stay distinguishable.
  const vehicleOptions = useMemo<MasterDropdownOption[]>(() => {
    const trips =
      day < today
        ? dayVehicleViews.map((view) => view.trip)
        : eligibleVehicles.map((v) => v.trip);
    const seen = new Set<number>();
    return trips
      .filter((trip) => (seen.has(trip.id) ? false : (seen.add(trip.id), true)))
      .sort(
        (a, b) =>
          (a.vehicleNo ?? "").localeCompare(b.vehicleNo ?? "") || a.id - b.id,
      )
      .map((trip) => ({
        value: String(trip.id),
        label: `${formatVehicleNumber(trip.vehicleNo)} · ${trip.tripNo}`,
        searchText: `${trip.vehicleNo} ${trip.tripNo} ${trip.supervisorName} ${trip.driverName}`,
      }));
  }, [day, today, dayVehicleViews, eligibleVehicles]);
  const supervisorOptions = useMemo<MasterDropdownOption[]>(() => {
    const trips =
      day < today
        ? dayVehicleViews.map((view) => view.trip)
        : eligibleVehicles.map((v) => v.trip);
    const names = new Map<string, string>();
    for (const trip of trips) {
      const name = (trip.supervisorName ?? "").trim();
      if (name) names.set(name.toLowerCase(), name);
    }
    return [...names.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [day, today, dayVehicleViews, eligibleVehicles]);
  const statusOptions = useMemo<MasterDropdownOption[]>(
    () => [
      { value: "pending", label: to("orders.pool_filter_pending") },
      { value: "assigned", label: to("orders.pool_filter_assigned") },
    ],
    [to],
  );
  // A pick that left the option list (truck finished / day changed) is
  // treated as cleared, so a stale id can never hide every row. Derived, not
  // an effect: the raw state is kept and simply ignored while invalid.
  const [rawVehicleFilter, rawSupervisorFilter] = [
    vehicleFilterState,
    supervisorFilterState,
  ];
  const vehicleFilter = vehicleOptions.some((o) => o.value === rawVehicleFilter)
    ? rawVehicleFilter
    : "";
  const supervisorFilter = supervisorOptions.some(
    (o) => o.value === rawSupervisorFilter,
  )
    ? rawSupervisorFilter
    : "";

  const sortOptions = useMemo(() => {
    const modes: AssignmentSort[] = [
      "pending",
      "sequence",
      "az",
      "za",
      "city_az",
      "city_za",
      "birds_asc",
      "birds_desc",
      "boxes_asc",
      "boxes_desc",
      ...(day === today
        ? (["weight_asc", "weight_desc"] as AssignmentSort[])
        : []),
      "vehicle_trip",
    ];
    const existing: Partial<Record<AssignmentSort, string>> = {
      pending: "orders.sort_pending_first",
      az: "orders.sort_name_az",
      za: "orders.sort_name_za",
      vehicle_trip: "orders.sort_vehicle_trip",
    };
    return modes.map((value) => ({
      value,
      label: to(existing[value] ?? `orders.sort_${value}`),
    }));
  }, [day, today, to]);
  const resetFilters = () => {
    setQuery("");
    setSortMode("pending");
    setCityFilters([]);
    setVehicleFilter("");
    setSupervisorFilter("");
    setStatusFilter("all");
    setResetVersion((value) => value + 1);
    // Reset to today. Today's mounted editor is not remounted, so picks survive.
    if (day !== today) onDaySelect(today);
  };

  // Active-filter chips (Trip-List style summary strip). Each chip clears
  // exactly one facet; the count reads how many facets narrow the view.
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (day !== today)
      chips.push({ key: "day", label: day, clear: () => onDaySelect(today) });
    const vehicleLabel = vehicleOptions.find(
      (o) => o.value === vehicleFilter,
    )?.label;
    if (vehicleFilter && vehicleLabel)
      chips.push({
        key: "vehicle",
        label: vehicleLabel,
        clear: () => setVehicleFilter(""),
      });
    const supLabel = supervisorOptions.find(
      (o) => o.value === supervisorFilter,
    )?.label;
    if (supervisorFilter && supLabel)
      chips.push({
        key: "supervisor",
        label: supLabel,
        clear: () => setSupervisorFilter(""),
      });
    if (statusFilter !== "all")
      chips.push({
        key: "status",
        label: to(`orders.pool_filter_${statusFilter}`),
        clear: () => setStatusFilter("all"),
      });
    for (const city of cityFilters)
      chips.push({
        key: `city:${city}`,
        label: city,
        clear: () => setCityFilters(cityFilters.filter((c) => c !== city)),
      });
    if (q)
      chips.push({
        key: "q",
        label: `“${query.trim()}”`,
        clear: () => setQuery(""),
      });
    if (sortMode !== "pending")
      chips.push({
        key: "sort",
        label: sortOptions.find((o) => o.value === sortMode)?.label ?? sortMode,
        clear: () => setSortMode("pending"),
      });
    return chips;
  }, [
    day,
    today,
    onDaySelect,
    vehicleFilter,
    vehicleOptions,
    supervisorFilter,
    supervisorOptions,
    statusFilter,
    cityFilters,
    q,
    query,
    sortMode,
    sortOptions,
    to,
  ]);
  const hasFilters = activeChips.length > 0;

  return (
    <div className="space-y-5">
      <section
        className={`${opsFilterCardClass} motion-safe:animate-[var(--animate-fade-in-up)]`}
        aria-label={to("orders.assignment_filters")}
      >
        {/* Row 1 — Date · Vehicle · Supervisor · Status · City (Trip List grid) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            {/* No Calendar glyph on the label: the date field carries its own, and that one is the button you click. */}
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{to("orders.col_date")}</span>
            </label>
            <OrdersDateControl
              day={day}
              today={today}
              onDaySelect={onDaySelect}
              t={to}
              hideDayChip
              className="w-full"
              fieldClassName="w-full"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <Truck size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{to("orders.col_vehicle_no")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={to("orders.col_vehicle_no")}
              value={vehicleFilter}
              options={vehicleOptions}
              onChange={setVehicleFilter}
              placeholder={to("orders.all")}
              searchable
              allowClear
              className="w-full"
              triggerClassName="h-10 rounded-lg text-[13px]"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <UserCog size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{to("orders.supervisor")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={to("orders.supervisor")}
              value={supervisorFilter}
              options={supervisorOptions}
              onChange={setSupervisorFilter}
              placeholder={to("orders.all")}
              searchable
              allowClear
              className="w-full"
              triggerClassName="h-10 rounded-lg text-[13px]"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <SlidersHorizontal
                size={17}
                className="text-sky-500 flex-shrink-0"
              />
              <span>{to("orders.filter_status")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={to("orders.filter_status")}
              value={statusFilter === "all" ? "" : statusFilter}
              options={statusOptions}
              onChange={(next) =>
                setStatusFilter((next as AssignmentStatusFilter) || "all")
              }
              placeholder={to("orders.all")}
              allowClear
              className="w-full"
              triggerClassName="h-10 rounded-lg text-[13px]"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <MapPin size={17} className="text-amber-500 flex-shrink-0" />
              <span>{to("orders.city")}</span>
            </label>
            <OrdersMultiSelect
              values={cityFilters}
              onChange={setCityFilters}
              options={cityOptions}
              ariaLabel={to("orders.filter_city")}
              placeholder={to("orders.filter_city_all")}
              className="w-full"
              widthClass="w-full"
            />
          </div>
        </div>

        {/* Row 2 — Sort · Search · actions (Trip List 3 / 5 / 4 split) */}
        <div className="grid grid-cols-1 gap-3.5 items-end pt-1 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <label className={opsFilterLabelClass}>
              <ArrowUpDown
                size={17}
                className="text-violet-500 flex-shrink-0"
              />
              <span>{to("orders.sort")}</span>
            </label>
            <OrdersDropdown
              value={sortMode}
              onChange={(value) => setSortMode(value as AssignmentSort)}
              ariaLabel={to("orders.sort")}
              options={sortOptions}
              className="w-full"
              widthClass="w-full"
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder={to("orders.search_assignment")}
                aria-label={to("orders.search_label")}
                className={`${opsInputClass} pl-10 pr-9`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={to("common.reset")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 motion-safe:animate-[var(--animate-scale-in)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-4">
            <button
              type="button"
              onClick={resetFilters}
              className={`group relative ${opsSecondaryButtonClass}`}
              aria-label={to("common.reset")}
            >
              <RotateCcw size={14} className={uiActionIconMotionClass.reset} />
              {to("common.reset")}
              {hasFilters && (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold tabular-nums text-white motion-safe:animate-[var(--animate-pop-in)]">
                  {activeChips.length}
                </span>
              )}
            </button>
            <BrandRefreshButton onClick={onRefresh} loading={refreshing} />
          </div>
        </div>

        {/* Active-filter chips — each one clears its own facet. */}
        {hasFilters && (
          <div
            className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 motion-safe:animate-[var(--animate-slide-down)]"
            aria-live="polite"
          >
            <SlidersHorizontal
              size={13}
              className="text-slate-400"
              aria-hidden
            />
            {activeChips.map((chip, index) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="group inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 motion-safe:animate-[var(--animate-pop-in)]"
                style={{ animationDelay: `${index * 35}ms` }}
              >
                {chip.label}
                <X
                  size={12}
                  className="text-emerald-500 transition-transform group-hover:rotate-90 group-hover:text-rose-500"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      <section
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm motion-safe:animate-[var(--animate-fade-in-up)] [animation-delay:60ms]"
        aria-label={to("orders.tab_assignment")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner">
              <PackageCheck size={20} aria-hidden />
            </span>
            <h2 className="text-base font-bold tracking-tight text-slate-800">
              {to("orders.tab_assignment")}
            </h2>
          </div>
          {loading ? (
            <span className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          ) : (
            <span
              key={`${collection?.assignedShops ?? 0}/${collection?.totalShops ?? 0}`}
              className="text-xs font-medium text-slate-500 motion-safe:animate-[var(--animate-fade-in)]"
            >
              {to("orders.pool_summary", {
                collected: collection?.totalShops ?? 0,
                assigned: collection?.assignedShops ?? 0,
                available:
                  (collection?.totalShops ?? 0) -
                  (collection?.assignedShops ?? 0),
              })}
            </span>
          )}
        </div>

        {loading ? (
          <AssignmentLoadingRows />
        ) : day < today ? (
          <AssignmentHistory
            key={day}
            views={dayVehicleViews}
            query={q}
            sortMode={sortMode}
            refreshing={refreshing}
            cityFilters={cityFilters}
            vehicleFilter={vehicleFilter}
            supervisorFilter={supervisorFilter}
            statusFilter={statusFilter}
            shopDirectory={shopDirectory}
            resetVersion={resetVersion}
          />
        ) : !collection ? (
          <OrdersEmptyState
            title={to("orders.assignment_empty")}
            hint={to("orders.select_order")}
          />
        ) : (
          <div className="relative" aria-busy={refreshing}>
            {refreshing && (
              <div className="absolute inset-0 z-20 bg-white/90">
                <OrdersTableSkeleton rows={6} />
              </div>
            )}
            <div inert={refreshing}>
              <AssignmentEditor
                key={`${day}|${collection.trip.id}`}
                day={day}
                collection={collection}
                eligibleVehicles={eligibleVehicles}
                shopDirectory={shopDirectory}
                supervisorDirectory={supervisorDirectory}
                q={q}
                sortMode={sortMode}
                cityFilters={cityFilters}
                vehicleFilter={vehicleFilter}
                supervisorFilter={supervisorFilter}
                statusFilter={statusFilter}
                resetVersion={resetVersion}
                onChanged={onChanged}
                onFinished={onFinished}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Assignment editor (one day → one vehicle at a time) ────────────────────

function AssignmentEditor({
  day,
  collection,
  eligibleVehicles,
  shopDirectory,
  supervisorDirectory,
  q,
  sortMode,
  cityFilters,
  vehicleFilter,
  supervisorFilter,
  statusFilter,
  resetVersion,
  onChanged,
  onFinished,
}: {
  day: string;
  collection: OrdersDayCollection;
  eligibleVehicles: OrdersEligibleVehicle[];
  shopDirectory: ShopDirectory;
  supervisorDirectory: SupervisorDirectory;
  q: string;
  sortMode: AssignmentSort;
  cityFilters: string[];
  vehicleFilter: string;
  supervisorFilter: string;
  statusFilter: AssignmentStatusFilter;
  resetVersion: number;
  onChanged: () => void;
  /** Assignment finished — page moves to Tab 3. */
  onFinished: (vehicleTrip: Trip) => void;
}) {
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();
  const orderTrip = collection.trip;

  // ── Day pool split: available vs already assigned (persisted facts) ──────
  const pool = useMemo(() => {
    const available: OrderShopRow[] = [];
    const assigned: Array<{
      row: OrderShopRow;
      tripNo: string;
      vehicleNo: string;
      delivered: boolean;
    }> = [];
    for (const row of collection.rows) {
      const a = collection.shops.get(row.shopId);
      if (!a) {
        available.push(row);
      } else {
        assigned.push({
          row,
          tripNo: a.tripNo,
          vehicleNo: a.vehicleNo,
          delivered: a.delivered,
        });
      }
    }
    return { available, assigned };
  }, [collection]);

  // ── Step 1: vehicle ──────────────────────────────────────────────────────
  const [vehicleTripId, setVehicleTripId] = useState<number | null>(null);
  const vehicle = useMemo(
    () => eligibleVehicles.find((v) => v.trip.id === vehicleTripId) ?? null,
    [eligibleVehicles, vehicleTripId],
  );

  // ── Step 3: selection (one shop at a time) + Step 5/6: order & boxes ─────
  const [selected, setSelected] = useState<SelectedRow[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    selectionSnapshot(null, []),
  );
  const isDirty = selectionSnapshot(vehicleTripId, selected) !== savedSnapshot;

  const [saving, setSaving] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waProgress, setWaProgress] = useState<string | null>(null);
  const [conflictChecking, setConflictChecking] = useState(false);
  const [capacityExceeded, setCapacityExceeded] = useState<null | {
    capacity: number;
    assigned: number;
    available: number;
    requested: number;
  }>(null);
  const persistLockRef = useRef(false);
  const busy = saving || conflictChecking || waBusy;

  const selectedIds = useMemo(
    () => new Set(selected.map((r) => r.shopId)),
    [selected],
  );

  const toggleShop = useCallback(
    (row: OrderShopRow, checked: boolean, assignedElsewhere = 0) => {
      setSelected((prev) => {
        if (checked) {
          if (prev.some((r) => r.shopId === row.shopId)) return prev;
          const orderedBoxes = Math.max(1, Number(row.boxNo) || 0);
          // A partially-assigned shop comes in with only its BALANCE pre-filled:
          // 40 ordered, 20 already on another truck → this one gets 20, not 40.
          const takeable = Math.max(0, orderedBoxes - assignedElsewhere);
          return [
            ...prev,
            {
              clientKey: newClientKey(),
              shopId: row.shopId,
              shopName: row.shopName || "—",
              village: villageOf(row.shopId, row.shopName, shopDirectory),
              orderedBirds: Number(row.birds) || 0,
              orderedBoxes,
              assignedElsewhere,
              assigned: takeable,
            },
          ];
        }
        return prev.filter((r) => r.shopId !== row.shopId);
      });
    },
    [shopDirectory],
  );

  // ── Sequence editing (a vehicle can carry ~45 shops, so stepping with ↑/↓
  //     is never the only way): drag a row, jump it to first/last, or sort the
  //     whole sequence in one click. All three go through moveInSequence.
  const moveRowTo = useCallback((clientKey: string, to: number) => {
    setSelected((prev) => {
      const from = prev.findIndex((r) => r.clientKey === clientKey);
      if (from < 0) return prev;
      return moveInSequence(prev, from, to);
    });
  }, []);

  const moveRow = useCallback((clientKey: string, dir: -1 | 1) => {
    setSelected((prev) => {
      const from = prev.findIndex((r) => r.clientKey === clientKey);
      if (from < 0) return prev;
      return moveInSequence(prev, from, from + dir);
    });
  }, []);

  const sortSelected = useCallback((mode: "shop_az" | "village_az") => {
    setSelected((prev) => {
      const next = [...prev];
      next.sort((a, b) =>
        mode === "shop_az"
          ? (a.shopName || "").localeCompare(b.shopName || "")
          : (a.village || "").localeCompare(b.village || "") ||
            (a.shopName || "").localeCompare(b.shopName || ""),
      );
      return next;
    });
  }, []);

  // Drag state — which row is lifted, and where it would land.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const setAssigned = useCallback((clientKey: string, raw: string) => {
    setSelected((prev) =>
      prev.map((r) => {
        if (r.clientKey !== clientKey) return r;
        // Assigned boxes: 1 … remaining balance (0 = not assigned to this
        // vehicle). The cap already discounts boxes on other vehicles, so a
        // 40-box shop split 20 + 20 can never become 20 + 40.
        const n = Math.max(
          0,
          Math.min(maxAssignable(r), Math.floor(Number(raw) || 0)),
        );
        return { ...r, assigned: n };
      }),
    );
  }, []);

  const supervisorMobile = vehicle
    ? supervisorMobileOf(vehicle.trip, supervisorDirectory)
    : "";

  // ── Capacity math (boxes are the priority figure; hard block) ────────────
  const avgBirdWeight = vehicle ? Number(vehicle.trip.avgBirdWeight) || 0 : 0;
  // Weight basis for the ORDERED weights: the picked vehicle's own average
  // bird weight (that is what will be loaded), and the day's collection average
  // until a vehicle is picked — so planning never shows a column of dashes.
  const dayAvgBirdWeight = Number(collection?.trip.avgBirdWeight) || 0;
  const orderWeightBasis = avgBirdWeight || dayAvgBirdWeight;
  const capacity = vehicle ? vehicle.capacity : 0;
  // The vehicle's rows for THIS order are replaced on save, so they never
  // count against its capacity — only boxes from OTHER orders do. (The old
  // code subtracted the collection's TOTAL assigned boxes, which breaks
  // once an order is split over several vehicles.)
  const ownOrderBoxes = useMemo(
    () =>
      vehicle
        ? planShareBoxes(orderRowsOnTrip(vehicle.trip, orderTrip.tripNo))
        : 0,
    [vehicle, orderTrip.tripNo],
  );
  const alreadyAssignedOther = vehicle
    ? Math.max(0, vehicle.alreadyAssigned - ownOrderBoxes)
    : 0;
  const requested = selected.reduce((s, r) => s + r.assigned, 0);
  const available = vehicle ? Math.max(0, capacity - alreadyAssignedOther) : 0;
  // Order rows already persisted on THIS vehicle (earlier partial saves).
  // They let the operator dispatch the truck with an empty selection.
  // The assignment sheet is a modal — Escape closes it, like every other sheet.
  useEffect(() => {
    if (vehicleTripId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVehicleTripId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vehicleTripId]);

  /** Shops already saved on a truck — shown in the vehicle list. A shop
      split over two vehicles counts once for EACH of them. */
  const savedShopsByTripNo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of collection.shops.values()) {
      if (!a) continue;
      for (const p of a.parts ?? []) {
        counts.set(p.tripNo, (counts.get(p.tripNo) ?? 0) + 1);
      }
    }
    return counts;
  }, [collection]);
  const savedShopsOn = useCallback(
    (tripNo: string): number => savedShopsByTripNo.get(tripNo) ?? 0,
    [savedShopsByTripNo],
  );

  // The vehicle list is split in two so the operator sees at a glance which
  // trucks are still WAITING for shops and which ones already carry them.
  const vehicleMatches = useCallback(
    (v: OrdersEligibleVehicle): boolean => {
      if (vehicleFilter && String(v.trip.id) !== vehicleFilter) return false;
      if (
        supervisorFilter &&
        (v.trip.supervisorName ?? "").trim().toLowerCase() !== supervisorFilter
      )
        return false;
      if (!q) return true;
      const hay = [
        v.trip.vehicleNo,
        v.trip.tripNo,
        v.trip.supervisorName,
        v.trip.driverName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    },
    [q, vehicleFilter, supervisorFilter],
  );

  const pendingVehicles = useMemo(
    () => eligibleVehicles.filter((v) => vehicleMatches(v)),
    [eligibleVehicles, vehicleMatches],
  );

  const savedOnVehicle = useMemo(
    () =>
      vehicle
        ? pool.assigned.filter(
            (a) => a.tripNo === vehicle.trip.tripNo && !a.delivered,
          ).length
        : 0,
    [pool.assigned, vehicle],
  );
  const remaining = available - requested;
  const totals = useMemo(
    () => collectionTotals(toOrderShopRows(selected)),
    [selected],
  );

  const checkCapacity = useCallback((): boolean => {
    if (!vehicle) {
      showNotification(to("orders.select_vehicle"), "info");
      return false;
    }
    if (requested > available) {
      setCapacityExceeded({
        capacity,
        assigned: alreadyAssignedOther,
        available,
        requested,
      });
      return false;
    }
    return true;
  }, [
    vehicle,
    requested,
    available,
    capacity,
    alreadyAssignedOther,
    showNotification,
    to,
  ]);

  // ── Pre-save balance re-check from FRESH persisted data ─────────────────
  // The hard rule behind split orders: summed over ALL vehicles, a shop can
  // never take more boxes than were collected (40 ordered → V1 20 + V2 20 is
  // fine; V2 asking for 40 is not). Always checked against a fresh fetch, so
  // a shop another operator just placed on a different truck is caught here
  // even if this screen has stale data.
  const assertFitsBalance = useCallback(async (): Promise<boolean> => {
    if (!vehicle || selected.length === 0) return true;
    setConflictChecking(true);
    try {
      const issues = await findDayOverAssignments(
        day,
        selected.map((r) => ({
          shopId: r.shopId,
          shopName: r.shopName,
          boxes: r.assigned,
        })),
        vehicle.trip.tripNo,
      );
      if (issues.length > 0) {
        // Auto-correct the selection to the fresh remaining balance and make
        // the operator re-confirm — no invalid state is ever saved.
        const remainingOf = new Map(issues.map((i) => [i.shopId, i.remaining]));
        setSelected((prev) =>
          prev
            .map((r) =>
              remainingOf.has(r.shopId)
                ? { ...r, assigned: remainingOf.get(r.shopId)! }
                : r,
            )
            .filter((r) => r.assigned > 0),
        );
        showNotification(
          to("orders.over_assign_message", {
            shops: issues
              .map(
                (i) => `${i.shopName} (${i.requested} > ${i.remaining} left)`,
              )
              .join(", "),
          }),
          "error",
        );
        onChanged();
        return false;
      }
      return true;
    } catch {
      showNotification(to("orders.refresh_failed"), "error");
      return false;
    } finally {
      setConflictChecking(false);
    }
  }, [vehicle, selected, day, showNotification, to, onChanged]);

  // ── Save Progress (partial persists, no final validation) ────────────────
  const handleSave = useCallback(async () => {
    if (persistLockRef.current || busy || !vehicle) return;
    if (!checkCapacity()) return;
    if (selected.length === 0) {
      showNotification(to("orders.selection_empty"), "info");
      return;
    }
    if (!(await assertFitsBalance())) return;
    persistLockRef.current = true;
    setSaving(true);
    try {
      await saveAssignment(vehicle.trip, [
        { orderTripNo: orderTrip.tripNo, rows: toOrderShopRows(selected) },
      ]);
      // INCREMENTAL ASSIGNMENT: keep the just-saved shops selected so the
      // operator can tick MORE shops and save again (1 saved + 4 new = all 5
      // on the truck). The save REPLACES this order's rows on the vehicle,
      // so re-saving the kept rows is idempotent — and the fresh-data
      // balance guard above still blocks any over-assignment.
      setSavedSnapshot(selectionSnapshot(vehicleTripId, selected));
      showNotification(to("orders.assignment_saved"), "success");
      onChanged();
    } catch {
      showNotification(to("orders.refresh_failed"), "error");
    } finally {
      persistLockRef.current = false;
      setSaving(false);
    }
  }, [
    busy,
    vehicle,
    checkCapacity,
    selected,
    assertFitsBalance,
    orderTrip.tripNo,
    showNotification,
    to,
    onChanged,
    vehicleTripId,
  ]);

  const handleFinish = useCallback(async () => {
    if (persistLockRef.current || busy || !vehicle) return;
    if (!checkCapacity()) return;
    const rows =
      selected.length > 0
        ? toOrderShopRows(selected)
        : (orderRowsOnTrip(vehicle.trip, orderTrip.tripNo).filter(
            (r) => !isCapturedRow(r),
          ) as unknown as OrderShopRow[]);
    if (rows.length === 0) {
      showNotification(to("orders.selection_empty"), "info");
      return;
    }
    if (selected.length > 0 && !(await assertFitsBalance())) return;
    persistLockRef.current = true;
    setSaving(true);
    try {
      const trip = await finishAssignment(vehicle.trip, [
        { orderTripNo: orderTrip.tripNo, rows: uniqueShopRows(rows) },
      ]);
      showNotification(to("orders.assignment_finished"), "success");
      onFinished(trip);
    } catch {
      persistLockRef.current = false;
      showNotification(to("orders.refresh_failed"), "error");
    } finally {
      setSaving(false);
    }
  }, [
    busy,
    vehicle,
    checkCapacity,
    selected,
    assertFitsBalance,
    orderTrip.tripNo,
    showNotification,
    to,
    onFinished,
  ]);

  // ── Review & Submit: CONFIRM FIRST — the card opens a check popup (message text +
  //    branded assignment sheet PDF); nothing goes out until "Confirm & Send".
  const [waPopupOpen, setWaPopupOpen] = useState(false);

  // The shops the sheet + message list, in DELIVERY order: the live
  // selection when there is one, otherwise this vehicle's saved rows for the
  // order (so the operator can re-send after an earlier partial save).
  const waSheetRows = useMemo<AssignmentSheetRow[]>(() => {
    if (!vehicle) return [];
    if (selected.length > 0) {
      return selected
        .filter((r) => r.assigned > 0)
        .map((r, i) => ({
          serialNo: i + 1,
          shopId: r.shopId,
          shopName: r.shopName,
          village: r.village || villageOf(r.shopId, r.shopName, shopDirectory),
          mobile: shopMobileOf(r.shopId, shopDirectory),
          boxes: r.assigned,
          birds: assignedBirdsFor(r),
        }));
    }
    return orderRowsOnTrip(vehicle.trip, orderTrip.tripNo)
      .filter((r) => !isCapturedRow(r))
      .map((r, i) => ({
        serialNo: i + 1,
        shopId: r.shopId,
        shopName: r.shopName || "Shop",
        village: villageOf(r.shopId, r.shopName || "", shopDirectory),
        mobile: shopMobileOf(r.shopId, shopDirectory),
        boxes: rowBoxes(r),
        birds: Number(r.birds) || 0,
      }));
  }, [vehicle, selected, orderTrip.tripNo, shopDirectory]);

  // Persist-if-dirty, then send through the EXISTING per-delivery WhatsApp
  // mechanism — unchanged from the pre-popup behaviour. When the popup
  // re-ordered the shops (orderedShopIds), persist THAT sequence too, so the
  // saved data, the sheet and the actual send never disagree.
  const handleWhatsAppConfirm = useCallback(
    async (orderedShopIds?: number[]): Promise<OrdersWhatsAppResult | null> => {
      if (persistLockRef.current || waBusy || !vehicle) return null;
      if (!supervisorMobile.trim()) {
        showNotification(
          to("orders.whatsapp_failed", {
            message: "Supervisor mobile missing",
          }),
          "error",
        );
        return null;
      }
      persistLockRef.current = true;
      let trip = vehicle.trip;
      let payload: OrderShopRow[] | null = null;
      // When the popup re-ordered the live selection, keep that sequence in
      // state too (see below) so the kept selection matches what was saved.
      let reorderedSelection: SelectedRow[] | null = null;
      if (orderedShopIds && orderedShopIds.length > 0) {
        if (selected.length > 0) {
          // Live selection: same rows, re-ordered to the popup's sequence.
          const byShop = new Map(selected.map((r) => [r.shopId, r]));
          const reordered = orderedShopIds.flatMap((id) => {
            const row = byShop.get(id);
            return row ? [row] : [];
          });
          payload = toOrderShopRows(reordered);
          reorderedSelection = reordered;
        } else {
          // Re-send of saved rows: re-number the persisted rows, no other
          // field changes — the order becomes the new saved sequence.
          const saved = orderRowsOnTrip(vehicle.trip, orderTrip.tripNo).filter(
            (r) => !isCapturedRow(r),
          );
          const byShop = new Map(saved.map((r) => [r.shopId, r]));
          const reordered = orderedShopIds.flatMap((id) => {
            const row = byShop.get(id);
            return row ? [row] : [];
          });
          payload = reordered.map(
            (r, i) => ({ ...r, serialNo: i + 1 }) as unknown as OrderShopRow,
          );
        }
      }
      if (isDirty || payload) {
        if (!(await assertFitsBalance())) {
          persistLockRef.current = false;
          return null;
        }
        try {
          trip = await saveAssignment(vehicle.trip, [
            {
              orderTripNo: orderTrip.tripNo,
              rows: uniqueShopRows(payload ?? toOrderShopRows(selected)),
            },
          ]);
          // Keep the saved shops selected for incremental assignment (same
          // as Save Progress above) — never wipe the operator's work here.
          if (reorderedSelection) setSelected(reorderedSelection);
          setSavedSnapshot(
            selectionSnapshot(vehicleTripId, reorderedSelection ?? selected),
          );
          onChanged();
        } catch {
          persistLockRef.current = false;
          showNotification(to("orders.refresh_failed"), "error");
          return null;
        }
      }
      setWaBusy(true);
      setWaProgress("");
      try {
        const result = await sendOrdersWhatsApp(
          trip,
          supervisorMobile,
          (sent, total, shop) => setWaProgress(shop || `${sent}/${total}`),
        );
        if (result.enabled && result.sent > 0 && result.failed === 0) {
          // Success UI lives on the confirm popup — never toast success here.
        } else if (result.sent > 0) {
          showNotification(
            to("orders.whatsapp_partial", {
              sent: result.sent,
              failed: result.failed,
            }),
            "info",
          );
        } else {
          const message =
            !result.enabled ||
            (result.message && result.message.includes("not configured"))
              ? to("orders.whatsapp_not_configured")
              : result.message === "no_rows"
                ? to("orders.whatsapp_no_rows")
                : to("orders.whatsapp_failed", {
                    message: result.message ?? "—",
                  });
          showNotification(message, "error");
        }
        return result;
      } catch {
        showNotification(
          to("orders.whatsapp_failed", { message: "network" }),
          "error",
        );
        return null;
      } finally {
        persistLockRef.current = false;
        setWaBusy(false);
      }
    },
    [
      waBusy,
      vehicle,
      isDirty,
      selected,
      assertFitsBalance,
      orderTrip.tripNo,
      vehicleTripId,
      supervisorMobile,
      showNotification,
      onChanged,
      to,
    ],
  );

  // ── Day pool table: PENDING + PARTIALLY-SPLIT + ASSIGNED shops together ──
  //     pending  — the shop is on no vehicle yet (full balance assignable)
  //     partial  — some boxes are on other vehicles; only the BALANCE is
  //                still assignable here (40 ordered, 20 taken → 20 left)
  //     assigned — the balance is fully placed (or the shop is already on
  //                THIS vehicle) → read-only row
  //     Table-level search over the FULL pool (shop / village / vehicle /
  //     trip), sorted by the selected mode, then paginated (existing global
  //     component; 10 rows per page).
  type PoolRow = OrderShopRow & {
    poolIndex: number;
    kind: "pending" | "partial" | "assigned";
    /** Every vehicle carrying a share of this shop's order. */
    parts: DayShopAssignmentPart[];
    /** Boxes already on vehicles OTHER than the chosen one. */
    assignedElsewhere: number;
    /** Boxes still assignable: ordered − Σ parts (never negative). */
    remainingBoxes: number;
    /** A share of this shop is already saved on the chosen vehicle. */
    onThisVehicle: boolean;
    delivered: boolean;
  };
  // ── Collected-shops search + filter ─────────────────────────────────────
  // Search and city come from the separate filter card. Status stays local
  // to this pool; none of these filters changes the selected-shop draft.
  // Defaults to PENDING — with ~100 collected shops the operator almost always
  // wants the ones still waiting for a vehicle, not the already-assigned rows.
  const [poolFilter, setPoolFilter] = useState<
    "all" | "pending" | "assigned" | "this_vehicle"
  >("pending");
  const thisTripNo = vehicle?.trip.tripNo ?? "";
  const cityFilterSet = useMemo(() => new Set(cityFilters), [cityFilters]);
  const filterTripNo = useMemo(
    () =>
      eligibleVehicles.find((v) => String(v.trip.id) === vehicleFilter)?.trip
        .tripNo ?? "",
    [eligibleVehicles, vehicleFilter],
  );
  const supervisorByTripNo = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of eligibleVehicles)
      map.set(
        v.trip.tripNo,
        (v.trip.supervisorName ?? "").trim().toLowerCase(),
      );
    return map;
  }, [eligibleVehicles]);
  const supervisorOfTrip = useCallback(
    (tripNo: string) => supervisorByTripNo.get(tripNo) ?? "",
    [supervisorByTripNo],
  );
  const filteredPool = useMemo(() => {
    const list: PoolRow[] = [];
    collection.rows.forEach((row, i) => {
      const a = collection.shops.get(row.shopId);
      const parts = a?.parts ?? [];
      const partsTotal = a?.assignedBoxesTotal ?? 0;
      const orderedBoxes = Math.max(1, Number(row.boxNo) || 0);
      const boxesOnThisVehicle = parts
        .filter((p) => p.tripNo === thisTripNo)
        .reduce((sum, p) => sum + p.boxes, 0);
      const onThisVehicle =
        boxesOnThisVehicle > 0 || parts.some((p) => p.tripNo === thisTripNo);
      const remainingBoxes = Math.max(0, orderedBoxes - partsTotal);
      const kind: PoolRow["kind"] =
        parts.length === 0
          ? "pending"
          : remainingBoxes > 0 && !onThisVehicle
            ? "partial"
            : "assigned";
      const item: PoolRow = {
        ...row,
        poolIndex: i,
        kind,
        parts,
        assignedElsewhere: Math.max(0, partsTotal - boxesOnThisVehicle),
        remainingBoxes,
        onThisVehicle,
        delivered: a?.delivered ?? false,
      };
      // Refine filter first (cheap), then the two search terms. "Pending"
      // keeps the rows that still NEED a vehicle (pending + partial balance);
      // "Assigned" is the fully-placed ones.
      if (poolFilter === "pending" && item.kind === "assigned") return;
      if (poolFilter === "assigned" && item.kind !== "assigned") return;
      if (poolFilter === "this_vehicle" && !item.onThisVehicle) return;
      // Filter-card facets (status / vehicle / supervisor) narrow further.
      if (statusFilter === "pending" && item.kind === "assigned") return;
      if (statusFilter === "assigned" && item.kind !== "assigned") return;
      if (
        vehicleFilter &&
        !parts.some((p) => p.tripNo === filterTripNo) &&
        // A pending shop still shows while the filtered truck is the chosen one.
        !(filterTripNo === thisTripNo && item.kind !== "assigned")
      )
        return;
      if (
        supervisorFilter &&
        !parts.some((p) => supervisorOfTrip(p.tripNo) === supervisorFilter)
      )
        return;
      const city = villageOf(row.shopId, row.shopName, shopDirectory);
      if (cityFilterSet.size > 0 && !cityFilterSet.has(city)) return;
      if (q) {
        const hay =
          `${row.shopName} ${city} ${parts.map((p) => `${p.vehicleNo} ${p.tripNo}`).join(" ")}`.toLowerCase();
        if (q && !hay.includes(q)) return;
      }
      list.push(item);
    });
    const sortable = (row: PoolRow) => ({
      name: row.shopName || "",
      city: villageOf(row.shopId, row.shopName, shopDirectory),
      birds: Number(row.birds) || 0,
      boxes: rowBoxes(row),
      weight: orderWeightBasis
        ? weightForBirds(Number(row.birds) || 0, orderWeightBasis)
        : 0,
      sequence: row.poolIndex,
      vehicle: row.parts[0]?.vehicleNo ?? "",
      trip: row.parts[0]?.tripNo ?? "",
      assigned: row.kind === "assigned",
    });
    list.sort((a, b) =>
      compareAssignmentRows(sortable(a), sortable(b), sortMode),
    );
    return list;
  }, [
    collection,
    q,
    poolFilter,
    cityFilterSet,
    thisTripNo,
    filterTripNo,
    vehicleFilter,
    supervisorFilter,
    supervisorOfTrip,
    statusFilter,
    shopDirectory,
    sortMode,
    orderWeightBasis,
  ]);

  const [availablePage, setAvailablePage] = useState(1);
  const [lastResetVersion, setLastResetVersion] = useState(resetVersion);
  if (lastResetVersion !== resetVersion) {
    setLastResetVersion(resetVersion);
    setPoolFilter("pending");
    setAvailablePage(1);
  }

  const [availablePageSize, setAvailablePageSize] = useState(10);
  const availableKey = `${q}|${poolFilter}|${cityFilters.join(",")}|${vehicleFilter}|${supervisorFilter}|${statusFilter}|${sortMode}|${availablePageSize}`;
  const [lastAvailableKey, setLastAvailableKey] = useState(availableKey);
  if (lastAvailableKey !== availableKey) {
    setLastAvailableKey(availableKey);
    if (availablePage !== 1) setAvailablePage(1);
  }
  const availableTotalPages = Math.max(
    1,
    Math.ceil(filteredPool.length / availablePageSize),
  );
  const safeAvailablePage = Math.min(availablePage, availableTotalPages);
  const availableStartIndex =
    filteredPool.length === 0 ? 0 : (safeAvailablePage - 1) * availablePageSize;
  const pageAvailable = filteredPool.slice(
    (safeAvailablePage - 1) * availablePageSize,
    safeAvailablePage * availablePageSize,
  );

  // ── Delivery state of a selected shop from persisted day data ───────────
  // ── Render — VEHICLE-FIRST: the trucks that finished Step 2 are listed
  //     with their trip / vehicle / supervisor / farm / capacity facts, and a
  //     › arrow opens that vehicle's shop-assignment panel. ─────────────────
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* ── LEFT — the day's vehicles: the ones still WAITING for shops on
          top, the ones that already carry shops below. Picking one drives the
          shop panel on the right. ───────────────────────────────────────── */}
      <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[336px]">
        <div className={opsTableCardClass}>
          <div className={opsTableHeaderBarClass}>
            <span className={opsSectionTitleClass}>
              {to("orders.vehicles_ready")}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {pendingVehicles.length}
            </span>
          </div>
          {eligibleVehicles.length === 0 ? (
            <div className="px-4 py-5">
              <OrdersEmptyState title={to("orders.no_eligible_vehicles")} />
            </div>
          ) : pendingVehicles.length === 0 ? (
            <div className="px-4 py-5">
              <OrdersEmptyState title={to("orders.no_search_results")} />
            </div>
          ) : (
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto">
              <ul className="divide-y divide-slate-100">
                {pendingVehicles.map((v, index) => {
                  const city = farmCityOf(v.trip);
                  const shops = savedShopsOn(v.trip.tripNo);
                  const selectedCard = vehicleTripId === v.trip.id;
                  return (
                    <li
                      key={v.trip.id}
                      className="motion-safe:animate-[var(--animate-fade-in-up)]"
                      style={{
                        animationDelay: `${Math.min(index, 10) * 30}ms`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setVehicleTripId(v.trip.id)}
                        aria-label={`${to("orders.assign_shops")} — ${v.trip.vehicleNo || "—"} · ${v.trip.tripNo}`}
                        aria-current={selectedCard ? "true" : undefined}
                        className={`w-full border-l-[3px] px-3.5 py-3 text-left transition-colors ${
                          selectedCard
                            ? "border-emerald-500 bg-emerald-50/70"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold tracking-wide text-slate-800">
                            {formatVehicleNumber(v.trip.vehicleNo)}
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                            {v.trip.tripNo || "—"}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] font-medium text-slate-500">
                          {v.trip.supervisorName || "—"} ·{" "}
                          {v.trip.driverName || "—"}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                          <span>{city}</span>
                          <span className="text-slate-300">·</span>
                          <span>
                            {formatCount(v.capacity)} {to("orders.boxes_short")}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={
                              shops > 0 ? "text-emerald-700" : "text-amber-600"
                            }
                          >
                            {shops > 0
                              ? to("orders.vehicle_shops_assigned", {
                                  n: shops,
                                })
                              : to("orders.vehicle_shops_none")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* ── RIGHT — the shops for the vehicle picked on the left: the
          collected-shops pool (to assign or already assigned) plus the
          delivery sequence and the save actions. ───────────────────────── */}
      <section className="min-w-0 flex-1">
        {/* ASSIGNMENT PANEL — the chosen truck: its facts on top, the shop
            pool and the delivery sequence in the body, and Save / WhatsApp /
            Submit in the footer. */}
        {
          <div
            aria-label={`${to("orders.assign_shops")} — ${vehicle?.trip.vehicleNo || vehicle?.trip.tripNo || ""}`}
            className={opsTableCardClass}
          >
            <div className="flex w-full flex-col overflow-hidden">
              {/* ── Header — same anatomy as the Recent tables: icon tile ·
                  title · selected-tab count · status toggle · close ── */}
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-3 lg:flex-row lg:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/70 text-emerald-500 shadow-inner">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-slate-800">
                      {to("orders.assign_shops")}
                    </h3>
                  </div>

                  {/* Selected-tab count beside the title (updates on every toggle). */}
                  <span
                    key={filteredPool.length}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 shadow-sm motion-safe:animate-[var(--animate-pop-in)]"
                  >
                    {filteredPool.length}
                  </span>

                  {/* Status toggle — labels only, Recent-table chrome and tints. */}
                  <div
                    role="group"
                    aria-label={to("orders.filter_status")}
                    className="ml-2 flex items-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 shadow-sm"
                  >
                    {(
                      [
                        {
                          value: "all",
                          labelKey: "orders.pool_filter_all",
                          tone: "bg-slate-200/70 text-slate-700 shadow-sm",
                        },
                        {
                          value: "pending",
                          labelKey: "orders.pool_filter_pending",
                          tone: "bg-orange-50/80 text-orange-500 shadow-sm",
                        },
                        {
                          value: "assigned",
                          labelKey: "orders.pool_filter_assigned",
                          tone: "bg-emerald-50/80 text-emerald-500 shadow-sm",
                        },
                        {
                          value: "this_vehicle",
                          labelKey: "orders.pool_filter_this_vehicle",
                          tone: "bg-sky-50/80 text-sky-500 shadow-sm",
                          needsVehicle: true,
                        },
                      ] as Array<{
                        value: "all" | "pending" | "assigned" | "this_vehicle";
                        labelKey: string;
                        tone: string;
                        needsVehicle?: boolean;
                      }>
                    ).map((opt) => {
                      const isActive = poolFilter === opt.value;
                      const disabled = opt.needsVehicle === true && !vehicle;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPoolFilter(opt.value)}
                          disabled={disabled}
                          aria-pressed={isActive}
                          title={
                            disabled
                              ? to("orders.select_vehicle")
                              : to(opt.labelKey)
                          }
                          className={`inline-flex items-center whitespace-nowrap rounded-md px-5 py-1.5 text-xs font-semibold transition-all ${
                            isActive
                              ? opt.tone
                              : "bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {to(opt.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVehicleTripId(null)}
                  aria-label={to("orders.close")}
                  className="group self-end rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:self-auto"
                >
                  <X size={17} className={uiActionIconMotionClass.close} />
                </button>
              </div>

              {/* ── Body: shop pool + delivery sequence ── */}
              <div className="min-h-0">
                {/* 1 — Day pool: pending + assigned collected shops (select
          pending shops one by one; assigned rows are visible, locked).
          Sticky toolbar so search + filters stay in reach on ~100-shop days. */}
                <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur">
                  {/* Live summary pills — status toggle now lives in the header. */}
                  <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selected.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                          <CheckCheck size={12} aria-hidden />
                          {to("orders.selected_shops")}: {selected.length}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        {to("orders.pool_showing", {
                          shown: filteredPool.length,
                          total: collection.totalShops,
                          selected: selected.length,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                {filteredPool.length === 0 ? (
                  <div className="px-4 py-5">
                    <OrdersEmptyState
                      title={
                        q
                          ? to("orders.no_search_results")
                          : poolFilter !== "all" || cityFilters.length > 0
                            ? to("orders.no_filter_results")
                            : to("orders.pool_summary", {
                                collected: collection.totalShops,
                                assigned: collection.assignedShops,
                                available: 0,
                              })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table
                        className={`w-full min-w-[760px] table-fixed ${ORDERS_TABLE_FONT_CLASS}`}
                      >
                        {/* Fixed column plan — Shop and City share the
                            remaining width equally, so there is never a wide
                            gap between them; numeric columns are equal too. */}
                        <colgroup>
                          <col className="w-16" />
                          <col />
                          <col />
                          <col className="w-[13%]" />
                          <col className="w-[13%]" />
                          <col className="w-[13%]" />
                        </colgroup>
                        <thead>
                          <tr className={opsTableHeadRowClass}>
                            {/* S.No doubles as the selector: a ticked number
                                = selected shop (no separate checkbox column). */}
                            <th
                              className={`${opsTableThClass} text-center`}
                              title={to("orders.select_col")}
                            >
                              {to("orders.col_sno")}
                            </th>
                            <th className={`${opsTableThClass} text-left`}>
                              {to("orders.col_shop_name")}
                            </th>
                            <th className={`${opsTableThClass} text-left`}>
                              {to("orders.col_village")}
                            </th>
                            <th className={`${opsTableThClass} text-right`}>
                              {to("orders.col_birds")}
                            </th>
                            <th className={`${opsTableThClass} text-right`}>
                              {to("orders.ordered_boxes")}
                            </th>
                            <th className={`${opsTableThClass} text-right`}>
                              {to("orders.weight")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className={opsTableDivideClass}>
                          {pageAvailable.map((row, index) => {
                            const checked = selectedIds.has(row.shopId);
                            const isLockedRow = row.kind === "assigned";
                            // Two-tone rows; a checked row's emerald state colour wins.
                            const tone =
                              checked && !isLockedRow
                                ? "bg-emerald-50/50"
                                : ordersZebraTone(index);
                            return (
                              <tr
                                key={row.shopId}
                                className={`${opsTableRowClass} ${tone} motion-safe:animate-[var(--animate-fade-in-up)] ${
                                  isLockedRow
                                    ? "cursor-default opacity-60"
                                    : "cursor-pointer"
                                }`}
                                style={{
                                  animationDelay: `${Math.min(index, 12) * 24}ms`,
                                }}
                                onClick={() => {
                                  if (!isLockedRow)
                                    toggleShop(
                                      row,
                                      !checked,
                                      row.assignedElsewhere,
                                    );
                                }}
                              >
                                <td
                                  className={`${opsTableTdClass} text-center`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* S.No chip IS the selector: number when
                                      idle, tick when selected, lock-dim when
                                      the shop is already fully assigned. */}
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={checked}
                                    disabled={isLockedRow}
                                    onClick={() =>
                                      toggleShop(
                                        row,
                                        !checked,
                                        row.assignedElsewhere,
                                      )
                                    }
                                    aria-label={`${to("orders.select_col")} — ${row.shopName}`}
                                    className={`inline-flex h-7 w-8 items-center justify-center rounded-lg border text-[12px] font-semibold tabular-nums transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                                      checked
                                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm motion-safe:animate-[var(--animate-pop-in)]"
                                        : isLockedRow
                                          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                                    }`}
                                  >
                                    {checked ? (
                                      <CheckCheck size={14} aria-hidden />
                                    ) : (
                                      availableStartIndex + index + 1
                                    )}
                                  </button>
                                </td>
                                <td
                                  className={`${opsTableTdClass} font-semibold text-slate-800`}
                                >
                                  {row.shopName || "—"}
                                </td>
                                <td className={opsTableTdClass}>
                                  {villageOf(
                                    row.shopId,
                                    row.shopName,
                                    shopDirectory,
                                  ) || "—"}
                                </td>
                                <td
                                  className={`${opsTableTdClass} text-right tabular-nums font-medium`}
                                >
                                  {formatCount(Number(row.birds) || 0)}
                                </td>
                                <td
                                  className={`${opsTableTdClass} text-right tabular-nums font-semibold text-emerald-800`}
                                >
                                  {formatCount(
                                    Math.max(1, Number(row.boxNo) || 0),
                                  )}
                                </td>
                                <td
                                  className={`${opsTableTdClass} text-right tabular-nums text-slate-500`}
                                >
                                  {orderWeightBasis
                                    ? formatKg(
                                        weightForBirds(
                                          Number(row.birds) || 0,
                                          orderWeightBasis,
                                        ),
                                      )
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      page={safeAvailablePage}
                      pageSize={availablePageSize}
                      totalItems={filteredPool.length}
                      onPageChange={setAvailablePage}
                      onPageSizeChange={(size) => {
                        setAvailablePageSize(size);
                        setAvailablePage(1);
                      }}
                    />
                  </>
                )}

                {/* 2 — Selected shops → select vehicle → sequence & boxes */}
                {selected.length === 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {to("orders.selected_shops")}: <b>0</b>
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {to("orders.sequence_empty_hint")}
                    </p>
                  </div>
                )}
                {selected.length > 0 && (
                  <>
                    <div className="border-t border-slate-200 bg-emerald-50/60 px-4 py-2.5 flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        {to("orders.selected_shops")}: <b>{selected.length}</b>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {to("orders.assign_hint")}
                      </span>
                      {/* One-click sequence sorting — with ~45 shops on a vehicle,
                sorting the list beats dragging it row by row. */}
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {to("orders.sequence_sort")}:
                        </span>
                        <button
                          type="button"
                          onClick={() => sortSelected("shop_az")}
                          disabled={busy || selected.length < 2}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40"
                        >
                          {to("orders.seq_shop_az")}
                        </button>
                        <button
                          type="button"
                          onClick={() => sortSelected("village_az")}
                          disabled={busy || selected.length < 2}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40"
                        >
                          {to("orders.seq_village_az")}
                        </button>
                      </span>
                      {/* The vehicle comes from the › row above — no second selector. */}
                      <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                        {vehicle
                          ? `${vehicle.trip.tripNo} · ${formatVehicleNumber(vehicle.trip.vehicleNo)}`
                          : "—"}
                      </span>
                    </div>

                    {vehicle && (
                      <>
                        {/* Live capacity only — the truck's static facts already sit in
                  the sheet header, so they are never repeated here. */}
                        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                          <div className="flex items-center gap-4 flex-wrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600">
                            <span>
                              {to("orders.vehicle_box_capacity")}:{" "}
                              <b className="text-slate-800">{capacity}</b>
                            </span>
                            <span>
                              {to("orders.col_assigned")}:{" "}
                              <b className="text-slate-800">
                                {alreadyAssignedOther + requested}
                              </b>
                            </span>
                            <span>
                              {to("orders.available_boxes")}:{" "}
                              <b
                                className={
                                  remaining < 0
                                    ? "text-rose-600"
                                    : "text-emerald-700"
                                }
                              >
                                {remaining}
                              </b>
                            </span>
                            <span>
                              {to("orders.col_shops")}:{" "}
                              <b className="text-slate-800">
                                {selected.length}
                              </b>
                            </span>
                            <span className="ml-auto text-[11px] text-slate-400">
                              {to("orders.collection_summary", {
                                shops: totals.totalShops,
                                boxes: totals.totalBoxes,
                                birds: totals.totalBirds,
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Assignment table: editable sequence — drag a row, ↑/↓ one
                  step, ⤒/⤓ first/last, or sort the whole list — + boxes. */}
                        <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-1.5 text-[11px] font-semibold text-slate-400">
                          {to("orders.drag_hint")}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          <table
                            className={`w-full min-w-[880px] table-fixed ${ORDERS_TABLE_FONT_CLASS}`}
                          >
                            <colgroup>
                              <col className="w-24" />
                              <col />
                              <col />
                              <col className="w-[11%]" />
                              <col className="w-[11%]" />
                              <col className="w-[18%]" />
                              <col className="w-[11%]" />
                              <col className="w-12" />
                            </colgroup>
                            <thead>
                              <tr className={opsTableHeadRowClass}>
                                <th className={`${opsTableThClass} text-left`}>
                                  {to("orders.col_sequence")}
                                </th>
                                <th className={`${opsTableThClass} text-left`}>
                                  {to("orders.col_shop_name")}
                                </th>
                                <th className={`${opsTableThClass} text-left`}>
                                  {to("orders.col_village")}
                                </th>
                                <th className={`${opsTableThClass} text-right`}>
                                  {to("orders.ordered_birds")}
                                </th>
                                <th className={`${opsTableThClass} text-right`}>
                                  {to("orders.ordered_boxes")}
                                </th>
                                <th className={`${opsTableThClass} text-left`}>
                                  {to("orders.assigned_boxes")}
                                </th>
                                <th className={`${opsTableThClass} text-right`}>
                                  {to("orders.weight")}
                                </th>
                                <th className={opsTableThClass} />
                              </tr>
                            </thead>
                            <tbody className={opsTableDivideClass}>
                              {selected.map((row, index) => {
                                const lifted = dragKey === row.clientKey;
                                const isDropTarget =
                                  dropIndex === index && !!dragKey && !lifted;
                                return (
                                  <tr
                                    key={row.clientKey}
                                    draggable={!busy}
                                    onDragStart={(e) => {
                                      setDragKey(row.clientKey);
                                      setDropIndex(index);
                                      e.dataTransfer.effectAllowed = "move";
                                      try {
                                        e.dataTransfer.setData(
                                          "text/plain",
                                          row.clientKey,
                                        );
                                      } catch {
                                        /* dataTransfer is read-only in some browsers */
                                      }
                                    }}
                                    onDragOver={(e) => {
                                      if (!dragKey) return;
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = "move";
                                      if (dropIndex !== index)
                                        setDropIndex(index);
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const from =
                                        dragKey ||
                                        e.dataTransfer.getData("text/plain");
                                      if (from) moveRowTo(from, index);
                                      setDragKey(null);
                                      setDropIndex(null);
                                    }}
                                    onDragEnd={() => {
                                      setDragKey(null);
                                      setDropIndex(null);
                                    }}
                                    className={`${opsTableRowClass} align-middle ${
                                      isDropTarget
                                        ? "bg-emerald-50/50"
                                        : ordersZebraTone(index)
                                    } ${lifted ? "opacity-40" : ""} ${
                                      isDropTarget
                                        ? "border-t-2 border-t-emerald-500"
                                        : ""
                                    }`}
                                  >
                                    <td className={opsTableTdClass}>
                                      <div className="flex items-center gap-1.5">
                                        {/* Drag handle (the whole row drags as well) */}
                                        <GripVertical
                                          size={14}
                                          aria-label={to("orders.drag_handle")}
                                          className="shrink-0 cursor-grab text-slate-300 active:cursor-grabbing"
                                        />
                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[12px] font-semibold text-emerald-700">
                                          {index + 1}
                                        </span>
                                        {/* ↑ ↓ step one place · ⤒ ⤓ jump to first / last */}
                                        <div className="grid grid-cols-2 -my-1.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveRow(row.clientKey, -1)
                                            }
                                            disabled={index === 0 || busy}
                                            aria-label={`${to("orders.col_sequence")} ↑ ${row.shopName}`}
                                            className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                          >
                                            <ArrowUp size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveRowTo(row.clientKey, 0)
                                            }
                                            disabled={index === 0 || busy}
                                            title={to("orders.move_first")}
                                            aria-label={`${to("orders.move_first")} — ${row.shopName}`}
                                            className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                          >
                                            <ChevronsUp size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveRow(row.clientKey, 1)
                                            }
                                            disabled={
                                              index === selected.length - 1 ||
                                              busy
                                            }
                                            aria-label={`${to("orders.col_sequence")} ↓ ${row.shopName}`}
                                            className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                          >
                                            <ArrowDown size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveRowTo(
                                                row.clientKey,
                                                selected.length - 1,
                                              )
                                            }
                                            disabled={
                                              index === selected.length - 1 ||
                                              busy
                                            }
                                            title={to("orders.move_last")}
                                            aria-label={`${to("orders.move_last")} — ${row.shopName}`}
                                            className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                          >
                                            <ChevronsDown size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                    <td
                                      className={`${opsTableTdClass} font-semibold text-slate-800`}
                                    >
                                      {row.shopName || "—"}
                                    </td>
                                    <td className={opsTableTdClass}>
                                      {row.village || "—"}
                                    </td>
                                    <td
                                      className={`${opsTableTdClass} text-right tabular-nums font-medium`}
                                    >
                                      {formatCount(row.orderedBirds)}
                                    </td>
                                    <td
                                      className={`${opsTableTdClass} text-right tabular-nums font-semibold text-emerald-800`}
                                    >
                                      {formatCount(row.orderedBoxes)}
                                    </td>
                                    <td className={opsTableTdClass}>
                                      {/* PARTIAL ASSIGNMENT: send part of a shop's order on
                                this truck — the balance stays pending for another
                                vehicle. The cap is the shop's REMAINING balance
                                (ordered − boxes already on other vehicles), so
                                splitting 40 into 20 + 20 works while 20 + 40
                                is impossible. */}
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          min={1}
                                          max={maxAssignable(row)}
                                          value={
                                            row.assigned === 0
                                              ? ""
                                              : row.assigned
                                          }
                                          placeholder="0"
                                          aria-label={`${to("orders.assigned_boxes")} — ${row.shopName}`}
                                          onChange={(e) =>
                                            setAssigned(
                                              row.clientKey,
                                              e.target.value,
                                            )
                                          }
                                          onWheel={onOrdersNumberWheel}
                                          className={`${ORDERS_NO_SPINNER} h-8 w-24 rounded-lg border px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                                            row.assigned === 0
                                              ? "border-amber-300 bg-amber-50/60 text-amber-800"
                                              : "border-emerald-300/70 bg-emerald-50/50 text-emerald-900"
                                          }`}
                                        />
                                        <span className="whitespace-nowrap text-[11px] font-semibold text-slate-400">
                                          / {formatCount(maxAssignable(row))}
                                          {row.assignedElsewhere > 0 && (
                                            <span
                                              className="ml-1.5 text-slate-500"
                                              title={to(
                                                "orders.on_other_vehicles",
                                                {
                                                  boxes: row.assignedElsewhere,
                                                },
                                              )}
                                            >
                                              (
                                              {to("orders.on_other_vehicles", {
                                                boxes: row.assignedElsewhere,
                                              })}
                                              )
                                            </span>
                                          )}
                                          {row.assigned > 0 &&
                                            row.assigned <
                                              maxAssignable(row) && (
                                              <span className="ml-1.5 font-semibold text-amber-600">
                                                {to("orders.part_assign_left", {
                                                  boxes:
                                                    maxAssignable(row) -
                                                    row.assigned,
                                                })}
                                              </span>
                                            )}
                                        </span>
                                      </div>
                                    </td>
                                    <td
                                      className={`${opsTableTdClass} text-right tabular-nums text-slate-500`}
                                    >
                                      {orderWeightBasis
                                        ? formatKg(
                                            weightForBirds(
                                              assignedBirdsFor(row),
                                              orderWeightBasis,
                                            ),
                                          )
                                        : "—"}
                                    </td>
                                    <td className={opsTableTdClass}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelected((prev) =>
                                            prev.filter(
                                              (r) =>
                                                r.clientKey !== row.clientKey,
                                            ),
                                          )
                                        }
                                        disabled={busy}
                                        aria-label={`${to("orders.close")} — ${row.shopName}`}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors disabled:opacity-30"
                                      >
                                        <X size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* ── Footer: the message, then the actions ── */}
              <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                      {to("orders.unsaved_changes")}
                    </span>
                  )}
                  {selected.length === 0 && savedOnVehicle > 0 && (
                    <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-1">
                      {to("orders.saved_on_vehicle")}: <b>{savedOnVehicle}</b>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  {/* WhatsApp — real brand icon + green treatment. Opens the CHECK
                POPUP first (message text + branded sheet PDF); the send itself
                happens on the popup's "Confirm & Send". */}
                  <button
                    type="button"
                    onClick={() => setWaPopupOpen(true)}
                    disabled={waBusy || !vehicle || waSheetRows.length === 0}
                    title={to("orders.wa_check_title")}
                    aria-label={to("orders.whatsapp")}
                    className="group inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 pl-1.5 pr-4 text-xs font-bold text-white shadow-md shadow-emerald-600/20 ring-1 ring-emerald-700/30 transition-all duration-200 hover:-translate-y-px hover:from-emerald-400 hover:to-emerald-600 hover:shadow-lg hover:shadow-emerald-600/30 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                  >
                    {/* Brand tile — the WhatsApp glyph sits in its own white
                        badge so the button reads as a branded action. */}
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#25D366] shadow-sm ring-1 ring-black/5">
                      {waBusy ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <WhatsAppIcon
                          size={15}
                          className={uiActionIconMotionClass.whatsapp}
                        />
                      )}
                    </span>
                    {waProgress
                      ? `${to("orders.whatsapp")} · ${waProgress}`
                      : to("orders.whatsapp")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={busy || !vehicle || selected.length === 0}
                    className={`group inline-flex h-10 items-center gap-2 rounded-xl border bg-white pl-1.5 pr-4 text-xs font-bold shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm ${
                      isDirty
                        ? "border-emerald-400 text-emerald-700 hover:bg-emerald-50 motion-safe:animate-[var(--animate-pop-in)]"
                        : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700"
                    }`}
                  >
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shadow-inner transition-colors ${
                        isDirty
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
                      }`}
                    >
                      {saving || conflictChecking ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Save
                          size={15}
                          className={uiActionIconMotionClass.edit}
                        />
                      )}
                    </span>
                    {saving ? to("orders.saving") : to("orders.save_progress")}
                    {isDirty && !saving && (
                      <span
                        aria-hidden
                        className="ml-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-100 motion-safe:animate-pulse"
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
      </section>

      {/* Capacity-exceeded block (clean modal with the exact numbers) */}
      {capacityExceeded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-rose-200">
            <div className="bg-gradient-to-br from-rose-50 to-amber-50 p-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 p-2 rounded-full bg-white/80 border border-rose-200">
                  <AlertTriangle size={20} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {to("orders.capacity_exceeded_title")}
                  </h3>
                  <dl className="mt-2 rounded-lg border border-rose-100 bg-white/80 divide-y divide-rose-50 text-sm">
                    {[
                      [
                        to("orders.vehicle_box_capacity"),
                        capacityExceeded.capacity,
                      ],
                      [
                        to("orders.already_assigned"),
                        capacityExceeded.assigned,
                      ],
                      [
                        to("orders.available_boxes"),
                        capacityExceeded.available,
                      ],
                      [to("orders.requested"), capacityExceeded.requested],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-6 px-3 py-1.5"
                      >
                        <dt className="font-semibold text-slate-500">
                          {label}
                        </dt>
                        <dd className="font-bold text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm font-semibold text-rose-700 mt-2">
                    {to("orders.capacity_exceeded_line")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCapacityExceeded(null)}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white shadow-xs transition-all active:scale-[0.98] bg-rose-600 hover:bg-rose-700"
              >
                {to("orders.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp CHECK POPUP — preview message + branded sheet, then confirm. */}
      {waPopupOpen && vehicle && (
        <OrdersWhatsAppConfirmPopup
          key={vehicle.trip.id}
          trip={vehicle.trip}
          supervisorMobile={supervisorMobile}
          orderTripNo={orderTrip.tripNo}
          orderDate={orderTrip.tripDate}
          rows={waSheetRows}
          capacity={capacity}
          alreadyAssignedOther={alreadyAssignedOther}
          t={to}
          sending={waBusy}
          sendProgress={waProgress}
          onClose={() => {
            if (waBusy) return;
            setWaPopupOpen(false);
            setWaProgress(null);
          }}
          onConfirmSend={handleWhatsAppConfirm}
          onConfirmSubmit={handleFinish}
        />
      )}
    </div>
  );
}

export default React.memo(OrderAssignmentPage);
