# Batch D9D-3 — diff classification (resume 20261109-213752)

HEAD (required + verified pre/post): `a19512b89a67cf782579a59207a05a3e2333d3d2`
Prior evidence: `outputs/batch-d9d3-operations-only-export-components/20261104-172532/`
Also: `20261109-211753/`. Current: `20261109-213752/`.

## Scope (4 paths + essential direct importers)

1. `src/modules/operations/collections/components/entry/CollectionAmount.tsx`
   - Tracked, 16-line diff. PURE D9D-3: adds
     `import { formatCollectionAmountInput } from "./formatCollectionAmountInput";`
     and deletes the 15-line `export function formatCollectionAmountInput(...)` block.
     No other hunks. Component JSX/props/save flow/formatting call-site unchanged.

2. `src/modules/operations/collections/components/entry/formatCollectionAmountInput.ts` (untracked)
   - PURE D9D-3 new module. Body identical to HEAD block
     (`old-format.txt` vs `new-format.txt`, `format-body-diff.txt` empty, exit 0).

3. `src/modules/operations/vehicle-trips/components/Step_5/DieselExpensesTable.tsx`
   - Tracked, 189-line diff. MIXED but safely separable:
     - D9D-3 portion: adds `import { mergeVisibleDieselRows } from "./mergeVisibleDieselRows";`
       and deletes the 14-line `export function mergeVisibleDieselRows(...)` + doc comment.
       Call-site unchanged.
     - Protected USER portion (retained exactly, untouched): `deleteTripDiesel` import,
       Pencil/X/Save/Trash2 icons, `onRowsDeleted` prop, litres 100→200 validation,
       `rateRangeError`, min/max/step inputs, error styling, edit/cancel/delete flows
       (`startEditingRow`, `cancelEditingRow`, `clearDieselRowPatch`, `handleDeleteRow`
       with confirm + `deleteTripDiesel` + `onRowsDeleted`), submit-button rework,
       column width, `getFieldValue`/`rate` gating. Current file already contains both.
   - No further edit needed; none performed.

4. `src/modules/operations/vehicle-trips/components/Step_5/mergeVisibleDieselRows.ts` (untracked)
   - PURE D9D-3 new module. Body identical to HEAD block incl. doc comment
     (`old-merge.txt` vs `new-merge.txt`, `merge-body-diff.txt` empty, exit 0).

5. Direct importers (essential): `CollectionAmount.test.ts` and `dieselRows.test.ts`
   each 1-line import retarget (`./CollectionAmount` → `./formatCollectionAmountInput`;
   `./DieselExpensesTable` → `./mergeVisibleDieselRows`). D9D-3 consequential.

## Out of scope — protected user work

All other 28 tracked dirty files (i18n, masters, pending collections, collectionService,
fuel-expenses, shop-sales, trip-expenses, StepEnd, TripListHeader/Table,
useStep5DurableDraft, TripListPage, pickupImport, reports, etc. — see `pre/post-status.txt`)
are USER/UNRELATED. Hashes identical pre/post (`hash-compare.txt` empty).
No reset/restore/stage/overwrite/reformat performed on any of them.

Conclusion: separable YES. No overwrite of user work; zero source edits made in this resume
(extraction already complete in working tree).
