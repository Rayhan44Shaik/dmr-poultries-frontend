// src/modules/order/services/deliverySequencingService.ts
// -----------------------------------------------------------------------------
// Delivery sequencing for the Order module.
//
// This is the practical poultry-dispatch model:
//
//   Orders → Priority phase → Deadline feasibility → Nearest feasible next
//   shop → (deliver) → vehicle location updates → recalculate.
//
// It does NOT simply sort orders by priority and stop. Sequencing is greedy and
// *recalculated after every delivery*, from the vehicle's CURRENT location.
//
// Optimization levels (highest first — never reversed):
//   L1  Mandatory feasibility  (valid GPS, vehicle can actually serve the order)
//   L2  Delivery priority      (phase: Critical > Important > Normal)
//   L3  Deadline risk          (earliest constrained deadline / lowest buffer)
//   L4  Distance efficiency    (nearest feasible next shop from current location)
//   L5  Route efficiency       (existing route alignment)
//   L6  Load balancing         (not applicable within a single vehicle's plan)
//
// Orders that cannot be routed (missing/invalid GPS) are NEVER silently
// dropped — they are returned as `unplannedOrders` so the total stays
// internally consistent (planned + unplanned = total).
//
// A lower-phase order whose deadline is about to be missed is *promoted* as a
// DEADLINE EXCEPTION. Its base phase is preserved (never mutated); only its
// *effective planning phase* changes, and the UI surfaces both.
// -----------------------------------------------------------------------------

import type { GpsCoordinate, Order, PickupSource } from "../types/orderTypes";
import type {
  BufferState,
  DeadlineFeasibility,
  DeliveryPhase,
  DeliveryPhaseNumber,
  DeliveryStopPlan,
  RouteVehicle,
  UnplannedOrder,
  VehicleSchedule,
} from "../types/routeTypes";
import { classifyBuffer, classifyFeasibility, planningStateOf } from "../utils/feasibility";
import { isValidCoordinate } from "../utils/gps";
import { formatClock, formatHHmm, parseHHmm } from "../utils/businessTime";
import { haversineKm, mockRouteCalculationService } from "./routeCalculationService";

/** Deadlines within this window (minutes) are treated as "comparable". */
export const DEADLINE_COMPARABLE_WINDOW_MINUTES = 30;
/** A stop is "deadline-critical" when its buffer is below this many minutes. */
export const CRITICAL_BUFFER_MINUTES = 10;

export const PHASE_NUMBER: Record<DeliveryPhase, DeliveryPhaseNumber> = {
  Critical: 1,
  Important: 2,
  Normal: 3,
};

export const PHASE_LABEL: Record<DeliveryPhase, string> = {
  Critical: "URGENT",
  Important: "IMPORTANT",
  Normal: "NORMAL",
};

/**
 * Map an order to its delivery phase (documented behaviour):
 *   - Urgent priority → Critical (including Urgent + Important customer)
 *   - Important priority, OR Normal + Important customer → Important
 *   - Otherwise → Normal
 */
export function phaseOfOrder(order: Order): DeliveryPhase {
  if (order.priority === "Urgent") return "Critical";
  if (order.priority === "Important" || order.importantCustomer) return "Important";
  return "Normal";
}

/** The base phase = highest-priority phase present among the given orders. */
export function activePhaseOf(orders: Order[]): DeliveryPhase | null {
  if (orders.length === 0) return null;
  return orders.reduce<DeliveryPhase | null>((current, o) => {
    const p = phaseOfOrder(o);
    if (current == null) return p;
    return PHASE_NUMBER[p] < PHASE_NUMBER[current] ? p : current;
  }, null);
}

export interface SequencingState {
  /** Vehicle's current GPS (pickup farm at start, then each delivered shop). */
  currentGps: GpsCoordinate | null;
  /** Name of the current point (farm or previous shop). */
  currentName: string;
  /** Current time, minutes since midnight (departure time at start). */
  currentMinutes: number | null;
}

/** Feasibility + distance snapshot for one remaining order. */
interface EvaluatedOrder {
  order: Order;
  phase: DeliveryPhase;
  distanceKm: number | null;
  travelMinutes: number | null;
  arrivalMinutes: number | null;
  bufferMinutes: number | null;
  bufferState: BufferState;
  deadlineFeasible: DeadlineFeasibility;
}

export interface NextStopResult {
  stop: DeliveryStopPlan | null;
  /** Ranked alternatives (excludes the chosen stop) for the comparison UI. */
  alternatives: DeliveryStopPlan[];
  /** Base phase of the remaining orders (unaffected by any exception). */
  basePhase: DeliveryPhase | null;
  /** Remaining order count per phase. */
  remainingByPhase: Record<DeliveryPhase, number>;
  deadlineException: boolean;
  exceptionReason: string | null;
}

