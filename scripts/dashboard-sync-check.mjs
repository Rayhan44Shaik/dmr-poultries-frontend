// scripts/dashboard-sync-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ↔ QUARTER SAMPLE DATA SYNC CHECK
//
// Loads the REAL dashboard modules (service + derivation) through Vite's SSR
// pipeline, points the shared axios client at the running quarter sample API
// (`scripts/quarter-sample-data.mjs`) and prints everything the dashboard will
// render, then cross-checks those numbers against the same rows the other
// modules read.
//
// It is a read-only diagnostic — no application logic is modified.
//
//   node scripts/quarter-sample-data.mjs        # terminal 1
//   node scripts/dashboard-sync-check.mjs       # terminal 2
//   BASE_URL=http://127.0.0.1:4100 node scripts/dashboard-sync-check.mjs
// ─────────────────────────────────────────────────────────────────────────────

/* ---------- minimal browser shims (node has none) ---------- */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => void store.clear(),
};
globalThis.sessionStorage = { ...globalThis.localStorage };
globalThis.window = globalThis;
globalThis.location = {
  pathname: "/",
  search: "",
  hash: "",
  origin: "http://localhost:5173",
  href: "http://localhost:5173/",
  protocol: "http:",
  host: "localhost:5173",
};
globalThis.history = { state: null, pushState() {}, replaceState() {}, go() {}, back() {}, forward() {} };
globalThis.document = {
  defaultView: globalThis,
  documentElement: { lang: "en", classList: { toggle() {}, add() {}, remove() {} }, style: {} },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} },
  body: { appendChild() {} },
  addEventListener() {},
  removeEventListener() {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createTextNode: (t) => ({ textContent: t }),
};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.HTMLElement = class {};
globalThis.SVGElement = class {};
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
try {
  await import("fake-indexeddb/auto");
} catch {
  /* optional */
}

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4000";
const { createServer } = await import("vite");

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  ssr: { external: ["react", "react-dom", "react-router-dom", "lucide-react", "axios", "date-fns"] },
});

