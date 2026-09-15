import assert from "node:assert/strict";
import test from "node:test";
import { compactKpiValue } from "./KpiCardGrid";

test("KPI values switch to Lakhs only at 1,00,000 and retain their exact tooltip value", () => {
  assert.deepEqual(compactKpiValue(99_999, 2), {
    compact: "99,999.00",
    suffix: "",
    exact: "99,999.00",
  });
  assert.deepEqual(compactKpiValue(100_000, 2), {
    compact: "1.00",
    suffix: "L",
    exact: "1,00,000.00",
  });
  assert.deepEqual(compactKpiValue(218_000, 2), {
    compact: "2.18",
    suffix: "L",
    exact: "2,18,000.00",
  });
});

test("KPI values use Crores from 1,00,00,000 upward", () => {
  assert.deepEqual(compactKpiValue(21_900_000, 2), {
    compact: "2.19",
    suffix: "Cr",
    exact: "2,19,00,000.00",
  });
});
