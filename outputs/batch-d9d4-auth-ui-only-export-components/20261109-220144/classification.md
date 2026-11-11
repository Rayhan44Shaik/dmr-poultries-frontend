# Batch D9D-4 — diff classification (20261109-220144)

HEAD: `a19512b89a67cf782579a59207a05a3e2333d3d2` (pre/post verified).
ESLint JSON discovery (`eslint-full.json`, `only-export-findings.json`):
- TOTAL `only-export-components` = 8.
- `src/modules/auth/IdleSessionGuard.tsx :: 32:10` — IN SCOPE (auth target).
- `src/ui/KpiCardGrid.tsx :: 35:17` — IN SCOPE (UI target).
- `src/modules/fleet-operations/routes.tsx :: 7-12` (6 findings) — OUT OF SCOPE, untouched.
- Exact paths reported before editing as required; expected targets confirmed,
  fleet routes explicitly excluded.

## Scope edits (7 modified + 2 new, no other files touched)

1. `src/modules/auth/IdleSessionGuard.tsx` — removed 3 non-component exports
   (`export { isGenuineActivityEvent }`, `export { ACTIVITY_KEY as ... }`,
   `export const IDLE_SIGNOUT_KEY`) and dropped `isGenuineActivityEvent` from the
   `./idleActivity` import (now unused). Component JSX/effects/timeout/redirect
   behaviour untouched.
2. `src/modules/auth/idleSessionMeta.ts` (new) — adjacent non-component module
   exporting `IDLE_SIGNOUT_KEY`, `ACTIVITY_BROADCAST_KEY`, `isGenuineActivityEvent`.
   Values identical to HEAD (`old-idle-exports.txt` vs `new-idle-meta.txt`).
3. `src/modules/auth/ChangePasswordDialog.tsx`, `src/modules/auth/LoginPage.tsx`,
   `src/providers/AuthProvider.tsx` — direct importers: `IDLE_SIGNOUT_KEY` source
   `./IdleSessionGuard` → `./idleSessionMeta` (1 line each). No logic change.
   `src/routes/AuthGate.tsx` still imports default guard — unchanged.
4. `src/ui/KpiCardGrid.tsx` — removed moved non-components (`KpiTone`,
   `KpiCardItem`, `CompactKpiValue`, `compactKpiValue`), added
   `import type { CompactKpiValue, KpiCardItem, KpiTone } from "./kpiCardValue"`,
   trimmed now-unused `ReactNode`/`LucideIcon` imports. `KpiMetricValue`,
   `KpiCardGrid`, default memo remain (all components). Rendering/tokens unchanged.
5. `src/ui/kpiCardValue.ts` (new) — adjacent module with exact moved bodies
   (`old-kpi-extract.txt` vs `new-kpi-extract.txt` identical, 1639 chars,
   `KPI_IDENTICAL`).
6. `src/ui/index.ts` — barrel split: components from `./KpiCardGrid`, helper/types
   from `./kpiCardValue`. All barrel importers (Fuel/Shop/Trip/Maintenance KPI cards,
   PendingCollectionsSummary, ShopCollectionDetailModal, VehicleAnalyticsPage)
   keep identical import specifiers — no edits needed outside scope.
7. `src/ui/KpiCardGrid.test.ts` — direct importer: `compactKpiValue` source
   `./KpiCardGrid` → `./kpiCardValue`.

## Out of scope — preserved
All 32 other dirty files (i18n, masters, operations collections/fuel/shop-sales/
trip-expenses/vehicle-trips/reports, D9D-3 modules, etc.) byte-identical:
`EXCLUDED_CHECKED=32 BAD=0 / ALL_EXCLUDED_UNCHANGED` (`excluded-hash-check.txt`,
`excluded-post-hashes.txt`). No backend/routes/migrations/Shop Sales/Fuel/Collection
logic/deps/lockfiles/ESLint config/backup/broad refactor. No `any`, no disable
comments, no config exceptions.
