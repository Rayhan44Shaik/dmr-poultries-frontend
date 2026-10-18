/**
 * C5 pickup import parser / validation pack (client-side).
 * Harmless generated fixtures only — no production data.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  continuePickupBoxNumbers,
  parsePickupImport,
  parsePickupRows,
  validatePickupAppend,
  validatePickupImport,
} from "./pickupImport";

function excelFile(name: string, rows: unknown[][]): File {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Pickup");
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

test("C5: valid Excel pickup import yields accurate boxes, birds, weights, totals", async () => {
  const file = excelFile("pickup-valid.xlsx", [
    ["Vehicle No", "TS09AB1234", "Driver", "Test Driver"],
    ["Box", "Birds", "Weight"],
    [1, 40, 80.5],
    [2, 35, 70.25],
    [3, 25, 49.25],
  ]);
  const result = await parsePickupImport(file);
  assert.equal(result.boxes.length, 3);
  assert.equal(result.boxes[0].boxNo, 1);
  assert.equal(result.boxes[0].birds, 40);
  assert.equal(result.boxes[0].weight, 80.5);
  assert.equal(result.metadata.vehicleNo, "TS09AB1234");
  const totalBirds = result.boxes.reduce((s, b) => s + b.birds, 0);
  const totalWeight = result.boxes.reduce((s, b) => s + b.weight, 0);
  assert.equal(totalBirds, 100);
  assert.ok(Math.abs(totalWeight - 200) < 0.011);
});

test("C5: preview validation surfaces row-specific errors before commit", () => {
  const errors = validatePickupImport(
    [
      { boxNo: 0, birds: 10, weight: 20, avgWeight: 2 },
      { boxNo: 1, birds: -1, weight: 20, avgWeight: null },
      { boxNo: 2, birds: 10, weight: 0, avgWeight: null },
      { boxNo: 2, birds: 10, weight: 20, avgWeight: 2 },
    ],
    40,
  );
  assert.ok(errors.some((e) => /Box number must be a positive/i.test(e)));
  assert.ok(errors.some((e) => /Birds must be a positive/i.test(e)));
  assert.ok(errors.some((e) => /Weight must be greater than zero/i.test(e)));
  assert.ok(errors.some((e) => /appears more than once/i.test(e)));
});

test("C5: duplicate box detection in parsePickupRows", () => {
  assert.throws(
    () =>
      parsePickupRows([
        ["Box", "Birds", "Weight"],
        [1, 10, 20],
        [1, 11, 21],
      ]),
    /appears more than once/i,
  );
});

test("C5: empty / missing header / unsupported extension rejected", async () => {
  assert.throws(() => parsePickupRows([]), /Could not find Box/i);
  assert.throws(
    () =>
      parsePickupRows([
        ["Alpha", "Beta", "Gamma"],
        [1, 2, 3],
      ]),
    /Could not find Box/i,
  );
  await assert.rejects(
    () => parsePickupImport(new File([new Uint8Array([1, 2, 3])], "pickup.txt", { type: "text/plain" })),
    /Excel|\.xlsx|\.xls|PDF/i,
  );
});

test("C5: formula-like and injection-looking cells do not become executable — numeric parse only", () => {
  // Non-numeric formula/injection strings become NaN and are dropped (not executed).
  assert.throws(
    () =>
      parsePickupRows([
        ["Box", "Birds", "Weight"],
        [1, "=1+2", 20],
        [2, 10, "'=CMD|'/C calc'!A0"],
      ]),
    /No valid box rows/i,
  );
  // Mixed: a valid numeric row survives; formula row is ignored.
  const mixed = parsePickupRows([
    ["Box", "Birds", "Weight"],
    [1, "=SUM(A1)", 20],
    [3, 12, 24.5],
  ]);
  assert.equal(mixed.boxes.length, 1);
  assert.equal(mixed.boxes[0].boxNo, 3);
  assert.equal(mixed.boxes[0].birds, 12);
});

test("C5: sequence overlap continues numbering; capacity append guard", () => {
  const existing = [
    { boxNo: 1, birds: 10, weight: 20, avgWeight: 2 },
    { boxNo: 2, birds: 10, weight: 20, avgWeight: 2 },
  ];
  const incoming = continuePickupBoxNumbers(
    [
      { boxNo: 1, birds: 8, weight: 16, avgWeight: 2 },
      { boxNo: 2, birds: 9, weight: 18, avgWeight: 2 },
    ],
    existing.length,
  );
  assert.deepEqual(
    incoming.map((b) => b.boxNo),
    [3, 4],
  );
  assert.deepEqual(validatePickupAppend(existing, incoming, 4), []);
  assert.match(
    validatePickupAppend(existing, incoming, 3)[0] ?? "",
    /Only 1 vehicle box slot/i,
  );
});

test("C5: excessive box count vs vehicle capacity", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    boxNo: i + 1,
    birds: 10,
    weight: 20,
    avgWeight: 2,
  }));
  const errors = validatePickupImport(rows, 3);
  assert.ok(errors.some((e) => /can load only 3/i.test(e)));
});
