# DMR Poultries Frontend + Local Backend

Poultry logistics ERP (React + Vite + Electron) with a new **Phase 1 local PostgreSQL backend**.

## Frontend

```bash
npm install
npm run dev
```

### EMI

`/fleet?tab=emi` is a **read-only** view of Vehicle Master finance details.

- A slightly wider vehicle search, Department-style Status dropdown and all
  three vehicle totals share one row. Smaller screens scroll the toolbar/table;
  the dropdown is portalled so it is never clipped by that scrolling area.
- Search is literal and ignores registration spaces/dashes. Sorting has stable
  registration/ID tie-breakers, covers the entire filtered dataset, and is not
  repeated on each keystroke. Only ten data rows are rendered at a time.
- Concurrent readers in the same auth context (including React StrictMode)
  share one in-flight GET. Different auth contexts never share a response.
  Rapid refreshes are guarded synchronously. Hidden/unmounted consumers cannot
  publish; known master changes invalidate older responses and coalesce into a
  sequential fresh read. There is no stale TTL/local-storage data fallback.
- Initial load, empty data, refresh and error states are distinct. Refresh keeps
  rows and user input mounted; failure keeps a **persistent last-loaded-data
  warning**, timestamp and the same Refresh action for retrying, instead of
  silently presenting old data as fresh. Access-denied responses clear previously loaded rows instead of
  retaining them. Fixed columns, reserved table space and stable controls avoid jumps.
- Larger table headings and a flat SVG vehicle/EMI mark improve readability.
  Vehicle/amount columns use compact, fixed widths; remaining headings and values
  align consistently. Clear filters uses a filter-X icon, not a second refresh
  arrow. There is exactly one Refresh action, including after failed reads.
- Every successful manual refresh shows one non-blocking, dismissible confirmation
  popup. It auto-dismisses after five seconds and never appears for initial loads,
  background revalidation, failed requests or an inactive tab.
- Active-tab entry, successful master edits, a throttled return to the browser,
  and the IST day boundary revalidate data. There is no interval polling or
  retry loop on unchanged failures. Global collection alerts load on demand,
  not just because the shared header appears on the EMI page.
- Overview calculation is O(vehicles), not O(all installments). Dates use the
  `Asia/Kolkata` business day and clamp month-end due dates correctly. Completion
  **still means elapsed due dates, not confirmed payment**. Explicit schedule
  detail generation is bounded to 1,200 installments; the overview never expands
  long schedules into arrays.
- Malformed numbers/dates and conflicting duplicate IDs fail closed; identical
  repeated rows are collapsed. Backend strings remain escaped React text. API
  requests default to same-origin `/api`; dev/preview hostnames are restricted
  to localhost and Arena's `.e2b.app` hosts (Vite also permits IP addresses).
  Vite explicitly loads its TypeScript config; generated config output stays
  under `node_modules/.tmp` so a build cannot shadow or reload the dev config.

These changes do not introduce order, assignment or payment writes. Production
must still use the real, authenticated backend/reverse proxy; frontend read
coordination does not replace server-side authorization or write idempotency.

#### Sample preview

To review **Vehicles → EMI** without connecting a real database:

```bash
# Terminal 1: opt-in, in-memory demo API (never writes to PostgreSQL)
npm run mock:backend

# Terminal 2: same-origin API calls through Vite's existing /api proxy
VITE_API_BASE_URL=/api npm run dev -- --host 0.0.0.0
```

Open `/fleet?tab=emi` in the frontend preview. The demo includes **12 fictional
vehicles** (3 completed schedules and 9 pending), different purchase amounts,
12–60 installments, a new schedule, a nearly finished schedule and a month-end
EMI day. Dates move with the current month. Search, status filters, sorting,
pagination and Refresh work with these samples. The Status dropdown follows
the Salary Register's Department styling, with all three vehicle totals beside
it on one line. Narrow screens scroll the toolbar without clipping the menu.

The page labels demo responses **Sample data · Preview only** in English/Telugu.
Completion still follows the current due-date calculation, not payment receipts.
Sample vehicle records are read-only and are not saved to the real database.
The bundled demo API also serves the existing Orders and Collection examples;
it is **not** the production ERP backend. Stop it before starting the real
backend on port 4000; real API responses do not display the sample notice.

Checks (no real database or records are used):

```bash
npm run test:emi-preview     # Calendar, validation, performance and read races
npm run test:i18n            # Provider identity across module reloads
npx playwright install chromium
npm run test:e2e:emi         # UI, request counts, races, failure/retry, focus and XSS
npm run build               # Production TypeScript + Vite build
```

Browser checks also cover 20,000 synthetic vehicles. Set `EMI_TEST_BASE_URL` to
an already running frontend to reuse it instead of starting the isolated test
server. The broader legacy Collection UI source-text tests still expect English
literals in translated components; those pre-existing checks are separate from
the passing Collection API contract and EMI tests.

### Duty Planner

**Staff → Duty Planner** has compact weekly, monthly and custom-range filters.
**Download Excel** stays beside **Reset** and exports the active table's filtered
employees and dates, with each employee's **Duty Count** in the last column.
The table and workbook have no grand-total row or long explanatory footer.

- Supervisor, Driver, Helper and Loader remain manually assigned.
- Missing duties for other active staff default to **Office** (or **Collection**
  for collectors/collection departments), with **Weekly Off on Sunday**.
  Existing explicit exceptions are preserved. Defaults are not generated before
  joining, for inactive staff, or for orphan historical records.
- Due defaults are automatically saved using the normal staff assignment API
  for editable weeks after the previous week is closed. Failed saves are shown
  with a retry action; closed weeks and existing assignments are not overwritten.
- **Approved leave always overrides duty**, including automatic duties. Pending
  and rejected requests do not change duties. Leave updates refresh the planner.
- Future dates show **empty dotted cells**, remain excluded from counts, and do
  not expose future duty/vehicle details in Excel. Existing future assignments
  are retained rather than deleted.
- **Daily Details** keeps the source types, vehicle and approved-leave information
  for completed dates. Sample workbooks are explicitly labelled as samples.
- English/Telugu follows the app language switch, including filters, dates,
  duty labels, pickers, messages and Excel. Employee names/backend values stay
  unchanged. Telugu fonts are bundled; the calendar uses opt-in localization.
- Salary Register and other pages' exports are unchanged.

Focused checks (browser tests mock the staff API; no database is needed):

```bash
npm run test:duty-planner
npx playwright install chromium
npm run test:e2e:duty-planner
```

## Backend (PostgreSQL — Masters + Trip Steps 1–5 + Staff)

See [`backend/README.md`](./backend/README.md).

```bash
# PostgreSQL must be running locally (or: cd backend && docker compose up -d)
npm run backend:install
npm run backend:migrate
npm run backend:seed   # optional
npm run backend:dev    # http://localhost:4000
```

### Phase plan

1. **Now** — Local PostgreSQL schema + REST API through Staff
2. **Next** — Mobile app talking to this local API/DB
3. **Later** — Move database + mobile clients to cloud (`DATABASE_URL` swap)
