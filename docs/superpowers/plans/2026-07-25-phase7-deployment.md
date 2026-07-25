# Phase 7: Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app deployable to the production VPS by adding a PM2 process config, an Nginx reverse-proxy config, a GitHub Actions deploy workflow, and a one-time server setup runbook — no Docker.

**Architecture:** Nginx (installed natively on the VPS) reverse-proxies `/api/*` to a PM2-managed Node backend process on `127.0.0.1:5000` and serves the Vite-built frontend as static files plus uploaded photos directly from disk. GitHub Actions builds the frontend on its own runner (the VPS is too resource-constrained at 1 CPU/1GB for a Vite build), rsyncs the backend source and built frontend to the VPS, then SSHes in to run `npm ci --omit=dev` and `pm2 reload`.

**Tech Stack:** Nginx, PM2, Certbot (Let's Encrypt), GitHub Actions, rsync/ssh. No Docker, no container registry.

## Global Constraints

- No Docker/containers of any kind — rejected due to the 1 CPU / 1GB RAM VPS (per `docs/superpowers/specs/2026-07-25-phase7-deployment-design.md` §Scope).
- Deploy path on the VPS: `/var/www/danielsphysiotherapy.com` (backend at `.../backend`, frontend build at `.../frontend/dist`).
- Domain placeholder for now: `naveennallanti.com` (swapped to `danielsphysiotherapy.com` later, no design change needed).
- Backend listens on port `5000` (matches `backend/src/config/env.js` default `PORT`).
- Node.js version: `22.x LTS`.
- PM2 process name: `physio-backend`, single instance, `exec_mode: 'fork'` (not cluster — memory constraint), `max_memory_restart: '300M'`.
- Uploads live at `backend/src/uploads/{doctors,services,testimonials,settings}/` — always excluded from rsync (never overwritten by a deploy), served directly by Nginx via `alias`.
- Required GitHub repo secrets: `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`.
- Backend `.env` is never touched by CI — created once by hand on the VPS during the runbook, holds real DB/JWT secrets.
- This project has no automated test suite (standing decision since Phase 1) — verification here is manual command output and, where a real tool isn't installed locally, deferred to the one-time VPS runbook walkthrough (already Verification Plan item 1 in the spec).

---

## File Structure

- **Create `backend/ecosystem.config.cjs`** — PM2 process definition. `.cjs` extension is required because `backend/package.json` has `"type": "module"`; PM2's own default config format is CommonJS (`module.exports`), so the extension override is what makes `require()` work correctly for both PM2 and our local verification.
- **Create `deploy/nginx.conf`** — single Nginx server block: reverse proxy for `/api/`, static alias for `/uploads/`, static root + SPA fallback for everything else.
- **Create `.github/workflows/deploy.yml`** — CI/CD workflow triggered on push to `main`.
- **Create `docs/superpowers/deploy-runbook.md`** — one-time manual VPS setup steps (not automated; a human runs these once per fresh server).

---

### Task 1: PM2 process config

**Files:**
- Create: `backend/ecosystem.config.cjs`

**Interfaces:**
- Produces: a PM2 app named `physio-backend`, referenced by name in `.github/workflows/deploy.yml` (Task 3) and `docs/superpowers/deploy-runbook.md` (Task 4) as `pm2 reload ecosystem.config.cjs --env production` / `pm2 start ecosystem.config.cjs --env production`.

- [ ] **Step 1: Write the file**

```js
// backend/ecosystem.config.cjs
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

- [ ] **Step 2: Verify the file is valid CommonJS and exports the expected shape**

Run: `node -e "const c = require('./backend/ecosystem.config.cjs'); console.log(JSON.stringify(c, null, 2));"`

Expected output:
```json
{
  "apps": [
    {
      "name": "physio-backend",
      "script": "src/server.js",
      "cwd": "/Users/naveennallanti/Desktop/personal_projects/daniel/website/backend",
      "instances": 1,
      "exec_mode": "fork",
      "max_memory_restart": "300M",
      "env_production": {
        "NODE_ENV": "production"
      }
    }
  ]
}
```

(The `cwd` value will be `__dirname` resolved to the absolute path of the `backend/` directory on whatever machine runs the command — confirm it ends in `.../backend`, confirm `script` resolves to a real file: `ls backend/src/server.js` should succeed.)

PM2 itself is not installed locally (confirmed: `pm2` not on `PATH`), so `pm2 start`/`pm2 reload` against this file cannot be tested until the real VPS runbook walkthrough (Task 4 references this — real functional verification happens there, per spec Verification Plan item 1).

- [ ] **Step 3: Commit**

```bash
git add backend/ecosystem.config.cjs
git commit -m "Add PM2 process config for Phase 7 deployment"
```

---

### Task 2: Nginx reverse proxy config

**Files:**
- Create: `deploy/nginx.conf`

**Interfaces:**
- Consumes: backend port `5000` (Task 1's PM2 app listens here via `backend/src/server.js` → `env.PORT` default), deploy path `/var/www/danielsphysiotherapy.com` (Global Constraints).
- Produces: the file path `deploy/nginx.conf`, referenced by `docs/superpowers/deploy-runbook.md` (Task 4) as the file copied to `/etc/nginx/sites-available/danielsphysiotherapy.com` on the VPS.

- [ ] **Step 1: Write the file**

```nginx
# deploy/nginx.conf
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
        alias /var/www/danielsphysiotherapy.com/backend/src/uploads/;
    }

    location / {
        root /var/www/danielsphysiotherapy.com/frontend/dist;
        try_files $uri /index.html;
    }
}
```

- [ ] **Step 2: Verify structurally (nginx is not installed locally — confirmed: `nginx` not on `PATH`)**

Run a brace-balance and required-directive check since `nginx -t` isn't available on this machine:

```bash
python3 - <<'EOF'
content = open('deploy/nginx.conf').read()
assert content.count('{') == content.count('}'), "unbalanced braces"
for needle in ['listen 80;', 'server_name naveennallanti.com;', 'location /api/', 'location /uploads/', 'location /', 'proxy_pass http://127.0.0.1:5000/api/;', 'alias /var/www/danielsphysiotherapy.com/backend/src/uploads/;', 'root /var/www/danielsphysiotherapy.com/frontend/dist;', 'try_files $uri /index.html;']:
    assert needle in content, f"missing: {needle}"
