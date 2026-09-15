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

/* ------------------------------------------------------------------ */
/*  Independent read of the SAME API, straight from each module's own   */
/*  endpoint. The dashboard is only "in sync" if its derived numbers    */
/*  equal what the owning module would render for the same day.         */
/* ------------------------------------------------------------------ */
type Row = Record<string, unknown>;
const n = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Follow the paged envelope to the end, exactly like the dashboard does. */
async function readAll(path: string, params: Record<string, string> = {}): Promise<Row[]> {
  const out: Row[] = [];
  for (let page = 1; page <= 40; page += 1) {
    const { data } = await apiClient.get<unknown>(path, { params: { ...params, page, limit: 500 } });
    if (Array.isArray(data)) return data as Row[];
    const env = data as { data?: Row[]; meta?: { totalPages?: number } };
    const chunk = Array.isArray(env?.data) ? env.data : [];
    out.push(...chunk);
    if (chunk.length === 0 || page >= n(env?.meta?.totalPages ?? 1)) break;
  }
  return out;
}

const failures: string[] = [];
function expectEqual(label: string, actual: number, expected: number, tolerance = 0.01): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failures.push(`${label}: dashboard ${actual} ≠ module ${expected}`);
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(46)} ${actual} ${ok ? "=" : "≠"} ${expected}`);
}
function expectTrue(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
}

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

  /* ---------------------------------------------------------------- */
  /*  Cross-check every headline number against the owning module      */
  /* ---------------------------------------------------------------- */
  const today = data.sampleQuarter?.today;
  if (!today) {
    console.log("No quarter sample API detected — cross-module assertions skipped.\n");
    return;
  }
  const day = { fromDate: today, toDate: today };

  const [saleRows, collectionRows, pendingRows, tripRows, fuelRows] = await Promise.all([
    readAll("/operations/shop-sales", day),
    readAll("/operations/collection-entry", day),
    readAll("/operations/collections/pending"),
    readAll("/operations/trip-list", day),
    readAll("/operations/fuel-expenses", day),
  ]);

  // Shop Sales module: live rows only.
  const liveSales = saleRows.filter((r) => r.deleted !== true);
  // Collections module: an approved receipt is the only booked money.
  const bookedCollections = collectionRows.filter((r) => r.deleted !== true && r.status === "Approved");
  // Trip List: cancelled dispatches are excluded from every aggregate.
  const liveTrips = tripRows.filter((r) => r.deleted !== true && r.status !== "Deleted");
  // Fuel module: a rejected claim was never an expense.
  const bookedFuel = fuelRows.filter((r) => r.status !== "Rejected");

  console.log(`Cross-module checks for the dashboard's business date ${today}:`);
  expectEqual(
    "Today's Sales = Shop Sales module",
    round2(derived.totals.todaySales),
    round2(liveSales.reduce((t, r) => t + n(r.amount), 0)),
  );
  expectEqual(
    "Today's birds = Shop Sales module",
    derived.totals.todayBirds,
    liveSales.reduce((t, r) => t + n(r.birds ?? r.totalBirds), 0),
  );
  expectEqual(
    "Today's weight = Shop Sales module",
    round2(derived.totals.todayWeight),
    round2(liveSales.reduce((t, r) => t + n(r.weight ?? r.totalWeight), 0)),
  );
  expectEqual(
    "Today's Collections = Collections module",
    round2(derived.totals.todayCollections),
    round2(bookedCollections.reduce((t, r) => t + n(r.amount), 0)),
  );
  expectEqual(
    "Pending total = Pending Collections page",
    round2(derived.totals.pendingAmount),
    round2(pendingRows.reduce((t, r) => t + n(r.currentPending), 0)),
  );
  expectEqual(
    "Overdue shops = Pending Collections page",
    derived.totals.overdueCount,
    pendingRows.filter((r) => n(r.overdueDays) > 0).length,
  );
  expectEqual("Today's Trips = Trip List module", derived.todayTrips.length, liveTrips.length);
  expectEqual(
    "Today's Profit = sales − fuel − trip expense",
    round2(derived.totals.todayProfit),
    round2(
      liveSales.reduce((t, r) => t + n(r.amount), 0) -
        bookedFuel.reduce((t, r) => t + n(r.amount), 0) -
        liveTrips.reduce((t, r) => t + n(r.expense), 0),
    ),
  );

  // The Operations Dashboard is the other screen showing quarter outstanding;
  // both must report one figure from one dataset.
  const { data: opsDash } = await apiClient.get<{ pendingCollections?: number }>("/operations/dashboard");
  expectEqual(
    "Pending total = Operations Dashboard",
    round2(derived.totals.pendingAmount),
    round2(n(opsDash?.pendingCollections)),
  );

  // Series integrity: the 7-day charts must actually carry the quarter's data.
  const operatingPoints = derived.salesVsCollections.filter((p) => p.sales > 0).length;
  expectTrue(
    `Sales series is populated (${operatingPoints}/7 points carry sales)`,
    operatingPoints >= 5,
  );
  expectTrue(
    `Delivery Volume series is populated (${derived.deliveryVolume.filter((p) => p.birds > 0).length}/7 points)`,
    derived.deliveryVolume.filter((p) => p.birds > 0).length >= 5,
  );
  expectTrue("No cancelled trip is shown as today's trip", derived.todayTrips.every((tr) => tr.status !== "Deleted"));
  expectTrue("Fleet card covers every vehicle master", derived.fleet.length === data.vehicles.length);
  expectTrue("Activity timeline is populated", derived.activity.length > 0);

  console.log("");
  if (failures.length > 0) {
    console.error(`✗ Overview Dashboard is OUT OF SYNC — ${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`   · ${f}`);
    throw new Error(`Dashboard sync check failed with ${failures.length} mismatch(es).`);
  }
  console.log("✓ Overview Dashboard is in sync with every source module for the quarter sample data.\n");
}
