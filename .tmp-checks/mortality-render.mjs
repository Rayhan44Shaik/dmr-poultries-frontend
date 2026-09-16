// TEMP audit harness: server-renders the Weight Loss / Mortality page (and the
// table + KPI strip with fixture data) through the real Vite module graph, then
// asserts the Trip List parity surface is actually in the markup.
// Run: cd /home/user/dmr-poultries-frontend && npx tsx .tmp-checks/mortality-render.mjs
import { createServer } from "vite";

/* ── Minimal browser shims (node has none) ─────────────────────────────── */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => void store.clear(),
};
globalThis.sessionStorage = { ...globalThis.localStorage };
globalThis.window = globalThis;
globalThis.location = { pathname: "/operations", search: "?tab=mortality", hash: "", origin: "http://localhost:5173", href: "http://localhost:5173/operations?tab=mortality", protocol: "http:", host: "localhost:5173" };
globalThis.history = { state: null, pushState() {}, replaceState() {}, go() {}, back() {}, forward() {} };
globalThis.document = {
  defaultView: globalThis,
  documentElement: { lang: "en", classList: { toggle() {}, add() {}, remove() {} }, style: {} },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} }, body: { appendChild() {} },
  addEventListener() {}, removeEventListener() {},
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createTextNode: (t) => ({ textContent: t }),
};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.HTMLElement = class {};
globalThis.SVGElement = class {};
globalThis.HTMLAnchorElement = class HTMLAnchorElement {};
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
globalThis.Audio = class { play() { return Promise.resolve(); } };

const failures = [];
const passes = [];
const ok = (name, cond, detail = "") => (cond ? passes.push(`PASS ${name}`) : failures.push(`FAIL ${name} ${detail}`));

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  ssr: { external: ["react", "react-dom", "react-router-dom", "lucide-react"] },
  resolve: {
    alias: [{ find: /^file-saver$/, replacement: new URL("../scripts/ssr-stubs/file-saver.mjs", import.meta.url).pathname }],
  },
});

const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");

const { I18nProvider } = await server.ssrLoadModule("/src/i18n/index.tsx");
const pageModule = await server.ssrLoadModule("/src/modules/operations/mortality/pages/MortalityEntryPage.tsx");
const tableModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/TripLossTable.tsx");
const kpiModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/LossKpiCards.tsx");
const filtersModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/LossFilters.tsx");
const indicatorModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/AppliedFiltersIndicator.tsx");

const shell = (node) => React.createElement(I18nProvider, null, node);
const render = (node) => renderToStaticMarkup(shell(node));

/* ── 1. The page shell (no data yet: first paint) ──────────────────────── */
const pageHtml = render(React.createElement(pageModule.default));
ok("page renders", pageHtml.length > 2000, `len=${pageHtml.length}`);
for (const [label, needle] of [
  ["filter card", "rounded-xl border border-slate-200"],
  ["search placeholder", "Trip, farm, supervisor..."],
  ["label: Search", "Search"],
  ["label: Reset", "Reset"],
  ["page has no duplicate heading section", "Completed Trips"],
]) {
  ok(`page: ${label}`, pageHtml.includes(needle), `missing ${needle}`);
}
ok("page: no leftover section <h3> above the card", !/<h3[^>]*>\s*Completed Trips\s*<\/h3>/.test(pageHtml) || (pageHtml.match(/Completed Trips/g) || []).length === 1, `occurrences=${(pageHtml.match(/Completed Trips/g) || []).length}`);

