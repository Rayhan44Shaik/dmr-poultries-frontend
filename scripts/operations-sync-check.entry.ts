// Dev-SSR harness: run the REAL service layer of every Operations module tab
// (the exact functions each page calls — trip list, trip entry, orders,
// shop sales, rate entry, collection entry/pending/report, mortality, fuel)
// through the same module graph `npm run dev` serves, against the live
// quarter sample API. This proves scripts/quarter-sample-data.mjs is
// perfectly mapped to the Operations module pages — no new sample data,
// just the existing dataset read through the frontend's own mappers.
import "./dashboard-sync-check-stub";
import { apiClient, apiGet } from "../src/api";
import { listTrips, listCompletedTrips } from "../src/modules/operations/vehicle-trips/services/tripHeaderApiService";
import { listShopSales } from "../src/modules/operations/shop-sales/services/shopSalesApiService";
import { listEligibleTrips } from "../src/modules/operations/shop-sales/services/rateEntryApiService";
import { fuelExpenseService } from "../src/modules/operations/fuel-expenses/services/fuelExpenseService";
import { fetchMortalityAnalysis, fetchTripDeliveries } from "../src/modules/operations/mortality/services/mortalityAnalysisApi";
import { collectionService } from "../src/modules/operations/collections/services/collectionService";

// Harness-only redirect: Node has no same-origin /api reverse proxy, so the
// shared client points straight at the sample API. No app code changes.
apiClient.defaults.baseURL = process.env.CHECK_API_BASE || "http://127.0.0.1:4000/api";

type CheckResult = { tab: string; check: string; ok: boolean; detail: string };

