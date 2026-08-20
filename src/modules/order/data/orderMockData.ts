// src/modules/order/data/orderMockData.ts
// -----------------------------------------------------------------------------
// ISOLATED demo data for the Order module (frontend-only task).
//
// This file is intentionally kept separate from production API services so a
// real backend can replace it later without touching the UI. None of the GPS
// coordinates below are presented as live telemetry — they are static demo
// values used to exercise the distance/priority/routing UI, and are always
// labelled as estimates in the interface.
// -----------------------------------------------------------------------------

import type { Address, GpsCoordinate, Order, OrderShop, PickupSource } from "../types/orderTypes";
import type { RouteVehicle } from "../types/routeTypes";

/* ------------------------------------------------------------------ */
/*  Coordinates (approximate, for demo distance estimates only)        */
/* ------------------------------------------------------------------ */
const coord = (
  latitude: number,
  longitude: number,
  accuracyMeters: number | null = 8,
  timestamp: string | null = "2026-08-20T09:00:00Z",
): GpsCoordinate => ({ latitude, longitude, accuracyMeters, timestamp });

/* Andhra Pradesh reference points. */
const GPS = {
  HYDERABAD: coord(17.385, 78.4867),
  ELURU: coord(16.7107, 81.0952),
  VUYYURU: coord(16.3639, 80.8444),
  GUNTUR: coord(16.3067, 80.4365),
  VIJAYAWADA: coord(16.5062, 80.648),
  GANNAVARAM: coord(16.5407, 80.802),
  GUDIVADA: coord(16.4355, 80.9955),
  MANGALAGIRI: coord(16.4349, 80.5706),
  TENALI: coord(16.2381, 80.6435),
} as const;

const addr = (line1: string, city: string, pinCode: string, district = "NTR District", state = "Andhra Pradesh"): Address => ({
  line1,
  city,
  district,
  state,
  pinCode,
});

/* ------------------------------------------------------------------ */
/*  Shops (with varied GPS states to exercise every UI branch)         */
/* ------------------------------------------------------------------ */
export const ORDER_SHOPS: OrderShop[] = [
  { id: "shop-vjw-01", name: "ABC Chicken Shop", location: "Vijayawada", address: addr("12-34, MG Road", "Vijayawada", "520001"), gps: GPS.VIJAYAWADA, gpsStatus: "Fresh" },
  { id: "shop-gnv-01", name: "Sri Venkateswara Poultry", location: "Gannavaram", address: addr("3-45, Main Bazaar", "Gannavaram", "521101", "Krishna District"), gps: GPS.GANNAVARAM, gpsStatus: "Fresh" },
  { id: "shop-gdv-01", name: "New Market Chicken", location: "Gudivada", address: addr("8-22, Market Road", "Gudivada", "521301", "Krishna District"), gps: GPS.GUDIVADA, gpsStatus: "Fresh" },
  { id: "shop-mgl-01", name: "Mangalagiri Broilers", location: "Mangalagiri", address: addr("5-18, Temple Street", "Mangalagiri", "522503", "Guntur District"), gps: GPS.MANGALAGIRI, gpsStatus: "Fresh" },
  { id: "shop-tnl-01", name: "Tenali Poultry Store", location: "Tenali", address: addr("9-11, Gandhi Chowk", "Tenali", "522201", "Guntur District"), gps: GPS.TENALI, gpsStatus: "Fresh" },
  { id: "shop-elu-01", name: "Eluru Chicken Mart", location: "Eluru", address: addr("2-7, Power Pet", "Eluru", "534002", "Eluru District"), gps: GPS.ELURU, gpsStatus: "Fresh" },
  { id: "shop-vuy-01", name: "Vuyyuru Fresh Birds", location: "Vuyyuru", address: addr("1-50, Bus Stand Road", "Vuyyuru", "521165", "Krishna District"), gps: GPS.VUYYURU, gpsStatus: "Fresh" },
  { id: "shop-gnt-01", name: "Guntur Poultry House", location: "Guntur", address: addr("7-31, Brodipet", "Guntur", "522002", "Guntur District"), gps: GPS.GUNTUR, gpsStatus: "Fresh" },
  { id: "shop-hyd-01", name: "Hyderabad Chicken Center", location: "Hyderabad", address: addr("4-88, Ameerpet", "Hyderabad", "500016", "Hyderabad District", "Telangana"), gps: GPS.HYDERABAD, gpsStatus: "Fresh" },
  { id: "shop-nogps-01", name: "Old City Chicken", location: "Vijayawada", address: addr("22-4, One Town", "Vijayawada", "520001"), gps: null, gpsStatus: "Unavailable" },
  { id: "shop-stale-01", name: "Rural Poultry Point", location: "Gudivada", address: addr("6-2, Canal Road", "Gudivada", "521301", "Krishna District"), gps: coord(16.4355, 80.9955, 30, "2026-08-19T07:30:00Z"), gpsStatus: "Stale" },
  { id: "shop-poor-01", name: "Canal Road Chicken", location: "Tenali", address: addr("11-9, Canal Road", "Tenali", "522201", "Guntur District"), gps: coord(16.2381, 80.6435, 250, "2026-08-20T08:45:00Z"), gpsStatus: "Poor Accuracy" },
];

