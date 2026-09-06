import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOrdersData, fetchOrdersData, saveCollection } from './ordersService';
import { mapApiTripToTrip, uniqueTripsById } from '../vehicle-trips/services/tripHeaderApiService';
import { uniqueShopRows } from './ordersUtils';
import { day, installOrdersApi, row, trip } from '../../../../tests/fixtures/ordersApi';

test('Recent and Orders identity is trip.id, never number/date/vehicle/supervisor',()=>{
  const a=trip(123),b={...trip(456),tripNo:a.tripNo};
  assert.deepEqual(uniqueTripsById([a,b,a]).map(t=>t.id),[123,456]);
  const data=deriveOrdersData([a,b,a],[]);
  assert.deepEqual(Object.keys(data.collectionsByTripId),['123','456']);
});
test('Save Collection without Finish exposes shops on the SAME real trip',async()=>{
  const api=installOrdersApi([trip()]);
  try {
    const saved=await saveCollection(123,'TRP-123',[row(7,12)],1);
    assert.equal(saved.id,123);assert.equal(saved.collectionFinished,false);
    const result=await fetchOrdersData();
    assert.equal(result.collectionsByTripId[123].rows[0].boxNo,12);
    assert.equal(result.collectionsByTripId[123].finished,false);
    assert.equal(api.records.size,1);
    assert.equal(api.calls.filter(c=>c.method==='post').length,1);
    assert.equal(api.calls.find(c=>c.method==='post')?.url,'/trips/123/steps/deliveries');
  } finally {api.restore();}
});
test('same day and different day trips never share or merge collection rows',()=>{
  const a={...trip(123),ordersCollection:[row(1)]};
  const b={...trip(456),ordersCollection:[row(2)]};
  const c={...trip(789,'2026-09-05'),ordersCollection:[row(3)]};
  const data=deriveOrdersData([a,b,c],[]);
  assert.deepEqual(data.collectionsByTripId[123].rows.map(r=>r.shopId),[1]);
  assert.deepEqual(data.collectionsByTripId[456].rows.map(r=>r.shopId),[2]);
  assert.deepEqual(data.collectionsByTripId[789].rows.map(r=>r.shopId),[3]);
});
test('collection cannot create trip 0/null or save by a trip number',async()=>{
  const api=installOrdersApi([]);
  try {
    await assert.rejects(saveCollection(null,'ORD-not-allowed',[row(1)]));
    await assert.rejects(saveCollection(0,'TRP-123',[row(1)]));
    assert.equal(api.calls.length,0);
  } finally {api.restore();}
});
test('API empty is empty and API errors reject rather than serving samples',async()=>{
  const api=installOrdersApi([]);
  try {
    const data=await fetchOrdersData();
    assert.equal(data.trips.length,0);assert.equal(data.tracking.length,0);assert.deepEqual(data.collectionsByTripId,{});
    api.control.fail=true;await assert.rejects(fetchOrdersData());
  } finally {api.restore();}
});
test('failed collection saves preserve backend state and are retryable',async()=>{
  const api=installOrdersApi([trip()]);
  try {
    api.control.fail=true;await assert.rejects(saveCollection(123,null,[row(1)]));
    assert.equal(api.records.get(123)?.ordersCollection?.length,0);
    api.control.fail=false;assert.equal((await saveCollection(123,null,[row(1)])).ordersCollection?.length,1);
  } finally {api.restore();}
});
test('stale collection revisions reject without overwriting another save',async()=>{
  const api=installOrdersApi([trip()]);
  try {
    await saveCollection(123,null,[row(1)],1);
    await assert.rejects(saveCollection(123,null,[row(2)],1));
    assert.equal(api.records.get(123)?.ordersCollection?.[0].shopId,1);
  } finally {api.restore();}
});
test('legacy vehicle-less ORD records are not returned as real Trip Entry trips',()=>{
  const data=deriveOrdersData([{...trip(99),tripNo:'ORD-legacy',vehicleId:0,vehicleNo:''},trip(123)],[]);
  assert.deepEqual(data.trips.map(t=>t.id),[123]);
});
test('date mapping preserves the backend day and shop duplication collapses by shop ID',()=>{
  assert.equal(mapApiTripToTrip({id:3,tripDate:`${day}T23:30:00Z`}).tripDate,day);
  assert.deepEqual(uniqueShopRows([row(1),row(1),row(2)]).map(r=>r.shopId),[1,2]);
});
