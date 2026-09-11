import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTripListDay, formatTripRecentDateWithDay } from "./formatTripListDay";

describe("formatTripListDay", () => {
  it("maps each weekday + full date from the stored trip date", () => {
    assert.equal(formatTripListDay("2026-08-17"), "Mon, 17 Aug 2026");
    assert.equal(formatTripListDay("2026-08-18"), "Tue, 18 Aug 2026");
    assert.equal(formatTripListDay("2026-08-19"), "Wed, 19 Aug 2026");
    assert.equal(formatTripListDay("2026-08-20"), "Thu, 20 Aug 2026");
    assert.equal(formatTripListDay("2026-08-21"), "Fri, 21 Aug 2026");
    assert.equal(formatTripListDay("2026-08-22"), "Sat, 22 Aug 2026");
    assert.equal(formatTripListDay("2026-08-23"), "Sun, 23 Aug 2026");
  });

  it("does not crash on invalid or missing dates", () => {
    assert.equal(formatTripListDay(undefined), "—");
    assert.equal(formatTripListDay(null), "—");
    assert.equal(formatTripListDay(""), "—");
    assert.equal(formatTripListDay("   "), "—");
    assert.equal(formatTripListDay("not-a-date"), "—");
    assert.equal(formatTripListDay("2026-13-40"), "—");
  });

  it("formats Recent Trips as weekday only", () => {
    assert.equal(formatTripRecentDateWithDay("2026-08-19"), "Wednesday");
    assert.equal(formatTripRecentDateWithDay("2026-08-20"), "Thursday");
    assert.equal(formatTripRecentDateWithDay("2026-08-21"), "Friday");
  });
});
