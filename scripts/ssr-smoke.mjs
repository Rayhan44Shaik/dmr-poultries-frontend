// SSR smoke test: loads the real app module graph through Vite and renders
// it to a string. Catches module-level (top-level) crashes and render-time
// exceptions that would produce a blank page in the browser.
import { createServer } from "vite";
import { renderToString } from "react-dom/server";

// ---- Minimal browser shims (node has none) ----
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
  pathname: "/", search: "", hash: "", origin: "http://localhost:5173",
  href: "http://localhost:5173/", protocol: "http:", host: "localhost:5173",
};
globalThis.history = { state: null, pushState() {}, replaceState() {}, go() {}, back() {}, forward() {} };
globalThis.document = {
  defaultView: globalThis,
  documentElement: { lang: "en", classList: { toggle() {}, add() {}, remove() {} }, style: {} },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} }, body: { appendChild() {} },
  addEventListener() {}, removeEventListener() {},
  getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [],
  createTextNode: (t) => ({ textContent: t }),
};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.HTMLElement = class {};
globalThis.SVGElement = class {};
// file-saver touches HTMLAnchorElement at import time (it feature-detects the
// download attribute) — layouts import it eagerly, so SSR needs the class.
globalThis.HTMLAnchorElement = class HTMLAnchorElement {};
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
try { await import("fake-indexeddb/auto"); } catch { /* optional */ }
globalThis.Audio = class { play() { return Promise.resolve(); } };

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true }, // we only evaluate our own src graph
  ssr: { external: ["react", "react-dom", "react-router-dom", "lucide-react"] },
  // file-saver is minified UMD/CommonJS — Node's ESM interop cannot surface
  // its named `saveAs` export under Vite's SSR transform (the browser never
  // hits this: Vite pre-bundles it). The stub keeps the import graph loadable.
  resolve: {
    alias: [{ find: /^file-saver$/, replacement: new URL("./ssr-stubs/file-saver.mjs", import.meta.url).pathname }],
  },
});
const React = (await import("react")).default;

const failed = [];
let loginHtml = "";

async function renderApp(label) {
  // Load the app module graph fresh for each path (module registry cached).
  const mod = await server.ssrLoadModule("/src/App.tsx");
  const App = mod.default;
  return renderToString(React.createElement(App));
}

// 1) "/" → eager LoginPage
try {
  const t0 = Date.now();
  loginHtml = await renderApp();
  console.log(`OK   App @ /  (${Date.now() - t0} ms)  html length=${loginHtml.length}`);
} catch (err) {
  failed.push({ name: "App @ /", err });
  console.error("FAIL App @ /");
  console.error(err);
}

// Did the login form actually render? `/` now boots into a client-side
// auth/demo gate that renders nothing during SSR (effects never run there),
// so the guard renders the LoginPage chunk directly — same intent: the
// sign-in screen must render its form without crashing.
let hasLoginForm = /Welcome back|Sign in|Username/.test(loginHtml);
try {
  const { MemoryRouter } = await import("react-router-dom");
  const { default: LoginPage } = await server.ssrLoadModule("/src/modules/auth/LoginPage.tsx");
  const { I18nProvider } = await server.ssrLoadModule("/src/i18n/index.tsx");
  const { AuthProvider } = await server.ssrLoadModule("/src/providers/AuthProvider.tsx");
  const loginMarkup = renderToString(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(AuthProvider, null,
        React.createElement(MemoryRouter, null, React.createElement(LoginPage)))
    )
  );
  hasLoginForm = /username|password/i.test(loginMarkup) && loginMarkup.length > 500;
  console.log(`LOGIN PAGE RENDERED: ${hasLoginForm ? "yes" : "no (form markup missing!)"}  (direct render, ${loginMarkup.length} chars)`);
  if (!hasLoginForm) failed.push({ name: "login-page", err: new Error("login form markup missing") });
} catch (err) {
  failed.push({ name: "login-page", err });
  console.error("FAIL login-page");
  console.error(err);
}

