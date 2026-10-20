/**
 * Frontend regression guards for the persistent-authoritative Collection
 * balance (no weekly opening balance, no weekly reset).
 *
 * The Collection module has no component-test infra (no jsdom / RTL), so
 * these assert on the module source (same pattern as
 * collectionService.contract.test.ts) plus one service-level test using a
 * mock axios adapter that the approval response's `currentBalance` is read.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { AxiosRequestConfig } from "axios";
import { apiClient } from "../../../../api/client";
import { collectionService } from "./collectionService";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  readFileSync(join(__dirname, rel), "utf8");

const enDictSrc = read("../../../../i18n/modules/operations.en.ts");
// Shared keys (operations.*) live in the main dictionary.
const enMainDictSrc = read("../../../../i18n/en.ts");
const entryHookSrc = read("../hooks/useCollectionEntry.ts");
const summarySrc = read("../components/entry/OutstandingSummary.tsx");
const tableSrc = read("../components/entry/RecentCollectionsTable.tsx");
const collectionInformationSrc = read("../components/entry/CollectionInformation.tsx");
const serviceSrc = read("./collectionService.ts");

test("Opening Balance is correctly displayed as a carried-forward figure", () => {
  // The summary card is i18n-driven, so assert the keys it renders — the
  // English literals only ever matched comments and broke on the i18n pass.
  // en values: "Opening Balance" / "Brought forward from previous week".
  // The summary renders "Opening Balance" + "Brought forward …" through the
  // shared i18n keys; the EN dictionary carries the expected wording.
  assert.match(summarySrc, /t\("ops\.collection\.opening_balance"\)/);
  assert.match(summarySrc, /t\("ops\.collection\.brought_forward_week"\)/);
  assert.match(enDictSrc, /'ops\.collection\.opening_balance':\s*'Opening Balance'/);
  assert.match(enDictSrc, /'ops\.collection\.brought_forward_week':\s*'Brought forward/);
  // The hook calculates openingBalance from the weekly summary
  assert.match(entryHookSrc, /openingBalance/);
});

test("The Collection page balance is the backend-authoritative live balance, not a weekly figure", () => {
  // Outstanding Summary's main KPI is `currentOutstanding` (shops.current_balance).
  // en values: "Current Outstanding" / "Outstanding Amount (Approved Only)".
  // Outstanding Summary's main KPI is `currentOutstanding` (shops.current_balance),
  // rendered through i18n keys — EN values: "Current Outstanding" /
  // "Outstanding Amount (Approved Only)".
  assert.match(summarySrc, /t\("ops\.collection\.current_outstanding"\)/);
  assert.match(summarySrc, /t\("ops\.collection\.outstanding_approved_only"\)/);
  assert.match(enDictSrc, /'ops\.collection\.current_outstanding':\s*'Current Outstanding'/);
  assert.match(enDictSrc, /'ops\.collection\.outstanding_approved_only':\s*'Outstanding includes approved sales only'/);
  // The hook reads `weeklySummary.balance` for the live balance and computes openingBalance.
  assert.match(entryHookSrc, /weeklySummary\.balance/);
  assert.match(entryHookSrc, /currentOutstanding/);
});

test("No weekly opening-balance calculation remains in the frontend (balance is persistent)", () => {
  // The service still uses `balance` from backend (shops.current_balance)
  assert.match(serviceSrc, /balance:\s*Number\(data\.balance/);
  // currentOutstanding is a frontend computed term, not in backend service
  assert.doesNotMatch(serviceSrc, /data\.currentOutstanding/);
});

test("Weekly cards (Approved Sales / Approved Collections / Pending Approval) are week-scoped and informational", () => {
  // en values: "Approved Sales" / "Approved Collections" / "Pending Approval".
  assert.match(summarySrc, /t\("ops\.collection\.approved_sales"\)/);
  assert.match(summarySrc, /t\("ops\.collection\.approved_collections"\)/);
  assert.match(summarySrc, /t\("operations\.pending_approval"\)/);
  assert.match(enDictSrc, /'ops\.collection\.approved_sales':\s*'Approved Sales'/);
  assert.match(enDictSrc, /'ops\.collection\.approved_collections':\s*'Approved Collections'/);
  assert.match(enMainDictSrc, /'operations\.pending_approval':\s*'Pending Approval'/);
  // The week range label is displayed on the weekly cards only.
  assert.match(summarySrc, /periodLabel/);
});

test("Summary permanently keeps sales on the previous week and collections on the current week", () => {
  // Backend contract: weekStart/weekEnd are the previous completed sales week;
  // collectionWeekStart/collectionWeekEnd are the selected current collection week.
  assert.match(summarySrc, /weekStart && weekEnd/);
  assert.match(summarySrc, /collectionWeekStart && collectionWeekEnd/);
  assert.match(summarySrc, /subtitle=\{countLabel\(salesCount, inWeekSubtitle\)\}/);
  assert.match(summarySrc, /subtitle=\{countLabel\(approvedCollectionsCount, collectionWeekRange\)\}/);
  assert.match(summarySrc, /subtitle=\{countLabel\(pendingCollectionsCount, collectionWeekRange\)\}/);
});

test("Collection date calendar is not clipped by the entry card", () => {
  assert.match(collectionInformationSrc, /overflow-visible/);
  assert.match(collectionInformationSrc, /focus-within:z-20/);
  assert.doesNotMatch(collectionInformationSrc, /opsFilterCardClass\} overflow-hidden/);
});

test("Current Outstanding KPI is the primary summary figure (highlighted, bottom of summary)", () => {
  // Current Outstanding is the bottom-line figure in the summary card (highlighted in emerald)
  assert.match(summarySrc, /t\("ops\.collection\.current_outstanding"\)/);
  assert.match(summarySrc, /t\("ops\.collection\.outstanding_approved_only"\)/);
  assert.match(summarySrc, /text-emerald-700/);  // Highlighted in emerald
  assert.match(summarySrc, /font-extrabold/);   // Large font
  // It is the last financial row (after the weekly cards)
  const outstandingIndex = summarySrc.lastIndexOf('t("ops.collection.current_outstanding")');
  const salesIndex = summarySrc.indexOf('t("ops.collection.approved_sales")');
  assert.ok(outstandingIndex !== -1 && salesIndex !== -1);
  assert.ok(outstandingIndex > salesIndex, "Current Outstanding must be the final summary row");
});

test("Collection Entry renders the collection table with the required columns", () => {
  // Column headers are i18n-driven, so assert the keys the table actually
  // renders rather than English literals (those only ever matched incidental
  // comments, and silently stopped matching when the layout was reworked).
  // The compact row-number heading is #, followed by the collection details.
  assert.match(tableSrc, />\s*#\s*</);
  assert.match(tableSrc, /t\("table\.collection_no"\)/);
  assert.match(tableSrc, /t\("common\.day"\)/);
  assert.match(tableSrc, /t\("table\.shop"\)/);
  assert.match(tableSrc, /t\("table\.collector"\)/);
  assert.match(tableSrc, /t\("table\.mode"\)/);
  assert.match(tableSrc, /t\("table\.amount"\)/);
  assert.match(tableSrc, /t\("table\.remarks"\)/);
  assert.match(tableSrc, /t\("table\.status"\)/);
  assert.match(tableSrc, /col\.paymentModeName/);
});

test("Collection Entry shop search is prefix-based and shows the latest shop transaction", () => {
  assert.match(collectionInformationSrc, /searchFromStart/);
  assert.match(collectionInformationSrc, /latestTransaction\.paymentModeName/);
  assert.match(collectionInformationSrc, /latestTransaction\.amount/);
  assert.match(collectionInformationSrc, /compactDate\(latestTransaction\.collectionDate\)/);
});

test("Filtering happens before display (single global filter)", () => {
  const filterIdx = tableSrc.indexOf("filteredBySearch");
  const displayIdx = tableSrc.indexOf("displayedData");
  assert.ok(filterIdx !== -1 && displayIdx !== -1);
  assert.ok(filterIdx < displayIdx, "filter must run before display");
  // RecentCollectionsTable doesn't use pagination (it shows all filtered results)
});

test("Recent Collections clears the selected row when clicking outside the table rows", () => {
  assert.match(tableSrc, /document\.addEventListener\("pointerdown", handleClickAway\)/);
  assert.match(tableSrc, /target\.closest\("\[data-recent-collection-row\], \[data-recent-collection-actions\]"\)/);
  assert.match(tableSrc, /data-recent-collection-row/);
  assert.match(tableSrc, /data-recent-collection-actions/);
  assert.match(tableSrc, /onSelectionChange\?\.\(null\)/);
});

test("Recent Collections keeps the selected row while a table-level action is clicked", () => {
  const guard = tableSrc.indexOf('target.closest("[data-recent-collection-row], [data-recent-collection-actions]")');
  const edit = tableSrc.indexOf("selectedCollection && onEdit(selectedCollection)");
  assert.ok(guard !== -1, "the click-away guard must include the selected-row action toolbar");
  assert.ok(edit !== -1, "the Edit action must use the selected collection");
});

test("Recent Collections uses selected-row toolbar actions instead of an actions column", () => {
  assert.match(tableSrc, /canEditSelected/);
  assert.match(tableSrc, /canDeleteSelected/);
  assert.match(tableSrc, /onDelete\?\.\(selectedCollection\.id\)/);
  assert.doesNotMatch(tableSrc, /t\("table\.actions"\)/);
});

test("Pending collection status changes through the row dropdown, not a toolbar approve button", () => {
  assert.match(tableSrc, /<select[\s\S]*value="Pending Approval"/);
  assert.match(tableSrc, /event\.target\.value === "Approved"/);
  assert.match(tableSrc, /onApprove\(col\.id\)/);
  assert.doesNotMatch(tableSrc, /canApproveSelected/);
});

test("approveCollection() reads the backend-returned currentBalance", async () => {
  const calls: string[] = [];
  const original = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config: AxiosRequestConfig) => {
    const method = (config.method ?? "get").toLowerCase();
    const url = config.url ?? "";
    calls.push(`${method} ${url}`);
    if (method === "patch") {
      return {
        data: { status: "Approved", currentBalance: 80000 },
        status: 200,
        statusText: "OK",
        headers: {},
        config: config as any,
      };
    }
    return {
      data: [],
      status: 200,
      statusText: "OK",
      headers: {},
      config: config as any,
    };
  };
  try {
    const result = await collectionService.approveCollection("7", "Admin");
    assert.equal(result.success, true);
    assert.equal(result.balance, 80000, "approval must surface the authoritative new balance");
    assert.ok(
      calls.some((c) => c === "patch /operations/collection-entry/7/status"),
      "approval must call the status endpoint"
    );
  } finally {
    apiClient.defaults.adapter = original;
  }
});
