// src/modules/operations/orders/sampleOrdersData.ts
//
// OFFLINE SAMPLE DATA for the Orders module — ~100 trips of scenario data.
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
//     Save Assignment / Finish Assignment / Submit all work for the session (a
//     browser refresh re-seeds the scenario).
//
// WHAT IS IN THE SCENARIO (all of it deterministic — no randomness, so a
// refresh always shows the same numbers):
//
//   120 shops · 20 vehicles · 12 supervisors · 12 drivers
//   7 operational days (the tracking window) → 7 collection containers +
//   93 vehicle trips = 100 trips.
//
//     Tab 1 Order Collection — one container per day with 20…60 collected
//       shops; today's is still open (the working sheet), past days are
//       finished, and day −5 is left unfinished so the D+2 00:00 clock shows
//       the CLOSED chip beside the summary.
//     Tab 2 Order Assignment — today's 14 trucks have Step 2 done and Step 4
//       open, so all are assignable. 5 of them already carry a PARTIAL
//       assignment (1…3 shops saved) — the rest are empty, and ~26 of today's
//       36 shops are still pending, which is what the default
//       "Pending (not assigned)" filter and the shop search are for.
//     Tab 3 Delivery Tracking — every past day's trucks, in all three states:
//       Completed (every shop in), In Progress (some shops delivered, one
//       PART DELIVERED with a visible balance, the rest NOT DELIVERED) and
//       Assigned (nothing delivered yet) — so the PDF popup can be checked on
//       each, including a multi-page report of 20+ shops.
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

const SHOP_PREFIXES = [
  "Sai Ram",
  "Bhavani",
  "Gayatri",
  "Padmavathi",
  "Durga",
  "Lakshmi Narasimha",
  "Sowmya",
  "Prasanna",
  "Vijaya",
  "Rama Krishna",
  "Indira",
  "Manjunatha",
];
const SHOP_SUFFIXES = [
  "Poultry Traders",
  "Egg Suppliers",
  "Farms Outlet",
  "Poultry Point",
  "Broiler Centre",
  "Chicken Mart",
  "Poultry Distributors",
  "Egg & Meat Depot",
  "Fresh Eggs",
  "Poultry Hub",
];
const SHOP_CITIES = [
  "Vijayawada",
  "Gannavaram",
  "Ibrahimpatnam",
  "Gudivada",
  "Nuzvid",
  "Eluru",
  "Kodad",
  "Suryapet",
  "Khammam",
  "Warangal",
  "Rajahmundry",
  "Nidadavole",
  "Tanuku",
  "Bhimavaram",
  "Palakollu",
  "Jaggayyapet",
  "Mylavaram",
  "Vuyyuru",
  "Pedana",
  "Kaikaluru",
];
const SHOP_OWNERS = [
  "Ramesh K",
  "Suresh M",
  "Lakshmi D",
  "Prasad R",
  "Nagaraju V",
  "Sriramulu B",
  "Venkatesh P",
  "Anand Rao T",
  "Mahesh G",
  "Ravindra N",
  "Kalyani S",
  "Sudhakar Y",
];

/** The first eight are the original hand-written shops (ids 1…8). */
const HAND_WRITTEN_SHOPS: SampleShop[] = [
  { id: 1, shopNo: 1, shopName: "Sri Balaji Poultry Traders", village: "Ibrahimpatnam", ownerName: "Ramesh K", mobile: "9848012301" },
  { id: 2, shopNo: 2, shopName: "Venkatadri Egg Suppliers", village: "Gannavaram", ownerName: "Suresh M", mobile: "9848012302" },
  { id: 3, shopNo: 3, shopName: "Annapurna Farms Outlet", village: "Vijayawada", ownerName: "Lakshmi D", mobile: "9848012303" },
  { id: 4, shopNo: 4, shopName: "Kakatiya Poultry Point", village: "Warangal", ownerName: "Prasad R", mobile: "9848012304" },
  { id: 5, shopNo: 5, shopName: "Godavari Broiler Centre", village: "Rajahmundry", ownerName: "Nagaraju V", mobile: "9848012305" },
  { id: 6, shopNo: 6, shopName: "Sri Lakshmi Chicken Mart", village: "Eluru", ownerName: "Sriramulu B", mobile: "9848012306" },
  { id: 7, shopNo: 7, shopName: "Krishna Poultry Distributors", village: "Gudivada", ownerName: "Venkatesh P", mobile: "9848012307" },
  { id: 8, shopNo: 8, shopName: "Deccan Egg & Meat Depot", village: "Khammam", ownerName: "Anand Rao T", mobile: "9848012308" },
];

