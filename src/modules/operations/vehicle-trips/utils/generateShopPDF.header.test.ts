import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cleanPdfText,
  resolveShopPdfHeader,
} from "./shopPdfHeader";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  boxNo: 1,
  shopId: 7,
  shopName: "R K CHICKEN",
  birdTypeId: 1,
  birdType: "Broiler",
  birds: 100,
  weight: 200.5,
  mortality: 0,
  rate: 90,
  amount: 18045,
  remarks: "",
  deliveryMode: "box",
  ...overrides,
});

const employees = [
  { id: 11, employeeName: "Ravi Supervisor", phoneNumber: "9876500001" },
  { id: 22, employeeName: "Kiran Driver", phoneNumber: "9876500002" },
  { id: 33, employeeName: "No Phone Sup", phoneNumber: "" },
];

test("CASE 1: mobiles resolve from the same employee records, sub-shop row present", () => {
  const h = resolveShopPdfHeader(row({ subShopName: "Main Road Outlet" }) as never, {
    supervisorName: "Ravi Supervisor",
    driverName: "Kiran Driver",
    employeeRef: { supervisorId: 11, driverId: 22 },
    employees,
  });
  assert.equal(h.supervisorName, "Ravi Supervisor");
  assert.equal(h.supervisorMobile, "9876500001");
  assert.equal(h.driverName, "Kiran Driver");
  assert.equal(h.driverMobile, "9876500002");
  assert.equal(h.subShopRemark, "Main Road Outlet");
});

test("CASE 2/7: no sub-shop and no remarks means the row is omitted", () => {
  const h = resolveShopPdfHeader(row({ subShopName: "", remarks: "" }) as never, {
    employeeRef: { supervisorId: 11, driverId: 22 },
    employees,
    supervisorName: "Ravi Supervisor",
    driverName: "Kiran Driver",
  });
  assert.equal(h.subShopRemark, "");
});

test("CASE 6: remarks backs the Sub Shop/Remark row when subShopName is empty", () => {
  const h = resolveShopPdfHeader(row({ remarks: "Gate 2 outlet" }) as never, { employees });
  assert.equal(h.subShopRemark, "Gate 2 outlet");
});

test("CASE 3/4: missing mobiles stay blank, never undefined/null", () => {
  const h = resolveShopPdfHeader(row() as never, {
    supervisorName: "No Phone Sup",
    driverName: "Ghost Driver",
    employeeRef: { supervisorId: 33, driverId: 999 },
    employees,
  });
  assert.equal(h.supervisorMobile, "");
  assert.equal(h.driverMobile, "");
  assert.ok(!/undefined|null|NaN/.test(JSON.stringify(h)));
});

test("CASE 5: supervisor and driver resolve from their own records", () => {
  const h = resolveShopPdfHeader(row() as never, {
    employeeRef: { supervisorId: 22, driverId: 11 },
    employees,
  });
  assert.equal(h.supervisorName, "Kiran Driver");
  assert.equal(h.supervisorMobile, "9876500002");
  assert.equal(h.driverName, "Ravi Supervisor");
  assert.equal(h.driverMobile, "9876500001");
});

test("name fallback still resolves when ids are absent", () => {
  const h = resolveShopPdfHeader(row() as never, {
    supervisorName: "ravi supervisor",
    driverName: "KIRAN DRIVER",
    employees,
  });
  assert.equal(h.supervisorMobile, "9876500001");
  assert.equal(h.driverMobile, "9876500002");
});

test("dirty values are blanked, never leaked into the PDF", () => {
  assert.equal(cleanPdfText(undefined), "");
  assert.equal(cleanPdfText(null), "");
  assert.equal(cleanPdfText(Number.NaN), "");
  assert.equal(cleanPdfText("undefined"), "");
  assert.equal(cleanPdfText("null"), "");
  assert.equal(cleanPdfText({} as never), "");
  assert.equal(cleanPdfText("  Main Road Outlet  "), "Main Road Outlet");
  const h = resolveShopPdfHeader(
    row({ shopName: undefined, subShopName: "null", remarks: "undefined" }) as never,
    { supervisorName: undefined, employees: [] }
  );
  assert.equal(h.shopName, "");
  assert.equal(h.subShopRemark, "");
  assert.equal(h.supervisorName, "");
});
