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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCheck,
  PackageCheck,
  ChevronsDown,
  ChevronsUp,
  Clock,
  GripVertical,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Calendar,
  ArrowUpDown,
  MapPin,
  Save,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Trip } from "../../../shared/trip";
import {
  opsFilterCardClass,
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
  ORDERS_FILTER_LABEL_CLASS,
  ORDERS_TABLE_FONT_CLASS,
  ordersZebraTone,
  ordersTableZebraRow,
} from "../utils/ordersTableStyles";
import {
  ORDERS_NO_SPINNER,
  OrdersEmptyState,
  OrdersMultiSelect,
  OrdersSearchInput,
  OrdersTableSkeleton,
  OrdersDateControl,
  OrdersDropdown,
  WhatsAppIcon,
  onOrdersNumberWheel,
} from "../components/OrdersCommon";
import { compareAssignmentRows, type AssignmentSort } from "../utils/assignmentSort";
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
function maxAssignable(row: Pick<SelectedRow, "orderedBoxes" | "assignedElsewhere">): number {
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
  rows: SelectedRow[]
): string {
  return JSON.stringify([vehicleTripId, rows.map((r) => [r.shopId, r.assigned])]);
}

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

/** Historical days are inspection-only; never mount a writable editor. */
function AssignmentHistory({ views, query, sortMode, refreshing, cityFilters, shopDirectory, resetVersion }: {
  views: DayVehicleView[]; query: string; sortMode: AssignmentSort; refreshing: boolean; cityFilters: string[]; shopDirectory: ShopDirectory; resetVersion: number;
}) {
  const { to } = useOrdersI18n();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const rows = useMemo(() => {
    const result = views.flatMap(view => view.rows.map(row => ({ ...row, trip: view.trip })))
      .filter(row => {
        const city = villageOf(row.shopId, row.shopName, shopDirectory);
        return (!cityFilters.length || cityFilters.includes(city)) && [row.shopName, city, row.trip.tripNo, row.trip.vehicleNo].join(' ').toLowerCase().includes(query);
      });
    const sortable = (row: typeof result[number]) => ({ name: row.shopName, city: villageOf(row.shopId, row.shopName, shopDirectory), birds: row.birds, boxes: row.boxes, weight: 0, sequence: row.sequence, vehicle: row.trip.vehicleNo ?? '', trip: row.trip.tripNo, assigned: row.delivered });
    return result.sort((a, b) => compareAssignmentRows(sortable(a), sortable(b), sortMode));
  }, [views, query, sortMode, cityFilters, shopDirectory]);
  const resetKey = `${query}|${sortMode}|${pageSize}|${cityFilters.join(',')}|${resetVersion}`;
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) { setLastKey(resetKey); setPage(1); }
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  return <>
    <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">{to("orders.read_only_note")}</div>
    <div className="overflow-x-auto" aria-busy={refreshing}>
      <table className={`w-full ${ORDERS_TABLE_FONT_CLASS}`}>
        <thead><tr className={opsTableHeadRowClass}>
          {["orders.col_sno", "orders.col_shop_name", "orders.col_village", "orders.col_trip_no", "orders.col_vehicle_no", "orders.col_boxes", "orders.col_birds"].map(key => <th key={key} className={opsTableThClass}>{to(key)}</th>)}
        </tr></thead>
        <tbody>{refreshing ? <tr><td colSpan={7}><OrdersTableSkeleton rows={5} /></td></tr> : rows.slice((safePage - 1) * pageSize, safePage * pageSize).map((row, index) => <tr key={`${row.trip.id}-${row.shopId}`} className={ordersTableZebraRow(index)}>
          <td className={opsTableTdClass}>{(safePage - 1) * pageSize + index + 1}</td><td className={opsTableTdClass}>{row.shopName}</td><td className={opsTableTdClass}>{villageOf(row.shopId, row.shopName, shopDirectory)}</td><td className={opsTableTdClass}>{row.trip.tripNo}</td><td className={opsTableTdClass}>{row.trip.vehicleNo}</td><td className={opsTableTdClass}>{row.boxes}</td><td className={opsTableTdClass}>{row.birds}</td>
        </tr>)}</tbody>
      </table>
      {!refreshing && rows.length === 0 && <OrdersEmptyState title={to("orders.no_search_results")} />}
    </div>
    <Pagination page={safePage} pageSize={pageSize} totalItems={rows.length} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={refreshing} />
  </>;
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
  const [resetVersion, setResetVersion] = useState(0);
  const cityOptions = useMemo(() => {
    const rows = day < today ? dayVehicleViews.flatMap(view => view.rows) : collection?.rows ?? [];
    return [...new Set(rows.map(row => villageOf(row.shopId, row.shopName, shopDirectory).trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)).map(city => ({ value: city, label: city }));
  }, [day, today, dayVehicleViews, collection, shopDirectory]);
  const sortOptions = useMemo(() => {
    const modes: AssignmentSort[] = ['pending', 'sequence', 'az', 'za', 'city_az', 'city_za', 'birds_asc', 'birds_desc', 'boxes_asc', 'boxes_desc', ...(day === today ? ['weight_asc', 'weight_desc'] as AssignmentSort[] : []), 'vehicle_trip'];
    const existing: Partial<Record<AssignmentSort, string>> = { pending: 'orders.sort_pending_first', az: 'orders.sort_name_az', za: 'orders.sort_name_za', vehicle_trip: 'orders.sort_vehicle_trip' };
    return modes.map(value => ({ value, label: to(existing[value] ?? `orders.sort_${value}`) }));
  }, [day, today, to]);
  const resetFilters = () => {
    setQuery('');
    setSortMode('pending');
    setCityFilters([]);
    setResetVersion(value => value + 1);
    // Reset to today. Today's mounted editor is not remounted, so picks survive.
    if (day !== today) onDaySelect(today);
  };


  if (loading) return <OrdersTableSkeleton rows={4} />;

  return (
    <div className="space-y-5">
      <section className={opsFilterCardClass} aria-label={to('orders.assignment_filters')}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className={ORDERS_FILTER_LABEL_CLASS}><Calendar size={17} className="text-emerald-500 flex-shrink-0" /><span>{to('orders.col_date')}</span></div>
            <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} hideDayChip className="w-full" fieldClassName="w-full" />
          </div>
          <div>
            <div className={ORDERS_FILTER_LABEL_CLASS}><ArrowUpDown size={17} className="text-violet-500 flex-shrink-0" /><span>{to('orders.sort')}</span></div>
            <OrdersDropdown value={sortMode} onChange={value => setSortMode(value as AssignmentSort)} ariaLabel={to('orders.sort')} options={sortOptions} className="w-full" widthClass="w-full" />
          </div>
          <div>
            {/* No Search glyph on the label — the field already carries one. */}
            <div className={ORDERS_FILTER_LABEL_CLASS}><span>{to('orders.search_label')}</span></div>
            <OrdersSearchInput value={query} onChange={setQuery} placeholder={to('orders.search_assignment')} className="w-full" />
          </div>
          <div>
            <div className={ORDERS_FILTER_LABEL_CLASS}><MapPin size={17} className="text-amber-500 flex-shrink-0" /><span>{to('orders.city')}</span></div>
            <OrdersMultiSelect values={cityFilters} onChange={setCityFilters} options={cityOptions} ariaLabel={to('orders.filter_city')} placeholder={to('orders.filter_city_all')} className="w-full" widthClass="w-full" />
          </div>
          <div className="flex items-end justify-end gap-2 sm:col-span-2 xl:col-span-4">
            <button type="button" onClick={resetFilters} className={`group ${opsSecondaryButtonClass}`} aria-label={to('common.reset')}>
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>{to('common.reset')}
            </button>
            <BrandRefreshButton onClick={onRefresh} loading={refreshing} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" aria-label={to('orders.tab_assignment')}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner"><PackageCheck size={20} aria-hidden /></span>
            <h2 className="text-base font-bold tracking-tight text-slate-800">{to('orders.tab_assignment')}</h2>
          </div>
          <span className="text-xs font-medium text-slate-500">{to('orders.pool_summary', { collected: collection?.totalShops ?? 0, assigned: collection?.assignedShops ?? 0, available: (collection?.totalShops ?? 0) - (collection?.assignedShops ?? 0) })}</span>
        </div>

      {day < today ? (
        <AssignmentHistory key={day} views={dayVehicleViews} query={q} sortMode={sortMode} refreshing={refreshing} cityFilters={cityFilters} shopDirectory={shopDirectory} resetVersion={resetVersion} />
      ) : !collection ? (
        <OrdersEmptyState
          title={to("orders.assignment_empty")}
          hint={to("orders.select_order")}
        />
      ) : (
        <div className="relative" aria-busy={refreshing}>
        {refreshing && <div className="absolute inset-0 z-20 bg-white/90"><OrdersTableSkeleton rows={6} /></div>}
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
    const assigned: Array<{ row: OrderShopRow; tripNo: string; vehicleNo: string; delivered: boolean }> = [];
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
    [eligibleVehicles, vehicleTripId]
  );

  // ── Step 3: selection (one shop at a time) + Step 5/6: order & boxes ─────
  const [selected, setSelected] = useState<SelectedRow[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    selectionSnapshot(null, [])
  );
  const isDirty =
    selectionSnapshot(vehicleTripId, selected) !== savedSnapshot;

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
    [selected]
  );

  const toggleShop = useCallback((row: OrderShopRow, checked: boolean, assignedElsewhere = 0) => {
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
  }, [shopDirectory]);

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

  const moveRow = useCallback(
    (clientKey: string, dir: -1 | 1) => {
      setSelected((prev) => {
        const from = prev.findIndex((r) => r.clientKey === clientKey);
        if (from < 0) return prev;
        return moveInSequence(prev, from, from + dir);
      });
    },
    []
  );

  const sortSelected = useCallback((mode: "shop_az" | "village_az") => {
    setSelected((prev) => {
      const next = [...prev];
      next.sort((a, b) =>
        mode === "shop_az"
          ? (a.shopName || "").localeCompare(b.shopName || "")
          : (a.village || "").localeCompare(b.village || "") ||
            (a.shopName || "").localeCompare(b.shopName || "")
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
        const n = Math.max(0, Math.min(maxAssignable(r), Math.floor(Number(raw) || 0)));
        return { ...r, assigned: n };
      })
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
    () => (vehicle ? planShareBoxes(orderRowsOnTrip(vehicle.trip, orderTrip.tripNo)) : 0),
    [vehicle, orderTrip.tripNo]
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
    [savedShopsByTripNo]
  );

  // The vehicle list is split in two so the operator sees at a glance which
  // trucks are still WAITING for shops and which ones already carry them.
  const vehicleMatches = useCallback(
    (v: OrdersEligibleVehicle): boolean => {
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
    [q]
  );

  const pendingVehicles = useMemo(
    () => eligibleVehicles.filter((v) => vehicleMatches(v)),
    [eligibleVehicles, vehicleMatches]
  );

  const savedOnVehicle = useMemo(
    () =>
      vehicle
        ? pool.assigned.filter((a) => a.tripNo === vehicle.trip.tripNo && !a.delivered).length
        : 0,
    [pool.assigned, vehicle]
  );
  const remaining = available - requested;
  const totals = useMemo(() => collectionTotals(toOrderShopRows(selected)), [selected]);

  const checkCapacity = useCallback((): boolean => {
    if (!vehicle) {
      showNotification(to("orders.select_vehicle"), "info");
      return false;
    }
    if (requested > available) {
      setCapacityExceeded({ capacity, assigned: alreadyAssignedOther, available, requested });
      return false;
    }
    return true;
  }, [vehicle, requested, available, capacity, alreadyAssignedOther, showNotification, to]);

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
        selected.map((r) => ({ shopId: r.shopId, shopName: r.shopName, boxes: r.assigned })),
        vehicle.trip.tripNo
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
                : r
            )
            .filter((r) => r.assigned > 0)
        );
        showNotification(
          to("orders.over_assign_message", {
            shops: issues
              .map((i) => `${i.shopName} (${i.requested} > ${i.remaining} left)`)
              .join(", "),
          }),
          "error"
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
  }, [busy, vehicle, checkCapacity, selected, assertFitsBalance, orderTrip.tripNo, showNotification, to, onChanged, vehicleTripId]);

  const handleFinish = useCallback(async () => {
    if (persistLockRef.current || busy || !vehicle) return;
    if (!checkCapacity()) return;
    const rows =
      selected.length > 0
        ? toOrderShopRows(selected)
        : (orderRowsOnTrip(vehicle.trip, orderTrip.tripNo).filter((r) => !isCapturedRow(r)) as unknown as OrderShopRow[]);
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
  }, [busy, vehicle, checkCapacity, selected, assertFitsBalance, orderTrip.tripNo, showNotification, to, onFinished]);

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
        showNotification(to("orders.whatsapp_failed", { message: "Supervisor mobile missing" }), "error");
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
            (r) => !isCapturedRow(r)
          );
          const byShop = new Map(saved.map((r) => [r.shopId, r]));
          const reordered = orderedShopIds.flatMap((id) => {
            const row = byShop.get(id);
            return row ? [row] : [];
          });
          payload = reordered.map(
            (r, i) => ({ ...r, serialNo: i + 1 }) as unknown as OrderShopRow
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
            selectionSnapshot(vehicleTripId, reorderedSelection ?? selected)
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
          (sent, total, shop) => setWaProgress(shop || `${sent}/${total}`)
        );
        if (result.enabled && result.sent > 0 && result.failed === 0) {
          // Success UI lives on the confirm popup — never toast success here.
        } else if (result.sent > 0) {
          showNotification(to("orders.whatsapp_partial", { sent: result.sent, failed: result.failed }), "info");
        } else {
          const message =
            !result.enabled || (result.message && result.message.includes("not configured"))
              ? to("orders.whatsapp_not_configured")
              : result.message === "no_rows"
                ? to("orders.whatsapp_no_rows")
                : to("orders.whatsapp_failed", { message: result.message ?? "—" });
          showNotification(message, "error");
        }
        return result;
      } catch {
        showNotification(to("orders.whatsapp_failed", { message: "network" }), "error");
        return null;
      } finally {
        persistLockRef.current = false;
        setWaBusy(false);
      }
    },
    [waBusy, vehicle, isDirty, selected, assertFitsBalance, orderTrip.tripNo, vehicleTripId, supervisorMobile, showNotification, onChanged, to]
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
  // ── Status counts for the segmented filter (same kind rules as
  //     filteredPool below: "pending" = still needs a vehicle, i.e. pending
  //     + partial-balance rows; "assigned" = fully placed).
  const poolCounts = useMemo(() => {
    const counts = { all: collection.rows.length, pending: 0, assigned: 0, thisVehicle: 0 };
    for (const row of collection.rows) {
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
      const kind =
        parts.length === 0 ? "pending" : remainingBoxes > 0 && !onThisVehicle ? "partial" : "assigned";
      if (kind === "assigned") counts.assigned += 1;
      else counts.pending += 1;
      if (onThisVehicle) counts.thisVehicle += 1;
    }
    return counts;
  }, [collection, thisTripNo]);
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
      const onThisVehicle = boxesOnThisVehicle > 0 || parts.some((p) => p.tripNo === thisTripNo);
      const remainingBoxes = Math.max(0, orderedBoxes - partsTotal);
      const kind: PoolRow["kind"] =
        parts.length === 0 ? "pending" : remainingBoxes > 0 && !onThisVehicle ? "partial" : "assigned";
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
      name: row.shopName || '', city: villageOf(row.shopId, row.shopName, shopDirectory),
      birds: Number(row.birds) || 0, boxes: rowBoxes(row),
      weight: orderWeightBasis ? weightForBirds(Number(row.birds) || 0, orderWeightBasis) : 0,
      sequence: row.poolIndex, vehicle: row.parts[0]?.vehicleNo ?? '', trip: row.parts[0]?.tripNo ?? '', assigned: row.kind === 'assigned',
    });
    list.sort((a, b) => compareAssignmentRows(sortable(a), sortable(b), sortMode));
    return list;
  }, [collection, q, poolFilter, cityFilterSet, thisTripNo, shopDirectory, sortMode, orderWeightBasis]);

  const [availablePage, setAvailablePage] = useState(1);
  const [lastResetVersion, setLastResetVersion] = useState(resetVersion);
  if (lastResetVersion !== resetVersion) {
    setLastResetVersion(resetVersion);
    setPoolFilter('pending');
    setAvailablePage(1);
  }

  const [availablePageSize, setAvailablePageSize] = useState(10);
  const availableKey = `${q}|${poolFilter}|${cityFilters.join(",")}|${sortMode}|${availablePageSize}`;
  const [lastAvailableKey, setLastAvailableKey] = useState(availableKey);
  if (lastAvailableKey !== availableKey) {
    setLastAvailableKey(availableKey);
    if (availablePage !== 1) setAvailablePage(1);
  }
  const availableTotalPages = Math.max(
    1,
    Math.ceil(filteredPool.length / availablePageSize)
  );
  const safeAvailablePage = Math.min(availablePage, availableTotalPages);
  const availableStartIndex =
    filteredPool.length === 0 ? 0 : (safeAvailablePage - 1) * availablePageSize;
  const pageAvailable = filteredPool.slice(
    (safeAvailablePage - 1) * availablePageSize,
    safeAvailablePage * availablePageSize
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
            <span className={opsSectionTitleClass}>{to("orders.vehicles_ready")}</span>
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
                      {pendingVehicles.map((v) => {
                        const city = farmCityOf(v.trip);
                        const shops = savedShopsOn(v.trip.tripNo);
                        const selectedCard = vehicleTripId === v.trip.id;
                        return (
                          <li key={v.trip.id}>
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
                                <span className="truncate text-xs font-semibold text-slate-800">
                                  {v.trip.vehicleNo || "—"}
                                </span>
                                <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                                  {v.trip.tripNo || "—"}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] font-medium text-slate-500">
                                {v.trip.supervisorName || "—"} · {v.trip.driverName || "—"}
                              </span>
                              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                                <span>{city}</span>
                                <span className="text-slate-300">·</span>
                                <span>
                                  {formatCount(v.capacity)} {to("orders.boxes_short")}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className={shops > 0 ? "text-emerald-700" : "text-amber-600"}>
                                  {shops > 0
                                    ? to("orders.vehicle_shops_assigned", { n: shops })
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
        {(
        <div
          aria-label={`${to("orders.assign_shops")} — ${vehicle?.trip.vehicleNo || vehicle?.trip.tripNo || ""}`}
          className={opsTableCardClass}
        >
          <div className="flex w-full flex-col overflow-hidden">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600">
                  <PackageCheck size={17} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-800">
                    {to("orders.assign_shops")}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVehicleTripId(null)}
                aria-label={to("orders.close")}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            {/* ── Body: shop pool + delivery sequence ── */}
            <div className="min-h-0">
      {/* 1 — Day pool: pending + assigned collected shops (select
          pending shops one by one; assigned rows are visible, locked).
          Sticky toolbar so search + filters stay in reach on ~100-shop days. */}
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur">
        {/* Filter controls: search + status + city, with live summary pills.
            Narrows the table only — ticked shops stay selected. */}
        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
          <div
            role="group"
            aria-label={to("orders.filter_status")}
            className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/90 p-1"
          >
            {(
              [
                { value: "all", labelKey: "orders.pool_filter_all", count: poolCounts.all, icon: LayoutGrid },
                { value: "pending", labelKey: "orders.pool_filter_pending", count: poolCounts.pending, icon: Clock },
                { value: "assigned", labelKey: "orders.pool_filter_assigned", count: poolCounts.assigned, icon: CheckCheck },
                {
                  value: "this_vehicle",
                  labelKey: "orders.pool_filter_this_vehicle",
                  count: poolCounts.thisVehicle,
                  icon: Truck,
                  needsVehicle: true,
                },
              ] as Array<{
                value: "all" | "pending" | "assigned" | "this_vehicle";
                labelKey: string;
                count: number;
                icon: LucideIcon;
                needsVehicle?: boolean;
              }>
            ).map((opt) => {
              const active = poolFilter === opt.value;
              const disabled = opt.needsVehicle === true && !vehicle;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPoolFilter(opt.value)}
                  disabled={disabled}
                  aria-pressed={active}
                  title={disabled ? to("orders.select_vehicle") : to(opt.labelKey)}
                  className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold whitespace-nowrap transition-all ${
                    active
                      ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-900/5"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <Icon size={13} aria-hidden className={active ? "text-emerald-600" : "text-slate-400"} />
                  {to(opt.labelKey)}
                  <span
                    className={`rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums ${
                      active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200/70 text-slate-500"
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
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
            <table className={`w-full min-w-[980px] ${ORDERS_TABLE_FONT_CLASS}`}>
              <thead>
                <tr className={opsTableHeadRowClass}>
                  <th className={`${opsTableThClass} w-14`}>{to("orders.select_col")}</th>
                  <th className={`${opsTableThClass} w-14`}>{to("orders.col_sno")}</th>
                  <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                  <th className={opsTableThClass}>{to("orders.col_village")}</th>
                  <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.col_birds")}</th>
                  <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.ordered_boxes")}</th>
                  <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.weight")}</th>
                </tr>
              </thead>
              <tbody className={opsTableDivideClass}>
                {pageAvailable.map((row, index) => {
                  const checked = selectedIds.has(row.shopId);
                  const isLockedRow = row.kind === "assigned";
                  // Two-tone rows; a checked row's emerald state colour wins.
                           const tone = checked && !isLockedRow ? "bg-emerald-50/50" : ordersZebraTone(index);
                  return (
                    <tr
                      key={row.shopId}
                      className={`${opsTableRowClass} ${tone} ${
                        isLockedRow
                          ? "cursor-default opacity-60"
                          : "cursor-pointer"
                      }`}
                      onClick={() => {
                        if (!isLockedRow) toggleShop(row, !checked, row.assignedElsewhere);
                      }}
                    >
                      <td className={opsTableTdClass} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isLockedRow}
                          onChange={(e) => toggleShop(row, e.target.checked, row.assignedElsewhere)}
                          aria-label={`${to("orders.select_col")} — ${row.shopName}`}
                          className={`h-4 w-4 accent-emerald-600 ${
                            isLockedRow ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                          }`}
                        />
                      </td>
                      <td className={opsTableTdClass}>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[12px] font-semibold text-slate-600">
                          {availableStartIndex + index + 1}
                        </span>
                      </td>
                      <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                        {row.shopName || "—"}
                      </td>
                      <td className={opsTableTdClass}>
                        {villageOf(row.shopId, row.shopName, shopDirectory) || "—"}
                      </td>
                      <td className={`${opsTableTdClass} text-right font-medium`}>
                        {formatCount(Number(row.birds) || 0)}
                      </td>
                      <td className={`${opsTableTdClass} text-right font-semibold text-emerald-800`}>
                        {formatCount(Math.max(1, Number(row.boxNo) || 0))}
                      </td>
                      <td className={`${opsTableTdClass} text-right text-slate-500`}>
                        {orderWeightBasis
                          ? formatKg(weightForBirds(Number(row.birds) || 0, orderWeightBasis))
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
            onPageSizeChange={(size) => { setAvailablePageSize(size); setAvailablePage(1); }}
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
              {vehicle ? `${vehicle.trip.tripNo} · ${vehicle.trip.vehicleNo || "—"}` : "—"}
            </span>
          </div>

          {vehicle && (
            <>
              {/* Live capacity only — the truck's static facts already sit in
                  the sheet header, so they are never repeated here. */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                <div className="flex items-center gap-4 flex-wrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600">
                  <span>
                    {to("orders.vehicle_box_capacity")}: <b className="text-slate-800">{capacity}</b>
                  </span>
                  <span>
                    {to("orders.col_assigned")}: <b className="text-slate-800">{alreadyAssignedOther + requested}</b>
                  </span>
                  <span>
                    {to("orders.available_boxes")}:{" "}
                    <b className={remaining < 0 ? "text-rose-600" : "text-emerald-700"}>{remaining}</b>
                  </span>
                  <span>
                    {to("orders.col_shops")}: <b className="text-slate-800">{selected.length}</b>
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {to("orders.collection_summary", { shops: totals.totalShops, boxes: totals.totalBoxes, birds: totals.totalBirds })}
                  </span>
                </div>
              </div>

              {/* Assignment table: editable sequence — drag a row, ↑/↓ one
                  step, ⤒/⤓ first/last, or sort the whole list — + boxes. */}
              <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-1.5 text-[11px] font-semibold text-slate-400">
                {to("orders.drag_hint")}
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className={`w-full min-w-[900px] ${ORDERS_TABLE_FONT_CLASS}`}>
                  <thead>
                    <tr className={opsTableHeadRowClass}>
                      <th className={`${opsTableThClass} w-20`}>{to("orders.col_sequence")}</th>
                      <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                      <th className={opsTableThClass}>{to("orders.col_village")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.ordered_birds")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.ordered_boxes")}</th>
                      <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.assigned_boxes")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.weight")}</th>
                      <th className={`${opsTableThClass} w-12`} />
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
                              e.dataTransfer.setData("text/plain", row.clientKey);
                            } catch {
                              /* dataTransfer is read-only in some browsers */
                            }
                          }}
                          onDragOver={(e) => {
                            if (!dragKey) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dropIndex !== index) setDropIndex(index);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = dragKey || e.dataTransfer.getData("text/plain");
                            if (from) moveRowTo(from, index);
                            setDragKey(null);
                            setDropIndex(null);
                          }}
                          onDragEnd={() => {
                            setDragKey(null);
                            setDropIndex(null);
                          }}
                          className={`${opsTableRowClass} align-middle ${
                            isDropTarget ? "bg-emerald-50/50" : ordersZebraTone(index)
                          } ${lifted ? "opacity-40" : ""} ${
                            isDropTarget ? "border-t-2 border-t-emerald-500" : ""
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
                                  onClick={() => moveRow(row.clientKey, -1)}
                                  disabled={index === 0 || busy}
                                  aria-label={`${to("orders.col_sequence")} ↑ ${row.shopName}`}
                                  className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveRowTo(row.clientKey, 0)}
                                  disabled={index === 0 || busy}
                                  title={to("orders.move_first")}
                                  aria-label={`${to("orders.move_first")} — ${row.shopName}`}
                                  className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                >
                                  <ChevronsUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveRow(row.clientKey, 1)}
                                  disabled={index === selected.length - 1 || busy}
                                  aria-label={`${to("orders.col_sequence")} ↓ ${row.shopName}`}
                                  className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveRowTo(row.clientKey, selected.length - 1)}
                                  disabled={index === selected.length - 1 || busy}
                                  title={to("orders.move_last")}
                                  aria-label={`${to("orders.move_last")} — ${row.shopName}`}
                                  className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                >
                                  <ChevronsDown size={12} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                            {row.shopName || "—"}
                          </td>
                          <td className={opsTableTdClass}>{row.village || "—"}</td>
                          <td className={`${opsTableTdClass} text-right font-medium`}>
                            {formatCount(row.orderedBirds)}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-semibold text-emerald-800`}>
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
                                value={row.assigned === 0 ? "" : row.assigned}
                                placeholder="0"
                                aria-label={`${to("orders.assigned_boxes")} — ${row.shopName}`}
                                onChange={(e) => setAssigned(row.clientKey, e.target.value)}
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
                                    title={to("orders.on_other_vehicles", { boxes: row.assignedElsewhere })}
                                  >
                                    ({to("orders.on_other_vehicles", { boxes: row.assignedElsewhere })})
                                  </span>
                                )}
                                {row.assigned > 0 && row.assigned < maxAssignable(row) && (
                                  <span className="ml-1.5 font-semibold text-amber-600">
                                    {to("orders.part_assign_left", {
                                      boxes: maxAssignable(row) - row.assigned,
                                    })}
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className={`${opsTableTdClass} text-right text-slate-500`}>
                            {orderWeightBasis
                              ? formatKg(weightForBirds(assignedBirdsFor(row), orderWeightBasis))
                              : "—"}
                          </td>
                          <td className={opsTableTdClass}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelected((prev) => prev.filter((r) => r.clientKey !== row.clientKey))
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {waBusy ? <Loader2 size={14} className="animate-spin" /> : <WhatsAppIcon size={14} />}
              {waProgress ? `${to("orders.whatsapp")} · ${waProgress}` : to("orders.whatsapp")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !vehicle || selected.length === 0}
              className={`${opsSecondaryButtonClass} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}
            >
              {saving || conflictChecking ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? to("orders.saving") : to("orders.save_progress")}
            </button>
          </div>
        </div>
          </div>
        </div>
        )}
      </section>

      {/* Capacity-exceeded block (clean modal with the exact numbers) */}
      {capacityExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true">
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
                      [to("orders.vehicle_box_capacity"), capacityExceeded.capacity],
                      [to("orders.already_assigned"), capacityExceeded.assigned],
                      [to("orders.available_boxes"), capacityExceeded.available],
                      [to("orders.requested"), capacityExceeded.requested],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-6 px-3 py-1.5">
                        <dt className="font-semibold text-slate-500">{label}</dt>
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
