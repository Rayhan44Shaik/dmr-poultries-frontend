// src/modules/operations/orders/ordersService.ts
// Orders module API layer — reuses the existing HTTP client and the existing
// trip/deliveries contract. No second HTTP client, no new endpoints:
//
//   GET  /api/trips                          — all trips (listTrips)
//   GET  /api/masters/shops | vehicles | employees — reference data
//   POST /api/trips/:idOr0/steps/deliveries   — collection save / finish
//        (id 0 = create the day's collection container; mode save | submit)
//   POST /api/trips/:id/steps/deliveries      — assignment save / finish
//   sendDeliveryWhatsApp (existing service)   — WhatsApp
//
// The order collection persists as delivery-plan rows on a vehicle-less
// container trip (ONE container per operational day); assignment copies the
// rows onto the chosen vehicle trip (rows carry ` O:<containerTripNo>`);
// Step 4 then records the actual delivery into the same rows (source of
// truth for progress), so Orders never keeps a parallel copy. The container
// is NEVER deleted — it remains the day's collection record, and the
// same-shop/same-day uniqueness rule is derived from this persisted data on
// every load.

import { apiPost } from "../../../api";
import type { ShopDelivery, Trip } from "../../../shared/trip";
import {
  listTrips,
  mapApiTripToTrip,
  toStep4Payload,
} from "../vehicle-trips/services/tripHeaderApiService";
import { sendDeliveryWhatsApp } from "../vehicle-trips/services/deliveryWhatsAppService";
import { loadShops } from "../../masters/shops/services/shopService";
import { loadVehicles } from "../../masters/vehicles/services/vehicleService";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import type { Vehicle } from "../../masters/vehicles/types/vehicle";
import {
  addLocalDays,
  buildOrdersTrip,
  collectionTotals,
  computeOrdersProgress,
  isCapturedRow,
  isEligibleVehicleTrip,
  isOrderContainer,
  isOrderPlanRow,
  isTrackingTrip,
  localToday,
  nextOrderTripNo,
  rowBoxes,
  rowsInSequence,
  toEligibleVehicle,
} from "./ordersUtils";
import {
  isOrderPlanRemarks,
  orderRowRemarks,
  parseOrderRef,
  type DayShopAssignment,
  type DayVehicleAssignmentRow,
  type DayVehicleView,
  type OrderShopRow,
  type OrdersDayCollection,
  type OrdersEligibleVehicle,
  type OrdersFetch,
  type OrdersTrip,
  type ShopOrderQuantities,
} from "./types";

type RawTrip = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ─── Trip data (classified client-side from persisted step flags) ───────────

/**
 * One call for everything the page renders (no N+1): day collections with
 * per-shop assignment facts, eligible vehicles, tracking trips and the
 * per-day read-only assignment views.
 */
