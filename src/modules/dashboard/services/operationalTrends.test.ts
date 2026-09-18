import assert from "node:assert/strict";
import test from "node:test";
import { apiClient } from "../../../api";
import { fetchOperationalTrends, TREND_PAGE_SIZE } from "./operationalTrends";

const trip = (tripId: number, tripDate: string) => ({
  tripId,
  tripNo: `TRP-${tripId}`,
  tripDate,
  sourceFarm: "Farm",
  supervisorName: "Supervisor",
  vehicleNo: "AP39AA0001",
  driverName: "Driver",
  loaders: [],
  helpers: [],
  status: "Completed",
  farmBirds: 10,
  farmWeight: 20,
  deliveryShops: 1,
  deliveredBirds: 10,
  deliveredWeight: 19,
  mortalityCount: 0,
  mortalityWeight: 0,
  weightLoss: 1,
  weightLossPercentage: 5,
  mortalityPercentage: 0,
  survivalRate: 1,
});

test("weight movement reads every page in the selected custom range", async () => {
  const originalAdapter = apiClient.defaults.adapter;
  const requestedPages: number[] = [];
  const requestedParams: Record<string, string | number>[] = [];
  apiClient.defaults.adapter = async (config) => {
    const params = config.params as Record<string, string | number>;
    const page = Number(params.page);
    requestedPages.push(page);
    requestedParams.push(params);
    const data =
      page === 1
        ? { data: [trip(1, "2026-09-10")], meta: { total: 2, totalPages: 2 } }
        : { data: [trip(2, "2026-09-11")], meta: { total: 2, totalPages: 2 } };
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };

  try {
    const result = await fetchOperationalTrends({
      fromDate: "2026-09-10",
      toDate: "2026-09-11",
    });
    assert.deepEqual(requestedPages, [1, 2]);
    assert.deepEqual(
      requestedParams.map(({ fromDate, toDate, limit, sortBy, sortDir }) => ({
        fromDate,
        toDate,
        limit,
        sortBy,
        sortDir,
      })),
      [
        {
          fromDate: "2026-09-10",
          toDate: "2026-09-11",
          limit: 500,
          sortBy: "tripDate",
          sortDir: "asc",
        },
        {
          fromDate: "2026-09-10",
          toDate: "2026-09-11",
          limit: 500,
          sortBy: "tripDate",
          sortDir: "asc",
        },
      ],
    );
    assert.equal(TREND_PAGE_SIZE, 500);
    assert.equal(result.totalTrips, 2);
    assert.deepEqual(
      result.rows.map((row) => row.tripDate),
      ["2026-09-10", "2026-09-11"],
    );
  } finally {
    apiClient.defaults.adapter = originalAdapter;
  }
});

test("weight movement rejects an incomplete paginated response", async () => {
  const originalAdapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => ({
    data: { data: [trip(1, "2026-09-10")], meta: { total: 2, totalPages: 1 } },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });

  try {
    await assert.rejects(
      fetchOperationalTrends({ fromDate: "2026-09-10", toDate: "2026-09-11" }),
      /incomplete range/,
    );
  } finally {
    apiClient.defaults.adapter = originalAdapter;
  }
});

test("weight movement treats a 404 Not found as an empty period", async () => {
  const originalAdapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    const error = Object.assign(new Error("Request failed with status code 404"), {
      isAxiosError: true,
      response: {
        data: { error: "Not found" },
        status: 404,
        statusText: "Not Found",
        headers: {},
        config,
      },
      config,
      toJSON: () => ({}),
    });
    throw error;
  };

  try {
    const result = await fetchOperationalTrends({
      fromDate: "2026-09-14",
      toDate: "2026-09-20",
    });
    assert.deepEqual(result, { rows: [], totalTrips: 0 });
  } finally {
    apiClient.defaults.adapter = originalAdapter;
  }
});
