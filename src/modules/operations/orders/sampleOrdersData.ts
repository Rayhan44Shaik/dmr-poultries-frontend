// src/modules/operations/orders/sampleOrdersData.ts
//
// OFFLINE SAMPLE DATA for the Orders module.
//
// The Orders page normally reads the existing /api/trips contract. In this
// checkout there is no backend to reach from a browser preview (no PostgreSQL,
// and no .env to point VITE_API_BASE_URL at the dev proxy), so the module can
// run entirely on the bundled sample data below instead:
//
//   • NO network request is made — not even a failing one;
//   • the sample rows are plain `Trip` / `ShopDelivery` records, so EVERY
//     business rule still runs on them unchanged (container classification,
//     capacity limits, same-shop/same-day uniqueness, delivery progress,
//     one-week tracking window). Nothing here re-implements Orders logic;
//   • saves mutate the in-memory store, so Save Progress / Finish Collection /
//     Save Assignment / Finish Assignment all work for the session (a browser
//     refresh re-seeds the scenario).
//
// Flip ORDERS_SAMPLE_DATA_ENABLED back to `false` to return to the live API —
// no other change is needed.

import { createEmptyTrip, type ShopDelivery, type Trip } from "../../../shared/trip";
import type { Shop } from "../../masters/shops/types/shop";

/** Master switch: `true` = run the Orders page on bundled sample data. */
export const ORDERS_SAMPLE_DATA_ENABLED = true;

// ─── Sample masters ──────────────────────────────────────────────────────────

export type SampleShop = {
  id: number;
  shopNo: number;
  shopName: string;
  /** Shop Master locality (`city` on the master, shown as "Village" here). */
  village: string;
  ownerName: string;
  mobile: string;
};

export const SAMPLE_SHOPS: SampleShop[] = [
  { id: 1, shopNo: 1, shopName: "Sri Balaji Poultry Traders", village: "Ibrahimpatnam", ownerName: "Ramesh K", mobile: "9848012301" },
  { id: 2, shopNo: 2, shopName: "Venkatadri Egg Suppliers", village: "Gannavaram", ownerName: "Suresh M", mobile: "9848012302" },
  { id: 3, shopNo: 3, shopName: "Annapurna Farms Outlet", village: "Vijayawada", ownerName: "Lakshmi D", mobile: "9848012303" },
  { id: 4, shopNo: 4, shopName: "Kakatiya Poultry Point", village: "Warangal", ownerName: "Prasad R", mobile: "9848012304" },
  { id: 5, shopNo: 5, shopName: "Godavari Broiler Centre", village: "Rajahmundry", ownerName: "Nagaraju V", mobile: "9848012305" },
  { id: 6, shopNo: 6, shopName: "Sri Lakshmi Chicken Mart", village: "Eluru", ownerName: "Sriramulu B", mobile: "9848012306" },
  { id: 7, shopNo: 7, shopName: "Krishna Poultry Distributors", village: "Gudivada", ownerName: "Venkatesh P", mobile: "9848012307" },
  { id: 8, shopNo: 8, shopName: "Deccan Egg & Meat Depot", village: "Khammam", ownerName: "Anand Rao T", mobile: "9848012308" },
];

/** Shop-Master-shaped records for the Order Collection shop list. */
export function sampleShopRecords(): Shop[] {
  return SAMPLE_SHOPS.map((s) => ({
    id: s.id,
    shopNo: s.shopNo,
    shopNumber: `SHP-${String(s.shopNo).padStart(3, "0")}`,
    shopName: s.shopName,
    ownerName: s.ownerName,
    phoneNumber: s.mobile,
    whatsappNumber: s.mobile,
    email: "",
    city: s.village,
    address: `${s.village}, Andhra Pradesh`,
    paperRate: 0,
    associationType: "",
    status: "Active",
    openingBalance: 0,
    currentBalance: 0,
  }));
}

export type SampleVehicle = { id: number; vehicleNo: string; noOfBoxes: number };

export const SAMPLE_VEHICLES: SampleVehicle[] = [
  { id: 1, vehicleNo: "TS 09 AB 1234", noOfBoxes: 120 },
  { id: 2, vehicleNo: "TS 09 CD 5678", noOfBoxes: 80 },
  { id: 3, vehicleNo: "TS 09 EF 9012", noOfBoxes: 150 },
  { id: 4, vehicleNo: "TS 09 GH 3456", noOfBoxes: 100 },
];

/** Vehicle capacities in the shape `vehicleCapacityOf()` expects. */
export function sampleVehicleCapacities(): Array<{ id: number; noOfBoxes?: number }> {
  return SAMPLE_VEHICLES.map((v) => ({ id: v.id, noOfBoxes: v.noOfBoxes }));
}

