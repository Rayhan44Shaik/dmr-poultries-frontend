// src/modules/order/utils/routeUtils.ts
// -----------------------------------------------------------------------------
// Pure helpers for building and summarizing delivery routes.
//
// Routes are built via the delivery-phase sequencer (see
// services/deliverySequencingService.ts), producing SEQUENTIAL LEGS
// (pickup → A → B → C), never a sum of pickup→each-shop distances. The vehicle's
// current location advances after every stop, and arrival/buffer values are
// derived from the departure time plus cumulative leg travel time.
//
// Unrouteable orders are surfaced as `unplannedOrders`; totals are based on the
// SAME dataset (planned + unplanned = total), never silently dropping orders.
// -----------------------------------------------------------------------------

import type { Order, PickupSource } from "../types/orderTypes";
import type { DeliveryRoute, RouteLeg, RouteStatus, RouteStop, RouteVehicle } from "../types/routeTypes";
import { compareOrdersByDeadlineThenPriority, evaluateRoutePriority } from "../services/priorityService";
import { computeLeg } from "../services/routeCalculationService";
import { buildDeliverySequence } from "../services/deliverySequencingService";
import { formatAddressShort } from "./orderFormat";

/** Straight-line (estimated) distance from an order's pickup farm to its shop. */
export function distanceForOrder(order: Order): number | null {
  if (!order.pickupSource?.gps || !order.shop.gps) return null;
  return computeLeg({
    legNumber: 1,
    fromName: order.pickupSource.farmName,
    fromGps: order.pickupSource.gps,
    toName: order.shop.name,
    toAddress: formatAddressShort(order.shop.address),
    toGps: order.shop.gps,
    departureMinutes: null,
  }).distanceKm;
}

/** Sort orders for sequencing (backward-compatible): earliest deadline, then priority. */
export function sortOrdersForRoute(orders: Order[]): Order[] {
  return [...orders].sort(compareOrdersByDeadlineThenPriority);
}

/** Derive a route status from planned/unplanned/at-risk/conflict signals. */
export function computeRouteStatus(
  plannedCount: number,
  unplannedCount: number,
  hasDeadlineConflict: boolean,
  atRiskCount: number,
): RouteStatus {
  if (plannedCount === 0 && unplannedCount > 0) return "Blocked";
  if (unplannedCount > 0) return "Partially Planned";
  if (hasDeadlineConflict) return "Conflict";
  if (atRiskCount > 0) return "At Risk";
  return "Planned";
}

/**
 * Build ordered route stops and sequential legs for a group of orders sharing a
 * pickup farm and a vehicle schedule, using the delivery-phase sequencer.
 */
