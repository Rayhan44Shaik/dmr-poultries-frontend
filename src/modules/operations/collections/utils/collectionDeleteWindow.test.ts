/**
 * The 10-day deletion window is a hard business rule: a collection may be
 * deleted only within 10 days of its entry date, never after, under any
 * circumstances. These cases pin the boundaries so the rule cannot drift.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  getDeleteWindow,
  daysSinceEntry,
  COLLECTION_DELETE_WINDOW_DAYS,
  getDeleteWindowForStatus,
} from "./collectionDeleteWindow";

const now = new Date(2026, 8, 15); // 2026-09-15, local midnight

test("the window is 10 days", () => {
  assert.equal(COLLECTION_DELETE_WINDOW_DAYS, 10);
});

test("an entry made today is deletable with 10 days left", () => {
  const w = getDeleteWindow("2026-09-15", now);
  assert.equal(w.canDelete, true);
  assert.equal(w.ageInDays, 0);
  assert.equal(w.daysRemaining, 10);
  assert.equal(w.deadline, "2026-09-25");
});

test("day 10 is still permitted and is the last day", () => {
  const w = getDeleteWindow("2026-09-05", now);
  assert.equal(w.canDelete, true);
  assert.equal(w.ageInDays, 10);
  assert.equal(w.daysRemaining, 0);
});

test("day 11 is refused", () => {
  const w = getDeleteWindow("2026-09-04", now);
  assert.equal(w.canDelete, false);
  assert.equal(w.ageInDays, 11);
});

test("a long-past entry is refused", () => {
  assert.equal(getDeleteWindow("2026-01-01", now).canDelete, false);
});

test("an unusable date is refused rather than assumed deletable", () => {
  assert.equal(getDeleteWindow(null, now).canDelete, false);
  assert.equal(getDeleteWindow(undefined, now).canDelete, false);
  assert.equal(getDeleteWindow("", now).canDelete, false);
  assert.equal(getDeleteWindow("not-a-date", now).canDelete, false);
});

test("a future-dated entry is inside the window", () => {
  assert.equal(getDeleteWindow("2026-09-20", now).canDelete, true);
});

test("ISO timestamps are counted by calendar day", () => {
  assert.equal(daysSinceEntry("2026-09-10T18:30:00Z", now), 5);
});

/* -------------------------------------------------------------------------
 * Status-aware windows: pending entries may be deleted on their entry day
 * only, approved entries get the full 10 days.
 * ---------------------------------------------------------------------- */

test("a pending entry is deletable on its entry day", () => {
  const w = getDeleteWindowForStatus("2026-09-15", "Pending Approval", now);
  assert.equal(w.canDelete, true);
  assert.equal(w.daysRemaining, 0);
  assert.equal(w.deadline, "2026-09-15");
});

test("a pending entry is NOT deletable the next day", () => {
  assert.equal(getDeleteWindowForStatus("2026-09-14", "Pending Approval", now).canDelete, false);
});

test("an approved entry keeps the full 10-day window", () => {
  assert.equal(getDeleteWindowForStatus("2026-09-05", "Approved", now).canDelete, true);
  assert.equal(getDeleteWindowForStatus("2026-09-04", "Approved", now).canDelete, false);
});

test("status matching is case-insensitive and tolerates plain 'Pending'", () => {
  assert.equal(getDeleteWindowForStatus("2026-09-14", "pending", now).canDelete, false);
  assert.equal(getDeleteWindowForStatus("2026-09-14", "PENDING APPROVAL", now).canDelete, false);
});

test("an unknown or missing status is treated as approved (10 days)", () => {
  assert.equal(getDeleteWindowForStatus("2026-09-14", undefined, now).canDelete, true);
});
