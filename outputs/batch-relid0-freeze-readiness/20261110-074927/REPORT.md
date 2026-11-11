# Batch RELID-0 — release identity & freeze readiness (discovery only)

No repository was modified: no commit, tag, push, stash, reset, clean, delete, or move.
All commands were read-only (`rev-parse`, `status`, `log`, `ls-files`, `ls-tree`,
`hash-object`, `sha256sum`, `grep`, `ls`).

## Repository identities (separate, verified via --show-toplevel)
| Repo | Path | HEAD | Branch | Ahead/behind origin/main | Tags | Staged |
|---|---|---|---|---|---|---|
| Root (container) | `D:/Development/DMR-Poultries-ERP` | `6923ee2` | main | ahead 11 / **behind 97, unrelated histories** (`merge-base` empty; origin/main = foreign "freebuff/Codex" history) | 0 | none |
| Backend (nested) | `…/backend` | `11be8e4` | main | ahead 2 | 0 | none |
| Frontend (nested) | `…/frontend/dmr-poultries-web` | `86792d5a` | main | ahead 7 | 0 | none |

Dirty state: root 92 modified + 272 untracked; frontend 44 modified + 5 untracked
(includes uncommitted D9D-5A ×5 files, D9E-1 ×7 files, D9D-3 Diesel/Fuel, ShopLedger);
backend 8 modified + 0 untracked. Nothing staged anywhere.
Nested relationship: **no submodules** (no `.gitmodules` anywhere). Root HEAD holds
`backend/` as a plain-file **tree** (snapshot stops at `sql/059`) and
`frontend/dmr-poultries-web` as a **bare gitlink pin `3552d71`** (stale: actual nested
HEAD is `86792d5a`; `git submodule` tooling will not work). Root additionally tracks a
`frontend/dmr-poultries-web.worktrees/` checkout and a `frontend/dmr-poultries-web.zip`.
`backend/.git` was created today 07:51 during another party's session.
Committed package versions: frontend `dmr-poultries-web@0.0.0`, backend
`dmr-poultries-backend@1.0.0`, root none. Lockfiles: frontend + backend
`package-lock.json` both **committed and byte-clean** (worktree blob ==
HEAD; root-tracked copies unmodified).
Migrations: authoritative history = **backend repo** (`sql/001–101` fully committed,
zero untracked sql). Root's snapshot ends at `sql/059` — root history is NOT
authoritative for backend/database releases.
Evidence packages: frontend `outputs/` holds 8 batch dirs (d9d3, d9d4, d9d5,
d9d5a, d9e0, d9e1, e2e0, relid0) with before/after hashes, lint JSONs, test logs,
reports. Backend and root hold no evidence packages (root `tmp/` holds ad-hoc
fleet probe scripts, untracked).

## 1. Exact blockers to a clean release candidate
B1. **Uncommitted + concurrently-edited tree** (frontend 44M+5U incl. D9D-5A/D9E-1;
backend 8M; root 92M+272U; external party actively editing `reports/`, `i18n`,
`vehicle-trips`) — no immutable candidate can be cut from a moving tree.
B2. **Dual authority over `backend/`**: root tracks backend files as plain tree
(stops at sql/059) while the nested backend repo tracks the same paths to sql/101.
A release commit in one is invisible to the other; must declare ONE authoritative history.
B3. **Root origin is a foreign history** (`merge-base` empty; 97 unrelated commits) —
nothing can be pushed/compared; release must be cut locally and published to a new remote ref.
B4. **No tags in any repo** — no version anchor exists; first tag must be created deliberately.
B5. **Stale bare gitlink** (pin `3552d71` vs actual `86792d5a`, no `.gitmodules`) —
reproducible checkout of the exact frontend tree is impossible from root alone.
B6. **Package versions are placeholders** (`0.0.0` frontend) — no releasable version identity.
B7. **Ongoing nested-repo surgery by another session** (backend `.git` created today,
worktree + zip tracked in root) — freeze must coordinate with that party first.

