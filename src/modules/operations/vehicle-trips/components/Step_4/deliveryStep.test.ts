import assert from "node:assert/strict";
import test from "node:test";
import { computeDeliveryKpiTotals } from "./deliveryKpis";
import {
  assignedShopOrderFromRows,
  captureRemarksFor,
  computeRemainingBoxes,
  pendingBoxesFromRows,
  pendingShopsFromRows,
  sortShopsAssignedFirst,
  step4ShopsCount,
} from "./remainingBoxes";
// Delivery Tracking's progress maths — what the tracking tables render.
import { computeOrdersProgress } from "../../../../orders/utils/ordersUtils";
import { createEmptyTrip, type Trip } from "../../../../../shared/trip";
import {
  computeValidationErrors,
  validationIsValid,
  EMPTY_DELIVERY_FORM,
} from "./useShopDeliveryForm";
import type { ShopDelivery, BoxDetail } from "../../types/trip";

function box(boxNo: number, birds: number, weight: number): BoxDetail {
  return { boxNo, birds, weight, avgWeight: birds > 0 ? weight / birds : null } as BoxDetail;
}

function row(overrides: Record<string, unknown> = {}): ShopDelivery {
  return {
    id: Date.now() + Math.random(),
    serialNo: 1,
    shopId: 1,
    shopName: "Shop",
    birdTypeId: 1,
    birdType: "Broiler",
    boxNo: 1,
    birds: 0,
    weight: 0,
    mortality: 0,
    rate: 0,
    amount: 0,
    ...overrides,
  } as ShopDelivery;
}

// ─── Live KPI totals ──────────────────────────────────────────────
test("KPI totals are LIVE from current rows and keep bird/weight units separate", () => {
  const rows = [
    row({ shopId: 1, birds: 54, weight: 950, mortality: 2, mortKg: 2.159, autoCaptureTime: "10:00" }),
    row({ shopId: 2, birds: 2, weight: 48, mortality: 0, mortKg: 0, autoCaptureTime: "11:00" }),
  ];
  const kpi = computeDeliveryKpiTotals(rows);
  assert.equal(kpi.shops, 2);
  assert.equal(kpi.birds, 56);
  assert.equal(kpi.weight, 998);
  // Mortality is a BIRD COUNT (2), never the 2.159 kg weight.
  assert.equal(kpi.mortality, 2);
  assert.equal(kpi.mortKg, 2.159);
  assert.equal(kpi.lastCaptureTime, "11:00");
});

test("KPI totals ignore in-progress rows without shop/birds/weight", () => {
  const rows = [
    row({ shopId: 0, birds: 50, weight: 900, mortality: 0 }),
    row({ shopId: 1, birds: 0, weight: 0, mortality: 0 }),
    row({ shopId: 1, birds: 56, weight: 1000, mortality: 0 }),
  ];
  const kpi = computeDeliveryKpiTotals(rows);
  assert.equal(kpi.shops, 1);
  assert.equal(kpi.birds, 56);
});

// ─── Remaining boxes: multi-box rows must consume the WHOLE box ───
test("remaining boxes: box-mode multi-box row consumes every selected box fully", () => {
  const boxes = [box(1, 30, 500), box(2, 26, 480), box(3, 28, 510)];
  const rows = [row({ birds: 56, weight: 980, selectedBoxIds: [1, 2], perBoxData: [] })];
  const used = computeRemainingBoxes(boxes, rows);
  assert.equal(used.get(1)?.birds, Number.MAX_SAFE_INTEGER);
  assert.equal(used.get(2)?.birds, Number.MAX_SAFE_INTEGER);
  const pending = pendingBoxesFromRows(boxes, rows);
  assert.deepEqual(pending.map((b) => b.boxNo), [3]);
  assert.equal(pending[0].birds, 28);
  assert.equal(pending[0].weight, 510);
});

test("remaining boxes: box-mode single-box row consumes birds + mortality", () => {
  const boxes = [box(1, 30, 500), box(2, 26, 480)];
  const rows = [row({ birds: 29, weight: 490, mortality: 1, mortKg: 10, selectedBoxIds: [1] })];
  const pending = pendingBoxesFromRows(boxes, rows);
  assert.deepEqual(pending.map((b) => b.boxNo), [2]);
  assert.equal(pending[0].birds, 26);
});

test("remaining boxes: weight-mode per-box data consumes exact split", () => {
  const boxes = [box(1, 30, 500), box(2, 26, 480)];
  const rows = [
    row({
      birds: 27,
      weight: 460,
      selectedBoxIds: [1, 2],
      perBoxData: [
        { boxNo: 1, birds: 12, weight: 200 },
        { boxNo: 2, birds: 15, weight: 260 },
      ],
    }),
  ];
  const pending = pendingBoxesFromRows(boxes, rows);
  assert.deepEqual(pending.map((b) => b.boxNo), [1, 2]);
  assert.equal(pending[0].birds, 18);
  assert.equal(pending[1].birds, 11);
});

