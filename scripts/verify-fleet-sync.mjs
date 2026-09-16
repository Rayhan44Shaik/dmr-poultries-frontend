// Read-only Fleet contract audit. Start npm run dev first.
// Loads the real frontend mappers; does not add or mutate sample records.
import { createServer } from "vite";

const API = process.env.API ?? "http://127.0.0.1:4000/api";
const manifestResponse = await fetch(`${API}/quarter-summary`);
if (!manifestResponse.ok) throw new Error('Start npm run dev before this audit.');
const manifest = await manifestResponse.json();
if (!manifest.sample) throw new Error('This audit requires the quarter sample API.');
const { fromDate, toDate, today } = manifest.quarter;
const rangeQuery = `fromDate=${fromDate}&toDate=${toDate}`;
const soon = new Date(`${today}T00:00:00Z`);
soon.setUTCDate(soon.getUTCDate() + 30);
const soonDate = soon.toISOString().slice(0, 10);
const failures = [];
const notes = [];
const ok = (name, cond, detail = "") => {
  if (cond) notes.push(`PASS ${name}`);
  else failures.push(`FAIL ${name} ${detail}`);
};

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  ssr: { external: ["react", "react-dom", "react-router-dom", "lucide-react"] },
  resolve: {
    alias: [{ find: /^file-saver$/, replacement: new URL("./ssr-stubs/file-saver.mjs", import.meta.url).pathname }],
  },
});

const mod = (p) => server.ssrLoadModule(p);
const { mapMaintenanceToEvent, maintenanceApi } = await mod("/src/modules/fleet-operations/services/maintenanceApi.ts");
const { mapEmiListResponse, mapEmiScheduleResponse } = await mod("/src/modules/fleet-operations/services/emiMappers.ts");
const analyticsTypes = await mod("/src/modules/fleet-operations/types/analytics.ts");
void analyticsTypes;

