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
- Collection's filter card uses the Trip List arrangement: date + city on the first row, then sort
  (3 cols) / search (5 cols) / reset + refresh (4 cols) on a 12-column row aligned `items-end`, so
  every control shares one baseline. Each column header carries its own 14px icon at the same
  spacing the trip table uses.
- Trip No and Vehicle No are **not** Collection columns (assignment facts belong to Assignment); an
  assigned shop shows only its status, with trip / vehicle / sequence in the tooltip.
- The day total is one cumulative line **below** the table (`Orders taken in N shops`, with birds ·
  boxes · kg muted beside it) instead of a KPI in the header bar.
- Collection has one action: **Save Progress**. There is no Cancel (the saved record is the draft, so
  there is nothing to discard) and no Finish button — the day's own deadline files it: 48h from the
  start of the day (the 16th submits at 18/09 12:00 AM). The screen states that deadline instead of
  offering a button (`Auto-submits 18/09 12:00 AM`). The check is one `Date.now()` comparison on
  load plus one `setTimeout` armed per mount — no interval, no polling — and the submit reuses the
  existing `POST /trips/:id/steps/deliveries` call, so the auto-close costs no extra request.
- Assignment now exposes search/date/sort and read-only historical rows. Historical days never mount the writable assignment editor.
- Table refresh retains controls, navigation and drafts. Initial loading uses a table shell, not a full-app spinner. Page transitions respect reduced-motion preferences.

Validation: `npm run test:orders-navigation` (8 passed), `npm run test:orders-performance` (6 passed), targeted ESLint and production build passed. All three preview URLs returned HTTP 200. Four browser regression scenarios are provided via `npm run test:e2e:orders`; they could not execute here because the Playwright browser executable is missing and the browser download host is unreachable. HTTP checks do not substitute for visual/browser interaction validation.