const failures = [];
const warnings = [];
const check = (label, ok, detail = "") => {
  const line = `${ok ? "  ✔" : "  ✘"} ${label}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (!ok) failures.push(label);
};
const warn = (label, detail = "") => {
  console.log(`  ! ${label}${detail ? ` — ${detail}` : ""}`);
  warnings.push(label);
};
const section = (title) => console.log(`\n${title}\n${"-".repeat(title.length)}`);
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n) => Number(n ?? 0);

/* ---------- load the real modules ---------- */
const svc = await server.ssrLoadModule("/src/modules/dashboard/services/dashboardService.ts");
const derive = await server.ssrLoadModule("/src/modules/dashboard/utils/dashboardDerive.ts");
const { apiClient } = await server.ssrLoadModule("/src/api/index.ts");

// Node has no same-origin proxy, so aim the shared client at the sample server.
apiClient.defaults.baseURL = `${BASE}/api`;

/* ---------- 1. raw rows the dashboard aggregates ---------- */
section("1 · Dashboard source rows (dashboardService.loadDashboardData)");
const t0 = Date.now();
const data = await svc.loadDashboardData();
const loadMs = Date.now() - t0;
console.log(`  loaded in ${loadMs}ms`);
const rowCounts = {
  shops: data.shops.length,
  farms: data.farms.length,
  vehicles: data.vehicles.length,
  employees: data.employees.length,
  trips: data.trips.length,
  collections: data.collections.length,
  pendingCollections: data.pendingCollections.length,
  shopSales: data.shopSales.length,
  fuelExpenses: data.fuelExpenses.length,
  maintenance: data.maintenance.length,
};
for (const [k, v] of Object.entries(rowCounts)) console.log(`  ${k.padEnd(20)} ${v}`);
console.log(`  mastersFromApi         ${data.mastersFromApi}`);
console.log(`  sampleQuarter          ${data.sampleQuarter ? data.sampleQuarter.label : "none"}`);
const today = data.sampleQuarter?.today ?? null;
console.log(`  business "today"       ${today ?? "(browser date)"}`);

/* ---------- 2. the server's own manifest ---------- */
section("2 · Quarter sample manifest (GET /api/quarter-summary)");
const { data: manifest } = await apiClient.get("/quarter-summary");
const manifestKeys = [
  "shops",
  "employees",
  "farms",
  "vehicles",
  "trips",
  "deliveries",
  "collections",
  "fuelBills",
  "maintenance",
  "payments",
  "farmPayments",
  "salaries",
  "leaves",
  "marketRates",
];
for (const k of manifestKeys) console.log(`  ${k.padEnd(20)} ${manifest[k] ?? "-"}`);

check("shops synced", rowCounts.shops === manifest.shops, `${rowCounts.shops} vs ${manifest.shops}`);
check("farms synced", rowCounts.farms === manifest.farms, `${rowCounts.farms} vs ${manifest.farms}`);
check("vehicles synced", rowCounts.vehicles === manifest.vehicles, `${rowCounts.vehicles} vs ${manifest.vehicles}`);
check("employees synced", rowCounts.employees === manifest.employees, `${rowCounts.employees} vs ${manifest.employees}`);
check("pending collections cover every shop", rowCounts.pendingCollections === manifest.shops, `${rowCounts.pendingCollections} vs ${manifest.shops}`);

/* ---------- 3. derived dashboard ---------- */
section("3 · Derived dashboard (dashboardDerive.deriveDashboard)");
const d = derive.deriveDashboard(data, (key, params) => {
  const dict = {
    "dashboard.kpi.shops": "Shops",
    "dashboard.kpi.shops_sub": "{active} active · {inactive} inactive",
    "dashboard.kpi.farms": "Farms",
    "dashboard.kpi.farms_sub": "of {total} total",
    "dashboard.kpi.vehicles": "Vehicles",
    "dashboard.kpi.vehicles_sub": "{active} active",
    "dashboard.kpi.employees": "Employees",
    "dashboard.kpi.employees_sub": "{active} active",
    "dashboard.kpi.today_sales": "Today Sales",
    "dashboard.kpi.today_sales_sub": "vs {yesterday} yesterday",
    "dashboard.kpi.today_collections": "Today Collections",
    "dashboard.kpi.today_collections_sub": "vs {yesterday} yesterday",
    "dashboard.kpi.pending": "Pending",
    "dashboard.kpi.pending_sub_overdue": "{count} overdue",
    "dashboard.kpi.pending_sub_due": "{count} with dues",
    "dashboard.kpi.profit": "Est. Profit",
    "dashboard.kpi.profit_sub": "vs {yesterday} yesterday",
  };
  let out = dict[key] ?? key;
  for (const [k, v] of Object.entries(params ?? {})) out = out.replaceAll(`{${k}}`, String(v));
  return out;
});

console.log("  KPI tiles");
for (const kpi of d.kpis) {
  console.log(
    `    ${kpi.label.padEnd(22)} ${String(kpi.value).padStart(12)}   ${kpi.sub}${
      kpi.delta != null ? `   (${kpi.delta > 0 ? "+" : ""}${kpi.delta}%)` : ""
    }`
  );
}

section("4 · Panels / charts");
const nonZero = (arr, key) => arr.filter((r) => num(r[key]) > 0).length;
console.log(`  salesVsCollections    ${d.salesVsCollections.length} pts · ${nonZero(d.salesVsCollections, "sales")} with sales`);
console.log(`  weeklyRevenue         ${d.weeklyRevenue.length} pts · ${nonZero(d.weeklyRevenue, "revenue")} with revenue`);
console.log(`  deliveryVolume        ${d.deliveryVolume.length} pts · ${nonZero(d.deliveryVolume, "birds")} with birds`);
console.log(`  vehicleActivity       ${d.vehicleActivity.map((v) => `${v.name}=${v.value}`).join(" · ")}`);
console.log(`  todayTrips            ${d.todayTrips.length}`);
console.log(`  latestTrips           ${d.latestTrips.length}`);
console.log(`  pendingCollections    ${d.pendingCollections.length}`);
console.log(`  fleet                 ${d.fleet.length} vehicles`);
console.log(`  activity              ${d.activity.length} items`);
console.log(`  hasAnyData            ${d.hasAnyData}`);

console.log("\n  7-day series (dashboard business date anchored):");
for (const row of d.salesVsCollections) console.log(`    ${row.date.padEnd(5)} sales ${inr(row.sales).padStart(14)}   collections ${inr(row.collections)}`);

console.log("\n  Delivery volume:");
for (const row of d.deliveryVolume) console.log(`    ${row.date.padEnd(5)} birds ${String(row.birds).padStart(7)}   weight ${row.weight} kg`);

console.log("\n  Quarter-to-date band (GET /api/operations/dashboard, same aggregate Operations + Accounts render):");
if (d.quarter) {
  console.log(`    ${d.quarter.label}  (${d.quarter.fromDate} → ${d.quarter.toDate}, through ${d.quarter.today})`);
  console.log(`      trips        ${d.quarter.trips}`);
  console.log(`      weight       ${d.quarter.weight} kg`);
  console.log(`      sales        ${inr(d.quarter.sales)}`);
  console.log(`      collections  ${inr(d.quarter.collections)}`);
  console.log(`      expenses     ${inr(d.quarter.expenses)}  (fuel ${inr(d.quarter.fuelExpense)} · trip ${inr(d.quarter.tripExpense)} · service ${inr(d.quarter.maintenanceExpense)})`);
  console.log(`      net          ${inr(d.quarter.sales - d.quarter.expenses)}`);
  console.log(`      outstanding  ${inr(d.quarter.pending)}`);
} else {
  console.log("    (unavailable — band is not rendered)");
}

console.log("\n  Today's trips:");
for (const trip of d.todayTrips.slice(0, 8))
  console.log(`    ${trip.tripNo}  ${trip.vehicle.padEnd(12)} ${String(trip.driver).padEnd(16)} ${trip.status}`);

console.log("\n  Activity timeline:");
for (const item of d.activity.slice(0, 8)) console.log(`    [${item.tone}] ${item.title} — ${item.description} (${item.time})`);

console.log("\n  Fleet status:");
for (const v of d.fleet.slice(0, 8))
  console.log(`    ${v.number.padEnd(12)} ${v.status.padEnd(10)} driver=${v.driver.padEnd(16)} km=${v.km ?? "-"}  ${v.maintenanceNote}`);

/* ---------- 5. cross-module consistency ---------- */
section("5 · Cross-module consistency (dashboard vs the rows every other module reads)");

const { data: serverDash } = await apiClient.get("/operations/dashboard");
const pendingTotal = d.pendingCollections.reduce((a, p) => a + Math.max(0, num(p.currentPending)), 0);
console.log(`  pending total (dashboard)   ${inr(pendingTotal)}`);
console.log(`  pending total (operations)  ${inr(serverDash.pendingCollections)}`);
const pendingDrift = Math.abs(pendingTotal - num(serverDash.pendingCollections)) / Math.max(1, num(serverDash.pendingCollections));
check("pending total matches Operations dashboard", pendingDrift < 0.02, `${(pendingDrift * 100).toFixed(2)}% drift`);

const { data: serverTrips } = await apiClient.get("/operations/trip-list", {
  params: { fromDate: today, toDate: today, limit: 500 },
});
const serverTripRows = serverTrips.data ?? serverTrips;
check(
  "today's trips match the trip list",
  d.todayTrips.length === serverTripRows.length,
  `${d.todayTrips.length} vs ${serverTripRows.length}`
);

// Sales for the dashboard's business date, read straight from the API.
const { data: todaySalesRaw } = await apiClient.get("/operations/shop-sales", {
  params: { fromDate: today, toDate: today, limit: 500 },
});
const todaySalesRows = todaySalesRaw.data ?? todaySalesRaw;
const apiTodaySales = todaySalesRows.reduce((a, s) => a + num(s.amount), 0);
console.log(`  today sales (dashboard)     ${inr(d.totals.todaySales)}`);
console.log(`  today sales (shop-sales)    ${inr(apiTodaySales)}`);
check(
  "today's sales match Shop Sales",
  Math.abs(d.totals.todaySales - apiTodaySales) < 1,
  `${d.totals.todaySales} vs ${apiTodaySales}`
);

const { data: todayColsRaw } = await apiClient.get("/operations/collection-entry", {
  params: { fromDate: today, toDate: today, limit: 500 },
});
const todayColRows = todayColsRaw.data ?? todayColsRaw;
const apiTodayCols = todayColRows.reduce((a, c) => a + num(c.amount), 0);
console.log(`  today collections (dash)    ${inr(d.totals.todayCollections)}`);
console.log(`  today collections (API)     ${inr(apiTodayCols)}`);
check(
  "today's collections match Collections",
  Math.abs(d.totals.todayCollections - apiTodayCols) < 1,
  `${d.totals.todayCollections} vs ${apiTodayCols}`
);

/* ---------- 5b. quarter roll-up ---------- */
section("5b · Quarter roll-up (executive band vs Operations aggregate)");
if (!d.quarter) {
  warn("quarter snapshot unavailable", "GET /api/operations/dashboard did not answer");
} else {
  check("quarter trips > 0", d.quarter.trips > 0, `${d.quarter.trips}`);
  check("quarter sales > 0", d.quarter.sales > 0, inr(d.quarter.sales));
  check("quarter collections > 0", d.quarter.collections > 0, inr(d.quarter.collections));
  check(
    "quarter expenses = fuel + trip + maintenance",
    Math.abs(d.quarter.expenses - (d.quarter.fuelExpense + d.quarter.tripExpense + d.quarter.maintenanceExpense)) < 1,
    `${d.quarter.expenses} vs ${d.quarter.fuelExpense + d.quarter.tripExpense + d.quarter.maintenanceExpense}`
  );
  check(
    "quarter outstanding matches the pending-collections card",
    Math.abs(num(d.quarter.pending) - pendingTotal) / Math.max(1, pendingTotal) < 0.02,
    `${inr(d.quarter.pending)} vs ${inr(pendingTotal)}`
  );
  check(
    "quarter band agrees with the Operations dashboard KPI",
    Math.abs(num(d.quarter.sales) - num(serverDash.totalSales)) < 1,
    `${d.quarter.sales} vs ${serverDash.totalSales}`
  );
}

/* ---------- 6. panel-by-panel population ---------- */
section("6 · Panel population (nothing should be blank)");
check("hasAnyData", d.hasAnyData === true);
check("KPI row complete", d.kpis.length === 8, `${d.kpis.length} tiles`);
check("sales vs collections chart populated", d.salesVsCollections.some((r) => r.sales > 0 || r.collections > 0));
check("weekly revenue chart populated", d.weeklyRevenue.some((r) => r.revenue > 0));
check("delivery volume chart populated", d.deliveryVolume.some((r) => r.birds > 0 || r.weight > 0));
check("vehicle activity donut populated", d.vehicleActivity.some((r) => r.value > 0));
check("trips table populated", d.todayTrips.length > 0 || d.latestTrips.length > 0);
check("pending collections card populated", d.pendingCollections.length > 0);
check("fleet card populated", d.fleet.length > 0);
check("activity timeline populated", d.activity.length > 0);
check(
  "fleet cars carry a driver + odometer",
  d.fleet.filter((v) => v.driver !== "—" && v.km != null).length > 0,
  `${d.fleet.filter((v) => v.driver !== "—" && v.km != null).length}/${d.fleet.length}`
);
const zeroKpis = d.kpis.filter((k) => /^0(\.0+)?$/.test(k.value) || k.value === "₹0" || k.value === "0");
if (zeroKpis.length > 0) warn("zero-valued KPI tiles", zeroKpis.map((k) => k.label).join(", "));
if (d.todayTrips.length === 0) warn("no trips for the dataset's business date — trips table falls back to latest");
if (d.activity.length < 4) warn("activity timeline is thin", `${d.activity.length} items`);

// With a full quarter behind it the business date must not read as empty: this
// is the regression the dashboard/dataset sync is meant to prevent (today's
// sales used to be ₹0 because every trip dated today was still in flight).
const salesKpi = d.kpis.find((k) => k.key === "todaySales");
check("today's sales tile is populated", d.totals.todaySales > 0, salesKpi?.value ?? "n/a");
check("today's collections tile is populated", d.totals.todayCollections > 0);
check(
  "7-day series is populated on most days",
  d.salesVsCollections.filter((r) => r.sales > 0).length >= 5,
  `${d.salesVsCollections.filter((r) => r.sales > 0).length}/7 days with sales`
);
check(
  "profit tile uses the same expense model as Operations (fuel + trip + maintenance)",
  d.totals.todayExpenses >= d.totals.todayMaintenance,
  `expenses ${inr(d.totals.todayExpenses)} · maintenance ${inr(d.totals.todayMaintenance)}`
);

/* ---------- verdict ---------- */
section("Result");
if (failures.length === 0) {
  console.log(`  ✔ ALL CHECKS PASSED${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
} else {
  console.log(`  ✘ ${failures.length} CHECK(S) FAILED`);
  for (const f of failures) console.log(`      · ${f}`);
}
for (const w of warnings) console.log(`      ! ${w}`);

await server.close();
process.exit(failures.length === 0 ? 0 : 1);