export async function fetchOrdersData(): Promise<OrdersFetch> {
  const [trips, vehicles] = await Promise.all([
    listTrips(),
    loadVehicles().catch(() => [] as Vehicle[]),
  ]);
  const vehicleList = vehicles.map((v) => ({ id: v.id, noOfBoxes: v.noOfBoxes }));

  const today = localToday();
  const days = Array.from({ length: 7 }, (_, i) => addLocalDays(today, i - 6));

  // ── Per-day collections (one container per operational day) ─────────────
  const containers = trips.filter(isOrderContainer);
  const containerByNo = new Map(containers.map((c) => [c.tripNo, c]));

  // Original ORDERED quantities per shop per container (the authoritative
  // order record — Step 4 rewrites vehicle rows in place on delivery, so
  // ordered box counts live only here).
  const containerQuantitiesByNo = new Map<string, ShopOrderQuantities>();
  for (const container of containers) {
    const q: ShopOrderQuantities = new Map();
    for (const row of rowsInSequence(container)) {
      const shopId = num(row.shopId);
      if (!shopId || q.has(shopId)) continue;
      q.set(shopId, { boxes: rowBoxes(row), birds: num(row.birds), weight: num(row.weight) });
    }
    containerQuantitiesByNo.set(container.tripNo, q);
  }

  /** Resolve a trip's original order quantities via its order marker. */
  const quantitiesForTrip = (t: Trip): ShopOrderQuantities | undefined => {
    for (const row of rowsInSequence(t)) {
      const ref = parseOrderRef(row.remarks);
      if (ref && containerQuantitiesByNo.has(ref)) return containerQuantitiesByNo.get(ref);
    }
    return undefined;
  };

  // Trip-level status cache (shared by every shop assignment fact).
  const statusCache = new Map<number, "Assigned" | "In Progress" | "Completed">();
  const tripStatusOf = (t: Trip): "Assigned" | "In Progress" | "Completed" =>
    statusCache.get(t.id) ?? computeOrdersProgress(t, quantitiesForTrip(t)).status;

  const collectionsByDay: Record<string, OrdersDayCollection> = {};
  for (const container of containers) {
    const day = container.tripDate;
    if (!day) continue;
    const rows = rowsInSequence(container).map((row) => ({
      ...row,
      clientKey:
        typeof (row as OrderShopRow).clientKey === "string"
          ? (row as OrderShopRow).clientKey!
          : `id-${row.id}`,
    })) as OrderShopRow[];

    // Where each collected shop ended up (persisted vehicle-trip rows).
    const byShop = new Map<number, { trip: Trip; rows: ShopDelivery[] }>();
    for (const other of trips) {
      if (other.deleted) continue;
      const orderRows = rowsInSequence(other).filter(
        (r) => isOrderPlanRemarks(r.remarks) && parseOrderRef(r.remarks) === container.tripNo
      );
      if (orderRows.length === 0) continue;
      for (const r of orderRows) {
        const shopId = num(r.shopId);
        if (!shopId) continue;
        const acc = byShop.get(shopId) ?? { trip: other, rows: [] };
        acc.rows.push(r);
        byShop.set(shopId, acc);
      }
    }

    const shops = new Map<number, DayShopAssignment | null>();
    let assignedShops = 0;
    let assignedBoxes = 0;
    for (const row of rows) {
      const shopId = num(row.shopId);
      if (!shopId) continue;
      const acc = byShop.get(shopId);
      if (!acc) {
        shops.set(shopId, null);
        continue;
      }
      assignedShops += 1;
      // ORDERED boxes/birds (from the collection row itself — the
      // authoritative order; Step 4 rewrites the vehicle row in place).
      const orderedBoxes = rowBoxes(row);
      const orderedBirds = num(row.birds);
      assignedBoxes += orderedBoxes;
      shops.set(shopId, {
        tripNo: acc.trip.tripNo,
        vehicleNo: acc.trip.vehicleNo ?? "",
        sequence: Math.min(...acc.rows.map((r) => num(r.serialNo ?? r.id))),
        boxes: orderedBoxes,
        birds: orderedBirds,
        delivered: acc.rows.some(isCapturedRow),
        tripStatus: tripStatusOf(acc.trip),
        avgBirdWeight: num(acc.trip.avgBirdWeight),
      });
    }

    const totals = collectionTotals(rows);
    collectionsByDay[day] = {
      trip: container,
      rows,
      totalShops: totals.totalShops,
      totalBoxes: totals.totalBoxes,
      totalBirds: totals.totalBirds,
      finished: container.startStepSubmitted === true,
      assignedShops,
      assignedBoxes,
      fullyAssigned: rows.length > 0 && assignedShops >= rows.length,
      shops,
    };
  }

  // ── Per-day vehicle assignment views (Tab 2 read-only history) ──────────
  const dayVehicleViews: Record<string, DayVehicleView[]> = {};
  const viewsByDayTrip = new Map<string, { trip: Trip; rows: Map<number, ShopDelivery> }>();
  for (const trip of trips) {
    if (trip.deleted) continue;
    const orderRows = rowsInSequence(trip).filter(isOrderPlanRow);
    if (orderRows.length === 0) continue;
    for (const r of orderRows) {
      const ref = parseOrderRef(r.remarks);
      if (!ref) continue;
      const day = containerByNo.get(ref)?.tripDate;
      if (!day) continue;
      const key = `${day}|${trip.id}`;
      let acc = viewsByDayTrip.get(key);
      if (!acc) {
        acc = { trip, rows: new Map() };
        viewsByDayTrip.set(key, acc);
      }
      const shopId = num(r.shopId);
      if (shopId && !acc.rows.has(shopId)) acc.rows.set(shopId, r);
    }
  }
  for (const [key, acc] of viewsByDayTrip) {
    const day = key.split("|")[0];
    const rows: DayVehicleAssignmentRow[] = [...acc.rows.values()]
      .sort((a, b) => num(a.serialNo ?? a.id) - num(b.serialNo ?? b.id))
      .map((r) => ({
        shopId: num(r.shopId),
        shopName: r.shopName || "—",
        sequence: num(r.serialNo ?? r.id),
        boxes: rowBoxes(r),
        birds: num(r.farmBirds ?? r.birds),
        delivered: isCapturedRow(r),
      }));
    const view: DayVehicleView = {
      trip: acc.trip,
      rows,
      boxes: rows.reduce((s, r) => s + r.boxes, 0),
      shops: rows.length,
      deliveredShops: rows.filter((r) => r.delivered).length,
      status: tripStatusOf(acc.trip),
      allDelivered: rows.length > 0 && rows.every((r) => r.delivered),
    };
    (dayVehicleViews[day] ??= []).push(view);
  }
  for (const day of Object.keys(dayVehicleViews)) {
    dayVehicleViews[day].sort(
      (a, b) => a.trip.tripDate.localeCompare(b.trip.tripDate) || a.trip.id - b.trip.id
    );
  }

  // ── Tab 2 vehicle select (Step 2 complete, deliveries not submitted) ────
  const eligibleVehicles: OrdersEligibleVehicle[] = trips
    .filter(isEligibleVehicleTrip)
    .map((trip) => toEligibleVehicle(trip, vehicleList))
    .sort((a, b) => a.trip.vehicleNo.localeCompare(b.trip.vehicleNo) || a.trip.id - b.trip.id);

  // ── Tab 3 — ALL order-assigned trips (active on any day + the FULL
  //    completed history). The backend keeps every record; the tracking
  //    tab shows completed trips inside its controlled [From → To] range
  //    (default: the last 7 operational days) — a frontend window only.
  const tracking: OrdersTrip[] = trips
    .filter(isTrackingTrip)
    .map((trip) => buildOrdersTrip(trip, quantitiesForTrip(trip)))
    .sort(
      (a, b) =>
        a.trip.tripDate.localeCompare(b.trip.tripDate) * -1 || b.trip.id - a.trip.id
    );

  return {
    today,
    days,
    collectionsByDay,
    nextTripNo: nextOrderTripNo(trips),
    eligibleVehicles,
    tracking,
    dayVehicleViews,
  };
}

