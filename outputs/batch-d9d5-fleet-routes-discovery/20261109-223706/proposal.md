# Batch D9D-5 — fleet-operations routes discovery & design proposal (20261109-223706)

READ-ONLY. No source file changed, no commit. HEAD: `86792d5ad382ad686e4163b11496fa1cc554d031`.
Dirty files untouched (see `pre-status.txt` / `pre-preservation-hashes.txt`).

## 1. Exact target files and findings

Single flagged module: `src/modules/fleet-operations/routes.tsx`
(`routes-eslint.json`, `fleet-findings.json`).

Targeted ESLint JSON on that file: **7 errors, 0 warnings**:
- 6× `react-refresh/only-export-components` at **7:7, 8:7, 9:7, 10:7, 11:7, 12:7** —
  the six module-scope `const X = lazy(retryableImport(() => import(...)))` page
  wrappers (`MaintenanceEntryPage`, `MaintenanceHistoryPage`, `DocumentsExpiryPage`,
  `FastagDashboardPage`, `EmiLoansPage`, `VehicleAnalyticsPage`). Message:
  "Fast refresh only works when a file only exports components. Move your
  component(s) to a separate file."
- 1× `@typescript-eslint/no-explicit-any` at **20:54** —
  `withSuspense = (Component: React.ComponentType<any>)`. Out of D9D remit
  (hard rule: no `any` fixes); must be left as-is and carried verbatim.

Why the rule fires: the file's only export is the **non-component**
`export const fleetRoutes: RouteObject[]` (line 26). The six `lazy(...)` bindings
are components (local, not individually exported), and the rule flags component
definitions in any file that also exports non-component values. `withSuspense`
is a local (non-exported) Suspense wrapper; it does not itself trigger the rule,
but it travels with whichever side keeps the JSX wrapper.

No other fleet-operations `only-export-components` findings exist. The other two
historical auth/UI findings (IdleSessionGuard, KpiCardGrid) are already cleared
and committed (HEAD `86792d5a`); full-lint `only-export-components` count is now 6,
all in this file.

## 2. Flagged exports, importers, registrations, lazy boundaries, circulars

- `fleetRoutes: RouteObject[]` — 6 active sub-routes
  (`fleet/maintenance/entry|history`, `fleet/documents`, `fleet/fastag`, `fleet/emi`,
  `fleet/analytics`) + commented DEFERRED entries. Each `element` is
  `withSuspense(LazyPage)` with `<Suspense fallback={<LoadingSkeleton count={3} />}>`.
  Lazy boundary per page is preserved by `retryableImport` (retry + probe + guarded
  reload in `src/routes/lazyWithRetry.ts`); chunk identity = the dynamic
  `import('./pages/XPage')` specifier.
- Importers of `fleetRoutes`: **none at runtime**. Only re-export
  `src/modules/fleet-operations/index.ts:25 → export { fleetRoutes } from './routes'`,
  and that barrel itself has **zero consumers outside the module** (grep over `src/`
  excluding the module finds only `AppRoutes → FleetPages`, `Header → permitApi`,
  and a comment in `notificationStore`). `routes.tsx` internals (`withSuspense`,
  the six lazy consts) have zero external importers (verified).
- Live registration: `src/routes/AppRoutes.tsx:75-76,276-294` mounts
  `pages.fleet = lazyShell(() => import("../modules/fleet-operations/pages/FleetPages"))`
  at `/fleet` and `/fleet/*`. It does **not** consume `fleetRoutes`. Sub-navigation
  is the tab system: `FleetPages.tsx` + `pages/fleetTabs.ts:tabLoaders`
  (per-tab `() => import("./XPage")`, `preloadFleetTab`/`onIdle` warm-up,
  `FleetTabSkeleton`), with nav labels in `src/routes/navigation.ts`
  (`/fleet?tab=entry|history|permits|emi|fastag|analytics`).
- `activeFleetScope.test.ts` reads `routes.tsx` **as source text** (not an import):
  asserts `DEFERRED` present, and that `fleet/dashboard`, `fleet/reports`,
  `fleet/expense-report` paths and `withSuspense(FleetDashboardPage)` are absent.
  Any edit must keep those strings/shapes stable or update the test deliberately.
- Circular-dependency check: `routes.tsx` imports `../../routes/lazyWithRetry`
  (pure retry/probe helpers, no route imports), `./components/common/LoadingSkeleton`
  (pure presentational, default-memo export), and page chunks **only via dynamic
  `import()`** (no static cycle). Pages do not import `routes.tsx`/`index`
  (verified: no `fleet-operations/routes` or `./routes`/`../routes` imports inside
  the module). `index.ts` re-exports pages directly (static) — that is the
  pre-existing eager path, independent of `routes.tsx` dynamic boundary. Moving
  `fleetRoutes` to a sibling module that imports the lazy-page module (or vice
  versa) must keep the direction one-way to avoid creating a static cycle.

## 3. Safest extraction plan (small independently testable batches)

Assumption: no behaviour/loading change; `any` and wrapper logic carried verbatim;
no config/ESLint/dependency changes.

- **Batch A — isolate route metadata (fixes all 6 findings at once).**
  Create `src/modules/fleet-operations/fleetRouteConfig.ts` (non-component module):
  move `export const fleetRoutes: RouteObject[]` there **verbatim** (paths, order,
  DEFERRED comments, `withSuspense(...)` call shapes). Keep the six `lazy(...)`
  page bindings + `withSuspense` + imports (`lazy`, `retryableImport`,
  `LoadingSkeleton`, `RouteObject` type) in `routes.tsx` (now exporting nothing —
  rule passes: no non-component exports remain), **or** better: keep `routes.tsx`
  as a thin component-only module and have the config import the lazy bindings
  from it. Recommended direction (avoids cycles): `fleetLazyPages.tsx` (new,
  component-only: six `lazy(...)` consts + `withSuspense`, exported for the config)
  ← `fleetRouteConfig.ts` (imports pages module, builds `fleetRoutes`) ←
  `index.ts` re-export switched to `./fleetRouteConfig`; `routes.tsx` becomes a
  deprecated re-export shim (or is removed only with explicit approval).
  Smallest diff preserving chunk specifiers character-for-character.