test("pending shops: assigned [ORDER] shops without capture stay pending", () => {
  const rows = [
    row({ shopId: 1, remarks: "[ORDER] O:ORD-1", serialNo: 1 }),
    row({ shopId: 2, remarks: "[ORDER] O:ORD-1", serialNo: 2, autoCaptureTime: "10:00" }),
    row({ shopId: 3, remarks: "", serialNo: 3, autoCaptureTime: "11:00" }),
  ];
  assert.equal(pendingShopsFromRows(rows), 1);
});

test("pending shops: no assignment plan → 0 pending shops", () => {
  const rows = [row({ shopId: 1, remarks: "", autoCaptureTime: "10:00" })];
  assert.equal(pendingShopsFromRows(rows), 0);
});

test("assigned shop order: only [ORDER] plan rows, keyed by serialNo", () => {
  const rows = [
    row({ shopId: 7, remarks: "[ORDER] O:ORD-1", serialNo: 3 }),
    row({ shopId: 8, remarks: "[ORDER] O:ORD-1", serialNo: 1 }),
    // A shop the driver added in Step 4 is NOT part of the assignment plan.
    row({ shopId: 9, remarks: "", serialNo: 2, autoCaptureTime: "10:00" }),
  ];
  const order = assignedShopOrderFromRows(rows);
  assert.deepEqual(
    [...order.entries()].sort((a, b) => a[1] - b[1]),
    [[8, 1], [7, 3]]
  );
  assert.equal(order.has(9), false, "a Step 4 shop is not on the assignment plan");
});

test("shop dropdown: assigned shops first in route order, then all others alphabetically", () => {
  const assignedOrder = new Map<number, number>([[7, 3], [8, 1]]);
  const master = [
    { value: 3, label: "Alpha" },
    { value: 7, label: "Zulu" },
    { value: 1, label: "Mike" },
    { value: 8, label: "Bravo" },
    { value: 5, label: "Echo" },
  ];
  const sorted = sortShopsAssignedFirst(master, assignedOrder);
  // Assigned shops lead, in the assignment's route order (8 → 7), then the
  // rest of the master ALPHABETICALLY (Alpha, Echo, Mike).
  assert.deepEqual(sorted.map((o) => o.value), [8, 7, 3, 5, 1]);
  // The whole master is still offered — the assignment hides nothing.
  assert.equal(sorted.length, master.length);
  // The input array is not mutated.
  assert.deepEqual(master.map((o) => o.value), [3, 7, 1, 8, 5]);
});

test("shop dropdown: no assignment plan → the full master, purely alphabetical", () => {
  const master = [
    { value: 3, label: "Charlie" },
    { value: 1, label: "Alpha" },
    { value: 2, label: "Bravo" },
  ];
  const sorted = sortShopsAssignedFirst(master, new Map());
  assert.deepEqual(sorted.map((o) => o.label), ["Alpha", "Bravo", "Charlie"]);
});

// ─── Delivery Tracking sync: a Step 4 capture must keep the [ORDER] marker ──
// Delivery Tracking counts a shop as delivered only for rows that are BOTH an
// `[ORDER]` plan row AND captured, so a capture saved without the marker left
// the "N shops / M delivered" figures stuck at 0.

test("captureRemarksFor keeps the shop's [ORDER] marker on a Step 4 capture", () => {
  const rows = [
    row({ shopId: 1, remarks: "[ORDER] O:ORD-1", serialNo: 1 }),
    row({ shopId: 2, remarks: "[ORDER] O:ORD-1", serialNo: 2 }),
  ];
  assert.equal(captureRemarksFor(rows, 1, ""), "[ORDER] O:ORD-1");
  // A note the driver typed is preserved, appended after the marker.
  assert.equal(captureRemarksFor(rows, 1, "left at gate"), "[ORDER] O:ORD-1 | left at gate");
  // A shop with no assignment plan keeps just the driver's note.
  assert.equal(captureRemarksFor(rows, 9, "cash"), "cash");
  assert.equal(captureRemarksFor(rows, 9, ""), "");
});

test("captureRemarksFor never duplicates the marker when a capture is edited", () => {
  const rows = [
    row({ shopId: 1, remarks: "[ORDER] O:ORD-1", serialNo: 1 }),
    // The previously saved capture — the form loads its remarks back in.
    row({ shopId: 1, remarks: "[ORDER] O:ORD-1 | left at gate", serialNo: 5, autoCaptureTime: "10:00" }),
  ];
  assert.equal(
    captureRemarksFor(rows, 1, "[ORDER] O:ORD-1 | left at gate"),
    "[ORDER] O:ORD-1 | left at gate"
  );
});