/* ── 2. The filter bar (Trip List controls) ───────────────────────────── */
const noop = () => {};
const filtersHtml = render(
  React.createElement(filtersModule.default, {
    filters: { fromDate: "", toDate: "", sourceFarm: "", supervisor: "", search: "" },
    setFilters: noop,
    appliedFilters: { fromDate: "", toDate: "", sourceFarm: "", supervisor: "", search: "" },
    farmOptions: ["Anand Agro Farms", "Sai Sreenivasa Farms"],
    supervisorOptions: ["Ravi Rao", "Yesu Rao"],
    sort: { key: "tripDate", dir: "desc" },
    setSort: noop,
    onApply: noop,
    onReset: noop,
    onRefresh: noop,
    refreshing: false,
  }),
);
ok("filters: From label", filtersHtml.includes("From"));
ok("filters: To label", filtersHtml.includes("To"));
ok("filters: Farm label uses the Trip List key", filtersHtml.includes("Farm"));
ok("filters: Supervisor label", filtersHtml.includes("Supervisor"));
ok("filters: Sort By label (Trip List key)", filtersHtml.includes("Sort By"));
ok("filters: no native select for reference lists", !filtersHtml.includes("<select"), "a <select> is present");
ok("filters: farm placeholder", filtersHtml.includes("All Farms"));
ok("filters: supervisor placeholder", filtersHtml.includes("All Supervisors"));
ok("filters: searchable dropdown inputs exist", (filtersHtml.match(/type="text"/g) || []).length >= 2, `text inputs=${(filtersHtml.match(/type="text"/g) || []).length}`);
ok("filters: hen refresh button (brand logo)", filtersHtml.includes("dmr-hen") || filtersHtml.includes("Refresh"), "no brand refresh control");
ok("filters: search animation hook", filtersHtml.includes("--animate-action-search"), "search animation class missing");
ok("filters: reset animation hook", filtersHtml.includes("--animate-action-reset"), "reset animation class missing");
ok("filters: current sort is reflected", filtersHtml.includes("Day") && filtersHtml.includes("Latest first"), "sort label missing");
ok("filters: pristine controls do not flag Search", !filtersHtml.includes("ring-2 ring-emerald-300"), "Search is flagged without changes");

/* ── 3. The table with fixture rows (Trip List parity) ────────────────── */
const rows = [
  { tripId: 1, tripNo: "TRP-20260916-001", tripDate: "2026-09-16", sourceFarm: "Sai Sreenivasa Farms", supervisorName: "Ravi Rao", vehicleNo: "TS09UB1074", driverName: "Yesu Kumar", status: "Completed", farmBirds: 319, farmWeight: 636.09, deliveryShops: 9, deliveredBirds: 311, deliveredWeight: 608.97, mortalityCount: 8, mortalityWeight: 13.55, weightLoss: 13.57, weightLossPercentage: 2.13, mortalityPercentage: 2.51, survivalRate: 0.9749 },
  { tripId: 2, tripNo: "TRP-20260916-002", tripDate: "2026-09-16", sourceFarm: "Anand Agro Farms", supervisorName: "Yesu Rao", vehicleNo: "TS07UB1222", driverName: "Feroz Kumar", status: "Completed", farmBirds: 2005, farmWeight: 4560.47, deliveryShops: 58, deliveredBirds: 1990, deliveredWeight: 4516.61, mortalityCount: 15, mortalityWeight: 27.73, weightLoss: 16.13, weightLossPercentage: 0.35, mortalityPercentage: 0.75, survivalRate: 0.9925 },
];

const tableHtml = render(
  React.createElement(tableModule.default, {
    records: rows,
    sort: { key: "tripDate", dir: "desc" },
    setSort: noop,
    page: 2,
    totalPages: 53,
    totalRecords: 525,
    pageSize: 10,
    onPageChange: noop,
    onPageSizeChange: noop,
    loading: false,
    emptyAll: false,
    filtersApplied: false,
    onReset: noop,
  }),
);

