// tests/exports/lazyExportLibraries.test.ts
//
// Regression coverage for Task 3A (deferred Excel/PDF libraries).
//
//   1. No page-level module may statically import xlsx / jspdf /
//      jspdf-autotable: those libraries are only reachable through an action.
//   2. Every affected module must still load its library on demand.
//   3. Real workbook output is unchanged (sheet names, titles, headers, rows,
//      KPI block, template columns).
//   4. Export filenames are unchanged.
//   5. A failing export rejects as a normal, catchable error (which is what
//      each page's toast/error path relies on).
//   6. Repeated and concurrent exports stay independent.
//
// Real PDF layout is covered by tests/payslip/payslip-pdf.smoke.mjs, which
// renders the actual document and reads it back with pdfjs.
import "./assetStub.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import * as nodeFs from "node:fs";

// SheetJS resolves `writeFile` through an injected fs in ESM. In the browser the
// library downloads the file instead; here it must land on disk to be read back.
(XLSX as unknown as { set_fs: (fs: unknown) => void }).set_fs(nodeFs);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

/** `import type …` is erased at build time and is allowed. */
function hasStaticValueImport(source: string, library: string): boolean {
  const pattern = new RegExp(
    `^\\s*import\\s+(?!type\\b)[^;]*from\\s+["']${library.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']`,
    "m",
  );
  return pattern.test(source);
}

function hasDynamicImport(source: string, library: string): boolean {
  const pattern = new RegExp(
    `import\\(\\s*["']${library.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']\\s*\\)`,
  );
  return pattern.test(source);
}

const LIBRARIES = ["xlsx", "jspdf", "jspdf-autotable"];

/** Every module that previously pulled an export library statically. */
const AFFECTED_MODULES: Array<{ file: string; dynamic: string[] }> = [
  { file: "src/modules/accounts/components/Summary/exportHelpers.ts", dynamic: ["xlsx", "jspdf", "jspdf-autotable"] },
  { file: "src/modules/accounts/utils/farmPaymentExport.ts", dynamic: ["jspdf-autotable"] },
  { file: "src/modules/fleet-operations/pages/VehicleAnalyticsPage.tsx", dynamic: ["xlsx", "jspdf-autotable"] },
  { file: "src/modules/fleet-operations/utils/fleetExport.ts", dynamic: ["xlsx", "jspdf", "jspdf-autotable"] },
  { file: "src/modules/fleet-operations/utils/generateMaintenancePdf.ts", dynamic: ["jspdf"] },
  { file: "src/modules/masters/components/bulk-import/bulkImportUtils.ts", dynamic: ["xlsx"] },
  { file: "src/modules/masters/banks/utils/exportBankPdf.ts", dynamic: ["jspdf", "jspdf-autotable"] },
  { file: "src/modules/masters/bird-types/utils/exportBirdTypePdf.ts", dynamic: ["jspdf", "jspdf-autotable"] },
  { file: "src/modules/masters/farms/pages/FarmsPage.tsx", dynamic: ["jspdf", "jspdf-autotable"] },
  { file: "src/modules/masters/shops/pages/ShopsPage.tsx", dynamic: ["jspdf", "jspdf-autotable"] },
  { file: "src/modules/operations/collections/components/entry/CollectionImportModal.tsx", dynamic: ["xlsx"] },
  { file: "src/modules/operations/collections/pages/CollectionReportPage.tsx", dynamic: ["xlsx", "jspdf-autotable"] },
  { file: "src/modules/operations/collections/utils/exportCollectionPdf.ts", dynamic: ["jspdf-autotable"] },
  { file: "src/modules/operations/collections/utils/exportPendingCollections.ts", dynamic: ["xlsx", "jspdf", "jspdf-autotable"] },
  { file: "src/modules/operations/fuel-expenses/utils/generateFuelPdf.ts", dynamic: ["jspdf"] },
  { file: "src/modules/operations/shop-sales/utils/exportShopSales.ts", dynamic: ["xlsx", "jspdf", "jspdf-autotable"] },
  { file: "src/modules/operations/trip-expenses/utils/exportOperationExpenses.ts", dynamic: ["jspdf-autotable"] },
  { file: "src/modules/operations/vehicle-trips/utils/generatePickupPDF.ts", dynamic: ["jspdf-autotable"] },
  { file: "src/modules/operations/vehicle-trips/utils/generateShopPDF.ts", dynamic: ["jspdf", "jspdf-autotable"] },
  { file: "src/modules/operations/vehicle-trips/utils/generateTripPDF.ts", dynamic: ["jspdf", "jspdf-autotable"] },
  { file: "src/modules/operations/vehicle-trips/utils/pickupImport.ts", dynamic: ["xlsx"] },
  { file: "src/modules/orders/pdf/generateAssignmentSheetPdf.ts", dynamic: ["jspdf-autotable"] },
  { file: "src/modules/orders/pdf/generateOrdersPdf.ts", dynamic: ["jspdf-autotable"] },
  { file: "src/modules/reports/components/ShopLedgerPDF.ts", dynamic: ["jspdf", "jspdf-autotable"] },
  { file: "src/modules/staff/services/payslipPdfDocument.ts", dynamic: ["jspdf-autotable"] },
  { file: "src/utils/drawDmrPoultryHeader.ts", dynamic: ["jspdf"] },
];

