# DMR Poultries Frontend + Local Backend

Poultry logistics ERP (React + Vite + Electron) with a new **Phase 1 local PostgreSQL backend**.

## Frontend

```bash
npm install
npm run dev
```

### Duty Planner

**Staff → Duty Planner** has compact weekly, monthly and custom-range filters.
**Download Excel** stays beside **Reset** and exports the active table's filtered
employees and dates, with each employee's **Duty Count** in the last column.
The table and workbook have no grand-total row or long explanatory footer.

- Supervisor, Driver, Helper and Loader remain manually assigned.
- Missing duties for other active staff default to **Office** (or **Collection**
  for collectors/collection departments), with **Weekly Off on Sunday**.
  Existing explicit exceptions are preserved. Defaults are not generated before
  joining, for inactive staff, or for orphan historical records.
- Due defaults are automatically saved using the normal staff assignment API
  for editable weeks after the previous week is closed. Failed saves are shown
  with a retry action; closed weeks and existing assignments are not overwritten.
- **Approved leave always overrides duty**, including automatic duties. Pending
  and rejected requests do not change duties. Leave updates refresh the planner.
- Future dates show **empty dotted cells**, remain excluded from counts, and do
  not expose future duty/vehicle details in Excel. Existing future assignments
  are retained rather than deleted.
- **Daily Details** keeps the source types, vehicle and approved-leave information
  for completed dates. Sample workbooks are explicitly labelled as samples.
- English/Telugu follows the app language switch, including filters, dates,
  duty labels, pickers, messages and Excel. Employee names/backend values stay
  unchanged. Telugu fonts are bundled; the calendar uses opt-in localization.
- Salary Register and other pages' exports are unchanged.

Focused checks (browser tests mock the staff API; no database is needed):

```bash
npm run test:duty-planner
npx playwright install chromium
npm run test:e2e:duty-planner
```

## Backend (PostgreSQL — Masters + Trip Steps 1–5 + Staff)

See [`backend/README.md`](./backend/README.md).

```bash
# PostgreSQL must be running locally (or: cd backend && docker compose up -d)
npm run backend:install
npm run backend:migrate
npm run backend:seed   # optional
npm run backend:dev    # http://localhost:4000
```

### Phase plan

1. **Now** — Local PostgreSQL schema + REST API through Staff
2. **Next** — Mobile app talking to this local API/DB
3. **Later** — Move database + mobile clients to cloud (`DATABASE_URL` swap)
