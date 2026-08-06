/**
 * Final Step 1 API contract test.
 * Browser draft behavior is intentionally localStorage-only; this verifies
 * the sole permanent-write endpoint and disabled draft endpoints.
 */
const base = process.env.API_BASE || "http://localhost:4000/api";
const tripDate = new Date().toISOString().slice(0, 10);

async function request(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const payload = {
  tripDate,
  vehicleId: 1,
  vehicleNo: "AP39AB1234",
  driverId: 1,
  driverName: "Ravi Kumar",
  supervisorId: 2,
  supervisorName: "Suresh Reddy",
  helpers: ["Anil"],
  loaders: ["Babu"],
  openingMeter: 90000,
  advanceAmount: 500,
  remarks: "Single final Step 1 write",
};

const createDraft = await request("POST", "/trips", {});
assert(createDraft.status === 404, "POST /trips draft creation is disabled");

const updateDraft = await request("PUT", "/trips/1", { openingMeter: 1 });
assert(updateDraft.status === 404, "PUT /trips/:id draft update is disabled");

const missingLoader = await request("POST", "/trips/steps/start", {
  ...payload,
  loaders: [],
});
assert(missingLoader.status === 400, "final submit validates Loader");

const submitted = await request("POST", "/trips/steps/start", payload);
assert(submitted.status === 201, "final submit returns 201");
assert(submitted.body.id > 0, "final submit returns permanent Trip ID");
assert(submitted.body.tripNo, "final submit returns Trip Number");
assert(submitted.body.startStepSubmitted === true, "Step 1 is permanently submitted");
assert(submitted.body.openingMeter === payload.openingMeter, "Opening KM persisted");
assert(submitted.body.advanceAmount === payload.advanceAmount, "Advance persisted");
assert(
  submitted.body.helpers.includes("Anil") && submitted.body.loaders.includes("Babu"),
  "crew persisted"
);

const loaded = await request("GET", `/trips/${submitted.body.id}`);
assert(loaded.status === 200, "submitted trip can be reopened");
assert(loaded.body.id === submitted.body.id, "reopened trip has same ID");

console.log("\nStep 1 final-submit API contract: PASS");