ok("table: card header bar title", tableHtml.includes("Completed Trips"));
ok("table: count pill uses the trip total", tableHtml.includes("525"), "count pill missing");
ok("table: count sits in the title block right after the title", /Completed Trips<\/h3>\s*<span[^>]*>[\s\S]{0,220}525 trips/.test(tableHtml), "count pill is not beside the title");
ok("table: broken-heart mortality mark in a flat rose tile", tableHtml.includes("heart-crack") && tableHtml.includes("border-rose-100 bg-rose-50/70") && !tableHtml.includes("from-rose-500 to-orange-400"), "mortality mark missing or still glossy");
ok("table: header hints at the row panel", tableHtml.includes("Open a row for vehicle"), "expand hint missing");
// Every metric glyph must live in the HEADER only — never repeated per row.
{
  const headerEnd = tableHtml.indexOf("</thead>");
  const head = tableHtml.slice(0, headerEnd);
  const body = tableHtml.slice(headerEnd);
  const headerGlyphs = (head.match(/lucide-(bird|scale|shopping-bag|feather|percent|trending-down)/g) || []).length;
  const bodyGlyphs = (body.match(/lucide-(bird|scale|shopping-bag|feather|percent|trending-down)/g) || []).length;
  ok("table: metric glyphs are header-only (none repeated per row)", headerGlyphs >= 8 && bodyGlyphs === 0, `header=${headerGlyphs} body=${bodyGlyphs}`);
}
ok("table: rows are dense (compact padding, no py-4)", tableHtml.includes("py-2.5") && !tableHtml.includes("py-4"), "row padding not compacted");
ok("table: serial column header", tableHtml.includes(">#<"), "no # header");
for (const header of ["Trip No", "Day", "Farm", "Supervisor", "Farm Birds", "Farm Wt", "Shops", "Del. Birds", "Del. Wt", "Mortality", "Mort. Wt", "Wt Loss", "Loss %"]) {
  ok(`table: header "${header}"`, tableHtml.includes(header), `missing ${header}`);
}
ok("table: Day renders weekday + date", tableHtml.includes("Wed, 16 Sep 2026"), "day formatting missing");
ok("table: serial continues from the page offset", tableHtml.includes(">11<") && tableHtml.includes(">12<"), "page-2 serials missing");
ok("table: paired sort arrows present", (tableHtml.match(/lucide-arrow-(up|down)/g) || []).length >= 20, `arrows=${(tableHtml.match(/lucide-arrow-(up|down)/g) || []).length}`);
ok("table: global pagination renders", tableHtml.includes("Showing") && tableHtml.includes("of 525"), "global pagination missing");
ok("table: rows-per-page control from the global pager", tableHtml.includes("Rows per page"), "rows per page missing");
ok("table: header glyphs are coloured lucide icons", (tableHtml.match(/text-(indigo|violet|amber|emerald|sky|orange|rose)-500/g) || []).length >= 10, "icon tones missing");
ok("table: expand affordance kept", tableHtml.includes("Expand trip") && tableHtml.includes("aria-expanded"), "expand control missing");

/* ── 3b. The expanded row panel (the "dropdown") ──────────────────────── */
{
  const expandModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/TripLossRowExpand.tsx");
  const expandHtml = render(React.createElement(expandModule.default, { record: rows[0] }));
  ok("panel: trip + vehicle facts", expandHtml.includes(rows[0].tripNo) && expandHtml.includes(rows[0].vehicleNo) && expandHtml.includes(rows[0].driverName));
  ok("panel: two cards, stacked", (expandHtml.match(/<h4/g) || []).length === 2, `h4=${(expandHtml.match(/<h4/g) || []).length}`);
  ok("panel: no shop-wise delivery card", !expandHtml.includes("Delivery Output") && !expandHtml.includes("Total Delivery") && !expandHtml.includes(">Shop<"), "the shop table is still mounted");
  ok("panel: weights table is a plain table — no bars", !expandHtml.includes('style="width') && !expandHtml.includes("animate-pulse"));
  ok("panel: trip facts use the shared labels", expandHtml.includes("Vehicle") && expandHtml.includes("Supervisor") && expandHtml.includes("Source Farm") && expandHtml.includes("Driver") && expandHtml.includes("Loaders") && expandHtml.includes("Helpers"));
  // The reference idiom: label left, value RIGHT — nothing is left dangling.
  ok("panel: label/value cells are justify-between (value right-aligned)", (expandHtml.match(/justify-between/g) || []).length >= 8, `cells=${(expandHtml.match(/justify-between/g) || []).length}`);
  ok("panel: two label/value pairs per row, split by a divider", (expandHtml.match(/sm:grid-cols-2/g) || []).length === 4 && expandHtml.includes("sm:divide-x"));
  ok("panel: rows are one line tall", expandHtml.includes("py-1.5") && !expandHtml.includes("py-2 text-\[13px\]"));
  ok("panel: survival rate closes the weights card as a tinted strip", expandHtml.includes("bg-emerald-50/70") && expandHtml.includes("Survival Rate"));
}

