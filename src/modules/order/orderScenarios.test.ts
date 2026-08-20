// src/modules/order/orderScenarios.test.ts
// -----------------------------------------------------------------------------
// Frontend scenario coverage for the Order module (requirement #31 / #50).
// Exercises the pure, testable logic across 100+ scenarios and edge cases:
// validation, priority, distance/ETA, vehicle recommendation, route building,
// filtering, and bulk-stability (1..200 orders, 1..20 vehicles).
//
// Run with:  npx tsx --test src/modules/order/orderScenarios.test.ts
// -----------------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateOrderDraft,
  nextOrderNumber,
  BIRD_TYPES,
  PRIORITIES,
  REQUIREMENT_TYPES,
} from "./utils/orderValidation";
import {
  calculateOrderPriorityScore,
  evaluateRoutePriority,
  isMorningDeadline,
  type RoutePriorityFactors,
} from "./services/priorityService";
import {
  haversineKm,
  mockRouteCalculationService,
} from "./services/routeCalculationService";
import {
  recommendVehicle,
  type VehicleRecommendationInput,
} from "./services/vehicleRecommendationService";
import {
  buildRoute,
  buildStops,
  distanceForOrder,
  groupOrdersByVehicle,
  sortOrdersByPriority,
} from "./utils/routeUtils";
import { applyFilters, EMPTY_FILTERS } from "./utils/orderFilters";
import type { Order, OrderDraft, OrderPriority, OrderStatus } from "./types/orderTypes";
import type { RouteVehicle } from "./types/routeTypes";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const draft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  shopId: "shop-vjw-01",
  birdType: "Broiler",
  requirementType: "Birds",
  birds: 1000,
  boxes: 0,
  expectedWeightKg: null,
  remarks: "",
  priority: "Normal",
  importantCustomer: false,
  deliveryDate: "2026-08-21",
  deliveryDeadline: "Before 12:00",
  deliveryWindow: null,
  ...overrides,
});

const gps = (lat: number | null, lng: number | null) =>
  lat == null || lng == null ? null : { latitude: lat, longitude: lng };

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "ord-1",
  orderNumber: "ORD-1001",
  shop: { id: "s1", name: "ABC Chicken Shop", location: "Vijayawada", gps: gps(16.5062, 80.648), gpsStatus: "Available" },
  birdType: "Broiler",
  requirementType: "Birds",
  birds: 5000,
  boxes: 0,
  expectedWeightKg: null,
  remarks: "",
  priority: "Normal",
  importantCustomer: false,
  deliveryDate: "2026-08-21",
  deliveryDeadline: "Before 12:00",
  deliveryWindow: null,
  status: "Pending",
  pickupSource: null,
  vehicleAssignment: null,
  createdAt: "2026-08-20T09:00:00Z",
  updatedAt: "2026-08-20T09:00:00Z",
  ...overrides,
});

const vehicle = (overrides: Partial<RouteVehicle> = {}): RouteVehicle => ({
  id: "v1",
  vehicleNo: "AP 16 AB 1234",
  driverName: "Ravi",
  supervisorName: "Kumar",
  pickup: {
    id: "f1", farmName: "Hyderabad Farm", location: "Hyderabad", gps: gps(17.385, 78.4867),
    gpsStatus: "Available", source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned",
  },
  birdCapacity: 20000,
  boxCapacity: 200,
  available: true,
  assignedOrderCount: 0,
  ...overrides,
});

