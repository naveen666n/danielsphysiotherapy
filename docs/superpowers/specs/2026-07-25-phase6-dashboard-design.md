# Phase 6: Dashboard — Design

**Scope:** Replace the placeholder `AdminHome.jsx` ("The full dashboard is built in a later phase. Login is working.") with a real admin dashboard: summary stat cards and recent-activity panels, backed by one new aggregation endpoint. This is the last of the 6 original 12-module-spec areas that has UI; Phase 7 (Deployment) is infrastructure-only and does not add app features.

## 1. Context

Every prior phase's design doc explicitly deferred a piece of dashboard content to this phase: Phase 1 deferred "dashboard cards/charts," Phase 2 deferred "dashboard doctor count card," Phase 3 deferred "dashboard appointment counts/charts," Phase 4 deferred "dashboard staff count card." This phase collects all of those into one real dashboard, plus a recent-activity view for appointments and contact messages (the two "needs attention" data types in the app).

Current real data in the DB: 3 appointments (1 pending, 2 completed), 1 active doctor, 1 active staff user, 7 unread contact messages. The dashboard must look meaningful and correct at this small scale, not just at hypothetical future scale.

## 2. Decisions Confirmed With User

- **Scope: stat cards + recent activity, no charts.** No new charting dependency; matches the current data volume of a single-location clinic.
- **Same dashboard for both admin and staff** — every card/panel is read-only summary data, consistent with the "staff can view everything, edit nothing" pattern used throughout the app (Doctors, Services, Settings, etc.).
- **Recent activity = recent appointments + recent unread messages** (5 each) — the two things a front-desk user checks first.
- **Cards link to their base list page**, not a pre-filtered view — none of the existing list pages (`AppointmentList`, `ContactMessageList`) support filter-via-URL today, and adding that is out of scope for this phase.

## 3. Backend — New Module: Dashboard

A single read-only aggregation endpoint. No schema changes — every table it reads from already exists (`appointments`, `doctors`, `users`/`roles`, `contact_messages`).

### 3.1 Response Shape

`GET /api/dashboard`:

```json
{
  "appointmentCounts": { "pending": 1, "approved": 0, "completed": 2, "cancelled": 0, "total": 3 },
  "activeDoctorCount": 1,
  "activeStaffCount": 1,
  "unreadMessageCount": 7,
  "recentAppointments": [
    { "id": 16, "patient_name": "...", "appointment_date": "2026-07-25", "appointment_time": "10:00 AM", "status": "pending" }
  ],
  "recentUnreadMessages": [
    { "id": 12, "name": "...", "message": "...", "created_at": "2026-07-25T08:00:00.000Z" }
  ]
}
```

`appointmentCounts` always has all 4 status keys (`pending`, `approved`, `completed`, `cancelled` — matching the exact enum in `appointmentValidators.js`) present with a value of `0` when a status has no rows, plus `total`. `recentAppointments`/`recentUnreadMessages` are each capped at 5 rows, newest first.

### 3.2 Files

```
backend/src/
  repositories/dashboardRepository.js   (new)
  services/dashboardService.js          (new)
  controllers/dashboardController.js    (new)
  routes/dashboardRoutes.js             (new)
  routes/index.js                       (modified — mount at /dashboard)
```

### 3.3 Repository (`dashboardRepository.js`)

Six focused, single-purpose queries — no cross-repository calls, direct SQL matching the existing raw-query convention:

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

(Confirmed against the installed `mysql2@^3.23.1` with `namedPlaceholders: true`: named-placeholder binding on `LIMIT` works correctly — no fallback needed.)

### 3.4 Service (`dashboardService.js`)

Assembles the full response in parallel and normalizes the appointment-status counts into the fixed 4-key shape:

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

### 3.5 Controller and Routes

