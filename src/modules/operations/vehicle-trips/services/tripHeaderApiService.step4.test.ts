import assert from "node:assert/strict";
import test from "node:test";
import { formatStartTimeForDisplay, mapApiTripToTrip, toStep4Payload } from "./tripHeaderApiService";

test("toStep4Payload sends only delivery rows — no KPI or submit flag; keeps per-shop autoCaptureTime", () => {
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
        subShopName: "Counter B",
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
  assert.equal(row.subShopName, "COUNTER B");
  assert.equal(row.remarks, "OK");
  assert.equal(row.birds, 40);
  assert.equal(row.amount, 0);
  assert.equal(Number.isNaN(row.amount), false);
  // Per-shop capture time is forwarded so the backend preserves it on edit.
  assert.equal(row.autoCaptureTime, "browser-time");
  assert.equal("totalShops" in payload, false);
  assert.equal("deliveryStepSubmitted" in payload, false);
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
  assert.equal(
    /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2} IST$/.test(mapped.deliveries[0].autoCaptureTime ?? ""),
    true,
  );
});
