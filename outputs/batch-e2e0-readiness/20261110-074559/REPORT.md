# Batch E2E-0 — browser test environment readiness (discovery only)

No code, config, test, or lockfile was changed. No servers started. No browser tests run.
No user processes touched (PIDs 14472 :4000, 24796 :5173, 7800 :5432 left alone).

## 0. Precondition: D9D-5A is NOT committed
Frontend HEAD is `86792d5a` (D9D-5A work still uncommitted: 3 modified + 2 new fleet files),
plus uncommitted D9D-3 Diesel/Fuel, ShopLedger, and D9E-1 type work — 49 dirty entries total
(see `before/dirty-frontend.txt`, `before/dirty-hashes.txt`). Any browser evidence gathered now
runs against uncommitted code and cannot be used for sign-off until the tree is committed or
the run is explicitly scoped to the working tree.

## 1. Runtime
- Only Node available: **v26.7.0** (npm 11.19.0), single install, **no nvm/version manager**.
- Frontend AND backend `engines` require `>=22 <26` → **Node 26 is out of range (BLOCKER)**.
  No `engine-strict` npmrc, so scripts will still launch, but on an unsupported runtime.
  Required: install Node 22.x or 24.x and re-run with it on PATH.

## 2. Playwright installation
- `@playwright/test ^1.62.1` in frontend devDependencies; browsers present:
  `chromium-1234`, `chromium_headless_shell-1234`, `ffmpeg-1011` (plus `winldd-1007`).
- 8 configs: root `playwright.config.ts` + emi/orders/session-e2e/duty-planner/
  leave-management/staff-module/masters/payment-register/salary-register.
- `tsx` present in both `frontend/node_modules/.bin` and `backend/node_modules/.bin`
  (harness and `dev:web`/`dev` chains need it).

## 3. Port map (measured via netstat, not assumed)
| Port | Use | State now |
|---|---|---|
| 4000 | real backend (dev default) | **LISTENING (user proc 14472, live TIME_WAIT traffic)** |
| 5173 | Vite dev default; session-e2e baseURL (no own webServer) | **LISTENING (user proc 24796)** |
| 5432 | local PostgreSQL (operational `dmr_poultries` default) | **LISTENING (user proc 7800)** |
| 4100 | isolated E2E harness API (PGlite default) | FREE |
| 5199 | root trip-workflow + leave-management Vite | FREE |
| 5196/5197/5198/5203 | masters / emi / duty-planner / staff-module Vite | FREE |
| 5174 | orders suite (external env only) | FREE |
Safe isolated ports exist for every suite that spins its own server. Never bind 4000/5173/5432.

## 4. Backend/frontend E2E scripts and environment
- Root suite (`test:e2e`): Playwright starts (1) `node --import tsx tests/e2eHarness.ts`
  with cwd `DMR-Poultries-ERP/backend`, health `127.0.0.1:4100/api/health`
  (`reuseExistingServer:false`), then (2) `npm run dev -- --port 5199 --strictPort`
  with `VITE_API_BASE_URL=http://127.0.0.1:4100/api`. Fully isolated by default.
- Harness env knobs: `E2E_API_PORT` (dflt 4100), `E2E_CORS_ORIGIN` (dflt 5199 origin),
  `E2E_TEST_OWNER_USERNAME` (dflt `test-owner-4100`), optional `E2E_DATABASE_URL`.
  Default = PGlite in-process PG (no real DB, no credentials, self-seeds E2E-*
  vehicles/employees/farm/shops + Step-4-ready trip; browser login
  `test-owner-4100` / `Test-only-password-123!`).
- EMI suite: API traffic intercepted by the tests; **no backend/database at all** (safest).
  Honors `EMI_TEST_BASE_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- masters: `MASTERS_TEST_BASE_URL` override or own Vite :5196 (`VITE_API_BASE_URL=/api`
  → proxies to real :4000). orders: **no webServer** — needs an external env at
  `ORDERS_PREVIEW_URL` or :5174 (plus `ORDERS_E2E_EXISTING=1` root mode).
- duty-planner (:5198), leave-management (:5199), staff-module (:5203) spin their own
  Vite with `VITE_API_BASE_URL=/api` → **they call the REAL backend on :4000**.
  session-e2e has no webServer and targets the live dev stack (:5173 → :4000 → local PG).
- Backend scripts: `e2e:db:setup` = `setupE2eDatabase.ts --reset` (DROP+CREATE+migrate+seed);
  `db:migrate`, `db:reset`, `db:seed`, `seed:demo`, `test`, `test:masters`, `test:typecheck`.
- Backend boots with zero required env (`PORT`→4000, `DATABASE_URL`→built-in
  `postgresql://dmr:dmr_local_dev@localhost:5432/dmr_poultries`, `CORS_ORIGIN` parsed).
  Default is the operational DB — safe only because the isolated path never uses it.

