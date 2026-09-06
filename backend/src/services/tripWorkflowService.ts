import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { tripsService } from './tripsService.js';

export async function availableTripResources(excludeTripId = 0) {
  const [vehicles, employees, busy] = await Promise.all([
    query("SELECT id,vehicle_number AS \"vehicleNumber\" FROM vehicles WHERE status='Active' ORDER BY id"),
    query("SELECT id,employee_name AS \"employeeName\",department FROM employees WHERE status='Active' ORDER BY id"),
    query('SELECT vehicle_id,driver_id,supervisor_id FROM trips WHERE NOT deleted AND NOT end_step_submitted AND id<>$1',[excludeTripId]),
  ]);
  const usedVehicles = new Set(busy.rows.map(r=>r.vehicle_id));
  const usedPeople = new Set(busy.rows.flatMap(r=>[r.driver_id,r.supervisor_id]));
  const people = employees.rows.filter(r=>!usedPeople.has(r.id));
  const role = (name: string) => people.filter(r=>String(r.department).toLowerCase().includes(name));
  return {vehicles:vehicles.rows.filter(r=>!usedVehicles.has(r.id)),drivers:role('driver'),supervisors:role('supervisor'),helpers:role('helper'),loaders:role('loader')};
}

export async function changeStatus(id: number, status: unknown, approvedBy: unknown) {
  await withTransaction(async client => {
    const trip=(await client.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if (!trip || trip.deleted) throw new AppError(404,'Trip not found');
    if (status === trip.status) return;
    if (status !== 'Completed' || trip.status !== 'Pending' || !trip.expenses_step_submitted || !trip.end_step_submitted) {
      throw new AppError(409,'Only a Step-5-submitted Pending trip can be approved as Completed');
    }
    await client.query("UPDATE trips SET status='Completed',approved_by=$2,version=version+1 WHERE id=$1",[id,typeof approvedBy==='string'?approvedBy:null]);
  });
  return tripsService.getById(id);
}

const dieselPayload = z.object({
  clientKey:z.string().min(1).max(150), litres:z.number().positive(),rate:z.number().positive(),meter:z.number().nonnegative(),
  bunkName:z.string().trim().min(1).max(200),gpsLat:z.number().min(-90).max(90),gpsLon:z.number().min(-180).max(180),
  gpsAccuracy:z.number().nonnegative().nullable().optional(),gpsCapturedAt:z.string().datetime().nullable().optional(),
  imageData:z.string().min(1).max(12_000_000),imageName:z.string().max(255).nullable().optional(),
});

export async function persistDiesel(tripId: number, body: unknown, entryId?: number, remove=false) {
  await withTransaction(async client=>{
    const trip=(await client.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE',[tripId])).rows[0];
    if (!trip || trip.deleted) throw new AppError(404,'Trip not found');
    if (trip.status!=='Draft' || trip.expenses_step_submitted) throw new AppError(409,'Step 5 is already submitted');
    const old=entryId?(await client.query('SELECT * FROM trip_diesel_entries WHERE id=$1 AND trip_id=$2',[entryId,tripId])).rows[0]:null;
    if (entryId && !old) throw new AppError(404,'Diesel row does not belong to this trip');
    if (remove) {
      await client.query('DELETE FROM fuel_expenses WHERE trip_id=$1 AND bill_no=$2',[tripId,`FUEL-${tripId}-${entryId}`]);
      await client.query('DELETE FROM trip_diesel_entries WHERE id=$1 AND trip_id=$2',[entryId,tripId]);
    } else {
      const parsed=dieselPayload.safeParse(body);
      if (!parsed.success) throw new AppError(400,'Invalid diesel bill',parsed.error.flatten());
      const d=parsed.data;
      if (d.meter < Number(trip.opening_meter)) throw new AppError(400,'Diesel meter cannot be below opening meter');
      if (!old) {
        const duplicate=(await client.query('SELECT * FROM trip_diesel_entries WHERE trip_id=$1 AND client_key=$2',[tripId,d.clientKey])).rows[0];
        if (duplicate) {
          if (Number(duplicate.litres)!==d.litres || Number(duplicate.rate)!==d.rate || Number(duplicate.meter)!==d.meter || duplicate.image_data!==d.imageData || duplicate.bunk_name!==d.bunkName) throw new AppError(409,'This diesel request is already saved with different values');
          return;
        }
      }
      const index=old?.row_index ?? Number((await client.query('SELECT COALESCE(MAX(row_index),0)+1 n FROM trip_diesel_entries WHERE trip_id=$1',[tripId])).rows[0].n);
      const amount=Number((d.litres*d.rate).toFixed(2));
      const row=(await client.query(`INSERT INTO trip_diesel_entries(trip_id,row_index,client_key,litres,rate,amount,meter,bunk_name,image_data,image_name,gps_lat,gps_lon,gps_accuracy,gps_captured_at,submitted_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()) ON CONFLICT(trip_id,row_index) DO UPDATE SET
        litres=EXCLUDED.litres,rate=EXCLUDED.rate,amount=EXCLUDED.amount,meter=EXCLUDED.meter,bunk_name=EXCLUDED.bunk_name,
        image_data=EXCLUDED.image_data,image_name=EXCLUDED.image_name,gps_lat=EXCLUDED.gps_lat,gps_lon=EXCLUDED.gps_lon,
        gps_accuracy=EXCLUDED.gps_accuracy,gps_captured_at=EXCLUDED.gps_captured_at RETURNING id`,
        [tripId,index,old?.client_key??d.clientKey,d.litres,d.rate,amount,d.meter,d.bunkName,d.imageData,d.imageName??null,d.gpsLat,d.gpsLon,d.gpsAccuracy??null,d.gpsCapturedAt??null])).rows[0];
      await client.query(`INSERT INTO fuel_expenses(bill_no,expense_date,trip_id,vehicle_id,vehicle_no,driver_id,driver_name,supervisor_id,supervisor_name,meter_reading,amount,rate,litres,petrol_bunk,image_data)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(bill_no) DO UPDATE SET
        meter_reading=EXCLUDED.meter_reading,amount=EXCLUDED.amount,rate=EXCLUDED.rate,litres=EXCLUDED.litres,petrol_bunk=EXCLUDED.petrol_bunk,image_data=EXCLUDED.image_data`,
        [`FUEL-${tripId}-${row.id}`,trip.trip_date,tripId,trip.vehicle_id,trip.vehicle_no,trip.driver_id,trip.driver_name,trip.supervisor_id,trip.supervisor_name,d.meter,amount,d.rate,d.litres,d.bunkName,d.imageData]);
    }
    await client.query('UPDATE trips SET version=version+1,fuel=(SELECT COALESCE(SUM(amount),0) FROM trip_diesel_entries WHERE trip_id=$1) WHERE id=$1',[tripId]);
  });
  return tripsService.getById(tripId);
}
