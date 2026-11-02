/**
 * Approved collections stay deletable for 14 days from approval, matching
 * Shop Sales. Pending entries remain deletable on their entry day only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  getDeleteWindow,
  daysSinceEntry,
  COLLECTION_DELETE_WINDOW_DAYS,
  getDeleteWindowForStatus,
  getApprovedDeleteWindow,
} from "./collectionDeleteWindow";

const now = new Date(2026, 8, 15); // 2026-09-15, local midnight
const nowUtc = new Date("2026-09-15T12:00:00.000Z");

test("the approved window is 14 days", () => {
  assert.equal(COLLECTION_DELETE_WINDOW_DAYS, 14);
});

test("an entry made today is deletable with 14 calendar days left", () => {
  const w = getDeleteWindow("2026-09-15", now);
  assert.equal(w.canDelete, true);
  assert.equal(w.ageInDays, 0);
  assert.equal(w.daysRemaining, 14);
  assert.equal(w.deadline, "2026-09-29");
});

test("day 14 is still permitted on the calendar window", () => {
  const w = getDeleteWindow("2026-09-01", now);
  assert.equal(w.canDelete, true);
  assert.equal(w.ageInDays, 14);
  assert.equal(w.daysRemaining, 0);
});

test("day 15 is refused", () => {
  const w = getDeleteWindow("2026-08-31", now);
  assert.equal(w.canDelete, false);
  assert.equal(w.ageInDays, 15);
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

test("a pending entry is deletable on its entry day", () => {
  const w = getDeleteWindowForStatus("2026-09-15", "Pending Approval", now);
  assert.equal(w.canDelete, true);
  assert.equal(w.daysRemaining, 0);
  assert.equal(w.deadline, "2026-09-15");
});

test("a pending entry is NOT deletable the next day", () => {
  assert.equal(getDeleteWindowForStatus("2026-09-14", "Pending Approval", now).canDelete, false);
});

test("an approved entry uses approval time, not the collection date", () => {
  const collectedLongAgo = "2026-08-01";
  const approvedRecently = "2026-09-10T12:00:00.000Z";
  const w = getDeleteWindowForStatus(collectedLongAgo, "Approved", nowUtc, approvedRecently);
  assert.equal(w.canDelete, true);
});

test("an approved entry is locked 14 days after approval", () => {
  const approvedAt = "2026-09-01T12:00:00.000Z";
  assert.equal(getApprovedDeleteWindow(approvedAt, nowUtc).canDelete, false);
  assert.equal(
    getDeleteWindowForStatus("2026-08-01", "Approved", nowUtc, approvedAt).canDelete,
    false,
  );
});

test("an approved entry is still open just under 14 days after approval", () => {
  const approvedAt = "2026-09-01T12:00:01.000Z";
  assert.equal(getApprovedDeleteWindow(approvedAt, nowUtc).canDelete, true);
});

test("status matching is case-insensitive and tolerates plain 'Pending'", () => {
  assert.equal(getDeleteWindowForStatus("2026-09-14", "pending", now).canDelete, false);
  assert.equal(getDeleteWindowForStatus("2026-09-14", "PENDING APPROVAL", now).canDelete, false);
});

test("an unknown or missing status is treated as approved (14 days from the given stamp)", () => {
  assert.equal(getDeleteWindowForStatus("2026-09-10", undefined, nowUtc, "2026-09-10T12:00:00.000Z").canDelete, true);
});