// ─── Collection persistence (existing deliveries step contract) ─────────────

function toOrderPayload(rows: OrderShopRow[]): Record<string, unknown> {
  const payload = toStep4Payload({ deliveries: rows } as unknown as Partial<Trip>);
  // The collection stage knows no bird type yet (it is decided later in
  // Step 2 / Step 4). Persist bird_type_id as NULL — 0 would violate the
  // bird_types FK.
  payload.deliveries = (payload.deliveries as Array<Record<string, unknown>>).map(
    (d) => {
      const { birdTypeId, ...rest } = d;
      void birdTypeId;
      return rest;
    }
  );
  return payload;
}

/**
 * Save Progress (Tab 1) — partial collections allowed (>= 1 row, no final
 * validation). Reuses the day's container when one exists; creates it when
 * containerId is null.
 */
export async function saveCollection(
  containerId: number | null,
  tripNo: string | null,
  rows: OrderShopRow[]
): Promise<Trip> {
  const body: Record<string, unknown> = {
    ...toOrderPayload(rows),
    mode: "save",
    ...(containerId == null && tripNo ? { tripNo } : {}),
  };
  const id = containerId ?? 0;
  const { data } = await apiPost<RawTrip>(`/trips/${id}/steps/deliveries`, body);
  return mapApiTripToTrip(data, {} as Trip);
}

/** Finish Collection (Tab 1) — final validation already done by the caller. */
export async function finishCollection(
  containerId: number | null,
  tripNo: string | null,
  rows: OrderShopRow[]
): Promise<Trip> {
  const body: Record<string, unknown> = {
    ...toOrderPayload(rows),
    mode: "save",
    startStepSubmitted: true,
    ...(containerId == null && tripNo ? { tripNo } : {}),
  };
  const id = containerId ?? 0;
  const { data } = await apiPost<RawTrip>(`/trips/${id}/steps/deliveries`, body);
  return mapApiTripToTrip(data, {} as Trip);
}