// 2) Every deferred route chunk must evaluate without a module-level crash —
//    the same class of bug (a bad import/identifier at module scope) is what
//    previously blanked the whole app. renderToString can't await Suspense, so
//    we assert the chunks load + their default export is a component.
const routeChunks = [
  ["DashboardLayout", "/src/layouts/DashboardLayout/DashboardLayout.tsx"],
  ["DashboardPage", "/src/modules/dashboard/DashboardPage.tsx"],
  ["OperationsPages", "/src/modules/operations/pages/OperationsPages.tsx"],
  ["AccountsPage", "/src/modules/accounts/pages/AccountsPage.tsx"],
  ["MastersPage", "/src/modules/masters/pages/MastersPage.tsx"],
  ["SettingsPage", "/src/modules/settings/pages/SettingsPage.tsx"],
  ["StaffPages", "/src/modules/staff/pages/StaffPages.tsx"],
];
for (const [label, path] of routeChunks) {
  try {
    const t0 = Date.now();
    const mod = await server.ssrLoadModule(path);
    const isComp = typeof mod.default === "function" || (mod.default && typeof mod.default === "object");
    console.log(`OK   chunk ${label}  (${Date.now() - t0} ms)  component: ${isComp}`);
    if (!isComp) failed.push({ name: label, err: new Error("no default component export") });
  } catch (err) {
    failed.push({ name: label, err });
    console.error(`FAIL chunk ${label}`);
    console.error(err);
  }
}

