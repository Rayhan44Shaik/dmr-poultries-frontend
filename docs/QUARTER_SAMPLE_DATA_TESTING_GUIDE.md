# DMR Poultries — Full-Quarter Sample Data & Module-by-Module Testing Guide

**Dataset source:** `scripts/quarter-sample-data.mjs`
**Synchronization audit:** `scripts/verify-quarter-sample-data.mjs` (`npm run verify:quarter-data`)
**Quarter:** a rolling **92-day window ending today** (Sundays off) — e.g. on
2026-09-12 the window is 2026-06-13 → 2026-09-12 and the label reads
"Quarter 3 — Jun to Sep 2026".
**"Today" inside the dataset:** today in Asia/Kolkata, so the today / this-week /
this-month tiles are always populated. Pin it for a reproducible capture with
`SAMPLE_TODAY=2026-09-11 npm run dev:sample-api`.

The dataset is a single standalone Node file that answers the same `/api/...`
contracts the frontend already calls, so every page renders with a full quarter
of data.

### Verify the data sync

```bash
npm run verify:quarter-data
```

The command starts a separate in-memory sample API on port `4301`, runs the
contract and reconciliation audit, then stops it. It never changes the API used
by `npm run dev`. Set `SAMPLE_VERIFY_PORT` if that port is unavailable.

The audit checks the dashboard/manifest quarter, canonical Shop Sales fields,
weekly Collection Entry and Pending Collections summaries, and the live
Operations hand-offs below:

- **Collection:** save → approve → amend → delete updates the master balance,
  pending total, shop ledger and dashboard collections together.
- **Shop Sales:** an allowed correction recalculates its amount and rolls into
  dashboard sales; locked fields still return the production-like validation.
- **Rate Entry:** Save & Lock moves every delivery exactly once into Shop Sales
  and removes that trip from the rate-entry queue.
- **Fuel:** a pending bill affects dashboard expense only after approval and is
  removed from the totals on delete.

### Initial frontend wiring fixes

Three places previously **ignored the API on purpose**, so data alone could not
reach them. Each was a pass-through/flag change only:

| File | Change | Why |
|---|---|---|
| `operations/dashboard/services/dashboardService.ts` | The response mapper hardcoded `trendData: []`, `topShops: []`, `collectionsByMode: []`, `recentTrips: []`, `activeVehicles: 0`, … Now it passes those fields through when the API supplies them (`?? []` / `toNumber`). | Dashboard KPIs worked but **every chart and panel was blank by construction**. A backend that returns only KPIs still behaves exactly as before. |
| `operations/orders/sampleOrdersData.ts` | `ORDERS_SAMPLE_DATA_ENABLED: true → false` | The Orders page ran entirely on bundled sample rows and made **no network call**. The quarter dataset now supplies the `[ORDER]` collection containers. |
| `accounts/pages/PaymentBookPage.tsx` | `useState(import.meta.env.DEV)` → `useState(false)` | Payment Register always opened in bundled demo mode in dev, hiding the real 662 payments. The demo toggle still exists as a manual fallback. |

