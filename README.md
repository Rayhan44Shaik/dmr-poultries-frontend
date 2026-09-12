# DMR Poultries Frontend + Local Backend

Poultry logistics ERP (React + Vite + Electron) with a new **Phase 1 local PostgreSQL backend**.

## Frontend

```bash
npm install
npm run dev
```

### Demo / sample data (no database required)

The repo ships a deterministic in-memory sample API so **every page of every
module** renders fully populated — no PostgreSQL needed. `npm run dev` starts it
automatically next to Vite, so there is nothing else to run:

```bash
npm install
npm run dev          # sample API on :4000 + Vite on :5173, /api proxied
```

`npm run dev` is `concurrently` over two scripts:

| Script | What it does |
|---|---|
| `npm run dev:sample-api` | `scripts/quarter-sample-data.mjs` on port 4000 (the Vite `/api` proxy target) |
| `npm run dev:web` | Vite only — use this when you run the real backend instead |

If something already listens on 4000 (the real backend, say), the sample server
prints that and exits without failing the dev command.

- The sample API serves a rolling **92-day quarter ending today** (200 shops, 150
  employees, 10 farms, 24 vehicles, ~640 trips, ~7,700 delivery lines, ~4,700
  collections, plus banks, market rates, permits, EMI schedules, salaries,
  leaves, duty roster, payments and farm payments). Anchoring on today keeps the
  today/this-week/this-month dashboard tiles populated; `SAMPLE_TODAY=YYYY-MM-DD`
  pins the anchor when you need a byte-identical dataset.
  `GET /api/quarter-summary` returns the row-count manifest. Writes return
  `200 {ok:true}` so UI flows complete, but the dataset stays immutable and
  byte-identical on restart.
- `.env.development` sets `VITE_DEMO_MODE=1`, so `npm run dev` skips the login
  gate and signs you in as the demo Owner. `VITE_DEMO_MODE` is only honoured when
  `import.meta.env.DEV` is true, so a production build can never bypass auth —
  drop the variable (or use `?demo=1` per URL) to exercise real login.
- Pages can tell they are on sample data: `/api/quarter-summary` and the
  `/api/operations/dashboard` payload carry `sample: true` plus the quarter
  window, and both dashboards show a badge (amber "Sample data" on Operations, a
  sky quarter chip on the Executive dashboard). Nothing is ever badged in a
  production build, because the probe is dev-only.
- `npm run mock:backend` is kept as an alias for `dev:sample-api` (start just the
  sample API); `npm run mock:trips` serves the older, trip-wizard-focused sample
  (`scripts/dev-mock-backend.mjs`) with in-memory wizard save/submit support.
- Auth is stubbed by the sample API, so any credentials work too.
- To work against the real backend instead, run it on port 4000 and start the
  frontend alone with `npm run dev:web`.

Full module-by-module verification steps live in
[`docs/QUARTER_SAMPLE_DATA_TESTING_GUIDE.md`](./docs/QUARTER_SAMPLE_DATA_TESTING_GUIDE.md).

### Navigation

The sidebar is flexible, never a fixed panel. On `lg` screens and up it steps
through three shapes, and the choice is remembered per browser (`dmr-sidebar-mode`):

| Shape | Width | How to get there |
|---|---|---|
| Expanded | 260px | Default. Click ⤢ in the brand row, or the header menu button when collapsed |
| Icon rail | 72px | Click ⤡ in the brand row (labels become hover tooltips, badges become dots) |
| Hidden | 0 | Click ✕ while in the rail; the header menu button brings it back |

⌘/Ctrl + B cycles the shapes; the content column animates its offset so pages
reflow instead of jumping. Below `lg` the same entries live in the floating
popup opened from the header menu button.

Every nav glyph animates on hover with a motion written for its own name — the
truck drives off and back (Trip Entry / Trip List / Driver Performance), the
rupee flips (Rate Entry), the wrench tightens (Maintenance Entry), the page
turns over (Permits & Documents / Shop Ledger), the fuel pump rocks, the hen
flaps… One motion per meaning, keyed by path in `ui/Sidebar/navMotion.ts` with
the keyframes in the `--animate-nav-*` family of `styles/tokens.css`. Motions
only run on hover / keyboard focus, never on the active row, and the global
`prefers-reduced-motion` rule disables them.

### Operational Trends (dashboard)

Operations → **Overview** leads with **Trips & weight movement** — the first
card, and the weight story of the completed trips in the window it is reading:

| Series | Encoding |
|---|---|
| Trips | Indigo line with a soft gradient area, right axis |
| Farm weight | The height of the stacked bar (kg) |
| Delivered weight | Emerald segment |
| Mortality weight | Rose segment — kept so the bar still adds up to the farm weight |
| Weight loss | Amber segment |

