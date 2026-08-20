// src/modules/order/utils/routeUtils.ts
// -----------------------------------------------------------------------------
// Pure helpers for building and summarizing delivery routes.
//
// Routes are built as SEQUENTIAL LEGS (pickup → A → B → C), never as a sum of
// pickup→each-shop distances. Each stop's arrival time and delivery buffer are
// derived from the vehicle's departure time plus cumulative leg travel time.
// -----------------------------------------------------------------------------

import type { Order, PickupSource } from "../types/orderTypes";
import type { DeliveryRoute, RouteStop, RouteVehicle } from "../types/routeTypes";
import { compareOrdersByDeadlineThenPriority, evaluateRoutePriority } from "../services/priorityService";
import { computeLeg } from "../services/routeCalculationService";
import { classifyBuffer, classifyFeasibility } from "./feasibility";
import { formatAddressShort } from "./orderFormat";
import { formatClock, parseHHmm } from "./businessTime";

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

/** Sort orders for sequencing: earliest deadline first, then priority. */
export function sortOrdersForRoute(orders: Order[]): Order[] {
  return [...orders].sort(compareOrdersByDeadlineThenPriority);
}

/**
 * Build ordered route stops and sequential legs for a group of orders that
 * share a pickup farm and a vehicle schedule. Cumulative distances/arrivals are
 * computed leg-by-leg from the pickup point.
 */
export function buildRoute(vehicle: RouteVehicle, orders: Order[]): DeliveryRoute {
  const pickup = orders[0]?.pickupSource ?? vehicle.pickup;
  const sorted = sortOrdersForRoute(orders);
  const departureMinutes = parseHHmm(vehicle.schedule.departureTime);

  const legs: DeliveryRoute["legs"] = [];
  const stops: RouteStop[] = [];

  let previousGps = pickup.gps;
  let previousName = pickup.farmName;
  let cumulativeDistance = 0;
  let cumulativeTravel = 0;

  sorted.forEach((order, index) => {
    const leg = computeLeg({
      legNumber: index + 1,
      fromName: previousName,
      fromGps: previousGps,
      toName: order.shop.name,
      toAddress: formatAddressShort(order.shop.address),
      toGps: order.shop.gps,
      departureMinutes: departureMinutes != null ? departureMinutes + cumulativeTravel : null,
    });

    legs.push(leg);

    if (leg.distanceKm != null) cumulativeDistance += leg.distanceKm;
    if (leg.travelMinutes != null) cumulativeTravel += leg.travelMinutes;

    const arrivalMinutes =
      departureMinutes != null && leg.travelMinutes != null ? departureMinutes + cumulativeTravel : null;
    const deadlineMinutes = parseHHmm(order.deadlineTime);
    const bufferMinutes =
      arrivalMinutes != null && deadlineMinutes != null ? deadlineMinutes - arrivalMinutes : null;

    stops.push({
      stopNumber: index + 1,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      address: formatAddressShort(order.shop.address),
      birds: order.birds,
      boxes: order.boxes,
      priority: order.priority,
      importantCustomer: order.importantCustomer,
      deadlineLabel: order.deadlineLabel,
      deadlineTime: order.deadlineTime,
      legDistanceKm: leg.distanceKm,
      cumulativeDistanceKm: leg.distanceKm != null ? Math.round(cumulativeDistance * 10) / 10 : null,
      legTravelMinutes: leg.travelMinutes,
      arrivalTime: arrivalMinutes != null ? formatClock(arrivalMinutes) : null,
      etaLabel: arrivalMinutes != null ? formatClock(arrivalMinutes) : null,
      bufferMinutes,
      bufferState: classifyBuffer(bufferMinutes),
      deadlineFeasible: classifyFeasibility(bufferMinutes),
      status: order.status,
    });

    previousGps = order.shop.gps;
    previousName = order.shop.name;
  });

  const distances = legs.map((l) => l.distanceKm).filter((d): d is number => d != null);
  const travelTimes = legs.map((l) => l.travelMinutes).filter((d): d is number => d != null);

  const totalDistanceKm =
    distances.length > 0 ? Math.round(distances.reduce((sum, d) => sum + d, 0) * 10) / 10 : null;
  const estimatedTravelMinutes =
    travelTimes.length > 0 ? travelTimes.reduce((sum, d) => sum + d, 0) : null;

  const urgentCount = orders.filter((o) => o.priority === "Urgent").length;
  const importantCount = orders.filter((o) => o.importantCustomer).length;
  const minBuffer = stops.length > 0 ? Math.min(...stops.map((s) => s.bufferMinutes ?? Infinity)) : null;
  const safeMinBuffer = minBuffer === Infinity ? null : minBuffer;

  const priority = evaluateRoutePriority({
    urgentOrderCount: urgentCount,
    importantCustomerCount: importantCount,
    earliestDeadlineLabel: sorted[0]?.deadlineLabel ?? null,
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
    totalDistanceKm,
    estimatedTravelMinutes,
    totalBirds: orders.reduce((sum, o) => sum + o.birds, 0),
    totalBoxes: orders.reduce((sum, o) => sum + o.boxes, 0),
    routeStatus: stops.length > 0 ? "Planned" : "Ready",
    routePriority: priority.level,
    priorityReasons: priority.reasons,
    calculationState: legs.some((l) => l.calculationState === "Estimated") ? "Estimated" : "Pending",
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
