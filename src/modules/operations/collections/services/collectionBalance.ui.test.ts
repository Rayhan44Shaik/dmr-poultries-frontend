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

const entryHookSrc = read("../hooks/useCollectionEntry.ts");
const summarySrc = read("../components/entry/OutstandingSummary.tsx");
const amountSrc = read("../components/entry/CollectionAmount.tsx");
const pendingPageSrc = read("../pages/PendingCollectionsPage.tsx");
const tableSrc = read("../components/entry/RecentCollectionsTable.tsx");
const serviceSrc = read("./collectionService.ts");

test("No 'Opening Balance' UI remains in the Collection balance components", () => {
  assert.doesNotMatch(summarySrc, /Opening Balance/);
  assert.doesNotMatch(amountSrc, /Opening Balance/);
  assert.doesNotMatch(entryHookSrc, /openingBalance/);
  assert.doesNotMatch(pendingPageSrc, /openingBalance/);
});

test("The Collection page balance is the backend-authoritative live balance, not a weekly figure", () => {
  // Outstanding Summary's main KPI is `balance` (shops.current_balance).
  assert.match(summarySrc, /balance/);
  assert.doesNotMatch(summarySrc, /currentOutstanding/);
  assert.doesNotMatch(summarySrc, /weekly opening/i);
  // The hook reads `weeklySummary.balance` for the live balance.
  assert.match(entryHookSrc, /weeklySummary\.balance/);
  assert.doesNotMatch(entryHookSrc, /currentOutstanding/);
});

test("No weekly opening-balance calculation remains in the frontend", () => {
  assert.doesNotMatch(serviceSrc, /currentOutstanding/);
  // The weekly-summary mapper now surfaces `balance`, not openingBalance.
  assert.match(serviceSrc, /balance:\s*Number\(data\.balance/);
  assert.doesNotMatch(serviceSrc, /data\.currentOutstanding/);
});

test("Weekly cards (Recent Sales / Approved / Pending) are week-scoped and informational", () => {
  assert.match(summarySrc, /Recent Sales/);
  assert.match(summarySrc, /Approved Collections/);
  assert.match(summarySrc, /Pending Collections/);
  // The week range label is displayed on the weekly cards only.
  assert.match(summarySrc, /dateRange/);
});

test("Balance KPI is the main headline (rendered before the weekly cards)", () => {
  const balanceIndex = summarySrc.indexOf(">Balance<");
  const salesIndex = summarySrc.indexOf("Recent Sales");
  assert.ok(balanceIndex !== -1 && salesIndex !== -1);
  assert.ok(balanceIndex < salesIndex, "Balance must be the primary KPI");
});

test("Collection Entry renders the collection table with the required columns", () => {
  assert.match(tableSrc, /Collection No/);
  assert.match(tableSrc, /Shop Name/);
  assert.match(tableSrc, /Payment Mode/);
  assert.match(tableSrc, />Day</);
  assert.match(tableSrc, />Status</);
});

test("Filtering happens before pagination (single global pagination)", () => {
  const filterIdx = tableSrc.indexOf("const filtered");
  const paginateIdx = tableSrc.indexOf("filtered.slice");
  assert.ok(filterIdx !== -1 && paginateIdx !== -1);
  assert.ok(filterIdx < paginateIdx, "filter must run before pagination");
  assert.match(tableSrc, /shouldShowPagination\(totalRecords\)/);
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
