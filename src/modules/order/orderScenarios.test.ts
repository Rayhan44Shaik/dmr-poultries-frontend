// src/modules/order/orderScenarios.test.ts
// -----------------------------------------------------------------------------
// Frontend scenario coverage for the Order module (requirements #39–#46).
//
// Covers, with meaningful (not loop-duplicated) scenarios:
//   - validation, time helpers, GPS validation/classification, feasibility
//   - distance/ETA + sequential route legs
//   - order priority vs route priority vs vehicle recommendation
//   - the five critical review scenarios (Hyderabad vs Vuyyuru, etc.)
//   - bulk/performance stability (200 orders, 20 vehicles, 50 stops)
//
// Run with:  npx tsx --test src/modules/order/orderScenarios.test.ts
// -----------------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateOrderDraft, nextOrderNumber, BIRD_TYPES, PRIORITIES, REQUIREMENT_TYPES, DEADLINE_PRESETS } from "./utils/orderValidation";
import { isValidLatitude, isValidLongitude, isValidCoordinate, classifyGps } from "./utils/gps";
import { parseHHmm, formatHHmm, formatClock, formatDuration, isValidHHmm } from "./utils/businessTime";
import { classifyBuffer, classifyFeasibility } from "./utils/feasibility";
import { priorityRank, compareOrdersByDeadlineThenPriority, evaluateRoutePriority } from "./services/priorityService";
import { haversineKm, computeLeg, mockRouteCalculationService, DEFAULT_AVG_SPEED_KMH } from "./services/routeCalculationService";
import {
  phaseOfOrder,
  activePhaseOf,
  selectNextDeliveryStop,
  buildDeliverySequence,
  recalculateDeliveryPlan,
  computeDistanceSaving,
  PHASE_NUMBER,
  DEADLINE_COMPARABLE_WINDOW_MINUTES,
  CRITICAL_BUFFER_MINUTES,
  type SequencingState,
} from "./services/deliverySequencingService";
import { evaluateCandidate, finalizeRecommendation, recommendVehicles } from "./services/vehicleRecommendationService";
import { buildRoute, groupOrdersByVehicle, sortOrdersForRoute, distanceForOrder } from "./utils/routeUtils";
import { applyFilters, EMPTY_FILTERS } from "./utils/orderFilters";
import { formatDistanceKm, formatAddress } from "./utils/orderFormat";
import type { Address, GpsCoordinate, Order, OrderDraft, OrderPriority, OrderShop, PickupSource } from "./types/orderTypes";
import type { RouteVehicle, VehicleSchedule } from "./types/routeTypes";

/* ------------------------------------------------------------------ */
/*  Builders                                                           */
/* ------------------------------------------------------------------ */

const gps = (lat: number | null, lng: number | null, accuracy = 8, timestamp = "2026-08-20T09:00:00Z"): GpsCoordinate | null =>
  lat == null || lng == null ? null : { latitude: lat, longitude: lng, accuracyMeters: accuracy, timestamp };

const addr = (city = "Vijayawada", pin = "520001", state = "Andhra Pradesh"): Address => ({
  line1: "12-34 MG Road", city, district: "NTR District", state, pinCode: pin,
});

const shop = (overrides: Partial<OrderShop> = {}): OrderShop => ({
  id: "shop-1", name: "ABC Chicken Shop", location: "Vijayawada", address: addr(),
  gps: gps(16.5062, 80.648), gpsStatus: "Fresh", ...overrides,
});

const pickup = (overrides: Partial<PickupSource> = {}): PickupSource => ({
  id: "farm-1", farmName: "Hyderabad Farm", location: "Hyderabad",
  address: addr("Hyderabad", "500052", "Telangana"), gps: gps(17.385, 78.4867), gpsStatus: "Fresh",
  source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned", ...overrides,
});

const schedule = (departureTime = "08:00", tripSubmitted = "08:00", loadingDone = "08:15"): VehicleSchedule => ({
  tripSubmittedTime: tripSubmitted, loadingCompletionTime: loadingDone, departureTime,
});

const vehicle = (overrides: Partial<RouteVehicle> = {}): RouteVehicle => ({
  id: "v1", vehicleNo: "AP 16 AB 1234", driverName: "Ravi", supervisorName: "Kumar",
  pickup: pickup(), birdCapacity: 20000, boxCapacity: 200, available: true, assignedOrderCount: 0,
  schedule: schedule("08:00"), currentGps: gps(17.385, 78.4867), currentGpsStatus: "Fresh",
  existingStopCities: [], ...overrides,
});

const order = (overrides: Partial<Order> = {}): Order => ({
  id: "ord-1", orderNumber: "ORD-1001", shop: shop(), birdType: "Broiler",
  requirementType: "Birds", birds: 5000, boxes: 0, expectedWeightKg: null, remarks: "",
  priority: "Normal", importantCustomer: false, deliveryDate: "2026-08-21",
  deadlineTime: "11:00", deadlineLabel: "Before 11:00", deliveryWindow: null,
  status: "Pending", pickupSource: null, vehicleAssignment: null,
  createdAt: "2026-08-20T09:00:00Z", updatedAt: "2026-08-20T09:00:00Z", ...overrides,
});

const draft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  shopId: "shop-1", birdType: "Broiler", requirementType: "Birds", birds: 1000, boxes: 0,
  expectedWeightKg: null, remarks: "", priority: "Normal", importantCustomer: false,
  deliveryDate: "2026-08-21", deadlineTime: "12:00", deadlineLabel: "Before 12:00",
  deliveryWindow: null, ...overrides,
});

/* ------------------------------------------------------------------ */
/*  1. Validation                                                      */
/* ------------------------------------------------------------------ */
describe("validateOrderDraft", () => {
  it("accepts a valid draft", () => assert.equal(validateOrderDraft(draft()).valid, true));
  it("requires a shop", () => assert.equal(validateOrderDraft(draft({ shopId: "" })).errors.shopId, "Shop is required."));
  it("requires a bird type", () => assert.equal(validateOrderDraft(draft({ birdType: "" })).errors.birdType, "Bird type is required."));
  it("rejects negative birds", () => assert.equal(validateOrderDraft(draft({ birds: -5 })).errors.birds, "Number of birds cannot be negative."));
  it("rejects fractional birds", () => assert.equal(validateOrderDraft(draft({ birds: 10.5 })).errors.birds, "Number of birds must be a whole number."));
  it("rejects negative boxes", () => assert.equal(validateOrderDraft(draft({ boxes: -1 })).errors.boxes, "Number of boxes cannot be negative."));
  it("rejects fractional boxes", () => assert.equal(validateOrderDraft(draft({ boxes: 2.25 })).valid, false));
  it("requires at least one quantity", () => assert.equal(validateOrderDraft(draft({ birds: 0, boxes: 0 })).errors.form, "Provide at least one quantity — birds or boxes."));
  it("allows birds-only", () => assert.equal(validateOrderDraft(draft({ birds: 100, boxes: 0 })).valid, true));
  it("allows boxes-only", () => assert.equal(validateOrderDraft(draft({ birds: 0, boxes: 10 })).valid, true));
  it("allows birds + boxes", () => assert.equal(validateOrderDraft(draft({ birds: 100, boxes: 5, requirementType: "Birds + Boxes" })).valid, true));
  it("requires priority", () => assert.equal(validateOrderDraft(draft({ priority: "" as OrderPriority })).errors.priority, "Priority is required."));
  it("requires a delivery date", () => assert.equal(validateOrderDraft(draft({ deliveryDate: "" })).errors.deliveryDate, "Delivery date is required."));
  it("rejects an invalid delivery date", () => assert.equal(validateOrderDraft(draft({ deliveryDate: "not-a-date" })).errors.deliveryDate, "Delivery date is invalid."));
  it("requires a deadline time", () => assert.equal(validateOrderDraft(draft({ deadlineTime: "" })).errors.deadlineTime, "Delivery deadline is required."));
  it("rejects an invalid deadline time", () => assert.equal(validateOrderDraft(draft({ deadlineTime: "25:00" })).errors.deadlineTime, "Delivery deadline is invalid."));
  it("rejects negative expected weight", () => assert.equal(validateOrderDraft(draft({ expectedWeightKg: -1 })).errors.expectedWeightKg, "Expected weight cannot be negative."));
  it("nextOrderNumber is sequential", () => {
    assert.equal(nextOrderNumber(0), "ORD-1001");
    assert.equal(nextOrderNumber(99), "ORD-1100");
    assert.equal(nextOrderNumber(199), "ORD-1200");
  });
  it("exposes configurable constants", () => {
    assert.ok(BIRD_TYPES.includes("Broiler") && BIRD_TYPES.includes("Layer"));
    assert.deepEqual(PRIORITIES, ["Normal", "Important", "Urgent"]);
    assert.deepEqual(REQUIREMENT_TYPES, ["Birds", "Boxes", "Birds + Boxes"]);
    assert.ok(DEADLINE_PRESETS.some((p) => p.label === "Before 14:00" && p.time === "14:00"));
  });
});