const SAMPLE_SUPERVISORS: Array<{ name: string; mobile: string }> = [
  { name: "Ravi Kumar", mobile: "9000000001" },
  { name: "Srinivas G", mobile: "9000000002" },
  { name: "Mohan Rao", mobile: "9000000003" },
  { name: "Anil Chand", mobile: "9000000004" },
];

/** name (lower-cased) → mobile, exactly like `loadSupervisorDirectory()`. */
export function sampleSupervisorDirectory(): Map<string, string> {
  return new Map(SAMPLE_SUPERVISORS.map((s) => [s.name.toLowerCase(), s.mobile]));
}

// ─── Sample trips ────────────────────────────────────────────────────────────

const AVG_BIRD_WEIGHT = 1.5;

function shopById(id: number): SampleShop {
  const found = SAMPLE_SHOPS.find((s) => s.id === id);
  if (!found) throw new Error(`sampleOrdersData: unknown shop id ${id}`);
  return found;
}

/** One Orders plan row: `[ORDER]` marker + boxNo = ordered boxes. */
function planRow(serialNo: number, shopId: number, boxes: number, birds: number, over: Partial<ShopDelivery> = {}): ShopDelivery {
  const shop = shopById(shopId);
  const weight = Number((birds * AVG_BIRD_WEIGHT).toFixed(2));
  return {
    id: serialNo,
    clientKey: `sample-${shopId}-${serialNo}`,
    serialNo,
    shopId,
    shopName: shop.shopName,
    birdTypeId: 0,
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
    ...over,
  };
}

function vehicleById(id: number): SampleVehicle {
  const found = SAMPLE_VEHICLES.find((v) => v.id === id);
  if (!found) throw new Error(`sampleOrdersData: unknown vehicle id ${id}`);
  return found;
}