const get = async (path) => {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

/* ── 1. Maintenance list contract (entry + history queries) ─────────────── */
const queryCases = [
  ["default", "/fleet/maintenance"],
  ["approved", "/fleet/maintenance?status=Approved&limit=500"],
  ["latestApproved", "/fleet/maintenance?status=Approved&latestApproved=true&limit=500"],
  ["includeDeleted", "/fleet/maintenance?includeDeleted=true&limit=500"],
  ["history-all", "/fleet/maintenance?includeDeleted=true&page=1&limit=500"],
  ["history-pending", "/fleet/maintenance?status=Pending&includeDeleted=true&page=1&limit=500"],
  ["history-search", "/fleet/maintenance?search=oil&includeDeleted=true&page=1&limit=500"],
  ["history-range", `/fleet/maintenance?${rangeQuery}&page=1&limit=500`],
];
let allEvents = [];
for (const [name, path] of queryCases) {
  try {
    const payload = await get(path);
    const rows = Array.isArray(payload) ? payload : payload?.data;
    ok(`maintenance ${name}: array payload`, Array.isArray(rows), JSON.stringify(Object.keys(payload ?? {})).slice(0, 120));
    const events = (rows ?? []).map(mapMaintenanceToEvent);
    if (name === "default") allEvents = events;
    ok(`maintenance ${name}: rows>0`, events.length > 0, `n=${events.length}`);
    const broken = events.filter((e) => !e.id || !e.vehicleId || !e.date || !e.maintenanceType || !e.serviceType);
    ok(`maintenance ${name}: mapped fields`, broken.length === 0, `broken=${broken.length}`);
  } catch (e) {
    failures.push(`FAIL maintenance ${name}: ${e.message}`);
  }
}
// deleted rows must be visible only through includeDeleted
try {
  const visible = await get("/fleet/maintenance");
  const all = await get("/fleet/maintenance?includeDeleted=true&limit=500");
  ok("maintenance: deleted hidden by default", visible.every((r) => !r.deleted), "");
  const deleted = all.filter((r) => r.deleted || r.deletedAt);
  ok("maintenance: deleted rows exist for the Deleted tab", deleted.length > 0, `deleted=${deleted.length}`);
  const mappedDeleted = deleted.map(mapMaintenanceToEvent).filter((r) => r.deletedAt);
  ok("maintenance: deletedAt survives mapping", mappedDeleted.length === deleted.length, `${mappedDeleted.length}/${deleted.length}`);
  const latest = await get("/fleet/maintenance?status=Approved&latestApproved=true&limit=500");
  ok("maintenance: latestApproved one row per vehicle", new Set(latest.map((r) => r.vehicleId)).size === latest.length);
  const first = all[0];
  ok("maintenance: detail endpoint", (await get(`/fleet/maintenance/${first.id}`)).id === first.id);
  const docs = all.find((r) => (r.documents ?? []).length > 0);
  ok("maintenance: some record carries documents", Boolean(docs), "");
  if (docs) {
    // Every third record carries a bill image (SVG) plus a one-page PDF; assert
    // each stream matches its declared mime type instead of assuming a PDF.
    for (const doc of docs.documents) {
      const binary = await fetch(`${API}/fleet/maintenance/${docs.id}/documents/${doc.id}`);
      const text = await binary.text();
      const matchesType =
        doc.mimeType === "application/pdf" ? text.startsWith("%PDF") : text.includes("<svg");
      ok(`maintenance: document ${doc.mimeType} streams`, binary.ok && matchesType, `type=${doc.mimeType} len=${text.length}`);
    }
  }
} catch (e) {
  failures.push(`FAIL maintenance extras: ${e.message}`);
}

/* ── 2. Meter summary + meter history ledger ────────────────────────────── */
try {
  const summary = await get("/fleet/vehicles/meter-summary");
  ok("meter-summary: rows", Array.isArray(summary) && summary.length > 0, `n=${summary.length}`);
  ok("meter-summary: {vehicleId,meter}", summary.every((r) => Number.isFinite(Number(r.vehicleId)) && Number.isFinite(Number(r.meter))));
} catch (e) {
  failures.push(`FAIL meter-summary: ${e.message}`);
}

try {
  const history = await get("/fleet/vehicles/1/meter-history");
  ok("meter-history: rows", Array.isArray(history) && history.length > 0, `n=${history.length}`);
  // Contract consumed by MaintenanceTimeline.tsx / MaintenanceHistoryPage.tsx
  const required = ["vehicleId", "sourceType", "recordId", "ref", "meter", "eventDate", "eventInstant"];
  const missing = new Set();
  for (const row of history) for (const key of required) if (row[key] === undefined) missing.add(key);
  ok("meter-history: VehicleMeterEvent fields", missing.size === 0, `missing=${[...missing].join(",")}`);
  const sources = new Set(history.map((r) => r.sourceType));
  ok(
    "meter-history: sourceType enum",
    [...sources].every((s) => ["TRIP_START", "TRIP_END", "FUEL", "MAINTENANCE"].includes(s)),
    `sources=${[...sources].join(",")}`
  );
  ok("meter-history: TRIP_END present (timeline trip cards)", history.some((r) => r.sourceType === "TRIP_END"), `sources=${[...sources].join(",")}`);
} catch (e) {
  failures.push(`FAIL meter-history: ${e.message}`);
}

/* ── 3. Permits / documents ─────────────────────────────────────────────── */
try {
  const permits = await get("/fleet/permits");
  ok("permits: rows", permits.length === manifest.permits, `n=${permits.length}`);
  const required = ["id", "vehicleId", "vehicleNo", "docType", "documentNumber", "validFrom", "expiryDate", "hasDocument"];
  const broken = permits.filter((r) => required.some((k) => r[k] === undefined));
  ok("permits: PermitDocument fields", broken.length === 0, `broken=${broken.length}`);
  const types = new Set(permits.map((r) => r.docType));
  ok("permits: all five doc types", ["insurance", "fitness", "permit", "puc", "rc"].every((t) => types.has(t)), [...types].join(","));
  const summary = await get("/fleet/permits/summary");
  ok("permits summary: byType", Object.keys(summary.byType ?? {}).length === 5 && summary.total === manifest.permits, JSON.stringify(summary.total));
  const withScan = permits.find((r) => r.hasDocument);
  const scan = await fetch(`${API}/fleet/permits/${withScan.vehicleId}/${withScan.docType}/document`);
  const body = await scan.text();
  ok("permits: scan is a PDF", scan.ok && body.startsWith("%PDF"));
  // expiry spread must cover expired / expiring / safe for the summary tiles
  ok("permits: expired bucket", permits.some((r) => r.expiryDate < today));
  ok("permits: expiring bucket", permits.some((r) => r.expiryDate >= today && r.expiryDate <= soonDate));
  ok("permits: safe bucket", permits.some((r) => r.expiryDate > soonDate));
} catch (e) {
  failures.push(`FAIL permits: ${e.message}`);
}

/* ── 4. EMI ─────────────────────────────────────────────────────────────── */
try {
  const raw = await get("/fleet/emis");
  const rows = mapEmiListResponse(raw);
  ok("emis: mappers accept every row", rows.length === raw.length, `${rows.length}/${raw.length}`);
  ok("emis: rows>0", rows.length > 0, `n=${rows.length}`);
  const statuses = new Set(rows.map((r) => r.status));
  ok("emis: statuses valid", [...statuses].every((s) => ["active", "paid", "overdue"].includes(s)), [...statuses].join(","));
  const filtered = mapEmiListResponse(await get(`/fleet/emis?vehicleId=${rows[0].vehicleId}`));
  ok("emis: vehicleId filter narrows", filtered.length > 0 && filtered.every((r) => r.vehicleId === rows[0].vehicleId), `n=${filtered.length}/${rows.length}`);
  const schedule = mapEmiScheduleResponse(await get(`/fleet/emis/${rows[0].id}/schedule`));
  ok("emis: schedule maps", schedule.length > 0, `n=${schedule.length}`);
  ok("emis: schedule has dueDate/amount/status", schedule.every((s) => s.dueDate && Number.isFinite(s.amount) && ["pending", "paid"].includes(s.status)));
  ok("emis: nextEMIDate present on every row", rows.every((r) => r.nextEMIDate), "");
  // emiService derives emiDay from nextEMIDate.slice(8,10)
  ok("emis: nextEMIDate is YYYY-MM-DD", rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.nextEMIDate ?? "")), [...new Set(rows.map((r) => r.nextEMIDate))].slice(0, 3).join(","));
} catch (e) {
  failures.push(`FAIL emis: ${e.message}`);
}