test("a Step 4 capture with the marker preserved syncs into Delivery Tracking", () => {
  const planRows = [1, 2, 3].map((shopId) =>
    row({
      shopId,
      serialNo: shopId,
      remarks: "[ORDER] O:ORD-1",
      birds: 50,
      weight: 100,
      boxNo: 5,
      farmBirds: 50,
      farmWeight: 100,
    })
  );
  const before = computeOrdersProgress(
    createEmptyTrip({ id: 1, deliveries: planRows } as unknown as Trip)
  );
  assert.equal(before.deliveredShops, 0);
  assert.equal(before.status, "Assigned");

  // What Step 4 appends when the driver delivers shop 1 and saves.
  const captured = {
    ...planRows[0],
    id: 900,
    serialNo: 4,
    remarks: captureRemarksFor(planRows, 1, ""),
    autoCaptureTime: "2026-09-18T09:00:00.000Z",
  };
  const after = computeOrdersProgress(
    createEmptyTrip({ id: 1, deliveries: [...planRows, captured] } as unknown as Trip)
  );
  assert.equal(after.deliveredShops, 1, "the delivered shop is counted");
  assert.equal(after.deliveredBoxes, 5, "and its boxes");
  assert.equal(after.pendingShops, 2);
  assert.equal(after.status, "In Progress");

  // The regression this guards: the same capture WITHOUT the marker is
  // invisible to Delivery Tracking.
  const dropped = { ...captured, remarks: "" };
  const broken = computeOrdersProgress(
    createEmptyTrip({ id: 1, deliveries: [...planRows, dropped] } as unknown as Trip)
  );
  assert.equal(broken.deliveredShops, 0, "sanity: dropping the marker loses the delivery");
});

// ─── Step 4 "Shops (N)" header count ────────────────────────────────────────
// The reported bug: the count advertised the assigned shops before the Order
// Assignment was ever submitted ("Shops (11) and I haven't submitted yet").

test("Shops (N): a Save-Progress plan (NOT submitted) counts 0, never the assigned shops", () => {
  const master = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const savedPlan = [
    row({ shopId: 1, remarks: "[ORDER] O:ORD-1", serialNo: 1 }),
    row({ shopId: 2, remarks: "[ORDER] O:ORD-1", serialNo: 2 }),
  ];
  assert.equal(step4ShopsCount(master, savedPlan, false), 0);
});

test("Shops (N): a fresh trip counts 0 — never the whole shop master", () => {
  const master = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(step4ShopsCount(master, [], false), 0);
});

test("Shops (N): unsubmitted trip reads 0 even when it already has deliveries", () => {
  const master = [{ id: 1 }, { id: 2 }, { id: 3 }];
  // A real vehicle trip always carries its own delivery rows — they are not an
  // assignment, so they must not drive the count either.
  const entered = [
    row({ shopId: 5, remarks: "", birds: 40, autoCaptureTime: "10:00" }),
    row({ shopId: 6, remarks: "", weight: 100, autoCaptureTime: "11:00" }),
  ];
  assert.equal(step4ShopsCount(master, entered, false), 0);
  // ...and the same shops count once the assignment IS submitted: 5 and 6 are
  // already captured, so only shop 7 is still to deliver.
  const assigned = [
    ...entered.map((r) => ({ ...r, remarks: "[ORDER] O:ORD-1" })),
    row({ shopId: 7, remarks: "[ORDER] O:ORD-1", serialNo: 3 }),
  ];
  const assignedMaster = [{ id: 5 }, { id: 6 }, { id: 7 }];
  assert.equal(step4ShopsCount(assignedMaster, assigned, true), 1, "shop 7 still to deliver");
});

test("Shops (N): after SUBMIT the count is the assigned shops still to deliver", () => {
  const master = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const assigned = [1, 2, 3, 4].map((shopId) =>
    row({ shopId, remarks: "[ORDER] O:ORD-1", serialNo: shopId })
  );
  assert.equal(step4ShopsCount(master, assigned, true), 4, "all 4 assigned still pending");

  const oneDelivered = [
    ...assigned,
    row({ shopId: 1, remarks: "[ORDER] O:ORD-1", serialNo: 5, birds: 40, autoCaptureTime: "10:00" }),
  ];
  assert.equal(step4ShopsCount(master, oneDelivered, true), 3, "one delivered → 3 left");
});

