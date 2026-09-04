// src/modules/operations/orders/components/OrdersAssignmentTab.tsx
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

import React, { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Send,
  X,
} from "lucide-react";
import type { Trip } from "../../../../shared/trip";
import {
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import TripPagination from "../../vehicle-trips/components/TripPagination";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import {
  collectionTotals,
  farmCityOf,
  formatCount,
  formatDayFull,
  moveInSequence,
  weightForBirds,
} from "../ordersUtils";
import {
  findDayShopConflicts,
  finishAssignment,
  saveAssignment,
  sendOrdersWhatsApp,
  supervisorMobileOf,
  villageOf,
  type ShopDirectory,
  type SupervisorDirectory,
} from "../ordersService";
import { useOrdersI18n } from "../i18n/ordersI18n";
import type {
  DayVehicleView,
  OrderShopRow,
  OrdersDayCollection,
  OrdersEligibleVehicle,
} from "../types";
import {
  ORDERS_NO_SPINNER,
  OrdersDateControl,
  OrdersEmptyState,
  OrdersDropdown,
  OrdersIconButton,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
  WhatsAppIcon,
  onOrdersNumberWheel,
} from "./OrdersCommon";

const AVAILABLE_PAGE_SIZE = 10;

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
  assigned: number; // 1 … orderedBoxes
};

function assignedBirdsFor(row: SelectedRow): number {
  if (row.assigned <= 0 || row.orderedBoxes <= 0) return 0;
  return Math.round((row.orderedBirds * row.assigned) / row.orderedBoxes);
}

