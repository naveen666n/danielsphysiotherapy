# Phase 1 Design: Project Setup, Folder Structure, Database Schema, Authentication

**Status:** Approved
**Scope:** First of 7 phases building a Hospital Management application for a single physiotherapy clinic. This phase establishes the repo skeleton, the full database schema (all tables, minimal columns for tables owned by later phases), and admin/staff authentication end-to-end (backend + frontend).

## 1. Context

The repo currently contains a static marketing site (`index.html`, `assets/`) for "Daniel's Physiotherapy Hospital". That content is left untouched for now and will be ported into the new React public site in Phase 5, after which the static file is retired. This phase adds `backend/` and `frontend/` as new, independent projects at the repo root.

Later phases (Doctor Management, Appointment Management, Staff Management, Public Website, Dashboard, Deployment) each get their own design + plan + implementation cycle, built on top of what this phase establishes. Nothing in this document commits to how those phases will work beyond the shape of the database tables they'll own.

## 2. Repo Layout

```
website/
  backend/
    src/
      controllers/
      services/
      repositories/
      routes/
      middlewares/
      models/          # thin row-shape helpers, not an ORM
      validators/       # zod schemas
      config/            # db pool, env loading, schema.sql
      utils/             # AppError, sendResponse, asyncHandler
      uploads/            # multer destination (created, used from Phase 2+)
      app.js
      server.js
    scripts/
      migrate.js         # runs config/schema.sql against MySQL
      seedAdmin.js        # creates the first admin user from .env
    .env.example
    package.json
  frontend/
    src/
      pages/
      components/
      layouts/
      services/           # axios instance + api call modules
      hooks/
      utils/
      contexts/           # AuthContext
      routes/             # ProtectedRoute, route table
    index.html
    package.json
  index.html, assets/     # existing static site, untouched
  docs/superpowers/specs/ # this file and future phase specs
```

No monorepo tooling (npm workspaces, turborepo, lerna) — two independent `npm` projects is simpler for a project this size and avoids coupling their dependency graphs.

## 3. Backend Architecture

Layered request flow, enforced by folder boundaries:

```
routes/ → middlewares/ (auth, validate) → controllers/ → services/ → repositories/ → mysql2 pool
```

