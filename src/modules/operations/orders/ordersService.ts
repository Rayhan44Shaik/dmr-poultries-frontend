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
import { loadShops } from "../../masters/shops/services/shopService";
import { loadVehicles } from "../../masters/vehicles/services/vehicleService";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import type { Vehicle } from "../../masters/vehicles/types/vehicle";
import {
  addLocalDays,
  buildOrdersTrip,
  buildShopDeliveryRow,
  collectionTotals,
  computeOrdersProgress,
  deliveredRowBoxes,
  isCapturedRow,
  isEligibleVehicleTrip,
  isOrderContainer,
  isOrderPlanRow,
  isTrackingTrip,
  localToday,
  nextOrderTripNo,
  planShareBoxes,
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
import {
  ORDERS_SAMPLE_DATA_ENABLED,
  SAMPLE_SHOPS,
  applySampleDeliveries,
  sampleSupervisorDirectory,
  sampleTrips,
  sampleVehicleCapacities,
} from "./sampleOrdersData";

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
  // Sample-data mode makes NO request at all (see sampleOrdersData.ts): the
  // bundled trips go through the very same derivation below, so every Orders
  // rule (containers, capacity, uniqueness, progress) still applies.
  let trips: Trip[];
  let vehicleList: Array<{ id: number; noOfBoxes?: number }>;
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    trips = sampleTrips();
    vehicleList = sampleVehicleCapacities();
  } else {
    const [liveTrips, vehicles] = await Promise.all([
      listTrips(),
      loadVehicles().catch(() => [] as Vehicle[]),
    ]);
    trips = liveTrips;
    vehicleList = vehicles.map((v) => ({ id: v.id, noOfBoxes: v.noOfBoxes }));
  }

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

  /**
   * Per-trip ordered-quantity overrides for shops SPLIT across several
   * vehicles: each trip's ordered basis for a shared shop is its own share.
   * Filled by the collection loop below; read by `quantitiesForTrip`.
   */
  const tripShareOverrides = new Map<number, ShopOrderQuantities>();

  /** Resolve a trip's original order quantities via its order marker. */
  const quantitiesForTrip = (t: Trip): ShopOrderQuantities | undefined => {
    let base: ShopOrderQuantities | undefined;
    for (const row of rowsInSequence(t)) {
      const ref = parseOrderRef(row.remarks);
      if (ref && containerQuantitiesByNo.has(ref)) {
        base = containerQuantitiesByNo.get(ref);
        break;
      }
    }
    const overrides = tripShareOverrides.get(t.id);
    if (!overrides) return base;
    // Merge: unshared shops keep the container's authoritative quantities;
    // shared shops are replaced by THIS trip's share.
    const merged: ShopOrderQuantities = new Map(base ?? []);
    for (const [shopId, q] of overrides) merged.set(shopId, q);
    return merged;
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

    // Where each collected shop ended up (persisted vehicle-trip rows) —
    // one bucket PER VEHICLE TRIP, because a shop's order can be SPLIT over
    // several vehicles (40 collected → 20 on TRP-A + 20 on TRP-B).
    const byShop = new Map<number, Array<{ trip: Trip; rows: ShopDelivery[] }>>();
    for (const other of trips) {
      if (other.deleted) continue;
      const orderRows = rowsInSequence(other).filter(
        (r) => isOrderPlanRemarks(r.remarks) && parseOrderRef(r.remarks) === container.tripNo
      );
      if (orderRows.length === 0) continue;
      for (const r of orderRows) {
        const shopId = num(r.shopId);
        if (!shopId) continue;
        let buckets = byShop.get(shopId);
        if (!buckets) {
          buckets = [];
          byShop.set(shopId, buckets);
        }
        let bucket = buckets.find((b) => b.trip.id === other.id);
        if (!bucket) {
          bucket = { trip: other, rows: [] };
          buckets.push(bucket);
        }
        bucket.rows.push(r);
      }
    }

    const shops = new Map<number, DayShopAssignment | null>();
    let assignedShops = 0;
    let assignedBoxes = 0;
    let allFullyAssigned = rows.length > 0;
    for (const row of rows) {
      const shopId = num(row.shopId);
      if (!shopId) continue;
      const buckets = byShop.get(shopId);
      if (!buckets || buckets.length === 0) {
        shops.set(shopId, null);
        allFullyAssigned = false;
        continue;
      }
      assignedShops += 1;
      // ORDERED boxes/birds (from the collection row itself — the
      // authoritative order; Step 4 rewrites the vehicle row in place).
      const orderedBoxes = rowBoxes(row);
      const orderedBirds = num(row.birds);
      // One part per vehicle trip carrying a share of this shop's order.
      const parts = buckets.map((bucket) => ({
        tripId: bucket.trip.id,
        tripNo: bucket.trip.tripNo,
        vehicleNo: bucket.trip.vehicleNo ?? "",
        boxes: planShareBoxes(bucket.rows),
        delivered: bucket.rows.some(isCapturedRow),
        deliveredBoxes: bucket.rows
          .filter(isCapturedRow)
          .reduce((sum, r) => sum + deliveredRowBoxes(r), 0),
      }));
      const assignedBoxesTotal = parts.reduce((sum, p) => sum + p.boxes, 0);
      assignedBoxes += assignedBoxesTotal;
      // The balance (40 ordered → 20 on one truck) stays assignable — only a
      // shop with nothing left counts towards a fully-assigned day.
      if (assignedBoxesTotal < orderedBoxes) allFullyAssigned = false;
      const primary = buckets[0];
      shops.set(shopId, {
        tripNo: primary.trip.tripNo,
        vehicleNo: primary.trip.vehicleNo ?? "",
        sequence: Math.min(...buckets.flatMap((b) => b.rows.map((r) => num(r.serialNo ?? r.id)))),
        boxes: orderedBoxes,
        birds: orderedBirds,
        delivered: parts.some((p) => p.delivered),
        // A partial delivery (10 of 25 boxes) must stay visible as a balance,
        // so the collection table can tell "delivered" from "part delivered".
        deliveredBoxes: parts.reduce((sum, p) => sum + p.deliveredBoxes, 0),
        tripStatus: tripStatusOf(primary.trip),
        avgBirdWeight: num(primary.trip.avgBirdWeight),
        parts,
        assignedBoxesTotal,
      });

      // SPLIT ORDER: when several vehicles share a shop's order, each trip's
      // ordered basis is its OWN share (20 of 40), never the whole order.
      if (buckets.length > 1) {
        for (const bucket of buckets) {
          const share = planShareBoxes(bucket.rows);
          const overrides = tripShareOverrides.get(bucket.trip.id) ?? new Map();
          const base = containerQuantitiesByNo.get(container.tripNo)?.get(shopId);
          overrides.set(shopId, {
            boxes: share,
            birds: orderedBoxes > 0 ? Math.round(((base?.birds ?? orderedBirds) * share) / orderedBoxes) : 0,
            weight:
              orderedBoxes > 0
                ? Number((((base?.weight ?? 0) * share) / orderedBoxes).toFixed(2))
                : 0,
          });
          tripShareOverrides.set(bucket.trip.id, overrides);
        }
      }
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
      fullyAssigned: allFullyAssigned,
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
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return applySampleDeliveries(containerId, rows, {}, tripNo ?? undefined);
  }
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
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return applySampleDeliveries(
      containerId,
      rows,
      { startStepSubmitted: true },
      tripNo ?? undefined
    );
  }
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
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return applySampleDeliveries(vehicleTrip.id, deliveries);
  }
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
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return applySampleDeliveries(vehicleTrip.id, deliveries, {
      deliveryStepSubmitted: true,
      remarks,
    });
  }
  const { data } = await apiPost<RawTrip>(
    `/trips/${vehicleTrip.id}/steps/deliveries`,
    { ...toStep4Payload({ deliveries } as unknown as Partial<Trip>), mode: "submit", remarks }
  );
  return mapApiTripToTrip(data, vehicleTrip);
}

