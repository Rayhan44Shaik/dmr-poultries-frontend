// src/modules/staff/utils/performancePeriods.test.ts
// Deterministic Monday→Saturday period maths for the performance pages.
// Run: tsx --test src/modules/staff/utils/performancePeriods.test.ts

/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBusinessDate } from "../../../utils/businessDate";
import {
  defaultPerformancePeriod,
  formatBusinessDate,
  formatPeriodAxisLabel,
  formatPeriodLabel,
  lastWeekPeriods,
  periodsForRange,
  weekPeriodContaining,
  weeklyBucketLabel,
} from "./performancePeriods";

// Calendar facts (verified): 10 Aug 2026 is a Monday, 15 Aug 2026 its
// Saturday, 16 Aug 2026 the following Sunday.
test("weekPeriodContaining returns the Monday–Saturday window", () => {
  assert.deepEqual(weekPeriodContaining("2026-08-12"), {
    from: "2026-08-10",
    to: "2026-08-15",
  });
  assert.deepEqual(weekPeriodContaining("2026-08-10"), {
    from: "2026-08-10",
    to: "2026-08-15",
  });
  assert.deepEqual(weekPeriodContaining("2026-08-15"), {
    from: "2026-08-10",
    to: "2026-08-15",
  });
});

test("a Sunday belongs to the reporting week that ended the day before", () => {
  // 16 Aug 2026 is a Sunday.
  assert.deepEqual(weekPeriodContaining("2026-08-16"), {
    from: "2026-08-10",
    to: "2026-08-15",
  });
});

test("lastWeekPeriods returns four dynamic periods ending with the current week", () => {
  // As-of Wednesday 9 Sep 2026 → current week is 7–12 Sep.
  const periods = lastWeekPeriods(4, "2026-09-09");
  assert.deepEqual(periods, [
    { from: "2026-08-17", to: "2026-08-22" },
    { from: "2026-08-24", to: "2026-08-29" },
    { from: "2026-08-31", to: "2026-09-05" },
    { from: "2026-09-07", to: "2026-09-12" },
  ]);
});

test("defaultPerformancePeriod spans about one month ending today", () => {
  const { fromDate, toDate } = defaultPerformancePeriod(4, "2026-09-09");
  assert.equal(fromDate, "2026-08-17");
  assert.equal(toDate, "2026-09-09");
  const days =
    (parseBusinessDate(toDate)!.getTime() - parseBusinessDate(fromDate)!.getTime()) /
    86_400_000;
  assert.ok(days >= 21 && days <= 28, `expected ~1 month, got ${days} days`);
});

test("periodsForRange walks every intersecting week, capped to the newest", () => {
  assert.deepEqual(periodsForRange("2026-08-17", "2026-09-05"), [
    { from: "2026-08-17", to: "2026-08-22" },
    { from: "2026-08-24", to: "2026-08-29" },
    { from: "2026-08-31", to: "2026-09-05" },
  ]);
  // Capping keeps the newest windows.
  const capped = periodsForRange("2026-06-01", "2026-09-05", 4);
  assert.equal(capped.length, 4);
  assert.equal(capped[capped.length - 1].to, "2026-09-05");
});

test("formatPeriodLabel uses short dates and disambiguates year crossings", () => {
  assert.equal(
    formatPeriodLabel({ from: "2026-08-17", to: "2026-08-22" }),
    "17 Aug – 22 Aug",
  );
  assert.equal(
    formatPeriodLabel({ from: "2025-12-29", to: "2026-01-03" }),
    "29 Dec 2025 – 3 Jan 2026",
  );
});

test("formatPeriodAxisLabel compresses same-month weeks", () => {
  assert.equal(
    formatPeriodAxisLabel({ from: "2026-08-17", to: "2026-08-22" }),
    "17–22 Aug",
  );
  assert.equal(
    formatPeriodAxisLabel({ from: "2026-08-31", to: "2026-09-05" }),
    "31 Aug–5 Sep",
  );
});

test("formatBusinessDate renders local dates and never shifts timezones", () => {
  assert.equal(formatBusinessDate("2026-09-05"), "5 Sep 2026");
  assert.equal(formatBusinessDate(""), "—");
  assert.equal(formatBusinessDate("2026-09-31"), "—"); // impossible date
});

test("weeklyBucketLabel derives the Mon–Sat window from a date label", () => {
  assert.equal(weeklyBucketLabel("2026-08-31"), "31 Aug–5 Sep");
  assert.equal(weeklyBucketLabel("2026-08-31T00:00:00.000Z"), "31 Aug–5 Sep");
  assert.equal(weeklyBucketLabel("2"), "W2");
  assert.equal(weeklyBucketLabel("Week 32"), "Week 32");
  assert.equal(weeklyBucketLabel(""), "—");
  assert.equal(weeklyBucketLabel(null), "—");
  // An impossible date must fall back to the raw label, never throw.
  assert.equal(weeklyBucketLabel("2026-09-31"), "2026-09-31");
});

test("labels are stable: same input, same label", () => {
  const once = lastWeekPeriods(4, "2026-09-09").map((period) => formatPeriodLabel(period));
  const twice = lastWeekPeriods(4, "2026-09-09").map((period) => formatPeriodLabel(period));
  assert.deepEqual(once, twice);
});
