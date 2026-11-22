# Safe corrective plan (forward-only — no reset, revert, rebase, force push, deletion, or history rewriting)

08a4be58 is HEAD **and pushed** (`main` in sync with `origin/main`), so the
commit stays in history permanently. All correction happens in new commits.

1. **Quarantine, do not delete.** Leave the 144 `outputs/**` files and
   `playwright.e2e5b-tmp.config.ts` in history. In a new commit, add
   `.gitignore` rules for `outputs/`, `playwright.*tmp*.config.ts`,
   `probe-*.png`, and `test-results/` so no further evidence or throwaway
   runner configs can be committed. (Ignoring does not untrack existing
   files — that is intentional and accepted.)
2. **Review production diff as-is.** Review `56b539aa..08a4be58 -- src`
   (notably `ShopLedgerPage`, `DieselExpensesTable`, the collection modals,
   i18n en/te pairs) with normal review tooling; address findings with
   **follow-up fix commits**, never by touching 08a4be58.
3. **Guard CI.** Add a check that fails if `outputs/` tracked-file count
   grows or a root `playwright.*tmp*` config appears.
4. **E2E spec.** Keep the E2E-5B-R1 fixes uncommitted until the batch rule
   allows; then commit them as a **new, scoped, well-described commit**
   (never amend 08a4be58).
5. **Release.** Cut any release from a new commit on top after review, with
   notes recording that 08a4be58 mixes unrelated work + evidence and must
   not be cherry-picked or presented as a clean unit. Do not branch a
   release from its parent to "skip" it — descendants are already pushed.
6. **Housekeeping (optional, non-git).** Worktree copies of evidence remain
   usable locally; no git operation is needed for that.