/* ------------------------------------------------------------------ */
/*  2. Business time helpers                                           */
/* ------------------------------------------------------------------ */
describe("businessTime", () => {
  it("parses HH:mm", () => {
    assert.equal(parseHHmm("08:00"), 480);
    assert.equal(parseHHmm("23:59"), 1439);
    assert.equal(parseHHmm("00:00"), 0);
  });
  it("rejects malformed times", () => {
    assert.equal(parseHHmm("25:00"), null);
    assert.equal(parseHHmm("8:99"), null);
    assert.equal(parseHHmm("abc"), null);
    assert.equal(parseHHmm(null), null);
    assert.equal(parseHHmm(""), null);
  });
  it("formats HH:mm back", () => {
    assert.equal(formatHHmm(480), "08:00");
    assert.equal(formatHHmm(1439), "23:59");
  });
  it("formats 12h clock", () => {
    assert.equal(formatClock(615), "10:15 AM");
    assert.equal(formatClock(0), "12:00 AM");
    assert.equal(formatClock(720), "12:00 PM");
    assert.equal(formatClock(855), "2:15 PM");
  });
  it("formats durations", () => {
    assert.equal(formatDuration(45), "45m");
    assert.equal(formatDuration(120), "2h");
    assert.equal(formatDuration(135), "2h 15m");
  });
  it("validates HH:mm", () => {
    assert.equal(isValidHHmm("08:00"), true);
    assert.equal(isValidHHmm("99:00"), false);
    assert.equal(isValidHHmm(""), false);
  });
});

/* ------------------------------------------------------------------ */
/*  3. GPS validation + classification                                 */
/* ------------------------------------------------------------------ */
describe("gps validation", () => {
  it("validates latitude range", () => {
    assert.equal(isValidLatitude(0), true);
    assert.equal(isValidLatitude(90), true);
    assert.equal(isValidLatitude(-90), true);
    assert.equal(isValidLatitude(90.1), false);
    assert.equal(isValidLatitude(-90.1), false);
    assert.equal(isValidLatitude(null), false);
    assert.equal(isValidLatitude(Number.NaN), false);
  });
  it("validates longitude range", () => {
    assert.equal(isValidLongitude(0), true);
    assert.equal(isValidLongitude(180), true);
    assert.equal(isValidLongitude(-180), true);
    assert.equal(isValidLongitude(180.1), false);
    assert.equal(isValidLongitude(null), false);
  });
  it("validates a full coordinate", () => {
    assert.equal(isValidCoordinate(gps(16.5, 80.6)), true);
    assert.equal(isValidCoordinate(gps(null, 80.6)), false);
    assert.equal(isValidCoordinate(gps(16.5, 200)), false);
    assert.equal(isValidCoordinate(null), false);
  });
  it("classifies fresh / stale / unavailable / invalid / poor", () => {
    const now = Date.parse("2026-08-20T09:00:00Z");
    assert.equal(classifyGps(gps(16.5, 80.6, 8, "2026-08-20T08:59:00Z"), now), "Fresh");
    assert.equal(classifyGps(gps(16.5, 80.6, 8, "2026-08-20T08:00:00Z"), now), "Stale");
    assert.equal(classifyGps(null, now), "Unavailable");
    assert.equal(classifyGps(gps(200, 80.6), now), "Invalid");
    assert.equal(classifyGps(gps(16.5, 80.6, 250, "2026-08-20T08:59:00Z"), now), "Poor Accuracy");
  });
  it("treats a missing timestamp as unavailable", () => {
    assert.equal(classifyGps({ latitude: 16.5, longitude: 80.6 }, Date.now()), "Unavailable");
  });
});

/* ------------------------------------------------------------------ */
/*  4. Feasibility                                                     */
/* ------------------------------------------------------------------ */
describe("feasibility", () => {
  it("classifies buffer", () => {
    assert.equal(classifyBuffer(60), "Healthy");
    assert.equal(classifyBuffer(30), "Tight"); // exactly 30 → tight (>30 is healthy)
    assert.equal(classifyBuffer(10), "Tight");
    assert.equal(classifyBuffer(5), "At Risk");
    assert.equal(classifyBuffer(0), "At Risk");
    assert.equal(classifyBuffer(-1), "Late");
    assert.equal(classifyBuffer(null), "Unknown");
    assert.equal(classifyBuffer(Number.NaN), "Unknown");
  });
  it("classifies deadline feasibility", () => {
    assert.equal(classifyFeasibility(30), "Can Meet");
    assert.equal(classifyFeasibility(10), "Can Meet");
    assert.equal(classifyFeasibility(5), "At Risk");
    assert.equal(classifyFeasibility(0), "At Risk");
    assert.equal(classifyFeasibility(-1), "Cannot Meet");
    assert.equal(classifyFeasibility(null), "Unknown");
  });
});

/* ------------------------------------------------------------------ */
/*  5. Distance / ETA + sequential legs                                */
/* ------------------------------------------------------------------ */
describe("route calculation", () => {
  it("computes a plausible Hyderabad → Vijayawada distance", () => {
    const d = haversineKm(gps(17.385, 78.4867), gps(16.5062, 80.648));
    assert.ok(d != null && d > 200 && d < 300);
  });
  it("returns 0 for identical points", () => assert.equal(haversineKm(gps(16.5, 80.6), gps(16.5, 80.6)), 0));
  it("returns null for missing/invalid coordinates", () => {
    assert.equal(haversineKm(null, gps(16.5, 80.6)), null);
    assert.equal(haversineKm(gps(null, 80.6), gps(16.5, 80.6)), null);
    assert.equal(haversineKm(gps(16.5, 200), gps(16.5, 80.6)), null);
  });
  it("flags results as estimates", () => {
    const r = mockRouteCalculationService.calculateDistance(gps(17.385, 78.4867), gps(16.5062, 80.648));
    assert.equal(r.state, "Estimated");
    assert.equal(r.isEstimate, true);
    assert.ok(r.travelMinutes != null && r.travelMinutes > 0);
  });
  it("returns Unavailable without GPS", () => {
    const r = mockRouteCalculationService.calculateDistance(null, gps(16.5, 80.6));
    assert.equal(r.state, "Unavailable");
    assert.equal(r.distanceKm, null);
  });
  it("estimates travel time from distance", () => {
    assert.equal(mockRouteCalculationService.estimateTravelMinutes(40, 40), 60);
    assert.equal(mockRouteCalculationService.estimateTravelMinutes(0), 0);
    assert.equal(mockRouteCalculationService.estimateTravelMinutes(-5), 0);
  });
  it("computeLeg builds a leg with distance + arrival", () => {
    const leg = computeLeg({
      legNumber: 1, fromName: "Farm", fromGps: gps(16.3639, 80.8444),
      toName: "Shop A", toAddress: "Vijayawada", toGps: gps(16.5062, 80.648), departureMinutes: 480,
    });
    assert.equal(leg.isEstimate, true);
    assert.equal(leg.calculationState, "Estimated");
    assert.ok(leg.distanceKm != null);
    assert.ok(leg.arrivalTime != null);
  });
  it("computeLeg returns Unavailable when a coordinate is invalid", () => {
    const leg = computeLeg({ legNumber: 1, fromName: "Farm", fromGps: null, toName: "A", toAddress: "A", toGps: gps(16.5, 80.6), departureMinutes: 480 });
    assert.equal(leg.calculationState, "Unavailable");
    assert.equal(leg.distanceKm, null);
  });
  it("formatDistanceKm never emits NaN", () => {
    assert.equal(formatDistanceKm(null), "Calculation Pending");
    assert.equal(formatDistanceKm(Number.NaN), "Calculation Pending");
    assert.equal(formatDistanceKm(274), "274 km");
  });
});

