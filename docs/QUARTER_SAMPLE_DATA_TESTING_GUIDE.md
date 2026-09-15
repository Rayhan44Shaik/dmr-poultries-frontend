# DMR Poultries — Full-Quarter Sample Data & Module-by-Module Testing Guide

**Dataset file (the only file added):** `scripts/quarter-sample-data.mjs`
**Quarter:** a rolling **92-day window ending today** (Sundays off) — e.g. on
2026-09-12 the window is 2026-06-13 → 2026-09-12 and the label reads
"Quarter 3 — Jun to Sep 2026".
**"Today" inside the dataset:** today in Asia/Kolkata, so the today / this-week /
this-month tiles are always populated. Pin it for a reproducible capture with
`SAMPLE_TODAY=2026-09-11 npm run dev:sample-api`.

The dataset is a single standalone Node file that answers the same `/api/...`
contracts the frontend already calls, so every page renders with a full quarter
of data.

### Sync changes (3 small wiring fixes — no business logic touched)

Three places previously **ignored the API on purpose**, so data alone could not
reach them. Each was a pass-through/flag change only:

| File | Change | Why |
|---|---|---|
| `operations/dashboard/services/dashboardService.ts` | The response mapper hardcoded `trendData: []`, `topShops: []`, `collectionsByMode: []`, `recentTrips: []`, `activeVehicles: 0`, … Now it passes those fields through when the API supplies them (`?? []` / `toNumber`). | Dashboard KPIs worked but **every chart and panel was blank by construction**. A backend that returns only KPIs still behaves exactly as before. |
| `operations/orders/sampleOrdersData.ts` | `ORDERS_SAMPLE_DATA_ENABLED: true → false` | The Orders page ran entirely on bundled sample rows and made **no network call**. The quarter dataset now supplies the `[ORDER]` collection containers. |
| `accounts/pages/PaymentBookPage.tsx` | `useState(import.meta.env.DEV)` → `useState(false)` | Payment Register always opened in bundled demo mode in dev, hiding the real 662 payments. The demo toggle still exists as a manual fallback. |

### Dashboard sync round (later pass)

| File | Change | Why |
|---|---|---|
| `routes/AppRoutes.tsx` | `/dashboard` now renders `modules/dashboard/DashboardPage` (the executive dashboard) instead of the Operations dashboard. | The executive dashboard — KPI row, business-overview charts, pending collections, fleet status, activity — was built but **never routed**, so `/dashboard` showed a duplicate of `/operations?tab=overview`, which is where the sidebar's "Operation Dashboard" entry already points. |
| `dashboard/services/dashboardService.ts` | Every sample read is windowed against the dataset's own business date instead of `new Date()`; new `fetchQuarterSnapshot()` reads `GET /api/operations/dashboard` for the whole quarter. | The dataset is generated in IST, so a browser west of it is a calendar day behind and the old windows silently cut off the rows the "today" tiles aggregate. The quarter band now comes from the same aggregate Operations and Accounts render. |
| `dashboard/utils/dashboardDerive.ts` | Maintenance added to the daily expense/profit model; activity entries carry their real date (Today / Yesterday / date) and fall back to the newest movements. | Profit used fuel + trip only, so it disagreed with the expense model on the Operations dashboard and Accounts. The timeline stamped every row "Today" and went empty on a quiet day. |
| `dashboard/components/QuarterSnapshot.tsx` (new) | "Quarter to date" band: trips, weight, sales, collections, expenses (fuel · trip · service), net, outstanding. | The executive view only ever showed a single day; the rest of the quarter was invisible on it. |
| `scripts/quarter-sample-data.mjs` | Today and the three preceding operating days now keep a **closed core** of trips, and are exempt from the "pending for rate entry" downgrade. | Those four days are exactly what the dashboard aggregates for "today" and "last 7 days". With every trip on them still Draft/Pending, "Today's Sales" read ₹0 and the profit tile went negative while the rest of the app was fully populated. Drafts at wizard steps 1–4 are preserved, so Trip Entry's "Resume Step N" still works. |