`tsc -p tsconfig.app.json --noEmit` reports **no new errors** (only the
repository's pre-existing unused-import warnings).

### Quarter-data sync pass — every page now reads the dataset, and the books tie out

A verification sweep of every nav page against the running sample API found seven
places where the dataset and the page had drifted apart. All of them are data /
pass-through fixes — no business rule, layout or validation was touched.

| Where | Was | Now |
|---|---|---|
| `scripts/quarter-sample-data.mjs` · `tripsIn()` | ORD-* order containers were counted as trips, so a phantom `0` driver (Driver Performance, 30 rows) and a phantom `0` vehicle (Vehicle Analytics, 25 rows) appeared, and trips were over-counted by 8 | Containers are excluded from every aggregation, exactly like `/operations/trip-list` and Recent Transit already did → 29 drivers, 24 vehicles, trip counts match Trip List |
| `scripts/quarter-sample-data.mjs` · `/operations/collection-entry/pending-summary` | Returned `{ data, rows, totalPending, shops: <count> }` — the page reads `shops[]` + `totals`, so the Pending Collections table (200 shops) rendered "No shops found" with ₹0 KPIs | Returns the documented contract: `{ weekStart, weekEnd, shops: [{ balance, weeklySales, weeklyApprovedCollections, weeklyPendingCollections, recoveryPercentage, overdueDays, hasPendingCollections, lastCollectionDate }], totals }` → 197 shops, ₹1.16 Cr outstanding, ₹9.02 L week collections |
| `scripts/quarter-sample-data.mjs` · `PAYMENTS` | Only `Approved` / `Paid`, so the Payment Register's default **Pending** view (which filters `Draft`) showed "No payments found" | Lifecycle is now Draft → Approved → Paid (3 open drafts in the last two days), so the register's Pending tab and the shell's "payments to approve" bell resolve against the same rows |
| `scripts/quarter-sample-data.mjs` · Shop Sales rows | Emitted internal field names only (`tripDate`/`totalBirds`/`totalWeight`/`remark`), so the Shop Sales page — which maps the PostgreSQL contract — showed Day `—`, Weight `0.00` and an empty Remark next to correct amounts | Rows carry both spellings, plus `saleDate`, `vehicleNo`, `farmName`, `deleted`, `approvedAt` and the correction-window fields; `PUT /operations/shop-sales/:id` is implemented (10-day window, 409 outside it, amount recomputed and the shop balance/ledger kept in step) |
| `scripts/quarter-sample-data.mjs` · `attendanceSummary()` / `fleetAnalytics()` | Roster gaps were reported as `absentDays` (70 salary rows disagreed with the attendance summary) and a range-independent flat 3 × EMI was added to every fleet range (a 2-day range carried a quarter of the loan) | Attendance follows the salary rule (`presentDays = workingDays − approved leave`, `absentDays` stays 0 and roster gaps are reported as `unassignedDays`), and EMI counts only the installments that fall **due inside the range** |
| `fleet-operations/hooks/useAnalyticsData.ts` · `analytics.ts` | The mapper rebuilt the vehicle table from the top-5 list and hard-coded `trips: 0` / `emiCost: 0`, so Vehicle Analytics showed 19 of 24 vehicles with zero trips and 91.6 % of the cost pie as EMI | The payload's full `vehicleStats` rollup is rendered as-is (24 vehicles, real trips and EMI share); the top-5 fallback remains for payloads that do not ship it |
| `approvals/services/approvalSnapshot.ts` | In dev it swapped the payments queue for the bundled demo rows, so the bell disagreed with the register | Reads the real `/accounts/payments` list in every environment |

Verification (live, both processes up): 17/17 cross-module checks pass — shop
balance closes across Masters → Shop Ledger → Pending Collections; trip → sale →
ledger; trip diesel → Fuel Expenses (litres × rate = trip amount); trip
mortality → Mortality Analysis; roster → salary days for Jul/Aug/Sep; leaves →
salary leave days; fleet cost centres sum to the fleet total (100 %); dashboard
KPIs equal the Collection Report and pending-summary totals; driver/vehicle
performance trip counts equal the Trip List.

### Masters paged envelope — fixes `Cannot read properties of undefined (reading 'map')`

The Masters tabs do **not** consume the plain master arrays. `useMasterRecords`
calls the same path with query params and reads a **paged envelope**:

```ts
const { data } = await apiGet<PageResult>(config.path, { params: query });
items = data.items.map(config.map);        // ← bare array ⇒ data.items undefined ⇒ crash
setTotal(data.total); setPage(data.page); setFacets(data.facets);
```

Because the dataset returned a bare array, `data.items` was `undefined` and every
Masters tab threw and rendered no rows. The server now returns:

```json
{ "items": [...], "total": 200, "page": 1, "pageSize": 10, "totalPages": 20,
  "facets": { "city": [...20], "department": [...7], "role": [...], "status": [...] } }
```

…whenever the request carries `page`+`pageSize` (or `export=true`), and the
**plain array otherwise** — so dropdowns, Trip Entry, Orders and the reports that
call `loadShops()` / `loadVehicles()` keep working unchanged.

Server-side support, matching the toolbar exactly:

- **Search** across every meaningful column per master (shop no/name/owner/phone/city/address…, employee name/dept/role/licence, vehicle number/type/engine/chassis, etc.)
- **Filters** — `status`, `city` (Shops), `department` (Employees)
- **Sort** — Number / Name / Status, with `direction=asc|desc`
- **Pagination** — real slicing, out-of-range pages clamp to the last page
- **Facets** computed over the WHOLE master (not the current page), so the Shops **city** dropdown shows all 20 cities and Employees **department** all 7 — deduped case-insensitively and sorted
- **`export=true`** returns every matching row for the Export action

Verified: Shops 200 (20 pages), Employees 150, Farms 10, Vehicles 24, Banks 8,
Bird Types 5; `search=Balaji` → 8, `status=Inactive` → 8, `city=Guntur` → 10,
`department=Driver` → 30, search+city combined → 3, export → full set.

---

## 1. How to run

```bash
# Terminal 1 — sample data API (port 4000, the Vite proxy target)
node scripts/quarter-sample-data.mjs

# Terminal 2 — frontend
npm run dev
```

Open the app, log in with anything (auth is stubbed), and every page is populated.
Health check: `GET /api/quarter-summary` returns the full row-count manifest.

---

## 2. What the quarter contains

| Entity | Volume | Notes |
|---|---|---|
| Shops | **200** | `SHP-001…SHP-200`, 20 cities, 4 association types, 8 inactive, opening balances |
| Employees | **150** | Driver 30, Supervisor 25, Helper 30, Loader 25, Collection 20, Office 10, Mechanic 10 |
| Farms | **10** | `FRM-01…FRM-10`, capacity 3k–12k, owner + supervisor + GPS address |
| Vehicles | 24 | 12 financed (EMI), 4 body types, per-vehicle odometer continuity |
| Banks / Bird types | 8 / 5 | Broiler, Country, Layer, Giriraja, Kadaknath |
| Market rates | 92 days | One row per calendar day, all 13 rate columns |
| Trips | **632** | 8 per operating day; Draft at every wizard step, Pending, Completed, Deleted |
| Delivery lines | **6,059** | 8–18 shops per trip, per-box + per-weight modes, mortality, rates |
| Collections | **4,881** | 45–75/day, 3 payment modes, 20 collectors, approved + pending |
| Fuel bills | 606 | Trip-linked (Step 5 diesel) + 120 manual bills, Approved/Pending/Rejected |
| Maintenance | 307 | 10–16 per vehicle, multi-type jobs with per-type next-service KM |
| Permits | 120 | 5 doc types × 24 vehicles, expiries spread across expired/expiring/safe |
| EMI schedules | 12 | Full installment ledgers, active / overdue / paid |
| FASTag | 24 tags + 600 txns | good / low / critical balances |
| Payments | 662 | 7 payment types, 5 modes |
| Farmer payments | 471 | One per completed trip, Paid + Pending mix |
| Salary rows | **450** | 150 employees × Jul/Aug/Sep — Paid, Submitted, Pending |
| Leaves | 356 | 4 types × Approved/Pending/Rejected/Cancelled |
| Duty assignments | 13,340 | Full 13-week roster, all 150 staff, every day |

All values come from a seeded PRNG → **identical on every restart** for a given
anchor date, so screenshots and expectations stay stable. Because the window
follows today's date, exact row counts drift a little day to day (the table above
was captured with the anchor on 2026-09-11); the shape — every module populated,
books tying out — does not. Pin the anchor with `SAMPLE_TODAY=2026-09-11` to
reproduce the numbers in this guide exactly. Books tie out: shop balance =
opening + sales − collections.