/** Runs `body` inside a throwaway directory and restores the cwd. */
async function inTempDir<T>(body: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dmr-export-"));
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return await body(dir);
  } finally {
    process.chdir(previous);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function sheetRows(workbookPath: string, sheetName: string): unknown[][] {
  const workbook = XLSX.readFile(workbookPath);
  const sheet = workbook.Sheets[sheetName];
  assert.ok(sheet, `sheet "${sheetName}" should exist in ${path.basename(workbookPath)}`);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
}

const SALES = [
  {
    id: 1,
    tripDate: "2026-11-01",
    shopName: "Sri Balaji",
    subShopName: "Main",
    totalBirds: 100,
    totalWeight: 250.5,
    mortality: 2,
    rate: 145.25,
    amount: 36370.13,
    remark: "Paid",
  },
  {
    id: 2,
    tripDate: "2026-11-02",
    shopName: "Anjaneya",
    subShopName: "",
    totalBirds: 50,
    totalWeight: 120,
    mortality: 0,
    rate: 146,
    amount: 17520,
    remark: "",
  },
];

const SUMMARY = {
  totalShops: 2,
  totalBirds: 150,
  totalWeight: 370.5,
  averageRate: 145.63,
  averageWeightPerBird: 2.47,
  totalAmount: 53890.13,
};

const PENDING_ROWS = [
  {
    shopName: "Sri Balaji",
    ownerName: "Ramesh",
    phoneNumber: "9000000001",
    balance: 12500.5,
    weeklySales: 40000,
    weeklyApprovedCollections: 27500,
    recoveryPercentage: 68.75,
    overdueDays: 4,
    lastCollectionDate: "2026-11-18",
  },
  {
    shopName: "Anjaneya",
    ownerName: "",
    phoneNumber: "",
    balance: 0,
    weeklySales: 0,
    weeklyApprovedCollections: 0,
    recoveryPercentage: 0,
    overdueDays: null,
    lastCollectionDate: null,
  },
];

function bulkImportConfig(prefix: string) {
  return {
    title: "Bulk Import",
    subtitle: "Test fixture",
    noun: "Row",
    nounPlural: "Rows",
    filenamePrefix: prefix,
    columns: [
      { key: "Shop Name", required: true, sample: "Sample Shop" },
      { key: "Owner", sample: "Sample Owner" },
    ],
    getTemplateRows: async () => [{ "Shop Name": "Live Shop", Owner: "Live Owner" }],
    parseRow: (record: Record<string, unknown>) => record,
    validateRow: () => [] as string[],
    toPayload: (row: unknown) => row,
    createMany: async () => ({ total: 0, attempted: 0, imported: 0, failed: 0, errors: [] }),
    refresh: async () => undefined,
    errorToString: (error: unknown) => String(error),
  } as never;
}

describe("export libraries are loaded on demand", () => {
  for (const { file, dynamic } of AFFECTED_MODULES) {
    it(`${file} has no static export-library import`, () => {
      const source = readSource(file);
      for (const library of LIBRARIES) {
        assert.equal(
          hasStaticValueImport(source, library),
          false,
          `${file} must not statically import ${library}`,
        );
      }
      for (const library of dynamic) {
        assert.ok(
          hasDynamicImport(source, library),
          `${file} should load ${library} through a dynamic import`,
        );
      }
    });
  }
});

describe("Excel and PDF export output is unchanged", () => {
  it("shop sales keeps its filename, sheet, title, headers and KPI block", async () => {
    const { exportShopSalesExcel } = await import(
      "../../src/modules/operations/shop-sales/utils/exportShopSales"
    );
    await inTempDir(async (dir) => {
      await exportShopSalesExcel(SALES as never, SUMMARY as never, "shop-sales-2026-11-20");

      const file = path.join(dir, "shop-sales-2026-11-20.xlsx");
      assert.ok(fs.existsSync(file), "exportShopSalesExcel writes <filename>.xlsx");

      const workbook = XLSX.readFile(file);
      assert.deepEqual(workbook.SheetNames, ["Shop Sales"]);

      const rows = sheetRows(file, "Shop Sales");
      assert.equal(rows[0][0], "DMR POULTRIES — SHOP SALES");
      assert.deepEqual(rows[1], []);
      assert.deepEqual(rows[2], [
        "S.No", "Date", "Shop Name", "Birds", "Weight (KG)", "Mortality", "Rate", "Amount", "Remark",
      ]);
      assert.deepEqual(rows[3], [
        1, "2026-11-01", "Sri Balaji -- Main", 100, "250.50", 2, "145.25", "36370.13", "Paid",
      ]);
      assert.deepEqual(rows[4], [
        2, "2026-11-02", "Anjaneya", 50, "120.00", 0, "146.00", "17520.00", "—",
      ]);

      const kpiIndex = rows.findIndex((row) => row?.[0] === "SHOP SALES KPI SUMMARY");
      assert.ok(kpiIndex > 0, "KPI summary block is present after the detail rows");
      assert.deepEqual(rows[kpiIndex + 1], [
        "Shops", "Birds", "Weight (KG)", "Mortality", "Average Rate", "Average Weight (KG)", "Amount",
      ]);
      assert.deepEqual(rows[kpiIndex + 2], [
        "2", "150", "370.50", "2", "145.63", "2.47", "53,890.13",
      ]);
    });
  });

  it("pending collections keeps its filename, sheet, title and columns", async () => {
    const { exportPendingCollectionsExcel } = await import(
      "../../src/modules/operations/collections/utils/exportPendingCollections"
    );
    await inTempDir(async (dir) => {
      await exportPendingCollectionsExcel(PENDING_ROWS as never, "pending-collections-2026-11-20");

      const file = path.join(dir, "pending-collections-2026-11-20.xlsx");
      assert.ok(fs.existsSync(file));

      const workbook = XLSX.readFile(file);
      assert.deepEqual(workbook.SheetNames, ["Pending Collections"]);

      const rows = sheetRows(file, "Pending Collections");
      assert.equal(rows[0][0], "DMR POULTRIES — PENDING COLLECTIONS");
      assert.deepEqual(rows[2], [
        "S.No", "Shop", "Owner", "Mobile", "Outstanding", "Sales", "Collections",
        "Recovery %", "Last Collection", "Overdue Days",
      ]);
      assert.deepEqual(rows[3], [
        1, "Sri Balaji", "Ramesh", "9000000001", "12500.50", "40000.00", "27500.00",
        "68.75", "2026-11-18", 4,
      ]);
      assert.deepEqual(rows[4], [
        2, "Anjaneya", "—", "—", "0.00", "0.00", "0.00", "0.00", "—", "—",
      ]);
    });
  });

  it("pending collections PDF keeps its filename and rendered columns", async () => {
    const { exportPendingCollectionsPdf } = await import(
      "../../src/modules/operations/collections/utils/exportPendingCollections"
    );
    await inTempDir(async (dir) => {
      await exportPendingCollectionsPdf(PENDING_ROWS as never, "pending-collections-2026-11-20");

      const file = path.join(dir, "pending-collections-2026-11-20.pdf");
      assert.ok(fs.existsSync(file), "exportPendingCollectionsPdf writes <filename>.pdf");
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");

      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
      assert.equal(pdf.numPages, 1);
      const content = await (await pdf.getPage(1)).getTextContent();
      const text = content.items
        .map((item) => (item as { str?: string }).str ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
      assert.match(text, /PENDING COLLECTIONS/);
      assert.match(text, /Sri Balaji/);
      assert.match(text, /68\.75/);
    });
  });

  it("bulk import template keeps both sheets, headers and filename", async () => {
    const { downloadImportTemplate } = await import(
      "../../src/modules/masters/components/bulk-import/bulkImportUtils"
    );
    await inTempDir(async (dir) => {
      await downloadImportTemplate(bulkImportConfig("Shops"));

      const file = path.join(dir, "Shops_Template.xlsx");
      assert.ok(fs.existsSync(file), "template filename is <prefix>_Template.xlsx");

      const workbook = XLSX.readFile(file);
      assert.deepEqual(workbook.SheetNames, ["Template", "Example - do not import"]);

      const template = sheetRows(file, "Template");
      assert.deepEqual(template[0], ["Shop Name *", "Owner"]);
      assert.deepEqual(template[1], ["Live Shop", "Live Owner"]);
      assert.ok(workbook.Sheets.Template["!autofilter"], "template keeps its autofilter");

      const example = sheetRows(file, "Example - do not import");
      assert.deepEqual(example[0], ["Shop Name *", "Owner"]);
      assert.deepEqual(example[1], ["Sample Shop", "Sample Owner"]);
    });
  });
});

describe("failing exports surface as catchable errors", () => {
  it("rejects instead of throwing an unhandled rejection or hanging", async () => {
    const { exportShopSalesExcel } = await import(
      "../../src/modules/operations/shop-sales/utils/exportShopSales"
    );
    await assert.rejects(
      () => exportShopSalesExcel(SALES as never, SUMMARY as never, "missing-dir/out"),
      (error: unknown) => error instanceof Error,
      "an unwritable destination rejects with an Error the page can catch",
    );
  });

  it("rejects when the pending-collections destination is unwritable", async () => {
    const { exportPendingCollectionsExcel } = await import(
      "../../src/modules/operations/collections/utils/exportPendingCollections"
    );
    await assert.rejects(() =>
      exportPendingCollectionsExcel(PENDING_ROWS as never, "missing-dir/out"),
    );
  });

  it("rejects when the pending-collections PDF destination is unwritable", async () => {
    const { exportPendingCollectionsPdf } = await import(
      "../../src/modules/operations/collections/utils/exportPendingCollections"
    );
    await assert.rejects(
      () => exportPendingCollectionsPdf(PENDING_ROWS as never, "missing-dir/out"),
      (error: unknown) => error instanceof Error,
      "the page's PDF catch path receives a normal Error",
    );
  });
});

describe("repeated exports stay independent", () => {
  it("produces the same content twice and never overlaps", async () => {
    const { exportShopSalesExcel } = await import(
      "../../src/modules/operations/shop-sales/utils/exportShopSales"
    );
    await inTempDir(async (dir) => {
      await exportShopSalesExcel(SALES as never, SUMMARY as never, "first");
      await exportShopSalesExcel(SALES as never, SUMMARY as never, "second");

      const first = sheetRows(path.join(dir, "first.xlsx"), "Shop Sales");
      const second = sheetRows(path.join(dir, "second.xlsx"), "Shop Sales");
      assert.deepEqual(second, first, "a repeated click writes identical content");

      await Promise.all([
        exportShopSalesExcel(SALES as never, SUMMARY as never, "third"),
        exportShopSalesExcel(SALES as never, SUMMARY as never, "fourth"),
      ]);
      assert.deepEqual(sheetRows(path.join(dir, "third.xlsx"), "Shop Sales"), first);
      assert.deepEqual(sheetRows(path.join(dir, "fourth.xlsx"), "Shop Sales"), first);
    });
  });
});