export interface DeliveryPlan {
  vehicleId: string;
  vehicleNo: string;
  pickup: PickupSource;
  schedule: VehicleSchedule;
  stops: DeliveryStopPlan[];
  /** Orders that could not be routed (never silently dropped). */
  unplannedOrders: UnplannedOrder[];
  totalOrderCount: number;
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  plannedBirds: number;
  plannedBoxes: number;
  unplannedBirds: number;
  unplannedBoxes: number;
  deadlineConflicts: boolean;
  /** Distance (km) saved vs a naive farm → each-shop baseline. */
  estimatedDistanceSavingKm: number | null;
}

/** Whether an order can be routed for a given vehicle (GPS must be valid). */
function isRouteable(order: Order, vehicle: RouteVehicle): boolean {
  return isValidCoordinate(order.shop.gps) && isValidCoordinate(vehicle.pickup.gps);
}

function unroutableReason(order: Order, vehicle: RouteVehicle): string {
  if (!isValidCoordinate(order.shop.gps)) return "GPS unavailable";
  if (!isValidCoordinate(vehicle.pickup.gps)) return "Pickup GPS unavailable";
  return "Unable to calculate";
}

function toUnplannedOrder(order: Order, vehicle: RouteVehicle): UnplannedOrder {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
    birds: order.birds,
    boxes: order.boxes,
    priority: order.priority,
    basePhase: phaseOfOrder(order),
    reason: unroutableReason(order, vehicle),
    planningState: "Unroutable",
  };
}

function evaluateOrder(order: Order, state: SequencingState): EvaluatedOrder | null {
  if (!isValidCoordinate(order.shop.gps) || !isValidCoordinate(state.currentGps)) return null;
  const distanceKm = haversineKm(state.currentGps, order.shop.gps);
  const travelMinutes =
    distanceKm != null ? mockRouteCalculationService.estimateTravelMinutes(distanceKm) : null;
  const deadlineMinutes = parseHHmm(order.deadlineTime);
  const arrivalMinutes =
    state.currentMinutes != null && travelMinutes != null ? state.currentMinutes + travelMinutes : null;
  const bufferMinutes =
    deadlineMinutes != null && arrivalMinutes != null ? deadlineMinutes - arrivalMinutes : null;

  return {
    order,
    phase: phaseOfOrder(order),
    distanceKm,
    travelMinutes,
    arrivalMinutes,
    bufferMinutes,
    bufferState: classifyBuffer(bufferMinutes),
    deadlineFeasible: classifyFeasibility(bufferMinutes),
  };
}

function isCritical(evaluated: EvaluatedOrder): boolean {
  return evaluated.bufferMinutes != null && evaluated.bufferMinutes < CRITICAL_BUFFER_MINUTES;
}

function toStopPlan(
  evaluated: EvaluatedOrder,
  state: SequencingState,
  cumulativeDistanceKm: number,
  reason: string[],
  deadlineException: boolean,
  promotionReason: string | null,
): DeliveryStopPlan {
  const o = evaluated.order;
  const basePhase = phaseOfOrder(o);
  const effectivePhase = deadlineException ? "Critical" : basePhase;
  return {
    orderId: o.id,
    orderNumber: o.orderNumber,
    shopName: o.shop.name,
    address: o.shop.address ? `${o.shop.address.city}` : o.shop.location,
    priority: o.priority,
    importantCustomer: o.importantCustomer,
    deadlineLabel: o.deadlineLabel,
    deadlineTime: o.deadlineTime,
    basePhase,
    effectivePlanningPhase: effectivePhase,
    deadlineException,
    promotionReason,
    fromName: state.currentName,
    fromGps: state.currentGps,
    legDistanceKm: evaluated.distanceKm,
    cumulativeDistanceKm: evaluated.distanceKm != null ? Math.round((cumulativeDistanceKm + evaluated.distanceKm) * 10) / 10 : cumulativeDistanceKm || null,
    travelMinutes: evaluated.travelMinutes,
    departureTime: state.currentMinutes != null ? formatClock(state.currentMinutes) : null,
    arrivalTime: evaluated.arrivalMinutes != null ? formatClock(evaluated.arrivalMinutes) : null,
    arrivalMinutes: evaluated.arrivalMinutes,
    bufferMinutes: evaluated.bufferMinutes,
    bufferState: evaluated.bufferState,
    deadlineFeasible: evaluated.deadlineFeasible,
    planningState: planningStateOf(evaluated.deadlineFeasible),
    reason,
    serviceMinutes: 0,
  };
}

