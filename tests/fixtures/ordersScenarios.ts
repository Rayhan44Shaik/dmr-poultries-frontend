// Test fixtures only. Never import from application/runtime code.
import { createEmptyTrip, type ShopDelivery, type Trip } from "../../src/shared/trip";
import type { Shop } from "../../src/modules/masters/shops/types/shop";


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
const SAMPLE_VEHICLE_COUNT = 24;

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
 * The scenario: 7 operational days → 7 collection containers + the vehicle
 * trips below (≈ 93 trips in all).
 *
 * `kind`
 *  - "today"  : collection still open, trucks assignable (some partly assigned)
 *  - "past"   : collection finished, trucks in Delivery Tracking
 *  - "closed" : collection left unfinished — the D+2 00:00 clock CLOSED it
 *
 * `boxes` is the day's per-shop order size: a day of small retailers (3…6
 * boxes) puts 15+ shops on one truck, which is the multi-page report case.
 */
const SCENARIO: Array<{
  offset: number;
  shops: number;
  vehicles: number;
  kind: "today" | "past" | "closed";
  boxes: [number, number];
}> = [
  { offset: 0, shops: 40, vehicles: 14, kind: "today", boxes: [8, 29] },
  { offset: -1, shops: 60, vehicles: 22, kind: "past", boxes: [8, 29] },
  { offset: -2, shops: 48, vehicles: 3, kind: "past", boxes: [3, 6] },
  { offset: -3, shops: 55, vehicles: 22, kind: "past", boxes: [8, 29] },
  { offset: -4, shops: 45, vehicles: 3, kind: "past", boxes: [3, 5] },
  { offset: -5, shops: 20, vehicles: 0, kind: "closed", boxes: [8, 29] },
  { offset: -6, shops: 60, vehicles: 22, kind: "past", boxes: [8, 29] },
];

/** Trucks per day that already carry a partial assignment (today only). */
const PARTIALLY_ASSIGNED_TODAY = 5;

/** Deterministic per-shop order size for a day. */
function boxesForDay(spec: { boxes: [number, number] }, shopId: number, index: number): number {
  const [min, max] = spec.boxes;
  return min + ((shopId * 7 + index * 3) % (max - min + 1));
}

/** Which shops a day's order holds — rotated so each day covers new ground. */
function shopIdsForDay(dayIndex: number, count: number): number[] {
  const start = (dayIndex * 17) % SAMPLE_SHOPS.length;
  return Array.from({ length: count }, (_, i) => SAMPLE_SHOPS[(start + i) % SAMPLE_SHOPS.length].id);
}