/** Map persisted rows (after a save) back to editor rows. */
export function toEditorRows(trip: Trip): OrderShopRow[] {
  return rowsInSequence(trip).map((row) => ({
    ...row,
    clientKey:
      typeof (row as { clientKey?: string }).clientKey === "string" &&
      (row as { clientKey?: string }).clientKey
        ? (row as { clientKey?: string }).clientKey!
        : `id-${row.id}`,
  }));
}

// ─── Assignment persistence ─────────────────────────────────────────────────

/** One collection order's rows being written to the vehicle trip. */
export type AssignmentGroup = {
  orderTripNo: string;
  rows: OrderShopRow[];
};

/**
 * Rows for the vehicle trip after one order's rows are (re)written: keep
 * every row that does NOT belong to THAT order (other orders / manual rows
 * untouched, including their own order reference), then append the order's
 * assigned rows. Serial numbers are renumbered 1..N.
 */
export function mergeOrderRowsInto(
  baseRows: ShopDelivery[],
  orderTripNo: string,
  assignedRows: ShopDelivery[]
): ShopDelivery[] {
  const kept = baseRows.filter(
    (row) => !isOrderPlanRemarks(row.remarks) || parseOrderRef(row.remarks) !== orderTripNo
  );
  return [...kept, ...assignedRows].map((row, index) => ({
    ...row,
    serialNo: index + 1,
    id: 0,
  }));
}

/**
 * Order-plan rows do not carry a real bird type yet (Step 2 / Step 4 decide
 * it). birdTypeId 0 would violate the bird_types FK — normalize it to NULL
 * for every row we write (rows with a genuine id are kept untouched).
 */
function normalizeBirdType(deliveries: ShopDelivery[]): ShopDelivery[] {
  return deliveries.map((row) => {
    if (row.birdTypeId > 0) return row;
    const { birdTypeId, ...rest } = row as ShopDelivery & { birdTypeId?: number };
    void birdTypeId;
    return rest as ShopDelivery;
  });
}

function buildAssignmentDeliveries(vehicleTrip: Trip, groups: AssignmentGroup[]): ShopDelivery[] {
  let deliveries = rowsInSequence(vehicleTrip);
  for (const group of groups) {
    const withRef = group.rows.map((row) => ({
      ...row,
      remarks: orderRowRemarks(group.orderTripNo),
    }));
    deliveries = mergeOrderRowsInto(deliveries, group.orderTripNo, withRef);
  }
  return normalizeBirdType(deliveries);
}

/** Save Progress (Tab 2) — partial assignments persist, no final validation. */
export async function saveAssignment(
  vehicleTrip: Trip,
  groups: AssignmentGroup[]
): Promise<Trip> {
  const deliveries = buildAssignmentDeliveries(vehicleTrip, groups);
  const { data } = await apiPost<RawTrip>(
    `/trips/${vehicleTrip.id}/steps/deliveries`,
    { ...toStep4Payload({ deliveries } as unknown as Partial<Trip>), mode: "save" }
  );
  return mapApiTripToTrip(data, vehicleTrip);
}

/**
 * Finish Assignment (Tab 2) — validated by the caller; marks
 * deliveryStepSubmitted (existing contract) and links order → vehicle in
 * the trip remarks. The collection container is kept — it remains the day's
 * collection record (Trip No / Vehicle / Sequence / Status stay visible in
 * Order Collection), and the same-shop/same-day rule now reads "assigned".
 */
export async function finishAssignment(
  vehicleTrip: Trip,
  groups: AssignmentGroup[]
): Promise<Trip> {
  const deliveries = buildAssignmentDeliveries(vehicleTrip, groups);
  let remarks = String(vehicleTrip.remarks ?? "").trim();
  for (const group of groups) {
    const tag = `order:${group.orderTripNo}`;
    if (!remarks.includes(tag)) remarks = remarks ? `${remarks} | ${tag}` : tag;
  }
  const { data } = await apiPost<RawTrip>(
    `/trips/${vehicleTrip.id}/steps/deliveries`,
    { ...toStep4Payload({ deliveries } as unknown as Partial<Trip>), mode: "submit", remarks }
  );
  return mapApiTripToTrip(data, vehicleTrip);
}

/**
 * Same-shop / same-day duplicate guard — enforced from FRESH persisted data
 * (never just React state). Returns the shop names that are already assigned
 * to a DIFFERENT vehicle for the day (empty = safe to save).
 */
