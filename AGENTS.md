# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

DMR Poultries ERP (`dmr-poultries-web`) is a client-side React SPA for poultry business management. There is no backend — all data lives in the browser via `localStorage` and IndexedDB (localforage). Authentication is a stub (Sign In navigates to `/dashboard` without credentials).

### Services

| Service | Command | Port | Required? |
|---------|---------|------|-----------|
| Vite dev server | `npm run dev` | 5173 | Yes (primary dev workflow) |
| Vite preview | `npm run build && npm run preview` | 4173 (default) | Only for production-like testing |

No database, Docker, or API server is needed.

### Common commands

See `package.json` scripts:

- **Dev:** `npm run dev` → http://localhost:5173
- **Lint:** `npm run lint` (ESLint; currently reports many pre-existing issues)
- **Build:** `npm run build` (`tsc -b && vite build`; currently fails due to pre-existing TypeScript errors in accounts routes and vehicle-trips components)
- **Preview:** `npm run preview` (requires a successful build first)
- **Electron desktop:** `npm run electron:dev` (starts Vite + Electron; optional)

### Development notes

- `npm run dev` works even when `npm run build` fails, because Vite does not run `tsc` in dev mode.
- Data persists in browser `localStorage`; clearing site data resets all records.
- Optional external dependency: OpenStreetMap Nominatim geocoding in vehicle trip entry (`nominatim.openstreetmap.org`); the app falls back to lat/lon if unavailable.
- No automated test runner is configured (no Jest/Vitest/Cypress/Playwright).

### Hello-world smoke test

1. Start dev server: `npm run dev`
2. Open http://localhost:5173
3. Click **Sign In** (no credentials)
4. Go to **Masters → Shops** and create a shop with unique phone number