/* ── 5. Analytics ───────────────────────────────────────────────────────── */
try {
  const payload = await get(`/fleet/analytics?${rangeQuery}`);
  const kpiKeys = ["totalTrips", "totalDistance", "averageMileage", "totalFuelLitres", "fuelCost", "maintenanceCost", "emiDue", "tollCost", "otherCost", "totalExpense", "costPerKm"];
  ok("analytics: kpis complete", kpiKeys.every((k) => Number.isFinite(payload.kpis?.[k])), Object.keys(payload.kpis ?? {}).join(","));
  ok("analytics: weeklyMileage fields", payload.weeklyMileage.every((w) => w.week && w.weekLabel && Number.isFinite(w.litres) && Number.isFinite(w.distance) && Number.isFinite(w.mileage)));
  ok("analytics: costCenters 5 named", payload.costCenters.length === 5 && payload.costCenters.every((c) => ["Fuel", "Maintenance", "EMI", "Toll", "Other"].includes(c.name)));
  const statKeys = ["vehicleId", "vehicleNumber", "trips", "distance", "fuelLitres", "fuelCost", "maintenanceCost", "emiCost", "tollCost", "otherCost", "totalExpense", "mileage"];
  ok("analytics: vehicleStats complete", payload.vehicleStats.length === manifest.vehicles && payload.vehicleStats.every((v) => statKeys.every((k) => v[k] !== undefined)), `n=${payload.vehicleStats.length}`);
  ok("analytics: topPerformers", payload.topPerformers.length > 0 && payload.topPerformers.every((v) => v.vehicleNumber && Number.isFinite(v.mileage)));
  ok("analytics: highestExpense", payload.highestExpense.length > 0 && payload.highestExpense.every((v) => v.vehicleNumber && Number.isFinite(v.totalExpense)));
  const month = await get(`/fleet/analytics?${rangeQuery}`);
  ok("analytics: quarter range has EMI due", month.kpis.emiDue > 0, `emiDue=${month.kpis.emiDue}`);
} catch (e) {
  failures.push(`FAIL analytics: ${e.message}`);
}

/* ── 6. Fuel register used by the Maintenance KM guard ──────────────────── */
try {
  const fuel = await get("/operations/fuel-expenses?vehicleNo=TS08UB1037&page=1&limit=50");
  ok("fuel (km guard): envelope", Array.isArray(fuel.data) && fuel.data.length > 0, `n=${fuel.data?.length}`);
  ok("fuel (km guard): meterReading source field", fuel.data.every((r) => Number.isFinite(Number(r.currentMeter))), "");
  ok("fuel (km guard): statuses", fuel.data.every((r) => ["Approved", "Pending", "Rejected"].includes(r.status)), [...new Set(fuel.data.map((r) => r.status))].join(","));
} catch (e) {
  failures.push(`FAIL fuel guard: ${e.message}`);
}

await server.close();
console.log(notes.join("\n"));
console.log(`\n${failures.length} FAILURES`);
console.log(failures.join("\n"));

if (failures.length) process.exitCode = 1;
