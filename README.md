# DMR Poultries Frontend + Local Backend

Poultry logistics ERP (React + Vite + Electron) with a new **Phase 1 local PostgreSQL backend**.

## Frontend

```bash
npm install
npm run dev
```

### Duty Planner Excel reports

In **Staff → Duty Planner**, select **Week**, **Month**, or **Custom range**, then
click **Download Excel** beside **Reset** in the same filter bar. The period
controls, role/name filters and custom dates are all in this one panel. Excel
uses the rows and dates shown in the active table, including the applied role
and name filters. Custom ranges include both dates and can cross months and years.

- **Duty Planner** sheet: employee identity on the left, dates across columns,
  leave/off/weekly-off/no-entry counts, **Duty Count** last, and grand totals.
- **Daily Details** sheet: full duty text, source duty type, date, vehicle,
  approved-leave overlap, planned/recorded status, and numeric duty counts.
- Counts include dates through the displayed **as-of** date, excluding future
  plans, leave, off and weekly off from Duty Count. An assignment overrides leave.
- Sample-mode workbooks are explicitly labelled **SAMPLE**. Other pages' PDF
  exports are unchanged.

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
