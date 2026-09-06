import type pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { loadTripOrders, writeTripOrders } from "./tripOrdersService.js";
import { query, withTransaction } from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";
import type {
  BoxDetail,
  DieselEntry,
  ShopDelivery,
  Trip,
  TripStatus,
} from "../types/models.js";
import { dateOnly, isoOrNull, num, numOrNull, str } from "../utils/coerce.js";

type Client = pg.PoolClient;

function mapTripBase(row: Record<string, unknown>): Omit<
  Trip,
  "helpers" | "loaders" | "boxDetails" | "deliveries" | "dieselEntries"
> {
  return {
    id: num(row.id),
    tripNo: str(row.trip_no),
    tripDate: dateOnly(row.trip_date) ?? "",
    status: str(row.status) as TripStatus,
    version: num(row.version),
    collectionFinished: Boolean(row.collection_finished),
    assignmentSubmitted: Boolean(row.assignment_submitted),
    ordersHash: str(row.orders_hash),
    farmBirdTypeId: numOrNull(row.farm_bird_type_id),
    farmBirdType: str(row.farm_bird_type),
    farmGpsLat: numOrNull(row.farm_gps_lat), farmGpsLon: numOrNull(row.farm_gps_lon),
    farmGpsAccuracy: numOrNull(row.farm_gps_accuracy), farmGpsTime: isoOrNull(row.farm_gps_time),

    startTime: isoOrNull(row.start_time),
    vehicleId: numOrNull(row.vehicle_id),
    vehicleNo: row.vehicle_no == null ? null : str(row.vehicle_no),
    driverId: numOrNull(row.driver_id),
    driverName: row.driver_name == null ? null : str(row.driver_name),
    supervisorId: numOrNull(row.supervisor_id),
    supervisorName: row.supervisor_name == null ? null : str(row.supervisor_name),
    openingMeter: numOrNull(row.opening_meter),
    advanceAmount: num(row.advance_amount),
    startStepSubmitted: Boolean(row.start_step_submitted),

    sourceFarmId: numOrNull(row.source_farm_id),
    sourceFarm: row.source_farm == null ? null : str(row.source_farm),
    reachedTime: isoOrNull(row.reached_time),
    destMeter: numOrNull(row.dest_meter),
    pickupTolls: num(row.pickup_tolls),
    farmAddress: row.farm_address == null ? null : str(row.farm_address),
    avgBirdWeight: numOrNull(row.avg_bird_weight),
    farmRemarks: row.farm_remarks == null ? null : str(row.farm_remarks),
    farmStepSubmitted: Boolean(row.farm_step_submitted),

    dcWeight: num(row.dc_weight),
    totalBirds: num(row.total_birds),
    boxes: num(row.boxes),
    avgWeight: num(row.avg_weight),
    pickupLoadTime: isoOrNull(row.pickup_load_time),
    dcPhotoKey: row.dc_photo_key == null ? null : str(row.dc_photo_key),
    pickupStepSubmitted: Boolean(row.pickup_step_submitted),

    deliveryStepSubmitted: Boolean(row.delivery_step_submitted),

    closingMeter: numOrNull(row.closing_meter),
    endMeter: numOrNull(row.end_meter),
    endTime: isoOrNull(row.end_time),
    deliveryTolls: num(row.delivery_tolls),
    destinationTolls: num(row.destination_tolls),
    meals: num(row.meals),
    loading: num(row.loading),
    mealsTiffin: num(row.meals_tiffin),
    vehicleMaintenance: num(row.vehicle_maintenance),
    othersRC: num(row.others_rc),
    others1Amt: num(row.others1_amt),
    others2Amt: num(row.others2_amt),
    others3Amt: num(row.others3_amt),
    others4Amt: num(row.others4_amt),
    others5Amt: num(row.others5_amt),
    fuel: num(row.fuel),
    expense: num(row.expense),
    remarks: str(row.remarks),
    submittedAt: isoOrNull(row.submitted_at),
    endStepSubmitted: Boolean(row.end_step_submitted),
    expensesStepSubmitted: Boolean(row.expenses_step_submitted),

    totalKm: num(row.total_km),
    totalShops: num(row.total_shops),
    totalWeight: num(row.total_weight),
    totalDeliveredWeight: num(row.total_delivered_weight),
    totalBirdsDelivered: num(row.total_birds_delivered),
    totalMortality: num(row.total_mortality),
    totalMortalityCount: num(row.total_mortality_count),
    totalMortalityWeight: num(row.total_mortality_weight),
    weightLoss: num(row.weight_loss),
    survivalRate: num(row.survival_rate),
    lastShop: row.last_shop == null ? null : str(row.last_shop),
    rateCompleted: Boolean(row.rate_completed),

    deleted: Boolean(row.deleted),
    deletedReason: row.deleted_reason == null ? null : str(row.deleted_reason),
    approvedBy: row.approved_by == null ? null : str(row.approved_by),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

async function loadTripExtras(client: Client, tripId: number) {
  const crew = await client.query(`SELECT * FROM trip_crew WHERE trip_id = $1`, [tripId]);
  const boxes = await client.query(
    `SELECT * FROM trip_boxes WHERE trip_id = $1 ORDER BY box_no`,
    [tripId]
  );
  const deliveries = await client.query(
    `SELECT d.*,o.assigned_boxes FROM trip_deliveries d LEFT JOIN trip_order_rows o ON o.id=d.order_row_id WHERE d.trip_id = $1 ORDER BY d.serial_no NULLS LAST, d.id`,
    [tripId]
  );
  const diesel = await client.query(
    `SELECT * FROM trip_diesel_entries WHERE trip_id = $1 ORDER BY row_index`,
    [tripId]
  );
  const media = await client.query(
    `SELECT media_key, mime_type, data_base64
     FROM trip_media WHERE trip_id = $1 AND media_type = 'image'
     ORDER BY created_at DESC LIMIT 1`,
    [tripId]
  );
  const deliveryBoxes = await client.query(
    `SELECT db.* FROM trip_delivery_boxes db
     JOIN trip_deliveries d ON d.id = db.delivery_id
     WHERE d.trip_id = $1`,
    [tripId]
  );
  const perBox = await client.query(
    `SELECT pb.* FROM trip_delivery_per_box pb
     JOIN trip_deliveries d ON d.id = pb.delivery_id
     WHERE d.trip_id = $1`,
    [tripId]
  );

  const helpers = crew.rows
    .filter((r) => r.role === "helper")
    .map((r) => str(r.employee_name));
  const loaders = crew.rows
    .filter((r) => r.role === "loader")
    .map((r) => str(r.employee_name));

  const boxDetails: BoxDetail[] = boxes.rows.map((r) => ({
    boxNo: num(r.box_no),
    birds: num(r.birds),
    weight: num(r.weight),
  }));

  const boxesByDelivery = new Map<number, number[]>();
  for (const row of deliveryBoxes.rows) {
    const id = num(row.delivery_id);
    const list = boxesByDelivery.get(id) ?? [];
    list.push(num(row.box_no));
    boxesByDelivery.set(id, list);
  }

  const perBoxByDelivery = new Map<number, BoxDetail[]>();
  for (const row of perBox.rows) {
    const id = num(row.delivery_id);
    const list = perBoxByDelivery.get(id) ?? [];
    list.push({
      boxNo: num(row.box_no),
      birds: num(row.birds),
      weight: num(row.weight),
    });
    perBoxByDelivery.set(id, list);
  }

  const mappedDeliveries: ShopDelivery[] = deliveries.rows.map((r) => {
    const id = num(r.id);
    return {
      id,
      clientKey: str(r.client_key),
      orderTripId: r.order_row_id ? tripId : undefined,
      orderRowId: numOrNull(r.order_row_id),
      assignedBoxes: numOrNull(r.assigned_boxes),
      serialNo: numOrNull(r.serial_no),
      boxNo: numOrNull(r.box_no),
      shopId: numOrNull(r.shop_id),
      shopName: str(r.shop_name),
      birdTypeId: numOrNull(r.bird_type_id),
      birdType: str(r.bird_type),
      birds: num(r.birds),
      weight: num(r.weight),
      mortality: num(r.mortality),
      mortKg: numOrNull(r.mort_kg),
      rate: numOrNull(r.rate),
      amount: num(r.amount),
      remarks: str(r.remarks),
      deliveryMode: (str(r.delivery_mode) as "box" | "weight") || "box",
      selectedBoxIds: boxesByDelivery.get(id) ?? [],
      farmBirds: numOrNull(r.farm_birds),
      farmWeight: numOrNull(r.farm_weight),
      perBoxData: perBoxByDelivery.get(id) ?? [],
      autoCaptureTime: isoOrNull(r.auto_capture_time),
    };
  });

  const dieselEntries: DieselEntry[] = diesel.rows.map((r) => ({
    id: num(r.id), clientKey: str(r.client_key), amount: num(r.amount),
    submitted: Boolean(r.submitted_at), submittedAt: isoOrNull(r.submitted_at),
    gpsLat: numOrNull(r.gps_lat), gpsLon: numOrNull(r.gps_lon),
    gpsAccuracy: numOrNull(r.gps_accuracy), gpsCapturedAt: isoOrNull(r.gps_captured_at),
    rowIndex: num(r.row_index),
    litres: numOrNull(r.litres),
    rate: numOrNull(r.rate),
    meter: numOrNull(r.meter),
    bunkName: r.bunk_name == null ? null : str(r.bunk_name),
    bunkGps: r.bunk_gps == null ? null : str(r.bunk_gps),
    imageData: r.image_data == null ? null : str(r.image_data),
    imageName: r.image_name == null ? null : str(r.image_name),
  }));

  const dcPhoto = media.rows[0];
  return {
    ...(await loadTripOrders(client, tripId)),
    helpers,
    loaders,
    boxDetails,
    deliveries: mappedDeliveries,
    dieselEntries,
    dcPhotoKey: dcPhoto?.media_key ?? null,
    dcPhotoMime: dcPhoto?.mime_type ?? null,
    dcPhotoData: dcPhoto?.data_base64 ?? null,
  };
}

async function hydrateTrip(client: Client, row: Record<string, unknown>): Promise<Trip> {
  const base = mapTripBase(row);
  const extras = await loadTripExtras(client, base.id);
  return { ...base, ...extras };
}

async function generateTripNo(client: Client, tripDate: string): Promise<string> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('trip_no_' || $1))`, [tripDate]);
  const ymd = tripDate.replace(/-/g, "");
  const result = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM trips WHERE trip_date = $1`,
    [tripDate]
  );
  const seq = String(Number(result.rows[0].c) + 1).padStart(3, "0");
  return `TRP-${ymd}-${seq}`;
}