// 3) Staff page: the duty-planner grid must render the sample roster when the
//    backend is down (the hook's fallback path feeds exactly this data).
try {
  const { buildSampleDutyWeek, localUpsertAssignment, localDeleteAssignment, buildSampleSalaryRecords } =
    await server.ssrLoadModule("/src/modules/staff/services/staffSampleData.ts");
  const { default: DutyPlannerGrid } = await server.ssrLoadModule("/src/modules/staff/components/duty-planner/DutyPlannerGrid.tsx");
  const { getShiftConfigsForRole } = await server.ssrLoadModule("/src/modules/staff/services/staffService.ts");
  const { I18nProvider } = await server.ssrLoadModule("/src/i18n/index.tsx");

  const week = buildSampleDutyWeek("2026-09-07");
  const weekDays = week.days.map((d) => d.date);
  // The grid consumes resolved cells (leave beats saved duty — dutyRules), not
  // raw assignments; build the resolver exactly the way the page does.
  const getDutyCell = (employeeId, date) => {
    const assignment = week.assignments.find((a) => a.employeeId === employeeId && a.date === date);
    if (!assignment) return undefined;
    return {
      date,
      dutyType: assignment.dutyType ?? null,
      assignedDutyType: assignment.dutyType ?? null,
      isLeave: false,
      vehicleNo: assignment.vehicleNo ?? "",
    };
  };
  const html = renderToString(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(DutyPlannerGrid, {
        employees: week.employees,
        weekDays,
        getDutyCell,
        onCellClick: () => {},
        loading: false,
      })
    )
  );
  const namesShown = week.employees.filter((e) => html.includes(e.employeeName)).length;
  const ok = namesShown === week.employees.length;
  console.log(`OK   StaffGrid + sample data  names in HTML: ${namesShown}/${week.employees.length}  html length=${html.length}`);
  if (!ok) failed.push({ name: "staff-grid-sample", err: new Error(`${namesShown}/${week.employees.length} employee names rendered`) });

  // Role-aware shift options (Supervisor: Duty/Office/Leave/WeeklyOff;
  // Driver/Helper/Loader: Duty/Repair/Office/Leave/WeeklyOff).
  const sup = getShiftConfigsForRole("Supervisor").map((s) => s.label).join(",");
  const drv = getShiftConfigsForRole("Driver").map((s) => s.label).join(",");
  const hlp = getShiftConfigsForRole("Helper").map((s) => s.label).join(",");
  const ldr = getShiftConfigsForRole("Loader").map((s) => s.label).join(",");
  console.log(`     picker options  Supervisor: [${sup}]`);
  console.log(`     picker options  Driver:     [${drv}]`);
  console.log(`     picker options  Helper:     [${hlp}]`);
  console.log(`     picker options  Loader:     [${ldr}]`);
  const otherRole = getShiftConfigsForRole("Accountant").map((s) => s.label).join(",");
  const crewOptions = "Duty,Repair,Office,Leave,Weekly Off,Off";
  const supOk = sup === "Duty,Office,Leave,Weekly Off,Off";
  const drvOk = drv === crewOptions;
  const hlpOk = hlp === crewOptions;
  const ldrOk = ldr === crewOptions;
  const otherOk = otherRole === "Weekly Off";
  if (!supOk || !drvOk || !hlpOk || !ldrOk || !otherOk)
    failed.push({ name: "role-options", err: new Error(`role options wrong: sup=[${sup}] drv=[${drv}] hlp=[${hlp}] ldr=[${ldr}] other=[${otherRole}]`) });

  // Colour swap: core crew roles → Weekly Off = purple, Off = rose.
  // All other roles → Weekly Off stays rose.
  const supCfg = getShiftConfigsForRole("Supervisor");
  const coreWo = supCfg.find((s) => s.type === "WeeklyOff");
  const coreOff = supCfg.find((s) => s.type === "Off");
  const otherWo = getShiftConfigsForRole("Accountant").find((s) => s.type === "WeeklyOff");
  const swapOk =
    Boolean(coreWo && coreOff && otherWo) &&
    coreWo.bgColor === "bg-purple-100" &&
    coreOff.bgColor === "bg-rose-100" &&
    otherWo.bgColor === "bg-rose-100";
  console.log(`     colour swap  core WeeklyOff=[${coreWo?.bgColor}] core Off=[${coreOff?.bgColor}] other WeeklyOff=[${otherWo?.bgColor}]`);
  if (!swapOk) failed.push({ name: "colour-swap", err: new Error("weekly off / off colour swap wrong") });

  // No trip-specific states: the grid must never show Trip Start / On Trip.
  const noTripStates = !html.includes("Trip Start") && !html.includes("On Trip");
  console.log(`     no trip states in grid: ${noTripStates}`);
  if (!noTripStates) failed.push({ name: "no-trip-states", err: new Error("grid shows trip states") });

  // Sample leaves: only APPROVED leaves are used (the pending one is not).
  const { buildSampleLeaves, buildSampleMonthDuties, SAMPLE_EMPLOYEE_LIST } =
    await server.ssrLoadModule("/src/modules/staff/services/staffSampleData.ts");
  const sampleLeaves = buildSampleLeaves(week.days[0].date);
  const approvedLeaves = sampleLeaves.filter((l) => l.status === "Approved");
  const leavesOk =
    approvedLeaves.length >= 3 &&
    approvedLeaves.every((l) => Boolean(l.employeeName)) &&
    sampleLeaves.some((l) => l.status === "Pending" && l.employeeId === 7);
  console.log(`     sample leaves: ${sampleLeaves.length} total, ${approvedLeaves.length} approved (each with employee)`);
  if (!leavesOk) failed.push({ name: "sample-leaves", err: new Error("sample leaves wrong") });

  // Monthly duties (future-analysis view): every day × every employee.
  const nowD = new Date();
  const month = buildSampleMonthDuties(nowD.getFullYear(), nowD.getMonth());
  const expectedDays = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
  const karthikCells = month.byEmployee[1] || [];
  const raviCells = month.byEmployee[3] || [];
  const raviOff = raviCells.filter((c) => c.dutyType === "Off").length;
  const monthOk =
    month.days.length === expectedDays &&
    Object.keys(month.byEmployee).length === 14 &&
    karthikCells.length === expectedDays &&
    karthikCells.every((c) => c.dutyType !== null);
  const karthikWork = karthikCells.filter((c) => c.dutyType && c.dutyType !== "Rest" && c.dutyType !== "WeeklyOff" && c.dutyType !== "Off").length;
  const karthikLeave = karthikCells.filter((c) => c.dutyType === "Rest").length;
  console.log(`     month duties: ${month.days.length} days × ${Object.keys(month.byEmployee).length} employees  (Karthik: ${karthikWork}d duty, ${karthikLeave}d leave; Ravi: ${raviOff}d off)`);
  if (!monthOk || raviOff < 1) failed.push({ name: "month-duties", err: new Error(`month duties matrix wrong (raviOff=${raviOff})`) });

  // Excel report: generate a real workbook from the month data (the export
  // button's module — mirrors the table: employee rows, date columns, counts).
  const { buildDutyWorkbook } = await server.ssrLoadModule(
    "/src/modules/staff/services/dutyReportExcel.ts"
  );
  const { todayStr } = await server.ssrLoadModule("/src/modules/staff/services/dutyReport.ts");
  const workbook = buildDutyWorkbook({
    data: {
      ...month,
      fromDate: month.days[0].date,
      toDate: month.days[month.days.length - 1].date,
    },
    employees: SAMPLE_EMPLOYEE_LIST,
  });
  const excelBytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const today = todayStr();
  const futureDays = month.days.filter((d) => d.date > today).length;
  const excelOk =
    Boolean(excelBytes && excelBytes.length > 4000 && excelBytes.subarray(0, 2).toString("latin1") === "PK");
  console.log(`     excel report: ${excelOk ? "valid XLSX" : "FAILED"} ${excelBytes?.length ?? 0} bytes  (${futureDays} future day(s) shown blank, not counted)`);
  if (!excelOk) failed.push({ name: "excel-report", err: new Error("excel generation failed") });

  // Grid shows friendly labels ("Duty"/"Leave") and NOT the raw types
  // ("Delivery"/"Rest"); custom "Other" types render as typed.
  const labelsOk = /Duty/.test(html) && !/Delivery/.test(html);
  const leaveOk = /Leave/.test(html) && !/>Rest</.test(html);
  const customOk = html.includes("Farm Visit");
  console.log(`     grid labels: Duty(no raw Delivery)=${labelsOk}  Leave(no raw Rest)=${leaveOk}  custom "Farm Visit"=${customOk}`);
  if (!labelsOk || !leaveOk || !customOk) failed.push({ name: "grid-labels", err: new Error(`grid labels wrong: ${labelsOk}/${leaveOk}/${customOk}`) });

  // Local sample-mode edits (upsert / delete / Saturday recompute).
  const satDate = week.days[5].date;
  const afterUpsert = localUpsertAssignment(week, 4, satDate, "Repair");
  const satStill = afterUpsert.assignments.find((a) => a.employeeId === 4 && a.date === satDate);
  const afterDelete = localDeleteAssignment(afterUpsert, afterUpsert.assignments.find((a) => a.employeeId === 5 && a.date === week.days[2].date).id);
  const removed = !afterDelete.assignments.some((a) => a.employeeId === 5 && a.date === week.days[2].date);
  console.log(`     local edits: upsert→${satStill?.dutyType}  saturday.assigned=${afterUpsert.saturday.assigned}  delete=${removed}`);
  if (satStill?.dutyType !== "Repair" || !removed) failed.push({ name: "local-edits", err: new Error("local sample edits failed") });

  // Salary sample: attendance derived from the duty assignments.
  const sal = buildSampleSalaryRecords("2026-09");
  const karthik = sal.find((r) => r.employeeId === 1);
  const attOk = karthik && karthik.workingDays === 7 && karthik.presentDays + karthik.leaveDays + karthik.weeklyOffDays === 7;
  console.log(`     salary sample: ${sal.length} records  Karthik att={w:${karthik?.workingDays},p:${karthik?.presentDays},l:${karthik?.leaveDays},wo:${karthik?.weeklyOffDays}}  statuses=${[...new Set(sal.map((r) => r.status))].join("/")}`);
  if (!attOk) failed.push({ name: "salary-sample", err: new Error("sample salary attendance mismatch") });
} catch (err) {
  failed.push({ name: "staff-grid-sample", err });
  console.error("FAIL staff-grid-sample");
  console.error(err);
}

