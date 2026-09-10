// scripts/dev-mock-backend.mjs
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  SAMPLE-DATA SERVER FOR PREVIEWS / DEMOS — NOT THE REAL ERP BACKEND ⚠️
//
// The real collection endpoints live in the separate DMR ERP backend (not in
// this repo). In hosted previews there is no backend to reach, so the
// Collection Report correctly shows its error state. Run this stub to explore
// the UI with deterministic sample data:
//
//   npm run mock:backend        # serves sample JSON on port 4000 (all interfaces)
//
// Served today: /api/health, /api/masters/{shops,employees,vehicles,farms,
// bird-types}, /api/trips (+ /api/trips/:id, POST /api/trips/:id/steps/deliveries
// for the Orders Collection / Assignment / Delivery Tracking page, and
// PATCH /api/trips/:id/status for the Draft→Pending→Completed lifecycle),
// and the /api/operations/collection-entry/* report endpoints. Vehicle
// responses also include 12 fictional EMI schedules for /fleet?tab=emi.
//
// FULL TRIP-ENTRY WIZARD (all 5 steps, in-memory persistence):
//   GET  /api/trips/available-resources        — Step 1 staff/vehicle dropdowns
//   GET  /api/trips/vehicle/:id/last-meter     — opening-KM hint
//   POST /api/trips/steps/start                — Step 1 submit (creates the trip)
//   POST /api/trips/:id/steps/start|farm|pickup|expenses
//                                              — Steps 1(re-edit)/2/3/5 save+submit
//   PUT  /api/trips/:id/deliveries             — Step 4 save (TripEditModal)
//   POST /api/trips/:id/diesel (+ PATCH/DELETE /:entryId) — Step 5 diesel rows
//   DELETE /api/trips/:id                      — Recent-table soft delete
// Trips 9301–9304 are Drafts parked right after steps 1/2/3/4 so the Recent
// Trips table shows a "Resume <step>" badge for every remaining step.
// The seeded trips include several COMPLETED ones with farm details
// (sourceFarm / totalBirds / dcWeight), full Step 2 farm data (address, meter,
// GPS) and DC weighbridge photos, so the Accounts → Farm Payment page and its
// trip-history modal show rich sample rows; complete the Pending TRP trip from
// Trip List to watch a newly completed trip appear there too.
//
// For REAL data, run the actual ERP backend on port 4000 instead — no config
// change needed (the Vite dev proxy targets 127.0.0.1:4000).
// ─────────────────────────────────────────────────────────────────────────────

import http from "node:http";
import { buildSampleEmiVehicles } from "./fixtures/emi-vehicles.mjs";

const PORT = Number(process.env.MOCK_BACKEND_PORT ?? 4000);

// ── Sample masters ───────────────────────────────────────────────────────────
const SHOPS = [
  { id: 1, shopNo: 1, shopNumber: "SHP-001", shopName: "Sri Balaji Poultry Traders", ownerName: "Ramesh K", city: "Hyderabad", status: "Active" },
  { id: 2, shopNo: 2, shopNumber: "SHP-002", shopName: "Venkatadri Egg Suppliers", ownerName: "Suresh M", city: "Hyderabad", status: "Active" },
  { id: 3, shopNo: 3, shopNumber: "SHP-003", shopName: "Annapurna Farms Outlet", ownerName: "Lakshmi D", city: "Secunderabad", status: "Active" },
  { id: 4, shopNo: 4, shopNumber: "SHP-004", shopName: "Kakatiya Poultry Point", ownerName: "Prasad R", city: "Warangal", status: "Active" },
];

const EMPLOYEES = [
  { id: 11, employeeNo: 11, employeeName: "Ravi Kumar", department: "Collection", role: "Collector", status: "Active" },
  { id: 12, employeeNo: 12, employeeName: "Srinivas G", department: "Collection", role: "Collector", status: "Active" },
  { id: 13, employeeNo: 13, employeeName: "Mohan Rao", department: "Collection", role: "Collector", status: "Active" },
  { id: 14, employeeNo: 14, employeeName: "Anil Chand", department: "Collection", role: "Collector", status: "Active" },
  { id: 21, employeeNo: 21, employeeName: "Imran S", department: "Driver", role: "Driver", status: "Active" },
  { id: 22, employeeNo: 22, employeeName: "Kiran P", department: "Driver", role: "Driver", status: "Active" },
  // Trip Entry Step 1 staff dropdowns (available-resources groups by department).
  { id: 31, employeeNo: 31, employeeName: "Ramesh N", department: "Supervisor", role: "Supervisor", status: "Active" },
  { id: 32, employeeNo: 32, employeeName: "Prakash V", department: "Supervisor", role: "Supervisor", status: "Active" },
  { id: 33, employeeNo: 33, employeeName: "Anand T", department: "Supervisor", role: "Supervisor", status: "Active" },
  { id: 41, employeeNo: 41, employeeName: "Naveen Kumar", department: "Helper", role: "Helper", status: "Active" },
  { id: 42, employeeNo: 42, employeeName: "Vinay Reddy", department: "Helper", role: "Helper", status: "Active" },
  { id: 43, employeeNo: 43, employeeName: "Mahesh Y", department: "Helper", role: "Helper", status: "Active" },
  { id: 51, employeeNo: 51, employeeName: "Malli", department: "Loader", role: "Loader", status: "Active" },
  { id: 52, employeeNo: 52, employeeName: "Basha", department: "Loader", role: "Loader", status: "Active" },
  { id: 53, employeeNo: 53, employeeName: "Raju", department: "Loader", role: "Loader", status: "Active" },
].map((e) => ({ phoneNumber: "", email: "", address: "", joiningDate: "2024-04-01", salary: 0, ...e }));

const COLLECTORS = EMPLOYEES.filter((e) => e.department === "Collection").map((e) => e.employeeName);
const MODES = ["Cash", "Union Bank", "HDFC Bank"]; // matches KNOWN_MODES display order

// ── Sample Farms + Bird Types (Trip Entry Step 2 dropdowns) ──────────────────
// ids 1–3 are the farms already referenced by the seeded trips below — do not
// renumber them. Shapes match mapFarm()/mapBirdType() in the masters services.
const FARMS = [
  { id: 1, farmNo: 1, farmName: "Sri Balaji Broiler Farm", ownerName: "Chandraiah M", supervisorName: "Ramesh N", phoneNumber: "9848011001", village: "Medchal", address: "Survey 42, Keesara Road, Medchal — 501401", capacity: 5000, status: "Active" },
  { id: 2, farmNo: 2, farmName: "Anand Agro Farms", ownerName: "Anand Rao K", supervisorName: "Prakash V", phoneNumber: "9848011002", village: "Yadadri", address: "Plot 7, Bhongir Road, Yadadri — 508116", capacity: 4000, status: "Active" },
  { id: 3, farmNo: 3, farmName: "Godavari Broiler Farm", ownerName: "Venkatanarayana P", supervisorName: "Anand T", phoneNumber: "9848011003", village: "Prattipadu", address: "Near Prattipadu Cross, Guntur District — 522019", capacity: 8000, status: "Active" },
  { id: 4, farmNo: 4, farmName: "Venkateswara Hatchery Farm", ownerName: "Subba Rao D", supervisorName: "Ramesh N", phoneNumber: "9848011004", village: "Keesara", address: "Plot 21, Keesara Gutta Road, Keesara — 501301", capacity: 3000, status: "Active" },
];

const BIRD_TYPES = [
  { id: 1, birdTypeNo: 1, birdType: "Broiler", averageWeight: 1.5, description: "Commercial broiler — standard catch", status: "Active" },
  { id: 2, birdTypeNo: 2, birdType: "Country Chicken", averageWeight: 1.8, description: "Nati / country chicken", status: "Active" },
  { id: 3, birdTypeNo: 3, birdType: "Layer", averageWeight: 1.6, description: "Spent layer hen", status: "Active" },
];

// ── Date helpers (local time, YYYY-MM-DD) ────────────────────────────────────
const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ── Deterministic pseudo-random (stable output across requests/restarts) ─────
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ── Sample collection rows for the last 45 days ──────────────────────────────
function buildRows() {
  const today = new Date();
  const rows = [];
  for (let back = 44; back >= 0; back--) {
    const date = iso(addDays(today, -back));
    const daySeed = Number(date.replaceAll("-", ""));
    SHOPS.forEach((shop, shopIdx) => {
      const rnd = seeded(daySeed * 31 + shopIdx * 7 + 5);
      const count = Math.floor(rnd() * 3); // 0–2 collections per shop/day
      for (let i = 0; i < count; i++) {
        rows.push({
          date,
          collectionNo: `COL-${date.replaceAll("-", "")}-${shop.id}${i + 1}`,
          shopId: shop.id,
          shopName: shop.shopName,
          collector: COLLECTORS[Math.floor(rnd() * COLLECTORS.length)],
          paymentMode: MODES[Math.floor(rnd() * MODES.length)],
          amount: Math.round((800 + rnd() * 5200) / 50) * 50,
        });
      }
    });
  }
  return rows;
}
const ROWS = buildRows();

