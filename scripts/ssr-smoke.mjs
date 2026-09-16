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

await server.close();
process.exit(failed.length > 0 || !hasLoginForm ? 1 : 0);
