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
contract and reconciliation audit (93 checks), then stops it. It never changes
the API used by `npm run dev`. Set `SAMPLE_VERIFY_PORT` if that port is
unavailable.

The audit checks the dashboard/manifest quarter, canonical Shop Sales fields,
weekly Collection Entry and Pending Collections summaries, the Staff module
sync (see below), and the live Operations hand-offs below:

- **Collection:** save → approve → amend → delete updates the master balance,
  pending total, shop ledger and dashboard collections together.
- **Shop Sales:** an allowed correction recalculates its amount and rolls into
  dashboard sales; locked fields still return the production-like validation.
- **Rate Entry:** Save & Lock moves every delivery exactly once into Shop Sales
  and removes that trip from the rate-entry queue.
- **Fuel:** a pending bill affects dashboard expense only after approval and is
  removed from the totals on delete.
- **Staff:** the current-week duty grid rosters every active employee; the
  Salary Register's Working / Present / Leave / Weekly-Off columns equal the
  attendance summary and the Leaves monthly report; approving a leave during
  the session re-derives the open month's salary row (Pending money recomputes,
  Submitted/Paid rows stay frozen) and rejecting restores it; queueing a
  payslip Email/WhatsApp increments the row's per-channel delivery counter;
  Driver/Supervisor Performance rows sum exactly to their KPI trip counts.

### Staff-module quarter-data sync pass

A dedicated sweep of the five Staff pages against the running sample API found
three places where the dataset and the pages had drifted apart. All are data /
pass-through fixes — no business rule, layout or validation was touched.

| Where | Was | Now |
|---|---|---|
| `staff/services/salaryService.ts` · `mapSalary()` | The mapper dropped `emailsSent` / `whatsappsSent`, so the register's per-row Email / WhatsApp delivery indicators always rendered `0` even though the API supplied real counts | Both fields pass through (`maybeNum`, camel + snake spellings); rows without them render exactly as before (`?? 0`) |
| `scripts/quarter-sample-data.mjs` · `/staff/salaries/email` + `/whatsapp` + `/submit-month` | The queue endpoints answered `{ sent, failed }` but never touched the rows, so a successful send disappeared on the next refresh, and unknown ids were still counted as `sent` | Each queued payslip increments the row's `emailsSent` / `whatsappsSent` (Submit & Send queues one email per newly submitted row); unknown ids are reported in `failed` |
| `scripts/quarter-sample-data.mjs` · `/staff/salaries` (GET) + `/salaries/summary` | Salary day-counts were frozen at generation time, so a leave approved during the session updated the attendance summary and Leaves report but not the register — the three Staff pages disagreed | The open month re-derives Working / Present / Leave / Weekly-Off from the live attendance summary on every read; Pending rows also recompute the leave deduction and net (first leave day free, same rule as generation), Submitted/Paid money stays frozen per the lifecycle, and closed months are never touched |

Verification (live): salary ↔ attendance ↔ leave-report tie out for all three
months with zero mismatches; approve → reject a leave round-trips the salary
row; performance rows sum to their KPIs; the duty grid covers Mon–Sun for all
active staff across all 13 quarter weeks (the current + next week intentionally
keep a few unassigned cells for the auto-assign demo).

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

### Orders hand-off pass — the quarter now carries collection → assignment → tracking

The Orders module reads its three tabs from one feed (`/trips?full=true`): a
**container** is a vehicle-less trip whose rows carry `[ORDER]`, and an
**assignment** is a vehicle row carrying `[ORDER] O:<containerTripNo>`. The
dataset only seeded the containers, so Tab 1 rendered but **Tab 2 always read
`0 assigned` and Tab 3 was empty** ("0 trips / No pending deliveries") — a page
that could never show the quarter's real data until someone worked the whole
flow by hand. The generator now seeds the same hand-off the UI produces.