// ── Report aggregation (mirrors the backend contract consumed by the UI) ─────
function buildReport(query) {
  const today = new Date();
  const day = (today.getDay() + 6) % 7; // Monday-start week
  const fromDate = query.get("fromDate") || iso(addDays(today, -day));
  const toDate = query.get("toDate") || iso(addDays(today, 6 - day));
  const shopId = query.get("shopId") ? Number(query.get("shopId")) : undefined;
  const collector = query.get("collector") || undefined;
  const paymentMode = query.get("paymentMode") || undefined;

  const filtered = ROWS.filter(
    (r) =>
      r.date >= fromDate &&
      r.date <= toDate &&
      (shopId === undefined || r.shopId === shopId) &&
      (collector === undefined || collector === "All Collectors" || r.collector === collector) &&
      (paymentMode === undefined || paymentMode === "All" || r.paymentMode === paymentMode)
  );

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
  const byMode = new Map();
  const byCollector = new Map();
  for (const r of filtered) {
    const m = byMode.get(r.paymentMode) ?? { count: 0, amount: 0, collectors: new Set() };
    m.count += 1;
    m.amount += r.amount;
    m.collectors.add(r.collector);
    byMode.set(r.paymentMode, m);

    const c = byCollector.get(r.collector) ?? { amounts: {}, total: 0 };
    c.amounts[r.paymentMode] = (c.amounts[r.paymentMode] ?? 0) + r.amount;
    c.total += r.amount;
    byCollector.set(r.collector, c);
  }

  const pct = (amount) => (totalAmount > 0 ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0);

  return {
    fromDate,
    toDate,
    totalAmount,
    totalCount: filtered.length,
    totalCollectors: byCollector.size,
    paymentModeSummary: MODES.filter((m) => byMode.has(m)).map((m) => ({
      paymentMode: m,
      count: byMode.get(m).count,
      amount: byMode.get(m).amount,
      percentage: pct(byMode.get(m).amount),
    })),
    collectorsByPaymentMode: MODES.filter((m) => byMode.has(m)).map((m) => ({
      paymentMode: m,
      collectorCount: byMode.get(m).collectors.size,
    })),
    collectorSummary: [...byCollector.entries()].map(([name, c]) => ({
      collector: name,
      amounts: c.amounts,
      total: c.total,
    })),
    _mock: true,
  };
}

// ── Sample Orders data: collection containers + vehicle trips ────────────────
// The Orders page (Order Collection / Order Assignment / Delivery Tracking)
// reads ONLY the existing /api/trips contract — there is no /api/orders
// endpoint in this frontend:
//   • ONE vehicle-less "container" trip per operational day holds that day's
//     collected order as `[ORDER]` plan rows (boxNo = ordered boxes);
//   • Order Assignment copies those rows onto a vehicle trip as
//     `[ORDER] O:<containerTripNo>`;
//   • Step 4 delivery rows (autoCaptureTime) are the delivery-progress truth.
// The store below is in-memory, so Save Progress / Finish actions persist for
// the lifetime of this stub server (restart = back to the seeded state).

const VEHICLES = buildSampleEmiVehicles();

const VEHICLE_BY_ID = new Map(VEHICLES.map((v) => [v.id, v]));

// ── Sample Fleet Maintenance records ─────────────────────────────────────────
// The real maintenance rows live in the separate ERP backend (PostgreSQL) and
// are reached at /api/fleet/maintenance. This stub seeds a few records so the
// Maintenance Entry (list) and Upcoming Service panels can be reviewed in a
// hosted preview without a backend.
//
// KEY IDEA: each record can list several maintenance types (comma-separated)
// AND a per-type next-service schedule (`nextServiceByType`). Every type keeps
// its OWN independent "next service" kilometre target, so the Upcoming Service
// panel shows one row per type — tyre change, oil change, brake change, etc.
// all surface together for a vehicle that was serviced for several things.

const daysAgo = (n) => iso(addDays(new Date(), -n));

const PART = (name, quantity, rate, specification = "") => ({
  name, specification, quantity, rate, amount: quantity * rate,
});

const MAINTENANCE = [
  // Vehicle 1 — three independent schedules: oil + filter + tyre rotation.
  {
    id: 1001, vehicleId: 1, vehicleNo: VEHICLE_BY_ID.get(1).vehicleNumber,
    date: `${daysAgo(15)}T09:30:00`, billNo: "MNT-20260825-001", currentKM: 54000,
    maintenanceType: "Engine Oil Change, Oil Filter Replacement",
    serviceType: "Preventive", garage: "Sri Balaji Garage", mechanic: "Ravi",
    driverId: 21, driverName: "Imran S",
    nextServiceKM: 59000,
    nextServiceByType: { "Engine Oil Change": 59000, "Oil Filter Replacement": 59000 },
    totalCost: 6400,
    parts: [PART("Engine Oil 15W40", 2, 2200, "OEM 15W40"), PART("Oil Filter", 1, 600, "OEM"), PART("Labour", 1, 1400)],
    remarks: "Routine oil service", paymentStatus: "approved",
    createdAt: `${daysAgo(15)}T10:00:00`, approvedAt: `${daysAgo(14)}T09:00:00`, approvedBy: "Owner", documents: [],
  },
  {
    id: 1002, vehicleId: 1, vehicleNo: VEHICLE_BY_ID.get(1).vehicleNumber,
    date: `${daysAgo(40)}T11:00:00`, billNo: "MNT-20260731-002", currentKM: 52000,
    maintenanceType: "Tyre Rotation",
    serviceType: "Preventive", garage: "Sri Balaji Garage", mechanic: "Ravi",
    driverId: 21, driverName: "Imran S",
    nextServiceKM: 56000,
    nextServiceByType: { "Tyre Rotation": 56000 },
    totalCost: 2200,
    parts: [PART("Tyre Rotation", 1, 1200), PART("Labour", 1, 1000)],
    remarks: "Rotated tyres front to rear", paymentStatus: "approved",
    createdAt: `${daysAgo(40)}T11:30:00`, approvedAt: `${daysAgo(39)}T09:00:00`, approvedBy: "Owner", documents: [],
  },

  // Vehicle 2 — brake due soon + a PENDING clutch job (must NOT appear upcoming).
  {
    id: 1003, vehicleId: 2, vehicleNo: VEHICLE_BY_ID.get(2).vehicleNumber,
    date: `${daysAgo(10)}T08:45:00`, billNo: "MNT-20260830-001", currentKM: 47000,
    maintenanceType: "Brake Service",
    serviceType: "Corrective", garage: "Venkatadri Garage", mechanic: "Suresh",
    driverId: 22, driverName: "Kiran P",
    nextServiceKM: 49000, nextServiceByType: { "Brake Service": 49000 },
    totalCost: 3800,
    parts: [PART("Brake Pads", 2, 1400, "OEM"), PART("Labour", 1, 1000)],
    remarks: "Front brake pads replaced", paymentStatus: "approved",
    createdAt: `${daysAgo(10)}T09:00:00`, approvedAt: `${daysAgo(9)}T09:00:00`, approvedBy: "Owner", documents: [],
  },
  {
    id: 1004, vehicleId: 2, vehicleNo: VEHICLE_BY_ID.get(2).vehicleNumber,
    date: `${daysAgo(3)}T10:15:00`, billNo: "MNT-20260906-002", currentKM: 48400,
    maintenanceType: "Clutch Plate Replacement",
    serviceType: "Corrective", garage: "Venkatadri Garage", mechanic: "Suresh",
    driverId: 22, driverName: "Kiran P",
    nextServiceKM: 58400, nextServiceByType: { "Clutch Plate Replacement": 58400 },
    totalCost: 9500,
    parts: [PART("Clutch Plate", 1, 7500, "OEM"), PART("Labour", 1, 2000)],
    remarks: "Awaiting approval", paymentStatus: "pending",
    createdAt: `${daysAgo(3)}T10:30:00`, documents: [],
  },

  // Vehicle 3 — brake OVERDUE (next target already passed).
  {
    id: 1005, vehicleId: 3, vehicleNo: VEHICLE_BY_ID.get(3).vehicleNumber,
    date: `${daysAgo(60)}T09:00:00`, billNo: "MNT-20260711-001", currentKM: 40000,
    maintenanceType: "Brake Service",
    serviceType: "Corrective", garage: "Annapurna Garage", mechanic: "Lakshmi",
    driverId: 21, driverName: "Imran S",
    nextServiceKM: 44000, nextServiceByType: { "Brake Service": 44000 },
    totalCost: 4100,
    parts: [PART("Brake Shoes", 4, 775, "OEM"), PART("Labour", 1, 1000)],
    remarks: "Brake shoes replaced", paymentStatus: "approved",
    createdAt: `${daysAgo(60)}T09:20:00`, approvedAt: `${daysAgo(59)}T09:00:00`, approvedBy: "Owner", documents: [],
  },

  // Vehicle 4 — safe / far from due.
  {
    id: 1006, vehicleId: 4, vehicleNo: VEHICLE_BY_ID.get(4).vehicleNumber,
    date: `${daysAgo(20)}T10:00:00`, billNo: "MNT-20260820-001", currentKM: 40000,
    maintenanceType: "Engine Oil Change",
    serviceType: "Preventive", garage: "Kakatiya Garage", mechanic: "Prasad",
    driverId: 22, driverName: "Kiran P",
    nextServiceKM: 50000, nextServiceByType: { "Engine Oil Change": 50000 },
    totalCost: 3200,
    parts: [PART("Engine Oil 15W40", 1, 2200, "OEM 15W40"), PART("Labour", 1, 1000)],
    remarks: "Oil change only", paymentStatus: "approved",
    createdAt: `${daysAgo(20)}T10:20:00`, approvedAt: `${daysAgo(19)}T09:00:00`, approvedBy: "Owner", documents: [],
  },

  // Vehicle 7 — two types with DIFFERENT next-service targets.
  {
    id: 1007, vehicleId: 7, vehicleNo: VEHICLE_BY_ID.get(7).vehicleNumber,
    date: `${daysAgo(25)}T09:40:00`, billNo: "MNT-20260815-001", currentKM: 60000,
    maintenanceType: "Tyre Rotation, Wheel Alignment",
    serviceType: "Preventive", garage: "Sri Balaji Garage", mechanic: "Ravi",
    driverId: 21, driverName: "Imran S",
    nextServiceKM: 66000,
    nextServiceByType: { "Tyre Rotation": 66000, "Wheel Alignment": 64000 },
    totalCost: 3000,
    parts: [PART("Tyre Rotation", 1, 1200), PART("Wheel Alignment", 1, 800), PART("Labour", 1, 1000)],
    remarks: "Tyres rotated, wheels aligned", paymentStatus: "approved",
    createdAt: `${daysAgo(25)}T10:00:00`, approvedAt: `${daysAgo(24)}T09:00:00`, approvedBy: "Owner", documents: [],
  },

  // Vehicle 8 — battery (safe) + a PENDING suspension job.
  {
    id: 1008, vehicleId: 8, vehicleNo: VEHICLE_BY_ID.get(8).vehicleNumber,
    date: `${daysAgo(12)}T11:10:00`, billNo: "MNT-20260828-001", currentKM: 50000,
    maintenanceType: "Battery Replacement",
    serviceType: "Corrective", garage: "Venkatadri Garage", mechanic: "Suresh",
    driverId: 22, driverName: "Kiran P",
    nextServiceKM: 65000, nextServiceByType: { "Battery Replacement": 65000 },
    totalCost: 7200,
    parts: [PART("Battery 130Ah", 1, 6500, "Exide"), PART("Labour", 1, 700)],
    remarks: "Battery replaced", paymentStatus: "approved",
    createdAt: `${daysAgo(12)}T11:30:00`, approvedAt: `${daysAgo(11)}T09:00:00`, approvedBy: "Owner", documents: [],
  },
  {
    id: 1009, vehicleId: 8, vehicleNo: VEHICLE_BY_ID.get(8).vehicleNumber,
    date: `${daysAgo(2)}T09:00:00`, billNo: "MNT-20260907-002", currentKM: 51800,
    maintenanceType: "Suspension Repair",
    serviceType: "Corrective", garage: "Venkatadri Garage", mechanic: "Suresh",
    driverId: 22, driverName: "Kiran P",
    nextServiceKM: 61800, nextServiceByType: { "Suspension Repair": 61800 },
    totalCost: 5200,
    parts: [PART("Shock Absorber", 2, 2100, "OEM"), PART("Labour", 1, 1000)],
    remarks: "Pending approval", paymentStatus: "pending",
    createdAt: `${daysAgo(2)}T09:15:00`, documents: [],
  },

  // Vehicle 6 — a soft-deleted record (appears only on the Deleted tab).
  {
    id: 1010, vehicleId: 6, vehicleNo: VEHICLE_BY_ID.get(6).vehicleNumber,
    date: `${daysAgo(90)}T10:00:00`, billNo: "MNT-20260611-001", currentKM: 24000,
    maintenanceType: "General Service",
    serviceType: "Preventive", garage: "Kakatiya Garage", mechanic: "Prasad",
    driverId: 21, driverName: "Imran S",
    nextServiceKM: 29000, nextServiceByType: { "General Service": 29000 },
    totalCost: 2800,
    parts: [PART("General Service", 1, 1800), PART("Consumables", 1, 1000)],
    remarks: "Removed (wrong vehicle)", paymentStatus: "approved",
    createdAt: `${daysAgo(90)}T10:20:00`, approvedAt: `${daysAgo(89)}T09:00:00`, approvedBy: "Owner",
    deletedAt: `${daysAgo(80)}T09:00:00`, documents: [],
  },
];

