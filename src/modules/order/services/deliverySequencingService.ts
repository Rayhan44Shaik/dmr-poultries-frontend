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
// Within the active priority phase, candidates are ranked by deadline first and
// distance second — but a "comparable" deadline window lets distance win when
// deadlines are effectively equal (fuel/distance reduction). A lower-phase
// order whose deadline is about to be missed is *promoted* and surfaced as a
// DEADLINE CONFLICT rather than silently hidden.
// -----------------------------------------------------------------------------

import type { GpsCoordinate, Order, PickupSource } from "../types/orderTypes";
import type {
  BufferState,
  DeadlineFeasibility,
  DeliveryPhase,
  DeliveryPhaseNumber,
  RouteVehicle,
  VehicleSchedule,
} from "../types/routeTypes";
import { classifyBuffer, classifyFeasibility } from "../utils/feasibility";
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

/** The active phase = highest-priority phase present among the given orders. */
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

/** A single planned delivery stop with full sequencing rationale. */
export interface DeliveryStopPlan {
  orderId: string;
  orderNumber: string;
  shopName: string;
  address: string;
  priority: Order["priority"];
  importantCustomer: boolean;
  phase: DeliveryPhase;
  phaseNumber: DeliveryPhaseNumber;
  fromName: string;
  fromGps: GpsCoordinate | null;
  legDistanceKm: number | null;
  cumulativeDistanceKm: number | null;
  travelMinutes: number | null;
  departureTime: string | null;
  arrivalTime: string | null;
  /** Arrival time in minutes-since-midnight (for internal recalculation). */
  arrivalMinutes: number | null;
  deadlineLabel: string;
  deadlineTime: string;
  bufferMinutes: number | null;
  bufferState: BufferState;
  deadlineFeasible: DeadlineFeasibility;
  /** Why this stop was selected next. */
  reason: string[];
  /** True when promoted across phases to protect a deadline. */
  deadlineConflict: boolean;
}

export interface NextStopResult {
  stop: DeliveryStopPlan | null;
  /** Ranked alternatives (excludes the chosen stop) for the comparison UI. */
  alternatives: DeliveryStopPlan[];
  activePhase: DeliveryPhase | null;
  /** Remaining order count per phase (after this stop is chosen). */
  remainingByPhase: Record<DeliveryPhase, number>;
  deadlineConflict: boolean;
  conflictReason: string | null;
}

