# Batch D9D-3 — resume summary (20261109-213752)

HEAD start/end: `a19512b89a67cf782579a59207a05a3e2333d3d2` (`head.txt`/`head-post.txt`).
No commit/push/tag/reset/stash/clean/rebase. No new batch. Zero source edits
(extraction already complete in working tree); evidence-only writes under
`outputs/batch-d9d3-operations-only-export-components/20261109-213752/`.

Changed paths (verified, not re-edited): CollectionAmount.tsx, DieselExpensesTable.tsx,
formatCollectionAmountInput.ts (new), mergeVisibleDieselRows.ts (new),
CollectionAmount.test.ts, dieselRows.test.ts (import retargets). Full diff:
`d9d3-scope-diff.patch` / `d9d3-scope-stat.txt`. Importer maps:
`format-importers.txt`, `merge-importers.txt`.

Source-identity proof: `format-body-diff.txt` and `merge-body-diff.txt` both empty
(exit 0) — moved bodies textually identical to HEAD except required import/export.

Verification:
1. Targeted ESLint (6 D9D-3 files): 8 errors, 0 `only-export-components`
   (`targeted-eslint.log`, TARGETED_EXIT=1). Remaining are out-of-scope
   pre-existing/user: 6× `no-explicit-any`, 1× `_dieselAmounts` unused, 1×
   `set-state-in-effect:735`. Left unfixed per rules. Both target findings gone.
2. Typecheck `npx tsc -p tsconfig.app.json --noEmit`: PASS (`typecheck.log`, `TSC_EXIT=0`,
   empty output; ~330 s runtime).
3. Focused tests `tsx --test CollectionAmount.test.ts dieselRows.test.ts`: PASS 5/5
   (`focused-tests.log`, FOCUSED_EXIT=0).
4. Full lint `npx eslint .`: 534 problems (486 errors, 48 warnings) (`full-lint.log`,
   FULL_LINT_EXIT=1 expected). `only-export-components` count = 8, all unrelated
   (IdleSessionGuard ×1, fleet routes ×6, KpiCardGrid ×1). DieselExpensesTable appears
   only for any/unused/effect; CollectionAmount/format/merge modules clean. Both
   operations target `only-export-components` errors confirmed gone.
5. Lint delta (measured): prior `20261104-172532` = 530 (484e+46w); `20261109-211753` =
   534 (486e+48w); current `20261109-213752` = 534 (486e+48w). Delta vs prior = +4
   (+2e+2w) from intervening user work (32 dirty vs 7 prior); delta vs 211753 = 0.
   `486→484` does NOT apply to current baseline.
6. Preservation: pre/post hashes identical (`hash-compare.txt` empty, exit 0, 35 lines);
   pre/post status identical (exit 0). Every non-scope dirty file byte-for-byte preserved.

Behaviour: JSX, public APIs (+ user `onRowsDeleted`), amount formatting, fuel
calculations, save/delete flow, notifications, visible behaviour preserved.

Stopped without committing.