function localDay(offsetFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const stamp = (day: string) => day.replace(/-/g, "");

/** A collection container: no vehicle, `[ORDER]` plan rows only. */
function containerTrip(id: number, day: string, finished: boolean, rows: ShopDelivery[]): Trip {
  return createEmptyTrip({
    id,
    tripNo: `ORD-${stamp(day)}-01`,
    tripDate: day,
    status: "Draft",
    vehicleId: 0,
    vehicleNo: "",
    avgBirdWeight: AVG_BIRD_WEIGHT,
    startStepSubmitted: finished,
    deliveries: rows,
  });
}

/** Step-2 farm details per vehicle (shown in the assignment vehicle table). */
const FARM_BY_VEHICLE: Record<number, { farm: string; address: string }> = {
  1: { farm: "Sri Venkateswara Broiler Farm", address: "Survey 42/1, Ibrahimpatnam Road, Vijayawada" },
  2: { farm: "Godavari Poultry Farms", address: "NH-16, Kovvuru Mandal, Kodad" },
  3: { farm: "Deccan Country Birds Farm", address: "Plot 7, Kukatpally Road, Hyderabad" },
  4: { farm: "Krishna Layer Farm", address: "Vuyyuru Road, Gudivada" },
};

/** A vehicle trip carrying one collection order's rows. */
function deliveryTrip(
  id: number,
  day: string,
  seq: number,
  vehicleId: number,
  driverName: string,
  supervisorName: string,
  over: Partial<Trip> & { deliveries: ShopDelivery[] }
): Trip {
  const vehicle = vehicleById(vehicleId);
  const farm = FARM_BY_VEHICLE[vehicleId];
  return createEmptyTrip({
    id,
    tripNo: `TRP-${stamp(day)}-${String(seq).padStart(2, "0")}`,
    tripDate: day,
    vehicleId,
    vehicleNo: vehicle.vehicleNo,
    driverName,
    supervisorName,
    sourceFarm: farm.farm,
    farmAddress: farm.address,
    avgBirdWeight: AVG_BIRD_WEIGHT,
    startStepSubmitted: true,
    farmStepSubmitted: true,
    pickupStepSubmitted: true,
    ...over,
  });
}

/** Marks a plan row as assigned to a collection order (+ delivered at `at`). */
function assigned(orderTripNo: string, deliveredAt?: string): Partial<ShopDelivery> {
  return {
    remarks: `[ORDER] O:${orderTripNo}`,
    ...(deliveredAt ? { autoCaptureTime: deliveredAt } : {}),
  };
}

function buildSampleTrips(): Trip[] {
  const today = localDay(0);
  const yesterday = localDay(-1);
  const twoDaysAgo = localDay(-2);
  const threeDaysAgo = localDay(-3);
  const ordYest = `ORD-${stamp(yesterday)}-01`;
  const ordTwo = `ORD-${stamp(twoDaysAgo)}-01`;

  return [
    // ── TODAY — collection still open (Tab 1 working sheet) ──────────────────
    containerTrip(9001, today, false, [
      planRow(1, 1, 40, 400),
      planRow(2, 2, 25, 250),
      planRow(3, 3, 30, 300),
      planRow(4, 5, 20, 200),
    ]),

    // ── YESTERDAY — collection finished, fully assigned, partly delivered ────
    containerTrip(9002, yesterday, true, [
      planRow(1, 1, 50, 500),
      planRow(2, 2, 30, 300),
      planRow(3, 3, 20, 200),
      planRow(4, 4, 15, 150),
      planRow(5, 6, 25, 250),
    ]),
    deliveryTrip(9101, yesterday, 1, 1, "Imran S", "Ravi Kumar", {
      status: "Pending",
      deliveryStepSubmitted: true,
      deliveries: [
        planRow(1, 1, 50, 500, assigned(ordYest, `${yesterday}T09:15:00`)),
        planRow(2, 2, 30, 300, assigned(ordYest)),
      ],
    }),
    deliveryTrip(9102, yesterday, 2, 2, "Kiran P", "Srinivas G", {
      status: "Completed",
      deliveryStepSubmitted: true,
      endStepSubmitted: true,
      deliveries: [
        planRow(1, 3, 20, 200, assigned(ordYest, `${yesterday}T10:40:00`)),
        planRow(2, 4, 15, 150, assigned(ordYest, `${yesterday}T11:25:00`)),
      ],
    }),
    deliveryTrip(9103, yesterday, 3, 4, "Imran S", "Mohan Rao", {
      status: "Completed",
      deliveryStepSubmitted: true,
      endStepSubmitted: true,
      deliveries: [planRow(1, 6, 25, 250, assigned(ordYest, `${yesterday}T12:05:00`))],
    }),

    // ── 2 DAYS AGO — closed history inside the tracking window ───────────────
    containerTrip(9003, twoDaysAgo, true, [
      planRow(1, 5, 35, 350),
      planRow(2, 7, 30, 300),
    ]),
    deliveryTrip(9104, twoDaysAgo, 1, 1, "Kiran P", "Anil Chand", {
      status: "Completed",
      deliveryStepSubmitted: true,
      endStepSubmitted: true,
      deliveries: [
        planRow(1, 5, 35, 350, assigned(ordTwo, `${twoDaysAgo}T09:50:00`)),
        planRow(2, 7, 30, 300, assigned(ordTwo, `${twoDaysAgo}T10:35:00`)),
      ],
    }),

    // ── 3 DAYS AGO — never finished, and the 48h window has passed, so the
    //    clock auto-closed it: CLOSED chip beside the KPI summary, view only ──
    containerTrip(9004, threeDaysAgo, false, [
      planRow(1, 8, 18, 180),
      planRow(2, 2, 22, 220),
    ]),

    // ── TODAY — truck with Step 2 done and nothing delivered: free to assign ─
    deliveryTrip(9105, today, 1, 3, "Imran S", "Mohan Rao", {
      pickupStepSubmitted: false,
      deliveryStepSubmitted: false,
      deliveries: [],
    }),
  ];
}

// ─── In-memory store (survives saves, re-seeds on reload) ────────────────────

let store: Trip[] | null = null;

/** The sample trip store, seeded on first use. */
export function sampleTrips(): Trip[] {
  if (!store) store = buildSampleTrips();
  return store;
}

/** Drop the store so the next read re-seeds the pristine scenario. */
export function resetSampleTrips(): void {
  store = null;
}

let nextSampleTripId = 9200;

/**
 * Persist a deliveries payload onto the sample store — the offline twin of
 * POST /api/trips/:id/steps/deliveries. `tripId` 0/null creates the day's
 * collection container, exactly like the backend contract.
 */
export function applySampleDeliveries(
  tripId: number | null,
  rows: ShopDelivery[],
  patch: Partial<Trip> = {},
  tripNo?: string
): Trip {
  const trips = sampleTrips();
  let trip = tripId ? trips.find((t) => t.id === tripId) : undefined;
  if (!trip) {
    trip = createEmptyTrip({
      id: nextSampleTripId++,
      tripNo: tripNo || `ORD-${stamp(localDay(0))}-01`,
      tripDate: localDay(0),
      avgBirdWeight: AVG_BIRD_WEIGHT,
    });
    trips.push(trip);
  }
  trip.deliveries = rows.map((row, index) => ({
    ...row,
    id: index + 1,
    serialNo: Number(row.serialNo) || index + 1,
    boxNo: Number(row.boxNo) || 0,
  }));
  Object.assign(trip, patch);
  return trip;
}