export interface DeliveryPlan {
  vehicleId: string;
  vehicleNo: string;
  pickup: PickupSource;
  schedule: VehicleSchedule;
  stops: DeliveryStopPlan[];
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  totalBirds: number;
  totalBoxes: number;
  deadlineConflicts: boolean;
  /** Distance (km) saved by the chosen sequence vs a naive nearest-first plan. */
  estimatedDistanceSavingKm: number | null;
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

function toStopPlan(evaluated: EvaluatedOrder, state: SequencingState, cumulativeDistanceKm: number, deadlineConflict: boolean, reason: string[]): DeliveryStopPlan {
  const o = evaluated.order;
  return {
    orderId: o.id,
    orderNumber: o.orderNumber,
    shopName: o.shop.name,
    address: o.shop.address ? `${o.shop.address.city}` : o.shop.location,
    priority: o.priority,
    importantCustomer: o.importantCustomer,
    phase: evaluated.phase,
    phaseNumber: PHASE_NUMBER[evaluated.phase],
    fromName: state.currentName,
    fromGps: state.currentGps,
    legDistanceKm: evaluated.distanceKm,
    cumulativeDistanceKm: evaluated.distanceKm != null ? Math.round((cumulativeDistanceKm + evaluated.distanceKm) * 10) / 10 : cumulativeDistanceKm || null,
    travelMinutes: evaluated.travelMinutes,
    departureTime: state.currentMinutes != null ? formatClock(state.currentMinutes) : null,
    arrivalTime: evaluated.arrivalMinutes != null ? formatClock(evaluated.arrivalMinutes) : null,
    arrivalMinutes: evaluated.arrivalMinutes,
    deadlineLabel: o.deadlineLabel,
    deadlineTime: o.deadlineTime,
    bufferMinutes: evaluated.bufferMinutes,
    bufferState: evaluated.bufferState,
    deadlineFeasible: evaluated.deadlineFeasible,
    reason,
    deadlineConflict,
  };
}

/**
 * Select the next delivery stop from the vehicle's CURRENT position.
 * Returns the chosen stop + ranked alternatives, the active phase, and any
 * cross-phase deadline conflict.
 */
export function selectNextDeliveryStop(
  state: SequencingState,
  orders: Order[],
): NextStopResult {
  const empty: NextStopResult = {
    stop: null,
    alternatives: [],
    activePhase: null,
    remainingByPhase: { Critical: 0, Important: 0, Normal: 0 },
    deadlineConflict: false,
    conflictReason: null,
  };

  const evaluated = orders
    .map((o) => evaluateOrder(o, state))
    .filter((e): e is EvaluatedOrder => e != null);

  if (evaluated.length === 0) {
    // Count remaining by phase even when none are GPS-feasible.
    for (const o of orders) empty.remainingByPhase[phaseOfOrder(o)] += 1;
    return empty;
  }

  const activePhase = activePhaseOf(orders)!;
  empty.activePhase = activePhase;
  for (const o of orders) empty.remainingByPhase[phaseOfOrder(o)] += 1;

  const phaseCandidates = evaluated.filter((e) => e.phase === activePhase);

  // 1. Within the active phase, protect deadline-critical candidates first
  //    (earliest deadline among criticals).
  const critical = phaseCandidates.filter(isCritical).sort((a, b) => {
    const da = parseHHmm(a.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
    const db = parseHHmm(b.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  });

  let chosen: EvaluatedOrder;
  let reason: string[];
  let deadlineConflict = false;

  if (critical.length > 0) {
    chosen = critical[0];
    reason = [
      "Same active priority phase",
      "Earliest constrained deadline",
      `${chosen.distanceKm ?? "—"} km from current vehicle position`,
    ];
  } else {
    // 2. Deadline-first within a comparable window, then nearest feasible.
    const earliest = Math.min(
      ...phaseCandidates.map((e) => parseHHmm(e.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER),
    );
    const comparable = phaseCandidates.filter(
      (e) => (parseHHmm(e.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER) - earliest <= DEADLINE_COMPARABLE_WINDOW_MINUTES,
    );
    chosen = comparable.slice().sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))[0];

    // If the window narrowed to a single candidate (its deadline is meaningfully
    // earlier than the rest), surface the deadline rationale; otherwise this is
    // a nearest-feasible selection.
    const deadlineDriven = comparable.length === 1 && phaseCandidates.length > 1;
    reason = deadlineDriven
      ? [
          "Same active priority phase",
          "Earliest deadline in phase",
          "Deadline feasible",
          `${chosen.distanceKm ?? "—"} km from current vehicle position`,
        ]
      : [
          "Same active priority phase",
          "Deadline feasible",
          "Nearest feasible shop",
          `${chosen.distanceKm ?? "—"} km from current vehicle position`,
        ];
  }

  // 3. Cross-phase deadline override: a lower-phase order that will be late
  //    must not be silently skipped behind a non-critical active-phase stop.
  const lowerPhase = evaluated.filter(
    (e) => e.phase !== activePhase && isCritical(e),
  );
  const chosenIsCritical = isCritical(chosen);
  if (!chosenIsCritical && lowerPhase.length > 0) {
    const promoted = lowerPhase.slice().sort((a, b) => {
      const da = parseHHmm(a.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
      const db = parseHHmm(b.order.deadlineTime) ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    })[0];
    chosen = promoted;
    deadlineConflict = true;
    reason = [
      "DEADLINE CONFLICT — lower-priority order is about to miss its deadline",
      `Deadline ${promoted.order.deadlineLabel}`,
      "Promoted ahead of priority phase to minimise deadline violations",
    ];
  }

  // Build alternatives for comparison (ranked by distance within the phase).
  const alternatives = phaseCandidates
    .filter((e) => e.order.id !== chosen.order.id)
    .slice()
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, 3)
    .map((e) => toStopPlan(e, state, 0, false, []));

  const cumulativeBase = 0;
  const stop = toStopPlan(chosen, state, cumulativeBase, deadlineConflict, reason);

  return {
    stop,
    alternatives,
    activePhase,
    remainingByPhase: empty.remainingByPhase,
    deadlineConflict,
    conflictReason: deadlineConflict
      ? `DEADLINE CONFLICT — ${chosen.order.orderNumber} (${chosen.order.deadlineLabel}) is about to be missed`
      : null,
  };
}

/**
 * Build the full delivery sequence for a vehicle by greedily selecting the next
 * stop and advancing the vehicle's current location after each delivery.
 */
export function buildDeliverySequence(vehicle: RouteVehicle, orders: Order[]): DeliveryPlan {
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const state: SequencingState = {
    currentGps: vehicle.pickup.gps,
    currentName: vehicle.pickup.farmName,
    currentMinutes: parseHHmm(vehicle.schedule.departureTime),
  };

  const stops: DeliveryStopPlan[] = [];
  const remaining = [...orders];
  let deadlineConflicts = false;

  while (remaining.length > 0) {
    const result = selectNextDeliveryStop(state, remaining);
    if (!result.stop) break; // no further feasible stop
    stops.push(result.stop);
    if (result.deadlineConflict) deadlineConflicts = true;

    const delivered = orderMap.get(result.stop.orderId);
    if (delivered) {
      // Advance the vehicle to the delivered shop (recalculation requirement).
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

  const estimatedDistanceSavingKm = computeDistanceSaving(vehicle, orders, totalDistanceKm);

  return {
    vehicleId: vehicle.id,
    vehicleNo: vehicle.vehicleNo,
    pickup: vehicle.pickup,
    schedule: vehicle.schedule,
    stops,
    totalDistanceKm,
    estimatedTravelMinutes,
    totalBirds: orders.reduce((sum, o) => sum + o.birds, 0),
    totalBoxes: orders.reduce((sum, o) => sum + o.boxes, 0),
    deadlineConflicts,
    estimatedDistanceSavingKm,
  };
}

/**
 * Distance-efficiency estimate (requirement #9/#32): compare the sequential
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
  const plan = buildDeliverySequence(
    {
      ...vehicle,
      pickup: {
        ...vehicle.pickup,
        gps: currentGps,
        farmName: currentName,
      },
      schedule: { ...vehicle.schedule, departureTime: currentMinutes != null ? formatHHmm(currentMinutes) : vehicle.schedule.departureTime },
    },
    remainingOrders,
  );
  return plan;
}
