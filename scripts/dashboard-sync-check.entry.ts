// Dev-SSR harness: run the REAL Overview Dashboard data pipeline
// (loadDashboardData + deriveDashboard) against the live quarter sample API
// using the same module graph `npm run dev` serves, and print a compact
// report. This is the "sync" check — it proves the dashboard reads the same
// rows every other module renders.
import "./dashboard-sync-check-stub";
import { apiClient } from "../src/api";
import { loadDashboardData } from "../src/modules/dashboard/services/dashboardService";
import { deriveDashboard } from "../src/modules/dashboard/utils/dashboardDerive";

// Harness-only redirect: Node has no same-origin /api reverse proxy, so the
// shared client points straight at the sample API. No app code changes.
apiClient.defaults.baseURL = process.env.CHECK_API_BASE || "http://127.0.0.1:4000/api";

const inr = (n: number) =>
  "₹" + (n >= 1e7 ? (n / 1e7).toFixed(2) + " Cr" : n >= 1e5 ? (n / 1e5).toFixed(2) + " L" : Math.round(n).toLocaleString("en-IN"));

export async function runDashboardSyncCheck(): Promise<void> {
  const data = await loadDashboardData();
  const derived = deriveDashboard(data);

  const report = {
    sampleQuarter: data.sampleQuarter
      ? { code: data.sampleQuarter.code, from: data.sampleQuarter.fromDate, to: data.sampleQuarter.toDate, today: data.sampleQuarter.today }
      : null,
    mastersFromApi: data.mastersFromApi,
    counts: {
      shops: data.shops.length,
      farms: data.farms.length,
      vehicles: data.vehicles.length,
      employees: data.employees.length,
      trips: data.trips.length,
      collections: data.collections.length,
      shopSales: data.shopSales.length,
      fuelExpenses: data.fuelExpenses.length,
      pendingShops: data.pendingCollections.length,
      maintenance: data.maintenance.length,
    },
    kpis: derived.kpis.map((k) => ({ key: k.key, value: k.value })),
    totals: {
      pendingAmount: inr(derived.totals.pendingAmount),
      todaySales: inr(derived.totals.todaySales),
      todayCollections: inr(derived.totals.todayCollections),
      todayProfit: inr(derived.totals.todayProfit),
      todayBirds: derived.totals.todayBirds,
      todayWeight: derived.totals.todayWeight,
      overdueCount: derived.totals.overdueCount,
    },
    hasAnyData: derived.hasAnyData,
    todayTrips: derived.todayTrips.length,
    latestTrips: derived.latestTrips.length,
    fleet: derived.fleet.map((f) => ({ no: f.number, status: f.status, driver: f.driver, km: f.km, note: f.maintenanceNote })),
    vehicleActivity: derived.vehicleActivity,
    seriesSales: derived.salesVsCollections.map((s) => ({ d: s.date, sales: s.sales, collections: s.collections })),
    deliveryVolume: derived.deliveryVolume.map((s) => ({ d: s.date, birds: s.birds, weight: s.weight })),
    activity: derived.activity.map((a) => a.title),
    topPending: derived.pendingCollections.slice(0, 3).map((p) => ({ shop: p.shopName, pending: inr(p.currentPending) })),
  };

  console.log("\n================= OVERVIEW DASHBOARD SYNC REPORT =================");
  console.log(JSON.stringify(report, null, 2));
  console.log("================================================================\n");
}
