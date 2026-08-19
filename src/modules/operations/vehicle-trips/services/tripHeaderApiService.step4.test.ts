import assert from "node:assert/strict";
import test from "node:test";
import { formatStartTimeForDisplay, mapApiTripToTrip, toStep4Payload, validateStep4Deliveries } from "./tripHeaderApiService";

test("toStep4Payload sends only delivery rows — no KPI or timestamp", () => {
  const payload = toStep4Payload({
    totalShops: 9,
    totalBirdsDelivered: 999,
    totalDeliveredWeight: 999,
    deliveryStepSubmitted: true,
    deliveries: [
      {
        id: 12,
        clientKey: "ck-a",
        shopId: 3,
        shopName: "Alpha",
        birdTypeId: 1,
        birdType: "Broiler",
        birds: 40,
        weight: 80,
        mortality: 2,
        mortKg: 3,
        remarks: "ok",
        deliveryMode: "box",
        selectedBoxIds: [1],
        perBoxData: [],
        serialNo: 1,
        autoCaptureTime: "browser-time",
      } as any,
    ],
  } as any);
  assert.deepEqual(Object.keys(payload), ["deliveries"]);
  const row = (payload.deliveries as any[])[0];
  assert.equal(row.clientKey, "ck-a");
  assert.equal(row.shopId, 3);
  assert.equal(row.birds, 40);
  assert.equal("autoCaptureTime" in row, false);
  assert.equal("totalShops" in payload, false);
  assert.equal("deliveryStepSubmitted" in payload, false);
  assert.equal(Number.isFinite(row.birds), true);
  assert.equal(Number.isFinite(row.weight), true);
  assert.equal(Number.isFinite(row.mortality), true);
  assert.equal(Number.isFinite(row.mortKg), true);
});

test("toStep4Payload never emits NaN and validateStep4Deliveries requires Bird Type", () => {
  const payload = toStep4Payload({
    deliveries: [
      {
        id: 12,
        shopId: 3,
        shopName: "Alpha",
        birdTypeId: Number("x"),
        birdType: "",
        birds: Number(undefined),
        weight: Number("bad"),
        mortality: Number(""),
        mortKg: Number(undefined),
        selectedBoxIds: [1, Number("nope")],
        perBoxData: [{ boxNo: 1, birds: Number("x"), weight: 1 }],
      } as any,
    ],
  } as any);
  const row = (payload.deliveries as any[])[0];
  assert.equal(Object.values(row).some((value) => typeof value === "number" && !Number.isFinite(value)), false);
  assert.equal(row.selectedBoxIds.includes(NaN), false);
  assert.deepEqual(row.perBoxData, []);
  const errors = validateStep4Deliveries([
    {
      id: 1,
      boxNo: 1,
      shopId: 3,
      shopName: "Alpha",
      birdTypeId: 0,
      birdType: "",
      birds: 10,
      weight: 20,
      mortality: 0,
      rate: null,
      amount: 0,
      remarks: "",
    },
  ]);
  assert.equal(errors.some((error) => /Bird Type is required/.test(error)), true);
});

test("View maps Step 4 autoCaptureTime with the same formatter as Step 1–3", () => {
  const iso = "2026-12-08T17:31:08.000Z";
  const mapped = mapApiTripToTrip({
    id: 1,
    startTime: iso,
    reachedTime: iso,
    deliveries: [{ id: 1, autoCaptureTime: iso, shopName: "Shop", birds: 1, weight: 1 }],
  });
  assert.equal(mapped.deliveries[0].autoCaptureTime, formatStartTimeForDisplay(iso));
  assert.equal(mapped.startTime, formatStartTimeForDisplay(iso));
  assert.equal(mapped.reachedTime, formatStartTimeForDisplay(iso));
  assert.equal(mapped.deliveries[0].autoCaptureTime?.includes("T"), false);
});