- **routes/**: wire HTTP verb + path + middleware chain + controller method. No logic.
- **controllers/**: parse `req`, call one service method, pass result to `sendResponse`. No SQL, no business rules.
- **services/**: business logic (e.g. "does this username already exist", "hash the password before storing"). Orchestrates one or more repository calls.
- **repositories/**: the only layer that touches SQL. One file per table, parameterized queries via `mysql2/promise`, returns plain row objects.
- **models/**: not an ORM — just JSDoc/type-shape references for what a row looks like, used for editor hints.

**Key libraries:** `express`, `mysql2`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `zod`, `helmet`, `cors`, `express-rate-limit`, `morgan`, `dotenv`, `multer` (installed now, wired up starting Phase 2 for doctor photos).

**Module system:** ESM (`"type": "module"` in `package.json`), `import`/`export` throughout.

**Response envelope** (every endpoint, success or failure):
```json
{ "success": true, "message": "Login successful", "data": { "...": "..." } }
{ "success": false, "message": "Invalid credentials", "errors": null }
```
Implemented via a `sendResponse(res, { status, message, data })` util and a centralized `errorHandler` middleware that catches a custom `AppError(message, statusCode)` (or any thrown error) and formats it consistently. Route handlers are wrapped in an `asyncHandler` so `async/await` errors reach the handler without manual `try/catch` in every controller.

**Security middleware** (applied in `app.js`):
- `helmet()` for standard security headers.
- `cors({ origin: FRONTEND_URL, credentials: true })` — locked to the configured frontend origin since we're using cookie-based auth.
- `express-rate-limit`: a generous global limiter on `/api/*`, and a stricter limiter (e.g. 5 requests/minute/IP) specifically on `POST /api/auth/login` to blunt brute-force attempts.
- `cookie-parser` to read the JWT cookie.
- All SQL is parameterized through `mysql2` placeholders — no string concatenation of user input, anywhere.
- All request bodies validated with `zod` schemas in `validators/`, applied via a `validate(schema)` middleware that runs before the controller and returns `400` with field errors on failure.

## 4. Database Schema

Single `backend/src/config/schema.sql`, applied idempotently (`CREATE TABLE IF NOT EXISTS`) by `npm run migrate`. All 8 tables from the spec are created now so later phases only add application code, not schema surprises. Phase 1's application code (repositories/services/routes) only touches `roles` and `users`; the rest are structural placeholders owned by their respective phases.

```sql
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE      -- 'admin' | 'staff'
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20),
  email VARCHAR(150),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Owned by Phase 2 (Doctor Management)
CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  qualification VARCHAR(150),
  specialization VARCHAR(150),
  experience_years INT,
  photo_url VARCHAR(255),
  consultation_fee DECIMAL(10,2),
  working_days VARCHAR(100),
  available_time VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Owned by Phase 3 (Appointment Management)
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  gender VARCHAR(10),
  age INT,
  doctor_id INT,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  problem_description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|approved|cancelled|completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

-- Owned by Phase 5 (Public Website / Services)
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  image_url VARCHAR(255),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Owned by Phase 5 (Testimonials)
CREATE TABLE IF NOT EXISTS testimonials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  review TEXT NOT NULL,
  rating TINYINT NOT NULL,
  photo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Owned by Phase 6/8 (Hospital Settings) — single-row table
CREATE TABLE IF NOT EXISTS hospital_settings (
  id INT PRIMARY KEY DEFAULT 1,
  hospital_name VARCHAR(150),
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(150),
  google_map_link VARCHAR(500),
  opening_hours VARCHAR(255),
  social_links JSON,
  logo_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Owned by Phase 5 (Contact Messages)
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`users` doubles as the Staff Management table (Phase 4): staff are just rows with `role_id` pointing at `staff`. This matches the spec's field list for staff (name, mobile, email, username, password, active) exactly and avoids a duplicate table.

## 5. Authentication Flow

- **Seeding the first admin:** `npm run seed:admin` (backend) reads `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` from `.env`, hashes the password with bcrypt, and inserts a `users` row with `role_id` = admin's id — skipped if that username already exists. There is no public registration endpoint; staff accounts are created later by an admin through the Staff Management UI (Phase 4).
- **`POST /api/auth/login`** — validates `{ username, password }` with zod, looks up the user by username, rejects if not found / inactive / password mismatch (same generic "Invalid credentials" message either way, no user enumeration), signs a JWT `{ id, role }` (8h expiry), sets it as a cookie: `httpOnly, sameSite: 'lax', secure: NODE_ENV === 'production'`. Returns the user's public profile (id, name, role, username) in the response body.
- **`GET /api/auth/me`** — requires `authenticate`, returns the current user's profile from the DB (fresh `active` check, so a deactivated staff account is rejected even with a still-valid token).
- **`POST /api/auth/logout`** — clears the cookie.
- **`authenticate` middleware** — reads the cookie, verifies the JWT, attaches `req.user = { id, role }`, else `401`.
- **`authorize(...roles)` middleware** — used as `authorize('admin')` or `authorize('admin', 'staff')` on routes in later phases; `403` if `req.user.role` isn't in the allowed list. Phase 1 itself has no role-gated business routes yet (that starts in Phase 2+), but the middleware is built and covered by the login/me/logout flow.

## 6. Frontend Scope

- Vite + React 19 + React Router v6 + Tailwind CSS + Axios (single instance, `baseURL` from env, `withCredentials: true` so the auth cookie is sent) + TanStack Query (`QueryClientProvider` at the root).
- `contexts/AuthContext.jsx` — holds `{ user, isLoading }`, exposes `login()`, `logout()`, backed by a `useQuery` call to `GET /api/auth/me` on mount so a page refresh keeps the session.
- `routes/ProtectedRoute.jsx` — redirects to `/login` if no authenticated user; supports an optional `roles` prop for future role-gated routes.
- `pages/Login.jsx` — React Hook Form, calls `POST /api/auth/login`, toast on error, redirects to `/admin` on success.
- `layouts/AdminLayout.jsx` — minimal shell (topbar with hospital name + logout button, empty sidebar placeholder) wrapping an `<Outlet />`; filled in with real nav items in Phase 6.
- `pages/NotFound.jsx` — 404 page.
- `react-hot-toast` mounted once in `App.jsx` for global toast notifications.
- No dashboard widgets, no doctor/appointment UI yet — this phase proves login → `/admin` (protected) → logout works correctly in the browser, including a refresh keeping the session and an unauthenticated visit to `/admin` bouncing to `/login`.

## 7. Error Handling

- Backend: every thrown error funnels through the centralized `errorHandler`; unexpected (non-`AppError`) errors are logged via `morgan`/`console.error` and returned as a generic `500` without leaking internals; validation errors from `zod` are mapped to `400` with a field-level `errors` object.
- Frontend: Axios instance has a response interceptor that surfaces `message` from the envelope into a toast for any non-2xx response (except a `401` from the initial `/auth/me` check, which is expected for logged-out visitors and handled silently by `AuthContext`).

## 8. Testing / Verification

No automated test suite is being added in this phase — the original spec doesn't call for one, and introducing a test framework for an 8-table CRUD app grows the surface area beyond what's needed. Phase 1 is verified manually:
1. `npm run migrate` creates all 8 tables on a real MySQL instance (the user already has one running locally).
2. `npm run seed:admin` creates the admin user.
3. `curl` checks: login with correct/incorrect credentials, `/me` with/without cookie, logout.
4. Browser walkthrough: visit `/admin` while logged out → redirected to `/login`; log in → lands on `/admin`; refresh → still logged in; logout → redirected to `/login`.

If the user wants Jest/Vitest coverage added at some point, that's a separate, explicit ask — not assumed here.

## 9. Explicitly Out of Scope for Phase 1

- Any UI or API for doctors, appointments, staff CRUD, services, testimonials, settings, or contact messages — schema placeholders only.
- Docker/Nginx/deployment config — Phase 7.
- Public website pages — Phase 5.
- Dashboard cards/charts — Phase 6.