function buildSampleTrips(): Trip[] {
  const trips: Trip[] = [];
  let containerId = 9000;
  let tripId = 9100;

  SCENARIO.forEach((spec, dayIndex) => {
    const day = localDay(spec.offset);
    const orderNo = `ORD-${stamp(day)}-01`;
    const dayShops = shopIdsForDay(dayIndex, spec.shops);
    // ONE order of record per shop per day: the collection row and every
    // vehicle row use these numbers, so delivered can never exceed ordered.
    const orderedBoxesOf = new Map<number, number>();
    dayShops.forEach((shopId, i) => orderedBoxesOf.set(shopId, boxesForDay(spec, shopId, i)));

    // ── the day's collection container (Tab 1) ─────────────────────────────
    trips.push(
      containerTrip(
        (containerId += 1),
        day,
        spec.kind !== "today" && spec.kind !== "closed",
        dayShops.map((shopId, i) => {
          const boxes = orderedBoxesOf.get(shopId)!;
          return planRow(0, i + 1, shopId, boxes, boxes * BIRDS_PER_BOX);
        })
      )
    );

    if (spec.vehicles === 0) return; // the auto-closed day has no trucks

    // ── spread the day's shops over the trucks, respecting box capacity ────
    const trucks = Array.from({ length: spec.vehicles }, (_, i) => {
      const vehicleId = ((dayIndex * 5 + i * 3) % SAMPLE_VEHICLES.length) + 1;
      return { vehicleId, capacity: vehicleById(vehicleId).noOfBoxes, shops: [] as number[] };
    });
    let cursor = 0;
    for (const shopId of dayShops) {
      const boxes = orderedBoxesOf.get(shopId)!;
      let placed = false;
      for (let attempt = 0; attempt < trucks.length; attempt += 1) {
        const truck = trucks[(cursor + attempt) % trucks.length];
        const load = truck.shops.reduce((sum, id) => sum + (orderedBoxesOf.get(id) ?? 0), 0);
        if (load + boxes <= truck.capacity) {
          truck.shops.push(shopId);
          cursor = (cursor + attempt + 1) % trucks.length;
          placed = true;
          break;
        }
      }
      if (!placed) trucks[cursor % trucks.length].shops.push(shopId); // never lose an order
    }

    trucks.forEach((truck, vIndex) => {
      // Past days are tracking trips: an empty truck would carry no order rows.
      if (truck.shops.length === 0 && spec.kind !== "today") return;

      const supervisor = SAMPLE_SUPERVISORS[(dayIndex + vIndex) % SAMPLE_SUPERVISORS.length];
      const driver = SAMPLE_DRIVERS[(dayIndex * 2 + vIndex) % SAMPLE_DRIVERS.length];
      const seq = vIndex + 1;
      const boxesOf = (shopId: number) => orderedBoxesOf.get(shopId)!;

      // ── TODAY: assignable trucks; the first few already partly assigned ──
      if (spec.kind === "today") {
        const carried = vIndex < PARTIALLY_ASSIGNED_TODAY ? truck.shops.slice(0, 1 + (vIndex % 3)) : [];
        trips.push(
          deliveryTrip((tripId += 1), day, seq, truck.vehicleId, driver, supervisor.name, {
            status: "Pending",
            deliveryStepSubmitted: false,
            pickupStepSubmitted: false,
            deliveries: carried.map((shopId, j) =>
              planRow(
                tripId,
                j + 1,
                shopId,
                boxesOf(shopId),
                boxesOf(shopId) * BIRDS_PER_BOX,
                assigned(orderNo)
              )
            ),
          })
        );
        return;
      }

      // ── PAST DAYS: tracking trips in all three delivery states ───────────
      //   0…3 → Completed        (every shop delivered in full)
      //   4…6 → In Progress      (some delivered, one PART DELIVERED, rest not)
      //   7…9 → Assigned         (nothing delivered yet)
      const bucket = (vIndex + dayIndex) % 10;
      const completed = bucket < 4;
      const inProgress = bucket >= 4 && bucket < 7;
      const fullCount = inProgress ? Math.max(1, Math.floor(truck.shops.length / 2)) : truck.shops.length;
      const partShopIndex = inProgress ? fullCount : -1;

      const rows: ShopDelivery[] = [];
      let serial = 1;
      truck.shops.forEach((shopId, j) => {
        const boxes = boxesOf(shopId);
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
        deliveryTrip((tripId += 1), day, seq, truck.vehicleId, driver, supervisor.name, {
          status: completed ? "Completed" : "Pending",
          deliveryStepSubmitted: true,
          endStepSubmitted: completed,
          submittedAtTimestamp: completed ? `${day}T19:30:00` : undefined,
          remarks: `order:${orderNo}`,
          deliveries: rows,
        })
      );
    });
  });

  // Data-quality fixture: tracking trip whose `[ORDER]` assignment list is
  // missing. Still shown (never hidden) with a light-orange warning.
  {
    const day = localDay(-1);
    const orderNo = `ORD-${stamp(day)}-01`;
    const shop = SAMPLE_SHOPS[0];
    trips.push(
      deliveryTrip((tripId += 1), day, 99, 1, SAMPLE_DRIVERS[0], SAMPLE_SUPERVISORS[0].name, {
        status: "Pending",
        deliveryStepSubmitted: true,
        remarks: `order:${orderNo}`,
        deliveries: [
          {
            id: 1,
            serialNo: 1,
            shopId: shop.id,
            shopName: shop.shopName,
            birdTypeId: 0,
            birdType: "",
            birds: 40,
            weight: 60,
            mortality: 0,
            mortKg: 0,
            rate: null,
            amount: 0,
            remarks: "",
            deliveryMode: "box",
            boxNo: 4,
            selectedBoxIds: [],
            autoCaptureTime: deliveredAt(day, 0),
          },
        ],
      })
    );
  }

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