---

## 3. Module-by-module verification — check every page

### 3.1 Overview

| Page | Route | What to verify |
|---|---|---|
| Dashboard | `/dashboard` | **KPI tiles** (whole quarter, captured on the 2026-09-11 anchor): 633 trips, ₹4.81 Cr sales, ₹4.04 Cr collections, ₹1.69 Cr pending, expenses ₹59.1 L (fuel ₹22.3 L + trip ₹12.3 L + maintenance ₹24.4 L). **Panels (all populated):** Operational Trends line chart = up to 30 daily points (trips / weight / mortality); Outstanding Balances = top 10 shops; Collection Streams pie = Cash / Union Bank / HDFC; Recent Transit table = 10 latest trips with vehicle, driver, weight, status; Active Fleet counts = 22 vehicles, 29 drivers, 29 helpers, 192 shops, 10 farms. Today / this-week / this-month tiles are anchored on the dataset's "today" and stay constant as you change the range; the rest of the KPIs are aggregated by the sample API for the exact range you pick, so changing the date range re-aggregates trips, sales, collections and expenses. An amber **Sample data** banner names the quarter window whenever the sample API is the source. |

### 3.2 Masters — `/masters`

| Tab | Route | Checks |
|---|---|---|
| Shops | `?tab=shops` | 200 rows across **20 pages** — page through to `SHP-200`; change rows-per-page; **Sort by** Number / Name / Status; search "Balaji" (8 hits); **City** dropdown lists all 20 cities → pick Guntur (10 rows); Status filter → Inactive (8); combine search + city; Reset filters; open a row → owner, 2 phones, WhatsApp, GPS lat/long, association type, opening + current balance; Export to Excel (all 200). |
| Farms | `?tab=farms` | 10 rows; capacity column 3,000–12,000; each has supervisor + full address. |
| Vehicles | `?tab=vehicles` | 24 rows; box counts 40/48/56/64; insurance / permit / fitness expiry columns; 12 rows carry purchase amount + EMI fields. |
| Employees | `?tab=employees` | 150 rows across 15 pages; **Department** dropdown lists all 7 → Driver (30), Supervisor (25), Helper (30), Loader (25), Collection (20), Office (10), Mechanic (10); search "Kumar" (50 hits); sort by Number/Name/Status; drivers carry licence numbers; salary column populated; 5 inactive; Export all 150. |
| Banks | `?tab=banks` | 8 rows with IFSC, account no, UPI id. |
| Bird Types | `?tab=birdTypes` | 5 rows with average weight + description. |
| Market Rates | `/accounts?tab=market-rate` | 92 daily rows; scroll Jul → Sep; all 13 columns (vij, gun, rp, sneha, vencob×3, association, c17…c10) populated; date-range filter. |