| What the dataset now carries | Detail |
|---|---|
| Plan rows | Every container row carries the shop's **city** (`village`) and the container carries `avgBirdWeight` (2.3), so the CITY and **WEIGHT** columns fill in before a vehicle is picked |
| Assignment history | Each older container is assigned to the vehicle trip(s) that actually ran the **next operating day** — 8 order-tagged trips, 162 assigned rows, one shop per order deliberately **part-delivered** so `Part Delivered` badges are reachable |
| In progress | Yesterday's finished collection is part-delivered on a trip that is still `Pending` → Tab 3's **PENDING & IN PROGRESS** table has a real row (5 shops, 19 boxes, 437 kg) |
| Still available | Yesterday's remaining 23 shops and today's in-collection order (23 of 27) stay unassigned → Tab 2 has work to do; 4 of today's shops already sit on a vehicle (Step 4 open) |
| Busy-history integrity | A completed trip absorbs those shops into its own load (`dcWeight`/birds/boxes), so `dcWeight − delivered − mortality` (**weight loss**) stays positive; Draft/Pending trips keep their pickup figures |
| Tracking history | 7 Completed order trips inside the default 7-operating-day window, with the totals strip (`Total Shops 138 · Birds 5,160 · Boxes 516`) summing exactly those rows |

Data-quality fixes in the same pass:

| Where | Was | Now |
|---|---|---|
| `scripts/quarter-sample-data.mjs` · delivery rows | The bird-balance reconciler could consume a trailing row entirely, leaving **37 junk "0 birds / ₹0" lines** in Shop Sales, Step 4 and the mortality drills | Empty rows (0 birds **and** 0 kg **and** no mortality) are dropped and serial numbers renumbered; a row that still carries mortality is kept — it is the only record of those birds dying in transit, and dropping it broke `pickup = delivered + mortality` |
| `scripts/quarter-sample-data.mjs` · `materializeTripSales()` | Approving a trip whose Rate Entry is still open wrote ₹0 / "₹0.00" sale lines | Sales are materialized only for deliveries that have a rate; locking Rate Entry (which applies every rate first) still materializes the whole trip exactly once |
| `scripts/quarter-sample-data.mjs` · today's lifecycle mix | All 8 of today's trips were Draft/Pending, so "Today" read **0** in the trend chips and today's weight/mortality/sales were all zero | Today's first dispatch is Completed + rate-locked (today's trend point = 5,088 kg, mortality row, Shop Sales and mortality register all populated), the second stays Pending for the rate-entry queue, and Steps 4/4/3/2/1 keep every wizard state reachable |
| `orders/components/OrdersCollectionTab.tsx` · WEIGHT | Required an assignment before it printed anything → the whole column read `—` | Uses the vehicle's average bird weight when the row is assigned, the day's collection average before that (`formatKg`, the module's own helper) |
| `orders/components/OrdersAssignmentTab.tsx` · WEIGHT | Same `—` column while planning | Weight basis = selected vehicle's average, else the day's average; unit now goes through `formatKg`, so both tables read `115.00 KG` |
| `shop-sales/utils/shopSaleFormat.ts` · `formatSaleAmount()` | `₹7,230`, `₹6,787.5`, `₹15,351` — mixed scales inside a money column that sits next to `₹125.00` | Fixed two decimals (`₹7,230.00`) with the unit test updated |

`scripts/verify-quarter-sample-data.mjs` now audits the hand-off itself
(**101 API checks**): containers match the Operations map's Orders count, every
plan row carries birds/boxes/city, assigned boxes never exceed the ordered
boxes, one order is fully placed and one is still open, no assigned row is
duplicated across vehicles, Delivery Tracking has both a Pending and a
Completed order trip, every tracked row carries delivered birds/weight, and no
trip's delivered weight exceeds its dispatched load.

Still open (frontend-only, noted for a later pass): `OrdersAssignmentTab`
accepts a `dayVehicleViews` prop (the per-day, per-vehicle assignment
breakdown) and never renders it, so the day history is only visible through the
shop rows themselves.

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
| Orders | `?tab=orders` | Now reads the live API (bundled sample mode switched off). **8 `[ORDER]` collection containers** (one per each of the last 8 operating days, 20–36 shops each): all eight fit inside the ten-calendar-day selector window, including the Sunday closure. The newest is still *in collection* (Tab 1 working order, 27 shops · 92 boxes · 920 birds) and shows the shop's **city** plus the **ordered weight** per row. Tab 2 opens on `27 collected · 4 assigned · 23 available` against **6 eligible vehicles** (Step 2 done, Step 4 open) — one of them already carries 4 shops — and every earlier day shows its read-only assignment history. Tab 3 lists **1 trip in PENDING & IN PROGRESS** (5 shops, 19 boxes, 437 kg) and **7 COMPLETED** order trips with `Delivered` / `Part Delivered` badges inside the default From → To window. |
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