/**
 * Record ONE shop's delivery (Step 4) on an order-assigned vehicle trip —
 * the shop-level capture behind Tab 3.
 *
 * PARTIAL by design: only the boxes entered are captured, so the remaining
 * boxes stay open ("Part Delivered") until the rest is delivered. The
 * caller clamps the entry to the remaining boxes, which is also the
 * duplicate guard — a shop whose order is fully in has nothing left to
 * capture and is locked in the UI.
 */
export async function recordShopDelivery(
  vehicleTrip: Trip,
  entry: { shopId: number; boxes: number }
): Promise<Trip> {
  const rows = rowsInSequence(vehicleTrip);
  const plan = rows.find((r) => num(r.shopId) === num(entry.shopId)) ?? null;
  const captured = buildShopDeliveryRow(vehicleTrip, plan, entry);
  const deliveries = normalizeBirdType([...rows, captured]);
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return applySampleDeliveries(vehicleTrip.id, deliveries);
  }
  const { data } = await apiPost<RawTrip>(
    `/trips/${vehicleTrip.id}/steps/deliveries`,
    { ...toStep4Payload({ deliveries } as unknown as Partial<Trip>), mode: "save" }
  );
  return mapApiTripToTrip(data, vehicleTrip);
}

/**
 * Save the delivery state exactly as it stands — the explicit "Save Progress"
 * from the report check popup, so the operator can bank the entries before
 * sending the report out.
 */