### 3.3 Operations — `/operations`

The Overview opens on the exact rolling 92-day sample window. Its **Quarter
Operations Map** reconciles the page-level row counts in one place and links
straight to each register. On the 2026-09-15 anchor it reads: 632 Trip List
records, 85 Rate Entry trips, 6,728 Shop Sale lines, 4,755 collections, 197
shops with dues, 524 completed mortality trips, 738 fuel bills and 8 order-day
plans. Changing the calendar re-scopes the dated counts; outstanding shops stays
a live carried-balance count, matching the Pending Collections KPI.

| Tab | Route | Checks |
|---|---|---|
| Operation Dashboard | `?tab=overview` | Defaults to the whole sample quarter. All KPI/chart/panel values and the Quarter Operations Map use the same range. Change the date range to a single month → dated totals/counts shrink accordingly. Active Ecosystem shows real used/active ratios (the quarter exercises all 10 farms), never `0 / total`. |
| Trip Entry | `?tab=trip-entry` | Step 1 dropdowns: 23 vehicles, 29 drivers, 24 supervisors, 29 helpers, 24 loaders. Last-meter hint resolves per vehicle. Recent Trips shows Drafts parked at Steps 1/2/3/4 (dated 2026-09-11 and the 3 days after) → "Resume Step N" for every step. |
| Trip List | `?tab=trip-list` | 632 rows; filter each status: Completed (bulk), Pending, Draft, Deleted (~10). Open a Completed trip → all 5 steps filled: staff, farm + GPS, DC weight + box details, deliveries, diesel + expenses + mileage. |
| Rate Entry | `?tab=rate-entry` | Every delivery-submitted trip listed; open one → 8–18 shop lines, each with market-rate reference (master / last trip / avg + sample count) and a 4-day market-rate window. Completed trips show rate-locked state with lock timestamp. |
| Shop Sales | `?tab=shop-sales` | 6,059 sale lines with `TRP-xxxxx-Sxxx` numbers; date filter; shop search; rows within 10 days of 2026-09-11 are editable, older rows show "Editing period has expired." |
| Collection Entry | `?tab=collection` | Shop picker (200 shops); recent-collections panel per shop; week bounds resolve to the current sample week. |
| Pending Collections | `?tab=pending-collections` | 200 shop rows sorted by outstanding; total ≈ ₹1.69 Cr; each row shows total sales, total collected, last collection date and overdue days. |
| Weight Loss / Mortality | `?tab=mortality` | KPI strip (farm birds, delivered birds, mortality %, weight loss %); farm + supervisor dropdowns populated from real data; sort every column; expand a trip → shop-wise mortality lines. |
| Fuel Expenses | `?tab=fuel-expenses` | 738 bills on the 2026-09-15 anchor, paginated; the KPI strip is visible on the unfiltered quarter and totals **all filtered pages** (it does not change on page 2). Filter TRIP vs MANUAL and Approved / Pending / Rejected; trip-linked rows carry trip no, meter, GPS and mileage. |
| Orders | `?tab=orders` | Now reads the live API (bundled sample mode switched off). **8 `[ORDER]` collection containers** (one per each of the last 8 operating days, 20–36 shops each): all eight fit inside the ten-calendar-day selector window, including the Sunday closure. The newest is still *in collection* (Tab 1 working order), the other 7 are *collected* and available in Tab 2, where **9 vehicle trips** are assignment-eligible (Step 2 done, Step 4 open). Tab 3 Delivery Tracking is driven by the captured Step 4 rows. |
| Collection Report | `?tab=collection-report` | Payment-mode summary (Cash / Union Bank / HDFC) with % split; collector summary for all 20 collectors; change date range Jul→Sep and confirm totals move. |