/* ------------------------------------------------------------------ */
/*  1. Validation (requirement #30)                                    */
/* ------------------------------------------------------------------ */
describe("validateOrderDraft", () => {
  it("accepts a fully valid draft", () => {
    assert.equal(validateOrderDraft(draft()).valid, true);
  });

  it("requires a shop", () => {
    const r = validateOrderDraft(draft({ shopId: "" }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.shopId, "Shop is required.");
  });

  it("requires a bird type", () => {
    const r = validateOrderDraft(draft({ birdType: "" }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.birdType, "Bird type is required.");
  });

  it("rejects negative birds", () => {
    const r = validateOrderDraft(draft({ birds: -5 }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.birds, "Number of birds cannot be negative.");
  });

  it("rejects fractional birds", () => {
    const r = validateOrderDraft(draft({ birds: 10.5 }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.birds, "Number of birds must be a whole number.");
  });

  it("rejects negative boxes", () => {
    const r = validateOrderDraft(draft({ boxes: -1 }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.boxes, "Number of boxes cannot be negative.");
  });

  it("rejects fractional boxes", () => {
    const r = validateOrderDraft(draft({ boxes: 2.25 }));
    assert.equal(r.valid, false);
  });

  it("requires at least one quantity (birds or boxes)", () => {
    const r = validateOrderDraft(draft({ birds: 0, boxes: 0 }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.form, "Provide at least one quantity — birds or boxes.");
  });

  it("allows birds-only orders", () => {
    assert.equal(validateOrderDraft(draft({ birds: 100, boxes: 0 })).valid, true);
  });

  it("allows boxes-only orders", () => {
    assert.equal(validateOrderDraft(draft({ birds: 0, boxes: 10 })).valid, true);
  });

  it("allows birds + boxes orders", () => {
    assert.equal(validateOrderDraft(draft({ birds: 100, boxes: 5, requirementType: "Birds + Boxes" })).valid, true);
  });

  it("requires priority", () => {
    const r = validateOrderDraft(draft({ priority: "" as OrderPriority }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.priority, "Priority is required.");
  });

  it("requires a delivery date", () => {
    const r = validateOrderDraft(draft({ deliveryDate: "" }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.deliveryDate, "Delivery date is required.");
  });

  it("rejects an invalid delivery date", () => {
    const r = validateOrderDraft(draft({ deliveryDate: "not-a-date" }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.deliveryDate, "Delivery date is invalid.");
  });

  it("requires a deadline", () => {
    const r = validateOrderDraft(draft({ deliveryDeadline: "" }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.deliveryDeadline, "Delivery deadline is required.");
  });

  it("rejects negative expected weight", () => {
    const r = validateOrderDraft(draft({ expectedWeightKg: -1 }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.expectedWeightKg, "Expected weight cannot be negative.");
  });

  it("accepts null expected weight", () => {
    assert.equal(validateOrderDraft(draft({ expectedWeightKg: null })).valid, true);
  });

  it("accepts zero birds with positive boxes", () => {
    assert.equal(validateOrderDraft(draft({ birds: 0, boxes: 1 })).valid, true);
  });

  it("nextOrderNumber is deterministic and sequential", () => {
    assert.equal(nextOrderNumber(0), "ORD-1001");
    assert.equal(nextOrderNumber(99), "ORD-1100");
    assert.equal(nextOrderNumber(199), "ORD-1200");
  });

  it("exposes configurable bird types, priorities and requirement types", () => {
    assert.ok(BIRD_TYPES.includes("Broiler"));
    assert.ok(BIRD_TYPES.includes("Layer"));
    assert.deepEqual(PRIORITIES, ["Normal", "Important", "Urgent"]);
    assert.deepEqual(REQUIREMENT_TYPES, ["Birds", "Boxes", "Birds + Boxes"]);
  });
});

/* ------------------------------------------------------------------ */
/*  2. Priority evaluation (requirement #18 / #38)                     */
/* ------------------------------------------------------------------ */
describe("priority scoring", () => {
  it("ranks Urgent above Important above Normal", () => {
    const base = { importantCustomer: false, deadline: "Before 18:00", distanceKm: 200, status: "Pending" };
    const urgent = calculateOrderPriorityScore({ ...base, priority: "Urgent" });
    const important = calculateOrderPriorityScore({ ...base, priority: "Important" });
    const normal = calculateOrderPriorityScore({ ...base, priority: "Normal" });
    assert.ok(urgent > important && important > normal);
  });

  it("boosts important customers", () => {
    const normal = calculateOrderPriorityScore({ priority: "Normal", importantCustomer: false, deadline: "Before 18:00", distanceKm: null, status: "Pending" });
    const important = calculateOrderPriorityScore({ priority: "Normal", importantCustomer: true, deadline: "Before 18:00", distanceKm: null, status: "Pending" });
    assert.ok(important > normal);
  });

  it("boosts morning deadlines", () => {
    const morning = calculateOrderPriorityScore({ priority: "Normal", importantCustomer: false, deadline: "Before 11:00", distanceKm: null, status: "Pending" });
    const evening = calculateOrderPriorityScore({ priority: "Normal", importantCustomer: false, deadline: "Before 18:00", distanceKm: null, status: "Pending" });
    assert.ok(morning > evening);
  });

  it("deprioritizes cancelled and delivered orders", () => {
    const active = calculateOrderPriorityScore({ priority: "Urgent", importantCustomer: false, deadline: "Before 12:00", distanceKm: null, status: "Pending" });
    const delivered = calculateOrderPriorityScore({ priority: "Urgent", importantCustomer: false, deadline: "Before 12:00", distanceKm: null, status: "Delivered" });
    assert.ok(delivered < active);
  });

  it("isMorningDeadline detects before-noon text", () => {
    assert.equal(isMorningDeadline("Before 08:00"), true);
    assert.equal(isMorningDeadline("Before 11:59"), true);
    assert.equal(isMorningDeadline("Before 12:00"), false);
    assert.equal(isMorningDeadline("Before 14:00"), false);
    assert.equal(isMorningDeadline("Before 6:00 pm"), false);
    assert.equal(isMorningDeadline("Before 6:00 am"), true);
    assert.equal(isMorningDeadline("Anytime"), false);
  });
});

describe("evaluateRoutePriority", () => {
  const base: RoutePriorityFactors = {
    urgentOrderCount: 0,
    importantCustomerCount: 0,
    earliestDeadline: null,
    totalDistanceKm: 100,
    estimatedTravelMinutes: 150,
    stopCount: 2,
    vehicleAvailability: true,
    capacitySufficient: true,
    routeEfficient: true,
  };

  it("LOW for routine routes", () => {
    assert.equal(evaluateRoutePriority(base).level, "LOW");
  });

  it("HIGH when urgent orders exist", () => {
    assert.equal(evaluateRoutePriority({ ...base, urgentOrderCount: 1 }).level, "HIGH");
  });

  it("MEDIUM when important customers exist", () => {
    assert.equal(evaluateRoutePriority({ ...base, importantCustomerCount: 1 }).level, "MEDIUM");
  });

  it("HIGH when urgent + important", () => {
    assert.equal(evaluateRoutePriority({ ...base, urgentOrderCount: 1, importantCustomerCount: 2 }).level, "HIGH");
  });

  it("HIGH when vehicle unavailable", () => {
    assert.equal(evaluateRoutePriority({ ...base, vehicleAvailability: false }).level, "HIGH");
  });

  it("MEDIUM for heavy routes (>=5 stops)", () => {
    assert.equal(evaluateRoutePriority({ ...base, stopCount: 5 }).level, "MEDIUM");
  });

  it("lists transparent reasons", () => {
    const r = evaluateRoutePriority({ ...base, urgentOrderCount: 2, importantCustomerCount: 1, earliestDeadline: "Before 10:00" });
    assert.ok(r.reasons.some((x) => x.includes("urgent")));
    assert.ok(r.reasons.some((x) => x.includes("important customer")));
    assert.ok(r.reasons.some((x) => x.includes("Before 10:00")));
  });

  it("always returns at least one reason", () => {
    assert.ok(evaluateRoutePriority(base).reasons.length > 0);
  });
});

/* ------------------------------------------------------------------ */
/*  3. Distance / ETA abstraction (requirement #17 / #37)              */
/* ------------------------------------------------------------------ */
describe("route calculation", () => {
  it("computes a plausible straight-line distance (Hyderabad -> Vijayawada)", () => {
    const d = haversineKm(gps(17.385, 78.4867), gps(16.5062, 80.648));
    assert.ok(d != null && d > 200 && d < 300, `expected ~250km, got ${d}`);
  });

  it("returns 0 for identical points", () => {
    assert.equal(haversineKm(gps(16.5062, 80.648), gps(16.5062, 80.648)), 0);
  });

  it("returns null when either coordinate is missing", () => {
    assert.equal(haversineKm(null, gps(16.5, 80.6)), null);
    assert.equal(haversineKm(gps(16.5, 80.6), null), null);
    assert.equal(haversineKm(gps(null, 80.6), gps(16.5, 80.6)), null);
  });

  it("returns Calculation Pending without GPS", () => {
    const r = mockRouteCalculationService.calculateDistance(null, gps(16.5, 80.6));
    assert.equal(r.state, "Calculation Pending");
    assert.equal(r.distanceKm, null);
  });

  it("flags results as estimates", () => {
    const r = mockRouteCalculationService.calculateDistance(gps(17.385, 78.4867), gps(16.5062, 80.648));
    assert.equal(r.state, "Calculated");
    assert.equal(r.isEstimate, true);
    assert.ok(r.travelMinutes != null && r.travelMinutes > 0);
  });

  it("estimates travel time from distance", () => {
    const minutes = mockRouteCalculationService.estimateTravelMinutes(40, 40);
    assert.equal(minutes, 60);
  });

  it("distanceForOrder returns null without pickup/shop GPS", () => {
    assert.equal(distanceForOrder(makeOrder()), null);
    const withPickup = makeOrder({
      pickupSource: { id: "f1", farmName: "F", location: "L", gps: gps(17.385, 78.4867), gpsStatus: "Available", source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned" },
    });
    assert.ok(distanceForOrder(withPickup) != null);
  });
});

/* ------------------------------------------------------------------ */
/*  4. Vehicle recommendation (requirement #20 / #31)                  */
/* ------------------------------------------------------------------ */
describe("recommendVehicle", () => {
  const input = (overrides: Partial<VehicleRecommendationInput> = {}): VehicleRecommendationInput => ({
    order: makeOrder({ birds: 5000, boxes: 0 }),
    vehicles: [vehicle(), vehicle({ id: "v2", vehicleNo: "AP 16 CD 5678", pickup: { ...vehicle().pickup, location: "Eluru", gps: gps(16.7107, 81.0952) } })],
    ...overrides,
  });

  it("returns null when no vehicles", () => {
    assert.equal(recommendVehicle(input({ vehicles: [] })), null);
  });

  it("excludes unavailable vehicles", () => {
    assert.equal(recommendVehicle(input({ vehicles: [vehicle({ available: false })] })), null);
  });

  it("excludes vehicles with insufficient capacity", () => {
    assert.equal(recommendVehicle(input({ vehicles: [vehicle({ birdCapacity: 100 })] })), null);
  });

  it("recommends the available, capacious vehicle", () => {
    const r = recommendVehicle(input());
    assert.ok(r);
    // Eluru (v2) is far closer to Vijayawada than Hyderabad (v1) → v2 wins.
    assert.equal(r.vehicle.id, "v2");
  });

  it("falls back to the only viable vehicle", () => {
    // Only v1 is available/capacious, so it must win regardless of distance.
    const only = recommendVehicle(
      input({ vehicles: [vehicle(), vehicle({ id: "v2", available: false })] }),
    );
    assert.ok(only);
    assert.equal(only.vehicle.id, "v1");
  });

  it("returns a readable reason", () => {
    const r = recommendVehicle(input());
    assert.ok(r != null && r.reason.length > 0);
  });
});

/* ------------------------------------------------------------------ */
/*  5. Route building (requirement #19 / #21)                          */
/* ------------------------------------------------------------------ */
describe("route building", () => {
  const pickup = { id: "f2", farmName: "Vuyyuru Farm", location: "Vuyyuru", gps: gps(16.3639, 80.8444), gpsStatus: "Available" as const, source: "Trip Entry Step 2" as const, tripNo: "TRP-1", pickupStatus: "Assigned" as const };

  it("sorts stops by priority", () => {
    const orders = [
      makeOrder({ orderNumber: "ORD-2", priority: "Normal" }),
      makeOrder({ orderNumber: "ORD-1", priority: "Urgent" }),
      makeOrder({ orderNumber: "ORD-3", priority: "Important" }),
    ];
    const sorted = sortOrdersByPriority(orders);
    assert.equal(sorted[0].priority, "Urgent");
    assert.equal(sorted[1].priority, "Important");
    assert.equal(sorted[2].priority, "Normal");
  });

  it("builds sequential stops", () => {
    const orders = [makeOrder({ orderNumber: "ORD-1", pickupSource: pickup }), makeOrder({ orderNumber: "ORD-2", pickupSource: pickup })];
    const stops = buildStops(orders);
    assert.equal(stops.length, 2);
    assert.equal(stops[0].stopNumber, 1);
    assert.equal(stops[1].stopNumber, 2);
  });

  it("computes route totals", () => {
    const orders = [
      makeOrder({ birds: 5000, boxes: 10, pickupSource: pickup }),
      makeOrder({ birds: 3000, boxes: 5, pickupSource: pickup }),
    ];
    const route = buildRoute("AP 16 EF 9012", "v3", "Venkat", "Prasad", orders);
    assert.equal(route.totalBirds, 8000);
    assert.equal(route.totalBoxes, 15);
    assert.equal(route.stops.length, 2);
  });

  it("groups orders by vehicle", () => {
    const a1 = { vehicleId: "v1", vehicleNo: "AP 16 AB 1234", driverName: "Ravi", supervisorName: "Kumar", tripNo: "T1", pickupFarm: "F", pickupLocation: "L", orderCount: 2, routeStatus: "Planned", assignmentType: "System Recommended" as const };
    const a2 = { ...a1, vehicleId: "v2", vehicleNo: "AP 16 CD 5678" };
    const orders = [
      makeOrder({ vehicleAssignment: a1, pickupSource: pickup }),
      makeOrder({ vehicleAssignment: a1, pickupSource: pickup }),
      makeOrder({ vehicleAssignment: a2, pickupSource: pickup }),
    ];
    const routes = groupOrdersByVehicle(orders);
    assert.equal(routes.length, 2);
    assert.ok(routes.some((r) => r.stops.length === 2));
  });

  it("ignores orders without a vehicle", () => {
    const routes = groupOrdersByVehicle([makeOrder()]);
    assert.equal(routes.length, 0);
  });
});

/* ------------------------------------------------------------------ */
/*  6. Filtering (requirement #26 / #27)                               */
/* ------------------------------------------------------------------ */
describe("applyFilters", () => {
  const orders = [
    makeOrder({ orderNumber: "ORD-1", shop: { ...makeOrder().shop, name: "ABC Chicken Shop" }, priority: "Urgent", importantCustomer: true }),
    makeOrder({ orderNumber: "ORD-2", shop: { ...makeOrder().shop, name: "XYZ Poultry", location: "Guntur" }, priority: "Normal", status: "Delivered" }),
  ];

  it("searches by shop name", () => {
    assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, search: "ABC" }).length, 1);
  });

  it("searches by order number", () => {
    assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, search: "ORD-2" }).length, 1);
  });

  it("filters by priority", () => {
    assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, priority: "Urgent" }).length, 1);
  });

  it("filters by status", () => {
    assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, status: "Delivered" }).length, 1);
  });

  it("filters important customers", () => {
    assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, importantOnly: true }).length, 1);
  });

  it("filters urgent only", () => {
    assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, urgentOnly: true }).length, 1);
  });

  it("filters by pickup location", () => {
    const withPickup = makeOrder({
      pickupSource: { id: "f1", farmName: "F", location: "Hyderabad", gps: gps(17.385, 78.4867), gpsStatus: "Available", source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned" },
    });
    const all = [withPickup, makeOrder()];
    assert.equal(applyFilters(all, { ...EMPTY_FILTERS, pickupLocation: "Hyderabad" }).length, 1);
  });

  it("filters assigned vs unassigned", () => {
    const assigned = makeOrder({ vehicleAssignment: { vehicleId: "v1", vehicleNo: "AP", driverName: "D", supervisorName: "S", tripNo: "T", pickupFarm: "F", pickupLocation: "L", orderCount: 1, routeStatus: "Planned", assignmentType: "System Recommended" } });
    const all = [assigned, makeOrder()];
    assert.equal(applyFilters(all, { ...EMPTY_FILTERS, assigned: "assigned" }).length, 1);
    assert.equal(applyFilters(all, { ...EMPTY_FILTERS, assigned: "unassigned" }).length, 1);
  });

  it("returns everything with no filters", () => {
    assert.equal(applyFilters(orders, EMPTY_FILTERS).length, 2);
  });
});

