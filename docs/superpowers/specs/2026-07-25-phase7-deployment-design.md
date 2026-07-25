# Phase 7 Design: Deployment (Nginx + PM2, no Docker)

**Scope:** Last of 7 phases building a Hospital Management application for a single physiotherapy clinic (per Phase 1's roadmap: `docs/superpowers/specs/2026-07-24-phase1-setup-auth-design.md`). This phase makes the app deployable to a production VPS: reverse proxy, process management, TLS, and a CI/CD pipeline that deploys on every push to `main`.

Docker was considered and explicitly rejected: the target VPS has 1 CPU / 1GB RAM, and running Nginx + backend + a MySQL container (or even just Nginx + backend containers) inside Docker's overhead leaves too little headroom on a box this small. Everything here runs as native OS processes instead.

## 1. Target Environment

- **Server:** a single VPS the user already has provisioned, 1 CPU / 1GB RAM, SSH access available.
- **Domain:** `naveennallanti.com` for now (placeholder until `danielsphysiotherapy.com` is purchased — swapped into `deploy/nginx.conf` and the Certbot command at that time, no other change needed).
- **Database:** managed MySQL, provider not yet chosen. The app already connects via plain env vars (`backend/src/config/env.js`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) with no provider-specific code, so any managed MySQL works without app changes. If the eventual provider requires SSL, that's a connection-string/env addition at setup time, not a design change here.

## 2. Architecture

Three things run on the VPS, all native (no containers):

- **Nginx** (installed via `apt`) — reverse proxy and static file server. Proxies `/api/*` to the backend's local port, serves `frontend/dist/` directly for everything else (SPA fallback to `index.html`), serves `backend/src/uploads/*` directly as static files, and terminates TLS.
- **PM2** (installed via `npm i -g pm2`) — manages the backend Node process (`backend/src/server.js`) as a long-running, auto-restarting daemon. Single instance, not cluster mode (cluster mode multiplies memory usage, which the 1GB box can't afford). `max_memory_restart: '300M'` as a safety net.
- **Certbot** (`certbot` + `python3-certbot-nginx` via `apt`) — obtains and auto-renews the Let's Encrypt TLS cert for the domain, editing the Nginx config in place. Renewal runs via certbot's own systemd timer; no custom cron needed.

The frontend has no running process at all — `npm run build` produces `frontend/dist/`, which Nginx serves straight off disk.

**MySQL is not on this server** — it's the managed instance from §1, reached over the network via env vars, same as backend already does today.

Uploaded files (`backend/src/uploads/{doctors,services,testimonials,settings}/`) live on plain disk on the VPS. They are excluded from the deploy sync (§3) so a deploy never touches or deletes them.

## 3. Deploy Flow

The heaviest step — `vite build` — must not run on the 1GB VPS. It runs on the GitHub Actions runner instead:

1. **GitHub Actions runner:** checkout repo, `cd frontend && npm ci && npm run build` → produces `frontend/dist/`.
2. **rsync over SSH:** ships `backend/` (excluding `node_modules/`, `src/uploads/`, `.env`) and the built `frontend/dist/` to the VPS at a fixed deploy path (e.g. `/var/www/danielsphysio`).
3. **SSH into the VPS**, run only light steps there:
   - `cd backend && npm ci --omit=dev` — production deps only. This step **must** run on the VPS itself, not be built in CI and copied over: `bcrypt` has native bindings compiled against the target OS/arch, and CI's runner architecture is not guaranteed to match the VPS.
   - `pm2 reload ecosystem.config.cjs --env production` — reloads the backend process with the new code.
4. Nginx needs no restart on a normal deploy — it reads `frontend/dist/` straight from disk, which rsync just updated in place.

This keeps the VPS's per-deploy CPU/memory cost to one `npm ci --omit=dev` (no devDependencies, no bundler) plus a PM2 reload.

## 4. Files Added to the Repo

- **`backend/ecosystem.config.cjs`** — PM2 process definition:

```js
module.exports = {
  apps: [
    {
      name: 'physio-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

  Actual secrets (`DB_HOST`, `JWT_SECRET`, etc.) come from `backend/.env` via the existing `dotenv.config()` call in `env.js` — PM2 doesn't need to know them, `env_production` here only sets `NODE_ENV`.

- **`deploy/nginx.conf`** — one server block (domain hardcoded as `naveennallanti.com`, swapped later):

```nginx
server {
    listen 80;
    server_name naveennallanti.com;

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /var/www/danielsphysio/backend/src/uploads/;
    }

    location / {
        root /var/www/danielsphysio/frontend/dist;
        try_files $uri /index.html;
    }
}
```

  Certbot's Nginx plugin rewrites this file in place during `certbot --nginx` (§6) to add the `listen 443 ssl;` block, cert paths, and an HTTP→HTTPS redirect — that rewrite is not hand-written here since Certbot generates it from the live server's actual cert paths.

- **`.github/workflows/deploy.yml`** — the CI/CD workflow (§5).

- **`docs/superpowers/deploy-runbook.md`** — one-time manual server setup steps (§6).

## 5. GitHub Actions Workflow

Triggers on push to `main`. Steps:

1. Checkout.
2. `cd frontend && npm ci && npm run build`.
3. Load the deploy SSH key via `webfactory/ssh-agent` (reads `secrets.VPS_SSH_KEY`).
4. `rsync -avz --delete --exclude 'node_modules' --exclude '.env' --exclude 'src/uploads' ./backend/ user@host:/var/www/danielsphysio/backend/` and `rsync -avz --delete ./frontend/dist/ user@host:/var/www/danielsphysio/frontend/dist/`.
5. `ssh user@host 'cd /var/www/danielsphysio/backend && npm ci --omit=dev && pm2 reload ecosystem.config.cjs --env production'`.

**Required GitHub repo secrets** (added once by hand, never committed):

| Secret | Purpose |
|---|---|
| `VPS_HOST` | Server IP/hostname |
| `VPS_USER` | SSH user |
| `VPS_PORT` | SSH port (default 22) |
| `VPS_SSH_KEY` | Private key for a deploy-only SSH keypair |

`backend/.env` itself is never touched by CI — it's created once by hand on the VPS (§6) and holds real DB credentials/JWT secret, which must never pass through GitHub Actions or the rsync exclude list confirms it's never overwritten.

## 6. One-Time Server Setup (manual runbook, not automated)

Documented in `docs/superpowers/deploy-runbook.md`, run once per fresh VPS:

1. Install Node.js 22.x LTS (via NodeSource: `curl -fsSL https://deb.nodesource.com/setup_22.x | bash -` then `apt install nodejs`), then `npm i -g pm2`, `apt install nginx certbot python3-certbot-nginx`.
2. `mkdir -p /var/www/danielsphysio`, clone the repo there.
3. Create `backend/.env` by hand with real values (DB credentials from the managed MySQL provider, a strong `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL=https://naveennallanti.com`).
4. `cd backend && npm ci --omit=dev` (first install, manual).
5. `pm2 start ecosystem.config.cjs --env production && pm2 save && pm2 startup` (the printed `pm2 startup` command must be run once as root to enable boot-time restart).
6. `cd frontend && npm ci && npm run build` (first build, manual — later builds happen in CI).
7. Copy `deploy/nginx.conf` to `/etc/nginx/sites-available/danielsphysio`, symlink to `sites-enabled/`, `nginx -t && systemctl reload nginx`.
8. `certbot --nginx -d naveennallanti.com` — obtains the cert, rewrites the Nginx config for HTTPS, sets up auto-renewal.
9. Generate a deploy-only SSH keypair (`ssh-keygen`), append the public key to `~/.ssh/authorized_keys` on the VPS, add the private key + host/user/port to the GitHub repo secrets (§5).

## 7. Error Handling

- If `npm ci --omit=dev` or `pm2 reload` fails during a deploy, the GitHub Actions step fails and the workflow shows red — PM2 does not tear down the previously-running process before a `reload` fails, so a bad deploy fails loud without taking the live site down.
- No automated rollback: matches this project's standing "no automated test suite, keep it lean" decision from Phase 1. A bad deploy is fixed by pushing a corrected commit and re-running the workflow.
- `max_memory_restart: '300M'` on the PM2 process is the only automatic recovery mechanism — if the backend leaks memory, PM2 restarts it rather than the box running out of RAM.

## 8. Verification Plan (no automated test suite, per Phase 1's standing decision)

1. Walk through the runbook (§6) once by hand on the real VPS — this is infrastructure, not app code, so there's no local equivalent to test against.
2. First push to `main` after the workflow is merged: confirm the Action goes green, then confirm `https://naveennallanti.com` serves the site with a valid TLS cert (browser padlock, `curl -I https://naveennallanti.com` returns `200`).
3. Confirm API proxying works: `curl https://naveennallanti.com/api/settings/public` returns real data.
4. Confirm a doctor-photo upload (via the existing admin UI) round-trips correctly through `https://naveennallanti.com/uploads/doctors/...`.
5. Manually `pm2 restart physio-backend` once to confirm PM2's auto-restart-on-crash behavior; if acceptable, reboot the VPS once to confirm `pm2 startup` brings the backend back without manual intervention.
6. Push a second, trivial commit to confirm the full deploy cycle (build → rsync → `npm ci` → `pm2 reload`) works end-to-end on a real code change, not just the first bootstrap.

## 9. Explicitly Out of Scope for Phase 7

- Docker/containers of any kind — explicitly rejected in §Scope due to the 1GB RAM constraint.
- A container registry (GHCR or otherwise) — not applicable without Docker.
- Automated rollback on failed deploy.
- Zero-downtime blue/green or canary deploys — `pm2 reload` on a single fork-mode instance is the extent of graceful restart here.
- Log aggregation/monitoring/alerting beyond what `pm2 logs`/`pm2 status` provide locally on the box.
- Database backups/migration automation for the managed MySQL instance.
- Load balancing or horizontal scaling — single VPS, single backend instance.