export function buildRoute(vehicle: RouteVehicle, orders: Order[]): DeliveryRoute {
  const plan = buildDeliverySequence(vehicle, orders);
  const pickup = orders[0]?.pickupSource ?? vehicle.pickup;
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const legs: RouteLeg[] = [];
  const stops: RouteStop[] = [];

  plan.stops.forEach((stop, index) => {
    const order = orderById.get(stop.orderId);
    const destinationGps = order?.shop.gps ?? null;

    legs.push({
      legNumber: index + 1,
      fromName: stop.fromName,
      fromGps: stop.fromGps,
      toName: stop.shopName,
      toAddress: stop.address,
      toGps: destinationGps,
      distanceKm: stop.legDistanceKm,
      travelMinutes: stop.travelMinutes,
      departureTime: stop.departureTime,
      arrivalTime: stop.arrivalTime,
      calculationState: stop.legDistanceKm != null ? "Estimated" : "Unavailable",
      isEstimate: stop.legDistanceKm != null,
      serviceMinutes: stop.serviceMinutes,
    });

    stops.push({
      stopNumber: index + 1,
      orderId: stop.orderId,
      orderNumber: stop.orderNumber,
      shopName: stop.shopName,
      address: stop.address,
      birds: order?.birds ?? 0,
      boxes: order?.boxes ?? 0,
      priority: stop.priority,
      importantCustomer: stop.importantCustomer,
      deadlineLabel: stop.deadlineLabel,
      deadlineTime: stop.deadlineTime,
      basePhase: stop.basePhase,
      effectivePlanningPhase: stop.effectivePlanningPhase,
      deadlineException: stop.deadlineException,
      promotionReason: stop.promotionReason,
      fromName: stop.fromName,
      legDistanceKm: stop.legDistanceKm,
      cumulativeDistanceKm: stop.cumulativeDistanceKm,
      legTravelMinutes: stop.travelMinutes,
      arrivalTime: stop.arrivalTime,
      etaLabel: stop.arrivalTime,
      bufferMinutes: stop.bufferMinutes,
      bufferState: stop.bufferState,
      deadlineFeasible: stop.deadlineFeasible,
      planningState: stop.planningState,
      reason: stop.reason,
      serviceMinutes: stop.serviceMinutes,
      status: order?.status ?? "Pending",
    });
  });

  const distances = legs.map((l) => l.distanceKm).filter((d): d is number => d != null);
  const travelTimes = legs.map((l) => l.travelMinutes).filter((d): d is number => d != null);

  const totalDistanceKm =
    plan.totalDistanceKm ?? (distances.length > 0 ? Math.round(distances.reduce((sum, d) => sum + d, 0) * 10) / 10 : null);
  const estimatedTravelMinutes =
    plan.estimatedTravelMinutes ?? (travelTimes.length > 0 ? travelTimes.reduce((sum, d) => sum + d, 0) : null);

  const urgentCount = orders.filter((o) => o.priority === "Urgent").length;
  const importantCount = orders.filter((o) => o.importantCustomer).length;
  const minBuffer = stops.length > 0 ? Math.min(...stops.map((s) => s.bufferMinutes ?? Infinity)) : null;
  const safeMinBuffer = minBuffer === Infinity ? null : minBuffer;
  const atRiskCount = stops.filter((s) => s.deadlineFeasible === "Cannot Meet" || s.deadlineFeasible === "At Risk").length;

  const priority = evaluateRoutePriority({
    urgentOrderCount: urgentCount,
    importantCustomerCount: importantCount,
    earliestDeadlineLabel: plan.stops[0]?.deadlineLabel ?? null,
    minBufferMinutes: safeMinBuffer,
    hasLateStop: stops.some((s) => s.deadlineFeasible === "Cannot Meet"),
    hasAtRiskStop: stops.some((s) => s.deadlineFeasible === "At Risk"),
    totalTravelMinutes: estimatedTravelMinutes,
    stopCount: stops.length,
    vehicleAvailability: vehicle.available,
    capacitySufficient:
      orders.reduce((sum, o) => sum + o.birds, 0) <= vehicle.birdCapacity &&
      orders.reduce((sum, o) => sum + o.boxes, 0) <= vehicle.boxCapacity,
  });

  const totalBirds = orders.reduce((sum, o) => sum + o.birds, 0);
  const totalBoxes = orders.reduce((sum, o) => sum + o.boxes, 0);

  return {
    id: `route-${vehicle.id}`,
    vehicleId: vehicle.id,
    vehicleNo: vehicle.vehicleNo,
    driverName: vehicle.driverName,
    supervisorName: vehicle.supervisorName,
    pickup,
    schedule: vehicle.schedule,
    legs,
    stops,
    unplannedOrders: plan.unplannedOrders,
    totalOrderCount: plan.totalOrderCount,
    totalDistanceKm,
    estimatedTravelMinutes,
    plannedBirds: plan.plannedBirds,
    unplannedBirds: plan.unplannedBirds,
    plannedBoxes: plan.plannedBoxes,
    unplannedBoxes: plan.unplannedBoxes,
    totalBirds,
    totalBoxes,
    routeStatus: computeRouteStatus(stops.length, plan.unplannedOrders.length, plan.deadlineConflicts, atRiskCount),
    routePriority: priority.level,
    priorityReasons: priority.reasons,
    calculationState: legs.some((l) => l.calculationState === "Estimated") ? "Estimated" : "Pending",
    deadlineConflicts: plan.deadlineConflicts,
    atRiskCount,
  };
}

/** Group orders by assigned vehicle and turn each group into a route. */
export function groupOrdersByVehicle(orders: Order[], vehicles: RouteVehicle[]): DeliveryRoute[] {
  const byVehicle = new Map<string, Order[]>();
  for (const order of orders) {
    const vehicle = order.vehicleAssignment;
    if (!vehicle) continue;
    const list = byVehicle.get(vehicle.vehicleId) ?? [];
    list.push(order);
    byVehicle.set(vehicle.vehicleId, list);
  }

  const routes: DeliveryRoute[] = [];
  for (const [vehicleId, list] of byVehicle.entries()) {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) continue;
    routes.push(buildRoute(vehicle, list));
  }

  // Higher priority routes first, then by vehicle number for stability.
  return routes.sort((a, b) => {
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const delta = (rank[a.routePriority] ?? 3) - (rank[b.routePriority] ?? 3);
    if (delta !== 0) return delta;
    return a.vehicleNo.localeCompare(b.vehicleNo);
  });
}

export type { PickupSource };