// 4) Account Analysis: the farm payment view must render the real trip rows —
//    one per trip in the span, each with its own farm, pickup weight and rate —
//    with the running cumulative and the grand total, and no paid/balance.
try {
  const { loadAnalysisSnapshot, createAnalysisService } = await server.ssrLoadModule("/src/modules/accounts/services/analysisService.ts");
  const { SummaryFarmTable, SummaryFarmAmount } = await server.ssrLoadModule("/src/modules/accounts/components/Summary/SummaryFarmViewer.tsx");
  const { weekRange, quarterRange } = await server.ssrLoadModule("/src/modules/accounts/utils/periodRanges.ts");
  const { I18nProvider } = await server.ssrLoadModule("/src/i18n/index.tsx");
  const snapshot = await loadAnalysisSnapshot();
  if (!snapshot.farmPayments.length) {
    console.log("SKIP accounts-farm-table  (no farm payments from the API — sample backend not reachable)");
  } else {
    const service = createAnalysisService(snapshot);
    const range = weekRange(new Date("2026-09-17T12:00:00"));
    const trips = service.getCompletedTripsByDateRange(range.start, range.end);
    // Built exactly the way SummaryPage builds it for the view.
    const rows = trips
      .map((trip) => ({ trip, farm: service.getFarmPaymentForTrip(trip.id) }))
      .filter((row) => row.farm)
      .sort((a, b) => String(b.trip.tripDate).localeCompare(String(a.trip.tripDate)) || b.trip.id - a.trip.id);
    const payable = rows.reduce((sum, row) => sum + row.farm.amount, 0);
    const { formatINR, formatINRExact } = await server.ssrLoadModule("/src/modules/accounts/components/farm-payment/farmPaymentFormat.ts");
    const withProvider = (node) => renderToString(React.createElement(I18nProvider, null, node));
    // The Farm Payment figure in the expense table is itself the trigger, and it
    // carries the label of the column whose trips it will open.
    const weightKg = rows.reduce((sum, row) => sum + (row.farm.dcWeight ?? row.trip.dcWeight ?? 0), 0);
    const amountHtml = withProvider(React.createElement(SummaryFarmAmount, { value: payable, scopeLabel: "Week 15 - 21 Sep", trips: rows.length, weightKg, onOpen: () => {} }));
    const html = withProvider(React.createElement(SummaryFarmTable, { rows, spanLabel: "2026-09-14 - 2026-09-20", onOpenTrip: () => {} }));
    const shown = rows.filter(({ trip }) => html.includes(trip.tripNo)).length;
    const weight = rows[0].farm.dcWeight ?? rows[0].trip.dcWeight ?? 0;
    const checks = {
      tripsRendered: shown === rows.length,
      pickupWeight: html.includes(String(weight)),
      farmRate: html.includes(String(rows[0].farm.rate)),
      // The running cumulative column is gone; the grand total still shows.
      noCumulativeColumn: !/<th[^>]*>[^<]*Cumulative/.test(html),
      grandTotal: html.includes(formatINR(payable)) && html.includes(formatINRExact(payable)),
      headers: /Trip No/.test(html) && /Pickup Weight/.test(html) && /Bird Type/.test(html),
      noPaidOrBalance: !/Paid \(₹\)/.test(html) && !/Balance \(₹\)/.test(html),
      // Global pagination renders its "Showing 1–3 of 3" summary.
      pagination: html.includes("Showing") && html.includes(`of ${rows.length}`),
      tripLinkIsButton: /<button[^>]*>\s*<!-- -->TRP-|<button[^>]*>TRP-/.test(html),
      tripLinkOpensFarmDetail: /title="View farm &amp; pickup details"/.test(html),
      amountIsButton: /^<button[^>]*type="button"/.test(amountHtml) && (amountHtml.match(/<button/g) ?? []).length === 1,
      // The figure is the button's own text (the tooltip follows it as a sibling).
      amountShowsFigure: amountHtml.includes(`>${formatINR(payable)}<`),
      amountExactTip: amountHtml.includes(formatINRExact(payable)),
      // The global tooltip: role, scope, exact rupees, the trips/weight line and
      // the click hint — all present, and only one tooltip in the cell.
      tooltipRole: (amountHtml.match(/role="tooltip"/g) ?? []).length === 1,
      tooltipLines: amountHtml.includes("Week 15 - 21 Sep")
        && amountHtml.includes(`${rows.length} trips`)
        && /kg pickup/.test(amountHtml)
        && /Click to open these trips/.test(amountHtml),
      tooltipShowsOnFocus: /group-focus-visible:opacity-100/.test(amountHtml) && /group-hover:opacity-100/.test(amountHtml),
      amountNamesScope: amountHtml.includes("Week 15 - 21 Sep"),
      // No chip, pill or card of its own — the figure reads like any other cell.
      amountNoChip: !/rounded-full|bg-white|shadow-sm|border-lime/.test(amountHtml),
    };
    // 500+ trips must paginate cleanly: page 1 shows exactly one page of rows,
    // the summary names the whole set, and the pager shows a windowed last page.
    const q = quarterRange(new Date("2026-09-17T12:00:00"));
    const allRows = service
      .getCompletedTripsByDateRange(q.start, q.end)
      .map((trip) => ({ trip, farm: service.getFarmPaymentForTrip(trip.id) }))
      .filter((row) => row.farm)
      .sort((a, b) => String(b.trip.tripDate).localeCompare(String(a.trip.tripDate)) || b.trip.id - a.trip.id);
    const bigHtml = withProvider(React.createElement(SummaryFarmTable, { rows: allRows, spanLabel: "Quarter", onOpenTrip: () => {} }));
    const shownBig = allRows.filter(({ trip }) => bigHtml.includes(trip.tripNo)).length;
    checks.bigSetPaginates =
      allRows.length > 100 && shownBig === 20 && bigHtml.includes(`of ${allRows.length}`) && bigHtml.includes("\u2026");
    checks.bigSetGrandTotal = bigHtml.includes(formatINR(allRows.reduce((sum, r) => sum + r.farm.amount, 0)));

    // The shell (header) is not exported, so render the whole viewer with the
    // portal disabled (no document) to prove the header carries the animated
    // close button, the logo animation and the highlighted period chip.
    let viewerHtml = "";
    const savedDocument = globalThis.document;
    try {
      delete globalThis.document;
      const { default: SummaryFarmViewer } = await server.ssrLoadModule("/src/modules/accounts/components/Summary/SummaryFarmViewer.tsx");
      viewerHtml = renderToString(React.createElement(I18nProvider, null, React.createElement(SummaryFarmViewer, { open: true, rows, spanLabel: "Week 1 (14 – 20 Sep)", onClose: () => {}, onOpenTrip: () => {} })));
    } finally {
      globalThis.document = savedDocument;
    }
    checks.viewerCloseButton = /aria-label="Close"/.test(viewerHtml) && viewerHtml.includes("--animate-action-close");
    checks.viewerLogoAnim = viewerHtml.includes("animate-farm-logo") && viewerHtml.includes("animate-farm-halo");
    checks.viewerPeriodChip = viewerHtml.includes("Week 1 (14 – 20 Sep)");

    // The trip picked in that view opens the Farm Payment page's own detail
    // (Step 2 Farm Details + Step 3 Pickup Details) — render it for a real
    // analysis trip to prove the wiring has something to show.
    let farmDetail = "not-rendered";
    try {
      const { FarmPaymentTripViewModal } = await server.ssrLoadModule("/src/modules/accounts/components/farm-payment/FarmPaymentTripViewModal.tsx");
      const detailHtml = withProvider(React.createElement(FarmPaymentTripViewModal, { open: true, trip: rows[0].trip, onClose: () => {} }));
      farmDetail = `${detailHtml.length} chars · trip=${detailHtml.includes(rows[0].trip.tripNo)}`;
      checks.farmDetailRenders = detailHtml.length > 500;
    } catch (detailErr) {
      farmDetail = `FAILED: ${String(detailErr).slice(0, 90)}`;
      checks.farmDetailRenders = false;
    }
    console.log(`     farm trip detail  ${farmDetail}`);
    console.log(`OK   accounts-farm-table  rows ${shown}/${rows.length}  cumulative=${formatINR(payable)}  html length=${html.length}  ${JSON.stringify(checks)}`);
    const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    if (bad.length) failed.push({ name: "accounts-farm-table", err: new Error(`failed: ${bad.join(", ")}`) });
  }
} catch (err) {
  failed.push({ name: "accounts-farm-table", err });
  console.error("FAIL accounts-farm-table");
  console.error(err);
}

await server.close();
process.exit(failed.length > 0 || !hasLoginForm ? 1 : 0);
