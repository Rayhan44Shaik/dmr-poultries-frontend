# DMR Poultries ERP

Monorepo layout:

```
DMR-Poultries-ERP/
├── backend/                      # PostgreSQL + Express API (Phase 1)
└── frontend/
    └── dmr-poultries-web/        # React + Vite + Electron UI
```

## Quick start

### Install

```bash
npm run install:all
```

### Backend (local PostgreSQL)

```bash
# Start Postgres (Docker) — or use a local PostgreSQL 16 instance
npm run db:up

cp backend/.env.example backend/.env   # if needed
npm run backend:migrate
npm run backend:seed                   # optional
npm run backend:dev                    # http://localhost:4000
```

Health: `GET http://localhost:4000/api/health`  
Backend docs: [`backend/README.md`](./backend/README.md)

### Frontend

```bash
npm run frontend:dev                   # http://localhost:5173
```

Or from the app folder:

```bash
cd frontend/dmr-poultries-web
npm install
npm run dev
```

## Root npm scripts

| Script | Action |
|--------|--------|
| `install:all` | Install backend + frontend deps |
| `backend:dev` / `backend:migrate` / `backend:seed` | Backend lifecycle |
| `frontend:dev` / `frontend:build` / `frontend:lint` | Frontend lifecycle |
| `db:up` / `db:down` | Docker Compose Postgres |

## Phase plan

1. **Now** — Local PostgreSQL schema + REST API through Staff
2. **Next** — Mobile app talking to this local API/DB
3. **Later** — Move database + mobile clients to cloud (`DATABASE_URL` swap)