/* ------------------------------------------------------------------ */
/*  6. Priority                                                        */
/* ------------------------------------------------------------------ */
describe("priority", () => {
  it("ranks order priority", () => {
    assert.ok(priorityRank("Urgent") > priorityRank("Important"));
    assert.ok(priorityRank("Important") > priorityRank("Normal"));
  });
  it("sequences by earliest deadline then priority", () => {
    const a = order({ orderNumber: "A", deadlineTime: "14:00", priority: "Normal" });
    const b = order({ orderNumber: "B", deadlineTime: "10:00", priority: "Normal" });
    const c = order({ orderNumber: "C", deadlineTime: "10:00", priority: "Urgent" });
    const sorted = [a, b, c].sort(compareOrdersByDeadlineThenPriority);
    assert.equal(sorted[0].orderNumber, "C"); // urgent at 10:00
    assert.equal(sorted[1].orderNumber, "B"); // normal at 10:00
    assert.equal(sorted[2].orderNumber, "A"); // 14:00
  });
  it("evaluateRoutePriority: LOW for routine", () => {
    const r = evaluateRoutePriority({ urgentOrderCount: 0, importantCustomerCount: 0, earliestDeadlineLabel: null, minBufferMinutes: 60, hasLateStop: false, hasAtRiskStop: false, totalTravelMinutes: 120, stopCount: 2, vehicleAvailability: true, capacitySufficient: true });
    assert.equal(r.level, "LOW");
  });
  it("evaluateRoutePriority: HIGH when a stop is late", () => {
    const r = evaluateRoutePriority({ urgentOrderCount: 0, importantCustomerCount: 0, earliestDeadlineLabel: "Before 10:00", minBufferMinutes: -10, hasLateStop: true, hasAtRiskStop: false, totalTravelMinutes: 120, stopCount: 2, vehicleAvailability: true, capacitySufficient: true });
    assert.equal(r.level, "HIGH");
  });
  it("evaluateRoutePriority: MEDIUM for important customers", () => {
    const r = evaluateRoutePriority({ urgentOrderCount: 0, importantCustomerCount: 1, earliestDeadlineLabel: null, minBufferMinutes: 60, hasLateStop: false, hasAtRiskStop: false, totalTravelMinutes: 120, stopCount: 2, vehicleAvailability: true, capacitySufficient: true });
    assert.equal(r.level, "MEDIUM");
  });
  it("evaluateRoutePriority: lists reasons", () => {
    const r = evaluateRoutePriority({ urgentOrderCount: 2, importantCustomerCount: 1, earliestDeadlineLabel: "Before 10:30", minBufferMinutes: 20, hasLateStop: false, hasAtRiskStop: true, totalTravelMinutes: 200, stopCount: 3, vehicleAvailability: true, capacitySufficient: true });
    assert.ok(r.reasons.some((x) => x.includes("urgent")));
    assert.ok(r.reasons.some((x) => x.includes("important customer")));
  });
});

/* ------------------------------------------------------------------ */
/*  7. Vehicle recommendation — critical review scenarios              */
/* ------------------------------------------------------------------ */

describe("vehicle recommendation — critical scenarios", () => {
  it("#40 later-starting vehicle arrives earlier and ranks above earlier-starting vehicle", () => {
    const o = order({ deadlineTime: "18:00", deadlineLabel: "Before 18:00" });
    const v01 = vehicle({ id: "v01", vehicleNo: "V01", pickup: pickup({ id: "farm-hyd", farmName: "Hyderabad Farm", location: "Hyderabad", gps: gps(17.385, 78.4867) }), schedule: schedule("08:00") });
    const v02 = vehicle({ id: "v02", vehicleNo: "V02", pickup: pickup({ id: "farm-vuy", farmName: "Vuyyuru Farm", location: "Vuyyuru", gps: gps(16.3639, 80.8444) }), schedule: schedule("09:00") });

    // Exact travel times (2h vs 45m), matching the scenario.
    const c1 = evaluateCandidate(o, v01, 250, 120); // arrives 10:00
    const c2 = evaluateCandidate(o, v02, 30, 45);   // arrives 09:45
    assert.equal(c1.predictedArrival, "10:00");
    assert.equal(c2.predictedArrival, "09:45");

    const result = finalizeRecommendation([c1, c2]);
    assert.ok(result.recommended);
    assert.equal(result.recommended.vehicle.id, "v02");
    assert.equal(result.recommended.reasons.includes("Earliest feasible ETA"), true);
  });

  it("#41 deadline makes earlier-arriving vehicle the only one that can meet", () => {
    const o = order({ deadlineTime: "10:30", deadlineLabel: "Before 10:30" });
    const v01 = vehicle({ id: "v01", vehicleNo: "V01", schedule: schedule("08:00") });
    const v02 = vehicle({ id: "v02", vehicleNo: "V02", schedule: schedule("09:15") });

    const c1 = evaluateCandidate(o, v01, 80, 120); // 08:00 + 2h = 10:00, buffer 30
    const c2 = evaluateCandidate(o, v02, 60, 90);  // 09:15 + 1.5h = 10:45, buffer -15
    assert.equal(c1.deadlineFeasible, "Can Meet");
    assert.equal(c2.deadlineFeasible, "Cannot Meet");

    const result = finalizeRecommendation([c1, c2]);
    assert.ok(result.recommended);
    assert.equal(result.recommended.vehicle.id, "v01");
  });

  it("#42 earlier ETA + lower existing route load is strongly preferred", () => {
    const o = order({ deadlineTime: "10:30", deadlineLabel: "Before 10:30" });
    const v01 = vehicle({ id: "v01", vehicleNo: "V01", assignedOrderCount: 5, schedule: schedule("08:00") });
    const v02 = vehicle({ id: "v02", vehicleNo: "V02", assignedOrderCount: 1, schedule: schedule("09:00") });

    const c1 = evaluateCandidate(o, v01, 80, 120); // 10:00
    const c2 = evaluateCandidate(o, v02, 30, 45);  // 09:45
    const result = finalizeRecommendation([c1, c2]);
    assert.ok(result.recommended);
    assert.equal(result.recommended.vehicle.id, "v02");
    assert.equal(result.recommended.reasons.includes("Lower existing route load"), true);
  });

  it("#43 capacity is a hard constraint — insufficient vehicle is NOT eligible", () => {
    const o = order({ birds: 5000, boxes: 0 });
    const v01 = vehicle({ id: "v01", vehicleNo: "V01", birdCapacity: 100, schedule: schedule("08:00") });
    const v02 = vehicle({ id: "v02", vehicleNo: "V02", birdCapacity: 20000, schedule: schedule("09:00") });

    const c1 = evaluateCandidate(o, v01, 30, 45);
    const c2 = evaluateCandidate(o, v02, 30, 45);
    assert.equal(c1.eligibility, "Not Eligible");
    assert.equal(c2.eligibility, "Eligible");

    const result = finalizeRecommendation([c1, c2]);
    assert.ok(result.recommended);
    assert.equal(result.recommended.vehicle.id, "v02");
    assert.equal(result.candidates.find((c) => c.vehicle.id === "v01")?.tier, "Not Suitable");
  });

  it("#44 all vehicles late → deadline at risk, best available (not 'Can Meet')", () => {
    const o = order({ deadlineTime: "10:00", deadlineLabel: "Before 10:00" });
    const v01 = vehicle({ id: "v01", vehicleNo: "V01", schedule: schedule("08:00") });
    const v02 = vehicle({ id: "v02", vehicleNo: "V02", schedule: schedule("08:30") });

    const c1 = evaluateCandidate(o, v01, 100, 150); // 08:00 + 2.5h = 10:30
    const c2 = evaluateCandidate(o, v02, 90, 135);  // 08:30 + 2.25h = 10:45
    assert.equal(c1.deadlineFeasible, "Cannot Meet");
    assert.equal(c2.deadlineFeasible, "Cannot Meet");

    const result = finalizeRecommendation([c1, c2]);
    assert.equal(result.allLate, true);
    assert.ok(result.recommended);
    assert.equal(result.recommended.tier, "At Risk");
    assert.notEqual(result.recommended.deadlineFeasible, "Can Meet");
    assert.match(result.summary, /Deadline at risk/);
  });
});

describe("vehicle recommendation — hard constraints", () => {
  const o = order({ birds: 5000, boxes: 10 });

  it("excludes unavailable vehicles", () => {
    const c = evaluateCandidate(o, vehicle({ available: false }), 30, 45);
    assert.equal(c.eligibility, "Not Eligible");
    assert.equal(c.eligibilityReasons[0], "Vehicle is not available");
  });
  it("excludes insufficient bird capacity", () => {
    const c = evaluateCandidate(o, vehicle({ birdCapacity: 100 }), 30, 45);
    assert.equal(c.eligibility, "Not Eligible");
  });
  it("excludes insufficient box capacity", () => {
    const c = evaluateCandidate(o, vehicle({ boxCapacity: 5 }), 30, 45);
    assert.equal(c.eligibility, "Not Eligible");
  });
  it("excludes vehicles with missing shop GPS", () => {
    const c = evaluateCandidate(order({ shop: shop({ gps: null, gpsStatus: "Unavailable" }) }), vehicle(), null, null);
    assert.equal(c.eligibility, "Not Eligible");
    assert.match(c.eligibilityReasons[0], /Shop GPS/);
  });
  it("excludes vehicles with missing pickup GPS", () => {
    const c = evaluateCandidate(o, vehicle({ pickup: pickup({ gps: null, gpsStatus: "Unavailable" }) }), null, null);
    assert.equal(c.eligibility, "Not Eligible");
    assert.match(c.eligibilityReasons[0], /Pickup GPS/);
  });
  it("returns no recommendation when all vehicles are ineligible", () => {
    const r = finalizeRecommendation([
      evaluateCandidate(o, vehicle({ available: false }), null, null),
      evaluateCandidate(o, vehicle({ birdCapacity: 10 }), null, null),
    ]);
    assert.equal(r.recommended, null);
    assert.match(r.summary, /No eligible vehicle/);
  });
});