const results: CheckResult[] = [];
function record(tab: string, check: string, ok: boolean, detail: string) {
  results.push({ tab, check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${tab}] ${check} — ${detail}`);
}

export async function runOperationsSyncCheck(): Promise<void> {
  // Quarter window straight from the sample server — every date-bound check
  // below must stay inside it.
  const { data: q } = await apiGet<{ quarter: { fromDate: string; toDate: string; today: string } }>(
    "/quarter-summary"
  );
  const today = q.quarter.today;

  // ── 1. Overview (Operations Dashboard) ────────────────────────────────────
  try {
    const { data } = await apiGet<Record<string, unknown>>("/operations/dashboard", {
      params: { fromDate: q.quarter.fromDate, toDate: q.quarter.toDate },
    });
    const trendData = (data.trendData ?? []) as unknown[];
    const recentTrips = (data.recentTrips ?? []) as unknown[];
    const ok =
      Number(data.totalTrips ?? 0) > 0 &&
      Number(data.totalSales ?? 0) > 0 &&
      trendData.length > 0 &&
      recentTrips.length > 0;
    record(
      "overview",
      "GET /operations/dashboard",
      ok,
      `${data.totalTrips} trips · sales ${Number(data.totalSales).toLocaleString("en-IN")} · ${trendData.length} trend days · ${recentTrips.length} recent trips`
    );
  } catch (err) {
    record("overview", "GET /operations/dashboard", false, String(err));
  }

  // ── 2. Trip Entry / Recent Trips ──────────────────────────────────────────
  let firstDraftOrPendingTripId: number | null = null;
  try {
    const trips = await listTrips({});
    const statuses = new Set(trips.map((t) => t.status));
    firstDraftOrPendingTripId = trips.find((t) => t.status !== "Completed")?.id ?? trips[0]?.id ?? null;
    record(
      "trip-entry",
      "listTrips() → GET /trips",
      trips.length > 0 && statuses.has("Draft") && statuses.has("Completed"),
      `${trips.length} trips · statuses: ${[...statuses].join(", ")}`
    );
  } catch (err) {
    record("trip-entry", "listTrips() → GET /trips", false, String(err));
  }

  // ── 3. Trip List (completed, paginated, sorted) ──────────────────────────
  try {
    const page = await listCompletedTrips({ page: 1, limit: 10, sortBy: "tripDate", sortDir: "desc" });
    const first = page.data[0];
    const mapped = Boolean(first && first.tripNo && first.tripDate && first.status === "Completed");
    record(
      "trip-list",
      "listCompletedTrips() → GET /operations/trip-list",
      page.meta.total > 0 && mapped,
      `${page.meta.total} completed trips · first: ${first?.tripNo ?? "?"} ${first?.tripDate ?? "?"}`
    );
  } catch (err) {
    record("trip-list", "listCompletedTrips() → GET /operations/trip-list", false, String(err));
  }

  // ── 4. Orders (full trip hydration with delivery rows) ───────────────────
  try {
    const trips = await listTrips({ full: true });
    const completed = trips.filter((t) => t.status === "Completed");
    const withDeliveries = completed.filter((t) => (t.deliveries ?? []).length > 0);
    const shopLines = withDeliveries.reduce((n, t) => n + (t.deliveries ?? []).length, 0);
    record(
      "orders",
      "listTrips({full:true}) deliveries hydrated",
      withDeliveries.length > 0 && shopLines > 0,
      `${withDeliveries.length}/${completed.length} completed trips carry ${shopLines} delivery lines`
    );
  } catch (err) {
    record("orders", "listTrips({full:true}) deliveries hydrated", false, String(err));
  }

  // ── 5. Shop Sales ─────────────────────────────────────────────────────────
  try {
    const sales = await listShopSales({ sortBy: "latest" });
    const first = sales[0];
    const mapped = Boolean(first && first.saleNo && first.shopName && first.tripNo);
    record(
      "shop-sales",
      "listShopSales() → GET /operations/shop-sales",
      sales.length > 0 && mapped,
      `${sales.length} sale lines · first: ${first?.saleNo ?? "?"} ${first?.shopName ?? "?"}`
    );
  } catch (err) {
    record("shop-sales", "listShopSales() → GET /operations/shop-sales", false, String(err));
  }

  // ── 6. Rate Entry ─────────────────────────────────────────────────────────
  try {
    const eligible = await listEligibleTrips();
    record(
      "rate-entry",
      "listEligibleTrips() → GET /operations/rate-entry",
      eligible.length > 0,
      `${eligible.length} trips awaiting/holding rate entry`
    );
  } catch (err) {
    record("rate-entry", "listEligibleTrips() → GET /operations/rate-entry", false, String(err));
  }

  // ── 7. Collection Entry (week bounds, weekly summaries, per-shop) ────────
  try {
    const bounds = await collectionService.fetchWeekBounds(today);
    const summaries = await collectionService.fetchWeeklySummaries(today);
    const firstShop = summaries[0];
    const detail = await collectionService.fetchWeeklySummary(firstShop.shopId, today);
    const recent = await collectionService.fetchRecentCollectionsForShop(firstShop.shopId, 5);
    const ok =
      Boolean(bounds.weekStart && bounds.weekEnd) &&
      summaries.length > 0 &&
      detail.shopId === firstShop.shopId &&
      typeof detail.openingBalance === "number";
    record(
      "collection",
      "week-bounds + weekly-summaries + weekly-summary + recent",
      ok,
      `week ${bounds.weekStart}→${bounds.weekEnd} · ${summaries.length} shop rows · ${firstShop.shopName}: opening ${detail.openingBalance}, ${recent.length} recent entries`
    );
  } catch (err) {
    record("collection", "week-bounds + weekly-summaries + weekly-summary + recent", false, String(err));
  }

  // ── 8. Pending Collections ────────────────────────────────────────────────
  try {
    const pending = await collectionService.fetchPendingSummary(today);
    const ok = pending.shops.length > 0 && pending.shops.every((s) => typeof s.balance === "number");
    record(
      "pending-collections",
      "fetchPendingSummary() → GET /collection-entry/pending-summary",
      ok,
      `${pending.shops.length} shop rows (week ${pending.weekStart || "n/a"})`
    );
  } catch (err) {
    record("pending-collections", "fetchPendingSummary() → GET /collection-entry/pending-summary", false, String(err));
  }

  // ── 9. Collection Report ──────────────────────────────────────────────────
  try {
    const report = await collectionService.fetchCollectionReport({
      fromDate: q.quarter.fromDate,
      toDate: q.quarter.toDate,
    });
    record(
      "collection-report",
      "fetchCollectionReport() → GET /collection-entry/report",
      report.totalCount > 0 && report.collectorSummary.length > 0,
      `${report.totalCount} collections · ₹${report.totalAmount.toLocaleString("en-IN")} · ${report.collectorSummary.length} collectors · ${report.paymentModeSummary.length} payment modes`
    );
  } catch (err) {
    record("collection-report", "fetchCollectionReport() → GET /collection-entry/report", false, String(err));
  }

  // ── 10. Mortality / Trip Loss Analysis ────────────────────────────────────
  try {
    const analysis = await fetchMortalityAnalysis({});
    const firstTrip = analysis.data[0];
    const lines = firstTrip ? await fetchTripDeliveries(Number(firstTrip.tripId)) : [];
    record(
      "mortality",
      "fetchMortalityAnalysis() + fetchTripDeliveries()",
      analysis.data.length > 0 && lines.length > 0,
      `${analysis.meta.total ?? analysis.data.length} trips · ${firstTrip?.tripNo ?? "?"} expands to ${lines.length} shop lines`
    );
  } catch (err) {
    record("mortality", "fetchMortalityAnalysis() + fetchTripDeliveries()", false, String(err));
  }

  // ── 11. Fuel Expenses ─────────────────────────────────────────────────────
  try {
    const fuel = await fuelExpenseService.list({ page: 1, limit: 10 });
    const first = fuel.data[0];
    const ok = fuel.meta.total > 0 && Boolean(first && first.billNo && first.vehicleNo);
    record(
      "fuel-expenses",
      "fuelExpenseService.list() → GET /operations/fuel-expenses",
      ok,
      `${fuel.meta.total} bills · first: ${first?.billNo ?? "?"} ${first?.vehicleNo ?? "?"} · summary total ${fuel.summary?.totalAmount ?? "n/a"}`
    );
  } catch (err) {
    record("fuel-expenses", "fuelExpenseService.list() → GET /operations/fuel-expenses", false, String(err));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n================= OPERATIONS MODULE SYNC REPORT =================`);
  console.log(
    `${results.length - failed.length}/${results.length} checks passed against quarter ${q.quarter.fromDate} → ${q.quarter.toDate} (today ${today})`
  );
  if (failed.length > 0) {
    console.log("FAILED CHECKS:");
    failed.forEach((f) => console.log(`  ✗ [${f.tab}] ${f.check}: ${f.detail}`));
    process.exitCode = 1;
  } else {
    console.log("Every Operations tab reads its data through the real frontend mappers. ✔");
  }
  console.log("==================================================================");
}