print("OK: braces balanced, all required directives present")
EOF
```

Expected output: `OK: braces balanced, all required directives present`

Real syntax validation (`nginx -t`) happens during the one-time VPS runbook walkthrough (Task 4, and spec Verification Plan item 1) — that is the authoritative check, this step only catches typos/missing directives ahead of time.

- [ ] **Step 3: Commit**

```bash
git add deploy/nginx.conf
git commit -m "Add Nginx reverse proxy config for Phase 7 deployment"
```

---

### Task 3: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: PM2 app name `physio-backend`/config file `ecosystem.config.cjs` (Task 1), deploy path `/var/www/danielsphysiotherapy.com` (Global Constraints), secrets `VPS_HOST`/`VPS_USER`/`VPS_PORT`/`VPS_SSH_KEY` (Global Constraints, added by hand in GitHub repo settings — not part of this task).
- Produces: nothing consumed by later tasks — this is the terminal automation artifact. `docs/superpowers/deploy-runbook.md` (Task 4) documents the secrets this workflow requires.

- [ ] **Step 1: Write the file**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Build frontend
        working-directory: frontend
        run: npm run build

      - name: Set up SSH agent
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VPS_SSH_KEY }}

      - name: Add VPS to known_hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -p "${{ secrets.VPS_PORT }}" -H "${{ secrets.VPS_HOST }}" >> ~/.ssh/known_hosts

      - name: Sync backend source
        run: |
          rsync -avz --delete \
            --exclude 'node_modules' \
            --exclude '.env' \
            --exclude 'src/uploads' \
            -e "ssh -p ${{ secrets.VPS_PORT }}" \
            ./backend/ "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/var/www/danielsphysiotherapy.com/backend/"

      - name: Sync frontend build
        run: |
          rsync -avz --delete \
            -e "ssh -p ${{ secrets.VPS_PORT }}" \
            ./frontend/dist/ "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/var/www/danielsphysiotherapy.com/frontend/dist/"

      - name: Install backend production dependencies and reload PM2
        run: |
          ssh -p "${{ secrets.VPS_PORT }}" "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" \
            'cd /var/www/danielsphysiotherapy.com/backend && npm ci --omit=dev && pm2 reload ecosystem.config.cjs --env production'
```