### 3.4 Vehicles / Fleet — `/fleet`

| Tab | Route | Checks |
|---|---|---|
| Maintenance Entry | `?tab=entry` | Vehicle + driver + mechanic dropdowns populated; odometer hint from meter-summary. |
| Maintenance List | `?tab=history` | 307 records; multi-type jobs (e.g. "Tyre Rotation, Wheel Alignment") each with its own next-service KM; ~44 pending-approval rows; parts table with quantity/rate/amount. |
| Permits & Documents | `?tab=permits` | 120 records across insurance/fitness/permit/puc/rc; summary buckets show expired, expiring (≤30 days) and safe counts; half the records have an attached scan. |
| EMI | `?tab=emi` | 12 financed vehicles; open a schedule → full installment ledger with paid/pending per month; statuses active, overdue and paid all present. |
| FASTag | `?tab=fastag` | 24 tags with good/low/critical balance badges; 25 toll transactions each. |
| Vehicle Analytics | `?tab=analytics` | KPIs: total distance, avg mileage, litres, fuel/maintenance/EMI/toll/other cost, cost-per-km. 13 weekly points for fuel + mileage charts; cost-center pie sums to 100%; top-5 performers and top-5 highest-expense tables. |

### 3.5 Staff — `/staff`

| Tab | Route | Checks |
|---|---|---|
| Duty Planner | `?tab=duty-planner` | Full Mon–Sun grid for the current sample week; every active employee has a duty each day; Saturday panel shows required vs assigned vs shortage by role; navigate back across all 13 weeks of the quarter. |
| Salary Register | `?tab=salary-sheet` | Switch months: **2026-07** and **2026-08** fully Paid + closed, **2026-09** mixed Submitted/Pending with a 10-day correction window. 150 rows/month; gross = basic + OT + incentives + fuel + night; deductions include leave, advance, loan EMI, late penalty; working/present/leave/weekly-off days derived from the roster. Generate a payslip PDF. |
| Leaves | `?tab=leaves` | 356 requests; filter each status and all 4 types; monthly leave report per employee with dates and types. |
| Driver Performance | `?tab=driver-performance` | 29 driver rows; KPIs for trips, distance, mileage, cost/km; weekly chart; click a driver → per-vehicle breakdown + last 12 trips. |
| Supervisor Performance | `?tab=supervisor-performance` | 24 supervisor rows; trips, shops, birds, weight, mortality rate, weight loss; weekly chart; drill into recent trips. |

### 3.6 Accounts — `/accounts`

| Tab | Route | Checks |
|---|---|---|
| Analysis | `?tab=summary` | Quarter totals: sales ₹4.81 Cr, collections ₹4.04 Cr, pending ₹1.69 Cr, payments, farm payable ₹1.30 Cr, fuel ₹22.3 L, maintenance ₹24.4 L, salary ₹1.22 Cr. |
| Payment Register | `?tab=paid-payments` | Now opens on live data (demo default switched off): **662 payments**; filter by all 7 types and 5 modes; search by payee; Paid vs Approved statuses. |
| Farmer Payments | `?tab=farm-payment` | 471 rows, one per completed trip, with DC weight × rate = amount; ~1/3 Pending with balance, rest Paid with reference no; trip-history modal per farm. |

### 3.7 Reports — `/reports`