`farm = delivered + mortality + loss` holds for every trip, so the three
segments stack to exactly the farm weight — one bar carries all four weight
numbers at once. **Share of farm** re-reads the same data as a 100% stack, so a
quiet bucket and a heavy one can be compared by shape.

**Window** — the header carries a `Today · Week · Month` switcher, plus a
`Custom` option whenever the calendar holds a range of its own. Picking one
moves the whole card — bars *and* the five totals underneath — to today, the
last seven days or this calendar month. Today and a week read day by day; a
month reads week by week.

Each chip's number counts the **completed trips** in its window, which is
exactly what the card weighs, so "Week 22" and "Trips 22" can never disagree —
trips still in transit have no weights yet and are left out of both. The
counters come from one fetch of the shortest range covering today, the week and
the month.

Until a chip is tapped the card reads the global calendar, and the chip that
fits it is lit — a one-day calendar lights Today, a seven-day one lights Week, a
month-long one lights Month, and anything else lights Custom, which carries the
calendar's own trip count. That default is derived rather than remembered, so a
reload or a hard refresh lands on the calendar's window, and tapping the lit
chip hands it back. The caption under the title always names the dates being
totalled. Each chip carries its own accent — Today sky, Week violet, Month teal,
Custom slate.

**Reading it** — the plot stays in kilos, so there is no second reading to
switch to, and the footer is five plain numbers that double as the legend:
trips, farm weight, delivered weight, birds lost and weight loss. The tooltip
carries the detail — every weight with its share of the farm weight, the birds
picked up at the farm, the birds delivered, the birds lost with their share of
the load, and the ▲▼ change against the previous bucket.

Mortality is reported in birds, not kilos: the rose band stays in the bar only
because the segments must add up to the farm weight, but no figure in the card
is a mortality weight any more.

The whole card is localised — Telugu reads Telugu labels, month and weekday
names, and lakh figures (`5.20 లక్షల kg`), with only units (kg, %) and numbers
left as they are.

### Masters

Shops, Farms, Vehicles, Employees, Banks and Bird Types share consistent
form frames, field spacing, typography, directory toolbars, status badges and
compact pagination. The Farm form follows the Vehicle/Shop layout, with
separate farm, contact, and location/capacity sections. Form headers and save
buttons remain visible while the body scrolls on smaller screens.

Every master dropdown uses the **Salary Register Department/Employee** reference:
36px white controls, rounded menus, compact rows and an inset search where
appropriate. This includes Department, City, Association Type, Paper Rate,
rows per page, Export, and the master calendars' month/year controls.
Dropdowns support keyboard navigation, typeahead/search, Escape, outside-click
closing and focus restoration. Menus stay outside scrolling form/table areas
while remaining inside their modal. The shared calendar's new dropdown override
is opt-in; Salary Register and other calendars keep their existing appearance.

Existing API endpoints, payloads, required-field rules, import/export handlers
and failed-save behaviour are preserved. No sample data or database writes are
introduced into the application by these styling changes.

```bash
npx playwright install chromium
npm run test:e2e:masters  # Isolated API fixtures; no real database or master writes
npm run build
```

The browser checks cover all six tabs at desktop, tablet and phone widths,
compare dropdown styles against the actual Salary Register, and exercise
filtering, pagination, exports, keyboard/focus behaviour, calendars, validation,
create/edit payloads, disabled save states and failure/retry. Set
`MASTERS_TEST_BASE_URL` to reuse an already running frontend.

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
  Vehicle/amount columns use compact, fixed widths; registration numbers are
  plain text without row icons. Remaining headings and values align consistently. Clear filters uses a filter-X icon, not a second refresh
  arrow. There is exactly one Refresh action, including after failed reads.
- Pagination groups Previous, page numbers and Next without reserved blank slots;
  its current-page highlight and row range follow the filtered data. Phones show
  up to three neighboring page numbers, larger screens up to five. Loading/empty
  states disable navigation rather than presenting an active page with no records.
- Every successful manual refresh shows one non-blocking, dismissible confirmation
  popup in the top-right corner. It auto-dismisses after five seconds and never appears for initial loads,
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
# One command: sample API + frontend (sample API never writes to PostgreSQL)
npm run dev                   # full-quarter sample (12 financed EMI vehicles)

# Already running the sample API? Just the frontend, through Vite's /api proxy:
npm run dev:web
```

Open `/fleet?tab=emi` in the frontend preview. The demo includes **12 fictional
vehicles** with different purchase amounts and 12–60 installments, plus active,
overdue and paid schedules. Search, status filters, sorting, pagination and
Refresh work with these samples. The Status dropdown follows the Salary
Register's Department styling, with all three vehicle totals beside it on one
line. Narrow screens scroll the toolbar without clipping the menu.

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