/* ------------------------------------------------------------------ */
/*  Pickup farms — inherited from Trip Entry Step 2 (display only)     */
/* ------------------------------------------------------------------ */
export const ORDER_PICKUPS: PickupSource[] = [
  { id: "farm-hyd", farmName: "Hyderabad Farm", location: "Hyderabad", address: addr("Plot 12, Shamshabad", "Hyderabad", "500052", "Ranga Reddy District", "Telangana"), gps: GPS.HYDERABAD, gpsStatus: "Fresh", source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned" },
  { id: "farm-elu", farmName: "Eluru Farm", location: "Eluru", address: addr("D.No 45, Tangellamudi", "Eluru", "534005", "Eluru District"), gps: GPS.ELURU, gpsStatus: "Fresh", source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned" },
  { id: "farm-vuy", farmName: "Vuyyuru Farm", location: "Vuyyuru", address: addr("Katuru Road", "Vuyyuru", "521165", "Krishna District"), gps: GPS.VUYYURU, gpsStatus: "Fresh", source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned" },
  { id: "farm-gnt", farmName: "Guntur Farm", location: "Guntur", address: addr("Nallapadu", "Guntur", "522005", "Guntur District"), gps: GPS.GUNTUR, gpsStatus: "Fresh", source: "Trip Entry Step 2", tripNo: null, pickupStatus: "Assigned" },
];

/* ------------------------------------------------------------------ */
/*  Vehicles                                                           */
/* ------------------------------------------------------------------ */
export const ORDER_VEHICLES: RouteVehicle[] = [
  { id: "veh-01", vehicleNo: "AP 16 AB 1234", driverName: "Ravi", supervisorName: "Kumar", pickup: ORDER_PICKUPS[0], birdCapacity: 20000, boxCapacity: 200, available: true, assignedOrderCount: 0, schedule: { tripSubmittedTime: "08:00", loadingCompletionTime: "08:15", departureTime: "08:15" }, currentGps: GPS.HYDERABAD, currentGpsStatus: "Fresh", existingStopCities: [] },
  { id: "veh-02", vehicleNo: "AP 16 CD 5678", driverName: "Suresh", supervisorName: "Kumar", pickup: ORDER_PICKUPS[1], birdCapacity: 15000, boxCapacity: 150, available: true, assignedOrderCount: 0, schedule: { tripSubmittedTime: "08:15", loadingCompletionTime: "08:30", departureTime: "08:30" }, currentGps: GPS.ELURU, currentGpsStatus: "Fresh", existingStopCities: [] },
  { id: "veh-03", vehicleNo: "AP 16 EF 9012", driverName: "Venkat", supervisorName: "Prasad", pickup: ORDER_PICKUPS[2], birdCapacity: 12000, boxCapacity: 120, available: true, assignedOrderCount: 0, schedule: { tripSubmittedTime: "09:00", loadingCompletionTime: "09:10", departureTime: "09:10" }, currentGps: GPS.VUYYURU, currentGpsStatus: "Fresh", existingStopCities: [] },
  { id: "veh-04", vehicleNo: "AP 16 GH 3456", driverName: "Mahesh", supervisorName: "Prasad", pickup: ORDER_PICKUPS[3], birdCapacity: 18000, boxCapacity: 180, available: true, assignedOrderCount: 0, schedule: { tripSubmittedTime: "08:30", loadingCompletionTime: "08:45", departureTime: "08:45" }, currentGps: GPS.GUNTUR, currentGpsStatus: "Fresh", existingStopCities: [] },
  { id: "veh-05", vehicleNo: "AP 16 IJ 7890", driverName: "Anil", supervisorName: "Kumar", pickup: ORDER_PICKUPS[0], birdCapacity: 16000, boxCapacity: 160, available: true, assignedOrderCount: 0, schedule: { tripSubmittedTime: "08:45", loadingCompletionTime: "09:00", departureTime: "09:00" }, currentGps: GPS.HYDERABAD, currentGpsStatus: "Fresh", existingStopCities: [] },
  { id: "veh-06", vehicleNo: "AP 16 KL 1122", driverName: "Prakash", supervisorName: "Prasad", pickup: ORDER_PICKUPS[1], birdCapacity: 14000, boxCapacity: 140, available: false, assignedOrderCount: 0, schedule: { tripSubmittedTime: "09:00", loadingCompletionTime: "09:15", departureTime: "09:15" }, currentGps: GPS.ELURU, currentGpsStatus: "Fresh", existingStopCities: [] },
  { id: "veh-07", vehicleNo: "AP 16 MN 3344", driverName: "Ramesh", supervisorName: "Kumar", pickup: ORDER_PICKUPS[3], birdCapacity: 15000, boxCapacity: 150, available: true, assignedOrderCount: 0, schedule: { tripSubmittedTime: "09:10", loadingCompletionTime: "09:25", departureTime: "09:25" }, currentGps: GPS.GUNTUR, currentGpsStatus: "Fresh", existingStopCities: [] },
];

/* ------------------------------------------------------------------ */
/*  Seed orders covering every status / priority / GPS combination     */
/* ------------------------------------------------------------------ */
const iso = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
};

let seq = 0;
const order = (partial: Partial<Order> & Pick<Order, "shop" | "orderNumber">): Order => {
  seq += 1;
  const createdAt = new Date(Date.now() - seq * 3600_000).toISOString();
  return {
    id: `ord-${String(seq).padStart(3, "0")}`,
    birdType: "Broiler",
    requirementType: "Birds",
    birds: 0,
    boxes: 0,
    expectedWeightKg: null,
    remarks: "",
    priority: "Normal",
    importantCustomer: false,
    deliveryDate: iso(1),
    deadlineTime: "18:00",
    deadlineLabel: "Before 18:00",
    deliveryWindow: null,
    status: "Pending",
    pickupSource: null,
    vehicleAssignment: null,
    createdAt,
    updatedAt: createdAt,
    ...partial,
  };
};

export const ORDER_SEED: Order[] = [
  order({
    orderNumber: "ORD-1001",
    shop: ORDER_SHOPS[0],
    birdType: "Broiler",
    requirementType: "Birds",
    birds: 5000,
    priority: "Urgent",
    deadlineTime: "12:00",
    deadlineLabel: "Before 12:00",
    deliveryWindow: "09:00 – 12:00",
    status: "Assigned",
    pickupSource: ORDER_PICKUPS[2],
    vehicleAssignment: {
      vehicleId: "veh-03", vehicleNo: "AP 16 EF 9012", driverName: "Venkat", supervisorName: "Prasad",
      tripNo: "TRP-2041", pickupFarm: "Vuyyuru Farm", pickupLocation: "Vuyyuru", orderCount: 3,
      routeStatus: "Ready", departureTime: "09:10", assignmentType: "System Recommended",
    },
  }),
  order({
    orderNumber: "ORD-1002",
    shop: ORDER_SHOPS[1],
    birdType: "Layer",
    requirementType: "Birds",
    birds: 3000,
    priority: "Important",
    importantCustomer: true,
    deadlineTime: "14:00",
    deadlineLabel: "Before 14:00",
    status: "Assigned",
    pickupSource: ORDER_PICKUPS[2],
    vehicleAssignment: {
      vehicleId: "veh-03", vehicleNo: "AP 16 EF 9012", driverName: "Venkat", supervisorName: "Prasad",
      tripNo: "TRP-2041", pickupFarm: "Vuyyuru Farm", pickupLocation: "Vuyyuru", orderCount: 3,
      routeStatus: "Ready", departureTime: "09:10", assignmentType: "System Recommended",
    },
  }),
  order({
    orderNumber: "ORD-1003",
    shop: ORDER_SHOPS[2],
    birdType: "Broiler",
    requirementType: "Birds",
    birds: 2000,
    priority: "Normal",
    deadlineTime: "18:00",
    deadlineLabel: "Before 18:00",
    status: "Assigned",
    pickupSource: ORDER_PICKUPS[2],
    vehicleAssignment: {
      vehicleId: "veh-03", vehicleNo: "AP 16 EF 9012", driverName: "Venkat", supervisorName: "Prasad",
      tripNo: "TRP-2041", pickupFarm: "Vuyyuru Farm", pickupLocation: "Vuyyuru", orderCount: 3,
      routeStatus: "Ready", departureTime: "09:10", assignmentType: "Manually Assigned",
    },
  }),
  order({
    orderNumber: "ORD-1004",
    shop: ORDER_SHOPS[3],
    birdType: "Broiler",
    requirementType: "Birds + Boxes",
    birds: 4000,
    boxes: 40,
    expectedWeightKg: 8800,
    priority: "Important",
    importantCustomer: true,
    deadlineTime: "16:00",
    deadlineLabel: "Before 16:00",
    status: "In Transit",
    pickupSource: ORDER_PICKUPS[3],
    vehicleAssignment: {
      vehicleId: "veh-04", vehicleNo: "AP 16 GH 3456", driverName: "Mahesh", supervisorName: "Prasad",
      tripNo: "TRP-2042", pickupFarm: "Guntur Farm", pickupLocation: "Guntur", orderCount: 2,
      routeStatus: "In Transit", departureTime: "08:45", assignmentType: "System Recommended",
    },
  }),
  order({
    orderNumber: "ORD-1005",
    shop: ORDER_SHOPS[4],
    birdType: "Broiler",
    requirementType: "Boxes",
    boxes: 25,
    expectedWeightKg: 5500,
    priority: "Normal",
    deadlineTime: "18:00",
    deadlineLabel: "Before 18:00",
    status: "In Transit",
    pickupSource: ORDER_PICKUPS[3],
    vehicleAssignment: {
      vehicleId: "veh-04", vehicleNo: "AP 16 GH 3456", driverName: "Mahesh", supervisorName: "Prasad",
      tripNo: "TRP-2042", pickupFarm: "Guntur Farm", pickupLocation: "Guntur", orderCount: 2,
      routeStatus: "In Transit", departureTime: "08:45", assignmentType: "System Recommended",
    },
  }),
  order({
    orderNumber: "ORD-1006",
    shop: ORDER_SHOPS[5],
    birdType: "Layer",
    requirementType: "Birds",
    birds: 6000,
    priority: "Urgent",
    importantCustomer: true,
    deadlineTime: "10:00",
    deadlineLabel: "Before 10:00",
    status: "Awaiting Assignment",
    pickupSource: ORDER_PICKUPS[1],
  }),
  order({
    orderNumber: "ORD-1007",
    shop: ORDER_SHOPS[6],
    birdType: "Broiler",
    requirementType: "Birds",
    birds: 3500,
    priority: "Normal",
    deadlineTime: "18:00",
    deadlineLabel: "Before 18:00",
    status: "Awaiting Assignment",
    pickupSource: ORDER_PICKUPS[2],
  }),
  order({
    orderNumber: "ORD-1008",
    shop: ORDER_SHOPS[7],
    birdType: "Broiler",
    requirementType: "Birds",
    birds: 7000,
    priority: "Important",
    importantCustomer: true,
    deadlineTime: "14:00",
    deadlineLabel: "Before 14:00",
    status: "Pending",
  }),
  order({
    orderNumber: "ORD-1009",
    shop: ORDER_SHOPS[8],
    birdType: "Layer",
    requirementType: "Birds + Boxes",
    birds: 2500,
    boxes: 20,
    priority: "Normal",
    deadlineTime: "18:00",
    deadlineLabel: "Before 18:00",
    status: "Delivered",
    pickupSource: ORDER_PICKUPS[0],
    vehicleAssignment: {
      vehicleId: "veh-01", vehicleNo: "AP 16 AB 1234", driverName: "Ravi", supervisorName: "Kumar",
      tripNo: "TRP-2039", pickupFarm: "Hyderabad Farm", pickupLocation: "Hyderabad", orderCount: 1,
      routeStatus: "Completed", departureTime: "08:15", assignmentType: "System Recommended",
    },
  }),
  order({
    orderNumber: "ORD-1010",
    shop: ORDER_SHOPS[9],
    birdType: "Broiler",
    requirementType: "Birds",
    birds: 1500,
    priority: "Urgent",
    deadlineTime: "11:00",
    deadlineLabel: "Before 11:00",
    status: "Confirmed",
    remarks: "Shop GPS missing — verify address on site.",
  }),
  order({
    orderNumber: "ORD-1011",
    shop: ORDER_SHOPS[10],
    birdType: "Broiler",
    requirementType: "Birds",
    birds: 2200,
    priority: "Normal",
    deadlineTime: "18:00",
    deadlineLabel: "Before 18:00",
    status: "Draft",
    remarks: "Created from phone call, needs confirmation.",
  }),
  order({
    orderNumber: "ORD-1012",
    shop: ORDER_SHOPS[11],
    birdType: "Layer",
    requirementType: "Boxes",
    boxes: 18,
    priority: "Important",
    importantCustomer: true,
    deadlineTime: "15:00",
    deadlineLabel: "Before 15:00",
    status: "Confirmed",
    remarks: "GPS accuracy poor near canal road.",
  }),
];