- [ ] **Step 2: Verify YAML syntax**

`actionlint`/`yamllint` are not installed locally (confirmed). Use `js-yaml` via `npx` (has network access, confirmed working) to parse the file and catch syntax errors:

Run: `npx --yes js-yaml .github/workflows/deploy.yml`

Expected: the parsed YAML is printed back out (no error/traceback). If the file has a syntax error, `js-yaml` prints a `YAMLException` with a line number instead — fix and re-run until clean.

This confirms the YAML parses correctly; it does not validate GitHub Actions' own schema (action names/versions) or exercise the SSH steps, since there's no real VPS or repo secrets available locally. Full functional verification happens on the first real push to `main` after this workflow is merged (spec Verification Plan item 2).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions deploy workflow for Phase 7"
```

---

### Task 4: One-time VPS setup runbook

**Files:**
- Create: `docs/superpowers/deploy-runbook.md`

**Interfaces:**
- Consumes: `backend/ecosystem.config.cjs` (Task 1, app name `physio-backend`), `deploy/nginx.conf` (Task 2), `.github/workflows/deploy.yml` (Task 3, the four secret names it reads).
- Produces: nothing consumed by other files — this is a documentation deliverable for a human operator, not code.

- [ ] **Step 1: Write the file**

```markdown
# Deploy Runbook: Phase 7 (Nginx + PM2, no Docker)

One-time manual setup for a fresh VPS. Run once per server — ongoing deploys after this are automatic via `.github/workflows/deploy.yml` on every push to `main`.

## Prerequisites

- A VPS with SSH access (this project targets a 1 CPU / 1GB RAM box — no Docker, everything below runs as native OS processes).
- A domain pointed at the VPS's IP address (currently `naveennallanti.com`; will become `danielsphysiotherapy.com` once purchased — see "Swapping the domain later" at the bottom).

## 1. Install system packages

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm i -g pm2
```

## 2. Create the deploy directory and clone the repo

```bash
sudo mkdir -p /var/www/danielsphysiotherapy.com
sudo chown $USER:$USER /var/www/danielsphysiotherapy.com
git clone <repo-url> /var/www/danielsphysiotherapy.com
```

## 3. Create the backend `.env` file

This file is **never** created or touched by CI — it holds real secrets and is created once, by hand:

```bash
cd /var/www/danielsphysiotherapy.com/backend
cat > .env <<'ENVEOF'
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://naveennallanti.com
DB_HOST=<managed-mysql-host>
DB_PORT=3306
DB_USER=<managed-mysql-user>
DB_PASSWORD=<managed-mysql-password>
DB_NAME=physio_clinic
JWT_SECRET=<generate-a-long-random-string>
JWT_EXPIRES_IN=8h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<a-strong-password>
ADMIN_NAME=Administrator
ENVEOF
```

Fill in the `<...>` placeholders with real values before continuing. Generate `JWT_SECRET` with e.g. `openssl rand -base64 48`.

## 4. First manual install and build

```bash
cd /var/www/danielsphysiotherapy.com/backend
npm ci --omit=dev
npm run migrate      # applies backend/src/config/schema.sql
npm run seed:admin   # creates the first admin user from .env values above

cd /var/www/danielsphysiotherapy.com/frontend
npm ci
npm run build
```

## 5. Start the backend under PM2

```bash
cd /var/www/danielsphysiotherapy.com/backend
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # run the command it prints (as root) to enable boot-time restart
```

Confirm it's running: `pm2 status` should show `physio-backend` as `online`.

## 6. Configure Nginx

```bash
sudo cp /var/www/danielsphysiotherapy.com/deploy/nginx.conf /etc/nginx/sites-available/danielsphysiotherapy.com
sudo ln -s /etc/nginx/sites-available/danielsphysiotherapy.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must print `syntax is ok` / `test is successful` before continuing — this is the first real syntax validation of `deploy/nginx.conf` (only a structural brace/directive check was possible during development, no `nginx` binary was available on the dev machine).

## 7. Obtain the TLS certificate

