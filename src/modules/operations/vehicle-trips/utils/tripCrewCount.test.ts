import assert from "node:assert/strict";
import test from "node:test";
import { tripMealEmployeeCount } from "./tripCrewCount";

test("meal employee count includes driver, supervisor, helpers and loaders", () => {
  assert.equal(tripMealEmployeeCount({
    driverId: 1,
    driverName: "Driver One",
    supervisorId: 2,
    supervisorName: "Supervisor One",
    helpers: ["Helper One", "Helper Two"],
    loaders: ["Loader One"],
  }), 5);
});

test("meal employee count ignores blanks and duplicate crew names", () => {
  assert.equal(tripMealEmployeeCount({
    driverName: "Ravi",
    supervisorName: "Suresh",
    helpers: ["Helper One", "", "helper one"],
    loaders: ["  "],
  }), 3);
});
