# Orders performance changes

## What changed

- Operations pages load on demand. Opening Orders no longer eagerly evaluates every other Operations screen.
- Assignment, Tracking and delivery details are separate lazy chunks. While a page is open, the
  next step of the flow is warmed during idle time (collect → assign → track); PDF export code loads
  only when a document is requested.
- Orders derives its shop directory from the existing Shop Master hook instead of issuing a second shop-list request. Subsequent master changes update both views together.
- Assignment rows are indexed by order reference and shop once per fetched snapshot. Sorted trip rows are reused within that snapshot. There is no cross-save business-data cache.
- The shared trip mapper reuses one fixed IST date formatter rather than constructing a formatter for each timestamp.

The collection/assignment save contracts, fresh-data conflict checks, split shares, capacity rules and tracking calculations were not changed. Neither sample-data file was modified.

## Verification (16 September 2026)

- Production build (including TypeScript): passed.
- `npm run test:orders-performance`: six tests passed. Covers assignment-index equivalence, split shares, order isolation, deleted/invalid rows, large snapshots, non-mutation and timestamp behavior.
- Selected existing ordering, tracking and farm-city tests: 22 passed (25 including the index tests).
- Full Orders suite: 37/47 passed. Ten service tests fail with `Invalid URL`: these tests expect the older in-memory sample-service path, whereas the current service calls the relative `/api` HTTP contract in Node. They are not counted as passing integration coverage.
- Read-only Vite SSR comparison of the complete original and updated `fetchOrdersData()` result against the running quarter API: deep equality passed (10 selectable days, 8 collections, 10 tracking trips, 6 eligible vehicles).
- Frontend preview route: HTTP 200. No end-to-end browser timing claim is made.

## Measured processing time

A temporary read-only benchmark compared the original HEAD Orders service/trip mapper with the updated implementation. Both were loaded through Vite SSR. After capturing the quarter API responses, the benchmark replayed identical response bodies through Axios to remove network variability. Each implementation ran 15 times.

| Frontend mapping, median | Before | After |
| --- | ---: | ---: |
| Full Orders snapshot | 910.65 ms | 102.63 ms |

This is approximately **89% less processing time**, not a measurement of total browser page-load time. Network latency, device performance and rendering still affect perceived speed. The benchmark did not mutate preview records; temporary baseline modules were removed afterward.

## Orders table/navigation alignment

- One route per Orders page: `/operations/orders/collection`, `/operations/orders/assignment`,
  `/operations/orders/delivery-tracking`. Each is reloadable and shareable, and each is its own
  sidebar row inside the Orders group under Operations (listed after Fuel Expenses, at the end of
  the section). The rows are named **Collection / Assignment / Delivery** — the group heading above
  them already says Orders, so the row does not repeat it, and the header breadcrumb adds the
  module back (`Operations › Orders › Collection`). The route table that defines them is `src/modules/orders/routes/ordersRoutes.ts` —
  the sidebar and the URL resolver both read it, so they cannot drift. There is no in-page tab
  strip: a page is opened from the sidebar or by its URL, exactly like Shop Sales or Trip List.
  The older
  `/operations?tab=orders&orderTab=collection|assignment|tracking` links still work: they are
  canonicalised to the path form on arrival.
- Collection/Assignment date parameters are independent (`collectionDate`, `assignmentDate`). Invalid calendar dates, future dates and dates outside the advertised operational window resolve to today.
- Visited pages stay mounted while you move between the three routes from the sidebar: filters, page size, current page and unsaved edits survive the move. These local filters/drafts are not persisted across a full browser reload. Date changes intentionally mount a new day editor; top-level collection/assignment search and sort controls remain selected.
- All Orders pagers now use the same `src/ui/Pagination.tsx` as Trip List, with counts, rows-per-page, disabled states and bounded page controls. Filtering/sorting occur before slicing.
- Collection cells match Trip List's 16px column padding, 20px body padding and 16px header padding. Search includes shop number and phone in addition to existing fields.
- Collection's filter card is **one 12-column grid whose fields fill their cells**: Date · City ·
  **Shop** · Sort on the first line (3 columns each, so the four share the width evenly), then Search
  (8 columns) with Reset + Refresh (4 columns, right-aligned) underneath, bottom-aligned with
  `lg:items-end`. Every control is the shared **40px** (`h-10`) height — the Orders dropdowns and
  multi-selects were `h-9` while the search input and the DatePicker were already `h-10`, which is what
  made a filter row read as three different sizes. Labels use `ORDERS_FILTER_LABEL_CLASS` (13px
  uppercase, `min-h-[17px]` so a field without an icon still lines up with its neighbours). **A control
  gets one glyph, never two**: the search field keeps only its own inset magnifier and the date field
  only its own calendar button, so neither label repeats it; City (amber), Shop (sky) and Sort (violet)
  carry the glyph their column already uses. The Shop picker is the day's sheet narrowed to named shops —
  it composes with the city filter and the search box instead of replacing them. Assignment was brought
  to the same label class, per-field icon colours and full-width fields so the two screens read as one
  module.