async function replaceCrewRole(
  client: Client,
  tripId: number,
  role: "helper" | "loader",
  names: string[] = []
) {
  await client.query(`DELETE FROM trip_crew WHERE trip_id = $1 AND role = $2`, [
    tripId,
    role,
  ]);
  for (const name of names) {
    if (!name) continue;
    await client.query(
      `INSERT INTO trip_crew (trip_id, employee_name, role) VALUES ($1,$2,$3)`,
      [tripId, name, role]
    );
  }
}

/** @deprecated use replaceCrewRole for partial crew updates */
async function replaceCrew(
  client: Client,
  tripId: number,
  helpers: string[] = [],
  loaders: string[] = []
) {
  await replaceCrewRole(client, tripId, "helper", helpers);
  await replaceCrewRole(client, tripId, "loader", loaders);
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

type PatchCoerce = (value: unknown) => unknown;

const TRIP_PATCH_FIELDS: Record<string, { column: string; coerce: PatchCoerce }> = {
  farmBirdTypeId: { column: "farm_bird_type_id", coerce: numOrNull },
  farmBirdType: { column: "farm_bird_type", coerce: str },
  farmGpsLat: { column: "farm_gps_lat", coerce: numOrNull },
  farmGpsLon: { column: "farm_gps_lon", coerce: numOrNull },
  farmGpsAccuracy: { column: "farm_gps_accuracy", coerce: numOrNull },
  farmGpsTime: { column: "farm_gps_time", coerce: (v) => v || null },
  tripDate: { column: "trip_date", coerce: (v) => dateOnly(v) },
  status: { column: "status", coerce: (v) => v ?? null },
  startTime: { column: "start_time", coerce: (v) => (v ? v : null) },
  vehicleId: { column: "vehicle_id", coerce: numOrNull },
  vehicleNo: { column: "vehicle_no", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  driverId: { column: "driver_id", coerce: numOrNull },
  driverName: { column: "driver_name", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  supervisorId: { column: "supervisor_id", coerce: numOrNull },
  supervisorName: {
    column: "supervisor_name",
    coerce: (v) => (v == null || v === "" ? null : str(v)),
  },
  openingMeter: { column: "opening_meter", coerce: numOrNull },
  advanceAmount: { column: "advance_amount", coerce: (v) => num(v, 0) },
  startStepSubmitted: { column: "start_step_submitted", coerce: (v) => v ?? null },
  sourceFarmId: { column: "source_farm_id", coerce: numOrNull },
  sourceFarm: { column: "source_farm", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  reachedTime: { column: "reached_time", coerce: (v) => (v ? v : null) },
  destMeter: { column: "dest_meter", coerce: numOrNull },
  pickupTolls: { column: "pickup_tolls", coerce: (v) => (v == null ? null : num(v, 0)) },
  farmAddress: { column: "farm_address", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  avgBirdWeight: { column: "avg_bird_weight", coerce: numOrNull },
  farmRemarks: { column: "farm_remarks", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  farmStepSubmitted: { column: "farm_step_submitted", coerce: (v) => v ?? null },
  dcWeight: { column: "dc_weight", coerce: (v) => (v == null ? null : num(v, 0)) },
  totalBirds: { column: "total_birds", coerce: (v) => (v == null ? null : num(v, 0)) },
  boxes: { column: "boxes", coerce: (v) => (v == null ? null : num(v, 0)) },
  avgWeight: { column: "avg_weight", coerce: (v) => (v == null ? null : num(v, 0)) },
  pickupLoadTime: { column: "pickup_load_time", coerce: (v) => (v ? v : null) },
  dcPhotoKey: { column: "dc_photo_key", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  pickupStepSubmitted: { column: "pickup_step_submitted", coerce: (v) => v ?? null },
  deliveryStepSubmitted: { column: "delivery_step_submitted", coerce: (v) => v ?? null },
  closingMeter: { column: "closing_meter", coerce: numOrNull },
  endMeter: { column: "end_meter", coerce: numOrNull },
  endTime: { column: "end_time", coerce: (v) => (v ? v : null) },
  deliveryTolls: { column: "delivery_tolls", coerce: (v) => (v == null ? null : num(v, 0)) },
  destinationTolls: { column: "destination_tolls", coerce: (v) => (v == null ? null : num(v, 0)) },
  meals: { column: "meals", coerce: (v) => (v == null ? null : num(v, 0)) },
  loading: { column: "loading", coerce: (v) => (v == null ? null : num(v, 0)) },
  mealsTiffin: { column: "meals_tiffin", coerce: (v) => (v == null ? null : num(v, 0)) },
  vehicleMaintenance: {
    column: "vehicle_maintenance",
    coerce: (v) => (v == null ? null : num(v, 0)),
  },
  othersRC: { column: "others_rc", coerce: (v) => (v == null ? null : num(v, 0)) },
  others1Amt: { column: "others1_amt", coerce: (v) => (v == null ? null : num(v, 0)) },
  others2Amt: { column: "others2_amt", coerce: (v) => (v == null ? null : num(v, 0)) },
  others3Amt: { column: "others3_amt", coerce: (v) => (v == null ? null : num(v, 0)) },
  others4Amt: { column: "others4_amt", coerce: (v) => (v == null ? null : num(v, 0)) },
  others5Amt: { column: "others5_amt", coerce: (v) => (v == null ? null : num(v, 0)) },
  fuel: { column: "fuel", coerce: (v) => (v == null ? null : num(v, 0)) },
  expense: { column: "expense", coerce: (v) => (v == null ? null : num(v, 0)) },
  remarks: { column: "remarks", coerce: (v) => (v == null ? null : str(v)) },
  submittedAt: { column: "submitted_at", coerce: (v) => (v ? v : null) },
  endStepSubmitted: { column: "end_step_submitted", coerce: (v) => v ?? null },
  expensesStepSubmitted: { column: "expenses_step_submitted", coerce: (v) => v ?? null },
  totalKm: { column: "total_km", coerce: (v) => (v == null ? null : num(v, 0)) },
  totalShops: { column: "total_shops", coerce: (v) => (v == null ? null : num(v, 0)) },
  totalWeight: { column: "total_weight", coerce: (v) => (v == null ? null : num(v, 0)) },
  totalDeliveredWeight: {
    column: "total_delivered_weight",
    coerce: (v) => (v == null ? null : num(v, 0)),
  },
  totalBirdsDelivered: {
    column: "total_birds_delivered",
    coerce: (v) => (v == null ? null : num(v, 0)),
  },
  totalMortality: { column: "total_mortality", coerce: (v) => (v == null ? null : num(v, 0)) },
  totalMortalityCount: {
    column: "total_mortality_count",
    coerce: (v) => (v == null ? null : num(v, 0)),
  },
  totalMortalityWeight: {
    column: "total_mortality_weight",
    coerce: (v) => (v == null ? null : num(v, 0)),
  },
  weightLoss: { column: "weight_loss", coerce: (v) => (v == null ? null : num(v, 0)) },
  survivalRate: { column: "survival_rate", coerce: (v) => (v == null ? null : num(v, 0)) },
  lastShop: { column: "last_shop", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  rateCompleted: { column: "rate_completed", coerce: (v) => v ?? null },
  deleted: { column: "deleted", coerce: (v) => v ?? null },
  deletedReason: { column: "deleted_reason", coerce: (v) => (v == null || v === "" ? null : str(v)) },
  approvedBy: { column: "approved_by", coerce: (v) => (v == null || v === "" ? null : str(v)) },
};

async function applyTripPatch(
  client: Client,
  tripId: number,
  body: Record<string, unknown>
): Promise<void> {
  const setParts: string[] = ["updated_at = NOW()", "version = version + 1"];
  const params: unknown[] = [tripId];
  let idx = 2;

  for (const [key, spec] of Object.entries(TRIP_PATCH_FIELDS)) {
    if (hasOwn(body, key)) {
      setParts.push(`${spec.column} = $${idx}`);
      params.push(spec.coerce(body[key]));
      idx++;
    }
  }

  await client.query(`UPDATE trips SET ${setParts.join(", ")} WHERE id = $1`, params);
}

function validateStartStepPayload(body: Partial<Trip> & Record<string, unknown>): void {
  const missing: string[] = [];
  if (!body.vehicleId || !body.vehicleNo) missing.push("Vehicle");
  if (!body.driverId || !body.driverName) missing.push("Driver");
  if (!body.supervisorId || !body.supervisorName) missing.push("Supervisor");
  if (!Array.isArray(body.helpers) || body.helpers.length === 0) missing.push("Helper");
  if (!Array.isArray(body.loaders) || body.loaders.length === 0) missing.push("Loader");
  if (
    !hasOwn(body, "openingMeter") ||
    body.openingMeter == null ||
    !Number.isFinite(Number(body.openingMeter))
  ) {
    missing.push("Opening KM");
  }
  if (
    !hasOwn(body, "advanceAmount") ||
    body.advanceAmount == null ||
    !Number.isFinite(Number(body.advanceAmount)) ||
    Number(body.advanceAmount) < 0
  ) {
    missing.push("Advance");
  }
  if (missing.length > 0) {
    throw new AppError(400, `Missing or invalid Step 1 fields: ${missing.join(", ")}`);
  }
}

function validateWizardStepPayload(
  step: "start" | "farm" | "pickup" | "deliveries" | "expenses",
  body: Partial<Trip> & Record<string, unknown>
): void {
  if (step === "start") {
    validateStartStepPayload(body);
    return;
  }
  if (step === "farm") {
    if (!Number(body.sourceFarmId) || !str(body.sourceFarm)) {
      throw new AppError(400, "Farm is required");
    }
    if (!Number(body.destMeter) || Number(body.destMeter) <= Number(body.openingMeter ?? 0)) {
      throw new AppError(400, "Destination meter must be greater than the opening meter");
    }
    if (Number(body.avgBirdWeight) <= 0) {
      throw new AppError(400, "Average bird weight must be greater than zero");
    }
    return;
  }
  if (step === "pickup") {
    const boxes = Array.isArray(body.boxDetails) ? body.boxDetails : [];
    if (!boxes.length || boxes.some((box) => Number(box.birds) <= 0 || Number(box.weight) <= 0)) {
      throw new AppError(400, "At least one complete pickup box is required");
    }
    return;
  }
  if (step === "deliveries") {
    const deliveries = Array.isArray(body.deliveries) ? body.deliveries : [];
    if (!deliveries.length) {
      throw new AppError(400, "At least one delivery is required");
    }
    return;
  }
  const closingMeter = Number(body.closingMeter ?? body.endMeter ?? 0);
  if (!closingMeter || closingMeter <= Number(body.openingMeter ?? 0)) {
    throw new AppError(400, "End meter must be greater than the opening meter");
  }
}

async function replaceBoxes(client: Client, tripId: number, boxes: BoxDetail[] = []) {
  await client.query(`DELETE FROM trip_boxes WHERE trip_id = $1`, [tripId]);
  for (const box of boxes) {
    await client.query(
      `INSERT INTO trip_boxes (trip_id, box_no, birds, weight) VALUES ($1,$2,$3,$4)`,
      [tripId, box.boxNo, box.birds ?? 0, box.weight ?? 0]
    );
  }
}

async function replaceDeliveries(client: Client, tripId: number, deliveries: ShopDelivery[] = []) {
  const previous = (await client.query('SELECT * FROM trip_deliveries WHERE trip_id=$1', [tripId])).rows;
  const kept: number[] = [];
  const seen = new Set<string>();
  for (const [index,d] of deliveries.entries()) {
    const old = d.id && d.id > 0 ? previous.find(r => Number(r.id) === d.id) : undefined;
    if (d.id && d.id > 0 && !old) throw new AppError(409, 'Delivery no longer belongs to this trip; refresh');
    const key = old?.client_key || d.clientKey || randomUUID();
    if (seen.has(key)) throw new AppError(400, 'Duplicate delivery identity');
    seen.add(key);
    const order = (await client.query('SELECT id FROM trip_order_rows WHERE trip_id=$1 AND shop_id=$2 AND assigned_boxes>0', [tripId,d.shopId])).rows[0];
    const captured = old?.auto_capture_time || (d.capture || d.autoCaptureTime ? new Date().toISOString() : null);
    const inserted = await client.query(`INSERT INTO trip_deliveries(
      trip_id,client_key,order_row_id,serial_no,box_no,shop_id,shop_name,bird_type_id,bird_type,
      birds,weight,mortality,mort_kg,rate,amount,remarks,delivery_mode,farm_birds,farm_weight,auto_capture_time)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT(trip_id,client_key) DO UPDATE SET
      serial_no=EXCLUDED.serial_no,box_no=EXCLUDED.box_no,shop_id=EXCLUDED.shop_id,shop_name=EXCLUDED.shop_name,
      bird_type_id=EXCLUDED.bird_type_id,bird_type=EXCLUDED.bird_type,birds=EXCLUDED.birds,weight=EXCLUDED.weight,
      mortality=EXCLUDED.mortality,mort_kg=EXCLUDED.mort_kg,rate=EXCLUDED.rate,amount=EXCLUDED.amount,
      remarks=EXCLUDED.remarks,delivery_mode=EXCLUDED.delivery_mode,farm_birds=EXCLUDED.farm_birds,
      farm_weight=EXCLUDED.farm_weight,auto_capture_time=EXCLUDED.auto_capture_time RETURNING id`,
      [tripId,key,order?.id ?? null,d.serialNo ?? index+1,d.boxNo ?? 0,d.shopId || null,d.shopName ?? '',
       d.birdTypeId || null,d.birdType ?? '',d.birds ?? 0,d.weight ?? 0,d.mortality ?? 0,d.mortKg ?? 0,
       d.rate ?? null,d.amount ?? 0,order ? `[ORDER] O:${tripId}` : (d.remarks ?? ''),d.deliveryMode ?? 'box',
       d.farmBirds ?? null,d.farmWeight ?? null,captured]);
    const id=Number(inserted.rows[0].id); kept.push(id);
    await client.query('DELETE FROM trip_delivery_boxes WHERE delivery_id=$1',[id]);
    await client.query('DELETE FROM trip_delivery_per_box WHERE delivery_id=$1',[id]);
    for (const boxNo of new Set(d.selectedBoxIds ?? [])) await client.query('INSERT INTO trip_delivery_boxes(delivery_id,box_no) VALUES($1,$2)',[id,boxNo]);
    for (const b of d.perBoxData ?? []) await client.query('INSERT INTO trip_delivery_per_box(delivery_id,box_no,birds,weight) VALUES($1,$2,$3,$4)',[id,b.boxNo,b.birds,b.weight]);
  }
  await client.query('DELETE FROM trip_deliveries WHERE trip_id=$1 AND NOT(id=ANY($2::int[]))',[tripId,kept]);
  await client.query(`UPDATE trips SET total_shops=x.shops,total_birds_delivered=x.birds,total_delivered_weight=x.weight,
    total_mortality_count=x.mortality,total_mortality_weight=x.mort_kg FROM
    (SELECT COUNT(DISTINCT shop_id) shops,COALESCE(SUM(birds),0) birds,COALESCE(SUM(weight),0) weight,
     COALESCE(SUM(mortality),0) mortality,COALESCE(SUM(mort_kg),0) mort_kg
     FROM trip_deliveries WHERE trip_id=$1 AND auto_capture_time IS NOT NULL) x WHERE id=$1`,[tripId]);
}

async function replaceDiesel(
  client: Client,
  tripId: number,
  entries: DieselEntry[] = []
) {
  await client.query(`DELETE FROM trip_diesel_entries WHERE trip_id = $1`, [tripId]);
  for (const e of entries) {
    await client.query(
      `INSERT INTO trip_diesel_entries (
         trip_id, row_index, litres, rate, meter, bunk_name, bunk_gps, image_data, image_name, client_key
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        tripId,
        e.rowIndex,
        e.litres ?? null,
        e.rate ?? null,
        e.meter ?? null,
        e.bunkName ?? null,
        e.bunkGps ?? null,
        e.imageData ?? null,
        e.imageName ?? null,
        e.clientKey || `legacy:${e.rowIndex}`,
      ]
    );
  }
}

function extractDieselFromBody(body: Record<string, unknown>): DieselEntry[] {
  if (Array.isArray(body.dieselEntries)) {
    return body.dieselEntries as DieselEntry[];
  }

  const indices = new Set<number>();
  for (const key of Object.keys(body)) {
    const match = key.match(/^dieselLtr(\d+)$/);
    if (match) indices.add(Number(match[1]));
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((rowIndex) => ({
      rowIndex,
      litres: numOrNull(body[`dieselLtr${rowIndex}`]),
      rate: numOrNull(body[`dieselRate${rowIndex}`]),
      meter: numOrNull(body[`dieselMeter${rowIndex}`]),
      bunkName: body[`dieselBunk${rowIndex}`]
        ? str(body[`dieselBunk${rowIndex}`])
        : null,
      bunkGps: body[`dieselBunkGps${rowIndex}`]
        ? str(body[`dieselBunkGps${rowIndex}`])
        : null,
      imageData: body[`dieselImage${rowIndex}`]
        ? str(body[`dieselImage${rowIndex}`])
        : null,
      imageName: body[`dieselImageName${rowIndex}`]
        ? str(body[`dieselImageName${rowIndex}`])
        : null,
    }));
}

function flattenDiesel(entries: DieselEntry[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of entries) {
    out[`dieselLtr${e.rowIndex}`] = e.litres;
    out[`dieselRate${e.rowIndex}`] = e.rate;
    out[`dieselMeter${e.rowIndex}`] = e.meter;
    out[`dieselBunk${e.rowIndex}`] = e.bunkName;
    out[`dieselImage${e.rowIndex}`] = e.imageData;
    out[`dieselImageName${e.rowIndex}`] = e.imageName;
  }
  return out;
}

export const tripsService = {
  async list(filters: {
    fromDate?: string;
    toDate?: string;
    status?: string;
    vehicleId?: number;
    includeDeleted?: boolean;
  } = {}) {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!filters.includeDeleted) {
      clauses.push(`deleted = FALSE`);
    }
    if (filters.fromDate) {
      params.push(filters.fromDate);
      clauses.push(`trip_date >= $${params.length}`);
    }
    if (filters.toDate) {
      params.push(filters.toDate);
      clauses.push(`trip_date <= $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }
    if (filters.vehicleId) {
      params.push(filters.vehicleId);
      clauses.push(`vehicle_id = $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await query(
      `SELECT * FROM trips ${where} ORDER BY trip_date DESC, id DESC`,
      params
    );

    return withTransaction(async (client) => {
      const trips: Trip[] = [];
      for (const row of result.rows) {
        trips.push(await hydrateTrip(client, row));
      }
      return trips.map((t) => ({ ...t, ...flattenDiesel(t.dieselEntries ?? []) }));
    });
  },

  async getById(id: number) {
    const result = await query(`SELECT * FROM trips WHERE id = $1`, [id]);
    if (!result.rowCount) throw new AppError(404, `Trip ${id} not found`);
    return withTransaction(async (client) => {
      const trip = await hydrateTrip(client, result.rows[0]);
      return { ...trip, ...flattenDiesel(trip.dieselEntries ?? []) };
    });
  },

  /** Persist a complete, validated Step 1 as one permanent transaction. */
  async createSubmittedStartStep(body: Partial<Trip> & Record<string, unknown>) {
    validateStartStepPayload(body);
    const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const previousMeter = await this.lastClosingMeter(Number(body.vehicleId));
    if (
      previousMeter &&
      Number(body.openingMeter) < previousMeter.closingMeter
    ) {
      throw new AppError(
        400,
        `Starting KM must be >= ${previousMeter.closingMeter} KM`
      );
    }
    return this.save(null, {
      ...body,
      requestHash,
      startStepSubmitted: true,
      startTime: body.startTime ?? new Date().toISOString(),
      status: (body.status as TripStatus) ?? "Draft",
    });
  },

  /** Full upsert used by wizard autosave / step submits */
  async save(id: number | null, body: Partial<Trip> & Record<string, unknown>, transactionClient?: Client): Promise<Trip> {
    const work = async (client: Client) => {
      if (id != null) {
        if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'A real trip ID is required');
        const current = (await client.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!current || current.deleted) throw new AppError(404, 'Trip not found');
        if (body.expectedVersion != null && Number(body.expectedVersion) !== Number(current.version)) throw new AppError(409, 'Trip changed. Refresh and retry.');
      }
      if (id == null && body.requestKey) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(body.requestKey)]);
        const existing = (await client.query('SELECT * FROM trips WHERE request_key=$1', [body.requestKey])).rows[0];
        if (existing) {
          if (existing.request_hash !== body.requestHash) throw new AppError(409, 'Submission already saved with different values. Refresh Recent Trips.');
          return hydrateTrip(client, existing);
        }
      }
      let tripId = id;

      if (!tripId) {
        const tripDate =
          dateOnly(body.tripDate) ??
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const tripNo = await generateTripNo(client, tripDate);
        const inserted = await client.query(
          `INSERT INTO trips (trip_no, trip_date, status,request_key,request_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [tripNo, tripDate, "Draft", body.requestKey ?? null, body.requestHash ?? null]
        );
        tripId = num(inserted.rows[0].id);
      }

      const dieselEntries = extractDieselFromBody(body);

      await applyTripPatch(client, tripId, body as Record<string, unknown>);

      if (hasOwn(body, "helpers")) {
        await replaceCrewRole(client, tripId, "helper", (body.helpers as string[]) ?? []);
      }
      if (hasOwn(body, "loaders")) {
        await replaceCrewRole(client, tripId, "loader", (body.loaders as string[]) ?? []);
      }
      if (body.boxDetails) {
        await replaceBoxes(client, tripId, body.boxDetails as BoxDetail[]);
      }
      if (body.deliveries) {
        await replaceDeliveries(client, tripId, body.deliveries as ShopDelivery[]);
      }
      if (dieselEntries.length || body.dieselEntries) {
        await replaceDiesel(client, tripId, dieselEntries);
      }

      if (body.dcPhotoData && body.dcPhotoKey) {
        await client.query(
          `INSERT INTO trip_media (trip_id, media_key, media_type, mime_type, data_base64)
           VALUES ($1,$2,'image',$3,$4)
           ON CONFLICT (trip_id, media_key) DO UPDATE
             SET data_base64 = EXCLUDED.data_base64, mime_type = EXCLUDED.mime_type`,
          [
            tripId,
            str(body.dcPhotoKey),
            body.dcPhotoMime ?? "image/jpeg",
            str(body.dcPhotoData),
          ]
        );
      }

      const row = await client.query(`SELECT * FROM trips WHERE id = $1`, [tripId]);
      const trip = await hydrateTrip(client, row.rows[0]);
      return { ...trip, ...flattenDiesel(trip.dieselEntries ?? []) };
    };
    return transactionClient ? work(transactionClient) : withTransaction(work);
  },

  async saveWizardStep(
    id: number,
    step: "start" | "farm" | "pickup" | "deliveries" | "expenses",
    body: Partial<Trip> & Record<string, unknown>,
    mode: "save" | "submit"
  ) {
    return withTransaction(async (client) => {
      if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'A real Trip Entry trip ID is required');
      const raw=(await client.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if (!raw || raw.deleted) throw new AppError(404, 'Trip not found');
      if (body.ordersAction) {
        await writeTripOrders(client,raw,body);
        return hydrateTrip(client,(await client.query('SELECT * FROM trips WHERE id=$1',[id])).rows[0]);
      }
      if (raw.status !== 'Draft') throw new AppError(409, 'Submitted trips are read-only');
      const current=await hydrateTrip(client,raw);
      const allowed: Record<string,string[]> = {
        start:['tripDate','vehicleId','vehicleNo','driverId','driverName','supervisorId','supervisorName','openingMeter','advanceAmount','helpers','loaders','remarks'],
        farm:['sourceFarmId','sourceFarm','farmAddress','farmBirdTypeId','farmBirdType','destMeter','pickupTolls','avgBirdWeight','farmGpsLat','farmGpsLon','farmGpsAccuracy','farmGpsTime','remarks'],
        pickup:['boxDetails','dcWeight','totalBirds','boxes','avgWeight','dcPhotoKey','dcPhotoData','dcPhotoMime','pickupBoxWrite','removedBoxNos'],
        deliveries:['deliveries'],
        expenses:['closingMeter','endMeter','destinationTolls','deliveryTolls','meals','loading','mealsTiffin','vehicleMaintenance','othersRC','others1Amt','others2Amt','others3Amt','others4Amt','others5Amt','remarks']
      };
      const payload: Record<string,unknown> = {};
      for (const key of allowed[step]) if (hasOwn(body,key)) payload[key]=body[key];
      if (body.expectedVersion != null) payload.expectedVersion=body.expectedVersion;
      if (mode === 'submit') {
        const previous: Record<string,string>={farm:'startStepSubmitted',pickup:'farmStepSubmitted',deliveries:'pickupStepSubmitted',expenses:'deliveryStepSubmitted'};
        if (previous[step] && !current[previous[step] as keyof Trip]) throw new AppError(409,'Submit the preceding Trip Entry step first');
        validateWizardStepPayload(step,{...current,...payload});
        const flags: Record<string,Record<string,unknown>>={
          start:{startStepSubmitted:true},farm:{farmStepSubmitted:true,reachedTime:new Date().toISOString()},
          pickup:{pickupStepSubmitted:true,pickupLoadTime:new Date().toISOString()},deliveries:{deliveryStepSubmitted:true},
          expenses:{expensesStepSubmitted:true,endStepSubmitted:true,status:'Pending',submittedAt:new Date().toISOString(),endTime:new Date().toISOString()}
        };
        Object.assign(payload,flags[step]);
      }
      if (step === 'start' && raw.start_step_submitted) payload.startStepSubmitted=true;
      if (step === 'deliveries' && (current.orderAssignments?.length ?? 0)>0 && !current.assignmentSubmitted) throw new AppError(409,'Submit the WhatsApp-confirmed assignment before delivery');
      if (step === 'pickup' && body.pickupBoxWrite === 'upsert') {
        const boxes=new Map((current.boxDetails ?? []).map(b => [b.boxNo,b]));
        for (const b of (body.boxDetails ?? []) as BoxDetail[]) boxes.set(b.boxNo,b);
        for (const boxNo of (body.removedBoxNos ?? []) as number[]) boxes.delete(boxNo);
        payload.boxDetails=[...boxes.values()];
      }
      return this.save(id,payload,client);
    });
  },

  async softDelete(id: number, reason?: string) {
    const result = await query(
      `UPDATE trips SET deleted = TRUE, deleted_reason = $2, status = 'Deleted'
       WHERE id = $1 RETURNING id`,
      [id, reason ?? null]
    );
    if (!result.rowCount) throw new AppError(404, `Trip ${id} not found`);
    return { id, deleted: true };
  },

  async lastClosingMeter(vehicleId: number) {
    const result = await query(
      `SELECT closing_meter, end_meter, trip_no, trip_date
       FROM trips
       WHERE vehicle_id = $1 AND deleted = FALSE AND closing_meter IS NOT NULL
       ORDER BY trip_date DESC, id DESC
       LIMIT 1`,
      [vehicleId]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return {
      closingMeter: num(row.closing_meter ?? row.end_meter),
      tripNo: str(row.trip_no),
      tripDate: dateOnly(row.trip_date),
    };
  },
};