export async function saveShopDeliveries(vehicleTrip: Trip): Promise<Trip> {
  const rows = rowsInSequence(vehicleTrip);
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return applySampleDeliveries(vehicleTrip.id, rows);
  }
  const { data } = await apiPost<RawTrip>(
    `/trips/${vehicleTrip.id}/steps/deliveries`,
    { ...toStep4Payload({ deliveries: rows } as unknown as Partial<Trip>), mode: "save" }
  );
  return mapApiTripToTrip(data, vehicleTrip);
}

/**
 * Submit the delivery trip from the report check popup — the deliveries are
 * confirmed and the trip closes as Completed (the same contract the backend
 * uses for a submitted Step 4).
 */
export async function submitShopDeliveries(vehicleTrip: Trip): Promise<Trip> {
  const rows = rowsInSequence(vehicleTrip);
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return applySampleDeliveries(vehicleTrip.id, rows, {
      status: "Completed",
      submittedAtTimestamp: new Date().toISOString(),
    });
  }
  const { data } = await apiPost<RawTrip>(
    `/trips/${vehicleTrip.id}/steps/deliveries`,
    { ...toStep4Payload({ deliveries: rows } as unknown as Partial<Trip>), mode: "submit", remarks: "[ORDER] delivery submitted" }
  );
  return mapApiTripToTrip(data, vehicleTrip);
}

/** One selected shop that would push its order over the collected boxes. */
export type DayOverAssignment = {
  shopId: number;
  shopName: string;
  /** Boxes the shop ordered for the day (the collection total). */
  ordered: number;
  /** Boxes already assigned to OTHER vehicle trips (from fresh data). */
  elsewhere: number;
  /** Boxes still assignable: ordered − elsewhere (never negative). */
  remaining: number;
  /** Boxes this vehicle is trying to take. */
  requested: number;
};

/**
 * The split-order balance guard — enforced from FRESH persisted data (never
 * just React state), so two operators working two vehicles can never push a
 * shop over its collected boxes:
 *
 *   40 collected → TRP-A saved 20 → TRP-B may take at most 20.
 *   TRP-B asking for 40 returns an issue with remaining = 20.
 *
 * The vehicle's OWN previously saved rows are excluded (a save REPLACES the
 * vehicle's rows for the order, so they never count against the balance).
 * Returns one issue per shop whose requested boxes exceed its remaining
 * balance (empty = safe to save).
 */