/** How many shops the sample Shop Master holds. */
const SAMPLE_SHOP_COUNT = 120;

function generatedShop(index: number): SampleShop {
  // index is 0-based over the generated block (ids start after the hand-written ones)
  const n = HAND_WRITTEN_SHOPS.length + index;
  const prefix = SHOP_PREFIXES[index % SHOP_PREFIXES.length];
  const suffix = SHOP_SUFFIXES[Math.floor(index / SHOP_PREFIXES.length) % SHOP_SUFFIXES.length];
  return {
    id: n + 1,
    shopNo: n + 1,
    shopName: `${prefix} ${suffix}`,
    village: SHOP_CITIES[n % SHOP_CITIES.length],
    ownerName: SHOP_OWNERS[n % SHOP_OWNERS.length],
    mobile: `98480${String(12300 + n).slice(-5)}`,
  };
}

export const SAMPLE_SHOPS: SampleShop[] = [
  ...HAND_WRITTEN_SHOPS,
  ...Array.from(
    { length: SAMPLE_SHOP_COUNT - HAND_WRITTEN_SHOPS.length },
    (_, i) => generatedShop(i)
  ),
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

const VEHICLE_PLATES = ["JK", "LM", "NP", "QR", "ST", "UV", "WX", "YZ"];
const HAND_WRITTEN_VEHICLES: SampleVehicle[] = [
  { id: 1, vehicleNo: "TS 09 AB 1234", noOfBoxes: 120 },
  { id: 2, vehicleNo: "TS 09 CD 5678", noOfBoxes: 80 },
  { id: 3, vehicleNo: "TS 09 EF 9012", noOfBoxes: 150 },
  { id: 4, vehicleNo: "TS 09 GH 3456", noOfBoxes: 100 },
];

/** How many trucks the sample fleet holds. */
const SAMPLE_VEHICLE_COUNT = 20;

export const SAMPLE_VEHICLES: SampleVehicle[] = [
  ...HAND_WRITTEN_VEHICLES,
  ...Array.from(
    { length: SAMPLE_VEHICLE_COUNT - HAND_WRITTEN_VEHICLES.length },
    (_, i) => {
      const id = HAND_WRITTEN_VEHICLES.length + i + 1;
      return {
        id,
        vehicleNo: `TS 09 ${VEHICLE_PLATES[i % VEHICLE_PLATES.length]} ${1100 + id * 37}`,
        noOfBoxes: 90 + (id % 6) * 20, // 90 … 190 boxes
      };
    }
  ),
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
  { name: "Kishore Babu", mobile: "9000000005" },
  { name: "Naveen Reddy", mobile: "9000000006" },
  { name: "Balaji Naik", mobile: "9000000007" },
  { name: "Suresh Yadav", mobile: "9000000008" },
  { name: "Praveen Kumar", mobile: "9000000009" },
  { name: "Ramesh Babu", mobile: "9000000010" },
  { name: "Santosh Goud", mobile: "9000000011" },
  { name: "Mahesh Varma", mobile: "9000000012" },
];

/** name (lower-cased) → mobile, exactly like `loadSupervisorDirectory()`. */
export function sampleSupervisorDirectory(): Map<string, string> {
  return new Map(SAMPLE_SUPERVISORS.map((s) => [s.name.toLowerCase(), s.mobile]));
}

const SAMPLE_DRIVERS = [
  "Imran S",
  "Kiran P",
  "Raju B",
  "Salman K",
  "Nagesh R",
  "Vinod T",
  "Firoz A",
  "Chandu M",
  "Srinu V",
  "Pavan J",
  "Balu Y",
  "Manoj D",
];

// ─── Sample trips ────────────────────────────────────────────────────────────

const AVG_BIRD_WEIGHT = 1.5;
const BIRDS_PER_BOX = 10;

function shopById(id: number): SampleShop {
  const found = SAMPLE_SHOPS.find((s) => s.id === id);
  if (!found) throw new Error(`sampleOrdersData: unknown shop id ${id}`);
  return found;
}

/** One Orders plan row: `[ORDER]` marker + boxNo = ordered boxes. */
function planRow(
  tripId: number,
  serialNo: number,
  shopId: number,
  boxes: number,
  birds: number,
  over: Partial<ShopDelivery> = {}
): ShopDelivery {
  const shop = shopById(shopId);
  const weight = Number((birds * AVG_BIRD_WEIGHT).toFixed(2));
  return {
    id: serialNo,
    clientKey: `sample-${tripId}-${serialNo}-${shopId}`,
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

const FARM_NAMES = [
  "Sri Venkateswara Broiler Farm",
  "Godavari Poultry Farms",
  "Deccan Country Birds Farm",
  "Krishna Layer Farm",
  "Annapurna Broiler Unit",
  "Sai Ram Country Farm",
  "Padmavathi Poultry Unit",
  "Bhavani Hatchery Farm",
];
const FARM_TOWNS = [
  "Vijayawada",
  "Kodad",
  "Hyderabad",
  "Gudivada",
  "Suryapet",
  "Eluru",
  "Nuzvid",
  "Khammam",
];

/** Step-2 farm details per vehicle (shown in the assignment vehicle table). */
function farmOf(vehicleId: number): { farm: string; address: string } {
  const town = FARM_TOWNS[vehicleId % FARM_TOWNS.length];
  return {
    farm: FARM_NAMES[vehicleId % FARM_NAMES.length],
    address: `Plot ${vehicleId + 3}, Farm Road, ${town}`,
  };
}

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
  const farm = farmOf(vehicleId);
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

/** A delivery timestamp that looks like a real capture (06:40 … 18:50). */
function deliveredAt(day: string, shopIndex: number): string {
  const minutes = 400 + shopIndex * 23; // 06:40 onwards, 23 min apart
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${day}T${hh}:${mm}:00`;
}

/**
 * Deterministic uneven split of `total` items into `parts` buckets (every
 * bucket ≥ 1, sum exactly `total`). `bigFirst` hands the first bucket ~40% of
 * the day's shops — the multi-page delivery report case.
 */
function splitCounts(total: number, parts: number, seed: number, bigFirst: boolean): number[] {
  if (parts <= 0) return [];
  if (parts === 1) return [total];
  const sizes: number[] = [];
  let remaining = total;
  if (bigFirst) {
    const first = Math.max(2, Math.round(total * 0.4));
    sizes.push(Math.min(first, remaining - (parts - 1)));
    remaining -= sizes[0];
  }
  const rest = bigFirst ? parts - 1 : parts;
  const base = Math.max(1, Math.floor(remaining / rest));
  for (let i = 0; i < rest; i += 1) {
    sizes.push(Math.max(1, base + (((i + seed) % 3) - 1)));
  }
  // Reconcile the rounding drift so the buckets add up exactly.
  let sum = sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; sum !== total; i = (i + 1) % sizes.length) {
    const delta = total > sum ? 1 : -1;
    if (sizes[i] + delta >= 1) {
      sizes[i] += delta;
      sum += delta;
    }
  }
  return sizes;
}

/** Which shops a day's order holds — rotated so each day covers new ground. */
function shopIdsForDay(dayIndex: number, count: number): number[] {
  const start = (dayIndex * 17) % SAMPLE_SHOPS.length;
  return Array.from({ length: count }, (_, i) => SAMPLE_SHOPS[(start + i) % SAMPLE_SHOPS.length].id);
}

/**
 * The scenario: 7 operational days → 7 containers + 93 vehicle trips.
 *
 * `kind`
 *  - "today"  : collection still open, trucks assignable (some partly assigned)
 *  - "past"   : collection finished, trucks in Delivery Tracking
 *  - "closed" : collection left unfinished — the D+2 00:00 clock CLOSED it
 */
const SCENARIO: Array<{
  offset: number;
  shops: number;
  vehicles: number;
  kind: "today" | "past" | "closed";
  bigFirst?: boolean;
}> = [
  { offset: 0, shops: 36, vehicles: 14, kind: "today" },
  { offset: -1, shops: 45, vehicles: 16, kind: "past" },
  { offset: -2, shops: 52, vehicles: 16, kind: "past", bigFirst: true },
  { offset: -3, shops: 40, vehicles: 16, kind: "past" },
  { offset: -4, shops: 60, vehicles: 16, kind: "past", bigFirst: true },
  { offset: -5, shops: 20, vehicles: 0, kind: "closed" },
  { offset: -6, shops: 48, vehicles: 15, kind: "past" },
];

/** Trucks per past day that already carry a partial assignment (today only). */
const PARTIALLY_ASSIGNED_TODAY = 5;

function buildSampleTrips(): Trip[] {
  const trips: Trip[] = [];
  let containerId = 9000;
  let tripId = 9100;

  SCENARIO.forEach((spec, dayIndex) => {
    const day = localDay(spec.offset);
    const orderNo = `ORD-${stamp(day)}-01`;
    const dayShops = shopIdsForDay(dayIndex, spec.shops);

    // ── the day's collection container (Tab 1) ─────────────────────────────
    const containerRows = dayShops.map((shopId, i) => {
      const boxes = 8 + ((shopId * 7 + i * 3) % 22); // 8 … 29 boxes
      return planRow(0, i + 1, shopId, boxes, boxes * BIRDS_PER_BOX);
    });
    trips.push(
      containerTrip(
        (containerId += 1),
        day,
        spec.kind !== "today" && spec.kind !== "closed",
        containerRows
      )
    );

    if (spec.vehicles === 0) return; // the auto-closed day has no trucks

    const perVehicle = splitCounts(dayShops.length, spec.vehicles, dayIndex, !!spec.bigFirst);
    let cursor = 0;

    perVehicle.forEach((shopCount, vIndex) => {
      const shopIds = dayShops.slice(cursor, cursor + shopCount);
      cursor += shopCount;
      const vehicleId = ((dayIndex * 5 + vIndex * 3) % SAMPLE_VEHICLES.length) + 1;
      const vehicle = vehicleById(vehicleId);
      const supervisor = SAMPLE_SUPERVISORS[(dayIndex + vIndex) % SAMPLE_SUPERVISORS.length];
      const driver = SAMPLE_DRIVERS[(dayIndex * 2 + vIndex) % SAMPLE_DRIVERS.length];
      const seq = vIndex + 1;

      // Load the truck to 70…90% of its box capacity, split over its shops.
      const targetBoxes = Math.round(vehicle.noOfBoxes * (0.7 + (vIndex % 4) * 0.066));
      const base = Math.max(2, Math.floor(targetBoxes / Math.max(1, shopIds.length)));
      const boxesOf = (j: number) => Math.max(2, base + ((j % 3) - 1));

      // ── TODAY: assignable trucks; the first few already partly assigned ──
      if (spec.kind === "today") {
        const partial = vIndex < PARTIALLY_ASSIGNED_TODAY;
        const carried = partial ? shopIds.slice(0, 1 + (vIndex % 3)) : [];
        trips.push(
          deliveryTrip((tripId += 1), day, seq, vehicleId, driver, supervisor.name, {
            status: "Pending",
            deliveryStepSubmitted: false,
            pickupStepSubmitted: false,
            deliveries: carried.map((shopId, j) =>
              planRow(
                tripId,
                j + 1,
                shopId,
                boxesOf(j),
                boxesOf(j) * BIRDS_PER_BOX,
                assigned(orderNo)
              )
            ),
          })
        );
        return;
      }

      // ── PAST DAYS: tracking trips in all three delivery states ───────────
      //   0…3 → Completed        (every shop delivered)
      //   4…6 → In Progress      (some delivered, one PART DELIVERED, rest not)
      //   7…9 → Assigned         (nothing delivered yet)
      const bucket = (vIndex + dayIndex) % 10;
      const completed = bucket < 4;
      const inProgress = bucket >= 4 && bucket < 7;
      const fullCount = inProgress ? Math.max(1, Math.floor(shopIds.length / 2)) : shopIds.length;
      const partShopIndex = inProgress ? fullCount : -1;

      const rows: ShopDelivery[] = [];
      let serial = 1;
      shopIds.forEach((shopId, j) => {
        const boxes = boxesOf(j);
        const birds = boxes * BIRDS_PER_BOX;
        const done = completed || (inProgress && j < fullCount);
        if (done) {
          rows.push(
            planRow(tripId, serial, shopId, boxes, birds, assigned(orderNo, deliveredAt(day, j)))
          );
          serial += 1;
          return;
        }
        if (j === partShopIndex) {
          // The plan row stays open; the captured row holds the part that is
          // in — so the shop shows as PART DELIVERED with a visible balance.
          rows.push(planRow(tripId, serial, shopId, boxes, birds, assigned(orderNo)));
          serial += 1;
          const partBoxes = Math.max(1, Math.round(boxes * 0.4));
          rows.push(
            planRow(
              tripId,
              serial,
              shopId,
              partBoxes,
              partBoxes * BIRDS_PER_BOX,
              assigned(orderNo, deliveredAt(day, j + 6))
            )
          );
          serial += 1;
          return;
        }
        rows.push(planRow(tripId, serial, shopId, boxes, birds, assigned(orderNo)));
        serial += 1;
      });

      trips.push(
        deliveryTrip((tripId += 1), day, seq, vehicleId, driver, supervisor.name, {
          status: completed ? "Completed" : "Pending",
          deliveryStepSubmitted: true,
          endStepSubmitted: completed,
          submittedAtTimestamp: completed ? `${day}T19:30:00` : undefined,
          deliveries: rows,
        })
      );
    });
  });

  return trips;
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

let nextSampleTripId = 99000;

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
