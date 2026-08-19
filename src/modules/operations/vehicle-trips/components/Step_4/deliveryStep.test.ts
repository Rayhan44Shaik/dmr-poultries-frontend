import assert from "node:assert/strict";
import test from "node:test";
import { computeDeliveryKpiTotals } from "./deliveryKpis";
import { computeRemainingBoxes, pendingBoxesFromRows } from "./remainingBoxes";
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

test("remaining boxes: editing row is excluded from consumption", () => {
  const boxes = [box(1, 30, 500)];
  const rows = [row({ id: 99, birds: 30, weight: 500, selectedBoxIds: [1] })];
  const pendingExcluded = pendingBoxesFromRows(boxes, rows, { excludeRowId: 99 });
  assert.deepEqual(pendingExcluded.map((b) => b.boxNo), [1]);
  const pendingIncluded = pendingBoxesFromRows(boxes, rows);
  assert.deepEqual(pendingIncluded.map((b) => b.boxNo), []);
});