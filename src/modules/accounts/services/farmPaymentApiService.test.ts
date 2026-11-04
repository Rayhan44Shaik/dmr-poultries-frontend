/**
 * Trip-linked farm payment mapping tests.
 *
 * The fixture row is verbatim from GET /api/accounts/farm-payments (the
 * Farmer Payments dataset): one row per completed trip, carrying the cost of
 * the birds that trip carried. The Account Analysis charges exactly this
 * figure to the trip, so a mapping mistake here lands directly in net profit.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  displayTripNo,
  farmPaymentTotals,
  flattenFarmPaymentsForTable,
  indexFarmPaymentsByTrip,
  mapFarmPayments,
  mapRawFarmPayment,
} from "./farmPaymentApiService";

const RAW = {
  id: 1,
  tripId: 10001,
  tripNo: "TRP-20260618-001",
  tripDate: "2026-06-18",
  farmId: 4,
  farmName: "Venkateswara Hatchery Farm",
  birdType: "Country Chicken",
  totalBirds: 264,
  dcWeight: 658.15,
  rate: 89,
  amount: 58575.35,
  paidAmount: 0,
  balance: 58575.35,
  status: "Pending",
  paymentDate: null,
  paymentMode: null,
  referenceNo: null,
  vehicleNo: "TS07UB1222",
  supervisorName: "Prakash Rao",
  loads: [
    { legId: 11, load: 1, farmName: "Venkateswara Hatchery Farm", birdType: "Country Chicken", totalBirds: 100, dcWeight: 250, rate: 89, amount: 22250 },
    { legId: 12, load: 2, farmName: "Second Farm", birdType: "Broiler", totalBirds: 164, dcWeight: 408.15, rate: 89, amount: 36325.35 },
  ],
};

test("mapRawFarmPayment maps every field the Analysis and the trip view read", () => {
  const row = mapRawFarmPayment(RAW);
  assert.ok(row);
  assert.equal(row.tripId, 10001);
  assert.equal(row.tripNo, "TRP-20260618-001");
  assert.equal(row.tripDate, "2026-06-18");
  assert.equal(row.farmName, "Venkateswara Hatchery Farm");
  assert.equal(row.totalBirds, 264);
  assert.equal(row.dcWeight, 658.15);
  assert.equal(row.rate, 89);
  assert.equal(row.amount, 58575.35);
  assert.equal(row.paidAmount, 0);
  assert.equal(row.balance, 58575.35);
  assert.equal(row.status, "Pending");
  assert.equal(row.paymentDate, null);
  assert.equal(row.vehicleNo, "TS07UB1222");
  assert.deepEqual(row.loads, [
    { legId: 11, load: 1, farmName: "Venkateswara Hatchery Farm", birdType: "Country Chicken", totalBirds: 100, dcWeight: 250, rate: 89, amount: 22250 },
    { legId: 12, load: 2, farmName: "Second Farm", birdType: "Broiler", totalBirds: 164, dcWeight: 408.15, rate: 89, amount: 36325.35 },
  ]);
});

test("a farm payment that cannot belong to a trip is dropped", () => {
  assert.equal(mapRawFarmPayment(null), null);
  assert.equal(mapRawFarmPayment("nope"), null);
  assert.equal(mapRawFarmPayment({ ...RAW, tripId: undefined }), null);
  assert.equal(mapRawFarmPayment({ ...RAW, tripId: 0 }), null);
  assert.equal(mapRawFarmPayment({ ...RAW, tripId: "abc" }), null);
});

test("missing money fields are derived, never invented", () => {
  // No balance sent → owed = cost − paid.
  const derived = mapRawFarmPayment({ ...RAW, amount: 1000, paidAmount: 400, balance: undefined, status: undefined });
  assert.ok(derived);
  assert.equal(derived.balance, 600);
  assert.equal(derived.status, "Partially Paid");

  // Garbage amounts read as 0 rather than NaN, so a total can never become NaN.
  const junk = mapRawFarmPayment({ ...RAW, amount: "abc", paidAmount: null });
  assert.ok(junk);
  assert.equal(junk.amount, 0);
  assert.equal(junk.paidAmount, 0);
  assert.equal(Number.isNaN(farmPaymentTotals([junk]).payable), false);

  // Fully settled with no status sent → derived as Paid, never "Pending".
  const paid = mapRawFarmPayment({ ...RAW, amount: 1000, paidAmount: 1000, balance: 0, status: undefined });
  assert.ok(paid);
  assert.equal(paid.status, "Paid");

  // Nothing paid yet.
  const unpaid = mapRawFarmPayment({ ...RAW, amount: 1000, paidAmount: 0, balance: 1000, status: undefined });
  assert.ok(unpaid);
  assert.equal(unpaid.status, "Pending");

  // An explicit server status wins over anything derived from the money.
  const serverPaid = mapRawFarmPayment({ ...RAW, status: "Paid" });
  assert.ok(serverPaid);
  assert.equal(serverPaid.status, "Paid");
});

test("mapFarmPayments accepts a bare array or a paginated body", () => {
  assert.equal(mapFarmPayments([RAW]).length, 1);
  assert.equal(mapFarmPayments({ data: [RAW], meta: { total: 1 } }).length, 1);
  assert.deepEqual(mapFarmPayments(null), []);
  assert.deepEqual(mapFarmPayments({ nope: true }), []);
});

test("one farm payment per trip — a duplicate cannot double the farm cost", () => {
  const rows = mapFarmPayments([RAW, { ...RAW, id: 999 }, { ...RAW, id: 1000, amount: 1 }]);
  assert.equal(rows.length, 1);
  assert.equal(farmPaymentTotals(rows).payable, 58575.35);
});

test("farmPaymentTotals splits the cost into payable, paid and owed", () => {
  const rows = mapFarmPayments([
    RAW,
    { ...RAW, id: 2, tripId: 10002, amount: 1000, paidAmount: 250, balance: 750, status: "Pending" },
  ]);
  const totals = farmPaymentTotals(rows);
  assert.equal(totals.trips, 2);
  assert.equal(totals.payable, 59575.35);
  assert.equal(totals.paid, 250);
  assert.equal(totals.balance, 59325.35);
  assert.equal(farmPaymentTotals([]).payable, 0);
});

test("indexFarmPaymentsByTrip keys by trip id, however it is spelled", () => {
  const index = indexFarmPaymentsByTrip(mapFarmPayments([RAW]));
  assert.ok(index.get("10001"));
  assert.ok(index.get(String(10001)));
  assert.equal(index.get("10002"), undefined);
});

test("displayTripNo suffixes only genuine multi-load trips", () => {
  assert.equal(displayTripNo("TR-20261101-009", 1, 1), "TR-20261101-009");
  assert.equal(displayTripNo("TR-20261101-009", 0, 1), "TR-20261101-009");
  assert.equal(displayTripNo("TR-20261101-009", 2, 1), "TR-20261101-009-L1");
  assert.equal(displayTripNo("TR-20261101-009", 2, 2), "TR-20261101-009-L2");
  assert.equal(displayTripNo("TR-20261101-009", 4, 4), "TR-20261101-009-L4");
});

test("flatten keeps a single-load trip on one row under its canonical number", () => {
  const rows = flattenFarmPaymentsForTable(mapFarmPayments([
    { ...RAW, tripId: 20001, tripNo: "TR-20261101-008", loads: [] },
  ]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, "trip:20001");
  assert.equal(rows[0].legId, null);
  assert.equal(rows[0].displayTripNo, "TR-20261101-008");
  assert.equal(rows[0].farm, "Venkateswara Hatchery Farm");
  assert.equal(rows[0].birds, 264);
  assert.equal(rows[0].dcWeight, 658.15);
  assert.equal(rows[0].rate, 89);
  assert.equal(rows[0].amount, 58575.35);
});

test("flatten splits a two-load trip into L1/L2 rows with their own figures", () => {
  const rows = flattenFarmPaymentsForTable(mapFarmPayments([
    { ...RAW, tripId: 20002, tripNo: "TR-20261101-009" },
  ]));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].key, "trip:20002:leg:11");
  assert.equal(rows[1].key, "trip:20002:leg:12");
  assert.equal(rows[0].displayTripNo, "TR-20261101-009-L1");
  assert.equal(rows[1].displayTripNo, "TR-20261101-009-L2");
  // Both rows open the same canonical parent trip.
  assert.equal(rows[0].tripNo, "TR-20261101-009");
  assert.equal(rows[1].tripNo, "TR-20261101-009");
  assert.equal(rows[0].farm, "Venkateswara Hatchery Farm");
  assert.equal(rows[1].farm, "Second Farm");
  assert.equal(rows[0].birdType, "Country Chicken");
  assert.equal(rows[1].birdType, "Broiler");
  assert.equal(rows[0].birds, 100);
  assert.equal(rows[1].birds, 164);
  assert.equal(rows[0].dcWeight, 250);
  assert.equal(rows[1].dcWeight, 408.15);
  assert.equal(rows[0].rate, 89);
  assert.equal(rows[0].amount, 22250);
  assert.equal(rows[1].amount, 36325.35);
});

test("flattened load rows sum exactly once to the parent amount", () => {
  const parents = mapFarmPayments([{ ...RAW, tripId: 20003, tripNo: "TR-20261101-009" }]);
  const rows = flattenFarmPaymentsForTable(parents);
  const sum = rows.reduce((total, row) => total + row.amount, 0);
  assert.equal(Math.round(sum * 100) / 100, parents[0].amount);
  // The parent record itself is untouched: one trip, one farm cost.
  assert.equal(parents.length, 1);
  assert.equal(farmPaymentTotals(parents).payable, parents[0].amount);
});

test("display rows expose stable keys that are never the trip number", () => {
  const rows = flattenFarmPaymentsForTable(mapFarmPayments([
    { ...RAW, tripId: 20004, tripNo: "TR-20261101-009" },
    { ...RAW, tripId: 20005, tripNo: "TR-20261101-008", loads: [] },
  ]));
  const keys = rows.map((row) => row.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const row of rows) assert.notEqual(row.key, row.displayTripNo);
});
