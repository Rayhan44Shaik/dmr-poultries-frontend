# Batch D9E-1 — safe `any` removal (7/7, D9E-0 Batch-4 group)

Gate: PROCEEDED — D9E-0 identified exactly this self-contained group (7 `no-explicit-any`
in clean production files, no route/config changes, no DTO redesign). All 7 files verified
clean (`git status` empty) before editing. No commit made; HEAD unchanged (`86792d5a`).

## Every replaced type (old → new)
1. `fleet-operations/components/maintenance/PartsTable.tsx:17`
   `(index, field: keyof PartItem, value: any)` → generic `<K extends keyof PartItem>(index, field: K, value: PartItem[K])` (narrow existing zod-inferred domain type; all 4 call sites infer correctly).
2. `fleet-operations/components/reports/ReportCard.tsx:8`
   `icon: React.ComponentType<any>` → `React.ComponentType<{ className?: string }>` (matches sole usage `<Icon className=...>`; all 10 lucide icons in `VehicleReportsPage` assignable — caller file untouched).
3. `fleet-operations/utils/helpers.ts:23`
   `<T extends (...args: any[]) => void>` → `<T extends (...args: never[]) => void>` (safe constraint accepts every function type; `fn`/`Parameters<T>`/return unchanged; zero importers).
4. `operations/vehicle-trips/services/tripHeaderApiService.ts:310` + local `interface ApiPhoto { key?: unknown; mime?: unknown; data?: unknown }`
   `(photo: any)` → `(raw.pickupPhotos as ApiPhoto[]).map((photo) => …)` (narrowing cast to precise local interface — not `as any`/`unknown as`; `str()` already takes `unknown`; null elements still throw exactly as before).
5. `performance/memory.manager.ts:7` + local `PerformanceMemoryReading` / `PerformanceWithMemory extends Performance`
   `performance as any` → `performance as PerformanceWithMemory` (direct downcast, no `unknown as`; guarded `perf.memory` access unchanged).
6. `performance/performance.monitor.ts:24` — same as (5).
7. `utils/validation.ts:7` — `(value: any)` → `(value: unknown)` (truthiness check unchanged; zero importers).

No `as any`, `unknown as`, disables, config exceptions, or weakening casts added (repo-wide grep confirms; the one `as unknown as` at tripHeaderApiService:703 is pre-existing and untouched). Payload shapes, API contracts, UI behavior, and error handling preserved — all changes are annotation-only (erased at compile; identical emit).

## Verification (measured)
- Targeted ESLint (7 files): **0 errors, 0 warnings** (was 7E).
- Full lint: **478 → 471 errors (−7), warnings 48 → 48**; `no-explicit-any` 379 → 372; `only-export-components` stays 0. The +2 files (962 → 964) are the external party's new `cumulativeLoadBreakdown.*` (0 findings) — net delta fully explained.
- `npm run typecheck`: **exit 0** (hard gate for the PartsTable generic + ReportCard prop + debounce constraint).
- `npm run test:mobile`: **151/151 pass** (covers `mapApiTripToTrip`/payload mapping around the ApiPhoto change).
- `npm run test:fleet`: **20/21** — identical before/after; the single failure is the pre-existing `FleetPages` gutter-width assertion on an untouched file.
- Scope diff: exactly the 7 files (29 insertions, 7 deletions); no route/config/test/backend/lockfile/backup edits.

## Preservation hashes
- Before/after SHA-256 captured for all dirty files. Non-scope delta is external-only: `CumulativeQuantityCell.tsx` edited + 2 new `reports/utils/cumulativeLoadBreakdown.*` files by the concurrent editor; all other non-scope dirty files byte-identical. No D9E-1 edit touched Diesel/Fuel, ShopLedger, Shop Sales, backend, migrations, config, or D9D-5A files.