// Authoritative "current odometer" per vehicle (what /meter-summary serves).
// Chosen so the Upcoming Service panel shows due-soon, overdue and safe rows.
const VEHICLE_METERS = {
  1: 55800, 2: 48500, 3: 46000, 4: 41000, 5: 38000, 6: 29000,
  7: 61000, 8: 52000, 9: 33000, 10: 20500, 11: 47000, 12: 16000,
};

let nextMaintenanceId = 2000;

function listMaintenance(query) {
  let rows = MAINTENANCE.slice();
  const status = query.get("status");
  const includeDeleted = query.get("includeDeleted") === "true";
  const latestApproved = query.get("latestApproved") === "true";
  const vehicleId = query.get("vehicleId");
  const driverId = query.get("driverId");
  const fromDate = query.get("fromDate");
  const toDate = query.get("toDate");
  const search = (query.get("search") || "").trim().toLowerCase();

  if (!includeDeleted) rows = rows.filter((r) => !r.deletedAt);
  if (status) rows = rows.filter((r) => String(r.paymentStatus || "").toLowerCase() === status.toLowerCase());
  if (vehicleId) rows = rows.filter((r) => String(r.vehicleId) === String(vehicleId));
  if (driverId) rows = rows.filter((r) => String(r.driverId) === String(driverId));
  if (fromDate) rows = rows.filter((r) => (r.date || "").slice(0, 10) >= fromDate);
  if (toDate) rows = rows.filter((r) => (r.date || "").slice(0, 10) <= toDate);
  if (search) {
    rows = rows.filter((r) =>
      [r.billNo, r.vehicleNo, r.driverName, r.maintenanceType, r.serviceType, r.garage, r.mechanic, r.remarks]
        .join(" ").toLowerCase().includes(search)
    );
  }

  if (latestApproved) {
    const map = new Map();
    rows
      .filter((r) => String(r.paymentStatus || "").toLowerCase() === "approved")
      .forEach((r) => {
        const prev = map.get(String(r.vehicleId));
        if (!prev || new Date(r.date) > new Date(prev.date)) map.set(String(r.vehicleId), r);
      });
    rows = [...map.values()];
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return rows.map((r) => ({ ...r, _mock: true }));
}

/** Minimal multipart/form-data parser — returns text fields and file metadata. */
function readMultipart(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      const contentType = String(req.headers["content-type"] || "");
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : "";
      const fields = {};
      const files = [];
      if (boundary) {
        const delim = `--${boundary}`;
        const parts = buf.toString("latin1").split(delim);
        for (const raw of parts) {
          if (raw.includes("Content-Disposition")) {
            const headerEnd = raw.indexOf("\r\n\r\n");
            if (headerEnd === -1) continue;
            const header = raw.slice(0, headerEnd);
            const value = raw.slice(headerEnd + 4).replace(/\r\n$/, "").replace(/\r\n--$/, "");
            const nameMatch = header.match(/name="([^"]+)"/);
            const fileMatch = header.match(/filename="([^"]*)"/);
            if (!nameMatch) continue;
            const name = nameMatch[1];
            if (fileMatch && fileMatch[1]) {
              files.push({ name, filename: fileMatch[1], contentType: "", data: Buffer.from(value, "latin1") });
            } else {
              fields[name] = value;
            }
          }
        }
      }
      resolve({ fields, files });
    });
  });
}

function createMaintenance(fields) {
  const vehicleId = Number(fields.vehicleId) || 0;
  const vehicle = VEHICLE_BY_ID.get(vehicleId) || {};
  const today = new Date();
  const stamp = iso(today).replaceAll("-", "");
  const billNo = `MNT-${stamp}-${String(nextMaintenanceId).padStart(3, "0")}`;
  let maintenanceType = [];
  try { maintenanceType = JSON.parse(fields.maintenanceType || "[]"); } catch { /* ignore */ }
  let parts = [];
  try { parts = JSON.parse(fields.parts || "[]"); } catch { /* ignore */ }
  let nextServiceByType = {};
  try { nextServiceByType = JSON.parse(fields.nextServiceByType || "{}"); } catch { /* ignore */ }
  const firstType = Array.isArray(maintenanceType) ? maintenanceType[0] : undefined;
  const record = {
    id: nextMaintenanceId++,
    vehicleId,
    vehicleNo: vehicle.vehicleNumber || "",
    date: fields.date || iso(today),
    billNo,
    currentKM: Number(fields.currentKM) || 0,
    maintenanceType: Array.isArray(maintenanceType) ? maintenanceType.join(", ") : String(maintenanceType || ""),
    serviceType: fields.serviceType || "General",
    garage: fields.garage || "",
    mechanic: fields.mechanic || "",
    driverId: Number(fields.driverId) || 0,
    driverName: fields.driverName || "",
    nextServiceKM: firstType && nextServiceByType[firstType] != null ? nextServiceByType[firstType] : (Number(fields.nextServiceKM) || 0),
    nextServiceByType,
    totalCost: parts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    parts,
    remarks: fields.remarks || "",
    paymentStatus: "pending",
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
    documents: [],
  };
  MAINTENANCE.push(record);
  return record;
}

// ── Farm (Step 2) sample details + DC weighbridge photo ─────────────────────
// The Accounts → Farm Payment trip-history modal opens on Step 2 (Farm), so
// the sample trips carry full farm details and a DC photo (a deterministic
// SVG "weighbridge slip" rendered as an image data URL — no binary assets).