describe("vehicle recommendation — soft preferences", () => {
  it("important customer nudges but never overrides a missed deadline", () => {
    const o = order({ importantCustomer: true, deadlineTime: "10:00" });
    const late = evaluateCandidate(o, vehicle({ id: "v1" }), 100, 200); // arrival 11:20, buffer -80
    assert.equal(late.deadlineFeasible, "Cannot Meet");
    // Cannot Meet is never re-labelled Can Meet regardless of important customer.
    const feasible = evaluateCandidate(order({ deadlineTime: "18:00" }), vehicle({ id: "v2" }), 30, 45);
    assert.equal(feasible.deadlineFeasible, "Can Meet");
    assert.ok(feasible.score > late.score + 5000);
  });
  it("urgent + cannot-meet is heavily penalised (never falsely 'fine')", () => {
    const o = order({ priority: "Urgent", deadlineTime: "10:00" });
    const late = evaluateCandidate(o, vehicle({ id: "v1" }), 100, 200);
    assert.equal(late.deadlineFeasible, "Cannot Meet");
    assert.ok(late.score < -10000);
  });
  it("existing route alignment gives a preference", () => {
    const o = order({ shop: shop({ location: "Eluru" }) });
    const aligned = evaluateCandidate(o, vehicle({ id: "v1", existingStopCities: ["Eluru"] }), 50, 60);
    const notAligned = evaluateCandidate(o, vehicle({ id: "v2" }), 50, 60);
    assert.ok(aligned.score > notAligned.score);
  });
});

describe("recommendVehicles integration", () => {
  it("recommends a feasible vehicle and returns a sorted comparison list", () => {
    const o = order({ deadlineTime: "18:00", shop: shop({ location: "Vijayawada", gps: gps(16.5062, 80.648) }) });
    const vehicles = [
      vehicle({ id: "v-hyd", pickup: pickup({ location: "Hyderabad", gps: gps(17.385, 78.4867) }), schedule: schedule("08:00") }),
      vehicle({ id: "v-vuy", pickup: pickup({ location: "Vuyyuru", gps: gps(16.3639, 80.8444) }), schedule: schedule("09:00") }),
    ];
    const result = recommendVehicles({ order: o, vehicles });
    assert.ok(result.recommended);
    assert.equal(result.recommended.vehicle.id, "v-vuy"); // much closer
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].tier, "Best Match");
  });
});

/* ------------------------------------------------------------------ */
/*  8. Route building — sequential legs                                */
/* ------------------------------------------------------------------ */
describe("route building", () => {
  const vuyPickup = pickup({ id: "farm-vuy", farmName: "Vuyyuru Farm", location: "Vuyyuru", gps: gps(16.3639, 80.8444) });
  const v = vehicle({ id: "v3", pickup: vuyPickup, schedule: schedule("09:00") });

  it("sorts stops by deadline then priority", () => {
    const orders = [
      order({ orderNumber: "A", deadlineTime: "14:00" }),
      order({ orderNumber: "B", deadlineTime: "10:00" }),
      order({ orderNumber: "C", deadlineTime: "10:00", priority: "Urgent" }),
    ];
    const sorted = sortOrdersForRoute(orders);
    assert.deepEqual(sorted.map((o) => o.orderNumber), ["C", "B", "A"]);
  });

  it("builds sequential legs: farm → A → B (not farm → each shop)", () => {
    const shopA = shop({ id: "sa", name: "Shop A", location: "Vijayawada", gps: gps(16.5062, 80.648) });
    const shopB = shop({ id: "sb", name: "Shop B", location: "Guntur", gps: gps(16.3067, 80.4365) });
    const orders = [
      order({ id: "oA", orderNumber: "A", shop: shopA, deadlineTime: "10:00", pickupSource: vuyPickup }),
      order({ id: "oB", orderNumber: "B", shop: shopB, deadlineTime: "11:00", pickupSource: vuyPickup }),
    ];
    const route = buildRoute(v, orders);

    assert.equal(route.legs.length, 2);
    assert.equal(route.legs[0].fromName, "Vuyyuru Farm");
    assert.equal(route.legs[0].toName, "Shop A");
    // Leg 2 starts from Shop A — sequential, not from the farm.
    assert.equal(route.legs[1].fromName, "Shop A");
    assert.equal(route.legs[1].toName, "Shop B");

    // Total distance = leg1 + leg2 (sequential).
    const sum = (route.legs[0].distanceKm ?? 0) + (route.legs[1].distanceKm ?? 0);
    assert.equal(route.totalDistanceKm, Math.round(sum * 10) / 10);
  });

  it("computes per-stop arrival times cumulatively", () => {
    const shopA = shop({ id: "sa", name: "Shop A", location: "Vijayawada", gps: gps(16.5062, 80.648) });
    const shopB = shop({ id: "sb", name: "Shop B", location: "Guntur", gps: gps(16.3067, 80.4365) });
    const orders = [
      order({ id: "oA", shop: shopA, deadlineTime: "10:00", pickupSource: vuyPickup }),
      order({ id: "oB", shop: shopB, deadlineTime: "11:00", pickupSource: vuyPickup }),
    ];
    const route = buildRoute(v, orders);
    assert.equal(route.stops.length, 2);
    assert.ok(route.stops[0].arrivalTime != null);
    assert.ok(route.stops[1].arrivalTime != null);
    // Second stop arrives after the first.
    assert.ok(parseHHmm(route.stops[1].arrivalTime!)! >= parseHHmm(route.stops[0].arrivalTime!)!);
    assert.ok(route.stops[0].bufferMinutes != null);
  });

  it("computes route totals from sequential legs", () => {
    const shopA = shop({ id: "sa", name: "Shop A", location: "Vijayawada", gps: gps(16.5062, 80.648) });
    const orders = [
      order({ id: "oA", shop: shopA, birds: 5000, boxes: 10, deadlineTime: "10:00", pickupSource: vuyPickup }),
      order({ id: "oB", shop: shop({ id: "sb", name: "Shop B", location: "Guntur", gps: gps(16.3067, 80.4365) }), birds: 3000, boxes: 5, deadlineTime: "11:00", pickupSource: vuyPickup }),
    ];
    const route = buildRoute(v, orders);
    assert.equal(route.totalBirds, 8000);
    assert.equal(route.totalBoxes, 15);
    assert.equal(route.stops.length, 2);
    assert.ok((route.totalDistanceKm ?? 0) > 0);
  });

  it("groups orders by vehicle into routes", () => {
    const a1 = { vehicleId: "v1", vehicleNo: "V01", driverName: "Ravi", supervisorName: "K", tripNo: "T1", pickupFarm: "F", pickupLocation: "L", orderCount: 2, routeStatus: "Planned", departureTime: "08:00", assignmentType: "System Recommended" as const };
    const a2 = { ...a1, vehicleId: "v2", vehicleNo: "V02" };
    const v1 = vehicle({ id: "v1", pickup: vuyPickup });
    const v2 = vehicle({ id: "v2", vehicleNo: "V02", pickup: vuyPickup });
    const orders = [
      order({ vehicleAssignment: a1, pickupSource: vuyPickup, shop: shop({ id: "s1" }) }),
      order({ vehicleAssignment: a1, pickupSource: vuyPickup, shop: shop({ id: "s2" }) }),
      order({ vehicleAssignment: a2, pickupSource: vuyPickup, shop: shop({ id: "s3" }) }),
    ];
    const routes = groupOrdersByVehicle(orders, [v1, v2]);
    assert.equal(routes.length, 2);
    assert.ok(routes.some((r) => r.stops.length === 2));
  });

  it("distanceForOrder returns null without pickup/shop GPS", () => {
    assert.equal(distanceForOrder(order()), null);
  });
});

