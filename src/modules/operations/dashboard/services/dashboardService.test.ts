import assert from "node:assert/strict";
import test from "node:test";
import {
  mapDashboardResponse,
  type OperationsDashboardApiResponse,
} from "./dashboardService";

const completeModuleCounts = {
  tripRecords: 632,
  rateEntries: 83,
  shopSales: 6875,
  collections: 4762,
  pendingShops: 195,
  mortalityTrips: 526,
  fuelBills: 1201,
  orders: 8,
};

test("overview preserves the quarter API's register counts without deriving replacements", () => {
  const raw: OperationsDashboardApiResponse = {
    totalTrips: 623,
    totalSales: 54_630_778.77,
    moduleCounts: completeModuleCounts,
    sample: true,
    quarter: {
      code: "Q3-2026",
      label: "Quarter 3 — Jun to Sep 2026",
      fromDate: "2026-06-17",
      toDate: "2026-09-16",
      today: "2026-09-16",
    },
  };

  const data = mapDashboardResponse(raw);

  // Trip List intentionally includes its deleted audit rows (632), while the
  // main metric counts only live rows (623). The overview must retain both
  // meanings rather than overwrite the register total with the KPI value.
  assert.equal(data.totalTrips, 623);
  assert.deepEqual(data.moduleCounts, completeModuleCounts);
  assert.equal(data.sampleQuarter?.fromDate, "2026-06-17");
  assert.equal(data.sampleQuarter?.toDate, "2026-09-16");
});

test("overview hides the register map when a backend does not supply every count", () => {
  const data = mapDashboardResponse({
    totalTrips: 12,
    moduleCounts: { tripRecords: 12, shopSales: 100 },
  });

  assert.equal(data.moduleCounts, null);
});
