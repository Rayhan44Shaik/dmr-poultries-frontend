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
const summaryModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/CumulativeSummary.tsx");
// The KPI strip is gone from this page: the component must not exist at all.
{
  const { existsSync } = await import("node:fs");
  ok("no-KPI: LossKpiCards.tsx is deleted", !existsSync("src/modules/operations/mortality/components/LossKpiCards.tsx"), "component still on disk");
}
const pageSource = (await import("node:fs")).readFileSync("src/modules/operations/mortality/pages/MortalityEntryPage.tsx", "utf8");
ok("no-KPI: the page never references the KPI cards", !pageSource.includes("LossKpiCards"), "KPI import/render still present");
ok("no-KPI: the page has no KPI section", !pageSource.includes("ops.mortality.kpi.filtered_summary"), "KPI section still rendered");
{
  const tableAt = pageSource.indexOf("<TripLossTable");
  const tableSectionEnd = pageSource.indexOf("</section>", tableAt);
  const summaryAt = pageSource.indexOf("<CumulativeSummary");
  ok("cumulative: rendered below the table", tableAt > 0 && summaryAt > tableSectionEnd, `table@${tableAt} sectionEnd@${tableSectionEnd} summary@${summaryAt}`);
  ok("cumulative: only after a Search", pageSource.includes("analysis.summaryVisible &&"), "gate missing");
  ok("cumulative: fed the whole filtered set", pageSource.includes("totalRecords={analysis.totalRecords}"), "whole-set props missing");
}
const filtersModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/LossFilters.tsx");
const indicatorModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/AppliedFiltersIndicator.tsx");

