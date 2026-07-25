# Phase 6: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `AdminHome.jsx` with a real dashboard — summary stat cards and recent-activity panels — backed by one new read-only aggregation endpoint.

**Architecture:** A new backend `dashboard` module (repository → service → controller → routes, mirroring every prior module) exposes a single `GET /api/dashboard` that aggregates counts and recent rows across the existing `appointments`, `doctors`, `users`/`roles`, and `contact_messages` tables. The frontend adds one hook consuming it and rewrites `AdminHome.jsx` to render the cards/panels.

**Tech Stack:** Express 5, mysql2 (raw SQL, named placeholders), React 19, TanStack Query, React Router v7, Tailwind v4. No new dependencies, no schema changes.

## Global Constraints

- No automated test suite in this project (Phase 1 decision) — verification is standalone Node ESM scripts against the real DB, `curl` sequences, and a live Playwright walkthrough. Do not add a test framework and do not flag its absence.
- No new npm packages, frontend or backend. No schema changes.
- `GET /api/dashboard` is `authenticate, authorize('admin', 'staff')` — both roles see the same response payload (no role-based data filtering in the backend).
- Role-based visibility is a **frontend-only** concern: the "Active Staff" card is rendered only when `user.role === 'admin'`, matching the existing admin-only guard already used for the "Staff" nav link/route. Every other card and panel renders identically for both roles.
- `appointmentCounts` in the response always has all 4 keys present — `pending`, `approved`, `completed`, `cancelled` (exact enum from `backend/src/validators/appointmentValidators.js`) — with `0` when a status has no rows, plus a `total` key.
- `mysql2@^3.23.1` with `namedPlaceholders: true` (the existing `pool` config) supports named placeholders on `LIMIT` — confirmed working directly against this project's DB before writing this plan. Use `LIMIT :limit` with a bound parameter, not string interpolation.
- Cards link to their existing base list page (`/admin/appointments`, `/admin/doctors`, `/admin/staff`, `/admin/messages`) — none pre-filtered. No changes to any list page in this plan.
- Reuse the exact status-badge colors already defined in `frontend/src/pages/admin/appointments/AppointmentList.jsx`'s `STATUS_STYLES` constant for the Recent Appointments panel, rather than inventing new colors.
- `authenticate` does a fresh DB lookup by JWT `id` on every request (Phase 4). Any `curl`-based verification script must sign test JWTs with a real, active seeded user's id — never a fabricated id like `999`.

---

### Task 1: Backend Dashboard Module

**Files:**
- Create: `backend/src/repositories/dashboardRepository.js`
- Create: `backend/src/services/dashboardService.js`
- Create: `backend/src/controllers/dashboardController.js`
- Create: `backend/src/routes/dashboardRoutes.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `pool` from `../config/db.js`, `authenticate`/`authorize` middlewares, `asyncHandler`, `sendResponse` (all pre-existing, same imports as `settingsController.js`/`settingsRoutes.js`).
- Produces: `GET /api/dashboard` (authenticated, `admin`+`staff`) → `{success, message, data: {appointmentCounts: {pending, approved, completed, cancelled, total}, activeDoctorCount, activeStaffCount, unreadMessageCount, recentAppointments: [...5], recentUnreadMessages: [...5]}}`. Task 2's frontend consumes this exact shape.

- [ ] **Step 1: Create the repository**

Create `backend/src/repositories/dashboardRepository.js`:

```js
import pool from '../config/db.js';

export async function getAppointmentCounts() {
  const [rows] = await pool.query('SELECT status, COUNT(*) as count FROM appointments GROUP BY status');
  return rows;
}

export async function getActiveDoctorCount() {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM doctors WHERE active = 1');
  return rows[0].count;
}

export async function getActiveStaffCount() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'staff' AND u.active = 1`
  );
  return rows[0].count;
}

export async function getUnreadMessageCount() {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM contact_messages WHERE is_read = 0');
  return rows[0].count;
}

export async function getRecentAppointments(limit) {
  const [rows] = await pool.query(
    'SELECT id, patient_name, appointment_date, appointment_time, status FROM appointments ORDER BY created_at DESC LIMIT :limit',
    { limit }
  );
  return rows;
}

export async function getRecentUnreadMessages(limit) {
  const [rows] = await pool.query(
    'SELECT id, name, message, created_at FROM contact_messages WHERE is_read = 0 ORDER BY created_at DESC LIMIT :limit',
    { limit }
  );
  return rows;
}
```

- [ ] **Step 2: Create the service**

Create `backend/src/services/dashboardService.js`:

```js
import * as dashboardRepository from '../repositories/dashboardRepository.js';

const STATUSES = ['pending', 'approved', 'completed', 'cancelled'];

function normalizeCounts(rows) {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  let total = 0;
  for (const row of rows) {
    counts[row.status] = row.count;
    total += row.count;
  }
  return { ...counts, total };
}

export async function getDashboard() {
  const [
    countRows,
    activeDoctorCount,
    activeStaffCount,
    unreadMessageCount,
    recentAppointments,
    recentUnreadMessages,
  ] = await Promise.all([
    dashboardRepository.getAppointmentCounts(),
    dashboardRepository.getActiveDoctorCount(),
    dashboardRepository.getActiveStaffCount(),
    dashboardRepository.getUnreadMessageCount(),
    dashboardRepository.getRecentAppointments(5),
    dashboardRepository.getRecentUnreadMessages(5),
  ]);

  return {
    appointmentCounts: normalizeCounts(countRows),
    activeDoctorCount,
    activeStaffCount,
    unreadMessageCount,
    recentAppointments,
    recentUnreadMessages,
  };
}
```

- [ ] **Step 3: Create the controller**

Create `backend/src/controllers/dashboardController.js`:

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as dashboardService from '../services/dashboardService.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard();
  sendResponse(res, { status: 200, message: 'Dashboard retrieved', data: dashboard });
});
```

- [ ] **Step 4: Create the routes**

Create `backend/src/routes/dashboardRoutes.js`:

```js
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.get('/', authenticate, authorize('admin', 'staff'), dashboardController.getDashboard);

export default router;
```

- [ ] **Step 5: Mount the routes**

In `backend/src/routes/index.js`, add the import alongside the other route imports:

```js
import dashboardRoutes from './dashboardRoutes.js';
```

And mount it alongside the other `router.use(...)` calls:

```js
router.use('/dashboard', dashboardRoutes);
```

- [ ] **Step 6: Verify with a standalone script**

Create a temporary script (not committed) at `/tmp/verify-dashboard.mjs`, adjusting DB env vars to match `backend/.env`:

```js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: '127.0.0.1', port: 3306, user: 'root', password: process.env.DB_PASSWORD || '',
  database: 'physio_clinic', namedPlaceholders: true,
});

const [countRows] = await pool.query('SELECT status, COUNT(*) as count FROM appointments GROUP BY status');
console.log('Raw counts by status:', countRows);

const STATUSES = ['pending', 'approved', 'completed', 'cancelled'];
const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
let total = 0;
for (const row of countRows) { counts[row.status] = row.count; total += row.count; }
console.log('Normalized (expect all 4 keys present):', { ...counts, total });

const [recent] = await pool.query(
  'SELECT id, patient_name, appointment_date, appointment_time, status FROM appointments ORDER BY created_at DESC LIMIT :limit',
  { limit: 5 }
);
console.log('Recent appointments (expect <=5, newest first):', recent.length, recent.map((r) => r.id));

const [unread] = await pool.query(
  'SELECT id, name, message, created_at FROM contact_messages WHERE is_read = 0 ORDER BY created_at DESC LIMIT :limit',
  { limit: 5 }
);
console.log('Recent unread messages (expect <=5):', unread.length);

process.exit(0);
```

Run: `node /tmp/verify-dashboard.mjs`
Expected: the normalized counts object has all 4 status keys (even ones with 0 rows in the current DB) plus a correct `total` equal to the sum; recent appointments list has at most 5 rows ordered newest-first; recent unread messages has at most 5 rows. Delete the script after running — do not commit it.

- [ ] **Step 7: Verify RBAC via curl**

With the backend running (`cd backend && npm run dev`), using a real seeded admin and staff user's credentials (per the Global Constraints JWT note — query the `users` table for real, active ids if you need to craft test JWTs directly rather than logging in through `/api/auth/login`):

```bash
# No auth — expect 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/dashboard

# As staff — expect 200 with full payload (all 6 top-level data keys present)
curl -s http://localhost:5000/api/dashboard -b "token=<real-staff-jwt>" | head -c 500

# As admin — expect 200 with the identical shape/values as the staff response
curl -s http://localhost:5000/api/dashboard -b "token=<real-admin-jwt>" | head -c 500
```

Expected: first call 401; second and third both 200 with identical data (proving the endpoint does no role-based filtering — that's a frontend-only concern per the Global Constraints).

- [ ] **Step 8: Commit**

```bash
git add backend/src/repositories/dashboardRepository.js backend/src/services/dashboardService.js \
  backend/src/controllers/dashboardController.js backend/src/routes/dashboardRoutes.js \
  backend/src/routes/index.js
git commit -m "feat: add dashboard backend module with appointment/doctor/staff/message aggregates"
```

---

### Task 2: Frontend Dashboard

**Files:**
- Create: `frontend/src/services/dashboardService.js`
- Create: `frontend/src/hooks/useDashboard.js`
- Modify: `frontend/src/pages/admin/AdminHome.jsx`

**Interfaces:**
- Consumes: Task 1's `GET /api/dashboard` response shape exactly as documented above.
- Produces: `useDashboard()` hook (not consumed by any other task — this plan has only 2 tasks).

- [ ] **Step 1: Dashboard service**

Create `frontend/src/services/dashboardService.js`:

```js
import api from './api.js';

