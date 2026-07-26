




# IMP NOTE: Add ```domainname``` in .env file after successfull setup to avoid cors error
```frontend_url=https://domainname.com,https://www.domainname.com```


# Setup Guide

This is the entry point for getting the app running locally, and for understanding how configuration (environment variables, server details, secrets) is managed across local development and production. For the one-time production server setup itself, see `docs/superpowers/deploy-runbook.md` — this guide covers local dev plus the *concepts* behind how config flows into both environments.

## 1. Project Structure

```
backend/     Express API (Node.js, MySQL via mysql2, JWT auth)
frontend/    React 19 + Vite admin panel and public site
deploy/      Production Nginx config (see deploy-runbook.md)
```

The two apps are independent projects with their own `package.json`, their own dependency install, and — importantly — their own, differently-behaved environment variable systems (details below).

## 2. Prerequisites

- Node.js 22.x (LTS)
- A running MySQL server (local install, or any MySQL-compatible managed instance)
- npm (ships with Node)

## 3. Environment Variables

### 3.1 Backend (`backend/.env`)

The backend reads configuration through `backend/src/config/env.js`, which calls `dotenv.config()` — this loads `backend/.env` into `process.env` **at server startup, every time the process runs.** Change the file, restart the process, the new value takes effect immediately.

`backend/.env` is listed in `backend/.gitignore` and is **never committed** — this is correct and intentional, because it holds real secrets (DB password, JWT signing secret, the admin account's password). `backend/.env.example` is the committed template that documents which keys exist, with placeholder values.

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | `development` locally, `production` on the server | `development` |
| `PORT` | Port the Express server listens on | `5000` |
| `FRONTEND_URL` | Comma-separated list of origins allowed by CORS | `http://localhost:5173,http://127.0.0.1:5173` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | *(your password)* |
| `DB_NAME` | MySQL database name | `physio_clinic` |
| `JWT_SECRET` | Signs/verifies admin session tokens — **must** be a long random string in production | *(generate with `openssl rand -base64 48`)* |
| `JWT_EXPIRES_IN` | Session token lifetime | `8h` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Used once by `npm run seed:admin` to create the first admin login | — |

**Setting these up locally:**

```bash
cd backend
cp .env.example .env
# edit .env with your real local MySQL credentials
```

### 3.2 Frontend (`frontend/.env`)

This is where the two apps diverge, and it's the source of one of your questions below.

The frontend reads exactly one variable, `VITE_API_URL`, in two places:
- `frontend/src/services/api.js` — the axios `baseURL` for every API call
- `frontend/src/utils/photoUrl.js` — derives the origin used to load uploaded photos

**The critical difference from the backend: Vite environment variables are baked into the JavaScript bundle at *build time* (`npm run build`), not read at runtime.** There is no server process re-reading `frontend/.env` on every request — once `npm run build` runs, whatever value `VITE_API_URL` had at that moment is permanently embedded in the output files in `frontend/dist/`. Editing `frontend/.env` after a build has zero effect until you rebuild.

`frontend/.env.example` documents the one variable:
```
VITE_API_URL=http://localhost:5000/api
```

**Setting this up locally:**
```bash
cd frontend
cp .env.example .env
# the default (http://localhost:5000/api) matches the backend's default PORT — usually no edit needed for local dev
```

## 4. Local Development Setup

```bash
# 1. Backend
cd backend
cp .env.example .env        # edit with your local MySQL credentials
npm install
npm run migrate             # creates all tables (idempotent, safe to re-run)
npm run seed:admin          # creates your first admin login from ADMIN_* values in .env
npm run dev                 # starts on http://localhost:5000

# 2. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # starts on http://localhost:5173
```

Visit `http://localhost:5173` for the public site, `http://localhost:5173/login` for the admin panel.

## 5. How Environment Variables Reach Production

**Backend:** `backend/.env` is created once, by hand, directly on the VPS during the one-time setup in `docs/superpowers/deploy-runbook.md` (§3). It is never part of any git commit and never touched by the GitHub Actions deploy workflow — the workflow's rsync step explicitly excludes it (`.github/workflows/deploy.yml`, `--exclude '.env'`), so every deploy leaves the server's real secrets untouched. To change a backend config value in production, edit `backend/.env` on the server directly, then `pm2 reload ecosystem.config.cjs --env production`.

**Frontend:** Because Vite bakes `VITE_API_URL` in at build time, and the production build happens on GitHub's CI runner (not your machine, not the VPS — see `docs/superpowers/specs/2026-07-25-phase7-deployment-design.md` for why), the CI workflow sets it explicitly as a build-step environment variable in `.github/workflows/deploy.yml`:

```yaml
- name: Build frontend
  working-directory: frontend
  env:
    VITE_API_URL: /api
  run: npm run build
```

`/api` is a relative path, not `http://localhost:5000/api` — it resolves against whatever domain the browser is actually on, and Nginx proxies `/api/*` to the backend on that same server (see `deploy/nginx.conf`). This is deliberate: it means the production build never hardcodes a hostname, so it keeps working even if the domain changes later (e.g. swapping `naveennallanti.com` for `danielsphysiotherapy.com` — no rebuild-time value to update).

## 6. Your Questions, Answered

### "How can I configure variables like server details (DB host, port, etc.)?"

Locally: edit `backend/.env` directly, restart `npm run dev`. In production: edit `backend/.env` on the VPS directly (it was created once during the runbook's §3), then `pm2 reload ecosystem.config.cjs --env production` to pick up the change. There's no dashboard/UI for this — it's a plain file on whichever machine is running the process, by design (matches the project's "no extra tooling beyond what's needed" approach used throughout).

### "In local I have a `.env` file, but you haven't committed that file to git — how do I manage environment variables for both backend and frontend?"

For the **backend**, that's correct and intentional — `backend/.env` is listed in `backend/.gitignore` and was never committed. This is standard practice: `.env` holds real secrets (DB password, JWT secret), so it stays local/per-machine, and `backend/.env.example` (which *is* committed) documents the shape without the real values. Anyone setting up the project runs `cp .env.example .env` and fills in their own values — that's the mechanism.

For the **frontend**, I found something worth flagging: `frontend/.env` **was** actually committed to git (in the very first "Frontend scaffold" commit), even though `frontend/.gitignore` also lists `.env` — `.gitignore` only prevents *new* untracked files from being added, it doesn't retroactively untrack a file that's already committed. That inconsistency is exactly what caused the bug the Phase 7 review caught: the committed value (`http://localhost:5000/api`) would have been baked straight into every production build if the CI workflow hadn't explicitly overridden it.

I've fixed this as part of writing this guide — `frontend/.env` is now untracked (`git rm --cached frontend/.env`), matching the backend's pattern: `.env` stays local-only, `.env.example` is the committed template. You'll see this as a pending deletion in `git status`; once committed, `frontend/.env` will still exist on your disk (untouched — `git rm --cached` only removes it from tracking, not from the filesystem) but git will stop tracking future changes to it.

**Summary of the pattern for both apps, going forward:**
1. Real config lives in `.env` (gitignored, per-machine, never committed).
2. `.env.example` (committed) documents the variable names/shape for anyone setting up fresh.
3. Backend re-reads its `.env` on every process start. Frontend bakes its `.env`/build-time env vars into the bundle once, at `npm run build` — a stale `frontend/.env` value only matters if you're building locally; production builds get `VITE_API_URL` from the CI workflow instead, not from `frontend/.env` at all.

### "What if I add a new environment variable later?"

Backend: add it to `backend/.env` (real value) and `backend/.env.example` (placeholder, so the requirement is documented), then read it via `env.js` the same way as the existing keys. Restart the process — no rebuild needed.

Frontend: add it to `frontend/.env` (must be prefixed `VITE_` or Vite won't expose it) and `frontend/.env.example`, then read it via `import.meta.env.VITE_YOUR_VAR`. If it needs a different value in production, add it to the `env:` block of the "Build frontend" step in `.github/workflows/deploy.yml` — otherwise the production build silently falls back to whatever's in `frontend/.env` (or nothing, if that file doesn't exist on the CI runner, which it won't since it's gitignored).

## 7. Common Commands Reference

| Command | Where | What it does |
|---|---|---|
| `npm run dev` | `backend/` | Start API with auto-reload (nodemon) |
| `npm run dev` | `frontend/` | Start Vite dev server |
| `npm run migrate` | `backend/` | Apply/verify DB schema (idempotent) |
| `npm run seed:admin` | `backend/` | Create the first admin login from `.env` |
| `npm run seed:testimonials` | `backend/` | Seed sample patient testimonials |
| `npm run build` | `frontend/` | Production build to `frontend/dist/` |
| `npm run preview` | `frontend/` | Preview the production build locally |