test("remaining boxes: editing row is excluded from consumption", () => {
  const boxes = [box(1, 30, 500)];
  const rows = [row({ id: 99, birds: 30, weight: 500, selectedBoxIds: [1] })];
  const pendingExcluded = pendingBoxesFromRows(boxes, rows, { excludeRowId: 99 });
  assert.deepEqual(pendingExcluded.map((b) => b.boxNo), [1]);
  const pendingIncluded = pendingBoxesFromRows(boxes, rows);
  assert.deepEqual(pendingIncluded.map((b) => b.boxNo), []);
});

// ─── Derived weight-mode validation (farm weight 29) ─────────────────
// 30 invalid → 28.5 valid → 29.5 invalid → 28 valid, with NO stale state.
function weightModeValidation(farmWeight: number, enteredWeight: number, farmBirds = 29) {
  const formData = {
    ...EMPTY_DELIVERY_FORM,
    selectedBoxIds: [1],
    mortality: 0,
    mortWeight: 0,
    perBoxData: [{ boxNo: 1, birds: farmBirds, weight: enteredWeight }],
  };
  return computeValidationErrors({
    mode: "weight",
    formData,
    farmBirds,
    farmWeight,
    weightModeTotals: { birds: farmBirds, weight: enteredWeight },
    mortKg: 0,
    availableBoxDetails: [{ boxNo: 1, birds: farmBirds, weight: farmWeight }],
  });
}

test("weight mode: over farm weight is invalid; correction becomes valid immediately (no stale state)", () => {
  const over = weightModeValidation(29, 30);
  assert.equal(over.weightExceedFarm, true);
  assert.equal(validationIsValid(over), false);

  const ok285 = weightModeValidation(29, 28.5);
  assert.equal(ok285.weightExceedFarm, false);
  assert.equal(validationIsValid(ok285), true);

  const over295 = weightModeValidation(29, 29.5);
  assert.equal(over295.weightExceedFarm, true);
  assert.equal(validationIsValid(over295), false);

  const ok28 = weightModeValidation(29, 28);
  assert.equal(ok28.weightExceedFarm, false);
  assert.equal(validationIsValid(ok28), true);
});

test("weight mode: per-box weight cannot exceed that box's remaining weight", () => {
  const perBoxOver = computeValidationErrors({
    mode: "weight",
    formData: {
      ...EMPTY_DELIVERY_FORM,
      selectedBoxIds: [1, 2],
      perBoxData: [
        { boxNo: 1, birds: 12, weight: 210 },
        { boxNo: 2, birds: 14, weight: 200 },
      ],
    },
    farmBirds: 26,
    farmWeight: 400,
    weightModeTotals: { birds: 26, weight: 410 },
    mortKg: 0,
    availableBoxDetails: [
      { boxNo: 1, birds: 12, weight: 200 },
      { boxNo: 2, birds: 14, weight: 200 },
    ],
  });
  assert.deepEqual(perBoxOver.perBoxWeightErrors, [true, false]);
  assert.equal(validationIsValid(perBoxOver), false);
});

test("box mode: mortality cannot exceed farm birds of the selected boxes", () => {
  const tooMany = computeValidationErrors({
    mode: "box",
    formData: { ...EMPTY_DELIVERY_FORM, selectedBoxIds: [1], mortality: 31 },
    farmBirds: 30,
    farmWeight: 500,
    weightModeTotals: { birds: 0, weight: 0 },
    mortKg: 0,
    availableBoxDetails: [{ boxNo: 1, birds: 30, weight: 500 }],
  });
  assert.equal(tooMany.birdsExceed, true);
  assert.equal(validationIsValid(tooMany), false);

  const fine = computeValidationErrors({
    mode: "box",
    formData: { ...EMPTY_DELIVERY_FORM, selectedBoxIds: [1], mortality: 1 },
    farmBirds: 30,
    farmWeight: 500,
    weightModeTotals: { birds: 0, weight: 0 },
    mortKg: 0,
    availableBoxDetails: [{ boxNo: 1, birds: 30, weight: 500 }],
  });
  assert.equal(fine.birdsExceed, false);
  assert.equal(validationIsValid(fine), true);
});

test("weight mode: delivered + mortality birds must match farm birds exactly", () => {
  const mismatch = computeValidationErrors({
    mode: "weight",
    formData: {
      ...EMPTY_DELIVERY_FORM,
      selectedBoxIds: [1],
      mortality: 0,
      perBoxData: [{ boxNo: 1, birds: 28, weight: 500 }],
    },
    farmBirds: 29,
    farmWeight: 500,
    weightModeTotals: { birds: 28, weight: 500 },
    mortKg: 0,
    availableBoxDetails: [{ boxNo: 1, birds: 29, weight: 500 }],
  });
  assert.equal(mismatch.birdsMismatch, true);
  assert.equal(validationIsValid(mismatch), false);
});