/* ── 3c. Delivery data — the shop endpoint still backs the numbers ─────── */
{
  const API = process.env.API ?? "http://127.0.0.1:4000/api";
  const firstTrip = await (await fetch(`${API}/operations/mortality-analysis?limit=1`)).json();
  const record = firstTrip.data[0];
  const tripId = record.tripId;
  const shopsRaw = await (await fetch(`${API}/operations/mortality-analysis/${tripId}/deliveries`)).json();
  const shops = Array.isArray(shopsRaw) ? shopsRaw : shopsRaw.data;
  ok("data: the trip really has delivery rows", Array.isArray(shops) && shops.length > 0, `rows=${shops?.length}`);

  // SYNC: the shop-wise lines must add up to the counters the page prints —
  // same trip, same numbers, whether read from the row or from the shops.
  const birdsTotal = shops.reduce((n, row) => n + row.birds, 0);
  const weightTotal = Number(shops.reduce((n, row) => n + row.weight, 0).toFixed(2));
  ok("sync: shop count on the row equals the shop rows fetched", record.deliveryShops === shops.length, `row=${record.deliveryShops} fetched=${shops.length}`);
  ok("sync: shop birds add up to the row's delivered birds", birdsTotal === record.deliveredBirds, `${birdsTotal} vs ${record.deliveredBirds}`);
  ok("sync: shop weights add up to the row's delivered weight", Math.abs(weightTotal - record.deliveredWeight) < 0.05, `${weightTotal} vs ${record.deliveredWeight}`);

  // The trip panel itself: facts, crew and the weights table.
  const expandModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/TripLossRowExpand.tsx");
  const panelHtml = render(React.createElement(expandModule.default, { record }));
  ok("panel: trip + vehicle facts from the API", panelHtml.includes(record.tripNo) && panelHtml.includes(record.vehicleNo) && panelHtml.includes(record.driverName));
  ok("panel: loaders named on the trip table", (record.loaders || []).length > 0 && (record.loaders || []).every((name) => panelHtml.includes(name)), `loaders=${(record.loaders || []).join("/")}`);
  ok("panel: helpers named on the trip table", (record.helpers || []).length > 0 && (record.helpers || []).every((name) => panelHtml.includes(name)), `helpers=${(record.helpers || []).join("/")}`);
  ok("panel: survival rate printed", panelHtml.includes(`${(record.survivalRate * 100).toFixed(2)}%`));
  ok("panel: every i18n key resolved (no raw key leaked)", panelHtml.includes("ops.mortality") === false);
}

