import assert from "node:assert/strict";
import test from "node:test";
import { collectionImportCellText, parseDisplayDate, validateCollectionImportRow } from "./collectionImport";

test("collection import accepts common Excel and Indian date formats", () => {
  assert.equal(parseDisplayDate("12-10-2026"), "2026-10-12");
  assert.equal(parseDisplayDate("19/10/2026"), "2026-10-19");
  assert.equal(parseDisplayDate("19.10.2026"), "2026-10-19");
  assert.equal(parseDisplayDate("19-Oct-26"), "2026-10-19");
  assert.equal(parseDisplayDate("2026-10-19"), "2026-10-19");
  assert.equal(parseDisplayDate("31-02-2026"), null);
});

test("genuine Excel dates use DD-MM-YYYY in date, remark and reference cells", () => {
  assert.equal(collectionImportCellText(new Date("2026-10-26T00:00:00.000Z")), "26-10-2026");
  assert.equal(collectionImportCellText("Weekly collection"), "Weekly collection");
  assert.equal(collectionImportCellText(12345), "12345");
  assert.equal(collectionImportCellText(null), "");
});

test("master validation is case insensitive without creating new values", () => {
  const issues = validateCollectionImportRow({
    id: "1", sourceRow: 2, serialNo: "1", date: "12-10-2026",
    shopName: "alpha shop", collector: "COLLECTOR ONE", mode: "union bank",
    amount: "1,250", remark: "", referenceNo: "ref-1",
  }, { shops: ["Alpha Shop"], collectors: ["Collector One"], modes: ["Cash", "Union Bank"] });
  assert.deepEqual(issues, []);
});

test("inactive shops supplied by the Shop master are valid for import", () => {
  const issues = validateCollectionImportRow({
    id: "2", sourceRow: 3, serialNo: "2", date: "12-10-2026",
    shopName: "Old Balance Shop", collector: "Collector One", mode: "Cash",
    amount: "500", remark: "inactive shop balance", referenceNo: "",
  }, { shops: ["Old Balance Shop"], collectors: ["Collector One"], modes: ["Cash"] });
  assert.deepEqual(issues, []);
});

test("reference numbers are unique case-insensitively against saved collections", () => {
  const issues = validateCollectionImportRow({
    id: "3", sourceRow: 4, serialNo: "3", date: "12-10-2026",
    shopName: "Shop", collector: "Collector", mode: "Cash", amount: "500",
    remark: "", referenceNo: " ref-100 ",
  }, { shops: ["Shop"], collectors: ["Collector"], modes: ["Cash"], existingReferences: ["REF-100"] });
  assert.equal(issues.find((issue) => issue.field === "referenceNo")?.message, "Reference number already exists in Collection Entry.");
});