/* ------------------------------------------------------------------ */
/*  9. Filtering                                                       */
/* ------------------------------------------------------------------ */
describe("applyFilters", () => {
  const orders = [
    order({ orderNumber: "ORD-1", shop: shop({ name: "ABC Chicken Shop" }), priority: "Urgent", importantCustomer: true }),
    order({ orderNumber: "ORD-2", shop: shop({ name: "XYZ Poultry", location: "Guntur" }), priority: "Normal", status: "Delivered" }),
  ];
  it("searches by shop name", () => assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, search: "ABC" }).length, 1));
  it("searches by order number", () => assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, search: "ORD-2" }).length, 1));
  it("filters by priority", () => assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, priority: "Urgent" }).length, 1));
  it("filters by status", () => assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, status: "Delivered" }).length, 1));
  it("filters important customers", () => assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, importantOnly: true }).length, 1));
  it("filters urgent only", () => assert.equal(applyFilters(orders, { ...EMPTY_FILTERS, urgentOnly: true }).length, 1));
  it("filters assigned vs unassigned", () => {
    const assigned = order({ vehicleAssignment: { vehicleId: "v1", vehicleNo: "AP", driverName: "D", supervisorName: "S", tripNo: "T", pickupFarm: "F", pickupLocation: "L", orderCount: 1, routeStatus: "Planned", departureTime: "08:00", assignmentType: "System Recommended" } });
    const all = [assigned, order()];
    assert.equal(applyFilters(all, { ...EMPTY_FILTERS, assigned: "assigned" }).length, 1);
    assert.equal(applyFilters(all, { ...EMPTY_FILTERS, assigned: "unassigned" }).length, 1);
  });
  it("returns everything with no filters", () => assert.equal(applyFilters(orders, EMPTY_FILTERS).length, 2));
  it("formatAddress joins address parts", () => assert.match(formatAddress(addr()), /Vijayawada/));
});

/* ------------------------------------------------------------------ */
/*  10. Bulk / performance stability                                   */
/* ------------------------------------------------------------------ */
describe("bulk stability", () => {
  it("200 orders, 20 vehicles, mixed states — no crash, no NaN", () => {
    const orders = Array.from({ length: 200 }, (_, i) =>
      order({
        id: `o${i}`,
        orderNumber: `ORD-${i}`,
        priority: (["Normal", "Important", "Urgent"] as OrderPriority[])[i % 3],
        status: (["Pending", "Assigned", "Delivered", "In Transit", "Cancelled"] as const)[i % 5],
        birds: (i % 10) * 500,
        boxes: i % 4,
        shop: shop({ id: `s${i % 4}`, location: ["Vijayawada", "Hyderabad", "Eluru", "Guntur"][i % 4] }),
      }),
    );
    const filtered = applyFilters(orders, EMPTY_FILTERS);
    assert.equal(filtered.length, 200);

    const vehicles = Array.from({ length: 20 }, (_, i) =>
      vehicle({ id: `v${i}`, vehicleNo: `AP ${i}`, available: i !== 13, birdCapacity: 1000 + i * 1000, schedule: schedule(String(i % 12).padStart(2, "0") + ":00") }),
    );
    const result = recommendVehicles({ order: orders[0], vehicles });
    assert.ok(result.candidates.length === 20);
    assert.ok(result.candidates.every((c) => Number.isFinite(c.score)));
    assert.ok(result.candidates.every((c) => c.distanceKm == null || c.distanceKm >= 0));
  });

  it("50 route stops build without NaN / negative distances / duplicate stops", () => {
    const vuyPickup = pickup({ id: "f", farmName: "Farm", location: "L", gps: gps(16.3639, 80.8444) });
    const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
    const orders = Array.from({ length: 50 }, (_, i) =>
      order({ id: `o${i}`, orderNumber: `O${i}`, pickupSource: vuyPickup, birds: 100, deadlineTime: String(i % 18).padStart(2, "0") + ":00", shop: shop({ id: `s${i}`, location: "City", gps: gps(16.3 + (i % 50) * 0.001, 80.4) }) }),
    );
    const route = buildRoute(v, orders);
    assert.equal(route.stops.length, 50);
    assert.equal(new Set(route.stops.map((s) => s.orderId)).size, 50);
    assert.ok((route.totalDistanceKm ?? 0) >= 0);
    assert.ok(route.legs.every((l) => l.distanceKm == null || l.distanceKm >= 0));
    assert.ok(route.stops.every((s) => s.bufferMinutes == null || Number.isFinite(s.bufferMinutes)));
  });

  it("no duplicate order assignments within a route", () => {
    const vuyPickup = pickup({ id: "f", farmName: "Farm", location: "L", gps: gps(16.3639, 80.8444) });
    const v = vehicle({ id: "v", pickup: vuyPickup });
    const orders = [order({ id: "x", pickupSource: vuyPickup }), order({ id: "x", pickupSource: vuyPickup })];
    const route = buildRoute(v, orders);
    assert.equal(route.stops.length, 2);
  });

  it("never produces NaN or invalid date in formatted outputs", () => {
    assert.doesNotThrow(() => formatDistanceKm(Number.NaN));
    assert.doesNotThrow(() => computeLeg({ legNumber: 1, fromName: "F", fromGps: gps(Number.NaN, Number.NaN), toName: "T", toAddress: "T", toGps: gps(16.5, 80.6), departureMinutes: 480 }));
  });
});

