import assert from "node:assert/strict";
import test from "node:test";
import { mapApiTripToTrip, toStep1Payload, uniqueTripsById } from "./tripHeaderApiService";
import { createEmptyTrip } from "../../../../shared/trip";

test("toStep1Payload keeps explicit 0 and sends empty as null, without startTime or tripNo", () => {
  const payload = toStep1Payload({
    tripDate: "2026-08-17",
    vehicleId: 1,
    vehicleNo: "V1",
    driverId: 2,
    driverName: "D",
    supervisorId: 3,
    supervisorName: "S",
    helpers: ["H"],
    loaders: ["L"],
    openingMeter: 0,
    advanceAmount: 0,
    tripNo: "TR-FAKE",
    startTime: "1999-01-01T00:00:00.000Z",
    startStepSubmitted: true,
  });
  assert.equal(payload.openingMeter, 0);
  assert.equal(payload.advanceAmount, 0);
  assert.equal(payload.tripDate, "2026-08-17");
  assert.equal("startTime" in payload, false);
  assert.equal("tripNo" in payload, false);

  const empty = toStep1Payload({
    ...createEmptyTrip({ tripDate: "2026-08-17" }),
    openingMeter: null,
    advanceAmount: null,
  });
  assert.equal(empty.openingMeter, null);
  assert.equal(empty.advanceAmount, null);
  assert.equal(empty.tripDate, "2026-08-17");
});

test("selected tripDate is forwarded for server-side TR-YYYYMMDD-NNN allocation", () => {
  const payload = toStep1Payload({
    ...createEmptyTrip({ tripDate: "2026-08-13" }),
    vehicleId: 9,
    driverId: 8,
    supervisorId: 7,
    helpers: ["H1"],
    loaders: ["L1"],
  });
  assert.equal(payload.tripDate, "2026-08-13");
  assert.equal("tripNo" in payload, false);
});

test("mapApiTripToTrip preserves null KM/Advance instead of coercing to 0", () => {
  const mapped = mapApiTripToTrip({
    id: 9,
    tripNo: "TR-20260817-001",
    tripDate: "2026-08-17",
    openingMeter: null,
    advanceAmount: null,
    startStepSubmitted: true,
    startTime: "2026-08-17T10:00:00.000Z",
  });
  assert.equal(mapped.openingMeter, null);
  assert.equal(mapped.advanceAmount, null);
  assert.equal(mapped.startStepSubmitted, true);
});

test("uniqueTripsById replaces duplicates by id instead of appending", () => {
  const first = mapApiTripToTrip({ id: 7, tripNo: "TR-1", tripDate: "2026-09-06" });
  const second = mapApiTripToTrip({ id: 7, tripNo: "TR-1-DUP", tripDate: "2026-09-06" });
  const other = mapApiTripToTrip({ id: 8, tripNo: "TR-2", tripDate: "2026-09-06" });
  const out = uniqueTripsById([first, second, other]);
  assert.equal(out.length, 2);
  assert.equal(out[0].tripNo, "TR-1");
  assert.equal(out[1].id, 8);
});