## 5. Disposable-database guard coverage (gap found)
- `disposableDbGuard.ts`: allow-list `dmr_d4_verify`, `dmr_test_*`, `dmr_e2e_*`, `*_test`;
  hard-forbids `dmr_poultries*` (incl. prefix), `postgres`, `template0/1`; throws
  `OperationalDatabaseRefusedError` before any statement. Imported by 12 backend
  unit/service test files.
- **GAP: none of `e2eHarness.ts`, `setupE2eDatabase.ts`, `tests/helpers/testDb.ts`,
  `tests/helpers/app.ts` import the guard.** `setupE2eDatabase.ts` has its own inline
  check (refuses unless the name ends `/_e2e$/i` and differs from the operational name),
  which is WEAKER than the guard (it would DROP a backup named `dmr_poultries_e2e`;
  the guard forbids that prefix). The harness with `E2E_DATABASE_URL` set performs
  **no name validation at all** — it seeds E2E fixtures into whatever URL is given.
  Safe rule: run the harness **without** `E2E_DATABASE_URL` (pure PGlite), or export a
  verified `dmr_e2e_*` name and eyeball it first.

## 6. Test users / seeds / DBA access
- Isolated root suite: no external seed or DBA access needed — harness self-seeds and
  PGlite needs no server, user, or password.
- Real-Postgres E2E DB (`e2e:db:setup --reset`): needs a Postgres superuser/createdb
  role (admin connection derives from `E2E_DATABASE_URL` with `/postgres`), plus
  migrate+seed time. Credentials live in `backend/.env.e2e.local` (auto-generated).
- Non-harness suites (duty/leave/staff/masters/orders/session): need real users in the
  operational dev DB (`createAppUser.ts`, `seed:demo`) — i.e. they inherently touch
  operational data (duty-planner even injects a fake `dmr-auth-token` and writes duty
  data to :4000). No isolated seed path exists for them today.

## 7. Trustworthiness vs current dirty work
Current dirty work makes E2E evidence indicative-only: D9D-5A (fleet routes split),
D9E-1 (7 type-only edits), D9D-3 Diesel/Fuel components, ShopLedger pages, i18n —
49 dirty entries, some still being edited by a concurrent party (hashes moved during
this inspection). The concurrent editor is also active, so timings/flakiness attribution
is unreliable. Commit (or explicitly scope) before any sign-off run.

## 8. Exact next execution plan (safe, isolated) — NOT run
Prereqs (blockers first): (a) install Node 22/24 and put it first on PATH
(`node --version` must satisfy `>=22 <26`); (b) confirm ports 4100 + 5199 free
(`netstat -ano -p TCP | findstr 4100` / `5199`); (c) commit or record the tree state.
Then, in order, without touching operational services:
1. `cd DMR-Poultries-ERP/backend && node --import tsx tests/e2eHarness.ts` (expect
   `E2E harness ready on http://127.0.0.1:4100` + JSON meta; leave running).
   Do NOT set `E2E_DATABASE_URL` (stay on PGlite).
2. New shell: `cd frontend/dmr-poultries-web && $env:VITE_API_BASE_URL='http://127.0.0.1:4100/api'; npm run dev:web -- --port 5199 --strictPort`
   (expect `Local: http://localhost:5199`; `--strictPort` guarantees no silent drift).
3. New shell: `npx playwright test --config playwright.config.ts --project trip-workflow`
   (single worker, PGlite-backed, trace/screenshot on failure only).
4. Teardown: Ctrl+C both servers (SIGINT/SIGTERM close harness cleanly); collect
   `test-results/` + `playwright-report/`; verify operational DB untouched
   (no new E2E-* rows — expected: zero, PGlite is in-process).
EMI-only alternative (no backend at all): `npm run test:e2e:emi`.

## Blockers (must clear before any browser run)
1. Node 26 out of engines range — install Node 22/24. 2. Live dev stack on
4000/5173 + local PG on 5432 — use only the isolated ports above, never retarget a
suite at 4000/5173 data. 3. Uncommitted + concurrently-edited tree — evidence is
indicative only until committed/scoped. 4. Any future `E2E_DATABASE_URL` use needs a
verified disposable name (harness does not validate it; `--reset` DROPs).