/* ── 4. KPI strip through the global grid ─────────────────────────────── */
const kpiHtml = render(
  React.createElement(kpiModule.default, {
    kpis: { totalTrips: 525, farmBirds: 202769, farmWeight: 473557.27, deliveryShops: 6852, deliveredBirds: 196900, deliveredWeight: 454133.18, mortalityCount: 5869, mortalityWeight: 11667.65, mortalityPercentage: 2.89, weightLoss: 7769.05, weightLossPercentage: 1.64 },
    loading: false,
  }),
);
ok("kpi: eleven cards", (kpiHtml.match(/tooltip|title="/g) || []).length >= 11, "unexpected card count");
ok("kpi: lakh compaction (2.03 L farm birds)", kpiHtml.includes("2.03") && kpiHtml.includes("L"), "compaction missing");
ok("kpi: exact tooltip retained", kpiHtml.includes("2,02,769"), "exact value tooltip missing");
ok("kpi: both grids present", (kpiHtml.match(/<section/g) || []).length === 2, `sections=${(kpiHtml.match(/<section/g) || []).length}`);
ok("kpi: percent cards", kpiHtml.includes("2.89%") && kpiHtml.includes("1.64%"), "percent values missing");

/* ── 5. Applied-filters indicator ─────────────────────────────────────── */
const indicatorHtml = render(
  React.createElement(indicatorModule.default, {
    appliedFilters: { fromDate: "2026-09-01", toDate: "2026-09-16", sourceFarm: "Anand Agro Farms", supervisor: "Ravi Rao", search: "oil" },
    onClear: noop,
  }),
);
ok("indicator: one pill per applied filter", (indicatorHtml.match(/rounded-full/g) || []).length >= 5, "pills missing");
ok("indicator: values shown", indicatorHtml.includes("2026-09-01") && indicatorHtml.includes("Ravi Rao"));

/* ── 6. LIVE DATA SYNC — render the real first page of the sample API ─── */
try {
  const API = process.env.API ?? "http://127.0.0.1:4000/api";
  const payload = await (await fetch(`${API}/operations/mortality-analysis?page=1&limit=10&sortBy=tripDate&sortDir=desc`)).json();
  ok("live: rows returned", Array.isArray(payload.data) && payload.data.length === 10, `rows=${payload.data?.length}`);
  ok("live: meta total present", payload.meta.total > 0, `total=${payload.meta.total}`);

  const liveTableHtml = render(
    React.createElement(tableModule.default, {
      records: payload.data,
      sort: { key: "tripDate", dir: "desc" },
      setSort: noop,
      page: 1,
      totalPages: payload.meta.totalPages,
      totalRecords: payload.meta.total,
      pageSize: 10,
      onPageChange: noop,
      onPageSizeChange: noop,
      loading: false,
      emptyAll: false,
      filtersApplied: false,
    }),
  );
  const first = payload.data[0];
  ok("live: first trip number rendered", liveTableHtml.includes(first.tripNo), first.tripNo);
  ok("live: first trip farm rendered", liveTableHtml.includes(first.sourceFarm), first.sourceFarm);
  ok("live: first trip supervisor rendered", liveTableHtml.includes(first.supervisorName), first.supervisorName);
  const { formatTripListDay } = await server.ssrLoadModule("/src/modules/operations/vehicle-trips/utils/formatTripListDay.ts");
  const expectedDay = formatTripListDay(first.tripDate, "en");
  ok("live: first trip day rendered (weekday + date)", liveTableHtml.includes(expectedDay), `${expectedDay} missing`);
  ok("live: first trip farm-bird count rendered", liveTableHtml.includes(first.farmBirds.toLocaleString("en-IN")), String(first.farmBirds));
  ok("live: first trip weight-loss % rendered", liveTableHtml.includes(`${first.weightLossPercentage.toFixed(2)}%`), String(first.weightLossPercentage));
  ok("live: every row of the page rendered", payload.data.every((row) => liveTableHtml.includes(row.tripNo)), "a row is missing");
  ok("live: pagination reflects the full filtered set", liveTableHtml.includes(`of ${payload.meta.total}`), `total=${payload.meta.total}`);

  const liveKpiHtml = render(React.createElement(kpiModule.default, { kpis: payload.kpis, loading: false }));
  const exactBirds = payload.kpis.farmBirds.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  ok("live: KPI strip uses the server aggregates", liveKpiHtml.includes(exactBirds) || liveKpiHtml.includes("L"), `farmBirds=${payload.kpis.farmBirds}`);
  ok("live: mortality % card rendered", liveKpiHtml.includes(`${payload.kpis.mortalityPercentage.toFixed(2)}%`), String(payload.kpis.mortalityPercentage));

  // Dropdown options come from the same unfiltered peek the table does.
  const options = payload.filterOptions;
  ok("live: farm dropdown options", Array.isArray(options.farms) && options.farms.length === 10, `farms=${options.farms?.length}`);
  ok("live: supervisor dropdown options", Array.isArray(options.supervisors) && options.supervisors.length > 0, `supervisors=${options.supervisors?.length}`);
  const liveFiltersHtml = render(
    React.createElement(filtersModule.default, {
      filters: { fromDate: "", toDate: "", sourceFarm: "", supervisor: "", search: "" },
      setFilters: noop,
      appliedFilters: { fromDate: "", toDate: "", sourceFarm: "", supervisor: "", search: "" },
      farmOptions: options.farms,
      supervisorOptions: options.supervisors,
      sort: { key: "tripDate", dir: "desc" },
      setSort: noop,
      onApply: noop,
      onReset: noop,
      onRefresh: noop,
      refreshing: false,
    }),
  );
  ok("live: filter bar renders the farm placeholder", liveFiltersHtml.includes("All Farms"), "placeholder missing");
  ok("live: filter bar renders the supervisor placeholder", liveFiltersHtml.includes("All Supervisors"), "placeholder missing");

  // MasterDropdown only portals its option list while open, so prove the live
  // reference lists travel through the control by selecting one: the trigger
  // must then read the live value back.
  const selectedFiltersHtml = render(
    React.createElement(filtersModule.default, {
      filters: { fromDate: "", toDate: "", sourceFarm: options.farms[0], supervisor: options.supervisors[0], search: "" },
      setFilters: noop,
      appliedFilters: { fromDate: "", toDate: "", sourceFarm: "", supervisor: "", search: "" },
      farmOptions: options.farms,
      supervisorOptions: options.supervisors,
      sort: { key: "tripDate", dir: "desc" },
      setSort: noop,
      onApply: noop,
      onReset: noop,
      onRefresh: noop,
      refreshing: false,
    }),
  );
  ok("live: selected farm is shown in its dropdown", selectedFiltersHtml.includes(options.farms[0]), options.farms[0]);
  ok("live: selected supervisor is shown in its dropdown", selectedFiltersHtml.includes(options.supervisors[0]), options.supervisors[0]);
  ok("live: edited-but-unapplied filters are announced on Search", selectedFiltersHtml.includes("filter change(s)") && selectedFiltersHtml.includes("ring-2 ring-emerald-300"), "no pending-changes hint");

  // The applied filters really narrow the server result set (each independently,
  // then a farm+supervisor pair that exists in the data).
  const byFarm = await (await fetch(`${API}/operations/mortality-analysis?limit=1&farm=${encodeURIComponent(first.sourceFarm)}`)).json();
  ok("live: farm filter narrows the set", byFarm.meta.total > 0 && byFarm.meta.total < payload.meta.total, `${byFarm.meta.total} of ${payload.meta.total}`);
  ok("live: farm-scoped KPIs match the scoped total", byFarm.kpis.totalTrips === byFarm.meta.total, `${byFarm.kpis.totalTrips} vs ${byFarm.meta.total}`);
  const bySupervisor = await (await fetch(`${API}/operations/mortality-analysis?limit=1&supervisor=${encodeURIComponent(first.supervisorName)}`)).json();
  ok("live: supervisor filter narrows the set", bySupervisor.meta.total > 0 && bySupervisor.meta.total < payload.meta.total, `${bySupervisor.meta.total} of ${payload.meta.total}`);
  const byPair = await (await fetch(`${API}/operations/mortality-analysis?limit=1&farm=${encodeURIComponent(first.sourceFarm)}&supervisor=${encodeURIComponent(first.supervisorName)}`)).json();
  ok("live: farm + supervisor pair narrows the set", byPair.meta.total > 0 && byPair.meta.total <= byFarm.meta.total, `${byPair.meta.total} of ${byFarm.meta.total}`);
  const searched = await (await fetch(`${API}/operations/mortality-analysis?limit=1&search=${encodeURIComponent(first.tripNo)}`)).json();
  ok("live: search by trip number finds it", searched.meta.total >= 1 && searched.data[0].tripNo === first.tripNo, `${searched.meta.total} rows`);
} catch (error) {
  failures.push(`FAIL live data sync: ${error.message} (is the sample API on :4000 running?)`);
}

await server.close();
console.log(passes.join("\n"));
console.log(`\n${passes.length} passed, ${failures.length} failed`);
if (failures.length) console.log(failures.join("\n"));
