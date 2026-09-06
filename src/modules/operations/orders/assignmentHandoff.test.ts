import test from 'node:test';
import assert from 'node:assert/strict';
import { finishAssignment, saveAssignment, fetchOrdersData, submitShopDeliveries } from './ordersService';
import { buildOrdersTrip, partitionTrackingTrips, buildShopBreakdown } from './ordersUtils';
import { pendingShopsFromRows } from '../vehicle-trips/components/Step_4/remainingBoxes';
import { calculateDeliveryMetrics } from '../../../shared/trip/calculations';
import { installOrdersApi, row, trip } from '../../../../tests/fixtures/ordersApi';

test('assignment save persists without submitting Trip Entry Step 4',async()=>{
  const source={...trip(),ordersCollection:[row(1)]};const api=installOrdersApi([source]);
  try {
    const saved=await saveAssignment(source,[{orderTripId:123,rows:[row(1)]}]);
    assert.equal(saved.deliveryStepSubmitted,false);assert.equal(saved.assignmentSubmitted,false);
    assert.equal((await fetchOrdersData()).tracking.length,0);
  } finally {api.restore();}
});
test('assignment submit rejects until WhatsApp confirms, and never submits Step 4',async()=>{
  const source={...trip(),ordersCollection:[row(1)]};const api=installOrdersApi([source]);
  try {
    await assert.rejects(finishAssignment(source,[{orderTripId:123,rows:[row(1)]}]));
    api.control.whatsapp=true; // Test-only provider receipt; never a production bypass.
    const saved=await finishAssignment(source,[{orderTripId:123,rows:[row(1)]}]);
    assert.equal(saved.assignmentSubmitted,true);assert.equal(saved.deliveryStepSubmitted,false);assert.equal(saved.status,'Draft');
    assert.equal((await fetchOrdersData()).tracking[0].trip.id,123);
  } finally {api.restore();}
});
test('tracking save cannot complete or submit the real trip',async()=>{
  const source={...trip(),assignmentSubmitted:true,deliveries:[{...row(1),remarks:'[ORDER] O:123',autoCaptureTime:'2026-09-06T10:00:00Z'}]};
  const api=installOrdersApi([source]);
  try {
    const saved=await submitShopDeliveries(source);
    assert.equal(saved.status,'Draft');assert.equal(saved.deliveryStepSubmitted,false);
    const post=api.calls.find(c=>c.method==='post')!;
    assert.equal(post.body.mode,'save');assert.equal(post.body.status,undefined);
    assert.equal(post.body.deliveries instanceof Array,true);
  } finally {api.restore();}
});
test('lifecycle partition follows backend status, not 100% delivered shops',()=>{
  const delivered={...row(1),remarks:'[ORDER] O:123',autoCaptureTime:'2026-09-06T10:00:00Z'};
  const draft=buildOrdersTrip({...trip(123),assignmentSubmitted:true,deliveries:[delivered]});
  const pending=buildOrdersTrip({...draft.trip,id:124,status:'Pending',endStepSubmitted:true});
  const completed=buildOrdersTrip({...draft.trip,id:125,status:'Completed',endStepSubmitted:true});
  const result=partitionTrackingTrips([draft,pending,completed]);
  assert.deepEqual(result.pending.map(t=>t.trip.id),[123,124]);
  assert.deepEqual(result.completed.map(t=>t.trip.id),[125]);
});
test('remaining shop count uses stable assigned boxes, including partial deliveries',()=>{
  const plan={...row(1,10),assignedBoxes:10};
  assert.equal(pendingShopsFromRows([plan]),1);
  const partial={...row(1,4),assignedBoxes:10,autoCaptureTime:'2026-09-06T10:00:00Z'};
  assert.equal(pendingShopsFromRows([plan,partial]),1);
  assert.equal(pendingShopsFromRows([plan,partial,{...partial,id:99,boxNo:6}]),0);
});
test('assignment plans never inflate Trip Entry actual delivered totals',()=>{
  const source=trip();const plan=row(1,10);
  assert.equal(calculateDeliveryMetrics(source,[plan]).totalBirdsDelivered,0);
  assert.equal(calculateDeliveryMetrics(source,[{...plan,autoCaptureTime:'2026-09-06T10:00:00Z'}]).totalBirdsDelivered,100);
});
test('unassigned deliveries remain visible without invented collected or assigned boxes',()=>{
  const actual={...row(9,4),remarks:'',autoCaptureTime:'2026-09-06T10:00:00Z'};
  const view=buildShopBreakdown([actual],new Set(),()=>'',new Map());
  assert.equal(view.length,1);assert.equal(view[0].additional,true);
  assert.equal(view[0].deliveredBoxes,4);assert.equal(view[0].collectedBoxes,0);assert.equal(view[0].assignedBoxes,0);
});