/**
 * Select the next delivery stop from the vehicle's CURRENT position.
 *
 * Deterministic decision hierarchy (requirement #13):
 *   STEP 1  find remaining orders (routeable subset)
 *   STEP 2  determine base phase
 *   STEP 3  identify deadline-critical exceptions
 *   STEP 4  remove unroutable candidates (handled by the caller's partition)
 *   STEP 5  protect deadline-critical deliveries
 *   STEP 6  respect the active priority phase
 *   STEP 7  within comparable deadlines, choose nearest feasible stop
 *   STEP 8  route efficiency tie-break
 *   STEP 9  return explanation
 */
export function selectNextDeliveryStop(
  state: SequencingState,
  orders: Order[],
): NextStopResult {
  const empty: NextStopResult = {
    stop: null,
    alternatives: [],
    basePhase: null,
    remainingByPhase: { Critical: 0, Important: 0, Normal: 0 },
    deadlineException: false,
    exceptionReason: null,
  };

  const evaluated = orders
    .map((o) => evaluateOrder(o, state))
    .filter((e): e is EvaluatedOrder => e != null);

  const basePhase = activePhaseOf(orders);
  empty.basePhase = basePhase;
  for (const o of orders) empty.remainingByPhase[phaseOfOrder(o)] += 1;

  if (evaluated.length === 0 || basePhase == null) return empty;

  const phaseCandidates = evaluated.filter((e) => e.phase === basePhase);

  // Protect deadline-critical candidates first (earliest deadline among criticals).
  const critical = phaseCandidates.filter(isCritical).sort((a, b) => {
    const da = parseHHmm(a.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
    const db = parseHHmm(b.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  });

  let chosen: EvaluatedOrder;
  let reason: string[];
  let deadlineException = false;
  let promotionReason: string | null = null;

  if (critical.length > 0) {
    chosen = critical[0];
    reason = [
      "Deadline protected",
      "Same active priority phase",
      "Earliest constrained deadline",
    ];
  } else {
    const earliest = Math.min(
      ...phaseCandidates.map((e) => parseHHmm(e.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER),
    );
    const comparable = phaseCandidates.filter(
      (e) => (parseHHmm(e.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER) - earliest <= DEADLINE_COMPARABLE_WINDOW_MINUTES,
    );
    chosen = comparable.slice().sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))[0];
    const deadlineDriven = comparable.length === 1 && phaseCandidates.length > 1;
    reason = deadlineDriven
      ? ["Deadline protected", "Same active priority phase", "Earliest deadline in phase"]
      : ["Same active priority phase", "Deadline feasible", "Nearest feasible shop"];
  }

  // Cross-phase deadline exception: a lower-phase order that will be late is
  // promoted (its base phase is preserved, only the planning phase changes).
  const lowerPhaseCritical = evaluated.filter(
    (e) => e.phase !== basePhase && isCritical(e),
  );
  if (!isCritical(chosen) && lowerPhaseCritical.length > 0) {
    const promoted = lowerPhaseCritical.slice().sort((a, b) => {
      const da = parseHHmm(a.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
      const db = parseHHmm(b.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    })[0];
    chosen = promoted;
    deadlineException = true;
    promotionReason = `${PHASE_LABEL[promoted.phase]} order promoted because of deadline risk`;
    reason = [
      "Deadline Exception — lower-priority order is about to miss its deadline",
      `Deadline ${promoted.order.deadlineLabel}`,
      "Promoted ahead of priority phase to minimise deadline violations",
    ];
  }

  const alternatives = phaseCandidates
    .filter((e) => e.order.id !== chosen.order.id)
    .slice()
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, 3)
    .map((e) => toStopPlan(e, state, 0, [], false, null));

  const stop = toStopPlan(chosen, state, 0, reason, deadlineException, promotionReason);

  return {
    stop,
    alternatives,
    basePhase,
    remainingByPhase: empty.remainingByPhase,
    deadlineException,
    exceptionReason: promotionReason,
  };
}

/**
 * Build the full delivery sequence for a vehicle by greedily selecting the next
 * stop and advancing the vehicle's current location after each delivery.
 * Unrouteable orders are returned separately (never lost).
 */
export function buildDeliverySequence(vehicle: RouteVehicle, orders: Order[]): DeliveryPlan {
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  // Partition: routeable vs unrouteable (unrouteable are NEVER dropped).
  const routeable = orders.filter((o) => isRouteable(o, vehicle));
  const unrouteable = orders.filter((o) => !isRouteable(o, vehicle));

  const state: SequencingState = {
    currentGps: vehicle.pickup.gps,
    currentName: vehicle.pickup.farmName,
    currentMinutes: parseHHmm(vehicle.schedule.departureTime),
  };

  const stops: DeliveryStopPlan[] = [];
  const remaining = [...routeable];
  let deadlineConflicts = false;

  while (remaining.length > 0) {
    const result = selectNextDeliveryStop(state, remaining);
    if (!result.stop) break; // defensive: no further feasible stop
    stops.push(result.stop);
    if (result.deadlineException) deadlineConflicts = true;

    const delivered = orderMap.get(result.stop.orderId);
    if (delivered) {
      state.currentGps = delivered.shop.gps;
      state.currentName = delivered.shop.name;
      state.currentMinutes = result.stop.arrivalMinutes ?? state.currentMinutes;
      const idx = remaining.findIndex((o) => o.id === delivered.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  const distances = stops.map((s) => s.legDistanceKm).filter((d): d is number => d != null);
  const travelTimes = stops.map((s) => s.travelMinutes).filter((d): d is number => d != null);
  const totalDistanceKm = distances.length > 0 ? Math.round(distances.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  const estimatedTravelMinutes = travelTimes.length > 0 ? travelTimes.reduce((a, b) => a + b, 0) : null;

  // Attach true cumulative distances (computed sequentially).
  let acc = 0;
  for (const stop of stops) {
    if (stop.legDistanceKm != null) {
      acc += stop.legDistanceKm;
      stop.cumulativeDistanceKm = Math.round(acc * 10) / 10;
    }
  }

  // Any routeable order left unsequenced (defensive) is surfaced as unplanned
  // rather than silently dropped — this preserves the planned + unplanned = total
  // invariant.
  const leftoverUnplanned = remaining.map((o) => ({
    orderId: o.id,
    orderNumber: o.orderNumber,
    shopName: o.shop.name,
    birds: o.birds,
    boxes: o.boxes,
    priority: o.priority,
    basePhase: phaseOfOrder(o),
    reason: "Unable to calculate",
    planningState: "Unroutable" as const,
  }));

  const unplannedOrders = [...unrouteable.map((o) => toUnplannedOrder(o, vehicle)), ...leftoverUnplanned];
  const plannedOrderIds = new Set(stops.map((s) => s.orderId));
  const plannedBirds = orders.filter((o) => plannedOrderIds.has(o.id)).reduce((sum, o) => sum + o.birds, 0);
  const plannedBoxes = orders.filter((o) => plannedOrderIds.has(o.id)).reduce((sum, o) => sum + o.boxes, 0);
  const unplannedBirds = unplannedOrders.reduce((sum, o) => sum + o.birds, 0);
  const unplannedBoxes = unplannedOrders.reduce((sum, o) => sum + o.boxes, 0);

  return {
    vehicleId: vehicle.id,
    vehicleNo: vehicle.vehicleNo,
    pickup: vehicle.pickup,
    schedule: vehicle.schedule,
    stops,
    unplannedOrders,
    totalOrderCount: orders.length,
    totalDistanceKm,
    estimatedTravelMinutes,
    plannedBirds,
    plannedBoxes,
    unplannedBirds,
    unplannedBoxes,
    deadlineConflicts,
    estimatedDistanceSavingKm: computeDistanceSaving(vehicle, routeable, totalDistanceKm),
  };
}

/**
 * Distance-efficiency estimate (requirement #20/#21): compare the sequential
 * route distance against a naive "farm → each shop" baseline. This is a
 * DISTANCE saving, NOT a fuel calculation — no mileage/load/road data exists.
 */
export function computeDistanceSaving(
  vehicle: RouteVehicle,
  orders: Order[],
  sequentialDistanceKm: number | null,
): number | null {
  if (sequentialDistanceKm == null || orders.length < 2) return null;
  if (!isValidCoordinate(vehicle.pickup.gps)) return null;
  let naive = 0;
  let allKnown = true;
  for (const order of orders) {
    const d = haversineKm(vehicle.pickup.gps, order.shop.gps);
    if (d == null) {
      allKnown = false;
      break;
    }
    naive += d;
  }
  if (!allKnown) return null;
  const saving = naive - sequentialDistanceKm;
  return Math.round(saving * 10) / 10;
}

/** Recalculate a delivery plan from an arbitrary current location/time. */
export function recalculateDeliveryPlan(
  vehicle: RouteVehicle,
  remainingOrders: Order[],
  currentGps: GpsCoordinate | null,
  currentName: string,
  currentMinutes: number | null,
): DeliveryPlan {
  return buildDeliverySequence(
    {
      ...vehicle,
      pickup: { ...vehicle.pickup, gps: currentGps, farmName: currentName },
      schedule: { ...vehicle.schedule, departureTime: currentMinutes != null ? formatHHmm(currentMinutes) : vehicle.schedule.departureTime },
    },
    remainingOrders,
  );
}
