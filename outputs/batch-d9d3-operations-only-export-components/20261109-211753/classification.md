# Batch D9D-3 — diff classification (resume 20261109-211753)

HEAD (unchanged): `a19512b89a67cf782579a59207a05a3e2333d3d2`
Prior interrupted evidence: `outputs/batch-d9d3-operations-only-export-components/20261104-172532/`
Current evidence: `outputs/batch-d9d3-operations-only-export-components/20261109-211753/`

## D9D-3 scope (4 paths + 2 direct importer tests)

1. `src/modules/operations/collections/components/entry/CollectionAmount.tsx`
   - Tracked modification, 16-line diff.
   - Classification: PURE D9D-3 WORK.
   - Content: adds `import { formatCollectionAmountInput } from "./formatCollectionAmountInput";`
     and deletes the 15-line `export function formatCollectionAmountInput(...)` block.
   - No other hunks. No behaviour change; component JSX, props, save/delete flow,
     amount formatting call-site (`formatCollectionAmountInput(e.target.value)`) unchanged.
   - Safe to keep as-is; no user work mixed in this file.

2. `src/modules/operations/collections/components/entry/formatCollectionAmountInput.ts` (untracked)
   - Classification: PURE D9D-3 WORK (new focused module).
   - Body is textually identical to the HEAD block extracted from CollectionAmount.tsx
     (see `old-format.txt` vs `new-format.txt`, `format-body-diff.txt` empty, exit 0).

3. `src/modules/operations/vehicle-trips/components/Step_5/DieselExpensesTable.tsx`
   - Tracked modification, 189-line diff (157 insertions, 48 deletions per stat).
   - Classification: MIXED — D9D-3 extraction + extensive unrelated USER functional work.
   - D9D-3 portion (safe, separable):
     * adds `import { mergeVisibleDieselRows } from "./mergeVisibleDieselRows";`
     * deletes the 14-line `export function mergeVisibleDieselRows(...)` block + doc comment.
     * Call-site `mergeVisibleDieselRows(prev, activeFromSheet, keepEmptySlotsRef.current)` unchanged.
   - USER portion (retained exactly, not touched by this batch):
     * new props/imports: `deleteTripDiesel`, `Pencil/X/Save/Trash2` icons, `onRowsDeleted` prop.
     * litres validation 100 → 200 (`diesel_ltr_max_200`), new `rateRangeError` (rate ≤ 200),
       `min`/`max`/`step` on inputs, error styling, rate display + inline errors.
     * edit/delete row flows: `startEditingRow`, `cancelEditingRow`, `clearDieselRowPatch`,
       `handleDeleteRow` (confirm, `deleteTripDiesel`, `clearDieselRowPatch`, `onRowsDeleted`,
       durable-storage comment), submit-button rework (icon circles, edit/cancel/delete),
       column width 10% → 13%, `getFieldValue` in `litresRangeError`, `rate` in `rowReady`/
       `rowBlockReason` gating, etc.
   - Separation is safe because the current working-tree file already contains BOTH:
     the extraction (import present, helper absent) AND all user hunks intact.
     No further edit was needed; no overwrite performed.

4. `src/modules/operations/vehicle-trips/components/Step_5/mergeVisibleDieselRows.ts` (untracked)
   - Classification: PURE D9D-3 WORK (new focused module).
   - Body is textually identical to the HEAD block extracted from DieselExpensesTable.tsx
     (see `old-merge.txt` vs `new-merge.txt`, `merge-body-diff.txt` empty, exit 0),
     including the doc comment.

5. Direct importers (essential to complete the extraction; allowed by scope):
   - `src/modules/operations/collections/components/entry/CollectionAmount.test.ts`
     (1-line diff: import path `./CollectionAmount` → `./formatCollectionAmountInput`).
     Classification: D9D-3 CONSEQUENTIAL.
   - `src/modules/operations/vehicle-trips/components/Step_5/dieselRows.test.ts`
     (1-line diff: import path `./DieselExpensesTable` → `./mergeVisibleDieselRows`).
     Classification: D9D-3 CONSEQUENTIAL.

## Outside scope (user work — preserved byte-for-byte, never touched)

All other dirty files (28 tracked modifications) are classified as USER/UNRELATED work,
including i18n, masters, pending collections, collectionService, fuel-expenses,
shop-sales, trip-expenses, StepEnd, TripListHeader/Table, useStep5DurableDraft,
TripListPage, pickupImport, reports, etc. Full list in `pre-status.txt` / `post-status.txt`.
Hashes in `pre-preservation-hashes.txt` vs `post-preservation-hashes.txt` are identical
(`hash-compare.txt` empty). No reset/restore/reformat/stage/overwrite/edit was performed
on any of them.

## Conclusion

Safely separable: YES. D9D-3 extraction coexists with user changes; both helper bodies
are proven identical; no overwrite of user work occurred or was needed.
No further source edit was made in this resume (working tree already contained the
completed extraction from the interrupted run).
