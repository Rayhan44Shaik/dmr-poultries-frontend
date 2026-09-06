import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl=process.env.DATABASE_URL;
const base=process.env.TEST_API_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_integration') || !base) {
  throw new Error('Use a dedicated *_integration PostgreSQL database and TEST_API_URL; never run against production');
}
const pool=new pg.Pool({connectionString:databaseUrl});
async function request(path:string,body?:unknown,method=body===undefined?'GET':'POST',key?:string) {
  const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json() as Record<string,any>;
  return {status:response.status,data};
}
async function ok(path:string,body?:unknown,method?:string,key?:string) {
  const result=await request(path,body,method,key);assert.ok(result.status>=200 && result.status<300,`${path}: ${result.status} ${JSON.stringify(result.data)}`);return result.data;
}

// These fixtures are inserted ONLY into the dedicated verification database.
// The app database is never seeded and no server can fall back to these rows.
test('native PostgreSQL Trip → Orders persistence, identities, concurrency and lifecycle',async t=>{
  const tag=`Integration-${randomUUID()}`;
  const created:{trips:number[];shops:number[];employees:number[];vehicles:number[];farms:number[];birds:number[]}={trips:[],shops:[],employees:[],vehicles:[],farms:[],birds:[]};
  try {
    const employee=async(role:string)=>{
      const r=(await pool.query(`INSERT INTO employees(employee_no,employee_name,department,phone_number)
        VALUES((SELECT COALESCE(MAX(employee_no),0)+1 FROM employees),$1,$2,'') RETURNING *`,[`${tag}-${role}`,role])).rows[0];created.employees.push(r.id);return r;
    };
    const driver=await employee('Driver'),supervisor=await employee('Supervisor'),helper=await employee('Helper'),loader=await employee('Loader');
    const vehicle=(await pool.query(`INSERT INTO vehicles(vehicle_no,vehicle_number,no_of_boxes)
      VALUES((SELECT COALESCE(MAX(vehicle_no),0)+1 FROM vehicles),$1,100) RETURNING *`,[tag])).rows[0];created.vehicles.push(vehicle.id);
    const farm=(await pool.query(`INSERT INTO farms(farm_no,farm_name) VALUES((SELECT COALESCE(MAX(farm_no),0)+1 FROM farms),$1) RETURNING *`,[tag])).rows[0];created.farms.push(farm.id);
    const bird=(await pool.query(`INSERT INTO bird_types(bird_type_no,bird_type) VALUES((SELECT COALESCE(MAX(bird_type_no),0)+1 FROM bird_types),$1) RETURNING *`,[tag])).rows[0];created.birds.push(bird.id);
    for(let i=0;i<7;i++) {
      const shop=(await pool.query(`INSERT INTO shops(shop_no,shop_name,village) VALUES((SELECT COALESCE(MAX(shop_no),0)+1 FROM shops),$1,'Test locality') RETURNING id`,[`${tag}-shop-${i+1}`])).rows[0];created.shops.push(shop.id);
    }
    const start={tripDate:'2026-09-06',vehicleId:vehicle.id,vehicleNo:vehicle.vehicle_number,driverId:driver.id,driverName:driver.employee_name,
      supervisorId:supervisor.id,supervisorName:supervisor.employee_name,helpers:[helper.employee_name],loaders:[loader.employee_name],openingMeter:100,advanceAmount:0};
    const key=randomUUID();
    const concurrent=await Promise.all([ok('/trips/steps/start',start,'POST',key),ok('/trips/steps/start',start,'POST',key)]);
    let a=concurrent[0];created.trips.push(a.id);assert.equal(a.id,concurrent[1].id);
    await t.test('Step 1 concurrent retries create exactly one backend ID and Recent row',async()=>{
      const listed=await ok('/trips');assert.equal((listed as any).filter((r:any)=>r.id===a.id).length,1);
      assert.equal((await pool.query('SELECT COUNT(*) n FROM trips WHERE request_key=$1',[key])).rows[0].n,'1');
      assert.equal(a.status,'Draft');assert.equal(a.startStepSubmitted,true);
      assert.equal((await request('/trips/0/steps/deliveries',{mode:'save',deliveries:[]})).status,400);
    });
    // Separate real trips on the same day and previous day: collection identity is never date/crew.
    const b=await ok('/trips/steps/start',start,'POST',randomUUID());created.trips.push(b.id);
    const c=await ok('/trips/steps/start',{...start,tripDate:'2026-09-05'},'POST',randomUUID());created.trips.push(c.id);
    const collection=created.shops.slice(0,6).map((shopId,i)=>({shopId,boxNo:1,birds:10,weight:15,serialNo:i+1}));
    const orderBody=(trip:any,rows:any[],action='collection',mode='save')=>({ordersAction:action,mode,tripDate:trip.tripDate,expectedVersion:trip.version,deliveries:rows});
    a=await ok(`/trips/${a.id}/steps/deliveries`,orderBody(a,collection));
    await t.test('saved collection survives a new GET, without Finish or an ORD trip',async()=>{
      a=await ok(`/trips/${a.id}`);assert.equal(a.ordersCollection.length,6);assert.equal(a.collectionFinished,false);
      assert.equal((await ok(`/trips/${b.id}`)).ordersCollection.length,0);assert.equal((await ok(`/trips/${c.id}`)).ordersCollection.length,0);
      assert.equal((await pool.query("SELECT COUNT(*) n FROM trips WHERE trip_no LIKE 'ORD-%'")).rows[0].n,'0');
      assert.deepEqual(a.ordersCollection.map((r:any)=>r.orderTripId),Array(6).fill(a.id));
    });
    await t.test('invalid/stale/concurrent saves do not duplicate or overwrite rows',async()=>{
      assert.equal((await request(`/trips/${a.id}/steps/deliveries`,orderBody({...a,tripDate:'2026-09-05'},collection))).status,409);
      assert.equal((await request(`/trips/${a.id}/steps/deliveries`,orderBody(a,[collection[0],collection[0]]))).status,400);
      const parallel=await Promise.all([request(`/trips/${a.id}/steps/deliveries`,orderBody(a,collection)),request(`/trips/${a.id}/steps/deliveries`,orderBody(a,collection))]);
      assert.deepEqual(parallel.map(r=>r.status).sort(),[200,409]);a=await ok(`/trips/${a.id}`);
      assert.equal((await pool.query('SELECT COUNT(*) n FROM trip_order_rows WHERE trip_id=$1',[a.id])).rows[0].n,'6');
    });
    a=await ok(`/trips/${a.id}/steps/farm`,{mode:'submit',sourceFarmId:farm.id,sourceFarm:farm.farm_name,destMeter:110,avgBirdWeight:1.5,farmBirdTypeId:bird.id,farmBirdType:bird.bird_type});
    a=await ok(`/trips/${a.id}/steps/pickup`,{mode:'submit',boxDetails:collection.map((_,i)=>({boxNo:i+1,birds:10,weight:15})),dcWeight:90,totalBirds:60,boxes:6,avgWeight:1.5});
    a=await ok(`/trips/${a.id}/steps/deliveries`,orderBody(a,collection,'assignment'));
    const assignmentDeliveryIds=a.deliveries.map((r:any)=>r.id);
    a=await ok(`/trips/${a.id}/steps/deliveries`,orderBody(a,collection,'assignment'));
    await t.test('assignment save persists stable IDs; WhatsApp failure cannot submit assignment or Step 4',async()=>{
      assert.deepEqual(a.deliveries.map((r:any)=>r.id),assignmentDeliveryIds);
      assert.equal(a.orderAssignments.length,6);assert.equal(a.assignmentSubmitted,false);assert.equal(a.deliveryStepSubmitted,false);
      const rejected=await request(`/trips/${a.id}/steps/deliveries`,orderBody(a,collection,'assignment','submit'));assert.equal(rejected.status,409);
      const whatsapp=await request(`/trips/${a.id}/whatsapp`,{ordersHash:a.ordersHash,pdfBase64:'JVBERi0='});assert.equal(whatsapp.status,503);
      a=await ok(`/trips/${a.id}`);assert.equal(a.assignmentSubmitted,false);assert.equal(a.deliveryStepSubmitted,false);
    });
    // Explicit TEST FIXTURE for the downstream boundary. No real WhatsApp send is
    // claimed: the unconfigured provider above is a hard BLOCKED integration gap.
    await pool.query("UPDATE trips SET whatsapp_confirmed_hash=orders_hash,whatsapp_message_id='TEST-FIXTURE-NOT-A-REAL-SEND' WHERE id=$1",[a.id]);
    a=await ok(`/trips/${a.id}/steps/deliveries`,orderBody(a,collection,'assignment','submit'));
    await t.test('with a test-only prior receipt, assignment submit does not submit delivery or finish the trip',async()=>{
      assert.equal(a.assignmentSubmitted,true);assert.equal(a.deliveryStepSubmitted,false);assert.equal(a.status,'Draft');
    });
    for(let i=0;i<6;i++) {
      const deliveries=a.deliveries.map((r:any,index:number)=>({...r,capture:index<=i,birdTypeId:bird.id,birdType:bird.bird_type,selectedBoxIds:[index+1]}));
      a=await ok(`/trips/${a.id}/deliveries`,{deliveries,expectedVersion:a.version},'PUT');
      const reloaded=await ok(`/trips/${a.id}`);
      assert.equal(reloaded.deliveries.filter((r:any)=>r.autoCaptureTime).length,i+1);
      assert.equal(reloaded.deliveries.filter((r:any)=>!r.autoCaptureTime).length,5-i);
      assert.equal(reloaded.totalBirdsDelivered,(i+1)*10);assert.equal(reloaded.status,'Draft');
      assert.equal(reloaded.ordersCollection.length,6);assert.equal(reloaded.orderAssignments.length,6);
    }
    await t.test('all six real deliveries persist with stable IDs; unassigned shops are not hidden',async()=>{
      assert.deepEqual(a.deliveries.map((r:any)=>r.id),assignmentDeliveryIds);
      const extra={shopId:created.shops[6],shopName:`${tag}-shop-7`,boxNo:1,birds:1,weight:1.5,birdTypeId:bird.id,capture:true,clientKey:randomUUID()};
      a=await ok(`/trips/${a.id}/deliveries`,{deliveries:[...a.deliveries,extra],expectedVersion:a.version},'PUT');
      const unassigned=a.deliveries.find((r:any)=>r.shopId===created.shops[6]);assert.ok(unassigned.autoCaptureTime);assert.equal(unassigned.orderRowId,null);
      assert.equal(a.orderAssignments.length,6);assert.equal(a.deliveries.length,7);
    });
    a=await ok(`/trips/${a.id}/steps/deliveries`,{mode:'submit',deliveries:a.deliveries,expectedVersion:a.version});
    await t.test('Step 4 stays Draft and Step 5 bill upload is idempotent and persisted',async()=>{
      assert.equal(a.status,'Draft');assert.equal(a.deliveryStepSubmitted,true);assert.equal(a.endStepSubmitted,false);
      const bill={clientKey:randomUUID(),litres:10,rate:100,meter:120,bunkName:tag,gpsLat:16.5,gpsLon:80.6,gpsAccuracy:5,gpsCapturedAt:new Date().toISOString(),imageData:'data:image/png;base64,iVBORw0KGgo=',imageName:'integration-bill.png'};
      const diesel=await Promise.all([ok(`/trips/${a.id}/diesel`,bill),ok(`/trips/${a.id}/diesel`,bill)]);
      assert.equal(diesel[0].dieselEntries.length,1);assert.equal(diesel[1].dieselEntries.length,1);
      a=await ok(`/trips/${a.id}`);assert.equal(a.dieselEntries[0].amount,1000);assert.equal(a.dieselEntries[0].imageData,bill.imageData);
      assert.equal((await pool.query('SELECT COUNT(*) n FROM fuel_expenses WHERE trip_id=$1',[a.id])).rows[0].n,'1');
    });
    a=await ok(`/trips/${a.id}/steps/expenses`,{mode:'save',closingMeter:150,meals:100});
    assert.equal(a.status,'Draft');assert.equal(a.meals,100);
    a=await ok(`/trips/${a.id}/steps/expenses`,{mode:'submit',closingMeter:150});
    await t.test('Step 5 → Pending; explicit approval → Completed, both survive fresh reads',async()=>{
      assert.equal(a.status,'Pending');assert.equal(a.endStepSubmitted,true);
      assert.equal((await ok(`/trips/${a.id}`)).status,'Pending');
      a=await ok(`/trips/${a.id}/status`,{status:'Completed',approvedBy:tag},'PATCH');
      assert.equal(a.status,'Completed');assert.equal((await ok(`/trips/${a.id}`)).status,'Completed');
      assert.equal(a.dieselEntries.length,1);assert.equal(a.ordersCollection.length,6);assert.equal(a.orderAssignments.length,6);assert.equal(a.deliveries.length,7);
      assert.equal((await request(`/trips/${b.id}/status`,{status:'Completed'},'PATCH')).status,409);
    });
  } finally {
    await pool.query('DELETE FROM fuel_expenses WHERE trip_id=ANY($1::int[])',[created.trips]);
    await pool.query('DELETE FROM trip_deliveries WHERE trip_id=ANY($1::int[])',[created.trips]);
    await pool.query('DELETE FROM trips WHERE id=ANY($1::int[])',[created.trips]);
    for(const [table,ids] of [['shops',created.shops],['vehicles',created.vehicles],['employees',created.employees],['farms',created.farms],['bird_types',created.birds]] as const) await pool.query(`DELETE FROM ${table} WHERE id=ANY($1::int[])`,[ids]);
    await pool.end();
  }
});