- **Loading is the table's business.** The filter card is built in the page component, *above* the data
  gate, and is never swapped for a skeleton — not on the first paint (neither the Shop Master nor the
  day's collection has answered) and not on a refresh. `OrdersPage` therefore renders the Collection panel
  through the load instead of replacing it with the placeholder panel, and the load is reported where it
  belongs: `aria-busy` plus a skeleton `tbody` inside the card, with `OrdersTableSkeleton` between a header
  strip that is identical to the loaded one so nothing jumps when the rows land. This is the Trip List's
  contract (`TripMasterTable isLoading`) copied, not reinvented.
- Columns are **equal width apart from S.No** (`table-fixed`, S.No measured at 96px so its glyph plus
  the word fit) — the heads stop chasing their content. Each header carries its own 15px icon, coloured
  per column, at the trip table's spacing. Header words and body words sit at **14px**
  (`ORDERS_TABLE_TH_CLASS` / `ORDERS_TABLE_TD_CLASS`) — a step above the shared 12px — while the three
  number boxes go the other way and drop to **28px** (`ORDERS_RISE_INPUT_CLASS`), so a row reads as its
  words and not as a wall of inputs. Each box is tinted to match its own header glyph (birds emerald,
  boxes violet, weight teal) and carries a small rise: a soft shadow that lifts a pixel on hover.
- Trip No and Vehicle No are **not** Collection columns (assignment facts belong to Assignment); an
  assigned shop shows only its status pill, and a pending count rides **beside** the pill (`25 to
  deliver`) rather than inside it, so an equal-width column cannot be pushed over.
- **No tooltips on this screen.** The row state is the badge, the deadline is the chip — nothing needs a
  hover to be understood, so every `title` attribute was removed from the page (pinned by
  `npm run test:e2e:orders`: "no tooltip is left on the collection screen").
- The day total is one cumulative line **below** the table (`Orders taken in N shops`, with birds ·
  boxes · kg muted beside it) instead of a KPI in the header bar.
- **Weight is ours to type.** The column is an input like the other two — empty, with no default value
  written into it — and the derived figure (birds × the average bird weight in force) is only the
  placeholder behind it. `collectionRowWeightKg` keeps that rule in one place: what was typed wins, an
  empty box falls back to the birds, and only what was typed is sent, so the sheet never invents a number
  for billing to chase. The day's cumulative kg is summed from those effective weights, which is also why
  sorting by Weight and the total line always agree.
- The **Action** column is not a delete: it zeroes that shop's birds, boxes and typed weight, and the
  shop keeps its row. On hover the eraser does the work its name implies — it tilts and slides a pixel
  against a rose glow, and presses flat (`motion-safe`, so reduced-motion users just get the colour). The clear runs through the shared 10-second window
  (`usePendingDelete`, the same controller the Recent table uses for a pending trip) — the row is marked
  while it counts, the button turns into the countdown and cancels on click, and `Undo` in the
  notification puts the numbers back. Nothing reaches the server until the window runs out, and the save
  keeps the row at zero (`toOrderShopRows(rows, keepZeroFor)`) instead of dropping it.
  The shared dialog keeps its countdown chrome but not its delete wording — `description`, `busyLabel`,
  `countdownLabel`, `icon` and `ariaLabel` are optional overrides (the trip delete in the Recent table
  still gets "will be deleted automatically" with the trash glyph, which is what it actually does).
- Collection has one action: **Save Progress**. There is no Cancel (the saved record is the draft, so
  there is nothing to discard) and no Finish button — the day's own deadline files it: 48h from the
  start of the day (the 16th submits at 18/09 12:00 AM). The deadline is stated **once**, in the day's
  state row, and it moves: `Auto-submits 18/09 12:00 AM` with a ping dot and the window drawn as a bar
  filling under the chip (all of it `motion-safe`). There is deliberately **no countdown text** — a
  ticking `in 1d 03h 59m` was one more number to read for the same fact, and the bar already says it. The check is one `Date.now()`
  comparison on load plus one `setTimeout` armed per mount — no interval, no polling on the data path
  beyond a 30s tick for the label — and the submit reuses the existing
  `POST /trips/:id/steps/deliveries` call, so the auto-close costs no extra request.
- Assignment now exposes search/date/sort and read-only historical rows. Historical days never mount the writable assignment editor.
- Table refresh retains controls, navigation and drafts. Initial loading uses a table shell, not a full-app spinner — and the shell keeps the filter card mounted. Page transitions respect reduced-motion preferences.

Validation: `npm run test:orders-navigation` (18 passed), `npm run test:orders-performance` (6 passed), `npm run test:design-system` (64 passed), targeted ESLint and production build passed. The Orders Playwright suite (23 cases) pins the grid by bounding box, the 40px controls, the absent tooltips, the shop filter, the weight box, the zeroing Action and the filter card surviving a held `/api/**` request. All three preview URLs returned HTTP 200. Four browser regression scenarios are provided via `npm run test:e2e:orders`; they could not execute here because the Playwright browser executable is missing and the browser download host is unreachable. HTTP checks do not substitute for visual/browser interaction validation.