export async function findDayOverAssignments(
  day: string,
  selected: Array<{ shopId: number; shopName: string; boxes: number }>,
  vehicleTripNo: string
): Promise<DayOverAssignment[]> {
  const fresh = await fetchOrdersData();
  const coll = fresh.collectionsByDay[day];
  if (!coll) return [];
  const issues: DayOverAssignment[] = [];
  for (const sel of selected) {
    const orderRow = coll.rows.find((r) => num(r.shopId) === num(sel.shopId));
    if (!orderRow) continue; // not part of the day's collection — nothing to check
    const ordered = rowBoxes(orderRow);
    const parts = coll.shops.get(sel.shopId)?.parts ?? [];
    const elsewhere = parts
      .filter((p) => p.tripNo !== vehicleTripNo)
      .reduce((sum, p) => sum + p.boxes, 0);
    const remaining = Math.max(0, ordered - elsewhere);
    if (sel.boxes > remaining) {
      issues.push({
        shopId: sel.shopId,
        shopName: sel.shopName || `Shop ${sel.shopId}`,
        ordered,
        elsewhere,
        remaining,
        requested: sel.boxes,
      });
    }
  }
  return issues;
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
  if (ORDERS_SAMPLE_DATA_ENABLED) {
    return new Map(
      SAMPLE_SHOPS.map((shop) => [
        shop.id,
        { shopName: shop.shopName, village: shop.village, mobile: shop.mobile },
      ])
    );
  }
  const shops = await loadShops().catch(() => []);
  const dir: ShopDirectory = new Map();
  for (const shop of shops) {
    dir.set(shop.id, {
      shopName: shop.shopName,
      // The Shop Master redesign renamed `village` to `city`; Orders keeps its
      // own "village" wording for the column but reads the master's field.
      village: shop.city,
      mobile: (shop.phoneNumber ?? "").trim(),
    });
  }
  return dir;
}

export async function loadSupervisorDirectory(): Promise<SupervisorDirectory> {
  if (ORDERS_SAMPLE_DATA_ENABLED) return sampleSupervisorDirectory();
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Unable to read PDF bytes."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Order Assignment Review & Submit — ONE WhatsApp to the vehicle SUPERVISOR
 * mobile only. Shop-owner numbers are never used as the recipient.
 */
export function isOrdersWhatsAppConfigured(): boolean {
  return import.meta.env.VITE_WHATSAPP_BACKEND_ENABLED === "true";
}

export async function sendOrdersWhatsApp(
  trip: Trip,
  supervisorMobile: string,
  onProgress?: (sent: number, total: number, shopName: string) => void
): Promise<OrdersWhatsAppResult> {
  if (!isOrdersWhatsAppConfigured()) {
    return {
      enabled: false,
      sent: 0,
      failed: 1,
      skipped: 0,
      message: "WhatsApp integration is not configured yet.",
    };
  }

  const recipient = String(supervisorMobile || "").trim();
  if (!recipient) {
    return {
      enabled: true,
      sent: 0,
      failed: 1,
      skipped: 0,
      message: "Supervisor mobile is missing — nothing sent to shop owners.",
    };
  }

  const rows = rowsInSequence(trip).filter((r) => r.shopId > 0);
  if (rows.length === 0) {
    return { enabled: true, sent: 0, failed: 1, skipped: 0, message: "no_rows" };
  }

  onProgress?.(0, 1, trip.supervisorName || "Supervisor");

  try {
    const { generateAssignmentSheetPdf } = await import("./pdf/generateAssignmentSheetPdf");
    const orderTripNo =
      rows.map((r) => parseOrderRef(r.remarks)).find((ref) => Boolean(ref)) || trip.tripNo;
    const built = await generateAssignmentSheetPdf({
      trip,
      supervisorMobile: recipient,
      orderTripNo,
      orderDate: trip.tripDate,
      rows: rows.map((r, i) => ({
        serialNo: i + 1,
        shopId: r.shopId,
        shopName: r.shopName || "Shop",
        village: String((r as { village?: string }).village ?? ""),
        mobile: "",
        boxes: rowBoxes(r),
        birds: num(r.birds),
      })),
      capacity: 0,
      alreadyAssignedOther: 0,
      mode: "preview",
    });
    const pdfBase64 = await blobToBase64(built.blob);
    URL.revokeObjectURL(built.url);
    await apiPost(
      `/trips/${trip.id}/whatsapp`,
      {
        recipient,
        supervisorMobile: recipient,
        shopWhatsApp: recipient,
        message: `DMR Poultries assignment for ${trip.tripNo} · ${trip.vehicleNo || ""}`.trim(),
        pdfBase64,
        fileName: built.fileName,
      },
      { timeout: 60_000 }
    );
    onProgress?.(1, 1, "");
    return { enabled: true, sent: 1, failed: 0, skipped: 0 };
  } catch (error: unknown) {
    return {
      enabled: true,
      sent: 0,
      failed: 1,
      skipped: 0,
      message: error instanceof Error ? error.message : "send failed",
    };
  }
}

// ─── Client-side page slice (the pattern used across the existing Ops pages) ─

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
