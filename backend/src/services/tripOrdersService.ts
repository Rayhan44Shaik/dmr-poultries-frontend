import { createHash } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

const orderRow = z.object({
  shopId: z.number().int().positive(),
  boxNo: z.number().int().min(0),
  birds: z.number().int().min(0).default(0),
  weight: z.number().min(0).default(0),
});
const orderWrite = z.object({
  ordersAction: z.enum(['collection', 'assignment']),
  mode: z.enum(['save', 'submit']),
  tripDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedVersion: z.number().int().min(0),
  deliveries: z.array(orderRow).max(500),
  finishCollection: z.boolean().optional(),
});

export async function loadTripOrders(client: pg.PoolClient, tripId: number) {
  const { rows } = await client.query(
    `SELECT o.*, s.shop_name, s.village FROM trip_order_rows o
     JOIN shops s ON s.id=o.shop_id WHERE o.trip_id=$1 ORDER BY o.serial_no, o.id`, [tripId]);
  const map = (r: Record<string, unknown>, assigned: boolean) => ({
    id: Number(r.id), orderRowId: Number(r.id), orderTripId: tripId,
    clientKey: `order:${r.id}`, shopId: Number(r.shop_id), shopName: String(r.shop_name),
    village: String(r.village ?? ""), serialNo: Number(assigned ? r.assignment_serial_no : r.serial_no),
    boxNo: Number(assigned ? r.assigned_boxes : r.boxes),
    birds: Number(assigned ? r.assigned_birds : r.birds),
    weight: Number(assigned ? r.assigned_weight : r.weight),
    birdTypeId: 0, birdType: '', mortality: 0, amount: 0, rate: null,
    remarks: `[ORDER] O:${tripId}`, selectedBoxIds: [], deliveryMode: 'box' as const,
  });
  return {
    ordersCollection: rows.map(r => map(r, false)),
    orderAssignments: rows.filter(r => Number(r.assigned_boxes) > 0).map(r => map(r, true)),
  };
}