Same shape as every other read-only module (`settingsController`'s `getSettings` pattern):

```js
// dashboardController.js
export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard();
  sendResponse(res, { status: 200, message: 'Dashboard retrieved', data: dashboard });
});
```

```js
// dashboardRoutes.js
router.get('/', authenticate, authorize('admin', 'staff'), dashboardController.getDashboard);
```

Mounted in `routes/index.js` as `router.use('/dashboard', dashboardRoutes);`. No public route — the dashboard is never shown outside the admin panel.

## 4. Frontend

### 4.1 Files

```
frontend/src/
  services/dashboardService.js   (new)
  hooks/useDashboard.js          (new)
  pages/admin/AdminHome.jsx      (modified — replaced placeholder with real dashboard)
```

### 4.2 Data Layer

```js
// services/dashboardService.js
import api from './api.js';

export async function getDashboard() {
  const { data } = await api.get('/dashboard');
  return data.data;
}
```

```js
// hooks/useDashboard.js
import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '../services/dashboardService.js';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: dashboardService.getDashboard });
}
```

### 4.3 `AdminHome.jsx`

Structure: a welcome heading (kept from the current placeholder, `Welcome, {user?.name}`), then a responsive grid of 7 stat cards:
- **Pending**, **Approved**, **Completed**, **Cancelled** appointment counts (4 cards, each linking to `/admin/appointments`)
- **Active Doctors** (linking to `/admin/doctors`)
- **Active Staff** (linking to `/admin/staff`, only rendered when `user.role === 'admin'` — matches the existing admin-only guard on the Staff nav link and route, since staff can't reach `/admin/staff` even though the dashboard data itself is visible to both roles per §2)
- **Unread Messages** (linking to `/admin/messages`)

Below the cards, two side-by-side panels (stacked on mobile): "Recent Appointments" (patient name, date, status badge reusing `AppointmentList`'s existing status-color convention) and "Recent Unread Messages" (sender name, message preview truncated to ~80 chars, relative or short date), each with a "View All →" link to its full list page. Empty recent-activity lists show a small "All caught up" message instead of a blank panel. Loading state is a simple "Loading dashboard..." text, matching the existing loading-state convention used elsewhere in the admin panel (e.g. `SettingsForm.jsx`).

This keeps the admin panel's existing blue palette — no visual changes to `AdminLayout.jsx` itself, this phase only fills in the `<Outlet />` content at `/admin` (index route).

## 5. Error Handling

- No new error cases: this is a read-only, unauthenticated-never endpoint (401 for no session, 403 never occurs since both roles are authorized — matches the existing `errorHandler.js`/`authorize` behavior, unchanged).
- Frontend: `isLoading`/`isError` states handled the same way as every other admin list/detail page in the app (loading text, `toast.error` is not applicable here since there's no user-initiated mutation — a fetch failure just leaves the loading/error state visible, matching how `SettingsForm.jsx` behaves on load failure today).

## 6. Verification (no automated test suite, per Phase 1's standing decision)

1. A standalone Node ESM script exercising `dashboardRepository`/`dashboardService` against the real DB, confirming the returned shape matches §3.1 exactly (all 4 status keys present even when a status has 0 rows, `total` sums correctly, recent lists capped at 5 and ordered newest-first).
2. `curl` sequences: `GET /dashboard` unauthenticated → 401; as staff → 200 with full data; as admin → 200 with full data (same payload, proving §2's "same dashboard for both roles" decision).
3. Live Playwright walkthrough: log in as admin, confirm all 7 cards render with the real seeded counts (1 pending, 0 approved, 2 completed, 0 cancelled, 1 active doctor, 1 active staff, 7 unread messages), confirm each card link navigates to the correct list page, confirm the two recent-activity panels show real rows with correct data. Then log in as staff and confirm the same dashboard renders identically except the "Active Staff" card is absent (per the admin-only guard in §4.3).

## 7. Explicitly Out of Scope for Phase 6

- Charts/graphs of any kind — no new charting dependency (§2).
- Filter-via-URL on `AppointmentList`/`ContactMessageList` (cards link to the unfiltered list page only).
- Any revenue/financial metrics — the schema has no payment/transaction data to aggregate.
- Real-time/live-updating dashboard (e.g. polling, websockets) — data refreshes on page load/navigation only, consistent with every other page in the app.
- Date-range selection or historical trend views.