- **Batch B — retarget the single re-export.**
  `index.ts: `export { fleetRoutes } from './routes'` → `from './fleetRouteConfig'`.
  No other importer changes (there are no runtime consumers). Verify barrel
  consumers unaffected (none) and `FleetPages` tab path untouched.
- **Batch C — source-text test alignment.**
  `activeFleetScope.test.ts` reads `routes.tsx` text. If `routes.tsx` becomes a shim
  or the `DEFERRED`/path strings move to the config module, update the test's
  `read(...)` target(s) to the new file(s) and re-run. Keep assertions identical.
  Do not weaken them.
- Explicitly **not** in scope: fixing `ComponentType<any>` (hard rule), touching
  `FleetPages`/`fleetTabs`/`navigation`/`AppRoutes`, eager-vs-lazy changes,
  path renames, fallback UI changes, or deleting the DEFERRED entries.

## 4. Route metadata that cannot safely move

`fleetRoutes` itself **can** move (plain `RouteObject[]` data), but two constraints:
- (a) It is **unregistered**: nothing mounts it (`AppRoutes` uses `FleetPages`).
  Moving it preserves a dead-but-intended registration. Deleting it instead is a
  product decision, not a lint fix — do not delete without explicit approval.
- (b) `element: withSuspense(LazyPage)` couples metadata to the Suspense wrapper
  and the lazy chunk identity. The move must carry the exact wrapper call and the
  exact dynamic-import specifiers; any normalisation (e.g. switching to
  `lazyWithRetry`, changing fallback, hoisting `retryableImport` args) changes
  chunk splitting/retry behaviour and is out of scope.

## 5. Required import migrations

- New `fleetLazyPages` (or keep in `routes.tsx` per chosen direction): no external
  importers initially; imported once by the config module.
- New `fleetRouteConfig.ts`: imported once by `src/modules/fleet-operations/index.ts`
  (replace `./routes` source). No changes needed in `AppRoutes`, `navigation`,
  `FleetPages`, `fleetTabs`, page components, or `Header`/`permitApi` paths.
- `activeFleetScope.test.ts`: `read('routes.tsx')` → new config path(s) (test-only
  migration, same assertions).
- Zero changes for all operation/fuel/shop/trip/collection KPI consumers (unrelated).

## 6. Test plan and expected lint reduction

- Targeted ESLint JSON on `routes.tsx` + new modules + `index.ts`: expect 0
  `only-export-components`; the single `no-explicit-any:20:54` will persist
  verbatim (pre-existing, out of remit — record, do not fix).
- Focused tests: `activeFleetScope.test.ts` (deferred-route/text assertions),
  plus existing fleet suite (`test:fleet`), and a `tsc --noEmit` typecheck.
  Add no new tests except possibly an import-identity check
  (`fleetRoutes` array identity/paths/order vs HEAD) if cheap.
- Full lint: expected **6 → 0 `only-export-components`** (fleet file clean),
  total **532 → 526 problems (484 → 478 errors, 48 warnings unchanged)**,
  assuming no other drift. Report measured delta, never assume.
- Behaviour proof: `git diff` shows only moved lines + import-source changes;
  chunk specifiers, paths, order, fallbacks, DEFERRED comments byte-identical
  modulo required import/export lines; route-matching snapshot (paths list) before
  vs after identical.

## 7. Risk analysis

- **Route loading**: risk LOW if specifiers/loader wrappers are byte-identical —
  same chunks, same retry/probe path. Risk becomes HIGH if anyone "cleans up"
  `retryableImport` vs `lazyWithRetry`, fallback count, or hoists loaders.
- **Code splitting**: risk LOW (dynamic imports stay dynamic in the same module
  graph position). Moving the `fleetRoutes` array does not split chunks; moving
  the `lazy()` calls across modules keeps specifiers but shifts the chunk-group
  owner — bundle diff should be inspected to confirm no eager evaluation via the
  barrel (`index.ts` statically re-exports pages already, so no new eagerness).
- **Circular imports**: risk LOW with one-way direction
  (pages ← lazy-pages ← config ← index). Risk HIGH if config and lazy-pages
  import each other or if pages ever statically import the config. Enforce by
  keeping dynamic-only page references in the lazy module and no back-imports.
- **Navigation behaviour**: risk MEDIUM-LOW. Live app navigates via `FleetPages`
  tabs, not `fleetRoutes`; a metadata-only move cannot change visible navigation
  unless a future change mounts `fleetRoutes`. The danger is masking dead-route
  drift: keep the DEFERRED guards and text-test assertions intact so a future
  mount decision is explicit.

## 8. Recommendation

**Not safe to implement without one explicit design decision**: is `fleetRoutes`
the future registration (keep + isolate as above) or dead code shadowing the live
`FleetPages` tab system (remove in a separate product-approved batch)? The
mechanical extraction (Batch A–C) is safe and fully testable, but choosing
wrongly either cements a duplicate route table or deletes intended registrations.
Proceed with implementation only after the owner confirms **keep-and-isolate**
(the plan above) vs **remove**. If keep-and-isolate is confirmed, implement
exactly Batches A→B→C in order, with the lint-delta and hash proofs specified.
