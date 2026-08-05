/**
 * Step 1 lifecycle E2E test against local backend API.
 * Run: node scripts/step1-e2e-test.mjs
 */

const BASE = process.env.API_BASE || "http://localhost:4000/api";
const tripDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return data;
}

async function run() {
  console.log("\n=== Step 1 E2E API Test ===\n");

  // Clean slate: list existing drafts for date
  const beforeDrafts = await req("GET", `/trips?status=Draft&fromDate=${tripDate}&toDate=${tripDate}`);
  console.log(`Existing drafts for ${tripDate}: ${beforeDrafts.length}`);

  // 1. Create draft
  console.log("\n1. Create Draft");
  const draft1 = await req("POST", "/trips", { tripDate });
  assert(draft1.id > 0, `Draft created with id=${draft1.id}`);
  assert(draft1.tripNo, `Trip number assigned: ${draft1.tripNo}`);
  assert(draft1.status === "Draft", `Status is Draft`);
  const tripId = draft1.id;
  const tripNo = draft1.tripNo;

  // 2. Duplicate draft prevention
  console.log("\n2. Duplicate Draft Prevention");
  const draft2 = await req("POST", "/trips", { tripDate });
  assert(draft2.id === tripId, `Second POST returns same id=${tripId} (not ${draft2.id})`);
  assert(draft2.tripNo === tripNo, `Same trip number reused`);

  const draftsAfter = await req("GET", `/trips?status=Draft&fromDate=${tripDate}&toDate=${tripDate}`);
  const openDrafts = draftsAfter.filter((t) => !t.startStepSubmitted);
  assert(
    openDrafts.filter((t) => t.id === tripId).length === 1,
    `Exactly one open draft with id=${tripId}`
  );

  // 3. Autosave fields
  console.log("\n3. Autosave (PUT partial)");
  const saved = await req("PUT", `/trips/${tripId}`, {
    vehicleId: 1,
    vehicleNo: "AP39AB1234",
    driverId: 1,
    driverName: "Ravi Kumar",
    supervisorId: 2,
    supervisorName: "Suresh Reddy",
    openingMeter: 33333,
    advanceAmount: 5000,
    helpers: ["Anil"],
    loaders: ["Babu"],
    remarks: "Test remarks",
  });
  assert(saved.openingMeter === 33333, `Opening KM saved: ${saved.openingMeter}`);
  assert(saved.advanceAmount === 5000, `Advance saved: ${saved.advanceAmount}`);
  assert(saved.helpers?.includes("Anil"), `Helpers saved`);
  assert(saved.loaders?.includes("Babu"), `Loaders saved`);

  // 4. Clear opening KM (BUG 1 fix)
  console.log("\n4. Clear Opening KM");
  const clearedKm = await req("PUT", `/trips/${tripId}`, { openingMeter: 0 });
  assert(clearedKm.openingMeter === 0, `Opening KM cleared to 0 (got ${clearedKm.openingMeter})`);

  const reloaded = await req("GET", `/trips/${tripId}`);
  assert(reloaded.openingMeter === 0, `GET confirms opening KM is 0`);

  // 5. Set opening KM again then clear advance
  await req("PUT", `/trips/${tripId}`, { openingMeter: 35000 });
  const clearedAdvance = await req("PUT", `/trips/${tripId}`, { advanceAmount: 0 });
  assert(clearedAdvance.advanceAmount === 0, `Advance cleared to 0`);

  // 6. Partial helpers update must not wipe loaders (BUG A fix)
  console.log("\n6. Partial crew update");
  await req("PUT", `/trips/${tripId}`, { openingMeter: 35000, advanceAmount: 1000, helpers: ["Anil"], loaders: ["Babu"] });
  const helpersOnly = await req("PUT", `/trips/${tripId}`, { helpers: ["Anil"] });
  assert(helpersOnly.loaders?.includes("Babu"), `Loaders preserved after helpers-only PUT`);
  assert(helpersOnly.helpers?.includes("Anil"), `Helpers still present`);

  // 7. Submit Step 1
  console.log("\n7. Submit Step 1");
  const submitted = await req("POST", `/trips/${tripId}/steps/start`, {
    tripDate,
    vehicleId: 1,
    vehicleNo: "AP39AB1234",
    driverId: 1,
    driverName: "Ravi Kumar",
    supervisorId: 2,
    supervisorName: "Suresh Reddy",
    openingMeter: 35000,
    advanceAmount: 1000,
    helpers: ["Anil"],
    loaders: ["Babu"],
    remarks: "Test remarks",
    startStepSubmitted: true,
    startTime: new Date().toISOString(),
    status: "Draft",
  });
  assert(submitted.startStepSubmitted === true, `Step 1 submitted`);
  assert(submitted.startTime, `Start time captured: ${submitted.startTime}`);
  assert(submitted.id === tripId, `Same trip id after submit`);
  assert(submitted.tripNo === tripNo, `Same trip number after submit`);

  // 8. Resume draft should not return submitted trip
  console.log("\n8. Resume after submit");
  const draftsOpen = await req("GET", `/trips?status=Draft&fromDate=${tripDate}&toDate=${tripDate}`);
  const resumable = draftsOpen.filter((t) => !t.startStepSubmitted);
  assert(!resumable.some((t) => t.id === tripId), `Submitted trip not in resumable drafts`);

  // 9. GET confirms all values
  console.log("\n9. Final GET verification");
  const final = await req("GET", `/trips/${tripId}`);
  assert(final.openingMeter === 35000, `Final opening KM: ${final.openingMeter}`);
  assert(final.advanceAmount === 1000, `Final advance: ${final.advanceAmount}`);
  assert(final.driverName === "Ravi Kumar", `Final driver`);
  assert(final.startStepSubmitted === true, `Final startStepSubmitted`);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