| Tab | Route | Checks |
|---|---|---|
| Shop Ledger | `?tab=shopLedger` | Pick any of the 200 shops → chronological sale (debit) and collection (credit) rows with a **running balance** that ends exactly at the shop's current balance in Masters. Opening balance shown for the range. Try "all shops" and a custom Jul→Sep range. |
| Collection Report | `/operations?tab=collection-report` | As in Operations above. |
| Vehicle Analytics | `/fleet?tab=analytics` | As in Fleet above. |

### 3.8 Settings & Mobile

| Page | Route | Checks |
|---|---|---|
| System Settings | `/settings?tab=appearance` | Theme/appearance toggles (no data dependency). |
| Supervisor Mobile | `/mobile`, `/mobile/trips` | Bootstrap returns user + all masters; trip list returns the last 7 days of trips for offline/queue testing. |

---

## 4. Cross-module consistency checks (the real proof)

1. **Shop balance closes:** Masters → Shops current balance == Reports → Shop Ledger final running balance == Pending Collections outstanding for that shop.
2. **Trip → Sale → Ledger:** open a Completed trip, note `TRP-xxxxx`; find its lines in Shop Sales (`TRP-xxxxx-S001…`); find the same amounts as debits in that shop's ledger.
3. **Trip → Fuel:** Step 5 diesel of a trip appears as a TRIP-sourced bill in Fuel Expenses with the same litres, rate, meter and GPS.
4. **Trip → Mortality:** trip mortality totals match the Weight Loss/Mortality row and its expanded shop lines.
5. **Roster → Salary:** an employee's approved leave days in Leaves match `leaveDays` on their salary row, and present days = working − leave.
6. **Vehicle odometer:** trip closing meters increase monotonically per vehicle and feed the fleet meter summary + maintenance current-KM.
7. **Fleet cost roll-up:** Analytics fuel + maintenance + EMI + toll + other == total expense, and cost centers sum to 100%.

---

## 5. Notes / limits

- Writes (POST/PUT/PATCH/DELETE) are held in memory for the current sample-server session; the related Operations, master, ledger, Accounts and dashboard endpoints re-aggregate immediately. Restarting the server restores the pristine deterministic dataset.
- Auth is stubbed: any credentials log you in as Owner with all permissions.
- To move the quarter, edit the `QUARTER` constant and `TODAY` at the top of `scripts/quarter-sample-data.mjs`; everything else regenerates from those two values.

---

## 6. Sync verification — every navigation page hits the dataset

Run with both processes up; each returns HTTP 200 with the row count shown.

| Nav page | Endpoint | Rows |
|---|---|---|
| Dashboard | `/api/operations/dashboard` | KPIs + all panels + 8-field Operations module map |
| Masters → Shops / Farms / Vehicles / Employees / Banks / Bird Types | `/api/masters/*` | 200 / 10 / 24 / 150 / 8 / 5 |
| Masters → Market Rates | `/api/masters/market-rates` | 92 |
| Operations → Trip List / Trip Entry | `/api/trips`, `/api/trips/available-resources` | 640 total rows (632 vehicle trips + 8 order containers) / 5 groups |
| Operations → Rate Entry | `/api/operations/rate-entry` | 85 waiting trips |
| Operations → Shop Sales | `/api/operations/shop-sales` | 6,728 |
| Operations → Collection Entry / Report / Pending | `/api/operations/collection-entry*` | 4,755 / summary / 200 |
| Operations → Mortality | `/api/operations/mortality-analysis` | paged 524 completed trips |
| Operations → Fuel Expenses | `/api/operations/fuel-expenses` | paged 738 bills + full-filter summary |
| Operations → Orders | `/api/trips` (containers) | 8 containers + 9 assignable trips |
| Fleet → Maintenance / Permits / EMI / FASTag / Analytics | `/api/fleet/*` | 307 / 120 / 12 (36-installment schedules) / 24 / 11 KPI blocks |
| Staff → Duty Planner / Salaries / Leaves / Driver / Supervisor | `/api/staff/*` | week grid / 150 per month / 356 / 30 / 25 |
| Accounts → Payments / Farmer Payments / Analysis | `/api/accounts/*` | 662 / 471 / 9 totals |
| Reports → Shop Ledger | `/api/operations/shop-ledger?shopId=5` | 60 rows with running balance |
