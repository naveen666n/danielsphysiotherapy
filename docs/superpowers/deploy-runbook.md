# Deploy Runbook: Phase 7 (Nginx + PM2, no Docker)

One-time manual setup for a fresh VPS. Run once per server — ongoing deploys after this are automatic via `.github/workflows/deploy.yml` on every push to `main`.

> **Merge order matters:** complete steps 1-9 below (through registering the four GitHub secrets) *before* merging the branch that adds `.github/workflows/deploy.yml` to `main`. Otherwise the workflow's first run fires against a VPS that isn't bootstrapped yet and fails — harmless since nothing is live yet, but a confusing first red run.

## Prerequisites

- A VPS with SSH access (this project targets a 1 CPU / 1GB RAM box — no Docker, everything below runs as native OS processes).
- A domain pointed at the VPS's IP address (currently `naveennallanti.com`; will become `danielsphysiotherapy.com` once purchased — see "Swapping the domain later" at the bottom).

## 1. Install system packages

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm i -g pm2
```

On an Oracle Linux / RHEL-family VPS (e.g. OCI's default `opc` user), use `dnf` instead of `apt`, and see step 7 below — SELinux ships `Enforcing` by default on these images and will 403 the site until configured.

## 2. Create the deploy directory and clone the repo

```bash
sudo mkdir -p /var/www/danielsphysiotherapy
sudo chown $USER:$USER /var/www/danielsphysiotherapy
git clone <repo-url> /var/www/danielsphysiotherapy
```

## 3. Create the backend `.env` file

This file is **never** created or touched by CI — it holds real secrets and is created once, by hand:

```bash
cd /var/www/danielsphysiotherapy/backend
cat > .env <<'ENVEOF'
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://naveennallanti.com,https://www.naveennallanti.com
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

`FRONTEND_URL` must **exactly** match the browser's `Origin` header (scheme + host, no trailing slash) for every hostname the site is actually reachable on — the backend's CORS check (`backend/src/app.js`) rejects anything not in this comma-separated list with a generic `500 Something went wrong`, which looks like a server crash but is really a config mismatch. Since `deploy/nginx.conf`'s `server_name` covers both the apex and `www` host, `FRONTEND_URL` must list both, or logins from whichever one is missing will fail.

## 4. First manual install and build

```bash
cd /var/www/danielsphysiotherapy/backend
npm ci --omit=dev
npm run migrate      # applies backend/src/config/schema.sql
npm run seed:admin   # creates the first admin user from .env values above

cd /var/www/danielsphysiotherapy/frontend
npm ci
VITE_API_URL=/api npm run build
```

## 5. Start the backend under PM2

```bash
cd /var/www/danielsphysiotherapy/backend
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # run the command it prints (as root) to enable boot-time restart
```

Confirm it's running: `pm2 status` should show `physio-backend` as `online`.

## 6. Configure Nginx

```bash
sudo cp /var/www/danielsphysiotherapy/deploy/nginx.conf /etc/nginx/sites-available/danielsphysiotherapy.com
sudo ln -s /etc/nginx/sites-available/danielsphysiotherapy.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must print `syntax is ok` / `test is successful` before continuing — this is the first real syntax validation of `deploy/nginx.conf` (only a structural brace/directive check was possible during development, no `nginx` binary was available on the dev machine).

## 7. SELinux (Oracle Linux / RHEL-family VPS only)

Skip this step entirely if `getenforce` prints `Disabled` (e.g. plain Ubuntu/Debian). On SELinux-enforcing distros, nginx runs in a confined domain and two separate denials will otherwise produce a working-looking deploy that 403s on every page and 500s on every API call:

```bash
getenforce   # confirm "Enforcing" before running the rest of this step

# 1. Static files rsync'd in by CI land labeled `var_t`, not `httpd_sys_content_t` —
#    nginx can't stat() them, causing a 403 on every page ("permission denied"
#    in /var/log/nginx/error.log even though Unix file permissions look fine).
sudo semanage fcontext -a -t httpd_sys_content_t "/var/www/danielsphysiotherapy(/.*)?"
sudo restorecon -Rv /var/www/danielsphysiotherapy

# 2. nginx is blocked from making outbound connections at all by default,
#    which breaks the /api/ proxy_pass to the backend on 127.0.0.1:5000
#    ("connect() ... Permission denied" in the error log).
sudo setsebool -P httpd_can_network_connect 1
```

Both commands are idempotent and persistent (survive reboots and future deploys — new files rsync'd into an already-labeled directory inherit its context automatically, so this shouldn't need repeating after every push). If `semanage` isn't found, install it first: `sudo dnf install -y policycoreutils-python-utils`.

## 8. Obtain the TLS certificate

```bash
sudo certbot --nginx -d naveennallanti.com
```

Certbot rewrites `/etc/nginx/sites-available/danielsphysiotherapy.com` in place to add the `listen 443 ssl;` block, real cert paths, and an HTTP→HTTPS redirect. Renewal is automatic via certbot's own systemd timer — no cron setup needed. Confirm with `sudo systemctl list-timers | grep certbot`.

## 9. Set up the CI/CD deploy key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N "" -C "github-actions-deploy"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key   # copy this private key
```

In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `VPS_HOST` | the server's IP or hostname |
| `VPS_USER` | the SSH user used above |
| `VPS_PORT` | `22` (or your custom SSH port) |
| `VPS_SSH_KEY` | the full contents of `~/.ssh/deploy_key` (the private key) |

## 10. Verify end-to-end

1. `curl -I https://naveennallanti.com` → expect `200`, valid TLS (no cert warning).
2. `curl https://naveennallanti.com/api/settings/public` → expect real JSON, not a connection error.
3. Log in to `/admin` in a browser (or `curl -i .../api/auth/login` with the seeded admin credentials) → expect `200`, not a `500`/CORS error. If this 500s, re-check the `FRONTEND_URL` note in step 3.
4. Upload a doctor photo, confirm it loads from `https://naveennallanti.com/uploads/doctors/...`.
5. Push a trivial commit to `main` and confirm the GitHub Actions run goes green, and that the change is live on the site afterward.
6. `pm2 restart physio-backend` once, confirm it comes back `online` in `pm2 status` — proves PM2's crash-restart behavior.
7. Optional: reboot the VPS once and confirm `pm2 status` shows `physio-backend` running again without manual intervention (proves `pm2 startup` worked).

## Swapping the domain later

Once `danielsphysiotherapy.com` is purchased and DNS points at this VPS:

1. Edit `deploy/nginx.conf` in the repo: replace `naveennallanti.com` with `danielsphysiotherapy.com` in `server_name`, commit and push (the next deploy won't touch Nginx config automatically — copy the updated file to the server the same way as step 6 above and re-run `sudo nginx -t && sudo systemctl reload nginx`).
2. Re-run `sudo certbot --nginx -d danielsphysiotherapy.com` for the new domain's cert.
3. Update `FRONTEND_URL` in the VPS's `backend/.env` to `https://danielsphysiotherapy.com,https://www.danielsphysiotherapy.com`, then `pm2 reload ecosystem.config.cjs --env production`.
