// Partial quantities remain supported, but a collection now belongs to ONE
// backend trip. Cross-trip splitting/identity leakage is explicitly rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOrdersData, findDayOverAssignments, saveAssignment } from './ordersService';
import { day, installOrdersApi, row, trip } from '../../../../tests/fixtures/ordersApi';

test('partial assignment persists 20/40 without inventing another trip',async()=>{
  const source={...trip(),ordersCollection:[row(1,40)]};
  const api=installOrdersApi([source]);
  try {
    await saveAssignment(source,[{orderTripId:123,rows:[row(1,20)]}]);
    const c=(await fetchOrdersData()).collectionsByTripId[123];
    assert.equal(c.totalBoxes,40);assert.equal(c.assignedBoxes,20);assert.equal(c.fullyAssigned,false);
    assert.equal(c.shops.get(1)?.parts[0].tripId,123);assert.equal(api.records.size,1);
  } finally {api.restore();}
});
test('same trip can increase a partial assignment up to collected boxes',async()=>{
  const source={...trip(),ordersCollection:[row(1,40)]};const api=installOrdersApi([source]);
  try {
    const first=await saveAssignment(source,[{orderTripId:123,rows:[row(1,20)]}]);
    await saveAssignment(first,[{orderTripId:123,rows:[row(1,40)]}]);
    const c=(await fetchOrdersData()).collectionsByTripId[123];
    assert.equal(c.assignedBoxes,40);assert.equal(c.fullyAssigned,true);assert.equal(c.rows.length,1);
  } finally {api.restore();}
});
test('assignment cannot consume another trip collection, even on the same day',async()=>{
  const a={...trip(123),ordersCollection:[row(1,40)]};const b=trip(456);const api=installOrdersApi([a,b]);
  try {
    await assert.rejects(saveAssignment(b,[{orderTripId:123,rows:[row(1,20)]}]),/same backend trip ID/);
    await assert.rejects(saveAssignment(b,[{orderTripNo:a.tripNo,rows:[row(1,20)]}]),/same backend trip ID/);
    assert.equal(api.calls.length,0);
  } finally {api.restore();}
});
test('fresh quantity validation uses the selected trip ID and rejects wrong days',async()=>{
  const a={...trip(123),ordersCollection:[row(1,10)]};const b={...trip(456),ordersCollection:[row(1,40)]};const api=installOrdersApi([a,b]);
  try {
    const selected=[{shopId:1,shopName:'Test',boxes:20}];
    assert.equal((await findDayOverAssignments(day,selected,123))[0].remaining,10);
    assert.equal((await findDayOverAssignments(day,selected,456)).length,0);
    await assert.rejects(findDayOverAssignments('2026-09-05',selected,123));
  } finally {api.restore();}
});
test('backend rejects over-assignment and stale versions without duplicate rows',async()=>{
  const a={...trip(),ordersCollection:[row(1,10)]};const api=installOrdersApi([a]);
  try {
    await assert.rejects(saveAssignment(a,[{orderTripId:123,rows:[row(1,11)]}]));
    await saveAssignment(a,[{orderTripId:123,rows:[row(1,10)]}]);
    await assert.rejects(saveAssignment(a,[{orderTripId:123,rows:[row(1,9)]}]));
    assert.equal(api.records.get(123)?.orderAssignments?.length,1);
  } finally {api.restore();}
});
