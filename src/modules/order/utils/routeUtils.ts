// src/modules/order/utils/routeUtils.ts
// -----------------------------------------------------------------------------
// Pure helpers for building and summarizing delivery routes.
// -----------------------------------------------------------------------------

import type { Order } from "../types/orderTypes";
import type { DeliveryRoute, RouteStop } from "../types/routeTypes";
import { mockRouteCalculationService } from "../services/routeCalculationService";
import { calculateOrderPriorityScore, evaluateRoutePriority } from "../services/priorityService";

/** Sort orders by deterministic priority score, then by order number. */
export function sortOrdersByPriority(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const scoreA = calculateOrderPriorityScore({
      priority: a.priority,
      importantCustomer: a.importantCustomer,
      deadline: a.deliveryDeadline,
      distanceKm: distanceForOrder(a),
      status: a.status,
    });
    const scoreB = calculateOrderPriorityScore({
      priority: b.priority,
      importantCustomer: b.importantCustomer,
      deadline: b.deliveryDeadline,
      distanceKm: distanceForOrder(b),
      status: b.status,
    });
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.orderNumber.localeCompare(b.orderNumber);
  });
}

/** Straight-line (estimated) distance from an order's pickup farm to its shop. */
export function distanceForOrder(order: Order): number | null {
  if (!order.pickupSource?.gps || !order.shop.gps) return null;
  return mockRouteCalculationService.calculateDistance(order.pickupSource.gps, order.shop.gps).distanceKm;
}

/**
 * Build ordered route stops for a group of orders that share a pickup farm.
 * Stop distances are cumulative straight-line estimates from the pickup point.
 */
export function buildStops(orders: Order[]): RouteStop[] {
  const sorted = sortOrdersByPriority(orders);
  return sorted.map((order, index) => {
    const leg = distanceForOrder(order);
    return {
      stopNumber: index + 1,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      birds: order.birds,
      boxes: order.boxes,
      priority: order.priority,
      importantCustomer: order.importantCustomer,
      deadline: order.deliveryDeadline,
      legDistanceKm: leg,
      cumulativeDistanceKm: leg,
      eta: null,
      status: order.status,
    };
  });
}

/** Aggregate a delivery route for a vehicle from its assigned orders. */
export function buildRoute(
  vehicleNo: string,
  vehicleId: string,
  driverName: string,
  supervisorName: string,
  orders: Order[],
): DeliveryRoute {
  const pickup = orders[0]?.pickupSource;
  const stops = buildStops(orders);

  const distances = stops
    .map((s) => s.cumulativeDistanceKm)
    .filter((d): d is number => d != null);

  const totalDistanceKm = distances.length > 0 ? Math.round(distances.reduce((sum, d) => sum + d, 0) * 10) / 10 : null;
  const estimatedTravelMinutes =
    totalDistanceKm != null ? mockRouteCalculationService.estimateTravelMinutes(totalDistanceKm) : null;

  const urgentCount = orders.filter((o) => o.priority === "Urgent").length;
  const importantCount = orders.filter((o) => o.importantCustomer).length;
  const earliestDeadline = earliestDeadlineOf(orders);

  const priority = evaluateRoutePriority({
    urgentOrderCount: urgentCount,
    importantCustomerCount: importantCount,
    earliestDeadline,
    totalDistanceKm,
    estimatedTravelMinutes,
    stopCount: stops.length,
    vehicleAvailability: true,
    capacitySufficient: true,
    routeEfficient: totalDistanceKm != null && totalDistanceKm <= 150,
  });

  return {
    id: `route-${vehicleId}`,
    vehicleId,
    vehicleNo,
    driverName,
    supervisorName,
    pickup: pickup ?? nullPickup(),
    stops,
    totalDistanceKm,
    estimatedTravelMinutes,
    totalBirds: orders.reduce((sum, o) => sum + o.birds, 0),
    totalBoxes: orders.reduce((sum, o) => sum + o.boxes, 0),
    routeStatus: stops.length > 0 ? "Planned" : "Ready",
    routePriority: priority.level,
    priorityReasons: priority.reasons,
  };
}

function nullPickup() {
  return {
    id: "none",
    farmName: "Not assigned",
    location: "—",
    gps: null,
    gpsStatus: "Not Available" as const,
    source: "Trip Entry Step 2" as const,
    tripNo: null,
    pickupStatus: "Not Assigned" as const,
  };
}

function earliestDeadlineOf(orders: Order[]): string | null {
  const order = [...orders].sort(
    (a, b) =>
      calculateOrderPriorityScore({
        priority: a.priority,
        importantCustomer: a.importantCustomer,
        deadline: a.deliveryDeadline,
        distanceKm: null,
        status: a.status,
      }) -
      calculateOrderPriorityScore({
        priority: b.priority,
        importantCustomer: b.importantCustomer,
        deadline: b.deliveryDeadline,
        distanceKm: null,
        status: b.status,
      }),
  );
  // Prefer the highest-ranked order's deadline as the binding one.
  return order[0]?.deliveryDeadline ?? null;
}

/** Group orders by assigned vehicle and turn each group into a route. */
export function groupOrdersByVehicle(orders: Order[]): DeliveryRoute[] {
  const byVehicle = new Map<string, Order[]>();
  for (const order of orders) {
    const vehicle = order.vehicleAssignment;
    if (!vehicle) continue;
    const key = vehicle.vehicleId;
    const list = byVehicle.get(key) ?? [];
    list.push(order);
    byVehicle.set(key, list);
  }

  const routes: DeliveryRoute[] = [];
  for (const [vehicleId, list] of byVehicle.entries()) {
    const first = list[0];
    const assignment = first.vehicleAssignment;
    if (!assignment) continue;
    routes.push(
      buildRoute(assignment.vehicleNo, vehicleId, assignment.driverName, assignment.supervisorName, list),
    );
  }
  // Higher priority routes first.
  return routes.sort((a, b) => {
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (rank[a.routePriority] ?? 3) - (rank[b.routePriority] ?? 3);
  });
}
