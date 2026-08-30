import assert from "node:assert/strict";

const baseUrl = (process.env.E2E_BASE_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
const testDate = "2099-12-31";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const collectionTripNo = `ORD-${testDate.replaceAll("-", "")}-E2E-${suffix}`;
const tripOneNo = `E2E-ORD-1-${suffix}`;
const tripTwoNo = `E2E-ORD-2-${suffix}`;

if (process.env.NODE_ENV === "production") {
  throw new Error("Orders E2E tests refuse to run with NODE_ENV=production");
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function expectStatus(path: string, init: RequestInit, status: number) {
  const result = await request(path, init);
  assert.equal(
    result.response.status,
    status,
    `${init.method ?? "GET"} ${path}: expected ${status}, got ${result.response.status}: ${JSON.stringify(result.body)}`
  );
  return result.body;
}

function post(path: string, body: unknown) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function deleteTrip(id: number) {
  return request(`/trips/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ reason: "Orders backend E2E cleanup" }),
  });
}

async function main() {
  const [employeesResult, vehiclesResult, farmsResult, shopsResult] = await Promise.all([
    request("/masters/employees"),
    request("/masters/vehicles"),
    request("/masters/farms"),
    request("/masters/shops"),
  ]);

  assert.equal(employeesResult.response.status, 200);
  assert.equal(vehiclesResult.response.status, 200);
  assert.equal(farmsResult.response.status, 200);
  assert.equal(shopsResult.response.status, 200);

  const employees = employeesResult.body as Array<Record<string, unknown>>;
  const vehicles = employeesResult.body as unknown;
  void vehicles;
  const vehicleList = vehiclesResult.body as Array<Record<string, unknown>>;
  const farmList = farmsResult.body as Array<Record<string, unknown>>;
  const shopList = shopsResult.body as Array<Record<string, unknown>>;

  const employee = employees.find((e) => e.status === "Active") ?? employees[0];
  const vehicle = vehicleList.find((v) => v.status === "Active") ?? vehicleList[0];
  const farm = farmList.find((f) => f.status === "Active") ?? farmList[0];
  const shop = shopList.find((s) => s.status === "Active") ?? shopList[0];

  assert(employee?.id, "E2E requires at least one employee");
  assert(vehicle?.id, "E2E requires at least one vehicle");
  assert(farm?.id, "E2E requires at least one farm");
  assert(shop?.id, "E2E requires at least one shop");

  const employeeName = String(employee.employeeName);
  const vehicleNumber = String(vehicle.vehicleNumber);
  const farmName = String(farm.farmName);
  const shopId = Number(shop.id);
  const shopName = String(shop.shopName);

  const createdTrips: number[] = [];

  try {
    // 1) Create and submit the Orders collection container.
    const collection = await expectStatus(
      "/trips/0/steps/deliveries",
      {
        method: "POST",
        body: JSON.stringify({
          mode: "save",
          tripDate: testDate,
          tripNo: collectionTripNo,
          startStepSubmitted: true,
          deliveries: [
            {
              serialNo: 1,
              shopId,
              shopName,
              birds: 100,
              weight: 44,
              boxNo: 4,
              remarks: "",
              deliveryMode: "box",
            },
          ],
        }),
      },
      200
    );
    const collectionTrip = collection as Record<string, unknown>;
    const collectionId = Number(collectionTrip.id);
    createdTrips.push(collectionId);
    assert.equal(collectionTrip.tripNo, collectionTripNo);
    assert.equal(collectionTrip.startStepSubmitted, true);

    // 2) A vehicle trip with Step 2 NOT submitted must reject assignment.
    const startOne = await expectStatus(
      "/trips/steps/start",
      {
        method: "POST",
        body: JSON.stringify({
          tripNo: tripOneNo,
          tripDate: testDate,
          vehicleId: Number(vehicle.id),
          vehicleNo: vehicleNumber,
          driverId: Number(employee.id),
          driverName: employeeName,
          supervisorId: Number(employee.id),
          supervisorName: employeeName,
          helpers: [employeeName],
          loaders: [employeeName],
          openingMeter: 100,
          advanceAmount: 0,
        }),
      },
      201
    );
    const tripOne = startOne as Record<string, unknown>;
    const tripOneId = Number(tripOne.id);
    createdTrips.push(tripOneId);

    const orderRow = {
      serialNo: 1,
      shopId,
      shopName,
      birds: 100,
      weight: 44,
      boxNo: 4,
      remarks: `[ORDER] O:${collectionTripNo}`,
      deliveryMode: "box",
    };

    const blockedBeforeStep2 = await post(`/trips/${tripOneId}/steps/deliveries`, {
      mode: "save",
      deliveries: [orderRow],
    });
    assert.equal(blockedBeforeStep2.response.status, 500 === blockedBeforeStep2.response.status ? 500 : 500);
    assert.match(String((blockedBeforeStep2.body as Record<string, unknown>)?.error ?? ""), /Step 2/i);

    // 3) Submit Step 2; the same assignment must now succeed.
    await expectStatus(
      `/trips/${tripOneId}/steps/farm`,
      {
        method: "POST",
        body: JSON.stringify({
          mode: "submit",
          sourceFarmId: Number(farm.id),
          sourceFarm: farmName,
          openingMeter: 100,
          destMeter: 120,
          avgBirdWeight: 0.44,
        }),
      },
      200
    );

    const assigned = await expectStatus(
      `/trips/${tripOneId}/steps/deliveries`,
      {
        method: "POST",
        body: JSON.stringify({
          mode: "save",
          deliveries: [orderRow],
        }),
      },
      200
    );
    const assignedTrip = assigned as Record<string, unknown>;
    assert.equal(Array.isArray(assignedTrip.deliveries), true);
    assert.equal((assignedTrip.deliveries as Array<Record<string, unknown>>).length, 1);

    // 4) A second vehicle trip on the same day cannot take the same shop.
    const startTwo = await expectStatus(
      "/trips/steps/start",
      {
        method: "POST",
        body: JSON.stringify({
          tripNo: tripTwoNo,
          tripDate: testDate,
          vehicleId: Number(vehicle.id),
          vehicleNo: vehicleNumber,
          driverId: Number(employee.id),
          driverName: employeeName,
          supervisorId: Number(employee.id),
          supervisorName: employeeName,
          helpers: [employeeName],
          loaders: [employeeName],
          openingMeter: 130,
          advanceAmount: 0,
        }),
      },
      201
    );
    const tripTwo = startTwo as Record<string, unknown>;
    const tripTwoId = Number(tripTwo.id);
    createdTrips.push(tripTwoId);

    await expectStatus(
      `/trips/${tripTwoId}/steps/farm`,
      {
        method: "POST",
        body: JSON.stringify({
          mode: "submit",
          sourceFarmId: Number(farm.id),
          sourceFarm: farmName,
          openingMeter: 130,
          destMeter: 150,
          avgBirdWeight: 0.44,
        }),
      },
      200
    );

    const duplicate = await post(`/trips/${tripTwoId}/steps/deliveries`, {
      mode: "save",
      deliveries: [orderRow],
    });
    assert.equal(duplicate.response.status, 500 === duplicate.response.status ? 500 : 500);
    assert.match(String((duplicate.body as Record<string, unknown>)?.error ?? ""), /already assigned/i);

    // 5) The existing trip endpoint remains the source of truth and returns
    // the persisted collection + assignment data together.
    const listed = (await expectStatus(`/trips?fromDate=${testDate}&toDate=${testDate}`, {}, 200)) as Array<Record<string, unknown>>;
    assert(listed.some((t) => t.tripNo === collectionTripNo));
    assert(listed.some((t) => t.tripNo === tripOneNo));

    console.log("Orders backend E2E: PASS");
    console.log("  collection -> submitted -> Step 2 gate -> assignment -> duplicate-shop guard -> readback");
  } finally {
    for (const id of createdTrips.reverse()) {
      await deleteTrip(id).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error("Orders backend E2E: FAIL");
  console.error(error);
  process.exitCode = 1;
});
