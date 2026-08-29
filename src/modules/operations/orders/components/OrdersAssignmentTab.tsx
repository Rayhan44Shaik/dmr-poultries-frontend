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
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Send,
  X,
} from "lucide-react";
import Select from "react-select";
import type { Trip } from "../../../../shared/trip";
import {
  opsPrimaryButtonClass,
  opsReactSelectStyles,
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
  formatCount,
  formatDayFull,
  weightForBirds,
} from "../ordersUtils";
import {
  findDayShopConflicts,
  finishAssignment,
  saveAssignment,
  sendOrdersWhatsApp,
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
  OrdersDateControl,
  OrdersEmptyState,
  OrdersFilterSelect,
  OrdersIconButton,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
  WhatsAppIcon,
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

  // ── Compact table-level sort (same control as Order Collection) ─────────
  const [sortMode, setSortMode] = useState<"collected" | "az" | "za">("collected");
  const sortOptions = useMemo(
    () => [
      { value: "collected", label: to("orders.sort_collected_first") },
      { value: "az", label: to("orders.sort_name_az") },
      { value: "za", label: to("orders.sort_name_za") },
    ],
    [to]
  );

  if (loading) return <OrdersTableSkeleton rows={4} />;
  const isPast = day < today;

  // ONE card with the SAME toolbar / table visual language as Order
  // Collection: [ Search ][ Date + TODAY ][ Refresh ][ Sort ] + summary.
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
        <OrdersIconButton
          label={`${to("orders.refresh")} — ${to("orders.refresh_assignment")}`}
          onClick={onRefresh}
          busy={refreshing}
        >
          <RefreshCw size={14} />
        </OrdersIconButton>
        <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
          {to("orders.sort")}
        </span>
        <OrdersFilterSelect
          value={sortMode}
          onChange={(v) => setSortMode(v as "collected" | "az" | "za")}
          options={sortOptions}
          ariaLabel={to("orders.sort")}
          className="w-44"
        />
        {isPast ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Lock size={11} />
            {to("orders.closed_day")}
          </span>
        ) : (
          <span className="ml-auto text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            {to("orders.pool_summary", {
              collected: collection?.totalShops ?? 0,
              assigned: collection?.assignedShops ?? 0,
              available: (collection?.totalShops ?? 0) - (collection?.assignedShops ?? 0),
            })}
          </span>
        )}
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
  /** Lower-cased search (shop / village). */
  q: string;
  /** Table-level sort (same options as Order Collection). */
  sortMode: "collected" | "az" | "za";
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

  const moveRow = useCallback((clientKey: string, dir: -1 | 1) => {
    setSelected((prev) => {
      const index = prev.findIndex((r) => r.clientKey === clientKey);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

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
    if (selected.length === 0 || unassigned.length > 0) {
      showNotification(to("orders.finish_assignment_invalid"), "info");
      return;
    }
    if (!checkCapacity()) return;
    if (!(await assertNoConflicts())) return;
    setFinishing(true);
    try {
      const vehicleTrip = await finishAssignment(vehicle.trip, [
        { orderTripNo: orderTrip.tripNo, rows: toOrderShopRows(selected) },
      ]);
      showNotification(to("orders.assignment_finished"), "success");
      onFinished(vehicleTrip);
    } catch {
      showNotification(to("orders.refresh_failed"), "error");
    } finally {
      setFinishing(false);
    }
  }, [busy, vehicle, selected, checkCapacity, assertNoConflicts, orderTrip.tripNo, showNotification, to, onFinished]);

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

  // ── Vehicle options / summary ────────────────────────────────────────────
  const vehicleOptions = useMemo(
    () =>
      eligibleVehicles.map((v) => ({
        value: v.trip.id,
        label: `${v.trip.vehicleNo} · ${v.trip.sourceFarm || "—"} · ${v.capacity} ${to("orders.col_boxes").toLowerCase()}`,
      })),
    [eligibleVehicles, to]
  );
  const vehicleValue =
    vehicleOptions.find((o) => o.value === vehicleTripId) ??
    (vehicle ? { value: vehicle.trip.id, label: vehicle.trip.vehicleNo || String(vehicle.trip.id) } : null);

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

  // ── Available shops: table-level search over the FULL pool, then
  //     pagination (existing global component; 10 rows per page) ───────────
  const filteredAvailable = useMemo(() => {
    const list = q
      ? pool.available.filter((row) =>
          `${row.shopName} ${villageOf(row.shopId, row.shopName, shopDirectory)}`
            .toLowerCase()
            .includes(q)
        )
      : [...pool.available];
    // "collected" = the day's collection order (stable default).
    if (sortMode === "az") {
      list.sort((a, b) => (a.shopName || "").localeCompare(b.shopName || ""));
    } else if (sortMode === "za") {
      list.sort((a, b) => (b.shopName || "").localeCompare(a.shopName || ""));
    }
    return list;
  }, [pool.available, q, shopDirectory, sortMode]);

  const [availablePage, setAvailablePage] = useState(1);
  const availableKey = `${q}|${sortMode}|${filteredAvailable.length}`;
  const [lastAvailableKey, setLastAvailableKey] = useState(availableKey);
  if (lastAvailableKey !== availableKey) {
    setLastAvailableKey(availableKey);
    if (availablePage !== 1) setAvailablePage(1);
  }
  const availableTotalPages = Math.max(
    1,
    Math.ceil(filteredAvailable.length / AVAILABLE_PAGE_SIZE)
  );
  const safeAvailablePage = Math.min(availablePage, availableTotalPages);
  const availableStartIndex =
    filteredAvailable.length === 0 ? 0 : (safeAvailablePage - 1) * AVAILABLE_PAGE_SIZE;
  const pageAvailable = filteredAvailable.slice(
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

  // ── Render — SHOP-FIRST, table-first (same visual language as
  //     Order Collection; vehicle comes AFTER the shop selection) ─────────
  return (
    <div>
      {/* 1 — Available collected shops (always visible; select one by one) */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {to("orders.available_collected_shops")}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">
          {filteredAvailable.length} / {collection.totalShops}
        </span>
      </div>
      {filteredAvailable.length === 0 ? (
        <div className="px-4 py-5">
          <OrdersEmptyState
            title={
              q
                ? to("orders.no_search_results")
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
            <table className="w-full min-w-[820px] text-xs md:text-sm">
              <thead>
                <tr className={opsTableHeadRowClass}>
                  <th className={`${opsTableThClass} w-14`}>{to("orders.select_col")}</th>
                  <th className={`${opsTableThClass} w-14`}>{to("orders.col_sno")}</th>
                  <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                  <th className={opsTableThClass}>{to("orders.col_village")}</th>
                  <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.col_birds")}</th>
                  <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.ordered_boxes")}</th>
                  <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.weight")}</th>
                  <th className={`${opsTableThClass} w-28`}>{to("orders.col_status")}</th>
                </tr>
              </thead>
              <tbody className={opsTableDivideClass}>
                {pageAvailable.map((row, index) => {
                  const checked = selectedIds.has(row.shopId);
                  return (
                    <tr
                      key={row.shopId}
                      className={`${opsTableRowClass} cursor-pointer ${checked ? "bg-emerald-50/50" : ""}`}
                      onClick={() => toggleShop(row, !checked)}
                    >
                      <td className={opsTableTdClass} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleShop(row, e.target.checked)}
                          aria-label={`${to("orders.select_col")} — ${row.shopName}`}
                          className="h-4 w-4 accent-emerald-600 cursor-pointer"
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
                      <td className={opsTableTdClass}>
                        {checked ? (
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
          {filteredAvailable.length > AVAILABLE_PAGE_SIZE && (
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
            <div className="ml-auto w-full sm:w-80">
              {eligibleVehicles.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {to("orders.no_eligible_vehicles")}
                </p>
              ) : (
                <Select
                  options={vehicleOptions}
                  value={vehicleValue}
                  onChange={(opt) => {
                    if (!opt) return;
                    setVehicleTripId(opt.value);
                  }}
                  placeholder={to("orders.select_vehicle")}
                  styles={opsReactSelectStyles()}
                  className="text-xs"
                  isSearchable
                  menuPosition="fixed"
                />
              )}
            </div>
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

              {/* Assignment table: editable sequence (↑/↓ auto-renumber) + assigned boxes */}
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
                      return (
                        <tr key={row.clientKey} className={`${opsTableRowClass} align-middle`}>
                          <td className={opsTableTdClass}>
                            <div className="flex items-center gap-1">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[12px] font-bold text-emerald-700">
                                {index + 1}
                              </span>
                              <div className="flex flex-col -my-1.5">
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
                                  onClick={() => moveRow(row.clientKey, 1)}
                                  disabled={index === selected.length - 1 || busy}
                                  aria-label={`${to("orders.col_sequence")} ↓ ${row.shopName}`}
                                  className="h-5 w-5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 flex items-center justify-center"
                                >
                                  <ArrowDown size={12} />
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
                              className={`h-8 w-full rounded-lg border px-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
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

      {/* 3 — Actions (only when there is something to assign) */}
      {selected.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                {to("orders.unsaved_changes")}
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
              disabled={busy || !vehicle || selected.length === 0}
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