export async function getDashboard() {
  const { data } = await api.get('/dashboard');
  return data.data;
}
```

- [ ] **Step 2: Dashboard hook**

Create `frontend/src/hooks/useDashboard.js`:

```js
import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '../services/dashboardService.js';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: dashboardService.getDashboard });
}
```

- [ ] **Step 3: Rewrite `AdminHome.jsx`**

Replace the full contents of `frontend/src/pages/admin/AdminHome.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useDashboard } from '../../hooks/useDashboard.js';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
};

const STATUS_CARDS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function StatCard({ label, value, to }) {
  return (
    <Link to={to} className="rounded-lg bg-white p-5 shadow transition hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-800">{value}</p>
    </Link>
  );
}

function truncate(text, length) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export default function AdminHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return <div className="text-slate-500">Loading dashboard...</div>;
  }

  if (isError || !data) {
    return <div className="text-slate-500">Failed to load dashboard.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Welcome, {user?.name}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {STATUS_CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={`${card.label} Appointments`}
            value={data.appointmentCounts[card.key]}
            to="/admin/appointments"
          />
        ))}
        <StatCard label="Active Doctors" value={data.activeDoctorCount} to="/admin/doctors" />
        {isAdmin && <StatCard label="Active Staff" value={data.activeStaffCount} to="/admin/staff" />}
        <StatCard label="Unread Messages" value={data.unreadMessageCount} to="/admin/messages" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent Appointments</h2>
            <Link to="/admin/appointments" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All →
            </Link>
          </div>
          {data.recentAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">All caught up — no appointments yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentAppointments.map((appointment) => (
                <li key={appointment.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{appointment.patient_name}</p>
                    <p className="text-slate-500">
                      {appointment.appointment_date} · {appointment.appointment_time}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[appointment.status]}`}>
                    {appointment.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-white p-5 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent Unread Messages</h2>
            <Link to="/admin/messages" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All →
            </Link>
          </div>
          {data.recentUnreadMessages.length === 0 ? (
            <p className="text-sm text-slate-500">All caught up — no unread messages.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentUnreadMessages.map((message) => (
                <li key={message.id} className="text-sm">
                  <p className="font-medium text-slate-800">{message.name}</p>
                  <p className="text-slate-500">{truncate(message.message, 80)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify with a live browser walkthrough**

Run: `cd frontend && npm run build` — expect a clean build with no errors.

With both dev servers running, first run a quick DB query (or reuse Task 1's verify script) to note the CURRENT actual counts — appointment counts by status, active doctor count, active staff count, unread message count — since this data can change between when this plan was written and when this task executes (e.g. earlier phases' walkthroughs may have added test rows). Then:

1. Log in as admin, visit `/admin`. Confirm 7 stat cards render (4 appointment-status + Active Doctors + Active Staff + Unread Messages), each showing the exact counts from your DB query. Click each card and confirm it navigates to the correct list page (`/admin/appointments`, `/admin/doctors`, `/admin/staff`, `/admin/messages`).
2. Confirm the "Recent Appointments" panel shows real rows (or the "All caught up" message if there are none) with correct patient name/date/time/status-badge-color, and its "View All →" link navigates to `/admin/appointments`.
3. Confirm the "Recent Unread Messages" panel shows real rows (or "All caught up" if none) with correct name/truncated-message, and its "View All →" link navigates to `/admin/messages`.
4. Log out, log in as staff, revisit `/admin`. Confirm the same dashboard renders with the same data EXCEPT the "Active Staff" card is absent (6 cards total, not 7) — confirming the admin-only frontend guard works while the backend still returns the same full payload to both roles.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/dashboardService.js frontend/src/hooks/useDashboard.js frontend/src/pages/admin/AdminHome.jsx
git commit -m "feat: replace AdminHome placeholder with real dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** All of the design spec's §3 (backend) and §4 (frontend) are covered by Task 1 and Task 2 respectively. §2's role-visibility decision is implemented as a frontend-only guard (Task 2 Step 3) with the backend returning identical data to both roles (Task 1), exactly as specified. §7's out-of-scope items (charts, filter-via-URL, revenue, real-time updates, date ranges) are not present anywhere in either task.
- **Placeholder scan:** No TBD/TODO; every step has complete, runnable code.
- **Type/interface consistency:** `appointmentCounts` keys (`pending`/`approved`/`completed`/`cancelled`/`total`) are defined once in Task 1's service and consumed with the exact same key names in Task 2's `STATUS_CARDS`/`StatCard` usage. `STATUS_STYLES` in `AdminHome.jsx` is a verbatim copy of `AppointmentList.jsx`'s existing constant, not a re-derivation. `recentAppointments`/`recentUnreadMessages` field names (`patient_name`, `appointment_date`, `appointment_time`, `status`, `name`, `message`, `id`) match exactly what Task 1's repository selects and what Task 2's JSX destructures.