const formatNumberEn = (value) => Number(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const shell = (node) => React.createElement(I18nProvider, null, node);
const render = (node) => renderToStaticMarkup(shell(node));
/// Render once in Telugu: the provider reads the stored language at mount.
const renderTe = (node) => {
  const saved = store.get("dmr-language");
  store.set("dmr-language", "te");
  const html = renderToStaticMarkup(shell(node));
  if (saved === undefined) store.delete("dmr-language");
  else store.set("dmr-language", saved);
  return html;
};
/// Text cells of a rendered block, tags stripped.
const cellsOf = (html) => html.replace(/<[^>]+>/g, "|").split("|").map((part) => part.trim()).filter(Boolean);
/// A Telugu page carries Telugu words and figures — never English words.
const SYMBOLS = new Set(["—", "#", "%", "…", "•", "·"]);
const englishLeft = (html) => cellsOf(html).filter((cell) => !/[\u0C00-\u0C7F]/.test(cell) && !/^[0-9][0-9,.\s%·’'\/\-]*$/.test(cell) && !SYMBOLS.has(cell));

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
ok("table: header shows the keyboard hint", tableHtml.includes("move rows") && tableHtml.includes("Enter opens the trip panel"), "keyboard hint missing");
// Every metric glyph must live in the HEADER only — never repeated per row.
{
  const headerEnd = tableHtml.indexOf("</thead>");
  const head = tableHtml.slice(0, headerEnd);
  const body = tableHtml.slice(headerEnd);
  const headerGlyphs = (head.match(/lucide-(bird|scale|shopping-bag|feather|percent|trending-down)/g) || []).length;
  const bodyGlyphs = (body.match(/lucide-(bird|scale|shopping-bag|feather|percent|trending-down)/g) || []).length;
  ok("table: metric glyphs are header-only (none repeated per row)", headerGlyphs >= 8 && bodyGlyphs === 0, `header=${headerGlyphs} body=${bodyGlyphs}`);
}
ok("table: rows use the Trip List rhythm (px-3 py-3.5, not py-5)", tableHtml.includes("py-3.5") && !tableHtml.includes(" py-5"), `py-3.5=${(tableHtml.match(/py-3\.5/g) || []).length}`);
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
{
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/modules/operations/mortality/components/TripLossTable.tsx", "utf8");
  ok("keys: rows are focusable", (tableHtml.match(/tabindex="0"/g) || []).length === rows.length, `focusable=${(tableHtml.match(/tabindex="0"/g) || []).length}`);
  ok("keys: arrow up/down move between rows", source.includes('event.key !== "ArrowDown" && event.key !== "ArrowUp"') && source.includes("rowRefs.current.get(next.tripId)?.focus()"), "arrow navigation missing");
  ok("keys: Enter/Space opens and Escape closes the panel", source.includes('event.key === "Enter" || event.key === " "') && source.includes('event.key === "Escape"') && source.includes("toggle(row.tripId)"), "open/close keys missing");
  ok("keys: focused row is visible (focus ring)", tableHtml.includes("focus-visible:ring-inset focus-visible:ring-emerald-400"), "no focus ring");
}

ok("table: expand affordance kept", tableHtml.includes("Expand trip") && tableHtml.includes("aria-expanded"), "expand control missing");
// The expanded cell belongs to a table that can be wider than its scroller, so
// the panel must be pinned to the scroller's edge — otherwise its right half
// (and the last table columns) render outside the visible card. The panel only
// exists once a row is expanded, so this one is asserted against the source.
{
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/modules/operations/mortality/components/TripLossTable.tsx", "utf8");
  ok("table: expanded row is pinned to the visible area", source.includes('className="sticky left-0"') && source.includes("width: `${panelWidth}px`"), "panel is not pinned; it will overflow the card");
  ok("table: the scroller is measured for the panel width", source.includes("new ResizeObserver") && source.includes("clientWidth") && tableHtml.includes("overflow-x-auto"), "scroll container is not measured");
}

/* ── 3b. The expanded row panel — ONE card, ONE table, full width ─────── */
{
  const expandModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/TripLossRowExpand.tsx");
  const expandHtml = render(React.createElement(expandModule.default, { record: { ...rows[0], loaders: ["Jagadish Reddy", "Mohan Naidu"], helpers: ["Jagadish Rao", "Yesu Reddy"] } }));

  ok("panel: ONE card", (expandHtml.match(/rounded-xl border border-slate-200 bg-white/g) || []).length === 1, `cards=${(expandHtml.match(/rounded-xl border border-slate-200 bg-white/g) || []).length}`);
  ok("panel: ONE table", (expandHtml.match(/<table/g) || []).length === 1, `tables=${(expandHtml.match(/<table/g) || []).length}`);
  ok("panel: the table fills the card", expandHtml.includes("w-full table-fixed"));
  ok("panel: sections are stacked as full-width bands inside it", (expandHtml.match(/colSpan="4"/g) || []).length === 2, `bands=${(expandHtml.match(/colSpan="4"/g) || []).length}`);
  ok("panel: four equal columns carry every row", (expandHtml.match(/w-1\/4/g) || []).length >= 20, `quarter cells=${(expandHtml.match(/w-1\/4/g) || []).length}`);
  ok("panel: trip + weights + rates titles present", ["Trip Details", "Weights", "Rates"].every((title) => expandHtml.includes(title)));
  ok("panel: card title carries the trip mark", expandHtml.includes("border-indigo-100 bg-indigo-50/70") && expandHtml.includes("border-rose-100 bg-rose-50/70") && expandHtml.includes("border-emerald-100 bg-emerald-50/70"));
  ok("panel: every value starts from the left", (expandHtml.match(/text-left align-middle/g) || []).length >= 12 && !expandHtml.includes("text-right align-middle"), `left=${(expandHtml.match(/text-left align-middle/g) || []).length} right=${(expandHtml.match(/text-right align-middle/g) || []).length}`);
  ok("panel: no cell in the panel is right-aligned at all", !expandHtml.includes("text-right"), "a cell is still right-aligned");
  ok("panel: name │ data hairline inside every pair", (expandHtml.match(/border-l border-slate-200 px-3/g) || []).length >= 10, `rules=${(expandHtml.match(/border-l border-slate-200 px-3/g) || []).length}`);

  const detailRow = expandHtml.slice(expandHtml.indexOf("Trip No"), expandHtml.indexOf("Weights"));
  ok("panel: every trip field is on the card", ["Trip No", "Day", "Vehicle", "Supervisor", "Driver", "Source Farm", "Loaders", "Helpers"].every((label) => detailRow.includes(label)));
  ok("panel: loaders and helpers print their names", expandHtml.includes("Jagadish Reddy, Mohan Naidu") && expandHtml.includes("Jagadish Rao, Yesu Reddy"));

  const weightsRow = expandHtml.slice(expandHtml.indexOf("Weights"), expandHtml.indexOf("Rates"));
  ok("panel: weights section has its own column headings", ["Name", "Birds", "Weight"].every((head) => weightsRow.includes(head)) && weightsRow.includes(">%<"));
  ok("panel: weights rows carry birds, weight and percentage", (weightsRow.match(/100.00%|2.13%/g) || []).length >= 2 && weightsRow.includes("636.09 kg") && weightsRow.includes("13.55 kg"));

  const ratesRow = expandHtml.slice(expandHtml.indexOf("Rates"));
  ok("panel: rates close the table", ratesRow.includes("Survival Rate") && ratesRow.includes("97.49%") && ratesRow.includes("Mortality %") && ratesRow.includes("Loss %"));
  ok("panel: nothing is printed twice inside the panel", expandHtml.includes("Delivery Output") === false && expandHtml.includes("Total Delivery") === false);
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

/* ── 4. Cumulative summary through the global grid ────────────────────── */
const quarterKpis = { totalTrips: 525, farmBirds: 202769, farmWeight: 473557.27, deliveryShops: 6852, deliveredBirds: 196900, deliveredWeight: 454133.18, mortalityCount: 5869, mortalityWeight: 11667.65, mortalityPercentage: 2.89, weightLoss: 7769.05, weightLossPercentage: 1.64 };
const summaryHtml = render(
  React.createElement(summaryModule.default, { kpis: quarterKpis, totalRecords: 525, pageSize: 10 }),
);
ok("cumulative: ONE card", (summaryHtml.match(/rounded-2xl/g) || []).length === 1, `cards=${(summaryHtml.match(/rounded-2xl/g) || []).length}`);
ok("cumulative: ONE table", (summaryHtml.match(/<table/g) || []).length === 1, `tables=${(summaryHtml.match(/<table/g) || []).length}`);
ok("cumulative: full-width fixed table", summaryHtml.includes("w-full table-fixed"), "table class missing");
ok("cumulative: four equal columns", (summaryHtml.match(/w-1\/4/g) || []).length >= 16, `w-1/4=${(summaryHtml.match(/w-1\/4/g) || []).length}`);
ok("cumulative: every cell starts from the left", (summaryHtml.match(/text-left/g) || []).length >= 16 && !summaryHtml.includes("text-right"), "alignment wrong");
ok("cumulative: no KPI cards", !summaryHtml.includes("tooltip") && (summaryHtml.match(/<section/g) || []).length === 1 && !summaryHtml.includes("grid-cols"), "card grid leaked in");
ok("cumulative: says every page, not this page", summaryHtml.includes("not just the 10 rows on screen"), "scope wording missing");
ok("cumulative: scope repeats trips and shops", summaryHtml.includes("525 trips") && summaryHtml.includes("6,852 shops"), "scope chip missing");
ok("cumulative: whole-set totals printed", summaryHtml.includes("4,73,557.27 kg") && summaryHtml.includes("4,54,133.18 kg") && summaryHtml.includes("11,667.65 kg"), "totals missing");
ok("cumulative: weight-loss row has no bird count", summaryHtml.includes("7,769.05 kg") && summaryHtml.includes("—"), "loss row wrong");
ok("cumulative: survival closes the summary", summaryHtml.includes("97.11%"), "survival row missing");
ok("cumulative: weights read like the panel", summaryHtml.includes("100.00%") && summaryHtml.includes("95.90%") && summaryHtml.includes("2.89%") && summaryHtml.includes("1.64%"), "percent row missing");

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

  const expandModule = await server.ssrLoadModule("/src/modules/operations/mortality/components/TripLossRowExpand.tsx");

  // CUMULATIVE, NOT PAGE BY PAGE: the totals describe the whole filtered set, so
  // they are identical on every page while the rows change.
  const { formatWeight } = await server.ssrLoadModule("/src/utils/format.ts");
  const pageOne = await (await fetch(`${API}/operations/mortality-analysis?limit=10&page=1&sortBy=tripDate&sortDir=desc`)).json();
  const pageTwo = await (await fetch(`${API}/operations/mortality-analysis?limit=10&page=2&sortBy=tripDate&sortDir=desc`)).json();
  const whole = await (await fetch(`${API}/operations/mortality-analysis?limit=500&page=1&sortBy=tripDate&sortDir=desc`)).json();
  const allRows = await (await fetch(`${API}/operations/mortality-analysis?limit=1000&page=1&sortBy=tripDate&sortDir=desc`)).json();
  ok("live: paging really changes the rows", pageOne.data[0].tripNo !== pageTwo.data[0].tripNo, "same first row on both pages");
  ok("live: totals identical on page 1 and page 2", pageOne.kpis.farmWeight === pageTwo.kpis.farmWeight && pageOne.kpis.mortalityCount === pageTwo.kpis.mortalityCount, "page-scoped totals");
  ok("live: totals identical however wide the page", pageOne.kpis.farmWeight === whole.kpis.farmWeight && pageOne.kpis.totalTrips === whole.kpis.totalTrips, `10-row=${pageOne.kpis.farmWeight} 500-row=${whole.kpis.farmWeight}`);
  const summed = allRows.data.reduce((total, row) => total + row.farmWeight, 0);
  ok("live: the reported total is the sum over the whole set", Math.abs(summed - allRows.kpis.farmWeight) < 0.5, `sum=${summed.toFixed(2)} reported=${allRows.kpis.farmWeight}`);
  // A 500-row page is short of the 525-trip set, yet the totals still cover the
  // whole set — which is exactly what "cumulative, not page by page" must mean.
  const shortPageSum = whole.data.reduce((total, row) => total + row.farmWeight, 0);
  ok("live: a short page does not shrink the totals", whole.data.length < whole.meta.total && whole.kpis.farmWeight === allRows.kpis.farmWeight, `${whole.data.length} of ${whole.meta.total}`);
  ok("live: totals are not the visible rows' subtotal", Math.abs(shortPageSum - whole.kpis.farmWeight) > 0.5, `visible sum=${shortPageSum.toFixed(2)} total=${whole.kpis.farmWeight}`);
  const pageSubtotal = pageOne.data.reduce((total, row) => total + row.farmWeight, 0);
  const liveSummaryHtml = render(
    React.createElement(summaryModule.default, { kpis: pageOne.kpis, totalRecords: pageOne.meta.total, pageSize: 10 }),
  );
  ok("live: summary prints the whole-set total", liveSummaryHtml.includes(formatWeight(allRows.kpis.farmWeight)), formatWeight(allRows.kpis.farmWeight));
  ok("live: summary is NOT the visible page's subtotal", !liveSummaryHtml.includes(formatWeight(pageSubtotal)), `page subtotal ${formatWeight(pageSubtotal)} leaked`);
  ok("live: summary counts every matching trip", liveSummaryHtml.includes(`${formatNumberEn(pageOne.meta.total)} trips`), `${pageOne.meta.total} trips`);
  ok("live: summary survival closes with the server's figure", liveSummaryHtml.includes(`${(100 - pageOne.kpis.mortalityPercentage).toFixed(2)}%`), String(pageOne.kpis.mortalityPercentage));

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

  // ── TELUGU: the whole page reads in Telugu — every label, hint and data value —
  //    while every figure stays numeric.
  {
    const viewModule = await server.ssrLoadModule("/src/modules/operations/vehicle-trips/utils/tripViewLocalization.ts");
    const row = pageOne.data[0];
    const englishAttributes = (html) =>
      (html.match(/(?:aria-label|placeholder)="[^"]*[A-Za-z][^"]*"/g) || []).filter((attr) => !dividerClass(attr));
    /// Class strings are not user-visible text; only the labels themselves matter.
    const dividerClass = (attr) => attr.includes("aria-label") === false && attr.includes("placeholder") === false;
    const noEnglish = (label, html) => {
      ok(`telugu: ${label} has no English left`, englishLeft(html).length === 0, englishLeft(html).join(" · "));
      const attrs = englishAttributes(html);
      ok(`telugu: ${label} has no English labels`, attrs.length === 0, attrs.join(" · "));
    };
    const teRender = (label, node, assert) => {
      try {
        assert(renderTe(node));
      } catch (error) {
        failures.push(`FAIL telugu: ${label} — ${error.message}`);
      }
    };

    const teTableHtml = renderTe(
      React.createElement(tableModule.default, {
        records: pageOne.data, sort: { key: "tripDate", dir: "desc" }, setSort: noop, page: 1,
        totalPages: pageOne.meta.totalPages, totalRecords: pageOne.meta.total, pageSize: 10,
        onPageChange: noop, onPageSizeChange: noop, loading: false, emptyAll: false, filtersApplied: true,
        weightUnit: "కేజీ",
      }),
    );
    const tePanelHtml = renderTe(
      React.createElement(expandModule.default, { record: row, weightUnit: "కేజీ" }),
    );
    const teSummaryHtml = renderTe(
      React.createElement(summaryModule.default, { kpis: pageOne.kpis, totalRecords: pageOne.meta.total, pageSize: 10, weightUnit: "కేజీ" }),
    );
    noEnglish("the table", teTableHtml);
    noEnglish("the trip panel", tePanelHtml);
    noEnglish("the cumulative summary", teSummaryHtml);
    ok("telugu: section titles translated", tePanelHtml.includes("ట్రిప్ వివరాలు") && tePanelHtml.includes("బరువులు") && tePanelHtml.includes("రేట్లు"), "panel titles still English");
    ok("telugu: column names translated", teSummaryHtml.includes("పేరు") && teTableHtml.includes("ట్రిప్ నం.") && teTableHtml.includes("రోజు") && teTableHtml.includes("ఫారం"), "column names still English");
    ok("telugu: status chip translated", tePanelHtml.includes("పూర్తయింది"), "status chip still English");
    ok("telugu: trip number reads in Telugu", tePanelHtml.includes(viewModule.localizeTripViewText(row.tripNo, "te")) && viewModule.localizeTripViewText(row.tripNo, "te") !== row.tripNo, row.tripNo);
    ok("telugu: farm and crew read in Telugu", tePanelHtml.includes(viewModule.localizeTripViewText(row.sourceFarm, "te")) && tePanelHtml.includes(viewModule.localizeTripViewText(row.supervisorName, "te")), "names not localised");
    ok("telugu: figures stay numeric", tePanelHtml.includes(formatNumberEn(row.farmBirds)) && tePanelHtml.includes(row.farmWeight.toFixed(2)) && teTableHtml.includes(formatNumberEn(row.farmBirds)), "figures changed");
    ok("telugu: weights use the Telugu unit", tePanelHtml.includes("కేజీ") && teSummaryHtml.includes("కేజీ") && !tePanelHtml.includes(" kg"), "unit not localised");
    ok("telugu: cumulative labels translated", teSummaryHtml.includes("మొత్తం సారాంశం") && teSummaryHtml.includes("పేరు") && teSummaryHtml.includes("పక్షులు"), "summary labels still English");

    teRender("the page shell", React.createElement(pageModule.default), (html) => noEnglish("the page shell", html));
    teRender(
      "the filter bar",
      React.createElement(filtersModule.default, {
        filters: { fromDate: "", toDate: "", sourceFarm: "", supervisor: "", search: "" },
        setFilters: noop, appliedFilters: {}, farmOptions: [], supervisorOptions: [],
        sort: { key: "tripDate", dir: "desc" }, setSort: noop,
        onApply: noop, onReset: noop, onRefresh: noop, refreshing: false,
      }),
      (html) => noEnglish("the filter bar", html),
    );
    teRender(
      "the applied-filters indicator",
      React.createElement(indicatorModule.default, {
        appliedFilters: { fromDate: "2026-09-01", toDate: "2026-09-16", sourceFarm: "Anand Agro Farms", supervisor: "Ravi Rao", search: "" },
        onClear: noop,
      }),
      (html) => noEnglish("the applied-filters indicator", html),
    );
  }
} catch (error) {
  failures.push(`FAIL live data sync: ${error.message} (is the sample API on :4000 running?)`);
}

await server.close();
console.log(passes.join("\n"));
console.log(`\n${passes.length} passed, ${failures.length} failed`);
if (failures.length) console.log(failures.join("\n"));