```bash
sudo certbot --nginx -d naveennallanti.com
```

Certbot rewrites `/etc/nginx/sites-available/danielsphysiotherapy.com` in place to add the `listen 443 ssl;` block, real cert paths, and an HTTP→HTTPS redirect. Renewal is automatic via certbot's own systemd timer — no cron setup needed. Confirm with `sudo systemctl list-timers | grep certbot`.

## 8. Set up the CI/CD deploy key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N "" -C "github-actions-deploy"
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key   # copy this private key
```

In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `VPS_HOST` | the server's IP or hostname |
| `VPS_USER` | the SSH user used above |
| `VPS_PORT` | `22` (or your custom SSH port) |
| `VPS_SSH_KEY` | the full contents of `~/.ssh/deploy_key` (the private key) |

## 9. Verify end-to-end

1. `curl -I https://naveennallanti.com` → expect `200`, valid TLS (no cert warning).
2. `curl https://naveennallanti.com/api/settings/public` → expect real JSON, not a connection error.
3. Log in to `/admin` in a browser, upload a doctor photo, confirm it loads from `https://naveennallanti.com/uploads/doctors/...`.
4. Push a trivial commit to `main` and confirm the GitHub Actions run goes green, and that the change is live on the site afterward.
5. `pm2 restart physio-backend` once, confirm it comes back `online` in `pm2 status` — proves PM2's crash-restart behavior.
6. Optional: reboot the VPS once and confirm `pm2 status` shows `physio-backend` running again without manual intervention (proves `pm2 startup` worked).

## Swapping the domain later

Once `danielsphysiotherapy.com` is purchased and DNS points at this VPS:

1. Edit `deploy/nginx.conf` in the repo: replace `naveennallanti.com` with `danielsphysiotherapy.com` in `server_name`, commit and push (the next deploy won't touch Nginx config automatically — copy the updated file to the server the same way as step 6 above and re-run `sudo nginx -t && sudo systemctl reload nginx`).
2. Re-run `sudo certbot --nginx -d danielsphysiotherapy.com` for the new domain's cert.
3. Update `FRONTEND_URL` in the VPS's `backend/.env` to `https://danielsphysiotherapy.com`, then `pm2 reload ecosystem.config.cjs --env production`.
```

- [ ] **Step 2: Cross-check consistency against Tasks 1–3**

Run: `grep -n "physio-backend\|/var/www/danielsphysiotherapy.com\|VPS_HOST\|VPS_USER\|VPS_PORT\|VPS_SSH_KEY" docs/superpowers/deploy-runbook.md`

Expected: every name matches exactly what's in `backend/ecosystem.config.cjs` (app name `physio-backend`), `deploy/nginx.conf` (path `/var/www/danielsphysiotherapy.com`), and `.github/workflows/deploy.yml` (secret names `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`) — no typos or drift between the four files.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/deploy-runbook.md
git commit -m "Add one-time VPS setup runbook for Phase 7"
```

---

## Self-Review Notes

- **Spec coverage:** §2 Architecture → Task 1 (PM2) + Task 2 (Nginx); §3 Deploy Flow → Task 3 (workflow); §4 Files Added → Tasks 1–4 cover all four files listed; §5 GitHub Actions Workflow → Task 3; §6 One-Time Server Setup → Task 4; §7 Error Handling → covered by PM2's `max_memory_restart` (Task 1) and the workflow's fail-loud steps (Task 3, no `continue-on-error`); §8 Verification Plan → distributed across each task's verify step plus the runbook's §9 (Task 4).
- **Placeholder scan:** the only `<...>` placeholders are in Task 4's `.env` template (DB credentials, JWT secret, admin password) — these are inherently per-deployment secrets that cannot have real values baked into a committed file, not unfinished plan content.
- **Type/name consistency:** PM2 app name `physio-backend` matches across Task 1 (definition), Task 3 (`pm2 reload ecosystem.config.cjs`), and Task 4 (`pm2 start`/`pm2 status`). Deploy path `/var/www/danielsphysiotherapy.com` matches across Tasks 2, 3, and 4. Secret names (`VPS_HOST`/`VPS_USER`/`VPS_PORT`/`VPS_SSH_KEY`) match across Tasks 3 and 4.