export async function findDayShopConflicts(
  day: string,
  selected: Array<{ shopId: number; shopName: string }>,
  vehicleTripNo: string
): Promise<string[]> {
  const fresh = await fetchOrdersData();
  const coll = fresh.collectionsByDay[day];
  if (!coll) return [];
  const conflicts: string[] = [];
  for (const { shopId, shopName } of selected) {
    const assignment = coll.shops.get(shopId);
    if (assignment && assignment.tripNo !== vehicleTripNo) {
      conflicts.push(shopName || `Shop ${shopId}`);
    }
  }
  return conflicts;
}

// ─── Reference data (shop villages, vehicle capacity, supervisor mobiles) ───

/**
 * Shop Master reference data per shop id. `mobile` is the Shop Master's
 * registered phone number — the ONLY source for the "Shop Mobile" column.
 * Never invented, never defaulted; empty when the master has none.
 */
export type ShopDirectory = Map<
  number,
  { shopName: string; village: string; mobile: string }
>;
export type SupervisorDirectory = Map<string, string>; // name (lower) -> mobile

export async function loadShopDirectory(): Promise<ShopDirectory> {
  const shops = await loadShops().catch(() => []);
  const dir: ShopDirectory = new Map();
  for (const shop of shops) {
    dir.set(shop.id, {
      shopName: shop.shopName,
      village: shop.village,
      mobile: (shop.phoneNumber ?? "").trim(),
    });
  }
  return dir;
}

export async function loadSupervisorDirectory(): Promise<SupervisorDirectory> {
  const employees = await loadEmployees().catch(() => []);
  const dir: SupervisorDirectory = new Map();
  for (const emp of employees) {
    const name = emp.employeeName?.trim().toLowerCase();
    if (name && emp.phoneNumber) dir.set(name, emp.phoneNumber);
  }
  return dir;
}

export function supervisorMobileOf(trip: Trip, directory: SupervisorDirectory): string {
  const byId = directory.get(String(trip.supervisorId ?? ""));
  if (byId) return byId;
  return directory.get(trip.supervisorName?.trim().toLowerCase() ?? "") ?? "";
}

export function villageOf(
  shopId: number,
  shopName: string,
  directory: ShopDirectory
): string {
  return directory.get(shopId)?.village ?? shopName ?? "";
}

/** Shop Mobile from the Shop Master only ("" when the master has none). */
export function shopMobileOf(
  shopId: number,
  directory: ShopDirectory
): string {
  return directory.get(shopId)?.mobile ?? "";
}

// ─── WhatsApp — existing per-delivery mechanism, order-level usage ──────────

export type OrdersWhatsAppResult = {
  enabled: boolean;
  sent: number;
  failed: number;
  skipped: number;
  message?: string;
};

/**
 * Sends the order/assignment to the supervisor through the EXISTING WhatsApp
 * service (per-delivery PDF endpoint) — same mechanism Step 4 / Trip View use.
 * Sequential, so progress stays visible and one failure never stops the rest.
 */
export async function sendOrdersWhatsApp(
  trip: Trip,
  supervisorMobile: string,
  onProgress?: (sent: number, total: number, shopName: string) => void
): Promise<OrdersWhatsAppResult> {
  const rows = rowsInSequence(trip).filter((r) => r.shopId > 0);
  if (rows.length === 0) {
    return { enabled: true, sent: 0, failed: 0, skipped: 0, message: "no_rows" };
  }

  const result: OrdersWhatsAppResult = { enabled: true, sent: 0, failed: 0, skipped: 0 };
  let sent = 0;
  for (const row of rows) {
    onProgress?.(sent, rows.length, row.shopName || "Shop");
    const outcome = await sendDeliveryWhatsApp({
      trip,
      delivery: { ...row, autoCaptureTime: row.autoCaptureTime } as ShopDelivery,
      shopWhatsApp: supervisorMobile || null,
    }).catch((error: unknown) => ({
      success: false,
      status: "failed" as const,
      message: error instanceof Error ? error.message : undefined,
    }));
    if (outcome.success) {
      result.sent += 1;
      sent += 1;
    } else {
      result.failed += 1;
      if (!result.message) result.message = outcome.message;
    }
  }
  onProgress?.(sent, rows.length, "");
  return result;
}

// ─── Client-side page slice (the pattern used across the existing Ops pages) ─

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