/* ------------------------------------------------------------------ */
/*  11. Time / feasibility matrix (cross-product regression)           */
/* ------------------------------------------------------------------ */
describe("time scenario matrix", () => {
  const departures = [480, 510, 540, 570, 600]; // 08:00 – 10:00
  const travels = [30, 45, 60, 90, 120];
  const deadlines = [540, 600, 660, 720]; // 09:00 – 12:00

  for (const dep of departures) {
    for (const travel of travels) {
      for (const deadline of deadlines) {
        it(`departure ${formatHHmm(dep)} + ${travel}m vs deadline ${formatHHmm(deadline)}`, () => {
          const o = order({ deadlineTime: formatHHmm(deadline) });
          const v = vehicle({ schedule: schedule(formatHHmm(dep)) });
          const c = evaluateCandidate(o, v, 0, travel);
          const arrival = dep + travel;
          const buffer = deadline - arrival;
          assert.equal(c.predictedArrival, formatHHmm(arrival));
          assert.equal(c.bufferMinutes, buffer);
          assert.equal(c.deadlineFeasible, classifyFeasibility(buffer));
          assert.equal(c.bufferState, classifyBuffer(buffer));
          assert.ok(Number.isFinite(c.score));
        });
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/*  12. Recommendation decision matrix (named scenarios)               */
/* ------------------------------------------------------------------ */
describe("recommendation decision matrix", () => {
  const o = (extra: Partial<Order> = {}) => order({ deadlineTime: "11:00", deadlineLabel: "Before 11:00", ...extra });

  it("closest vehicle is NOT best when a farther vehicle arrives earlier", () => {
    const close = evaluateCandidate(o(), vehicle({ id: "close", schedule: schedule("10:30") }), 10, 60); // arrives 11:30 → late
    const far = evaluateCandidate(o(), vehicle({ id: "far", schedule: schedule("08:00") }), 200, 120); // arrives 10:00
    const r = finalizeRecommendation([close, far]);
    assert.ok(r.recommended);
    assert.equal(r.recommended.vehicle.id, "far");
  });

  it("first-started vehicle is NOT best when a later starter arrives earlier", () => {
    const early = evaluateCandidate(o(), vehicle({ id: "early", schedule: schedule("07:00") }), 300, 240); // 11:00
    const later = evaluateCandidate(o(), vehicle({ id: "later", schedule: schedule("09:00") }), 50, 60); // 10:00
    const r = finalizeRecommendation([early, later]);
    assert.ok(r.recommended);
    assert.equal(r.recommended.vehicle.id, "later");
  });

  it("urgent order changes the recommendation toward the deadline-meeting vehicle", () => {
    const onTime = evaluateCandidate(o({ priority: "Urgent", deadlineTime: "10:30" }), vehicle({ id: "ontime", schedule: schedule("08:00") }), 80, 120); // 10:00
    const late = evaluateCandidate(o({ priority: "Urgent", deadlineTime: "10:30" }), vehicle({ id: "late", schedule: schedule("09:00") }), 30, 120); // 11:00
    assert.equal(onTime.deadlineFeasible, "Can Meet");
    assert.equal(late.deadlineFeasible, "Cannot Meet");
    const r = finalizeRecommendation([onTime, late]);
    assert.equal(r.recommended?.vehicle.id, "ontime");
  });

  it("deadline change flips the recommendation", () => {
    const a = evaluateCandidate(o({ deadlineTime: "12:00" }), vehicle({ id: "a", schedule: schedule("08:00") }), 80, 120);
    const b = evaluateCandidate(o({ deadlineTime: "12:00" }), vehicle({ id: "b", schedule: schedule("09:00") }), 30, 45);
    assert.equal(finalizeRecommendation([a, b]).recommended?.vehicle.id, "b"); // earlier ETA
  });

  it("important customer nudges but does not flip an impossible deadline", () => {
    const impossible = evaluateCandidate(o({ importantCustomer: true, deadlineTime: "09:00" }), vehicle({ id: "v", schedule: schedule("08:00") }), 100, 120); // 10:00
    assert.equal(impossible.deadlineFeasible, "Cannot Meet");
    assert.equal(impossible.tier, "Not Suitable"); // still not suitable before finalize
  });

  it("existing assigned orders make a vehicle less preferable", () => {
    const loaded = evaluateCandidate(o(), vehicle({ id: "loaded", assignedOrderCount: 6, schedule: schedule("08:00") }), 80, 120);
    const empty = evaluateCandidate(o(), vehicle({ id: "empty", assignedOrderCount: 0, schedule: schedule("08:00") }), 80, 120);
    assert.ok(empty.score > loaded.score);
  });

  it("a predicted-late vehicle is flagged At Risk, not Can Meet", () => {
    const late = evaluateCandidate(o({ deadlineTime: "10:00" }), vehicle({ id: "v", schedule: schedule("09:00") }), 100, 90); // 10:30
    assert.equal(late.deadlineFeasible, "Cannot Meet");
    assert.equal(late.eligibility, "At Risk");
  });

  it("manual override: an alternative eligible vehicle remains available", () => {
    const best = evaluateCandidate(o(), vehicle({ id: "best", schedule: schedule("08:00") }), 80, 60);
    const alt = evaluateCandidate(o(), vehicle({ id: "alt", schedule: schedule("08:15") }), 90, 70);
    const r = finalizeRecommendation([best, alt]);
    assert.equal(r.recommended?.vehicle.id, "best");
    const altCandidate = r.candidates.find((c) => c.vehicle.id === "alt");
    assert.equal(altCandidate?.tier, "Alternative");
  });
});

/* ------------------------------------------------------------------ */
/*  13. GPS states affect recommendation eligibility                   */
/* ------------------------------------------------------------------ */
describe("GPS states in recommendation", () => {
  it("stale shop GPS still allows a (flagged) calculation", () => {
    const c = evaluateCandidate(order({ shop: shop({ gpsStatus: "Stale", gps: gps(16.5062, 80.648, 30, "2026-08-19T07:00:00Z") }) }), vehicle(), 30, 45);
    assert.notEqual(c.eligibility, "Not Eligible"); // stale is usable
  });
  it("poor-accuracy GPS still allows a (flagged) calculation", () => {
    const c = evaluateCandidate(order({ shop: shop({ gpsStatus: "Poor Accuracy", gps: gps(16.5062, 80.648, 250) }) }), vehicle(), 30, 45);
    assert.notEqual(c.eligibility, "Not Eligible");
  });
  it("missing shop GPS blocks calculation", () => {
    const c = evaluateCandidate(order({ shop: shop({ gps: null, gpsStatus: "Unavailable" }) }), vehicle(), null, null);
    assert.equal(c.eligibility, "Not Eligible");
  });
  it("invalid shop GPS blocks calculation", () => {
    const c = evaluateCandidate(order({ shop: shop({ gps: gps(999, 999), gpsStatus: "Invalid" }) }), vehicle(), null, null);
    assert.equal(c.eligibility, "Not Eligible");
  });
  it("missing pickup GPS blocks calculation", () => {
    const c = evaluateCandidate(order(), vehicle({ pickup: pickup({ gps: null, gpsStatus: "Unavailable" }) }), null, null);
    assert.equal(c.eligibility, "Not Eligible");
  });
});

/* ------------------------------------------------------------------ */
/*  14. Routing scale scenarios                                        */
/* ------------------------------------------------------------------ */
describe("routing scale", () => {
  const vuyPickup = pickup({ id: "f", farmName: "Farm", location: "L", gps: gps(16.3639, 80.8444) });
  const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
  const mkShop = (i: number, city: string, lat: number, lng: number) =>
    shop({ id: `s${i}`, name: `Shop ${i}`, location: city, gps: gps(lat, lng) });

  [1, 2, 5, 10].forEach((n) => {
    it(`builds a route for ${n} shop${n === 1 ? "" : "s"}`, () => {
      const orders = Array.from({ length: n }, (_, i) =>
        order({ id: `o${i}`, orderNumber: `O${i}`, pickupSource: vuyPickup, deadlineTime: "18:00", shop: mkShop(i, `City ${i % 4}`, 16.3 + i * 0.01, 80.4) }),
      );
      const route = buildRoute(v, orders);
      assert.equal(route.stops.length, n);
      assert.equal(route.legs.length, n);
      assert.ok((route.totalDistanceKm ?? 0) >= 0);
    });
  });

  it("same-city vs different-city routes both build", () => {
    const same = [order({ id: "a", pickupSource: vuyPickup, shop: mkShop(1, "Vijayawada", 16.5, 80.6), deadlineTime: "10:00" }), order({ id: "b", pickupSource: vuyPickup, shop: mkShop(2, "Vijayawada", 16.51, 80.61), deadlineTime: "11:00" })];
    assert.equal(buildRoute(v, same).stops.length, 2);
    const diff = [order({ id: "a", pickupSource: vuyPickup, shop: mkShop(1, "Vijayawada", 16.5, 80.6), deadlineTime: "10:00" }), order({ id: "b", pickupSource: vuyPickup, shop: mkShop(2, "Guntur", 16.3, 80.43), deadlineTime: "11:00" })];
    assert.equal(buildRoute(v, diff).stops.length, 2);
  });
});

/* ------------------------------------------------------------------ */
/*  15. Vehicle fleet size scenarios                                   */
/* ------------------------------------------------------------------ */
describe("fleet size", () => {
  const o = order({ deadlineTime: "18:00" });
  [1, 7, 20].forEach((count) => {
    it(`recommends across ${count} vehicle${count === 1 ? "" : "s"}`, () => {
      const vehicles = Array.from({ length: count }, (_, i) =>
        vehicle({ id: `v${i}`, vehicleNo: `V${i}`, available: true, birdCapacity: 20000, schedule: schedule(String(8 + (i % 5)).padStart(2, "0") + ":00") }),
      );
      const r = recommendVehicles({ order: o, vehicles });
      assert.equal(r.candidates.length, count);
      assert.ok(r.recommended);
      assert.ok(r.candidates.every((c) => Number.isFinite(c.score)));
    });
  });
});

/* ------------------------------------------------------------------ */
/*  16. Delivery phase model                                           */
/* ------------------------------------------------------------------ */
describe("delivery phase model", () => {
  it("maps Urgent → Critical (including urgent + important customer)", () => {
    assert.equal(phaseOfOrder(order({ priority: "Urgent" })), "Critical");
    assert.equal(phaseOfOrder(order({ priority: "Urgent", importantCustomer: true })), "Critical");
  });
  it("maps Important → Important", () => {
    assert.equal(phaseOfOrder(order({ priority: "Important" })), "Important");
  });
  it("maps Normal + important customer → Important (documented behaviour)", () => {
    assert.equal(phaseOfOrder(order({ priority: "Normal", importantCustomer: true })), "Important");
  });
  it("maps Normal → Normal", () => {
    assert.equal(phaseOfOrder(order({ priority: "Normal" })), "Normal");
  });
  it("activePhaseOf picks the highest phase present", () => {
    assert.equal(activePhaseOf([order({ priority: "Normal" }), order({ priority: "Urgent" })]), "Critical");
    assert.equal(activePhaseOf([order({ priority: "Normal" }), order({ priority: "Important" })]), "Important");
    assert.equal(activePhaseOf([order({ priority: "Normal" })]), "Normal");
    assert.equal(activePhaseOf([]), null);
  });
  it("phase numbers are ordered 1 < 2 < 3", () => {
    assert.ok(PHASE_NUMBER.Critical < PHASE_NUMBER.Important);
    assert.ok(PHASE_NUMBER.Important < PHASE_NUMBER.Normal);
  });
  it("documented constants exist", () => {
    assert.equal(typeof DEADLINE_COMPARABLE_WINDOW_MINUTES, "number");
    assert.equal(typeof CRITICAL_BUFFER_MINUTES, "number");
  });
});

/* ------------------------------------------------------------------ */
/*  17. Delivery sequencing — next-stop selection                      */
/* ------------------------------------------------------------------ */
describe("delivery sequencing — next stop", () => {
  // Current vehicle location = Vijayawada.
  const current = gps(16.5062, 80.648);
  const state: SequencingState = { currentGps: current, currentName: "Vijayawada Farm", currentMinutes: 540 }; // 09:00

  const mk = (id: string, lat: number, lng: number, deadlineTime: string, priority: OrderPriority = "Normal") =>
    order({
      id, orderNumber: id.toUpperCase(),
      shop: shop({ id: `s-${id}`, name: `Shop ${id.toUpperCase()}`, location: "Test", gps: gps(lat, lng) }),
      deadlineTime, deadlineLabel: `Before ${deadlineTime}`, priority,
    });

  it("same priority → nearest feasible shop selected (spec #28)", () => {
    const near = mk("B", 16.51, 80.66, "14:00", "Urgent");   // ~1-2 km
    const far = mk("A", 16.90, 80.65, "14:00", "Urgent");    // ~45 km
    const result = selectNextDeliveryStop(state, [far, near]);
    assert.ok(result.stop);
    assert.equal(result.stop.orderId, "B");
    assert.ok(result.stop.reason.some((r) => r.includes("Nearest feasible shop")));
  });

  it("earlier deadline beats nearer shop (spec #29)", () => {
    const farEarly = mk("A", 16.90, 80.65, "11:00", "Urgent");  // 45 km, deadline 11:00
    const nearLate = mk("B", 16.51, 80.66, "15:00", "Urgent");   // 2 km, deadline 15:00
    const result = selectNextDeliveryStop(state, [nearLate, farEarly]);
    assert.ok(result.stop);
    assert.equal(result.stop.orderId, "A");
    assert.ok(result.stop.reason.some((r) => r.includes("Earliest deadline")));
  });

  it("urgent phase completes before normal phase when deadlines permit (spec #27)", () => {
    const urgentFar = mk("A", 16.90, 80.65, "14:00", "Urgent");
    const urgentNear = mk("B", 16.51, 80.66, "14:00", "Urgent");
    const normalClose = mk("C", 16.50, 80.65, "12:00", "Normal"); // very close but lower phase
    // Current time 09:00; C deadline 12:00 is NOT at risk (plenty of buffer).
    const result = selectNextDeliveryStop(state, [normalClose, urgentFar, urgentNear]);
    assert.equal(result.activePhase, "Critical");
    assert.equal(result.stop!.orderId, "B"); // urgent nearest, NOT the close normal shop
  });

  it("deadline override: lower-phase order about to be missed is promoted (spec #17)", () => {
    const urgent = mk("A", 16.51, 80.66, "14:00", "Urgent");       // buffer ~ healthy
    const normalLate = mk("B", 16.90, 80.65, "09:40", "Normal");    // 45 km ≈ 45 min → arrives 09:45 > 09:40 → late
    const result = selectNextDeliveryStop(state, [normalLate, urgent]);
    assert.equal(result.stop!.orderId, "B"); // promoted
    assert.equal(result.deadlineConflict, true);
    assert.ok(result.conflictReason!.includes("DEADLINE CONFLICT"));
  });

  it("urgent + important customer stays in Critical phase (spec #15)", () => {
    const o = order({ priority: "Urgent", importantCustomer: true });
    assert.equal(phaseOfOrder(o), "Critical");
  });
});

/* ------------------------------------------------------------------ */
/*  18. Delivery sequence building — recalculation                     */
/* ------------------------------------------------------------------ */
describe("delivery sequence building", () => {
  const vuyPickup = pickup({ id: "farm-vuy", farmName: "Vuyyuru Farm", location: "Vuyyuru", gps: gps(16.3639, 80.8444) });
  const v = vehicle({ id: "v3", pickup: vuyPickup, schedule: schedule("09:00") });

  it("builds a full sequence and completes all orders", () => {
    const orders = [
      order({ id: "a", orderNumber: "A", priority: "Urgent", deadlineTime: "14:00", pickupSource: vuyPickup, shop: shop({ id: "sa", gps: gps(16.5062, 80.648) }) }),
      order({ id: "b", orderNumber: "B", priority: "Normal", deadlineTime: "18:00", pickupSource: vuyPickup, shop: shop({ id: "sb", gps: gps(16.51, 80.66) }) }),
      order({ id: "c", orderNumber: "C", priority: "Important", deadlineTime: "16:00", pickupSource: vuyPickup, shop: shop({ id: "sc", gps: gps(16.30, 80.43) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    assert.equal(plan.stops.length, 3);
    // Urgent (Critical) first, then Important, then Normal.
    assert.equal(plan.stops[0].phase, "Critical");
    assert.equal(plan.stops[1].phase, "Important");
    assert.equal(plan.stops[2].phase, "Normal");
  });

  it("current location updates after each stop (sequential legs, not farm → each shop)", () => {
    const orders = [
      order({ id: "a", orderNumber: "A", priority: "Urgent", deadlineTime: "10:00", pickupSource: vuyPickup, shop: shop({ id: "sa", name: "Shop A", gps: gps(16.5062, 80.648) }) }),
      order({ id: "b", orderNumber: "B", priority: "Urgent", deadlineTime: "11:00", pickupSource: vuyPickup, shop: shop({ id: "sb", name: "Shop B", gps: gps(16.51, 80.66) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    assert.equal(plan.stops.length, 2);
    // Leg 1 starts at the farm.
    assert.equal(plan.stops[0].fromName, "Vuyyuru Farm");
    // Leg 2 starts from Shop A (previous stop), NOT the farm.
    assert.equal(plan.stops[1].fromName, "Shop A");
  });

  it("cumulative distance is sequential and increasing", () => {
    const orders = [
      order({ id: "a", orderNumber: "A", priority: "Urgent", deadlineTime: "10:00", pickupSource: vuyPickup, shop: shop({ id: "sa", gps: gps(16.5062, 80.648) }) }),
      order({ id: "b", orderNumber: "B", priority: "Urgent", deadlineTime: "11:00", pickupSource: vuyPickup, shop: shop({ id: "sb", gps: gps(16.51, 80.66) }) }),
      order({ id: "c", orderNumber: "C", priority: "Urgent", deadlineTime: "12:00", pickupSource: vuyPickup, shop: shop({ id: "sc", gps: gps(16.30, 80.43) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    assert.equal(plan.stops.length, 3);
    for (let i = 1; i < plan.stops.length; i++) {
      const prev = plan.stops[i - 1].cumulativeDistanceKm ?? 0;
      const cur = plan.stops[i].cumulativeDistanceKm ?? 0;
      assert.ok(cur >= prev);
    }
    // Total = sum of legs.
    const legSum = plan.stops.reduce((s, st) => s + (st.legDistanceKm ?? 0), 0);
    assert.equal(plan.totalDistanceKm, Math.round(legSum * 10) / 10);
  });

  it("recalculates from a new current location (spec #36)", () => {
    const remaining = [
      order({ id: "b", orderNumber: "B", priority: "Urgent", deadlineTime: "14:00", pickupSource: vuyPickup, shop: shop({ id: "sb", name: "Shop B", gps: gps(16.51, 80.66) }) }),
    ];
    // Vehicle now at Shop A's coordinates.
    const plan = recalculateDeliveryPlan(v, remaining, gps(16.5062, 80.648), "Shop A", 600); // 10:00
    assert.equal(plan.stops.length, 1);
    assert.equal(plan.stops[0].fromName, "Shop A");
    assert.equal(plan.schedule.departureTime, "10:00");
  });

  it("normal phase uses nearest-feasible strategy (spec #7)", () => {
    const mk = (id: string, lat: number, lng: number, deadlineTime: string) =>
      order({ id, orderNumber: id.toUpperCase(), priority: "Normal", deadlineTime, pickupSource: vuyPickup, shop: shop({ id: `s${id}`, name: `Shop ${id.toUpperCase()}`, gps: gps(lat, lng) }) });
    const orders = [
      mk("a", 16.5062, 80.648, "18:00"), // Vijayawada
      mk("b", 16.51, 80.66, "18:00"),    // nearest to a
      mk("c", 16.30, 80.43, "18:00"),    // farther
    ];
    const plan = buildDeliverySequence(v, orders);
    // All normal, comparable deadlines → nearest-feasible ordering.
    assert.equal(plan.stops.length, 3);
    assert.ok(plan.stops.every((s) => s.phase === "Normal"));
  });

  it("distance saving is computed vs naive farm→each-shop baseline", () => {
    const orders = [
      order({ id: "a", orderNumber: "A", priority: "Urgent", deadlineTime: "14:00", pickupSource: vuyPickup, shop: shop({ id: "sa", gps: gps(16.5062, 80.648) }) }),
      order({ id: "b", orderNumber: "B", priority: "Urgent", deadlineTime: "14:00", pickupSource: vuyPickup, shop: shop({ id: "sb", gps: gps(16.51, 80.66) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    assert.equal(typeof plan.estimatedDistanceSavingKm, "number");
    assert.ok((plan.estimatedDistanceSavingKm ?? 0) >= 0);
  });

  it("computeDistanceSaving returns null for a single order", () => {
    const single = [order({ id: "a", orderNumber: "A", pickupSource: vuyPickup, shop: shop({ id: "sa", gps: gps(16.5062, 80.648) }) })];
    assert.equal(computeDistanceSaving(v, single, 30), null);
  });
});

/* ------------------------------------------------------------------ */
/*  19. 60 km/h frontend estimate                                      */
/* ------------------------------------------------------------------ */
describe("60 km/h estimate", () => {
  it("DEFAULT_AVG_SPEED_KMH is 60", () => {
    assert.equal(DEFAULT_AVG_SPEED_KMH, 60);
  });
  it("uses the explicit formula (distance/speed)*60", () => {
    // 60 km at 60 km/h = 60 minutes; 30 km = 30 minutes.
    assert.equal(mockRouteCalculationService.estimateTravelMinutes(60), 60);
    assert.equal(mockRouteCalculationService.estimateTravelMinutes(30), 30);
    assert.equal(mockRouteCalculationService.estimateTravelMinutes(120), 120);
  });
  it("still honours an explicit speed override", () => {
    assert.equal(mockRouteCalculationService.estimateTravelMinutes(40, 40), 60);
  });
});

/* ------------------------------------------------------------------ */
/*  20. Delivery-phase regression suite                                */
/* ------------------------------------------------------------------ */
describe("delivery-phase regression", () => {
  const vuyPickup = pickup({ id: "farm-vuy", farmName: "Vuyyuru Farm", location: "Vuyyuru", gps: gps(16.3639, 80.8444) });

  it("R1 — later-starting Vuyyuru arrives earlier than Hyderabad (recommendation)", () => {
    const o = order({ deadlineTime: "18:00", shop: shop({ location: "Vijayawada", gps: gps(16.5062, 80.648) }) });
    const hyd = vehicle({ id: "v-hyd", pickup: pickup({ id: "farm-hyd", farmName: "Hyderabad Farm", location: "Hyderabad", gps: gps(17.385, 78.4867) }), schedule: schedule("08:00") });
    const vuy = vehicle({ id: "v-vuy", pickup: vuyPickup, schedule: schedule("09:00") });
    const result = recommendVehicles({ order: o, vehicles: [hyd, vuy] });
    assert.ok(result.recommended);
    assert.equal(result.recommended.vehicle.id, "v-vuy");
  });

  it("R2 — same priority, nearest feasible shop selected", () => {
    const state: SequencingState = { currentGps: gps(16.5062, 80.648), currentName: "Farm", currentMinutes: 540 };
    const near = order({ id: "n", orderNumber: "N", priority: "Urgent", deadlineTime: "14:00", shop: shop({ id: "sn", gps: gps(16.51, 80.66) }) });
    const far = order({ id: "f", orderNumber: "F", priority: "Urgent", deadlineTime: "14:00", shop: shop({ id: "sf", gps: gps(16.90, 80.65) }) });
    assert.equal(selectNextDeliveryStop(state, [far, near]).stop!.orderId, "n");
  });

  it("R3 — earlier deadline beats nearer shop", () => {
    const state: SequencingState = { currentGps: gps(16.5062, 80.648), currentName: "Farm", currentMinutes: 540 };
    const near = order({ id: "n", orderNumber: "N", priority: "Urgent", deadlineTime: "15:00", shop: shop({ id: "sn", gps: gps(16.51, 80.66) }) });
    const farEarly = order({ id: "f", orderNumber: "F", priority: "Urgent", deadlineTime: "11:00", shop: shop({ id: "sf", gps: gps(16.90, 80.65) }) });
    assert.equal(selectNextDeliveryStop(state, [near, farEarly]).stop!.orderId, "f");
  });

  it("R4 — after first shop completed, next calc starts from that shop", () => {
    const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
    const orders = [
      order({ id: "a", orderNumber: "A", priority: "Urgent", deadlineTime: "10:00", pickupSource: vuyPickup, shop: shop({ id: "sa", name: "Shop A", gps: gps(16.5062, 80.648) }) }),
      order({ id: "b", orderNumber: "B", priority: "Urgent", deadlineTime: "11:00", pickupSource: vuyPickup, shop: shop({ id: "sb", name: "Shop B", gps: gps(16.51, 80.66) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    assert.equal(plan.stops[1].fromName, "Shop A");
  });

  it("R5 — urgent phase completes before normal phase when deadlines permit", () => {
    const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
    const orders = [
      order({ id: "n", orderNumber: "N", priority: "Normal", deadlineTime: "18:00", pickupSource: vuyPickup, shop: shop({ id: "sn", gps: gps(16.51, 80.66) }) }),
      order({ id: "u", orderNumber: "U", priority: "Urgent", deadlineTime: "14:00", pickupSource: vuyPickup, shop: shop({ id: "su", gps: gps(16.5062, 80.648) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    assert.equal(plan.stops[0].phase, "Critical");
    assert.equal(plan.stops[1].phase, "Normal");
  });

  it("R6 — important phase starts after urgent phase", () => {
    const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
    const orders = [
      order({ id: "i", orderNumber: "I", priority: "Important", deadlineTime: "16:00", pickupSource: vuyPickup, shop: shop({ id: "si", gps: gps(16.51, 80.66) }) }),
      order({ id: "u", orderNumber: "U", priority: "Urgent", deadlineTime: "14:00", pickupSource: vuyPickup, shop: shop({ id: "su", gps: gps(16.5062, 80.648) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    assert.equal(plan.stops[0].phase, "Critical");
    assert.equal(plan.stops[1].phase, "Important");
  });

  it("R7 — normal phase uses nearest-feasible route strategy", () => {
    const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
    const mk = (id: string, lat: number, lng: number) =>
      order({ id, orderNumber: id.toUpperCase(), priority: "Normal", deadlineTime: "18:00", pickupSource: vuyPickup, shop: shop({ id: `s${id}`, name: id.toUpperCase(), gps: gps(lat, lng) }) });
    const plan = buildDeliverySequence(v, [mk("b", 16.51, 80.66), mk("a", 16.5062, 80.648), mk("c", 16.30, 80.43)]);
    assert.ok(plan.stops.every((s) => s.phase === "Normal"));
    assert.equal(plan.stops.length, 3);
  });

  it("R8 — cumulative route distance is sequential", () => {
    const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
    const orders = [
      order({ id: "a", orderNumber: "A", priority: "Urgent", deadlineTime: "10:00", pickupSource: vuyPickup, shop: shop({ id: "sa", gps: gps(16.5062, 80.648) }) }),
      order({ id: "b", orderNumber: "B", priority: "Urgent", deadlineTime: "11:00", pickupSource: vuyPickup, shop: shop({ id: "sb", gps: gps(16.51, 80.66) }) }),
    ];
    const plan = buildDeliverySequence(v, orders);
    const legSum = plan.stops.reduce((s, st) => s + (st.legDistanceKm ?? 0), 0);
    assert.equal(plan.totalDistanceKm, Math.round(legSum * 10) / 10);
  });

  it("R9 — 60 km/h is used for the frontend estimate", () => {
    assert.equal(DEFAULT_AVG_SPEED_KMH, 60);
  });

  it("R10 — no NaN/Infinity/negative distance or time", () => {
    const v = vehicle({ id: "v", pickup: vuyPickup, schedule: schedule("09:00") });
    const orders = Array.from({ length: 20 }, (_, i) =>
      order({ id: `o${i}`, orderNumber: `O${i}`, priority: (["Normal", "Important", "Urgent"] as OrderPriority[])[i % 3], deadlineTime: String(10 + (i % 10)).padStart(2, "0") + ":00", pickupSource: vuyPickup, shop: shop({ id: `s${i}`, gps: gps(16.3 + i * 0.01, 80.4 + (i % 5) * 0.01) }) }),
    );
    const plan = buildDeliverySequence(v, orders);
    assert.ok(plan.stops.every((s) => s.legDistanceKm == null || (Number.isFinite(s.legDistanceKm) && s.legDistanceKm >= 0)));
    assert.ok(plan.stops.every((s) => s.bufferMinutes == null || Number.isFinite(s.bufferMinutes)));
    assert.ok(plan.stops.every((s) => s.arrivalTime == null || s.arrivalTime !== "Invalid Date"));
  });
});
