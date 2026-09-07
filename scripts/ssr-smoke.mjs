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
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
try { await import("fake-indexeddb/auto"); } catch { /* optional */ }
globalThis.Audio = class { play() { return Promise.resolve(); } };

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true }, // we only evaluate our own src graph
  ssr: { external: ["react", "react-dom", "react-router-dom", "lucide-react"] },
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

// Did the login form actually render?
const hasLoginForm = /Welcome back|Sign in|Username/.test(loginHtml);
console.log(hasLoginForm ? "LOGIN PAGE RENDERED: yes" : "LOGIN PAGE RENDERED: no (form markup missing!)");

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

  const week = buildSampleDutyWeek("2026-09-07");
  const weekDays = week.days.map((d) => d.date);
  const getAssignment = (employeeId, date) => week.assignments.find((a) => a.employeeId === employeeId && a.date === date);
  const html = renderToString(
    React.createElement(DutyPlannerGrid, {
      employees: week.employees,
      weekDays,
      getAssignment,
      onCellClick: () => {},
      loading: false,
    })
  );
  const namesShown = week.employees.filter((e) => html.includes(e.employeeName)).length;
  const ok = namesShown === week.employees.length;
  console.log(`OK   StaffGrid + sample data  names in HTML: ${namesShown}/${week.employees.length}  html length=${html.length}`);
  if (!ok) failed.push({ name: "staff-grid-sample", err: new Error(`${namesShown}/${week.employees.length} employee names rendered`) });

  // Role-aware shift options (Supervisor: Duty/Office/Leave/WeeklyOff;
  // Driver/Helper/Loader: Trip Start/On Trip first, then Duty/Repair/Office/Leave/WeeklyOff).
  const sup = getShiftConfigsForRole("Supervisor").map((s) => s.label).join(",");
  const drv = getShiftConfigsForRole("Driver").map((s) => s.label).join(",");
  const hlp = getShiftConfigsForRole("Helper").map((s) => s.label).join(",");
  const ldr = getShiftConfigsForRole("Loader").map((s) => s.label).join(",");
  console.log(`     picker options  Supervisor: [${sup}]`);
  console.log(`     picker options  Driver:     [${drv}]`);
  console.log(`     picker options  Helper:     [${hlp}]`);
  console.log(`     picker options  Loader:     [${ldr}]`);
  const crewOptions = "Trip Start,On Trip,Duty,Repair,Office,Leave,Weekly Off";
  const supOk = sup === "Duty,Office,Leave,Weekly Off";
  const drvOk = drv === crewOptions;
  const hlpOk = hlp === crewOptions;
  const ldrOk = ldr === crewOptions;
  if (!supOk || !drvOk || !hlpOk || !ldrOk) failed.push({ name: "role-options", err: new Error(`role options wrong: sup=[${sup}] drv=[${drv}] hlp=[${hlp}] ldr=[${ldr}]`) });

  // Two-day trip pairing in the sample: vehicle crews start the trip one
  // day and are On Trip the next (e.g. Suresh Kumar, Driver, Mon→Tue).
  const sureshMon = week.assignments.find((a) => a.employeeId === 2 && a.date === week.days[0].date);
  const sureshTue = week.assignments.find((a) => a.employeeId === 2 && a.date === week.days[1].date);
  const tripOk = sureshMon?.dutyType === "TripStart" && sureshTue?.dutyType === "OnTrip" && html.includes("Trip Start") && html.includes("On Trip");
  console.log(`     trip pair (Driver Mon→Tue): ${sureshMon?.dutyType} → ${sureshTue?.dutyType}  grid labels=${html.includes("Trip Start") && html.includes("On Trip")}`);
  if (!tripOk) failed.push({ name: "trip-pair", err: new Error("sample trip pair missing") });

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
