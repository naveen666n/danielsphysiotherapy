# Phase 4 Design: Staff Management

**Status:** Approved
**Scope:** Fourth of 7 phases. Admin-only CRUD (create/edit/deactivate — no hard delete) for staff-role user accounts, plus a shared fix to `authenticate` so deactivation takes effect immediately across the whole app. No new tables — `users` already doubles as the staff table (Phase 1's design), so this phase extends the existing `userRepository`/`roleRepository` rather than adding a new schema.

## 1. Context

Phase 1 created the `users`/`roles` tables and the auth flow (`authenticate`, `authorize`, login/me/logout), noting explicitly that "`users` doubles as the Staff Management table (Phase 4): staff are just rows with `role_id` pointing at `staff`." Only `findUserByUsername`, `findUserById`, and `createUser` exist so far — no list/update capability, and no HTTP layer at all for user management. Phase 4 builds that on top of the existing table.

While reviewing the existing auth code for this phase, one gap surfaced: `authenticate` (`backend/src/middlewares/authenticate.js`) currently trusts `{ id, role }` straight from the JWT payload and never re-checks the database. Only `GET /api/auth/me` does a fresh `active` check (`authService.getCurrentUser`). This means a staff account deactivated today would keep working on every other route (Doctors, Appointments) until their JWT expires (up to 8h) or their frontend happens to call `/me` again. Since "deactivate a staff account" is this phase's core safety feature, this phase also fixes `authenticate` itself.

## 2. Decisions Confirmed With User

- **Staff-role accounts only, not general user management:** this module creates/edits/deactivates users with `role = 'staff'` exclusively. Admin accounts are out of scope — the Phase 1 `seed:admin` script remains the only way to create one. `staffService` never returns or accepts an id belonging to a non-staff user, even if guessed directly.
- **Deactivate only, no hard delete:** removing a staff member toggles the existing `users.active` boolean via the same edit form (no separate delete action). Reactivating a former staff member is the same toggle, back to `true`.
- **Admin-only, full stop:** unlike Doctors/Appointments (where staff have some read/write access), staff have zero access to this module — not even read-only. `authorize('admin')` on every route; the frontend sidebar link is hidden entirely for staff.
- **Admin sets/resets passwords directly:** no email/SMS invite or reset-link flow (none exists in this app's tech stack). Admin sets the password on create and can reset it anytime via the edit form (blank/omitted = unchanged); no staff self-service "change my password" feature in this phase.
- **`authenticate` middleware now does a fresh DB check on every request**, not just `/me`. Deactivating a staff account immediately blocks their next API call anywhere in the app, not just their next login.

## 3. Backend

### 3.1 Files

```
backend/src/
  repositories/userRepository.js   (modified — add findStaffUsers, updateUser)
  services/staffService.js          (new)
  controllers/staffController.js    (new)
  routes/staffRoutes.js             (new)
  validators/staffValidators.js     (new)
```

Modified: `backend/src/middlewares/authenticate.js` (fresh DB active-check), `backend/src/routes/index.js` (mount `/staff`).

### 3.2 Repository (`userRepository.js` additions)

- `findStaffUsers()` — `SELECT ... FROM users u JOIN roles r ... WHERE r.name = 'staff' ORDER BY u.name ASC`, same column set as the existing `findUserById` (excludes `password_hash`).
- `updateUser(id, fields)` — partial update, same dynamic-`SET`-from-provided-keys pattern as `appointmentRepository.update` (Phase 3): only the keys present in `fields` are written.

`findUserById` already exists and is reused as-is for the single-staff-member lookup (the service layer adds the `role === 'staff'` scoping check, not the repository).

### 3.3 Service (`staffService.js`)

- `listStaff()` — passthrough to `findStaffUsers()`.
- `getStaffMember(id)` — `findUserById(id)`; throws `AppError('Staff member not found.', 404)` if missing OR if the found user's `role !== 'staff'` (keeps this module from ever touching the admin account, even via a guessed id).
- `createStaffMember(data)` — resolves the `staff` role id via `roleRepository.findRoleByName('staff')`, hashes `data.password` with `bcrypt.hash(password, 10)` (matching `seedAdmin.js`'s existing rounds), calls `userRepository.createUser`. Catches `err.code === 'ER_DUP_ENTRY'` and rethrows as `AppError('Username already taken.', 409)`.
- `updateStaffMember(id, data)` — fetches via `getStaffMember` first (404/role-scoped as above). Builds a partial-fields object: always includes `name`, `mobile`, `email`, `active` if present in `data`; if `data.password` is present and non-empty, hashes it and includes `password_hash`; if `data.username` is present, includes it. Same `ER_DUP_ENTRY` → 409 handling as create. Returns the refreshed row via `getStaffMember`.

This mirrors the Doctor/Appointment services' shape: thin service methods, one file interpreting DB-specific errors (FK/unique-constraint) into `AppError`s, no SQL outside the repository.

### 3.4 Validation (`staffValidators.js`)

```js
import { z } from 'zod';

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const booleanFromString = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}, z.boolean().optional());

export const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional().or(z.literal('')),
  active: booleanFromString,
});
```

`password: z.string().min(6).optional().or(z.literal(''))` lets the edit form submit an empty string for "no change" (simpler than omitting the key entirely from a plain JSON body) — the service treats an empty/absent password as "don't touch `password_hash`". `min(3)`/`min(6)` thresholds match the existing `loginSchema` (Phase 1) for consistency, not a new convention. The `booleanFromString` preprocess is copied from `doctorValidators.js` (Phase 2) — same gotcha (`Boolean("false") === true`), same fix, JSON body will send `active` as a real boolean already (not multipart), but this stays defensive/consistent with the rest of the codebase.

### 3.5 Routes (`staffRoutes.js`)

| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/staff` | `authenticate`, `authorize('admin')` | list |
| GET | `/api/staff/:id` | `authenticate`, `authorize('admin')` | 404 if missing or not staff |
| POST | `/api/staff` | `authenticate`, `authorize('admin')`, `validate(createStaffSchema)` | |
| PUT | `/api/staff/:id` | `authenticate`, `authorize('admin')`, `validate(updateStaffSchema)` | includes `active` toggle |

### 3.6 `authenticate` middleware fix

Current behavior: verifies the JWT signature, sets `req.user = { id: payload.id, role: payload.role }` straight from the token, done.

New behavior: after verifying the JWT, calls `findUserById(payload.id)`; if missing or `active === false`, responds `401` with the same message `getCurrentUser` already uses ("Your session is no longer valid. Please log in again." — reusing this exact wording keeps the two paths consistent). On success, sets `req.user = { id: user.id, role: user.role }` from the **fresh DB row**, not the JWT payload — so a role correction would also take effect immediately, though no phase currently changes roles after creation.

This one change affects every protected route in the app (Doctors, Appointments, Staff, future phases) — correctly, since a deactivated user was never supposed to act on any of them. It adds one indexed primary-key lookup per authenticated request, which is negligible at this app's scale (a single small clinic).

## 4. Frontend

### 4.1 Files

```
frontend/src/
  services/staffService.js
  hooks/useStaff.js
  pages/admin/staff/StaffList.jsx
  pages/admin/staff/StaffForm.jsx
```

Modified: `frontend/src/App.jsx` (new routes, all inside the admin-only nested `ProtectedRoute`), `frontend/src/layouts/AdminLayout.jsx` (new "Staff" nav link, admin-only).

### 4.2 Data flow

- `staffService.js` — `listStaff()`, `getStaffMember(id)`, `createStaffMember(payload)`, `updateStaffMember(id, payload)`. Plain JSON via the existing `api` instance (no `FormData` — no file upload in this module).
- `useStaff.js` — `useStaffList()`, `useStaffMember(id)`, `useCreateStaff()`, `useUpdateStaff()` (React Query; mutations invalidate `['staff']` on success), matching the `useDoctors.js`/`useAppointments.js` shape.
- `StaffForm.jsx` — one component for create and edit (mirrors `DoctorForm.jsx`). Fields: name, mobile, email, username, password (label changes to "New Password (leave blank to keep current)" in edit mode), active checkbox (checked by default on create). No photo/file input.
- `StaffList.jsx` — table: name, username, mobile, email, active/inactive badge, Edit link. "Add Staff" button. No Delete button anywhere — deactivation happens by editing a staff member and unchecking Active.

### 4.3 Routing

```
/admin/staff            → StaffList   (ProtectedRoute roles={['admin']})
/admin/staff/new        → StaffForm   (ProtectedRoute roles={['admin']})
/admin/staff/:id/edit   → StaffForm   (ProtectedRoute roles={['admin']})
```

All three nested inside the existing admin-only `ProtectedRoute roles={['admin']}` block in `App.jsx` (the same one currently wrapping `doctors/new` and `doctors/:id/edit`) — unlike Doctors/Appointments, there's no "staff can view" tier here at all.

`AdminLayout`'s sidebar "Staff" link is wrapped in `{user?.role === 'admin' && (...)}`, matching the existing UX-only role-gating pattern already used for Doctor/Appointment action buttons (the real enforcement is server-side `authorize('admin')`; this just avoids showing staff a link that would immediately redirect them away).

## 5. Error Handling

- 404 for a missing or non-staff id on `GET /:id`, `PUT /:id`.
- 409 for a duplicate username on create/edit, with the message "Username already taken."
- 400 for validation failures (existing `validate` middleware).
- 401 (updated message/behavior) from the fixed `authenticate` middleware for any deactivated or deleted user's token, on every route.
- Frontend: mutation errors surface via `toast.error(err.message)`, consistent with all prior phases.

## 6. Verification (no automated test suite, per Phase 1's established decision)

1. Repository/service-layer checks via standalone Node ESM scripts against the real DB: create a staff member, confirm `findStaffUsers` includes them and excludes non-staff rows, update (name/email/password/active), confirm password hash actually changes on password update and stays the same when omitted, confirm duplicate-username create/update throws the mapped 409.
2. `curl` sequence: create/list/get/update as admin; confirm staff gets 403 on all four staff routes (crafted staff JWT, same technique as Phases 2-3); confirm a staff account created via this API can actually log in with the set password; **the `authenticate` fix specifically**: log in as that staff account (real login, real cookie), deactivate them via the admin API, then reuse the staff's original still-valid cookie against any protected route (e.g. `GET /api/doctors`) and confirm it now returns 401 instead of 200 — this is the regression test for the immediate-revocation requirement.
3. Live browser walkthrough (Playwright): admin creates a staff account, logs out, logs in as that staff member, confirms no "Staff" link is visible in the sidebar and direct navigation to `/admin/staff` redirects away; logs back in as admin, deactivates the staff account, confirms the staff member (in a separate browser context, still on their original session) is now locked out on their next action.

## 7. Explicitly Out of Scope for Phase 4

- General/admin user management (explicit decision above) — the seeded admin remains the only admin account creation path.
- Staff self-service password change (explicit decision above).
- Hard delete of staff accounts (explicit decision above).
- Dashboard staff count card (Phase 6).
- Any role beyond `admin`/`staff` (e.g. a third tier) — not in the original spec, not added here.
