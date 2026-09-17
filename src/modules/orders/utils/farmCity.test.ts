// src/modules/orders/utils/farmCity.test.ts
// The vehicle table shows the farm's CITY only ("Vijayawada", "Kodad") —
// never the whole address line. Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { farmCityOf } from "./ordersUtils";

const city = (farmAddress: string, sourceFarm = "Sri Venkateswara Broiler Farm") =>
  farmCityOf({ farmAddress, sourceFarm });

test("returns the city when the address ends with one", () => {
  assert.equal(city("Survey 42/1, Ibrahimpatnam Road, Vijayawada"), "Vijayawada");
  assert.equal(city("NH-16, Kovvuru Mandal, Kodad"), "Kodad");
});

test("unwraps a place hidden behind a road / mandal suffix", () => {
  assert.equal(city("Survey 42/1, Ibrahimpatnam Road, Rangareddy Dist."), "Ibrahimpatnam");
  assert.equal(city("Plot 7, Kukatpally Road, Medchal Dist."), "Kukatpally");
});

test("skips district, state, pincode and plot segments", () => {
  assert.equal(city("Vuyyuru Road, Krishna Dist., Andhra Pradesh"), "Vuyyuru");
  assert.equal(city("D.No 3-45, Main Road, Suryapet, 508213"), "Suryapet");
});

test("falls back to the farm name, then to the raw value — never empty", () => {
  assert.equal(farmCityOf({ farmAddress: "", sourceFarm: "Godavari Poultry Farms" }), "Godavari Poultry Farms");
  assert.equal(farmCityOf({ farmAddress: "   ", sourceFarm: "" }), "—");
  assert.equal(city("12/3"), "12/3");
});
