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
// Served today: /api/health, /api/masters/{shops,employees,vehicles},
// /api/trips (+ /api/trips/:id, POST /api/trips/:id/steps/deliveries for the
// Orders Collection / Assignment / Delivery Tracking page, and
// PATCH /api/trips/:id/status for the Draft→Pending→Completed lifecycle),
// and the /api/operations/collection-entry/* report endpoints. Vehicle
// responses also include 12 fictional EMI schedules for /fleet?tab=emi.
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
].map((e) => ({ phoneNumber: "", email: "", address: "", joiningDate: "2024-04-01", salary: 0, ...e }));

const COLLECTORS = EMPLOYEES.filter((e) => e.department === "Collection").map((e) => e.employeeName);
const MODES = ["Cash", "Union Bank", "HDFC Bank"]; // matches KNOWN_MODES display order

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
let nextTripId = 9200;

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
    readJsonBody(req).then((body) => send(200, applyDeliveriesPayload(stepMatch[1], body)));
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

  const singleTrip = url.pathname.match(/^\/api\/trips\/(\d+)$/);
  if (singleTrip && req.method === "GET") {
    const trip = TRIPS.find((t) => t.id === Number(singleTrip[1]));
    return trip
      ? send(200, trip)
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
    case "/api/trips":
      return send(200, TRIPS);

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
    default:
      return send(404, { error: "not_found", path: url.pathname, mock: true });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mock-backend] ⚠️  SAMPLE DATA ONLY — listening on http://0.0.0.0:${PORT}`);
  console.log(`[mock-backend] ${ROWS.length} sample collection rows over the last 45 days`);
  console.log(`[mock-backend] ${VEHICLES.length} sample EMI vehicles — open /fleet?tab=emi in the frontend preview`);
});