## 2. Minimal safe freeze sequence (no commands run; owner executes)
F1. Coordinate pause with the concurrent party (reports/i18n/vehicle-trips work) and the
worktree/zip session; confirm no background writes.
F2. Owner classifies every dirty entry (see §3); either commit approved work per-repo
(frontend → backend → root, in that order) or move non-release work out of the trees
(separate branches/worktrees — never `reset --hard`/`clean` on the inhabited tree).
F3. Declare authority: backend releases from the **backend repo** (sql/001–101),
frontend releases from the **frontend repo**; root records release pins only.
F4. Bump versions (`frontend 0.0.0 → 0.1.0-rc.1`, backend `1.0.0 → 1.0.1-rc.1` or owner
scheme), commit, verify clean `git status`, capture lockfile + migration-list hashes.
F5. Tag all three repos identically (e.g. `release/2026-11-10-rc.1`), record SBOM +
build manifest + approval (see §5). Publish to a NEW remote namespace (root origin is foreign).

## 3. Dirty changes needing owner classification
(a) D9D-5A fleet split (5 files, verified lint-clean, uncommitted) — release or defer?
(b) D9E-1 type fixes (7 files, verified) — release or defer?
(c) D9D-3 Diesel/Fuel + ShopLedger + i18n + masters + collections + trip work
(active, externally edited) — almost certainly DEFER (in-flight feature work).
(d) `reports/utils/cumulativeLoadBreakdown.*` (new, external) — defer with (c).
(e) Root 272 untracked (worktrees, zip, tmp probes, docs, backups) — exclude from release tree.
(f) Backend 8 modified (`operations.ts`, trips/validation/services incl. fuel sync) —
mixed with (c)'s feature area; classify file-by-file with the backend owner.

## 4. Completed commits eligible for the release (already immutable)
- Frontend (7, ahead of origin): `67ca901f, 725e614e, 8c896469` (lint batches 1–3),
  `20ef0c30, 36e3cfcd, a19512b8, 86792d5a` (component splits) — eligible as-is.
- Backend (2, ahead of origin): `297501c` (shop-sale 14-day window), `11be8e4`
  (disposable-DB guard) — eligible as-is.
- Root (11, entire local history): eligible only as container history; release pins must
  be re-recorded after F2–F3 (current frontend pin is stale).

## 5. Proposed release-identity scheme
- **Version**: CalVer-style `YYYY.MM.DD-rc.N` suffixed per repo
  (`frontend 0.1.0-rc.1`, `backend 1.0.1-rc.1`) written into `package.json` + a
  `RELEASE_ID` file at each repo root containing the scheme + timestamp + HEAD SHAs.
- **Tags**: identical annotated tag in all three repos, e.g.
  `release/2026-11-10-rc.1`, message listing the three HEAD SHAs + migration ceiling
  (`sql/101`) + lockfile SHA-256s; tags signed if a signing key exists.
- **SBOM**: `npm ls --all --json` (frontend + backend, committed lockfiles) saved as
  `sbom-<repo>-<tag>.json` in the evidence package; Node runtime pinned (`>=22 <26`,
  record exact `node --version` used for the build).
- **Build manifest**: `manifest-<tag>.json` = { repo→HEAD SHA, `git status` empty proof,
  `sql/` file list with SHA-256 (ceiling 101), `package-lock.json` SHA-256 ×2,
  frontend `outputs/` evidence index, Playwright browsers pinned
  (chromium-1234), test command set + results summary }.
- **Approval record**: `APPROVAL.md` signed by owner stating scope (which §3 items
  included/deferred), E2E-0 node-version waiver or Node 22/24 re-run, and the new
  remote ref the tags were published to. No publication to root `origin/main`
  (foreign history) — publish under a new namespace (e.g. `releases/...`).
