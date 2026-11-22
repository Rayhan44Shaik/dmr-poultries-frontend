# COMMIT-08-AUDIT findings — 08a4be58 ("update 11/11/2026")

Read-only audit. Nothing was modified, staged, committed, reset, reverted,
rebased, stashed, cleaned, deleted, pushed, tagged, or amended. Raw captures
in files 00–10 of this directory.

## Identity and position

- Commit `08a4be58ad40b1b72135ff9bc0b8f1c3d4a659e4`, parent
  `56b539aaeb01a68401ee6c862cd85c66b54cd0` (linear: `56b539aa..08a4be58`
  contains only this commit).
- Author Rayhan Shaik, 2026-11-11 22:05:53 +0530, empty body, vague subject.
- Current HEAD **is** 08a4be58 (`08-head.txt`); local `main` is in sync with
  `origin/main`, which also points at 08a4be58 — **the commit is pushed**.

## 1. Path groups (196 paths: 147 Added, 49 Modified)

- **Production application source — 49 paths** (`02`, `03`):
  47 modified + 2 added. Areas: collections entry/pending/pages/services
  (incl. `EditCollectionModal` +134, `ShopCollectionDetailModal` +179,
  `PendingCollectionsPage` ±124), fuel-expenses, shop-sales pages, trip
  expenses, vehicle-trips Step 5 (`DieselExpensesTable` +189), trip master
  table/header, reports ledger (`ShopLedgerPage` ±374 the largest file),
  `MasterDropdown`, i18n `operations.*`/`reports.*` (en+te), `index.css`.
  Added: `formatCollectionAmountInput.ts`, `mergeVisibleDieselRows.ts`
  (no history before this commit).
- **Tests/E2E — 2 paths** (`04`): `tests/e2e/trip-workflow.e2e.spec.ts`
  (681 lines changed vs parent), `tests/orders/orders-live-workflow.spec.ts`
  (4-line touch).
- **Evidence/output — 144 paths** (`05`): 10 batch dirs
  (d9d3 ×3 runs, d9d4, d9d5, d9d5a, d9e0, d9e1, e2e0, relid0) plus a stray
  `outputs/batch-e2e5b-search-dropdown/probe-t16-fail.png` screenshot.
  `outputs/` did not exist at the parent (`git ls-tree 56b539aa outputs/`
  is empty) — every one of these 144 is newly introduced junk.
- **Temporary/config — 1 path** (`06`): root-level
  `playwright.e2e5b-tmp.config.ts`, which declares itself
  "TEMPORARY E2E-5B runner (deleted after the evidence runs)". A root
  `playwright.*.config.ts` can be auto-discovered by editors/CI.
- **Unknown/unrelated — 0 paths.** Everything falls in the four groups
  above; the unrelated part is the *mixing*, not mystery files.

## 2. Parent vs HEAD

Parent 56b539aa ("Fix Orders partial delivery reopen state") is a clean
2-file fix (`ordersUtils.ts` + `shopDelivery.test.ts`). HEAD adds the 196
paths above on top. `08a4be58..HEAD` is empty (HEAD is the commit).

## 3. Overlap with earlier valid commits

The recent valid commits touch files with **zero intersection** with
08a4be58's 52 non-output paths: 56b539aa/55c77132 (`orders/utils/*`),
fafe3ac9/225681da (`fleet-operations/*`), 8c547a67 (fleet/auth/perf
helpers), 86792d5a (auth/KPI extracts), a19512b8 (`tests/i18n/*`).
Per-file history of all 49 modified files shows the newest prior touch is
`0bf06791` (2026-11-04) or older — i.e. **none of the 08a4be58 production,
i18n, or E2E deltas is represented by any earlier valid commit**; they are
new, unreviewed changes swept in with the evidence dump. Older "Update"
commits are ancestors (inherited content, not duplication).

## 4. Paths that should never have been committed

- All 144 `outputs/**` evidence files (run logs, patches, hashes, status
  snapshots, a PNG) — agent working material, several embedding absolute
  local paths; they bloat the repo and can leak environment detail.
- `playwright.e2e5b-tmp.config.ts` — self-described throwaway runner config
  at repo root.

## 5. Trip Workflow E2E: committed vs uncommitted

- 08a4be58 contains an **earlier generation** of the spec (still asserts the
  un-fakeable filed flag, no `bg-rose-500`, no +3d clock, old tests
  21/23/24/25/26/28 assertions).
- The **current E2E-5B-R1 batch fixes are still uncommitted**: worktree-only
  delta of 65+/29− across 11 hunks (tests 21, 23, 24, 25, 26, 27, 28 —
  `10-uncommitted-spec-numstat.txt`; worktree `M tests/e2e/…
  in `09-worktree-status.txt`). Markers added by this batch (`bg-rose-500`,
  `Date.now() + 3` days clock) are absent from the committed blob; the
  single `setFixedTime`/`farmBirdTypeId` hits in the committed blob are
  pre-existing (test-28 yesterday-clock, original code), not the batch fixes.
- `tests/orders/orders-live-workflow.spec.ts` is committed as-is (worktree
  clean for it). The untracked `dropdownReopen.*` pair and the other 7
  modified files are pre-existing worktree state, not part of this commit.

## 6. Release-safety

**Not release-safe and not claimed as such.** 08a4be58 bundles ~2,600
changed production/test lines with 144 evidence files under a vague message,
is already pushed, and its E2E spec generation is superseded by uncommitted
fixes. It must not be treated as a clean, reviewable, or releasable unit.
