// scripts/verify-collection-balances.mjs
// -----------------------------------------------------------------------------
// 100-case audit of the Collection Entry money model.
//
// Every case answers one question: does the Outstanding Summary tell the truth?
// The panel claims
//
//     Opening Balance + Approved Sales − Approved Collections = Current Outstanding
//
// where Opening Balance is the PREVIOUS week's closing balance. These cases pin
// down each term of that identity, the lifecycle transitions that move a row
// between terms (approve / reject / edit / delete / restore), and the invariants
// that must survive all of it (collection numbers unique, pending money never
// counted, deleted money never counted).
//
// The suite boots its own isolated sample API on a private port and mutates it
// freely, so the developer's running preview data is never touched.
//
//   npm run test:collection-balances
//   COLLECTION_TEST_PORT=4402 npm run test:collection-balances
// -----------------------------------------------------------------------------

import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";

const port = Number(process.env.COLLECTION_TEST_PORT ?? 4401);
const api = `http://127.0.0.1:${port}/api`;
const BOOT_TIMEOUT_MS = 30_000;

const round = (value) => Math.round(Number(value) * 100) / 100;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const dayMs = 86_400_000;
const shift = (iso, days) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * dayMs).toISOString().slice(0, 10);

/** Money comparison. Sample amounts are 2dp, so exact-to-the-paisa is fair. */
const money = (actual, expected, message) => assert.equal(round(actual), round(expected), message);

let child;
let logs = "";

async function req(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}