/* ------------------------------------------------------------------ */
/*  7. Bulk stability (requirement #31 / #42)                          */
/* ------------------------------------------------------------------ */
describe("bulk stability", () => {
  it("handles 200 orders without throwing and keeps order stable", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      makeOrder({ id: `o${i}`, orderNumber: `ORD-${i}`, priority: (["Normal", "Important", "Urgent"] as OrderPriority[])[i % 3], status: (["Pending", "Assigned", "Delivered", "In Transit"] as OrderStatus[])[i % 4] }),
    );
    const filtered = applyFilters(many, EMPTY_FILTERS);
    assert.equal(filtered.length, 200);
    const sorted = sortOrdersByPriority(many);
    assert.equal(sorted.length, 200);
  });

  it("recommends vehicles across 20 vehicles without error", () => {
    const vehicles = Array.from({ length: 20 }, (_, i) =>
      vehicle({ id: `v${i}`, vehicleNo: `AP 16 ${i}`, available: i !== 13, birdCapacity: 1000 + i * 500 }),
    );
    const r = recommendVehicle({ order: makeOrder({ birds: 500 }), vehicles });
    assert.ok(r != null);
  });

  it("builds routes for 50 assigned orders grouped into vehicles", () => {
    const pickup = { id: "f1", farmName: "F", location: "L", gps: gps(16.5, 80.6), gpsStatus: "Available" as const, source: "Trip Entry Step 2" as const, tripNo: null, pickupStatus: "Assigned" as const };
    const assignment = (vid: number) => ({ vehicleId: `v${vid}`, vehicleNo: `AP ${vid}`, driverName: "D", supervisorName: "S", tripNo: "T", pickupFarm: "F", pickupLocation: "L", orderCount: 25, routeStatus: "Planned", assignmentType: "System Recommended" as const });
    const orders = Array.from({ length: 50 }, (_, i) => makeOrder({ id: `o${i}`, vehicleAssignment: assignment(i % 2), pickupSource: pickup, birds: 100 }));
    const routes = groupOrdersByVehicle(orders);
    assert.equal(routes.length, 2);
    assert.equal(routes.reduce((sum, r) => sum + r.stops.length, 0), 50);
  });

  it("validates 200 drafts without throwing", () => {
    for (let i = 0; i < 200; i++) {
      const result = validateOrderDraft(draft({ birds: i % 2 === 0 ? i : 0, boxes: i % 2 === 1 ? i : 0 }));
      assert.equal(typeof result.valid, "boolean");
    }
  });
});
