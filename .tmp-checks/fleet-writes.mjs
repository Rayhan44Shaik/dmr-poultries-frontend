// TEMP audit harness #2 (deleted after use): drives the Fleet maintenance write
// flows the entry page performs and validates the responses with the REAL
// frontend mapper.
import { createServer } from "vite";

const API = process.env.API ?? "http://127.0.0.1:4000/api";
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
    alias: [{ find: /^file-saver$/, replacement: new URL("../scripts/ssr-stubs/file-saver.mjs", import.meta.url).pathname }],
  },
});
const { mapMaintenanceToEvent } = await server.ssrLoadModule(
  "/src/modules/fleet-operations/services/maintenanceApi.ts"
);

const get = async (p) => (await fetch(`${API}${p}`)).json();
const json = async (p, method, body) =>
  (await fetch(`${API}${p}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json();

/* create exactly like the entry form does (multipart, JSON-encoded array) */
const fd = new FormData();
fd.append("date", "2026-09-16");
fd.append("vehicleId", "5");
fd.append("driverId", "17");
fd.append("currentKM", "52000");
fd.append("nextServiceByType", JSON.stringify({ "General Service": 57000 }));
fd.append("nextServiceKM", "57000");
fd.append("maintenanceType", JSON.stringify(["General Service", "AC Service"]));
fd.append("serviceType", "Preventive");
fd.append("garage", "Sri Balaji Garage");
fd.append("mechanic", "Bhaskar Goud");
fd.append("parts", JSON.stringify([{ name: "General Service", specification: "OEM", quantity: 1, rate: 2500, amount: 2500 }]));
fd.append("remarks", "Round-trip check");
fd.append("document", new Blob(["sample"], { type: "application/pdf" }), "bill-check.pdf");

const created = await (await fetch(`${API}/fleet/maintenance`, { method: "POST", body: fd })).json();
ok("create: maintenanceType stored as string", typeof created.maintenanceType === "string", `type=${Array.isArray(created.maintenanceType) ? "array" : typeof created.maintenanceType}`);
ok("create: value preserved", created.maintenanceType === "General Service, AC Service", String(created.maintenanceType));
const createdEvent = mapMaintenanceToEvent(created);
ok("create: mapper accepts the response", createdEvent.maintenanceType === "General Service, AC Service" && !createdEvent.deletedAt);
ok("create: starts pending", createdEvent.paymentStatus === "pending");
ok("create: bill number format", /^MNT-\d{8}-\d{4}$/.test(created.billNo ?? ""), String(created.billNo));
ok("create: mapper exposes the bill number", createdEvent.billNumber === created.billNo, createdEvent.billNumber);

/* the record must land in the Pending list the entry table renders */
const pendingList = await get("/fleet/maintenance?limit=500");
const found = pendingList.find((r) => Number(r.id) === Number(created.id));
ok("create: visible in the pending list", Boolean(found));
ok("create: type readable by the table's .split()", typeof found.maintenanceType === "string" && found.maintenanceType.split(",").map((s) => s.trim()).includes("AC Service"));

/* edit: PUT with a new file and a removed document */
const fd2 = new FormData();
fd2.append("date", "2026-09-16");
fd2.append("vehicleId", "5");
fd2.append("currentKM", "52500");
fd2.append("maintenanceType", JSON.stringify(["General Service"]));
fd2.append("serviceType", "Corrective");
fd2.append("parts", JSON.stringify([{ name: "General Service", specification: "OEM", quantity: 1, rate: 3000, amount: 3000 }]));
const updated = await (await fetch(`${API}/fleet/maintenance/${created.id}`, { method: "PUT", body: fd2 })).json();
ok("update: type narrowed to one string", updated.maintenanceType === "General Service", String(updated.maintenanceType));
ok("update: odometer updated", mapMaintenanceToEvent(updated).currentKM === 52500);

/* approve → latest-approved list */
const approved = await json(`/fleet/maintenance/${created.id}/approve`, "POST", { approvedBy: "verify" });
ok("approve: status flips", approved.paymentStatus === "approved");
const latest = await get("/fleet/maintenance?status=Approved&latestApproved=true&limit=500");
ok("approve: vehicle appears once in latestApproved", latest.filter((r) => r.vehicleId === 5).length === 1);

/* delete → soft delete visible only through includeDeleted */
await json(`/fleet/maintenance/${created.id}`, "DELETE");
const afterDelete = await get("/fleet/maintenance?limit=500");
ok("delete: hidden from the default list", !afterDelete.some((r) => Number(r.id) === Number(created.id)));
const all = await get("/fleet/maintenance?includeDeleted=true&limit=500");
const deletedRow = all.find((r) => Number(r.id) === Number(created.id));
ok("delete: audited in includeDeleted", Boolean(deletedRow?.deletedAt));
ok("delete: mapper exposes deletedAt", Boolean(mapMaintenanceToEvent(deletedRow).deletedAt));

/* permit renewal round trip (documents tab) */
const permit = (await get("/fleet/permits")).find((r) => r.hasDocument);
const renewed = await json(`/fleet/permits/${permit.vehicleId}/${permit.docType}`, "PUT", {
  documentNumber: "VERIFY-2001",
  expiryDate: "2031-03-04",
  validFrom: "2026-03-05",
  remarks: "Renewed in the verification run",
});
ok("permit: renewal persists", renewed.documentNumber === "VERIFY-2001" && renewed.expiryDate === "2031-03-04");
ok("permit: scan untouched by a JSON renewal", renewed.hasDocument === true && renewed.fileName === permit.fileName);

await server.close();
console.log(notes.join("\n"));
console.log(`\n${failures.length} FAILURES`);
console.log(failures.join("\n"));