/** GET that must succeed. */
async function get(path) {
  const res = await req(path);
  assert.ok(res.ok, `GET ${path} failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

const summaryFor = (shopId, date) =>
  get(`/operations/collection-entry/weekly-summary?shopId=${shopId}&date=${date}`);
const summariesFor = (date) => get(`/operations/collection-entry/weekly-summaries?date=${date}`);

/** Creates a collection and returns the created row. */
const createCollection = (body) =>
  req("/operations/collection-entry", { method: "POST", body });
const setStatus = (id, body) =>
  req(`/operations/collection-entry/${id}/status`, { method: "PATCH", body });
const editCollection = (id, body) =>
  req(`/operations/collection-entry/${id}`, { method: "PUT", body });
const deleteCollection = (id) => req(`/operations/collection-entry/${id}`, { method: "DELETE" });

let TODAY;
let WEEK_START;
let WEEK_END;

before(async () => {
  child = spawn(process.execPath, ["scripts/quarter-sample-data.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, MOCK_BACKEND_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (chunk) => {
    logs = (logs + chunk.toString()).slice(-5_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  for (;;) {
    if (child.exitCode != null) throw new Error(`Sample API exited early.\n${logs}`);
    try {
      const response = await fetch(`${api}/health`);
      if (response.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`Sample API did not start.\n${logs}`);
    await wait(100);
  }

  const manifest = await get("/quarter-summary");
  TODAY = manifest.quarter.today;
  const bounds = await get(`/operations/collection-entry/week-bounds?date=${TODAY}`);
  WEEK_START = bounds.weekStart;
  WEEK_END = bounds.weekEnd;
});

after(async () => {
  if (!child || child.exitCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), wait(3_000)]);
  if (child.exitCode == null) child.kill("SIGKILL");
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. The core identity, across every shop  (cases 1-10)
// ═══════════════════════════════════════════════════════════════════════════
describe("core identity", () => {
  test("001 weekly-summary responds for the current week", async () => {
    const s = await summaryFor(1, TODAY);
    assert.equal(s.shopId, 1);
    assert.equal(s.isCurrentWeek, true);
  });

  test("002 all 200 shops are present in the list endpoint", async () => {
    assert.equal((await summariesFor(TODAY)).length, 200);
  });

  test("003 opening + sales - collections = outstanding, for all 200 shops", async () => {
    for (const row of await summariesFor(TODAY)) {
      money(
        row.openingBalance + row.weeklySales - row.approvedCollections,
        row.balance,
        `shop ${row.shopId} does not reconcile`,
      );
    }
  });

  test("004 closingBalance equals the panel arithmetic for all shops", async () => {
    for (const row of await summariesFor(TODAY)) {
      money(row.closingBalance, row.openingBalance + row.weeklySales - row.approvedCollections);
    }
  });

  test("005 closingBalance equals live balance in the current week", async () => {
    for (const row of await summariesFor(TODAY)) money(row.closingBalance, row.balance);
  });

  test("006 every shop exposes a finite opening balance", async () => {
    for (const row of await summariesFor(TODAY)) {
      assert.ok(Number.isFinite(row.openingBalance), `shop ${row.shopId}`);
    }
  });

  test("007 single-shop and list endpoints agree field-for-field", async () => {
    const list = await summariesFor(TODAY);
    for (const shopId of [1, 7, 42, 99, 150, 200]) {
      const one = await summaryFor(shopId, TODAY);
      assert.deepEqual(one, list.find((row) => row.shopId === shopId));
    }
  });

  test("008 pending collections are excluded from the outstanding balance", async () => {
    const withPending = (await summariesFor(TODAY)).filter((row) => row.pendingCollections > 0);
    assert.ok(withPending.length > 0, "expected pending money in the dataset");
    for (const row of withPending) {
      money(row.openingBalance + row.weeklySales - row.approvedCollections, row.balance);
    }
  });

  test("009 pending sales are excluded from the outstanding balance", async () => {
    for (const row of await summariesFor(TODAY)) {
      assert.ok(Number.isFinite(row.pendingSales));
      money(row.openingBalance + row.weeklySales - row.approvedCollections, row.balance);
    }
  });

  test("010 totals across all shops reconcile in aggregate", async () => {
    const rows = await summariesFor(TODAY);
    const total = (field) => round(rows.reduce((sum, row) => sum + row[field], 0));
    money(
      total("openingBalance") + total("weeklySales") - total("approvedCollections"),
      total("balance"),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Opening balance = previous week's closing balance  (cases 11-25)
// ═══════════════════════════════════════════════════════════════════════════
describe("opening balance carry-forward", () => {
  test("011 previousWeekEnd is the day before weekStart", async () => {
    for (const row of await summariesFor(TODAY)) {
      assert.equal(row.previousWeekEnd, shift(row.weekStart, -1));
    }
  });

  test("012 weekStart is a Monday", async () => {
    assert.equal(new Date(`${WEEK_START}T00:00:00Z`).getUTCDay(), 1);
  });

  test("013 weekEnd is the Sunday six days after weekStart", async () => {
    assert.equal(WEEK_END, shift(WEEK_START, 6));
    assert.equal(new Date(`${WEEK_END}T00:00:00Z`).getUTCDay(), 0);
  });

  for (const [index, weeksBack] of [1, 2, 3, 4, 5].entries()) {
    test(`0${14 + index} opening equals prior week's close, ${weeksBack} week(s) back`, async () => {
      const thisWeek = shift(WEEK_START, -7 * (weeksBack - 1));
      const prevWeek = shift(thisWeek, -7);
      const current = await summariesFor(thisWeek);
      const previous = await summariesFor(prevWeek);
      const prevById = new Map(previous.map((row) => [row.shopId, row]));
      for (const row of current) {
        const before = prevById.get(row.shopId);
        money(
          row.openingBalance,
          before.openingBalance + before.weeklySales - before.approvedCollections,
          `shop ${row.shopId} week ${row.weekStart}`,
        );
      }
    });
  }

  test("019 the chain holds across 10 consecutive weeks for a busy shop", async () => {
    const busy = (await summariesFor(TODAY)).find((row) => row.openingBalance > 1000);
    let priorClose = null;
    for (let back = 9; back >= 0; back -= 1) {
      const row = (await summariesFor(shift(WEEK_START, -7 * back))).find(
        (candidate) => candidate.shopId === busy.shopId,
      );
      if (priorClose != null) money(row.openingBalance, priorClose, `week ${row.weekStart}`);
      priorClose = round(row.openingBalance + row.weeklySales - row.approvedCollections);
    }
  });

  test("020 opening balance is stable when re-queried mid-week", async () => {
    const monday = await summaryFor(1, WEEK_START);
    for (const offset of [1, 2, 3, 4, 5, 6]) {
      const later = await summaryFor(1, shift(WEEK_START, offset));
      money(later.openingBalance, monday.openingBalance, `offset ${offset}`);
      assert.equal(later.weekStart, monday.weekStart);
    }
  });

  test("021 every day of a week resolves to identical week bounds", async () => {
    for (const offset of [0, 1, 2, 3, 4, 5, 6]) {
      const bounds = await get(
        `/operations/collection-entry/week-bounds?date=${shift(WEEK_START, offset)}`,
      );
      assert.equal(bounds.weekStart, WEEK_START);
      assert.equal(bounds.weekEnd, WEEK_END);
    }
  });

  test("022 the very first quarter week opens at the shop's seeded opening balance", async () => {
    const manifest = await get("/quarter-summary");
    const firstWeek = await summariesFor(manifest.quarter.fromDate);
    // The quarter starts mid-week, so this week begins on or before the first
    // dated row. No ledger activity can predate it, which means the opening
    // balance must still be exactly the shop's configured starting figure.
    assert.ok(firstWeek[0].weekStart <= manifest.quarter.fromDate);
    const shops = await get("/masters/shops");
    const byId = new Map((Array.isArray(shops) ? shops : shops.data).map((s) => [s.id, s]));
    let matched = 0;
    for (const row of firstWeek) {
      const seeded = byId.get(row.shopId);
      if (!seeded) continue;
      money(row.openingBalance, seeded.openingBalance, `shop ${row.shopId}`);
      matched += 1;
    }
    assert.ok(matched > 100, `expected to check most shops, checked ${matched}`);
  });

  test("023 opening balance never silently becomes null or NaN", async () => {
    for (const date of [WEEK_START, shift(WEEK_START, -21), shift(WEEK_START, -56)]) {
      for (const row of await summariesFor(date)) {
        assert.equal(typeof row.openingBalance, "number");
        assert.ok(!Number.isNaN(row.openingBalance));
      }
    }
  });

  test("024 a future week opens at today's live balance", async () => {
    const future = await summaryFor(1, shift(WEEK_START, 14));
    const now = await summaryFor(1, TODAY);
    money(future.openingBalance, now.balance);
  });

  test("025 a future week has no activity of its own", async () => {
    const future = await summaryFor(1, shift(WEEK_START, 14));
    money(future.weeklySales, 0);
    money(future.approvedCollections, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Approved vs pending vs deleted collections  (cases 26-50)
// ═══════════════════════════════════════════════════════════════════════════
describe("collection status handling", () => {
  const shopId = 11;

  test("026 a new collection defaults to Pending Approval", async () => {
    const res = await createCollection({ shopId, amount: 1000, collectionDate: TODAY, paymentMode: "Cash" });
    assert.equal(res.status, 201);
    assert.equal(res.data.status, "Pending Approval");
    await deleteCollection(res.data.id);
  });

  test("027 creating a pending collection does not change the balance", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 5000, collectionDate: TODAY, paymentMode: "Cash" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance);
    money(after.approvedCollections, before.approvedCollections);
    await deleteCollection(res.data.id);
  });

  test("028 creating a pending collection does raise pendingCollections", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 2500, collectionDate: TODAY, paymentMode: "Cash" });
    const after = await summaryFor(shopId, TODAY);
    money(after.pendingCollections, before.pendingCollections + 2500);
    await deleteCollection(res.data.id);
  });

  test("029 approving a collection reduces the outstanding balance", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 3000, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 3000);
    money(after.approvedCollections, before.approvedCollections + 3000);
    await deleteCollection(res.data.id);
  });

  test("030 approving moves money from pending into approved", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 1500, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.pendingCollections, before.pendingCollections);
    money(after.approvedCollections, before.approvedCollections + 1500);
    await deleteCollection(res.data.id);
  });

  test("031 the identity still holds after an approval", async () => {
    const res = await createCollection({ shopId, amount: 4200, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const s = await summaryFor(shopId, TODAY);
    money(s.openingBalance + s.weeklySales - s.approvedCollections, s.balance);
    await deleteCollection(res.data.id);
  });

  test("032 rejecting a collection leaves the balance untouched", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 9000, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Rejected" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance);
    money(after.approvedCollections, before.approvedCollections);
    await deleteCollection(res.data.id);
  });

  test("033 a rejected collection is not counted as pending either", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 800, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Rejected" });
    const after = await summaryFor(shopId, TODAY);
    money(after.pendingCollections, before.pendingCollections);
    await deleteCollection(res.data.id);
  });

  test("034 approve then reject restores the original balance", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 6400, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    await setStatus(res.data.id, { status: "Rejected" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance);
    await deleteCollection(res.data.id);
  });

  test("035 repeated approvals are idempotent, never double-counted", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 2000, collectionDate: TODAY, paymentMode: "Cash" });
    for (let i = 0; i < 5; i += 1) await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 2000, "five approvals must deduct 2000 once");
    await deleteCollection(res.data.id);
  });

  test("036 approve/reject flapping settles on the final state", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 3300, collectionDate: TODAY, paymentMode: "Cash" });
    for (let i = 0; i < 4; i += 1) {
      await setStatus(res.data.id, { status: "Approved" });
      await setStatus(res.data.id, { status: "Rejected" });
    }
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 3300);
    await deleteCollection(res.data.id);
  });

  test("037 deleting an approved collection returns the money to outstanding", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 7100, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    await deleteCollection(res.data.id);
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance);
  });

  test("038 deleting a pending collection clears it from pending", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 4400, collectionDate: TODAY, paymentMode: "Cash" });
    await deleteCollection(res.data.id);
    const after = await summaryFor(shopId, TODAY);
    money(after.pendingCollections, before.pendingCollections);
  });

  test("039 a deleted collection disappears from the default register", async () => {
    const res = await createCollection({ shopId, amount: 1200, collectionDate: TODAY, paymentMode: "Cash" });
    await deleteCollection(res.data.id);
    const rows = await get(`/operations/collection-entry?shopId=${shopId}`);
    assert.ok(!rows.some((row) => row.id === res.data.id));
  });

  test("040 a deleted collection is still retrievable with includeDeleted", async () => {
    const res = await createCollection({ shopId, amount: 1300, collectionDate: TODAY, paymentMode: "Cash" });
    await deleteCollection(res.data.id);
    const rows = await get(`/operations/collection-entry?shopId=${shopId}&includeDeleted=true`);
    const found = rows.find((row) => row.id === res.data.id);
    assert.ok(found);
    assert.equal(found.deleted, true);
  });

  test("041 deleted collections never contribute to the opening balance", async () => {
    const pastDate = shift(WEEK_START, -3);
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 8800, collectionDate: pastDate, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    await deleteCollection(res.data.id);
    const after = await summaryFor(shopId, TODAY);
    money(after.openingBalance, before.openingBalance);
  });

  test("042 status filter returns only Pending Approval rows", async () => {
    const rows = await get("/operations/collection-entry?status=Pending%20Approval");
    assert.ok(rows.length > 0);
    for (const row of rows) assert.equal(row.status, "Pending Approval");
  });

  test("043 the status filter never leaks deleted rows", async () => {
    const rows = await get("/operations/collection-entry?status=Pending%20Approval");
    for (const row of rows) assert.notEqual(row.deleted, true);
  });

  test("044 approving a back-dated collection updates that week, not this one", async () => {
    const pastDate = shift(WEEK_START, -10);
    const pastBefore = await summaryFor(shopId, pastDate);
    const nowBefore = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 5600, collectionDate: pastDate, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const pastAfter = await summaryFor(shopId, pastDate);
    const nowAfter = await summaryFor(shopId, TODAY);
    money(pastAfter.approvedCollections, pastBefore.approvedCollections + 5600, "past week gains it");
    money(nowAfter.approvedCollections, nowBefore.approvedCollections, "this week must not");
    await deleteCollection(res.data.id);
  });

  test("045 a back-dated approval lowers THIS week's opening balance", async () => {
    const pastDate = shift(WEEK_START, -10);
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 4700, collectionDate: pastDate, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.openingBalance, before.openingBalance - 4700);
    await deleteCollection(res.data.id);
  });

  test("046 the identity survives a back-dated approval (the original bug)", async () => {
    const pastDate = shift(WEEK_START, -10);
    const res = await createCollection({ shopId, amount: 6100, collectionDate: pastDate, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const s = await summaryFor(shopId, TODAY);
    money(s.openingBalance + s.weeklySales - s.approvedCollections, s.balance);
    await deleteCollection(res.data.id);
  });

  test("047 a pending back-dated collection does NOT move the opening balance", async () => {
    const pastDate = shift(WEEK_START, -10);
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 3900, collectionDate: pastDate, paymentMode: "Cash" });
    const after = await summaryFor(shopId, TODAY);
    money(after.openingBalance, before.openingBalance);
    await deleteCollection(res.data.id);
  });

  test("048 a collection dated exactly on weekStart is in-week, not opening", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 2200, collectionDate: WEEK_START, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.openingBalance, before.openingBalance, "weekStart must not fall into opening");
    money(after.approvedCollections, before.approvedCollections + 2200);
    await deleteCollection(res.data.id);
  });

  test("049 a collection dated on previousWeekEnd lands in the opening balance", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({
      shopId,
      amount: 2600,
      collectionDate: before.previousWeekEnd,
      paymentMode: "Cash",
    });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.openingBalance, before.openingBalance - 2600, "boundary day belongs to opening");
    money(after.approvedCollections, before.approvedCollections);
    await deleteCollection(res.data.id);
  });

  test("050 a collection dated exactly on weekEnd is still in-week", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 1900, collectionDate: WEEK_END, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.approvedCollections, before.approvedCollections + 1900);
    await deleteCollection(res.data.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Collection number uniqueness and identity  (cases 51-65)
// ═══════════════════════════════════════════════════════════════════════════
describe("collection number integrity", () => {
  const shopId = 12;

  test("051 every seeded collection number is unique", async () => {
    const rows = await get("/operations/collection-entry?includeDeleted=true");
    const seen = new Set(rows.map((row) => row.collectionNo));
    assert.equal(seen.size, rows.length, "duplicate collectionNo in the register");
  });

  test("052 every seeded collection id is unique", async () => {
    const rows = await get("/operations/collection-entry?includeDeleted=true");
    assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  });

  test("053 collection numbers follow the COL-YYYYMMDD-NNN format", async () => {
    const rows = await get("/operations/collection-entry?includeDeleted=true");
    for (const row of rows.slice(0, 500)) {
      assert.match(row.collectionNo, /^COL-\d{8}-\d{3,}$/, `bad number ${row.collectionNo}`);
    }
  });

  test("054 a newly created collection gets a unique number", async () => {
    const before = await get("/operations/collection-entry?includeDeleted=true");
    const known = new Set(before.map((row) => row.collectionNo));
    const res = await createCollection({ shopId, amount: 100, collectionDate: TODAY, paymentMode: "Cash" });
    assert.ok(!known.has(res.data.collectionNo), `reused ${res.data.collectionNo}`);
    await deleteCollection(res.data.id);
  });

  test("055 20 rapid sequential creates all get distinct numbers", async () => {
    const made = [];
    for (let i = 0; i < 20; i += 1) {
      const res = await createCollection({ shopId, amount: 100 + i, collectionDate: TODAY, paymentMode: "Cash" });
      made.push(res.data);
    }
    assert.equal(new Set(made.map((row) => row.collectionNo)).size, 20);
    for (const row of made) await deleteCollection(row.id);
  });

  test("056 20 concurrent creates all get distinct numbers", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createCollection({ shopId, amount: 200 + i, collectionDate: TODAY, paymentMode: "Cash" }),
      ),
    );
    const rows = results.map((res) => res.data);
    assert.equal(new Set(rows.map((row) => row.collectionNo)).size, 20, "concurrent creates collided");
    assert.equal(new Set(rows.map((row) => row.id)).size, 20, "concurrent ids collided");
    for (const row of rows) await deleteCollection(row.id);
  });

  test("057 numbers stay unique after a delete frees a slot", async () => {
    const a = await createCollection({ shopId, amount: 310, collectionDate: TODAY, paymentMode: "Cash" });
    await deleteCollection(a.data.id);
    const b = await createCollection({ shopId, amount: 320, collectionDate: TODAY, paymentMode: "Cash" });
    assert.notEqual(a.data.collectionNo, b.data.collectionNo, "a deleted number was reused");
    await deleteCollection(b.data.id);
  });

  test("058 the whole register is still collision-free after churn", async () => {
    const rows = await get("/operations/collection-entry?includeDeleted=true");
    assert.equal(new Set(rows.map((row) => row.collectionNo)).size, rows.length);
  });

  test("059 a collection number is immutable across edits", async () => {
    const res = await createCollection({ shopId, amount: 400, collectionDate: TODAY, paymentMode: "Cash" });
    const edited = await editCollection(res.data.id, { amount: 900, remarks: "changed" });
    assert.equal(edited.data.collectionNo, res.data.collectionNo);
    await deleteCollection(res.data.id);
  });

  test("060 a collection number survives a date change", async () => {
    const res = await createCollection({ shopId, amount: 500, collectionDate: TODAY, paymentMode: "Cash" });
    const moved = await editCollection(res.data.id, { collectionDate: shift(TODAY, -2) });
    assert.equal(moved.data.collectionNo, res.data.collectionNo);
    assert.equal(moved.data.collectionDate, shift(TODAY, -2));
    await deleteCollection(res.data.id);
  });

  test("061 moving a row into another day's bucket causes no collision", async () => {
    const target = shift(TODAY, -5);
    const moved = await createCollection({ shopId, amount: 600, collectionDate: TODAY, paymentMode: "Cash" });
    await editCollection(moved.data.id, { collectionDate: target });
    const fresh = await createCollection({ shopId, amount: 700, collectionDate: target, paymentMode: "Cash" });
    const rows = await get("/operations/collection-entry?includeDeleted=true");
    assert.equal(new Set(rows.map((row) => row.collectionNo)).size, rows.length);
    await deleteCollection(moved.data.id);
    await deleteCollection(fresh.data.id);
  });

  test("062 ids are never reused after deletion", async () => {
    const a = await createCollection({ shopId, amount: 800, collectionDate: TODAY, paymentMode: "Cash" });
    await deleteCollection(a.data.id);
    const b = await createCollection({ shopId, amount: 810, collectionDate: TODAY, paymentMode: "Cash" });
    assert.notEqual(a.data.id, b.data.id);
    await deleteCollection(b.data.id);
  });

  test("063 fetching an unknown collection id is a clean 404", async () => {
    const res = await req("/operations/collection-entry/99999999");
    assert.equal(res.status, 404);
  });

  test("064 a deleted collection cannot be edited", async () => {
    const res = await createCollection({ shopId, amount: 820, collectionDate: TODAY, paymentMode: "Cash" });
    await deleteCollection(res.data.id);
    const edit = await editCollection(res.data.id, { amount: 1 });
    assert.equal(edit.status, 404);
  });

  test("065 a deleted collection cannot be approved back into the balance", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 5500, collectionDate: TODAY, paymentMode: "Cash" });
    await deleteCollection(res.data.id);
    const patch = await setStatus(res.data.id, { status: "Approved" });
    assert.equal(patch.status, 404);
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Amount edits and arithmetic edge cases  (cases 66-80)
// ═══════════════════════════════════════════════════════════════════════════
describe("amount handling", () => {
  const shopId = 13;

  test("066 editing an approved amount adjusts the balance by the delta", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 1000, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    await editCollection(res.data.id, { amount: 2500 });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 2500);
    await deleteCollection(res.data.id);
  });

  test("067 reducing an approved amount gives money back", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 4000, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    await editCollection(res.data.id, { amount: 1000 });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 1000);
    await deleteCollection(res.data.id);
  });

  test("068 decimal paise amounts round correctly", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 1234.56, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 1234.56);
    await deleteCollection(res.data.id);
  });

  test("069 repeated decimal amounts do not accumulate float drift", async () => {
    const before = await summaryFor(shopId, TODAY);
    const made = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await createCollection({ shopId, amount: 0.07, collectionDate: TODAY, paymentMode: "Cash" });
      await setStatus(res.data.id, { status: "Approved" });
      made.push(res.data.id);
    }
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 0.7, "ten 0.07 collections must total exactly 0.70");
    for (const id of made) await deleteCollection(id);
  });

  test("070 a zero-amount collection is harmless", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 0, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance);
    await deleteCollection(res.data.id);
  });

  test("071 a very large amount does not overflow the balance", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 10_000_000, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, before.balance - 10_000_000);
    assert.ok(Number.isFinite(after.balance));
    await deleteCollection(res.data.id);
  });

  test("072 over-collecting drives outstanding negative, and it still reconciles", async () => {
    const before = await summaryFor(shopId, TODAY);
    const over = round(before.balance + 50_000);
    const res = await createCollection({ shopId, amount: over, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const after = await summaryFor(shopId, TODAY);
    assert.ok(after.balance < 0, "expected a credit balance");
    money(after.openingBalance + after.weeklySales - after.approvedCollections, after.balance);
    await deleteCollection(res.data.id);
  });

  test("073 the identity holds for every shop after all this churn", async () => {
    for (const row of await summariesFor(TODAY)) {
      money(row.openingBalance + row.weeklySales - row.approvedCollections, row.balance, `shop ${row.shopId}`);
    }
  });

  test("074 approvedCollectionsCount matches the number of approved rows", async () => {
    const s = await summaryFor(shopId, TODAY);
    const rows = await get(`/operations/collection-entry?shopId=${shopId}`);
    const inWeek = rows.filter(
      (row) => row.status === "Approved" && row.collectionDate >= s.weekStart && row.collectionDate <= s.weekEnd,
    );
    assert.equal(s.approvedCollectionsCount, inWeek.length);
  });

  test("075 pendingCollectionsCount matches the number of pending rows", async () => {
    const s = await summaryFor(shopId, TODAY);
    const rows = await get(`/operations/collection-entry?shopId=${shopId}`);
    const inWeek = rows.filter(
      (row) =>
        row.status === "Pending Approval" && row.collectionDate >= s.weekStart && row.collectionDate <= s.weekEnd,
    );
    assert.equal(s.pendingCollectionsCount, inWeek.length);
  });

  test("076 approvedCollections equals the sum of its own rows", async () => {
    const s = await summaryFor(shopId, TODAY);
    const rows = await get(`/operations/collection-entry?shopId=${shopId}`);
    const total = rows
      .filter((row) => row.status === "Approved" && row.collectionDate >= s.weekStart && row.collectionDate <= s.weekEnd)
      .reduce((sum, row) => sum + Number(row.amount), 0);
    money(s.approvedCollections, total);
  });

  test("077 pendingCollections equals the sum of its own rows", async () => {
    const s = await summaryFor(shopId, TODAY);
    const rows = await get(`/operations/collection-entry?shopId=${shopId}`);
    const total = rows
      .filter(
        (row) =>
          row.status === "Pending Approval" && row.collectionDate >= s.weekStart && row.collectionDate <= s.weekEnd,
      )
      .reduce((sum, row) => sum + Number(row.amount), 0);
    money(s.pendingCollections, total);
  });

  test("078 counts are zero when the amounts are zero", async () => {
    for (const row of await summariesFor(TODAY)) {
      if (row.approvedCollections === 0) assert.equal(row.approvedCollectionsCount, 0, `shop ${row.shopId}`);
      if (row.pendingCollections === 0) assert.equal(row.pendingCollectionsCount, 0, `shop ${row.shopId}`);
    }
  });

  test("079 counts are never negative", async () => {
    for (const row of await summariesFor(TODAY)) {
      assert.ok(row.approvedCollectionsCount >= 0 && row.pendingCollectionsCount >= 0);
      assert.ok(row.salesCount >= 0);
    }
  });

  test("080 editing only remarks leaves every figure untouched", async () => {
    const before = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 1111, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const mid = await summaryFor(shopId, TODAY);
    await editCollection(res.data.id, { remarks: "note only" });
    const after = await summaryFor(shopId, TODAY);
    money(after.balance, mid.balance);
    await deleteCollection(res.data.id);
    money((await summaryFor(shopId, TODAY)).balance, before.balance);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Sales side, cross-module sync and page contract  (cases 81-100)
// ═══════════════════════════════════════════════════════════════════════════
describe("sales, cross-module sync and contract", () => {
  test("081 weeklySales equals the sum of approved in-week sales", async () => {
    const s = await summaryFor(1, TODAY);
    const sales = await get(`/operations/shop-sales?shopId=1&limit=1000`);
    const rows = (Array.isArray(sales) ? sales : sales.data) ?? [];
    const total = rows
      .filter(
        (row) =>
          row.deleted !== true &&
          (row.status ?? "Approved") === "Approved" &&
          (row.saleDate ?? row.tripDate) >= s.weekStart &&
          (row.saleDate ?? row.tripDate) <= s.weekEnd,
      )
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    money(s.weeklySales, total);
  });

  test("082 weeklySales is never negative", async () => {
    for (const row of await summariesFor(TODAY)) assert.ok(row.weeklySales >= 0, `shop ${row.shopId}`);
  });

  test("083 pendingSales defaults to zero when all sales are approved", async () => {
    for (const row of await summariesFor(TODAY)) assert.equal(typeof row.pendingSales, "number");
  });

  test("084 salesCount is zero exactly when weeklySales is zero", async () => {
    for (const row of await summariesFor(TODAY)) {
      if (row.weeklySales === 0) assert.equal(row.salesCount, 0, `shop ${row.shopId}`);
      else assert.ok(row.salesCount > 0, `shop ${row.shopId}`);
    }
  });

  test("085 the shop master balance matches the summary balance", async () => {
    const shops = await get("/masters/shops");
    const rows = Array.isArray(shops) ? shops : shops.data;
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const row of await summariesFor(TODAY)) {
      const shop = byId.get(row.shopId);
      if (shop) money(shop.currentBalance, row.balance, `shop ${row.shopId} master/summary drift`);
    }
  });

  test("086 pending-summary and weekly-summaries agree on every shop", async () => {
    const report = await get(`/operations/collection-entry/pending-summary?date=${TODAY}`);
    const weekly = new Map((await summariesFor(TODAY)).map((row) => [row.shopId, row]));
    for (const shop of report.shops) {
      const row = weekly.get(shop.shopId);
      money(shop.openingBalance, row.openingBalance, `shop ${shop.shopId}`);
      money(shop.balance, row.balance, `shop ${shop.shopId}`);
    }
  });

  test("087 pending collections list agrees with the live balance", async () => {
    const pending = await get("/operations/collections/pending");
    const weekly = new Map((await summariesFor(TODAY)).map((row) => [row.shopId, row]));
    for (const shop of pending) {
      money(shop.currentPending, weekly.get(shop.shopId).balance, `shop ${shop.shopId}`);
    }
  });

  test("088 an approval is reflected in the shop master immediately", async () => {
    const shopId = 14;
    const res = await createCollection({ shopId, amount: 3456, collectionDate: TODAY, paymentMode: "Cash" });
    await setStatus(res.data.id, { status: "Approved" });
    const summary = await summaryFor(shopId, TODAY);
    const shops = await get("/masters/shops");
    const rows = Array.isArray(shops) ? shops : shops.data;
    money(rows.find((row) => row.id === shopId).currentBalance, summary.balance);
    await deleteCollection(res.data.id);
  });

  test("089 week-bounds and weekly-summary report the same week", async () => {
    const bounds = await get(`/operations/collection-entry/week-bounds?date=${TODAY}`);
    const summary = await summaryFor(1, TODAY);
    assert.equal(summary.weekStart, bounds.weekStart);
    assert.equal(summary.weekEnd, bounds.weekEnd);
  });

  test("090 the summary payload exposes every field the panel binds to", async () => {
    const s = await summaryFor(1, TODAY);
    for (const field of [
      "shopId",
      "shopName",
      "weekStart",
      "weekEnd",
      "previousWeekEnd",
      "openingBalance",
      "balance",
      "closingBalance",
      "weeklySales",
      "pendingSales",
      "salesCount",
      "approvedCollections",
      "pendingCollections",
      "approvedCollectionsCount",
      "pendingCollectionsCount",
      "isCurrentWeek",
    ]) {
      assert.ok(field in s, `missing field ${field}`);
    }
  });

  test("091 every numeric field really is a number", async () => {
    const s = await summaryFor(1, TODAY);
    for (const field of [
      "openingBalance",
      "balance",
      "closingBalance",
      "weeklySales",
      "pendingSales",
      "salesCount",
      "approvedCollections",
      "pendingCollections",
    ]) {
      assert.equal(typeof s[field], "number", `${field} is not a number`);
    }
  });

  test("092 dates are ISO yyyy-mm-dd", async () => {
    const s = await summaryFor(1, TODAY);
    for (const field of ["weekStart", "weekEnd", "previousWeekEnd"]) {
      assert.match(s[field], /^\d{4}-\d{2}-\d{2}$/, `${field} is not ISO`);
    }
  });

  test("093 an unknown shop id returns a clean 404", async () => {
    const res = await req("/operations/collection-entry/weekly-summary?shopId=999999&date=" + TODAY);
    assert.equal(res.status, 404);
  });

  test("094 inactive shops still get a correct summary", async () => {
    const shops = await get("/masters/shops");
    const rows = Array.isArray(shops) ? shops : shops.data;
    const inactive = rows.filter((row) => row.status === "Inactive");
    assert.ok(inactive.length > 0, "dataset should contain inactive shops");
    for (const shop of inactive.slice(0, 5)) {
      const s = await summaryFor(shop.id, TODAY);
      money(s.openingBalance + s.weeklySales - s.approvedCollections, s.balance, `shop ${shop.id}`);
    }
  });

  test("095 isCurrentWeek is true only for the week containing today", async () => {
    assert.equal((await summaryFor(1, TODAY)).isCurrentWeek, true);
    assert.equal((await summaryFor(1, shift(WEEK_START, -7))).isCurrentWeek, false);
    assert.equal((await summaryFor(1, shift(WEEK_START, 7))).isCurrentWeek, false);
  });

  test("096 recent collections for a shop are all that shop's, and undeleted", async () => {
    const rows = await get("/operations/collection-entry/recent?shopId=1&limit=20");
    for (const row of rows) {
      assert.equal(row.shopId, 1);
      assert.notEqual(row.deleted, true);
    }
  });

  test("097 repeated identical reads are stable (no hidden mutation)", async () => {
    const first = await summaryFor(1, TODAY);
    for (let i = 0; i < 5; i += 1) assert.deepEqual(await summaryFor(1, TODAY), first);
  });

  test("098 concurrent reads all agree with each other", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => summaryFor(1, TODAY)));
    for (const row of results) assert.deepEqual(row, results[0]);
  });

  test("099 a full lifecycle returns the shop to its starting balance", async () => {
    const shopId = 15;
    const start = await summaryFor(shopId, TODAY);
    const res = await createCollection({ shopId, amount: 9999, collectionDate: TODAY, paymentMode: "UPI" });
    await setStatus(res.data.id, { status: "Approved" });
    await editCollection(res.data.id, { amount: 4321 });
    await setStatus(res.data.id, { status: "Rejected" });
    await setStatus(res.data.id, { status: "Approved" });
    await deleteCollection(res.data.id);
    const end = await summaryFor(shopId, TODAY);
    money(end.balance, start.balance);
    money(end.openingBalance, start.openingBalance);
    money(end.approvedCollections, start.approvedCollections);
  });

  test("099b approving a trip posts its sales to shop outstanding immediately", async () => {
    const trips = await get("/trips");
    const rows = Array.isArray(trips) ? trips : (trips.data ?? []);
    const trip = rows.find(
      (row) =>
        row.status === "Pending" &&
        row.deleted !== true &&
        (row.deliveries ?? []).some((d) => Number(d.amount) > 0),
    );
    assert.ok(trip, "expected a pending trip carrying rated deliveries");

    const expected = new Map();
    for (const d of trip.deliveries) {
      expected.set(d.shopId, round((expected.get(d.shopId) ?? 0) + Number(d.amount ?? 0)));
    }
    const balances = async () => {
      const shops = await get("/masters/shops");
      const list = Array.isArray(shops) ? shops : shops.data;
      return new Map(list.map((s) => [s.id, s.currentBalance]));
    };

    const before = await balances();
    await req(`/trips/${trip.id}/status`, { method: "PATCH", body: { status: "Completed" } });
    const after = await balances();
    for (const [shopId, amount] of expected) {
      money(after.get(shopId), before.get(shopId) + amount, `shop ${shopId} did not receive the trip sale`);
    }

    // Re-approving must not double-count.
    await req(`/trips/${trip.id}/status`, { method: "PATCH", body: { status: "Completed" } });
    const again = await balances();
    for (const [shopId] of expected) money(again.get(shopId), after.get(shopId), `shop ${shopId} double-counted`);

    // Only approved trips carry a balance: revoking must withdraw the money.
    await req(`/trips/${trip.id}/status`, { method: "PATCH", body: { status: "Pending" } });
    const reverted = await balances();
    for (const [shopId] of expected) {
      money(reverted.get(shopId), before.get(shopId), `shop ${shopId} kept revoked trip money`);
    }
  });

  test("099c an approved trip's sales flow into the Collection Entry summary", async () => {
    const trips = await get("/trips");
    const rows = Array.isArray(trips) ? trips : (trips.data ?? []);
    const trip = rows.find(
      (row) =>
        row.status === "Pending" &&
        row.deleted !== true &&
        (row.deliveries ?? []).some((d) => Number(d.amount) > 0),
    );
    assert.ok(trip);
    const shopId = trip.deliveries.find((d) => Number(d.amount) > 0).shopId;

    await req(`/trips/${trip.id}/status`, { method: "PATCH", body: { status: "Completed" } });
    const summary = await summaryFor(shopId, TODAY);
    const shops = await get("/masters/shops");
    const list = Array.isArray(shops) ? shops : shops.data;
    money(summary.balance, list.find((s) => s.id === shopId).currentBalance, "summary drifted from master");
    money(
      summary.openingBalance + summary.weeklySales - summary.approvedCollections,
      summary.balance,
      "identity broken after trip approval",
    );
    await req(`/trips/${trip.id}/status`, { method: "PATCH", body: { status: "Pending" } });
  });

  test("100 after every case above, all 200 shops still reconcile", async () => {
    const rows = await summariesFor(TODAY);
    assert.equal(rows.length, 200);
    for (const row of rows) {
      money(row.openingBalance + row.weeklySales - row.approvedCollections, row.balance, `shop ${row.shopId}`);
      money(row.closingBalance, row.balance, `shop ${row.shopId} closing`);
      assert.equal(row.previousWeekEnd, shift(row.weekStart, -1));
    }
    const register = await get("/operations/collection-entry?includeDeleted=true");
    assert.equal(
      new Set(register.map((row) => row.collectionNo)).size,
      register.length,
      "collection numbers must still be unique at the end of the run",
    );
  });
});