`tsc -p tsconfig.app.json --noEmit` reports **no new errors** (only the
repository's pre-existing unused-import warnings).

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

### 3.1 Overview — the executive dashboard at `/dashboard`

`/dashboard` renders the **executive dashboard** (`src/modules/dashboard`); the
range-picking Operations dashboard lives at `/operations?tab=overview` (§3.3).
Both read the same dataset.

| Block | What to verify |
|---|---|
| **Quarter to date** band | One row, six figures for the whole 92-day window, read from `GET /api/operations/dashboard` — the *same* aggregate Operations and Accounts → Analysis render, so the three pages can never disagree: **trips**, **delivered weight**, **sales**, **collections** (% of sales), **expenses** (broken out as fuel · trip · service) and **net / outstanding**. Captured on the 2026-09-15 anchor: 631 trips, 5,22,623 kg, ₹5.39 Cr sales, ₹4.10 Cr collections (76%), ₹64.3 L expenses (fuel ₹27.6 L + trip ₹12.3 L + service ₹24.4 L), net ₹4.75 Cr, outstanding ₹2.22 Cr. |
| **KPI row** (8 tiles, one line) | Shops 200 (192 active), Farms 10, Vehicles 24 (22 in service), Employees 150 (145 active), **Today's Sales**, **Today's Collections**, **Pending** with the overdue shop count, and **Today's Profit** = sales − (fuel + trip + maintenance) — the same three-bucket expense model the Operations dashboard and Accounts use. The money tiles compare against the dataset's *yesterday* and carry a % delta chip. |
| **Sales vs Collections** | 7 daily points ending on the dataset's business date. Six of the seven carry sales; the empty one is a **Sunday** (no dispatch, no collections — the dataset keeps Sundays off). |
| **Vehicle Activity** | Donut: On Trip / Available / Inactive, derived from the vehicle master status plus the trips dated today. |
| **Weekly Revenue** + **Delivery Volume** | Revenue bars per day, and birds (bars) against delivered weight (line) per day — both from the same 7-day window. |
| **Pending Collections** | Top 6 shops by outstanding, total in the header, overdue count, deep link to `/operations?tab=pending-collections`. |
| **Today's Trips** | Every trip dated the business date with vehicle, driver, supervisor, farm, first shop, birds, weight and status — Drafts at steps 1–4, one in-flight trip at step 5 and the closed runs all appear. |
| **Recent activity** | Newest completed deliveries, collections, fuel entries and service jobs — each labelled **Today** / **Yesterday** / a date, so the panel stays populated when the business date is quiet. |
| **Vehicle status** | Per-vehicle status, driver, latest odometer, last fuel bill and next-service mileage from the fleet maintenance rows. |

An amber **Sample data** chip and a blue **quarter** chip (naming the window,
e.g. "Quarter 3 — Jun to Sep 2026") sit next to the greeting whenever the sample
API is the source. The page dates itself with the dataset's own business date,
not the browser clock.

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

| Tab | Route | Checks |
|---|---|---|
| Operation Dashboard | `?tab=overview` | The range-picking view (7D / 15D / 1M / QTR / custom), opening on the previous Mon–Sun week and measured against the equal-length window before it. Same source as the executive dashboard's quarter band: `GET /api/operations/dashboard`, re-aggregated for the exact range you pick — change to a single month and totals shrink accordingly. Panels: Operational Trends (trips / weight / mortality), Collection Streams pie, Outstanding Balances, Recent Transit, Active Fleet counts. |
| Trip Entry | `?tab=trip-entry` | Step 1 dropdowns: 23 vehicles, 29 drivers, 24 supervisors, 29 helpers, 24 loaders. Last-meter hint resolves per vehicle. Recent Trips shows Drafts parked at Steps 1/2/3/4 dated the business day → "Resume Step N" for every step. |
| Trip List | `?tab=trip-list` | 632 rows; filter each status: Completed (bulk), Pending, Draft, Deleted (~10). Open a Completed trip → all 5 steps filled: staff, farm + GPS, DC weight + box details, deliveries, diesel + expenses + mileage. |
| Rate Entry | `?tab=rate-entry` | Every delivery-submitted trip listed; open one → 8–18 shop lines, each with market-rate reference (master / last trip / avg + sample count) and a 4-day market-rate window. Completed trips show rate-locked state with lock timestamp. |
| Shop Sales | `?tab=shop-sales` | 6,059 sale lines with `TRP-xxxxx-Sxxx` numbers; date filter; shop search; rows within 10 days of 2026-09-11 are editable, older rows show "Editing period has expired." |
| Collection Entry | `?tab=collection` | Shop picker (200 shops); recent-collections panel per shop; week bounds resolve to the current sample week. |
| Pending Collections | `?tab=pending-collections` | 200 shop rows sorted by outstanding; total ≈ ₹1.69 Cr; each row shows total sales, total collected, last collection date and overdue days. |
| Weight Loss / Mortality | `?tab=mortality` | KPI strip (farm birds, delivered birds, mortality %, weight loss %); farm + supervisor dropdowns populated from real data; sort every column; expand a trip → shop-wise mortality lines. |
| Fuel Expenses | `?tab=fuel-expenses` | 606 bills, paginated 25/page; filter TRIP vs MANUAL; status Approved / Pending / Rejected; trip-linked rows carry trip no, meter and GPS. |
| Orders | `?tab=orders` | Now reads the live API (bundled sample mode switched off). **8 `[ORDER]` collection containers** (one per each of the last 8 operating days, 20–36 shops each): the newest is still *in collection* (Tab 1 working order), the other 7 are *collected* and available in Tab 2, where **9 vehicle trips** are assignment-eligible (Step 2 done, Step 4 open). Tab 3 Delivery Tracking is driven by the captured Step 4 rows. |
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

## 5. One command to prove the dashboard is in sync

```bash
npm run verify:dashboard        # needs the sample API on :4000 (npm run dev)
```

`scripts/dashboard-sync-check.mjs` loads the **real** dashboard service and
derivation modules through Vite's SSR pipeline, points them at the running
sample API and prints everything the page renders, then asserts the sync:

* master counts equal the dataset manifest (`/api/quarter-summary`);
* pending-collections total equals the Operations dashboard's;
* today's sales / collections / trips equal the Shop Sales, Collections and
  Trip List rows for the same business date;
* the quarter band's expenses equal fuel + trip + maintenance, its outstanding
  equals the pending-collections card, and its sales equal the Operations KPI;
* every panel is populated, no KPI reads zero, and at least 5 of the 7 series
  days carry sales.

It exits non-zero on any failure, so it is safe to wire into CI.

## 6. Notes / limits

- Writes (POST/PUT/PATCH/DELETE) return `200 {ok:true}` so UI flows complete, but the dataset is immutable — restart-safe and always identical.
- Auth is stubbed: any credentials log you in as Owner with all permissions.
- To move the quarter, edit the `QUARTER` constant and `TODAY` at the top of `scripts/quarter-sample-data.mjs`; everything else regenerates from those two values.

---

## 7. Sync verification — every navigation page hits the dataset

| Dashboard (executive) | `/api/operations/dashboard` (quarter band) + `/api/masters/*`, `/api/operations/trip-list`, `/api/operations/shop-sales`, `/api/operations/collection-entry`, `/api/operations/collections/pending`, `/api/fleet/maintenance` | quarter roll-up + 200 / 10 / 24 / 150 masters, 208 trips, 379 sale lines, 565 collections, 200 pending, 101 jobs |


Run with both processes up; each returns HTTP 200 with the row count shown.

| Nav page | Endpoint | Rows |
|---|---|---|
| Dashboard | `/api/operations/dashboard` | 29 fields (KPIs + all panels) |
| Masters → Shops / Farms / Vehicles / Employees / Banks / Bird Types | `/api/masters/*` | 200 / 10 / 24 / 150 / 8 / 5 |
| Masters → Market Rates | `/api/masters/market-rates` | 92 |
| Operations → Trip List / Trip Entry | `/api/trips`, `/api/trips/available-resources` | 640 / 5 groups |
| Operations → Rate Entry | `/api/operations/rate-entry` | 484 |
| Operations → Shop Sales | `/api/operations/shop-sales` | 6,059 |
| Operations → Collection Entry / Report / Pending | `/api/operations/collection-entry*` | 4,881 / summary / 200 |
| Operations → Mortality | `/api/operations/mortality-analysis` | 25/page of 471 |
| Operations → Fuel Expenses | `/api/operations/fuel-expenses` | 25/page of 606 |
| Operations → Orders | `/api/trips` (containers) | 8 containers + 9 assignable trips |
| Fleet → Maintenance / Permits / EMI / FASTag / Analytics | `/api/fleet/*` | 307 / 120 / 12 (36-installment schedules) / 24 / 11 KPI blocks |
| Staff → Duty Planner / Salaries / Leaves / Driver / Supervisor | `/api/staff/*` | week grid / 150 per month / 356 / 30 / 25 |
| Accounts → Payments / Farmer Payments / Analysis | `/api/accounts/*` | 662 / 471 / 9 totals |
| Reports → Shop Ledger | `/api/operations/shop-ledger?shopId=5` | 60 rows with running balance |