/** Deterministic weighbridge-slip SVG as an image data URL. */
function dcPhotoSvg({ tripNo, farm, weightKg, date, slip = 1 }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <rect width="640" height="400" fill="#f8fafc"/>
  <rect x="16" y="16" width="608" height="368" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="16" y="16" width="608" height="64" rx="18" fill="#0f766e"/>
  <text x="40" y="46" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">DMR POULTRIES — WEIGHBRIDGE SLIP</text>
  <text x="40" y="68" font-family="Arial, sans-serif" font-size="12" fill="#ccfbf1">DC Weight Proof · Slip ${slip} of 2</text>
  <line x1="40" y1="110" x2="600" y2="110" stroke="#e2e8f0" stroke-width="2"/>
  <text x="40" y="145" font-family="Arial, sans-serif" font-size="14" fill="#64748b">TRIP NO</text>
  <text x="220" y="145" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">${tripNo}</text>
  <text x="40" y="180" font-family="Arial, sans-serif" font-size="14" fill="#64748b">FARM</text>
  <text x="220" y="180" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">${farm}</text>
  <text x="40" y="215" font-family="Arial, sans-serif" font-size="14" fill="#64748b">DATE</text>
  <text x="220" y="215" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">${date}</text>
  <rect x="40" y="245" width="560" height="90" rx="14" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text x="70" y="283" font-family="Arial, sans-serif" font-size="14" fill="#64748b">GROSS DC WEIGHT</text>
  <text x="70" y="318" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#0f766e">${weightKg} kg</text>
  <text x="600" y="360" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">SAMPLE DATA — mock backend</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Step 2 (Farm) + Step 3 (Pickup) fields shared by every vehicle trip below. */
function farmStepDetails({ farm, address, destMeter, reachedTime, loadTime, tolls, avgBirdWeight, gps, tripNo, weightKg, birds, date }) {
  // Step 3: boxes of ~100 birds each, weights derived from the DC weight.
  const boxCount = Math.max(1, Math.ceil(birds / 100));
  const baseBirds = Math.floor(birds / boxCount);
  const extra = birds % boxCount;
  const perBirdKg = birds > 0 ? weightKg / birds : 0;
  const boxDetails = Array.from({ length: boxCount }, (_, i) => {
    const boxBirds = baseBirds + (i < extra ? 1 : 0);
    return {
      boxNo: i + 1,
      birds: boxBirds,
      weight: Number((boxBirds * perBirdKg).toFixed(2)),
      avgWeight: Number(perBirdKg.toFixed(3)),
    };
  });
  return {
    farmAddress: address,
    destMeter,
    reachedTime,
    pickupTolls: tolls,
    avgBirdWeight,
    farmGpsLat: gps[0],
    farmGpsLon: gps[1],
    farmGpsAccuracy: 8,
    farmGpsTime: `${date}T${reachedTime}:00`,
    pickupLoadTime: loadTime,
    boxes: boxCount,
    boxDetails,
    // Lets the read-only StepPickup view show "boxes / capacity" cleanly
    // instead of falling back to a vehicle-master lookup.
    vehicleBoxCapacity: 12,
    dcPhotoKey: `dc_photo_${tripNo}_1`,
    dcPhotoMime: "image/svg+xml",
    dcPhotoData: dcPhotoSvg({ tripNo, farm, weightKg, date, slip: 1 }),
    dcPhotoKey2: `dc_photo_${tripNo}_2`,
    dcPhotoMime2: "image/svg+xml",
    dcPhotoData2: dcPhotoSvg({ tripNo, farm, weightKg: (weightKg * 0.98).toFixed(0), date, slip: 2 }),
  };
}

/** One Orders plan row (`[ORDER]` marker, boxNo = boxes). */
function planRow(serialNo, shopId, boxes, birds, over = {}) {  const shop = SHOPS.find((s) => s.id === shopId) ?? { shopName: `Shop ${shopId}` };
  const weight = Number((birds * 1.5).toFixed(2));
  return {
    id: serialNo,
    clientKey: `mock-row-${shopId}-${serialNo}`,
    serialNo,
    shopId,
    shopName: shop.shopName,
    birdTypeId: null,
    birdType: "",
    birds,
    weight,
    mortality: 0,
    mortKg: 0,
    rate: null,
    amount: 0,
    remarks: "[ORDER]",
    deliveryMode: "box",
    boxNo: boxes,
    selectedBoxIds: [],
    farmBirds: birds,
    farmWeight: weight,
    autoCaptureTime: null,
    ...over,
  };
}

function baseTrip(over) {
  return {
    status: "Draft",
    startTime: "",
    vehicleId: 0,
    vehicleNo: "",
    driverId: 0,
    driverName: "",
    supervisorId: 0,
    supervisorName: "",
    helpers: [],
    loaders: [],
    startStepSubmitted: false,
    farmStepSubmitted: false,
    pickupStepSubmitted: false,
    deliveryStepSubmitted: false,
    endStepSubmitted: false,
    expensesStepSubmitted: false,
    remarks: "",
    avgBirdWeight: 1.5,
    deliveries: [],
    deleted: false,
    _mock: true,
    ...over,
  };
}

/** Seed the Orders scenario: yesterday fully assigned + tracked, today open. */
function buildTrips() {
  const now = new Date();
  const today = iso(now);
  const yesterday = iso(addDays(now, -1));
  const stamp = (d) => d.replaceAll("-", "");
  const ordToday = `ORD-${stamp(today)}-01`;
  const ordYest = `ORD-${stamp(yesterday)}-01`;
  const ref = (tripNo) => `[ORDER] O:${tripNo}`;

  return [
    // ── TODAY: collection container still being filled (Tab 1 working sheet) ──
    baseTrip({
      id: 9001,
      tripNo: ordToday,
      tripDate: today,
      deliveries: [planRow(1, 1, 40, 400), planRow(2, 2, 25, 250)],
    }),
    // ── YESTERDAY: container finished (Tab 2 source, Tab 1 locked history) ───
    baseTrip({
      id: 9002,
      tripNo: ordYest,
      tripDate: yesterday,
      startStepSubmitted: true,
      deliveries: [
        planRow(1, 1, 50, 500),
        planRow(2, 2, 30, 300),
        planRow(3, 3, 20, 200),
        planRow(4, 4, 15, 150),
      ],
    }),
    // ── Vehicle 1: shops 1 + 2 assigned, shop 1 already delivered ────────────
    // (Pending — complete it from Trip List to watch it appear on Farm Payment)
    baseTrip({
      id: 9101,
      tripNo: `TRP-${stamp(yesterday)}-01`,
      tripDate: yesterday,
      status: "Pending",
      vehicleId: 1,
      vehicleNo: VEHICLE_BY_ID.get(1).vehicleNumber,
      driverName: "Imran S",
      supervisorName: "Ravi Kumar",
      sourceFarmId: 1,
      sourceFarm: "Sri Balaji Broiler Farm",
      totalBirds: 800,
      dcWeight: 1200,
      ...farmStepDetails({
        farm: "Sri Balaji Broiler Farm",
        address: "Survey 42, Keesara Road, Medchal — 501401",
        destMeter: 1840,
        reachedTime: "06:35",
        loadTime: "07:20",
        tolls: 150,
        avgBirdWeight: 1.5,
        gps: [17.4849, 78.6033],
        tripNo: `TRP-${stamp(yesterday)}-01`,
        weightKg: 1200,
        birds: 800,
        date: yesterday,
      }),
      startStepSubmitted: true,
      farmStepSubmitted: true,
      pickupStepSubmitted: true,
      deliveryStepSubmitted: true,
      deliveries: [
        planRow(1, 1, 50, 500, {
          remarks: ref(ordYest),
          autoCaptureTime: `${yesterday}T09:15:00`,
        }),
        planRow(2, 2, 30, 300, { remarks: ref(ordYest) }),
      ],
    }),
    // ── Vehicle 2: shops 3 + 4 assigned and fully delivered (Completed) ──────
    baseTrip({
      id: 9102,
      tripNo: `TRP-${stamp(yesterday)}-02`,
      tripDate: yesterday,
      status: "Completed",
      vehicleId: 2,
      vehicleNo: VEHICLE_BY_ID.get(2).vehicleNumber,
      driverName: "Kiran P",
      supervisorName: "Srinivas G",
      sourceFarmId: 2,
      sourceFarm: "Anand Agro Farms",
      totalBirds: 350,
      dcWeight: 525,
      approvedBy: "Owner",
      ...farmStepDetails({
        farm: "Anand Agro Farms",
        address: "Plot 7, Bhongir Road, Yadadri — 508116",
        destMeter: 3265,
        reachedTime: "07:10",
        loadTime: "08:05",
        tolls: 200,
        avgBirdWeight: 1.5,
        gps: [17.5151, 78.6497],
        tripNo: `TRP-${stamp(yesterday)}-02`,
        weightKg: 525,
        birds: 350,
        date: yesterday,
      }),
      startStepSubmitted: true,
      farmStepSubmitted: true,
      pickupStepSubmitted: true,
      deliveryStepSubmitted: true,
      endStepSubmitted: true,
      deliveries: [
        planRow(1, 3, 20, 200, {
          remarks: ref(ordYest),
          autoCaptureTime: `${yesterday}T10:40:00`,
        }),
        planRow(2, 4, 15, 150, {
          remarks: ref(ordYest),
          autoCaptureTime: `${yesterday}T11:25:00`,
        }),
      ],
    }),
    // ── Vehicle 3: Step 2 done, nothing delivered → free for assignment ──────
    baseTrip({
      id: 9103,
      tripNo: `TRP-${stamp(today)}-01`,
      tripDate: today,
      vehicleId: 3,
      vehicleNo: VEHICLE_BY_ID.get(3).vehicleNumber,
      driverName: "Imran S",
      supervisorName: "Mohan Rao",
      startStepSubmitted: true,
      farmStepSubmitted: true,
    }),
    // ── Completed trips (fully approved, all wizard steps submitted) ─────────
    // These are what the Accounts → Farm Payment page lists: status Completed,
    // not deleted, pickup step submitted. Plain delivery rows (no `[ORDER]`
    // remarks) so the Orders scenario above is unaffected.
    ...buildCompletedFarmTrips({ stamp }),

    // ── Trip-Entry walkthrough: one Draft parked right after each wizard step ─
    // 9301 → resume Step 2 (Farm), 9302 → Step 3 (Pickup), 9303 → Step 4
    // (Deliveries), 9304 → Step 5 (End/Expenses). Plain remarks (no "[ORDER]")
    // so the Orders scenario above is completely untouched.
    ...buildWalkthroughTrips({ stamp, today, yesterday }),
  ];
}

/** Draft trips parked after each submitted wizard step (Step 2 → Step 5 resume
 *  badges in the Recent Trips table). New ids only — never touches the seeded
 *  Orders/Farm-Payment trips above. */
function buildWalkthroughTrips({ stamp, today, yesterday }) {
  const veh = (id) => VEHICLE_BY_ID.get(id)?.vehicleNumber ?? "";
  const step1Defaults = {
    startStepSubmitted: true,
    helpers: ["Naveen Kumar"],
    loaders: ["Malli", "Basha"],
    advanceAmount: 500,
    remarks: "Walkthrough sample — resume the next wizard step",
  };
  return [
    // 9301 · Step 1 submitted → Recent badge "Resume: Farm Details (Step 2)"
    baseTrip({
      ...step1Defaults,
      id: 9301,
      tripNo: `TRP-${stamp(today)}-02`,
      tripDate: today,
      vehicleId: 6,
      vehicleNo: veh(6),
      driverId: 21,
      driverName: "Imran S",
      supervisorId: 31,
      supervisorName: "Ramesh N",
      openingMeter: 29150,
    }),
    // 9302 · Steps 1–2 submitted → "Resume: Pickup Details (Step 3)"
    baseTrip({
      ...step1Defaults,
      id: 9302,
      tripNo: `TRP-${stamp(today)}-03`,
      tripDate: today,
      vehicleId: 5,
      vehicleNo: veh(5),
      driverId: 22,
      driverName: "Kiran P",
      supervisorId: 32,
      supervisorName: "Prakash V",
      openingMeter: 38120,
      advanceAmount: 750,
      // Sample capacity so Resume-Step-3 can add boxes without a vehicle-
      // master cache (0/unknown would show the box-limit-reached blocker).
      vehicleBoxCapacity: 30,
      helpers: ["Vinay Reddy"],
      loaders: ["Raju"],
      sourceFarmId: 3,
      sourceFarm: "Godavari Broiler Farm",
      birdTypeId: 1,
      birdType: "Broiler",
      farmBirdTypeId: 1,
      farmBirdType: "Broiler",
      farmAddress: "Near Prattipadu Cross, Guntur District — 522019",
      destMeter: 38610,
      pickupTolls: 240,
      avgBirdWeight: 1.52,
      farmGpsLat: 16.3067,
      farmGpsLon: 80.4365,
      farmGpsAccuracy: 9,
      farmGpsTime: `${today}T06:55:00`,
      farmStepSubmitted: true,
    }),
    // 9303 · Steps 1–3 submitted (boxes + DC photos loaded) →
    // "Resume: Deliveries (Step 4)" — Step 4 can allocate these boxes to shops.
    baseTrip({
      ...step1Defaults,
      id: 9303,
      tripNo: `TRP-${stamp(yesterday)}-03`,
      tripDate: yesterday,
      vehicleId: 4,
      vehicleNo: veh(4),
      driverId: 21,
      driverName: "Imran S",
      supervisorId: 31,
      supervisorName: "Ramesh N",
      openingMeter: 41100,
      sourceFarmId: 1,
      sourceFarm: "Sri Balaji Broiler Farm",
      birdTypeId: 1,
      birdType: "Broiler",
      farmBirdTypeId: 1,
      farmBirdType: "Broiler",
      totalBirds: 520,
      dcWeight: 780,
      pickupStepSubmitted: true,
      ...farmStepDetails({
        farm: "Sri Balaji Broiler Farm",
        address: "Survey 42, Keesara Road, Medchal — 501401",
        destMeter: 41510,
        reachedTime: "06:45",
        loadTime: "07:30",
        tolls: 160,
        avgBirdWeight: 1.5,
        gps: [17.4849, 78.6033],
        tripNo: `TRP-${stamp(yesterday)}-03`,
        weightKg: 780,
        birds: 520,
        date: yesterday,
      }),
      // Roomy sample capacity for box-add testing (farmStepDetails default is 12).
      vehicleBoxCapacity: 30,
      farmStepSubmitted: true,
    }),
    // 9304 · Steps 1–4 submitted (shops 1+3 delivered with rates) →
    // "Resume: End Trip / Expenses (Step 5)" — closing meter, tolls, meals.
    baseTrip({
      ...step1Defaults,
      id: 9304,
      tripNo: `TRP-${stamp(yesterday)}-04`,
      tripDate: yesterday,
      vehicleId: 12,
      vehicleNo: veh(12),
      driverId: 22,
      driverName: "Kiran P",
      supervisorId: 33,
      supervisorName: "Anand T",
      openingMeter: 16150,
      sourceFarmId: 2,
      sourceFarm: "Anand Agro Farms",
      birdTypeId: 1,
      birdType: "Broiler",
      farmBirdTypeId: 1,
      farmBirdType: "Broiler",
      totalBirds: 420,
      dcWeight: 640,
      pickupStepSubmitted: true,
      deliveryStepSubmitted: true,
      ...farmStepDetails({
        farm: "Anand Agro Farms",
        address: "Plot 7, Bhongir Road, Yadadri — 508116",
        destMeter: 16560,
        reachedTime: "07:05",
        loadTime: "07:50",
        tolls: 180,
        avgBirdWeight: 1.5,
        gps: [17.5151, 78.6497],
        tripNo: `TRP-${stamp(yesterday)}-04`,
        weightKg: 640,
        birds: 420,
        date: yesterday,
      }),
      vehicleBoxCapacity: 30,
      farmStepSubmitted: true,
      deliveries: [
        planRow(1, 1, 30, 300, {
          remarks: "",
          rate: 78.5,
          amount: 35325,
          autoCaptureTime: `${yesterday}T09:05:00`,
        }),
        planRow(2, 3, 18, 120, {
          remarks: "",
          rate: 77,
          amount: 13860,
          autoCaptureTime: `${yesterday}T10:15:00`,
        }),
      ],
    }),
  ];
}

/** Completed trips with farm details for the Farm Payment page sample data. */
function buildCompletedFarmTrips({ stamp }) {
  const on = (offset) => iso(addDays(new Date(), offset));
  // Plain delivery rows — remarks must NOT start with "[ORDER]" (that marker
  // is reserved for Orders-module rows and would pollute its classification).
  const rows = (shopIds, date, startHour) =>
    shopIds.map((shopId, i) =>
      planRow(i + 1, shopId, 20 + i * 10, 200 + i * 100, {
        remarks: "",
        autoCaptureTime: `${date}T${String(startHour + i).padStart(2, "0")}:10:00`,
      })
    );

  // Generated completed history (every other day over the past ~3 weeks) so
  // the Farm Payment page's pagination has real pages to page through.
  const FARMS = [
    { id: 1, name: "Sri Balaji Broiler Farm", address: "Survey 42, Keesara Road, Medchal — 501401", gps: [17.4849, 78.6033], tolls: 150 },
    { id: 2, name: "Anand Agro Farms", address: "Plot 7, Bhongir Road, Yadadri — 508116", gps: [17.5151, 78.6497], tolls: 200 },
    { id: 3, name: "Godavari Broiler Farm", address: "Near Prattipadu Cross, Guntur District — 522019", gps: [16.3067, 80.4365], tolls: 300 },
  ];
  const DRIVERS = ["Imran S", "Kiran P"];
  const SUPERVISORS = ["Ravi Kumar", "Srinivas G", "Mohan Rao"];
  const generated = [];
  let genId = 9110;
  for (let back = 8; back <= 26; back += 2) {
    const date = on(-back);
    const farm = FARMS[(back / 2 - 4) % FARMS.length];
    const birds = 300 + ((back * 37) % 6) * 100; // 300–800, deterministic
    const weightKg = Math.round(birds * 1.5);
    const vehicleId = ((back / 2 - 4) % 6) + 7; // vehicles 7–12
    const vehicle = VEHICLE_BY_ID.get(vehicleId);
    const tripNo = `TRP-${stamp(date)}-0${(back / 2 - 3) % 9 || 1}`;
    generated.push(
      baseTrip({
        id: genId++,
        tripNo,
        tripDate: date,
        status: "Completed",
        vehicleId,
        vehicleNo: vehicle ? vehicle.vehicleNumber : `AP 16 TS ${4000 + vehicleId}`,
        driverName: DRIVERS[back % DRIVERS.length],
        supervisorName: SUPERVISORS[(back / 2) % SUPERVISORS.length],
        sourceFarmId: farm.id,
        sourceFarm: farm.name,
        totalBirds: birds,
        dcWeight: weightKg,
        approvedBy: "Owner",
        ...farmStepDetails({
          farm: farm.name,
          address: farm.address,
          destMeter: 1500 + back * 90,
          reachedTime: `0${5 + (back % 3)}:${back % 2 ? "15" : "45"}`,
          loadTime: `0${6 + (back % 3)}:${back % 2 ? "05" : "35"}`,
          tolls: farm.tolls,
          avgBirdWeight: 1.5,
          gps: farm.gps,
          tripNo,
          weightKg,
          birds,
          date,
        }),
        startStepSubmitted: true,
        farmStepSubmitted: true,
        pickupStepSubmitted: true,
        deliveryStepSubmitted: true,
        endStepSubmitted: true,
        deliveries: rows([1 + (back % 4), 2 + (back % 3), 4], date, 8),
      })
    );
  }

  return [
    baseTrip({
      id: 9104,
      tripNo: `TRP-${stamp(on(-2))}-03`,
      tripDate: on(-2),
      status: "Completed",
      vehicleId: 4,
      vehicleNo: VEHICLE_BY_ID.get(4).vehicleNumber,
      driverName: "Kiran P",
      supervisorName: "Ravi Kumar",
      sourceFarmId: 1,
      sourceFarm: "Sri Balaji Broiler Farm",
      totalBirds: 480,
      dcWeight: 720,
      approvedBy: "Owner",
      ...farmStepDetails({
        farm: "Sri Balaji Broiler Farm",
        address: "Survey 42, Keesara Road, Medchal — 501401",
        destMeter: 2115,
        reachedTime: "06:50",
        loadTime: "07:40",
        tolls: 150,
        avgBirdWeight: 1.5,
        gps: [17.4849, 78.6033],
        tripNo: `TRP-${stamp(on(-2))}-03`,
        weightKg: 720,
        birds: 480,
        date: on(-2),
      }),
      startStepSubmitted: true,
      farmStepSubmitted: true,
      pickupStepSubmitted: true,
      deliveryStepSubmitted: true,
      endStepSubmitted: true,
      deliveries: rows([1, 2], on(-2), 9),
    }),
    baseTrip({
      id: 9105,
      tripNo: `TRP-${stamp(on(-4))}-01`,
      tripDate: on(-4),
      status: "Completed",
      vehicleId: 5,
      vehicleNo: VEHICLE_BY_ID.get(5).vehicleNumber,
      driverName: "Imran S",
      supervisorName: "Srinivas G",
      sourceFarmId: 3,
      sourceFarm: "Godavari Broiler Farm",
      totalBirds: 620,
      dcWeight: 930,
      approvedBy: "Owner",
      ...farmStepDetails({
        farm: "Godavari Broiler Farm",
        address: "Near Prattipadu Cross, Guntur District — 522019",
        destMeter: 4480,
        reachedTime: "05:55",
        loadTime: "06:45",
        tolls: 300,
        avgBirdWeight: 1.5,
        gps: [16.3067, 80.4365],
        tripNo: `TRP-${stamp(on(-4))}-01`,
        weightKg: 930,
        birds: 620,
        date: on(-4),
      }),
      startStepSubmitted: true,
      farmStepSubmitted: true,
      pickupStepSubmitted: true,
      deliveryStepSubmitted: true,
      endStepSubmitted: true,
      deliveries: rows([1, 3, 4], on(-4), 8),
    }),
    baseTrip({
      id: 9106,
      tripNo: `TRP-${stamp(on(-6))}-02`,
      tripDate: on(-6),
      status: "Completed",
      vehicleId: 6,
      vehicleNo: VEHICLE_BY_ID.get(6).vehicleNumber,
      driverName: "Kiran P",
      supervisorName: "Mohan Rao",
      sourceFarmId: 2,
      sourceFarm: "Anand Agro Farms",
      totalBirds: 300,
      dcWeight: 450,
      approvedBy: "Owner",
      ...farmStepDetails({
        farm: "Anand Agro Farms",
        address: "Plot 7, Bhongir Road, Yadadri — 508116",
        destMeter: 3970,
        reachedTime: "07:25",
        loadTime: "08:15",
        tolls: 200,
        avgBirdWeight: 1.5,
        gps: [17.5151, 78.6497],
        tripNo: `TRP-${stamp(on(-6))}-02`,
        weightKg: 450,
        birds: 300,
        date: on(-6),
      }),
      startStepSubmitted: true,
      farmStepSubmitted: true,
      pickupStepSubmitted: true,
      deliveryStepSubmitted: true,
      endStepSubmitted: true,
      deliveries: rows([2, 4], on(-6), 10),
    }),
    ...generated,
  ];
}

const TRIPS = buildTrips();
// 9301–9304 are the seeded walkthrough Drafts; server-created trips start above them.
let nextTripId = 9400;

/** Persist a Step-4-shaped deliveries payload onto a trip (creates a container
 *  when id is 0 — the Orders Collection "Save Progress" first write). */
function applyDeliveriesPayload(tripId, body) {
  let trip = TRIPS.find((t) => t.id === Number(tripId));
  if (!trip) {
    const now = new Date();
    trip = baseTrip({
      id: nextTripId++,
      tripNo: String(body.tripNo ?? `ORD-${iso(now).replaceAll("-", "")}-01`),
      tripDate: iso(now),
    });
    TRIPS.push(trip);
  }
  const rows = Array.isArray(body.deliveries) ? body.deliveries : [];
  trip.deliveries = rows.map((row, index) => ({
    mortality: 0,
    mortKg: 0,
    amount: 0,
    deliveryMode: "box",
    autoCaptureTime: null,
    ...row,
    id: index + 1,
    serialNo: Number(row.serialNo) || index + 1,
    boxNo: Number(row.boxNo) || 0,
    selectedBoxIds: Array.isArray(row.selectedBoxIds) ? row.selectedBoxIds : [],
  }));
  if (body.startStepSubmitted === true) trip.startStepSubmitted = true;
  if (body.mode === "submit") trip.deliveryStepSubmitted = true;
  if (typeof body.remarks === "string") trip.remarks = body.remarks;
  return trip;
}

// ── Trip Entry wizard helpers (Steps 1–5) ────────────────────────────────────
// Every setter tolerates missing/blank body fields, so a Save Progress call
// never blanks previously stored data (COALESCE-like, same contract idea as
// the ERP backend).

const numOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const nowHm = () => new Date().toTimeString().slice(0, 5);

/** Step 1 — create the trip (POST /api/trips/steps/start). */
function createTripFromStep1(body) {
  const now = new Date();
  const tripDate =
    typeof body.tripDate === "string" && body.tripDate ? body.tripDate.slice(0, 10) : iso(now);
  const seq =
    TRIPS.filter((t) => t.tripDate === tripDate && String(t.tripNo || "").startsWith("TRP-")).length + 1;
  const vehicleId = Number(body.vehicleId) || 0;
  const trip = baseTrip({
    id: nextTripId++,
    tripNo: `TRP-${tripDate.replaceAll("-", "")}-${String(seq).padStart(2, "0")}`,
    tripDate,
    startTime: `${tripDate}T${nowHm()}:00`,
    vehicleId,
    vehicleNo: body.vehicleNo || VEHICLE_BY_ID.get(vehicleId)?.vehicleNumber || "",
    driverId: Number(body.driverId) || 0,
    driverName: String(body.driverName ?? ""),
    supervisorId: Number(body.supervisorId) || 0,
    supervisorName: String(body.supervisorName ?? ""),
    openingMeter: numOrNull(body.openingMeter),
    advanceAmount: numOrNull(body.advanceAmount),
    helpers: Array.isArray(body.helpers) ? body.helpers : [],
    loaders: Array.isArray(body.loaders) ? body.loaders : [],
    remarks: String(body.remarks ?? ""),
    // Sample capacity for Step 3 (Pickup): new trips inherit the vehicle
    // master's box capacity so box adding never starts at a 0/unknown limit.
    vehicleBoxCapacity: VEHICLE_BY_ID.get(vehicleId)?.noOfBoxes || 0,
    startStepSubmitted: true,
  });
  TRIPS.push(trip);
  return decorateTrip(trip);
}

/** Step 1 re-edit on an existing trip (POST /api/trips/:id/steps/start). */
function applyStartStep(trip, body) {
  if (typeof body.tripDate === "string" && body.tripDate) trip.tripDate = body.tripDate.slice(0, 10);
  const vehicleId = Number(body.vehicleId) || 0;
  if (vehicleId) trip.vehicleId = vehicleId;
  if (body.vehicleNo) trip.vehicleNo = String(body.vehicleNo);
  else if (vehicleId && VEHICLE_BY_ID.get(vehicleId)) trip.vehicleNo = VEHICLE_BY_ID.get(vehicleId).vehicleNumber;
  // Keep the sample box capacity in sync when the vehicle changes/re-picks.
  if (vehicleId && VEHICLE_BY_ID.get(vehicleId)?.noOfBoxes) {
    trip.vehicleBoxCapacity = VEHICLE_BY_ID.get(vehicleId).noOfBoxes;
  }
  if (body.driverId != null) trip.driverId = Number(body.driverId) || 0;
  if (body.driverName != null) trip.driverName = String(body.driverName);
  if (body.supervisorId != null) trip.supervisorId = Number(body.supervisorId) || 0;
  if (body.supervisorName != null) trip.supervisorName = String(body.supervisorName);
  const opening = numOrNull(body.openingMeter);
  if (opening !== null) trip.openingMeter = opening;
  const advance = numOrNull(body.advanceAmount);
  if (advance !== null) trip.advanceAmount = advance;
  if (Array.isArray(body.helpers)) trip.helpers = body.helpers;
  if (Array.isArray(body.loaders)) trip.loaders = body.loaders;
  if (body.remarks != null) trip.remarks = String(body.remarks);
  if (body.mode === "submit" || body.startStepSubmitted === true) {
    trip.startStepSubmitted = true;
    if (!trip.startTime) trip.startTime = `${trip.tripDate}T${nowHm()}:00`;
  }
  return trip;
}

/** Step 2 — Farm details (POST /api/trips/:id/steps/farm, mode save|submit). */
function applyFarmStep(trip, body) {
  const farmId = Number(body.sourceFarmId) || 0;
  const farm = FARMS.find((f) => f.id === farmId);
  if (farmId) {
    trip.sourceFarmId = farmId;
    trip.sourceFarm = body.sourceFarm || farm?.farmName || trip.sourceFarm;
  }
  if (body.farmAddress != null && body.farmAddress !== "") trip.farmAddress = String(body.farmAddress);
  else if (farm && !trip.farmAddress) trip.farmAddress = farm.address;
  const destMeter = numOrNull(body.destMeter);
  if (destMeter !== null) trip.destMeter = destMeter;
  if (body.pickupTolls != null && body.pickupTolls !== "") trip.pickupTolls = Number(body.pickupTolls) || 0;
  const avg = numOrNull(body.avgBirdWeight);
  if (avg !== null) trip.avgBirdWeight = avg;
  if (body.farmBirdTypeId) {
    trip.birdTypeId = Number(body.farmBirdTypeId);
    trip.birdType = body.farmBirdType || BIRD_TYPES.find((b) => b.id === Number(body.farmBirdTypeId))?.birdType || "";
    trip.farmBirdTypeId = trip.birdTypeId;
    trip.farmBirdType = trip.birdType;
  }
  if (body.remarks != null && body.remarks !== "") trip.remarks = String(body.remarks);
  const lat = numOrNull(body.farmGpsLat);
  const lon = numOrNull(body.farmGpsLon);
  if (lat !== null && lon !== null) {
    trip.farmGpsLat = lat;
    trip.farmGpsLon = lon;
    trip.farmGpsAccuracy = numOrNull(body.farmGpsAccuracy);
    trip.farmGpsTime = body.farmGpsTime || null;
  }
  if (body.mode === "submit") trip.farmStepSubmitted = true;
  return trip;
}

/** Step 3 — Pickup boxes + DC photos (POST /api/trips/:id/steps/pickup). */
function applyPickupStep(trip, body) {
  if (Array.isArray(body.removedBoxNos) && body.removedBoxNos.length) {
    const removed = new Set(body.removedBoxNos.map(Number));
    trip.boxDetails = (trip.boxDetails || []).filter((b) => !removed.has(Number(b.boxNo)));
  }
  if (Array.isArray(body.boxDetails)) {
    const incoming = body.boxDetails
      .map((b) => ({ boxNo: Number(b.boxNo) || 0, birds: Number(b.birds) || 0, weight: Number(b.weight) || 0 }))
      .sort((a, b) => a.boxNo - b.boxNo);
    if (body.pickupBoxWrite === "upsert") {
      const byNo = new Map((trip.boxDetails || []).map((b) => [Number(b.boxNo), b]));
      for (const b of incoming) byNo.set(b.boxNo, { ...(byNo.get(b.boxNo) || {}), ...b });
      trip.boxDetails = [...byNo.values()].sort((a, b) => a.boxNo - b.boxNo);
    } else {
      trip.boxDetails = incoming;
    }
  }
  for (const key of ["dcPhotoKey", "dcPhotoMime", "dcPhotoData", "dcPhotoKey2", "dcPhotoMime2", "dcPhotoData2"]) {
    if (body[key] != null && body[key] !== "") trip[key] = body[key];
  }
  if ((trip.boxDetails || []).length) {
    const totals = trip.boxDetails.reduce(
      (acc, b) => ({ birds: acc.birds + (Number(b.birds) || 0), weight: acc.weight + (Number(b.weight) || 0) }),
      { birds: 0, weight: 0 }
    );
    trip.boxes = trip.boxDetails.length;
    trip.totalBirds = totals.birds;
    trip.dcWeight = Math.round(totals.weight * 100) / 100;
    trip.avgWeight = totals.birds > 0 ? Math.round((totals.weight / totals.birds) * 1000) / 1000 : 0;
  }
  if (body.mode === "submit") trip.pickupStepSubmitted = true;
  return trip;
}

/** Step 5 — End Trip / expenses (POST /api/trips/:id/steps/expenses). */
function applyExpensesStep(trip, body) {
  if (body.remarks != null && body.remarks !== "") trip.remarks = String(body.remarks);
  for (const key of ["meals", "loading", "mealsTiffin", "vehicleMaintenance", "othersRC", "others1Amt", "others2Amt", "others3Amt", "others4Amt", "others5Amt"]) {
    if (body[key] != null && body[key] !== "") trip[key] = Number(body[key]) || 0;
  }
  const endMeter = numOrNull(body.endMeter ?? body.closingMeter);
  if (endMeter !== null) trip.closingMeter = endMeter;
  const tolls = numOrNull(body.destinationTolls ?? body.deliveryTolls);
  if (tolls !== null) {
    trip.deliveryTolls = tolls;
    trip.destinationTolls = tolls;
  }
  if (body.endTime != null && body.endTime !== "") trip.endTime = String(body.endTime);
  if (body.mode === "submit") {
    if (!trip.endTime) trip.endTime = `${trip.tripDate}T${nowHm()}:00`;
    if (!trip.closingMeter && trip.destMeter) trip.closingMeter = trip.destMeter;
    trip.endStepSubmitted = true;
    trip.expensesStepSubmitted = true;
    trip.expensesStepSubmittedAt = new Date().toISOString();
    trip.submittedAtTimestamp = trip.expensesStepSubmittedAt;
  }
  return trip;
}

/** Step 5 diesel ledger (POST /api/trips/:id/diesel). */
function applyDieselCreate(trip, body) {
  const litres = numOrNull(body.litres);
  const rate = numOrNull(body.rate);
  const entry = {
    id: (trip.dieselEntries || []).reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1,
    rowIndex: (trip.dieselEntries || []).length,
    litres,
    rate,
    amount: litres != null && rate != null ? Math.round(litres * rate * 100) / 100 : null,
    meter: numOrNull(body.meter),
    bunkName: body.bunkName || null,
    gpsLat: numOrNull(body.gpsLat),
    gpsLon: numOrNull(body.gpsLon),
    gpsAccuracy: numOrNull(body.gpsAccuracy),
    gpsCapturedAt: body.gpsCapturedAt || null,
    imageData: body.imageData || null,
    imageName: body.imageName || null,
    submitted: true,
    submittedAt: new Date().toISOString(),
    clientKey: body.clientKey || null,
  };
  trip.dieselEntries = [...(trip.dieselEntries || []), entry];
  return trip;
}

/** Fill the derived summary columns the ERP backend computes on read. Never
 *  mutates stored state — used only for GET/step responses. */
function decorateTrip(trip) {
  const deliveries = Array.isArray(trip.deliveries) ? trip.deliveries : [];
  const delivered = deliveries.filter((d) => d.autoCaptureTime);
  const totalDeliveredWeight = delivered.reduce((s, d) => s + (Number(d.weight) || 0), 0);
  const totalMortalityCount = delivered.reduce((s, d) => s + (Number(d.mortality) || 0), 0);
  const totalMortalityWeight = delivered.reduce((s, d) => s + (Number(d.mortKg) || 0), 0);
  const meters = [trip.openingMeter, trip.destMeter, trip.closingMeter]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const kmSpread = meters.length >= 2 ? Math.max(...meters) - Math.min(...meters) : 0;
  return {
    ...trip,
    totalKm: Number(trip.totalKm) || kmSpread,
    totalShops: Number(trip.totalShops) || new Set(delivered.map((d) => d.shopId)).size,
    totalWeight: Number(trip.totalWeight) || Number(trip.dcWeight) || 0,
    totalDeliveredWeight: Number(trip.totalDeliveredWeight) || totalDeliveredWeight,
    totalBirdsDelivered:
      Number(trip.totalBirdsDelivered) || delivered.reduce((s, d) => s + (Number(d.birds) || 0), 0),
    totalMortality: Number(trip.totalMortality) || totalMortalityWeight,
    totalMortalityCount,
    totalMortalityWeight,
    weightLoss: Number(trip.weightLoss) || (delivered.length ? Math.max(0, (Number(trip.dcWeight) || 0) - totalDeliveredWeight) : 0),
    survivalRate:
      Number(trip.survivalRate) ||
      (trip.totalBirds ? Math.round(((trip.totalBirds - totalMortalityCount) / trip.totalBirds) * 1000) / 10 : 0),
    lastShop: trip.lastShop || (delivered.length ? delivered[delivered.length - 1].shopName : ""),
    updatedAt: trip.updatedAt || new Date().toISOString(),
    _mock: true,
  };
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (!url.pathname.startsWith("/api/")) {
    return send(404, { error: "not_found", mock: true });
  }

  // Orders persistence: POST /api/trips/:id/steps/deliveries
  // (id 0 = create the day's collection container; mode save | submit)
  const stepMatch = url.pathname.match(/^\/api\/trips\/(\d+)\/steps\/deliveries$/);
  if (stepMatch && req.method === "POST") {
    readJsonBody(req).then((body) => send(200, decorateTrip(applyDeliveriesPayload(stepMatch[1], body))));
    return;
  }

  // PATCH /api/trips/:id/status — backend-authoritative status transition
  // (Draft → Pending, Pending → Completed), same contract as the ERP backend.
  // This is what the Trip List / Recent Trips "approve" action calls; a trip
  // completed here immediately becomes eligible for the Farm Payment page.
  const statusMatch = url.pathname.match(/^\/api\/trips\/(\d+)\/status$/);
  if (statusMatch && req.method === "PATCH") {
    readJsonBody(req).then((body) => {
      const trip = TRIPS.find((t) => t.id === Number(statusMatch[1]));
      if (!trip) {
        return send(404, { error: "trip_not_found", id: Number(statusMatch[1]), mock: true });
      }
      const next = body.status;
      const valid =
        (trip.status === "Draft" && next === "Pending") ||
        (trip.status === "Pending" && next === "Completed");
      if (!valid) {
        return send(422, { error: "invalid_status_transition", from: trip.status, to: next, mock: true });
      }
      trip.status = next;
      if (next === "Completed") trip.approvedBy = typeof body.approvedBy === "string" ? body.approvedBy : "Owner";
      return send(200, trip);
    });
    return;
  }

  // ── Trip Entry wizard (Steps 1–5) ─────────────────────────────────────────
  // POST /api/trips/steps/start — Step 1 submit; creates the trip and returns
  // the new record (the wizard continues with Steps 2–5 against this id).
  if (url.pathname === "/api/trips/steps/start" && req.method === "POST") {
    readJsonBody(req).then((body) => send(200, createTripFromStep1(body)));
    return;
  }

  // POST /api/trips/available-resources is read-only; served in the GET section
  // below (Step 1 staff/vehicle dropdowns). Steps 2/3/5 + Step 1 re-edit:
  const wizardStepMatch = url.pathname.match(/^\/api\/trips\/(\d+)\/steps\/(start|farm|pickup|expenses)$/);
  if (wizardStepMatch && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const trip = TRIPS.find((t) => t.id === Number(wizardStepMatch[1]));
      if (!trip) {
        return send(404, { error: "trip_not_found", id: Number(wizardStepMatch[1]), mock: true });
      }
      if (wizardStepMatch[2] === "start") applyStartStep(trip, body);
      else if (wizardStepMatch[2] === "farm") applyFarmStep(trip, body);
      else if (wizardStepMatch[2] === "pickup") applyPickupStep(trip, body);
      else applyExpensesStep(trip, body);
      trip.updatedAt = new Date().toISOString();
      return send(200, decorateTrip(trip));
    });
    return;
  }

  // Step 5 diesel ledger: POST /api/trips/:id/diesel (+ PATCH/DELETE entry).
  const dieselMatch = url.pathname.match(/^\/api\/trips\/(\d+)\/diesel$/);
  if (dieselMatch && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const trip = TRIPS.find((t) => t.id === Number(dieselMatch[1]));
      if (!trip) return send(404, { error: "trip_not_found", id: Number(dieselMatch[1]), mock: true });
      applyDieselCreate(trip, body);
      trip.updatedAt = new Date().toISOString();
      return send(200, decorateTrip(trip));
    });
    return;
  }
  const dieselEntryMatch = url.pathname.match(/^\/api\/trips\/(\d+)\/diesel\/(\d+)$/);
  if (dieselEntryMatch && (req.method === "PATCH" || req.method === "DELETE")) {
    readJsonBody(req).then((body) => {
      const trip = TRIPS.find((t) => t.id === Number(dieselEntryMatch[1]));
      const entryId = Number(dieselEntryMatch[2]);
      if (!trip) return send(404, { error: "trip_not_found", id: Number(dieselEntryMatch[1]), mock: true });
      const entries = trip.dieselEntries || [];
      const existing = entries.find((e) => Number(e.id) === entryId);
      if (!existing) return send(404, { error: "diesel_entry_not_found", id: entryId, mock: true });
      if (req.method === "DELETE") {
        trip.dieselEntries = entries.filter((e) => Number(e.id) !== entryId);
      } else {
        Object.assign(existing, body, { id: existing.id });
      }
      trip.updatedAt = new Date().toISOString();
      return send(200, decorateTrip(trip));
    });
    return;
  }

  // PUT /api/trips/:id/deliveries — Step 4 save from TripEditModal.
  const deliveriesPutMatch = url.pathname.match(/^\/api\/trips\/(\d+)\/deliveries$/);
  if (deliveriesPutMatch && req.method === "PUT") {
    readJsonBody(req).then((body) => {
      const trip = TRIPS.find((t) => t.id === Number(deliveriesPutMatch[1]));
      if (!trip) return send(404, { error: "trip_not_found", id: Number(deliveriesPutMatch[1]), mock: true });
      applyDeliveriesPayload(trip.id, body);
      trip.updatedAt = new Date().toISOString();
      return send(200, decorateTrip(trip));
    });
    return;
  }

  // DELETE /api/trips/:id — Recent-table soft delete (reason via query/body).
  const singleTrip = url.pathname.match(/^\/api\/trips\/(\d+)$/);
  if (singleTrip && req.method === "DELETE") {
    const trip = TRIPS.find((t) => t.id === Number(singleTrip[1]));
    if (!trip) return send(404, { error: "trip_not_found", id: Number(singleTrip[1]), mock: true });
    trip.deleted = true;
    trip.status = "Deleted";
    trip.deletedReason = url.searchParams.get("reason") || "";
    return send(200, { id: trip.id, deleted: true, mock: true });
  }
  if (singleTrip && req.method === "GET") {
    const trip = TRIPS.find((t) => t.id === Number(singleTrip[1]));
    return trip
      ? send(200, decorateTrip(trip))
      : send(404, { error: "trip_not_found", id: Number(singleTrip[1]), mock: true });
  }

  // ⚠️  SAMPLE-ONLY dev stub for the Shops location-capture flow.
  // The production resolver lives in backend/src/utils/geoResolve.ts; this
  // stub parses Google Maps URLs locally (no network, deterministic) and
  // falls back to fixed Hyderabad coordinates for free-text input.
  if (url.pathname === "/api/masters/resolve-location" && req.method === "POST") {
    readJsonBody(req).then((body) => {
      const input = typeof body.input === "string" ? body.input.trim() : "";
      if (!input) {
        return send(422, {
          error: "Paste a Google Maps link or an address to capture the location.",
          mock: true,
        });
      }
      const at = input.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
      const d34 = input.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      const seg = input.match(/\/(?:place|search)\/([^/?#]+)/);
      const name = seg ? decodeURIComponent(seg[1].replace(/\+/g, " ")).trim() : "";
      const lat = at ? parseFloat(at[1]) : d34 ? parseFloat(d34[1]) : 17.385;
      const lng = at ? parseFloat(at[2]) : d34 ? parseFloat(d34[2]) : 78.4867;
      return send(200, {
        latitude: lat,
        longitude: lng,
        address: name || `Sample resolved: ${input}`,
        mock: true,
      });
    });
    return;
  }

  // ── Fleet Maintenance (sample) ────────────────────────────────────────────
  // GET /api/fleet/maintenance — list (filters: status, latestApproved,
  // includeDeleted, vehicleId, driverId, fromDate, toDate, search).
  if (url.pathname === "/api/fleet/maintenance" && req.method === "GET") {
    return send(200, listMaintenance(url.searchParams));
  }

  // POST /api/fleet/maintenance — create (multipart form-data).
  if (url.pathname === "/api/fleet/maintenance" && req.method === "POST") {
    readMultipart(req).then(({ fields }) => send(200, { ...createMaintenance(fields), _mock: true }));
    return;
  }

  // POST /api/fleet/maintenance/:id/approve
  const approveMatch = url.pathname.match(/^\/api\/fleet\/maintenance\/(\d+)\/approve$/);
  if (approveMatch && req.method === "POST") {
    const record = MAINTENANCE.find((r) => r.id === Number(approveMatch[1]));
    if (!record) return send(404, { error: "not_found", mock: true });
    record.paymentStatus = "approved";
    record.approvedAt = new Date().toISOString();
    record.approvedBy = "system";
    return send(200, { ...record, _mock: true });
  }

  // DELETE /api/fleet/maintenance/:id — soft delete.
  const deleteMaintenanceMatch = url.pathname.match(/^\/api\/fleet\/maintenance\/(\d+)$/);
  if (deleteMaintenanceMatch && req.method === "DELETE") {
    const record = MAINTENANCE.find((r) => r.id === Number(deleteMaintenanceMatch[1]));
    if (!record) return send(404, { error: "not_found", mock: true });
    record.deletedAt = new Date().toISOString();
    return send(200, { ...record, _mock: true });
  }

  // GET /api/fleet/vehicles/meter-summary — authoritative odometer per vehicle.
  if (url.pathname === "/api/fleet/vehicles/meter-summary" && req.method === "GET") {
    const summary = VEHICLES.map((v) => ({
      vehicleId: v.id,
      vehicleNo: v.vehicleNumber,
      meter: Math.max(Number(VEHICLE_METERS[v.id] || 0), ...MAINTENANCE.filter((m) => m.vehicleId === v.id && !m.deletedAt).map((m) => Number(m.currentKM) || 0), 0),
    }));
    return send(200, summary);
  }

  // GET /api/fleet/vehicles/:id/meter-history — trip/fuel meter events (the
  // maintenance timeline also pulls these; empty is fine for the sample).
  const meterHistoryMatch = url.pathname.match(/^\/api\/fleet\/vehicles\/(\d+)\/meter-history$/);
  if (meterHistoryMatch && req.method === "GET") {
    return send(200, []);
  }

  if (req.method !== "GET") {
    return send(404, { error: "not_found", mock: true });
  }

  switch (url.pathname) {
    case "/api/health":
      return send(200, { status: "ok", mock: true });
    case "/api/masters/shops":
      return send(200, SHOPS.map((s) => ({ phoneNumber: "", email: "", address: "", paperRate: 0, associationType: "", openingBalance: 0, currentBalance: 0, secondaryPhoneNumber: "", latitude: null, longitude: null, ...s, _mock: true })));
    case "/api/masters/vehicles":
      return send(200, VEHICLES.map((v) => ({ ...v, _mock: true })));
    case "/api/masters/employees":
      return send(200, EMPLOYEES.map((e) => ({ ...e, _mock: true })));
    case "/api/masters/farms":
      return send(200, FARMS.map((f) => ({ ...f, _mock: true })));
    case "/api/masters/bird-types":
      return send(200, BIRD_TYPES.map((b) => ({ ...b, _mock: true })));
    case "/api/trips":
      return send(200, TRIPS.map(decorateTrip));
    case "/api/trips/available-resources": {
      // Step 1 dropdowns (AvailableTripResources contract).
      const byDept = (dept) =>
        EMPLOYEES.filter((e) => e.department === dept && e.status === "Active").map(
          ({ id, employeeName, department }) => ({ id, employeeName, department })
        );
      return send(200, {
        vehicles: VEHICLES.map((v) => ({ id: v.id, vehicleNumber: v.vehicleNumber })),
        drivers: byDept("Driver"),
        supervisors: byDept("Supervisor"),
        helpers: byDept("Helper"),
        loaders: byDept("Loader"),
        _mock: true,
      });
    }

    case "/api/operations/collection-entry/week-bounds": {
      const today = new Date();
      const day = (today.getDay() + 6) % 7;
      return send(200, {
        asOfDate: iso(today),
        weekStart: iso(addDays(today, -day)),
        weekEnd: iso(addDays(today, 6 - day)),
        isCurrentWeek: true,
        _mock: true,
      });
    }
    case "/api/operations/collection-entry/report":
      return send(200, buildReport(url.searchParams));
    case "/api/operations/collection-entry/recent": {
      const shopId = Number(url.searchParams.get("shopId"));
      const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 500);
      if (!Number.isFinite(shopId) || shopId <= 0) return send(200, []);
      const rows = ROWS.filter((r) => r.shopId === shopId)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.collectionNo.localeCompare(a.collectionNo)
        )
        .slice(0, limit)
        .map((r, idx) => ({
          id: shopId * 10000 + idx,
          collectionNo: r.collectionNo,
          collectionDate: r.date,
          shopId: r.shopId,
          shopName: r.shopName,
          amount: r.amount,
          collector: r.collector,
          paymentMode: r.paymentMode,
          status: "Approved",
          canDelete: true,
          _mock: true,
        }));
      return send(200, rows);
    }
    default: {
      // GET /api/trips/vehicle/:id/last-meter — opening-KM validation hint
      // (highest known odometer reading for the vehicle across all trips).
      const lastMeterMatch = url.pathname.match(/^\/api\/trips\/vehicle\/(\d+)\/last-meter$/);
      if (lastMeterMatch) {
        const vehicleId = Number(lastMeterMatch[1]);
        const excludeTripId = Number(url.searchParams.get("excludeTripId")) || 0;
        let best = null;
        for (const t of TRIPS) {
          if (t.vehicleId !== vehicleId || t.id === excludeTripId) continue;
          for (const [meter, source] of [
            [t.closingMeter, "TRIP_END"],
            [t.destMeter, "TRIP_END"],
            [t.openingMeter, "TRIP_START"],
          ]) {
            const n = Number(meter);
            if (Number.isFinite(n) && n > 0 && (!best || n > best.closingMeter)) {
              best = { closingMeter: n, tripNo: t.tripNo, tripDate: t.tripDate, source };
            }
          }
        }
        return send(200, best);
      }
      return send(404, { error: "not_found", path: url.pathname, mock: true });
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mock-backend] ⚠️  SAMPLE DATA ONLY — listening on http://0.0.0.0:${PORT}`);
  console.log(`[mock-backend] ${ROWS.length} sample collection rows over the last 45 days`);
  console.log(`[mock-backend] ${VEHICLES.length} sample EMI vehicles — open /fleet?tab=emi in the frontend preview`);
  console.log(`[mock-backend] ${MAINTENANCE.length} sample maintenance records — open /fleet?tab=maintenance in the frontend preview`);
  console.log(`[mock-backend] Trip-Entry walkthrough Drafts 9301–9304 — Recent Trips → Resume Steps 2/3/4/5 (or start a fresh trip; all 5 wizard steps persist)`);
});
