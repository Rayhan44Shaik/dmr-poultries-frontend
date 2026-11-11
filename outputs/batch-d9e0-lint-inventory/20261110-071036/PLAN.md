# D9E-0 — Next 5 smallest safe batches (ranked)

Source: `lint-full.json` (962 files, 478E + 48W = 526), `per-file.json`, `inventory-summary.txt`.
All 5 batches touch **clean committed files only** — zero overlap with the 40-entry dirty set
(D9D-3 Diesel/Fuel, ShopLedger, D9D-5A fleet files, i18n, MasterDropdown), protected
`src/deleted_files_backup/`, `backend/`, config, or tests-as-source. No batch needs browser E2E:
every fix is dead-code removal, ref-access correction, or type-annotation-only (erased at compile),
fully verified by targeted ESLint + `npm run typecheck` + nearest existing unit suite.

## Batch 1 — `no-unused-vars`, 4 single-finding files (−4E)
Files (all clean, 1 finding each):
- `src/ui/BrandMark.tsx` @39:10
- `src/modules/auth/tokenStore.ts` @11:28
- `src/modules/operations/collections/pages/CollectionEntryPage.tsx` @19:57
- `src/modules/accounts/components/payment-book/PaymentViewModal.tsx` @40:25
Fix: delete the unused import/binding (mechanical; typecheck proves no reference).
Verify: `npx eslint <4 files>` → 0; `npm run typecheck` → 0; `npm run test:auth`, `npm run test:collections`.
No user overlap: none of the 4 files is dirty; areas (ui/auth) are outside active Diesel/Fuel/ShopLedger work.

## Batch 2 — `react-hooks/refs`, 2 clean files (−4E)
Files:
- `src/hooks/usePendingDelete.ts` @39:3,57:29,72:21 (3E; file also carries 1 exhaustive-deps warning — out of scope, left intact)
- `src/modules/staff/components/salary/usePopupGuard.ts` @18:3 (1E)
Fix: correct ref object access (`.current`), no timing/semantics change.
Verify: `npx eslint <2 files>` → refs 0; `npm run typecheck` → 0; nearest suites (`test:duty-planner` touches staff area; collections suites exercise pending-delete paths).
No user overlap: both files clean and outside dirty modules.

## Batch 3 — `no-unused-vars`, 4 clean files incl. Step area (−5E)
Files:
- `src/modules/operations/vehicle-trips/components/Step_5/GeneralExpensesTable.tsx` @46:21,48:17 (2E)
- `src/modules/settings/components/common/Table.tsx` @16:14 (1E)
- `src/modules/operations/vehicle-trips/components/StepDeliveries.tsx` @65:13 (1E)
- `src/modules/operations/vehicle-trips/components/Step_4/index.tsx` @232:15 (1E; file has other-rule findings — fix ONLY the unused binding, leave the rest)
Fix: delete unused bindings (mechanical).
Verify: `npx eslint <4 files>` → unused-vars 0; `npm run typecheck` → 0; `npm run test:mobile` (covers Step 4/Step 5 components incl. `deliveryStep.test.ts`, `dieselRows.test.ts`).
No user overlap: all 4 files are committed-clean (dirty Step_5 files are `DieselExpensesTable.tsx`/`StepEnd.tsx`, untouched).

## Batch 4 — `no-explicit-any`-only, seven 1x clean files (−7E)
Files (each file's ONLY finding is a single `any`):
- `src/modules/fleet-operations/components/maintenance/PartsTable.tsx`
- `src/modules/fleet-operations/components/reports/ReportCard.tsx`
- `src/modules/fleet-operations/utils/helpers.ts`
- `src/modules/operations/vehicle-trips/services/tripHeaderApiService.ts`
- `src/performance/memory.manager.ts`
- `src/performance/performance.monitor.ts`
- `src/utils/validation.ts`
(`src/types/global.d.ts` also qualifies but is deliberately excluded — ambient declarations have wider blast radius.)
Fix: replace each `any` with the precise narrow type (compile-time only; zero runtime effect — types are erased).
Verify: `npx eslint <7 files>` → 0; `npm run typecheck` → 0 (hard gate — any cascade surfaces here); `npm run test:fleet` + `npm run test:mobile` (covers tripHeaderApiService step tests).
No user overlap: all 7 clean; D9D-5A's protected `fleetRouteConfig.tsx` (`ComponentType<any>`, owner decision) is explicitly excluded.

## Batch 5 — `no-explicit-any`-only, six 2x clean modal/table files (−12E)
Files (each file's ONLY findings are two `any`s):
- `src/modules/fleet-operations/components/documents/DocumentDetailModal.tsx`
- `src/modules/fleet-operations/components/emi/UpcomingEmiList.tsx`
- `src/modules/fleet-operations/components/fastag/FastagBalanceTable.tsx`
- `src/modules/fleet-operations/components/maintenance/BillDetailsModal.tsx`
- `src/modules/fleet-operations/components/maintenance/ViewModal.tsx`
- `src/modules/operations/fuel-expenses/components/FuelViewModal.tsx`
Fix/verify: same as Batch 4 (`npx eslint` → 0, `npm run typecheck` → 0, `npm run test:fleet`).
No user overlap: all 6 clean — dirty fuel files are `FuelBillTable.tsx`/`filterFuelExpenses*` (untouched); dirty modals are `ShopLedgerDetailModal*`/`ShopCollectionDetailModal*` (untouched).

## Deliberately NOT in the 5 (need E2E or touch protected/user code)
- `react-hooks/set-state-in-effect` (61E/36 files, 16 in dirty files) and `react-hooks/exhaustive-deps` (48W/18 files): effect-timing changes alter runtime behavior → each file needs browser E2E verification; schedule as E2E-backed batches later, skipping the 21 dirty-file findings until user work lands.
- `no-useless-assignment` (7, one file) and 88E+10W of backup findings: entirely inside protected `src/deleted_files_backup/` (tsconfig-excluded but linted) → never touch; consider an eslint `ignores` entry in a future config batch instead.
- `no-useless-escape` (2): only in dirty `filterFuelExpenses.ts` → user-owned.
- `backend/*` (2 unused-vars): backend scope, not frontend batches.
- Remaining `no-explicit-any` (379 total): 57 already sit in dirty files; the rest needs per-file typing judgment — continue with any-only micro-batches like 4–5 after these land.
