import test from "node:test";
import assert from "node:assert/strict";
import type { Trip } from "../../vehicle-trips/types/trip";
import { displayRateEntryShopName, formatRateEntryDay, matchesRateEntrySearch } from "./rateEntryDisplay";

const trip = {
  id: 1,
  tripNo: "TRP-20260911-001",
  tripDate: "2026-09-11",
  vehicleNo: "TS07UB1111",
  supervisorName: "Sai Kumar",
  sourceFarm: "Godavari Broiler Farm",
  totalShops: 8,
  totalBirds: 1200,
  totalWeight: 2450.5,
} as Trip;

test("Rate Entry formats Day like Trip List and localizes it in Telugu", () => {
  assert.equal(formatRateEntryDay(trip.tripDate, "en"), "Fri, 11 Sep 2026");
  assert.equal(formatRateEntryDay(trip.tripDate, "te"), "శుక్ర, 11 సెప్టెం 2026");
});

test("Rate Entry shop display removes trailing delivery codes in English and Telugu", () => {
  assert.equal(displayRateEntryShopName("Prasanna Poultry Traders 018", "en"), "Prasanna Poultry Traders");
  assert.equal(displayRateEntryShopName("Prasanna Poultry Traders 018", "te"), "ప్రసన్న పౌల్ట్రీ ట్రేడర్స్");
});

test("Rate Entry search matches any visible table value", () => {
  assert.equal(matchesRateEntrySearch(trip, "TRP-20260911", "en"), true);
  assert.equal(matchesRateEntrySearch(trip, "TS 07 UB 1111", "en"), true);
  assert.equal(matchesRateEntrySearch(trip, "TS07UB1111", "en"), true);
  assert.equal(matchesRateEntrySearch(trip, "Godavari", "en"), true);
  assert.equal(matchesRateEntrySearch(trip, "2450.50", "en"), true);
});

test("Rate Entry Telugu search accepts Telugu text and English letters", () => {
  assert.equal(matchesRateEntrySearch(trip, "సాయి", "te"), true);
  assert.equal(matchesRateEntrySearch(trip, "Sai", "te"), true);
  assert.equal(matchesRateEntrySearch(trip, "గోదావరి", "te"), true);
  assert.equal(matchesRateEntrySearch(trip, "Godavari", "te"), true);
});
