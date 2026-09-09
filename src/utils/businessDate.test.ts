/**
 * Calendar-safety tests for the shared business-date helpers.
 *
 * These lock in the two guarantees the ERP depends on:
 *   1. the frontend never emits a date that does not exist (e.g. 2026-09-31)
 *   2. month/quarter steppers never skip a month via `setMonth` overflow
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  clampBusinessDate,
  endOfMonthDate,
  isBusinessDate,
  monthRange,
  parseBusinessDate,
  shiftMonths,
  startOfMonthDate,
  toBusinessDate,
  weekRange,
} from "./businessDate";

test("parseBusinessDate rejects dates that do not exist on the calendar", () => {
  assert.equal(parseBusinessDate("2026-09-31"), undefined, "September has 30 days");
  assert.equal(parseBusinessDate("2026-02-30"), undefined, "February never has 30 days");
  assert.equal(parseBusinessDate("2026-02-31"), undefined);
  assert.equal(parseBusinessDate("2026-04-31"), undefined, "April has 30 days");
  assert.equal(parseBusinessDate("2026-13-01"), undefined, "no 13th month");
  assert.equal(parseBusinessDate("2026-00-10"), undefined, "no 0th month");
  assert.equal(parseBusinessDate("2023-02-29"), undefined, "2023 is not a leap year");
  assert.equal(parseBusinessDate("2026-01-32"), undefined);
});

test("parseBusinessDate accepts real dates, including leap day", () => {
  assert.ok(parseBusinessDate("2026-09-30"));
  assert.ok(parseBusinessDate("2024-02-29"), "2024 is a leap year");
  assert.ok(parseBusinessDate("2000-02-29"), "2000 is a leap year");
  assert.ok(parseBusinessDate("2026-12-31"));
});

test("parseBusinessDate rejects malformed input", () => {
  assert.equal(parseBusinessDate(""), undefined);
  assert.equal(parseBusinessDate(null), undefined);
  assert.equal(parseBusinessDate(undefined), undefined);
  assert.equal(parseBusinessDate("2026-9-1"), undefined, "must be zero-padded");
  assert.equal(parseBusinessDate("31/09/2026"), undefined, "wrong format");
  assert.equal(parseBusinessDate("not-a-date"), undefined);
});

test("parseBusinessDate treats surrounding whitespace tolerantly", () => {
  assert.ok(parseBusinessDate("  2026-09-08  "));
});

test("isBusinessDate is a usable type guard", () => {
  assert.equal(isBusinessDate("2026-09-08"), true);
  assert.equal(isBusinessDate("2026-09-31"), false);
  assert.equal(isBusinessDate(20260931), false);
});

test("toBusinessDate formats in LOCAL time, never UTC", () => {
  // 00:30 local on 8 Sep. `toISOString()` would report 7 Sep for any timezone
  // ahead of UTC, which is exactly the off-by-one this helper exists to avoid.
  const local = new Date(2026, 8, 8, 0, 30, 0, 0);
  assert.equal(toBusinessDate(local), "2026-09-08");
});

test("toBusinessDate returns empty string for invalid dates", () => {
  assert.equal(toBusinessDate(null), "");
  assert.equal(toBusinessDate(undefined), "");
  assert.equal(toBusinessDate(new Date("nonsense")), "");
});

test("shiftMonths clamps to the real month length instead of rolling over", () => {
  // The regression that broke MarketRatePage: 31 Jan + 1 month used to become
  // 3 March because 31 February does not exist.
  assert.equal(toBusinessDate(shiftMonths("2026-01-31", 1)), "2026-02-28");
  assert.equal(toBusinessDate(shiftMonths("2024-01-31", 1)), "2024-02-29", "leap year");
  assert.equal(toBusinessDate(shiftMonths("2026-01-30", 1)), "2026-02-28");
  assert.equal(toBusinessDate(shiftMonths("2026-03-31", -1)), "2026-02-28");
  assert.equal(toBusinessDate(shiftMonths("2026-05-31", -1)), "2026-04-30");
});

test("shiftMonths keeps a normal day unchanged", () => {
  assert.equal(toBusinessDate(shiftMonths("2026-09-08", 1)), "2026-10-08");
  assert.equal(toBusinessDate(shiftMonths("2026-09-08", -1)), "2026-08-08");
  assert.equal(toBusinessDate(shiftMonths("2026-09-08", 0)), "2026-09-08");
});

test("shiftMonths crosses year boundaries correctly", () => {
  assert.equal(toBusinessDate(shiftMonths("2026-12-15", 1)), "2027-01-15");
  assert.equal(toBusinessDate(shiftMonths("2026-01-15", -1)), "2025-12-15");
  assert.equal(toBusinessDate(shiftMonths("2026-01-31", 13)), "2027-02-28");
});

test("shiftMonths quarter stepping never skips a quarter", () => {
  // 31 Jan + 3 months used to become 1 May (31 April overflow) — skipping the
  // Q1→Q2 boundary. It must land in April.
  const shifted = shiftMonths("2026-01-31", 3);
  assert.equal(toBusinessDate(shifted), "2026-04-30");
  assert.equal(shifted.getMonth(), 3, "April");
});

test("shiftMonths falls back safely on invalid input", () => {
  const result = shiftMonths("2026-09-31", 1);
  assert.ok(result instanceof Date);
  assert.ok(isBusinessDate(toBusinessDate(result)), "output is always a real date");
});

test("startOfMonthDate / endOfMonthDate derive from the calendar", () => {
  assert.equal(startOfMonthDate("2026-09-15"), "2026-09-01");
  // Never a hard-coded -31: September ends on the 30th.
  assert.equal(endOfMonthDate("2026-09-15"), "2026-09-30");
  assert.equal(endOfMonthDate("2026-02-10"), "2026-02-28");
  assert.equal(endOfMonthDate("2024-02-10"), "2024-02-29");
  assert.equal(endOfMonthDate("2026-12-01"), "2026-12-31");
});

test("monthRange expands a YYYY-MM picker value into a valid inclusive range", () => {
  assert.deepEqual(monthRange("2026-09"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthRange("2024-02"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(monthRange("2026-12"), { from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual(monthRange("2026-04"), { from: "2026-04-01", to: "2026-04-30" });
});

test("monthRange rejects malformed picker values", () => {
  assert.equal(monthRange("2026-13"), null);
  assert.equal(monthRange("2026-00"), null);
  assert.equal(monthRange("2026-9"), null);
  assert.equal(monthRange(""), null);
  assert.equal(monthRange(null), null);
});

test("every date produced by these helpers is itself a valid calendar date", () => {
  const outputs = [
    startOfMonthDate("2026-09-30"),
    endOfMonthDate("2026-02-14"),
    toBusinessDate(shiftMonths("2026-01-31", 1)),
    monthRange("2026-11")!.from,
    monthRange("2026-11")!.to,
    weekRange("2026-09-08").from,
    weekRange("2026-09-08").to,
  ];
  for (const value of outputs) {
    assert.ok(isBusinessDate(value), `expected a real calendar date, got ${value}`);
  }
});

test("weekRange returns a Monday-start, Sunday-end week", () => {
  const range = weekRange("2026-09-08"); // a Tuesday
  assert.equal(range.from, "2026-09-07", "Monday");
  assert.equal(range.to, "2026-09-13", "Sunday");
});

test("clampBusinessDate keeps a value inside its bounds", () => {
  assert.equal(clampBusinessDate("2026-09-31", "2026-01-01", "2026-12-31"), "");
  assert.equal(clampBusinessDate("2025-06-15", "2026-01-01", "2026-12-31"), "2026-01-01");
  assert.equal(clampBusinessDate("2027-06-15", "2026-01-01", "2026-12-31"), "2026-12-31");
  assert.equal(clampBusinessDate("2026-06-15", "2026-01-01", "2026-12-31"), "2026-06-15");
});