function toOrderShopRows(rows: SelectedRow[]): OrderShopRow[] {
  return rows
    .filter((r) => r.assigned > 0)
    .map((r, i) => {
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

function OrdersAssignmentTab({
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

  // ── Compact table-level sort (real dropdown; same visual control as
  //     Order Collection) ──────────────────────────────────────────────────
  const [sortMode, setSortMode] = useState<"pending" | "az" | "za" | "vehicle_trip">("pending");
  const sortOptions = useMemo(
    () => [
      { value: "pending", label: to("orders.sort_pending_first") },
      { value: "az", label: to("orders.sort_name_az") },
      { value: "za", label: to("orders.sort_name_za") },
      { value: "vehicle_trip", label: to("orders.sort_vehicle_trip") },
    ],
    [to]
  );

  if (loading) return <OrdersTableSkeleton rows={4} />;
  const isPast = day < today;

  // ONE card with the SAME toolbar / table visual language as Order
  // Collection: [ Search ][ Date + TODAY ][ Sort ] … [↻ Refresh].
  // Refresh is ALWAYS the last control, far right.
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-3 flex-wrap">
        <OrdersSearchInput
          value={query}
          onChange={setQuery}
          placeholder={to("orders.search_assignment")}
          className="w-full sm:w-64"
        />
        <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} />
        <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
          {to("orders.sort")}
        </span>
        <OrdersDropdown
          value={sortMode}
          onChange={(v) => setSortMode(v as "pending" | "az" | "za" | "vehicle_trip")}
          options={sortOptions}
          ariaLabel={to("orders.sort")}
          widthClass="w-44"
        />
        {isPast ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Lock size={11} />
            {to("orders.closed_day")}
          </span>
        ) : null}
        <span className="ml-auto text-[11px] font-semibold text-slate-400 whitespace-nowrap">
          {to("orders.pool_summary", {
            collected: collection?.totalShops ?? 0,
            assigned: collection?.assignedShops ?? 0,
            available: (collection?.totalShops ?? 0) - (collection?.assignedShops ?? 0),
          })}
        </span>
        <OrdersIconButton
          label={`${to("orders.refresh")} — ${to("orders.refresh_assignment")}`}
          onClick={onRefresh}
          busy={refreshing}
        >
          <RefreshCw size={14} />
        </OrdersIconButton>
      </div>

      {isPast ? (
        dayVehicleViews.length === 0 ? (
          <OrdersEmptyState
            title={to("orders.no_collection_day", { day: formatDayFull(day) })}
            hint={to("orders.read_only_note")}
          />
        ) : (
          <PastAssignmentsTable views={dayVehicleViews} t={to} q={q} />
        )
      ) : !collection ? (
        <OrdersEmptyState
          title={to("orders.assignment_empty")}
          hint={to("orders.select_order")}
        />
      ) : (
        <AssignmentEditor
          key={`${day}|${collection.trip.id}`}
          day={day}
          collection={collection}
          eligibleVehicles={eligibleVehicles}
          shopDirectory={shopDirectory}
          supervisorDirectory={supervisorDirectory}
          q={q}
          sortMode={sortMode}
          onChanged={onChanged}
          onFinished={onFinished}
        />
      )}
    </div>
  );
}

// ─── Past-day assignments (compact read-only table — one row per vehicle) ──

function PastAssignmentsTable({
  views,
  t,
  q,
}: {
  views: DayVehicleView[];
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Lower-cased search (trip / vehicle / supervisor / shop). */
  q: string;
}) {
  const filtered = useMemo(() => {
    if (!q) return views;
    return views.filter((view) => {
      const haystack = [
        view.trip.tripNo,
        view.trip.vehicleNo,
        view.trip.supervisorName,
        view.trip.driverName,
        ...view.rows.map((r) => r.shopName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [views, q]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs md:text-sm">
        <thead>
          <tr className={opsTableHeadRowClass}>
            <th className={opsTableThClass}>{t("orders.col_trip_no")}</th>
              <th className={opsTableThClass}>{t("orders.col_vehicle_no")}</th>
              <th className={opsTableThClass}>{t("orders.driver")}</th>
              <th className={`${opsTableThClass} w-28 text-right`}>{t("orders.col_shops")}</th>
              <th className={`${opsTableThClass} w-24 text-right`}>{t("orders.col_boxes")}</th>
              <th className={`${opsTableThClass} w-32`}>{t("orders.col_status")}</th>
            </tr>
          </thead>
          <tbody className={opsTableDivideClass}>
            {filtered.map((view) => (
              <tr key={view.trip.id} className={opsTableRowClass}>
                <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                  {view.trip.tripNo}
                </td>
                <td className={opsTableTdClass}>{view.trip.vehicleNo || "—"}</td>
                <td className={opsTableTdClass}>{view.trip.driverName || "—"}</td>
                <td className={`${opsTableTdClass} text-right text-slate-600`}>
                  {view.deliveredShops}/{view.shops}
                </td>
                <td className={`${opsTableTdClass} text-right font-semibold text-slate-700`}>
                  {view.boxes}
                </td>
                <td className={opsTableTdClass}>
                  <OrdersStatusBadge
                    status={view.allDelivered ? "Completed" : view.status}
                    label={
                      view.allDelivered
                        ? t("orders.status_completed")
                        : t(`orders.status_${view.status.toLowerCase().replace(/\s+/g, "_")}` as string)
                    }
                  />
                </td>
              </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8">
                <OrdersEmptyState title={t("orders.no_search_results")} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
  onChanged,
  onFinished,
}: {
  day: string;
  collection: OrdersDayCollection;
  eligibleVehicles: OrdersEligibleVehicle[];
  shopDirectory: ShopDirectory;
  supervisorDirectory: SupervisorDirectory;
  /** Lower-cased search (shop / village / vehicle / trip). */
  q: string;
  /** Table-level sort (Pending First / A→Z / Z→A / Vehicle · Trip). */
  sortMode: "pending" | "az" | "za" | "vehicle_trip";
  onChanged: () => void;
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
  const [finishing, setFinishing] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waProgress, setWaProgress] = useState<string | null>(null);
  const [conflictChecking, setConflictChecking] = useState(false);
  const [capacityExceeded, setCapacityExceeded] = useState<null | {
    capacity: number;
    assigned: number;
    available: number;
    requested: number;
  }>(null);
  const busy = saving || finishing || conflictChecking;

  const selectedIds = useMemo(
    () => new Set(selected.map((r) => r.shopId)),
    [selected]
  );

  const toggleShop = useCallback((row: OrderShopRow, checked: boolean) => {
    setSelected((prev) => {
      if (checked) {
        if (prev.some((r) => r.shopId === row.shopId)) return prev;
        return [
          ...prev,
          {
            clientKey: newClientKey(),
            shopId: row.shopId,
            shopName: row.shopName || "—",
            village: villageOf(row.shopId, row.shopName, shopDirectory),
            orderedBirds: Number(row.birds) || 0,
            orderedBoxes: Math.max(1, Number(row.boxNo) || 0),
            assigned: Math.max(1, Number(row.boxNo) || 0),
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
        // Assigned boxes: 1 … ordered (0 = not assigned to this vehicle).
        const n = Math.max(0, Math.min(r.orderedBoxes, Math.floor(Number(raw) || 0)));
        return { ...r, assigned: n };
      })
    );
  }, []);

  const supervisorMobile = vehicle
    ? supervisorDirectory.get(vehicle.trip.supervisorName?.trim().toLowerCase() ?? "") ?? ""
    : "";

  // ── Capacity math (boxes are the priority figure; hard block) ────────────
  const avgBirdWeight = vehicle ? Number(vehicle.trip.avgBirdWeight) || 0 : 0;
  const capacity = vehicle ? vehicle.capacity : 0;
  const alreadyAssignedOther = vehicle
    ? Math.max(0, vehicle.alreadyAssigned - collection.assignedBoxes)
    : 0;
  const requested = selected.reduce((s, r) => s + r.assigned, 0);
  const available = vehicle ? Math.max(0, capacity - alreadyAssignedOther) : 0;
  // Order rows already persisted on THIS vehicle (earlier partial saves).
  // They let the operator dispatch the truck with an empty selection.
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

  // ── Pre-save conflict re-check from FRESH persisted data ─────────────────
  const assertNoConflicts = useCallback(async (): Promise<boolean> => {
    if (!vehicle || selected.length === 0) return true;
    setConflictChecking(true);
    try {
      const conflicts = await findDayShopConflicts(
        day,
        selected.map((r) => ({ shopId: r.shopId, shopName: r.shopName })),
        vehicle.trip.tripNo
      );
      if (conflicts.length > 0) {
        showNotification(
          to("orders.conflict_message", { shops: conflicts.join(", ") }),
          "error"
        );
        // Drop the conflicting shops from the selection and refresh.
        setSelected((prev) => prev.filter((r) => !conflicts.includes(r.shopName)));
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
    if (busy || !vehicle) return;
    if (!checkCapacity()) return;
    if (selected.length === 0) {
      showNotification(to("orders.selection_empty"), "info");
      return;
    }
    if (!(await assertNoConflicts())) return;
    setSaving(true);
    try {
      await saveAssignment(vehicle.trip, [
        { orderTripNo: orderTrip.tripNo, rows: toOrderShopRows(selected) },
      ]);
      setSavedSnapshot(selectionSnapshot(null, []));
      setSelected([]);
      showNotification(to("orders.assignment_saved"), "success");
      onChanged();
    } catch {
      showNotification(to("orders.refresh_failed"), "error");
    } finally {
      setSaving(false);
    }
  }, [busy, vehicle, checkCapacity, selected, assertNoConflicts, orderTrip.tripNo, showNotification, to, onChanged]);

  // ── Finish Assignment (validated) ────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    if (busy || !vehicle) return;
    const unassigned = selected.filter((r) => r.assigned < 1);
    // An empty selection is allowed when earlier partial saves already put
    // shops on this vehicle — those rows are dispatched as they stand.
    if ((selected.length === 0 && savedOnVehicle === 0) || unassigned.length > 0) {
      showNotification(to("orders.finish_assignment_invalid"), "info");
      return;
    }
    if (!checkCapacity()) return;
    if (!(await assertNoConflicts())) return;
    setFinishing(true);
    try {
      const vehicleTrip = await finishAssignment(
        vehicle.trip,
        selected.length > 0
          ? [{ orderTripNo: orderTrip.tripNo, rows: toOrderShopRows(selected) }]
          : []
      );
      showNotification(to("orders.assignment_finished"), "success");
      onFinished(vehicleTrip);
    } catch {
      showNotification(to("orders.refresh_failed"), "error");
    } finally {
      setFinishing(false);
    }
  }, [busy, vehicle, selected, savedOnVehicle, checkCapacity, assertNoConflicts, orderTrip.tripNo, showNotification, to, onFinished]);

  // ── WhatsApp (existing mechanism — assignment list to the supervisor) ────
  const handleWhatsApp = useCallback(async () => {
    if (waBusy || !vehicle) return;
    // Ensure the assignment is persisted first (per-delivery endpoint needs ids).
    let trip = vehicle.trip;
    if (isDirty) {
      if (!(await assertNoConflicts())) return;
      try {
        trip = await saveAssignment(vehicle.trip, [
          { orderTripNo: orderTrip.tripNo, rows: toOrderShopRows(selected) },
        ]);
      } catch {
        showNotification(to("orders.refresh_failed"), "error");
        return;
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
      if (result.sent > 0 && result.failed === 0) {
        showNotification(to("orders.whatsapp_done", { sent: result.sent, total: result.sent }), "success");
      } else if (result.sent > 0) {
        showNotification(to("orders.whatsapp_partial", { sent: result.sent, failed: result.failed }), "info");
      } else {
        const message =
          result.message && result.message.includes("not configured")
            ? to("orders.whatsapp_not_configured")
            : to("orders.whatsapp_failed", { message: result.message ?? "—" });
        showNotification(message, "error");
      }
    } catch {
      showNotification(to("orders.whatsapp_failed", { message: "network" }), "error");
    } finally {
      setWaBusy(false);
      setWaProgress(null);
    }
  }, [waBusy, vehicle, isDirty, selected, assertNoConflicts, orderTrip.tripNo, supervisorMobile, showNotification, to]);

  // ── Vehicle summary (the vehicle itself is chosen from the › table) ──────
  // Compact vehicle information strip — the useful fact set, rendered
  // small (never as a hero panel).
  const summary: Array<[string, string]> = vehicle
    ? [
        [to("orders.vehicle_no"), vehicle.trip.vehicleNo || "—"],
        [
          to("orders.farm_address"),
          `${vehicle.trip.sourceFarm || "—"}${vehicle.trip.farmAddress ? ` · ${vehicle.trip.farmAddress}` : ""}`,
        ],
        [to("orders.bird_type"), vehicle.trip.birdType || "—"],
        [to("orders.avg_bird_weight"), avgBirdWeight ? `${avgBirdWeight.toFixed(2)} KG` : "—"],
        [to("orders.vehicle_box_capacity"), String(capacity)],
        [to("orders.available_boxes"), String(available)],
        [to("orders.supervisor"), vehicle.trip.supervisorName || "—"],
        [to("orders.driver"), vehicle.trip.driverName || "—"],
        [to("orders.supervisor_mobile"), supervisorMobile || "—"],
      ]
    : [];

  // ── Day pool table: PENDING (unassigned) + ASSIGNED shops together ───────
  //     Only pending rows are assignable — the same-shop/same-day rule stays
  //     visible at a glance. Table-level search over the FULL pool (shop /
  //     village / vehicle / trip), sorted by the selected mode, then
  //     paginated (existing global component; 10 rows per page).
  type PoolRow = OrderShopRow & {
    poolIndex: number;
    kind: "pending" | "assigned";
    assignedVehicleNo: string;
    assignedTripNo: string;
    delivered: boolean;
  };
  // ── Collected-shops search + filter ─────────────────────────────────────
  // A real operational day can carry ~100 shops, so the pool has its OWN
  // search box and a refine filter on top of the tab-level search. They only
  // narrow the table — the selection lives in `selected`, so ticking shops
  // while searching/filtering keeps every earlier pick.
  const [poolQuery, setPoolQuery] = useState("");
  // Defaults to PENDING — with ~100 collected shops the operator almost always
  // wants the ones still waiting for a vehicle, not the already-assigned rows.
  const [poolFilter, setPoolFilter] = useState<
    "all" | "pending" | "assigned" | "this_vehicle"
  >("pending");
  const pq = poolQuery.trim().toLowerCase();
  const poolFilterOptions = useMemo(
    () => [
      { value: "all", label: to("orders.pool_filter_all") },
      { value: "pending", label: to("orders.pool_filter_pending") },
      { value: "assigned", label: to("orders.pool_filter_assigned") },
      { value: "this_vehicle", label: to("orders.pool_filter_this_vehicle") },
    ],
    [to]
  );
  const thisTripNo = vehicle?.trip.tripNo ?? "";
  const filteredPool = useMemo(() => {
    const list: PoolRow[] = [];
    collection.rows.forEach((row, i) => {
      const a = collection.shops.get(row.shopId);
      const item: PoolRow = {
        ...row,
        poolIndex: i,
        kind: a ? "assigned" : "pending",
        assignedVehicleNo: a?.vehicleNo ?? "",
        assignedTripNo: a?.tripNo ?? "",
        delivered: a?.delivered ?? false,
      };
      // Refine filter first (cheap), then the two search terms.
      if (poolFilter === "pending" && item.kind !== "pending") return;
      if (poolFilter === "assigned" && item.kind !== "assigned") return;
      if (poolFilter === "this_vehicle" && item.assignedTripNo !== thisTripNo) return;
      if (q || pq) {
        const hay =
          `${row.shopName} ${villageOf(row.shopId, row.shopName, shopDirectory)} ${item.assignedVehicleNo} ${item.assignedTripNo}`.toLowerCase();
        if (q && !hay.includes(q)) return;
        if (pq && !hay.includes(pq)) return;
      }
      list.push(item);
    });
    if (sortMode === "az") {
      list.sort(
        (a, b) => (a.shopName || "").localeCompare(b.shopName || "") || a.poolIndex - b.poolIndex
      );
    } else if (sortMode === "za") {
      list.sort(
        (a, b) => (b.shopName || "").localeCompare(a.shopName || "") || a.poolIndex - b.poolIndex
      );
    } else if (sortMode === "vehicle_trip") {
      // Pending (no vehicle) first, then grouped by Vehicle No → Trip No.
      list.sort(
        (a, b) =>
          a.assignedVehicleNo.localeCompare(b.assignedVehicleNo) ||
          a.assignedTripNo.localeCompare(b.assignedTripNo) ||
          a.poolIndex - b.poolIndex
      );
    } else {
      // Pending First: unassigned shops up top (collection order), then
      // assigned (collection order).
      list.sort((a, b) =>
        a.kind === b.kind ? a.poolIndex - b.poolIndex : a.kind === "pending" ? -1 : 1
      );
    }
    return list;
  }, [collection, q, pq, poolFilter, thisTripNo, shopDirectory, sortMode]);

  const [availablePage, setAvailablePage] = useState(1);
  const availableKey = `${q}|${pq}|${poolFilter}|${sortMode}|${filteredPool.length}`;
  const [lastAvailableKey, setLastAvailableKey] = useState(availableKey);
  if (lastAvailableKey !== availableKey) {
    setLastAvailableKey(availableKey);
    if (availablePage !== 1) setAvailablePage(1);
  }
  const availableTotalPages = Math.max(
    1,
    Math.ceil(filteredPool.length / AVAILABLE_PAGE_SIZE)
  );
  const safeAvailablePage = Math.min(availablePage, availableTotalPages);
  const availableStartIndex =
    filteredPool.length === 0 ? 0 : (safeAvailablePage - 1) * AVAILABLE_PAGE_SIZE;
  const pageAvailable = filteredPool.slice(
    (safeAvailablePage - 1) * AVAILABLE_PAGE_SIZE,
    safeAvailablePage * AVAILABLE_PAGE_SIZE
  );

  // ── Delivery state of a selected shop from persisted day data ───────────
  // Pending (not assigned anywhere yet) / Assigned / Delivered (Step 4).
  const deliveryStatusOf = (shopId: number): "pending" | "assigned" | "delivered" => {
    const a = collection.shops.get(shopId);
    if (!a) return "pending";
    return a.delivered ? "delivered" : "assigned";
  };

  // ── Render — VEHICLE-FIRST: the trucks that finished Step 2 are listed
  //     with their trip / vehicle / supervisor / farm / capacity facts, and a
  //     › arrow opens that vehicle's shop-assignment panel. ─────────────────
  return (
    <div>
      {/* 0 — Vehicles ready for assignment (Step 2 submitted, Step 4 not) */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {to("orders.vehicles_ready")}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">
          {eligibleVehicles.length} · {to("orders.step2_submitted_note")}
        </span>
      </div>
      {eligibleVehicles.length === 0 ? (
        <div className="px-4 py-5">
          <OrdersEmptyState title={to("orders.no_eligible_vehicles")} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs md:text-sm">
            <thead>
              <tr className={opsTableHeadRowClass}>
                <th className={`${opsTableThClass} w-12`} />
                <th className={`${opsTableThClass} w-40`}>{to("orders.col_trip_no")}</th>
                <th className={`${opsTableThClass} w-36`}>{to("orders.vehicle_no")}</th>
                <th className={`${opsTableThClass} w-32`}>{to("orders.supervisor_mobile")}</th>
                <th className={`${opsTableThClass} w-40`}>{to("orders.supervisor")}</th>
                <th className={opsTableThClass}>{to("orders.farm_city")}</th>
                <th className={`${opsTableThClass} w-36 text-right`}>
                  {to("orders.vehicle_box_capacity")}
                </th>
              </tr>
            </thead>
            <tbody className={opsTableDivideClass}>
              {eligibleVehicles.map((v) => {
                const open = vehicleTripId === v.trip.id;
                const mobile = supervisorMobileOf(v.trip, supervisorDirectory);
                const farmFull = `${v.trip.sourceFarm || "—"}${
                  v.trip.farmAddress ? ` · ${v.trip.farmAddress}` : ""
                }`;
                // The column shows the CITY only (Vijayawada, Kodad…) — the
                // full address stays one hover away.
                const city = farmCityOf(v.trip);
                return (
                  <tr
                    key={v.trip.id}
                    className={`${opsTableRowClass} ${open ? "bg-emerald-50/70" : ""}`}
                  >
                    <td className={opsTableTdClass}>
                      {/* › opens this vehicle's shop-assignment panel */}
                      <button
                        type="button"
                        onClick={() => setVehicleTripId(open ? null : v.trip.id)}
                        aria-expanded={open}
                        aria-label={`${to("orders.assign_to_vehicle")} — ${v.trip.vehicleNo || v.trip.tripNo}`}
                        title={to("orders.assign_to_vehicle")}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-emerald-300 hover:text-emerald-700"
                      >
                        <ChevronRight
                          size={15}
                          className={open ? "rotate-90 text-emerald-600" : ""}
                        />
                      </button>
                    </td>
                    <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                      {v.trip.tripNo || "—"}
                    </td>
                    <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                      {v.trip.vehicleNo || "—"}
                    </td>
                    <td className={opsTableTdClass}>{mobile || "—"}</td>
                    <td className={opsTableTdClass}>{v.trip.supervisorName || "—"}</td>
                    <td className={`${opsTableTdClass} font-semibold text-slate-700 whitespace-nowrap`} title={farmFull}>
                      {city}
                    </td>
                    <td className={`${opsTableTdClass} text-right font-bold text-slate-800`}>
                      {formatCount(v.capacity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Shop assignment happens INSIDE one chosen vehicle — the panels below
          stay hidden until a vehicle row is opened with ›. */}
      {!vehicle && eligibleVehicles.length > 0 && (
        <p className="border-t border-slate-100 bg-slate-50/40 px-4 py-3 text-[11px] font-semibold text-slate-400">
          {to("orders.select_vehicle_hint")}
        </p>
      )}

      {vehicle && (
        <>
      {/* 1 — Day pool: pending + assigned collected shops (select
          pending shops one by one; assigned rows are visible, locked) */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2.5 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {to("orders.collected_shops")}
        </span>
        {/* ~100 shops a day: search the pool + refine it without losing the
            shops already ticked. */}
        <OrdersSearchInput
          value={poolQuery}
          onChange={setPoolQuery}
          placeholder={to("orders.search_pool")}
          className="w-full sm:w-60"
        />
        <OrdersDropdown
          value={poolFilter}
          onChange={(v) =>
            setPoolFilter(v as "all" | "pending" | "assigned" | "this_vehicle")
          }
          options={poolFilterOptions}
          ariaLabel={to("orders.filter_shops")}
          widthClass="w-48"
        />
        <span className="ml-auto text-[11px] font-semibold text-slate-400 whitespace-nowrap">
          {to("orders.pool_showing", {
            shown: filteredPool.length,
            total: collection.totalShops,
            selected: selected.length,
          })}
        </span>
      </div>
      {filteredPool.length === 0 ? (
        <div className="px-4 py-5">
          <OrdersEmptyState
            title={
              q || pq
                ? to("orders.no_search_results")
                : poolFilter !== "all"
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
            <table className="w-full min-w-[980px] text-xs md:text-sm">
              <thead>
                <tr className={opsTableHeadRowClass}>
                  <th className={`${opsTableThClass} w-14`}>{to("orders.select_col")}</th>
                  <th className={`${opsTableThClass} w-14`}>{to("orders.col_sno")}</th>
                  <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                  <th className={opsTableThClass}>{to("orders.col_village")}</th>
                  <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.col_birds")}</th>
                  <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.ordered_boxes")}</th>
                  <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.weight")}</th>
                  <th className={`${opsTableThClass} w-40`}>{to("orders.vehicle_trip")}</th>
                  <th className={`${opsTableThClass} w-28`}>{to("orders.col_status")}</th>
                </tr>
              </thead>
              <tbody className={opsTableDivideClass}>
                {pageAvailable.map((row, index) => {
                  const checked = selectedIds.has(row.shopId);
                  const isAssignedRow = row.kind === "assigned";
                  return (
                    <tr
                      key={row.shopId}
                      className={`${opsTableRowClass} ${
                        isAssignedRow
                          ? "cursor-default opacity-60"
                          : `cursor-pointer ${checked ? "bg-emerald-50/50" : ""}`
                      }`}
                      onClick={() => {
                        if (!isAssignedRow) toggleShop(row, !checked);
                      }}
                    >
                      <td className={opsTableTdClass} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isAssignedRow}
                          onChange={(e) => toggleShop(row, e.target.checked)}
                          aria-label={`${to("orders.select_col")} — ${row.shopName}`}
                          className={`h-4 w-4 accent-emerald-600 ${
                            isAssignedRow ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                          }`}
                        />
                      </td>
                      <td className={opsTableTdClass}>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[12px] font-bold text-slate-600">
                          {availableStartIndex + index + 1}
                        </span>
                      </td>
                      <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                        {row.shopName || "—"}
                      </td>
                      <td className={opsTableTdClass}>
                        {villageOf(row.shopId, row.shopName, shopDirectory) || "—"}
                      </td>
                      <td className={`${opsTableTdClass} text-right font-semibold`}>
                        {formatCount(Number(row.birds) || 0)}
                      </td>
                      <td className={`${opsTableTdClass} text-right font-bold text-emerald-800`}>
                        {formatCount(Math.max(1, Number(row.boxNo) || 0))}
                      </td>
                      <td className={`${opsTableTdClass} text-right text-slate-500`}>
                        {avgBirdWeight
                          ? `${weightForBirds(Number(row.birds) || 0, avgBirdWeight).toFixed(2)} kg`
                          : "—"}
                      </td>
                      <td className={`${opsTableTdClass} whitespace-nowrap`}>
                        {isAssignedRow ? (
                          <span className="text-slate-600">
                            {row.assignedVehicleNo || "—"}
                            {row.assignedTripNo ? ` · ${row.assignedTripNo}` : ""}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={opsTableTdClass}>
                        {isAssignedRow ? (
                          row.delivered ? (
                            <OrdersStatusBadge status="Delivered" label={to("orders.status_delivered")} />
                          ) : (
                            <OrdersStatusBadge status="Assigned" label={to("orders.col_assigned")} />
                          )
                        ) : checked ? (
                          <OrdersStatusBadge status="Assigned" label={to("orders.col_assigned")} />
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-600">
                            {to("orders.available")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredPool.length > AVAILABLE_PAGE_SIZE && (
            <div className="px-4 py-2.5 border-t border-slate-100">
              <TripPagination
                currentPage={safeAvailablePage}
                totalPages={availableTotalPages}
                onPageChange={setAvailablePage}
              />
            </div>
          )}
        </>
      )}

      {/* 2 — Selected shops → select vehicle → sequence & boxes */}
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
              {vehicle.trip.tripNo} · {vehicle.trip.vehicleNo || "—"}
            </span>
          </div>

          {vehicle && (
            <>
              {/* Compact vehicle information strip (never a hero panel) */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-3">
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-2.5">
                  {summary.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-400">{label}</dt>
                      <dd className="text-sm font-semibold text-slate-800 truncate" title={value}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {/* Compact capacity indicator (not dashboard cards) */}
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
              <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-1.5 text-[10px] font-semibold text-slate-400">
                {to("orders.drag_hint")}
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full min-w-[900px] text-xs md:text-sm">
                  <thead>
                    <tr className={opsTableHeadRowClass}>
                      <th className={`${opsTableThClass} w-20`}>{to("orders.col_sequence")}</th>
                      <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                      <th className={opsTableThClass}>{to("orders.col_village")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.ordered_birds")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.ordered_boxes")}</th>
                      <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.assigned_boxes")}</th>
                      <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.weight")}</th>
                      <th className={`${opsTableThClass} w-28`}>{to("orders.col_delivery_status")}</th>
                      <th className={`${opsTableThClass} w-12`} />
                    </tr>
                  </thead>
                  <tbody className={opsTableDivideClass}>
                    {selected.map((row, index) => {
                      const ds = deliveryStatusOf(row.shopId);
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
                            lifted ? "opacity-40" : ""
                          } ${
                            isDropTarget
                              ? "border-t-2 border-t-emerald-500 bg-emerald-50/50"
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
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[12px] font-bold text-emerald-700">
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
                          <td className={`${opsTableTdClass} text-right font-semibold`}>
                            {formatCount(row.orderedBirds)}
                          </td>
                          <td className={`${opsTableTdClass} text-right font-bold text-emerald-800`}>
                            {formatCount(row.orderedBoxes)}
                          </td>
                          <td className={opsTableTdClass}>
                            <input
                              type="number"
                              min={1}
                              max={row.orderedBoxes}
                              value={row.assigned === 0 ? "" : row.assigned}
                              placeholder="0"
                              aria-label={`${to("orders.assigned_boxes")} — ${row.shopName}`}
                              onChange={(e) => setAssigned(row.clientKey, e.target.value)}
                              onWheel={onOrdersNumberWheel}
                              className={`${ORDERS_NO_SPINNER} h-8 w-full rounded-lg border px-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                                row.assigned === 0
                                  ? "border-amber-300 bg-amber-50/60 text-amber-800"
                                  : "border-emerald-300/70 bg-emerald-50/50 text-emerald-900"
                              }`}
                            />
                          </td>
                          <td className={`${opsTableTdClass} text-right text-slate-500`}>
                            {avgBirdWeight
                              ? `${weightForBirds(assignedBirdsFor(row), avgBirdWeight).toFixed(2)} kg`
                              : "—"}
                          </td>
                          <td className={opsTableTdClass}>
                            {ds === "delivered" ? (
                              <OrdersStatusBadge status="Delivered" label={to("orders.status_delivered")} />
                            ) : ds === "assigned" ? (
                              <OrdersStatusBadge status="Assigned" label={to("orders.status_assigned")} />
                            ) : (
                              <OrdersStatusBadge status="Pending" label={to("orders.status_pending")} />
                            )}
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

              {/* Shops already on another vehicle for this day (persisted) */}
              {pool.assigned.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                    {to("orders.col_assigned")} — {to("orders.col_vehicle_no")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {pool.assigned.map(({ row, tripNo, vehicleNo, delivered }) => (
                      <span
                        key={row.shopId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        {row.shopName || "—"}
                        <span className={delivered ? "text-emerald-600" : "text-slate-400"}>
                          — {tripNo} ({vehicleNo || "—"})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

        </>
      )}

      {/* 3 — Actions (available while a vehicle is open, so a partially
          saved truck can still be dispatched with an empty selection) */}
      {vehicle && (
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
            {/* WhatsApp — real brand icon + green treatment (existing mechanism) */}
            <button
              type="button"
              onClick={() => void handleWhatsApp()}
              disabled={waBusy || !vehicle}
              title={to("orders.whatsapp")}
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
            <button
              type="button"
              onClick={() => void handleFinish()}
              disabled={busy || !vehicle || (selected.length === 0 && savedOnVehicle === 0)}
              className={opsPrimaryButtonClass}
            >
              {finishing || conflictChecking ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {finishing ? to("orders.submitting") : to("orders.finish_assignment")}
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}

export default React.memo(OrdersAssignmentTab);