export async function writeTripOrders(client: pg.PoolClient, trip: Record<string, unknown>, body: unknown) {
  const result = orderWrite.safeParse(body);
  if (!result.success) throw new AppError(400, 'Invalid collection/assignment', result.error.flatten());
  const input = result.data;
  const id = Number(trip.id);
  const day = trip.trip_date instanceof Date ? trip.trip_date.toISOString().slice(0, 10) : String(trip.trip_date).slice(0, 10);
  if (input.tripDate !== day) throw new AppError(409, 'Selected trip and collection day do not match');
  if (Number(trip.version) !== input.expectedVersion) throw new AppError(409, 'Trip changed. Refresh before saving again.');
  if (!trip.start_step_submitted || !trip.vehicle_id) throw new AppError(409, 'Submit Trip Entry Step 1 first');
  if (trip.deleted || trip.status !== 'Draft' || trip.expenses_step_submitted) throw new AppError(409, 'This trip is read-only');
  const shops = input.deliveries.map(r => r.shopId);
  if (new Set(shops).size !== shops.length) throw new AppError(400, 'Duplicate shop in this trip collection/assignment');
  const existing = (await client.query('SELECT * FROM trip_order_rows WHERE trip_id=$1 ORDER BY serial_no', [id])).rows;
  if (input.ordersAction === 'collection') {
    if (trip.collection_finished || trip.assignment_submitted) throw new AppError(409, 'Collection is locked');
    for (const previous of existing) {
      const next = input.deliveries.find(r => r.shopId === Number(previous.shop_id));
      if (Number(previous.assigned_boxes) > (next?.boxNo ?? 0)) throw new AppError(409, 'Collected boxes cannot be below saved assignment boxes');
    }
    await client.query('DELETE FROM trip_order_rows WHERE trip_id=$1 AND NOT(shop_id=ANY($2::int[]))', [id, shops]);
    for (const [index, row] of input.deliveries.entries()) {
      await client.query(`INSERT INTO trip_order_rows(trip_id,shop_id,serial_no,boxes,birds,weight)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(trip_id,shop_id) DO UPDATE SET
        serial_no=EXCLUDED.serial_no, boxes=EXCLUDED.boxes, birds=EXCLUDED.birds, weight=EXCLUDED.weight`,
      [id,row.shopId,index+1,row.boxNo,row.birds,row.weight]);
    }
    await client.query('UPDATE trips SET collection_finished=$2 WHERE id=$1', [id, input.finishCollection === true]);
  } else {
    if (trip.assignment_submitted) throw new AppError(409, 'Assignment is already submitted');
    if (!input.deliveries.length) throw new AppError(400, 'Select at least one collected shop');
    const capacity = Number((await client.query('SELECT no_of_boxes FROM vehicles WHERE id=$1', [trip.vehicle_id])).rows[0]?.no_of_boxes ?? 0);
    if (input.deliveries.reduce((sum,r) => sum+r.boxNo,0) > capacity) throw new AppError(400, 'Assignment exceeds vehicle box capacity');
    for (const row of input.deliveries) {
      const source = existing.find(r => Number(r.shop_id) === row.shopId);
      if (!source || row.boxNo <= 0 || row.boxNo > Number(source.boxes)) throw new AppError(400, 'Assignment must reference saved collection quantities on this trip');
    }
    const captured = await client.query('SELECT 1 FROM trip_deliveries WHERE trip_id=$1 AND auto_capture_time IS NOT NULL LIMIT 1', [id]);
    if (captured.rowCount) throw new AppError(409, 'Cannot replace assignments after delivery has started');
    await client.query('UPDATE trip_order_rows SET assigned_boxes=0,assigned_birds=0,assigned_weight=0,assignment_serial_no=NULL WHERE trip_id=$1', [id]);
    await client.query('DELETE FROM trip_deliveries WHERE trip_id=$1 AND order_row_id IS NOT NULL AND auto_capture_time IS NULL AND NOT(shop_id=ANY($2::int[]))', [id, shops]);
    for (const [index, row] of input.deliveries.entries()) {
      const source = existing.find(r => Number(r.shop_id) === row.shopId)!;
      await client.query('UPDATE trip_order_rows SET assigned_boxes=$2,assigned_birds=$3,assigned_weight=$4,assignment_serial_no=$5 WHERE id=$1',
        [source.id,row.boxNo,row.birds,row.weight,index+1]);
      const shop = (await client.query('SELECT shop_name FROM shops WHERE id=$1', [row.shopId])).rows[0];
      await client.query(`INSERT INTO trip_deliveries(trip_id,client_key,order_row_id,serial_no,box_no,shop_id,shop_name,birds,weight,farm_birds,farm_weight,remarks)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$8,$9,$10)
        ON CONFLICT(trip_id,client_key) DO UPDATE SET serial_no=EXCLUDED.serial_no,box_no=EXCLUDED.box_no,
        birds=EXCLUDED.birds,weight=EXCLUDED.weight,farm_birds=EXCLUDED.farm_birds,farm_weight=EXCLUDED.farm_weight`,
      [id,`assignment:${source.id}`,source.id,index+1,row.boxNo,row.shopId,shop.shop_name,row.birds,row.weight,`[ORDER] O:${id}`]);
    }
  }
  const state = (await client.query(`SELECT shop_id,serial_no,boxes,birds,weight,assigned_boxes,assigned_birds,assigned_weight,assignment_serial_no
    FROM trip_order_rows WHERE trip_id=$1 ORDER BY shop_id`, [id])).rows;
  const hash = createHash('sha256').update(JSON.stringify({tripId:id,rows:state})).digest('hex');
  if (input.ordersAction === 'assignment' && input.mode === 'submit' && trip.whatsapp_confirmed_hash !== hash) {
    throw new AppError(409, 'Confirm & Send WhatsApp successfully for this exact assignment before submitting');
  }
  await client.query(`UPDATE trips SET orders_hash=$2, assignment_submitted=$3, version=version+1,
    whatsapp_confirmed_hash=CASE WHEN whatsapp_confirmed_hash=$2 THEN whatsapp_confirmed_hash ELSE NULL END
    WHERE id=$1`, [id,hash,input.ordersAction === 'assignment' && input.mode === 'submit']);
}
