# Phase 3 Design: Appointment Management

**Status:** Approved
**Scope:** Third of 7 phases. Covers both "Appointment Booking" (public, unauthenticated) and "Appointment Management" (admin/staff) from the original 12-module spec. Public booking form + API now, ahead of the full Public Website (Phase 5), so Phase 5 can fold `/book` into the homepage rather than building it from scratch. Builds directly on Phase 1's `appointments` table (no schema changes) and Phase 2's `doctors` module (public doctor list feeds the booking dropdown).

## 1. Context

Phase 1 delivered the `appointments` table (patient fields, nullable `doctor_id` FK, `status` defaulting to `pending`) and the auth/layered-backend scaffold. Phase 2 delivered doctor CRUD plus `GET /api/doctors/public`. Phase 3 is the first phase with a real unauthenticated write path (public booking) and the first admin module where staff have write access (not just read), rather than the admin-only pattern used for Doctors.

## 2. Decisions Confirmed With User

- **Public booking ships now, not deferred to Phase 5:** `POST /api/appointments/public` and a standalone `/book` page ship in this phase. Phase 5 will embed/link to `/book` from the homepage rather than rebuilding it.
- **Staff can manage status and edit; only admin can delete:** unlike Doctors (admin-only writes), appointment status changes and detail edits are routine front-desk work — both admin and staff get write access via `PATCH`. `DELETE` stays admin-only.
- **No double-booking prevention:** a new booking is never rejected for colliding with an existing doctor/date/time. Front desk resolves conflicts manually. Keeps booking logic simple; can be added later if it becomes a real problem.
- **Combined edit endpoint:** one `PATCH /api/appointments/:id` handles both status-only changes and full field edits (all fields optional in the validator). No separate `/status` endpoint — there's no role boundary to enforce between the two kinds of change, so splitting them would add an endpoint and a validator for no access-control benefit.
- **No dedicated staff-facing "create appointment" admin form:** staff take phone/walk-in bookings through the same public `/book` page (open in another tab). One booking code path, less to maintain.
- **Admin edit UI is a modal, not a separate page:** editing an appointment's fields (not just status) opens a modal on the list page, reusing the booking form's field set. Avoids a fourth routed page for a low-volume clinic list.

## 3. Backend

### 3.1 Files

```
backend/src/
  repositories/appointmentRepository.js
  services/appointmentService.js
  controllers/appointmentController.js
  routes/appointmentRoutes.js
  validators/appointmentValidators.js
```

Modified: `backend/src/routes/index.js` (mount `/appointments`), `backend/src/middlewares/rateLimiters.js` (add a public-booking limiter).

### 3.2 Repository (`appointmentRepository.js`)

Raw parameterized SQL only, one function per operation:
- `findAll(filters)` — `filters` is `{ status, doctorId, date }`, each optional; builds a `WHERE` clause incrementally from only the provided filters, all values bound as parameters (never string-concatenated). Orders by `appointment_date DESC, appointment_time DESC`.
- `findById(id)` — single appointment or `null`.
- `create(appointment)` — insert (status hardcoded to `'pending'` by the service, not the caller), returns new id.
- `update(id, fields)` — partial update; builds the `SET` clause from only the keys present in `fields`, all values bound as parameters.
- `remove(id)` — delete by id.

### 3.3 Service (`appointmentService.js`)

- `listAppointments(filters)` — passthrough to the repository.
- `getAppointment(id)` — throws `AppError('Appointment not found.', 404)` if missing.
- `createPublicAppointment(data)` — builds the row with `status: 'pending'` always, regardless of any `status` field in `data` (public input can never set its own status); inserts; returns the created appointment.
- `updateAppointment(id, data)` — fetches the existing appointment first (404 if missing), updates only the provided fields, returns the refreshed row.
- `deleteAppointment(id)` — fetches the appointment first (404 if missing), removes it. No FK-block concern here (appointments are the referenced-by side for doctors, not the reverse).

### 3.4 Validation (`validators/appointmentValidators.js`)

Two schemas, since public input and admin input allow different fields:

```js
const publicBookingSchema = z.object({
  patient_name: z.string().min(2),
  mobile: z.string().min(7),
  email: z.string().email().optional(),
  gender: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  doctor_id: z.coerce.number().int().optional(),
  appointment_date: z.string().refine(
    (val) => !Number.isNaN(Date.parse(val)) && val >= new Date().toISOString().slice(0, 10),
    'Appointment date must be today or later.'
  ),
  appointment_time: z.string().min(1),
  problem_description: z.string().optional(),
});

const appointmentUpdateSchema = z.object({
  patient_name: z.string().min(2).optional(),
  mobile: z.string().min(7).optional(),
  email: z.string().email().optional(),
  gender: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  doctor_id: z.coerce.number().int().nullable().optional(),
  appointment_date: z.string().optional(),
  appointment_time: z.string().optional(),
  problem_description: z.string().optional(),
  status: z.enum(['pending', 'approved', 'cancelled', 'completed']).optional(),
});
```

Both are plain JSON bodies (no file upload involved), unlike Phase 2's multipart forms — no `z.coerce.boolean()` gotcha to work around here.

### 3.5 Routes (`appointmentRoutes.js`)

| Method | Path | Middleware | Notes |
|---|---|---|---|
| POST | `/api/appointments/public` | `bookingRateLimiter`, `validate(publicBookingSchema)` | no auth; status forced to `pending` |
| GET | `/api/appointments` | `authenticate`, `authorize('admin','staff')` | query params: `status`, `doctorId`, `date` |
| GET | `/api/appointments/:id` | `authenticate`, `authorize('admin','staff')` | |
| PATCH | `/api/appointments/:id` | `authenticate`, `authorize('admin','staff')`, `validate(appointmentUpdateSchema)` | status change or field edit |
| DELETE | `/api/appointments/:id` | `authenticate`, `authorize('admin')` | |

`/public` is registered before `/:id` so it isn't shadowed by the param route (same reasoning as Phase 2's `/doctors/public`).

### 3.6 Rate limiting (`middlewares/rateLimiters.js`)

Add `bookingRateLimiter`, following the existing `express-rate-limit` pattern already used for login in Phase 1: 5 requests per 15 minutes per IP, applied only to `POST /appointments/public`. Prevents spam submissions against an endpoint with no auth barrier.

## 4. Frontend

### 4.1 Files

```
frontend/src/
  services/appointmentService.js
  hooks/useAppointments.js
  pages/PublicBooking.jsx
  pages/admin/appointments/AppointmentList.jsx
  pages/admin/appointments/AppointmentEditModal.jsx
```

Modified: `frontend/src/App.jsx` (new routes, including `/book` outside the `ProtectedRoute` tree), `frontend/src/layouts/AdminLayout.jsx` (new "Appointments" sidebar link).

### 4.2 Data flow

- `appointmentService.js` — `listAppointments(filters)`, `getAppointment(id)`, `bookAppointmentPublic(data)`, `updateAppointment(id, data)`, `deleteAppointment(id)`. All plain JSON (`axios` default), no `FormData`.
- `useAppointments.js` — React Query wrappers: `useAppointments(filters)`, `useAppointment(id)`, `useBookAppointment()`, `useUpdateAppointment()`, `useDeleteAppointment()` (mutations invalidate the `['appointments']` query key).
- `PublicBooking.jsx` — standalone page at `/book`, no `AdminLayout`, no auth. react-hook-form with the same fields as `publicBookingSchema`. Doctor `<select>` populated from the existing `useDoctors` public hook (or a direct call to `GET /doctors/public`), with a "General Inquiry / Not sure" option that omits `doctor_id`. `appointment_date` via `<input type="date" min={today}>`; `appointment_time` via `<input type="time">`, converted to a `"h:mm AM/PM"` string on submit to match the doctor module's existing free-text time convention. Shows a success confirmation view after submit (no redirect needed — there's nowhere authenticated to send a public visitor).
- `AppointmentList.jsx` — table with filter controls (status `<select>`, doctor `<select>`, date picker) that feed `filters` into `useAppointments`. Columns: patient name, mobile, doctor (or "—" if none), date, time, status. Inline status `<select>` per row (calls `useUpdateAppointment` with just `{ status }`) available to admin+staff. "Edit" button opens `AppointmentEditModal`. "Delete" button (via the existing `ConfirmDialog` from Phase 2) only renders when `user.role === 'admin'`.
- `AppointmentEditModal.jsx` — modal form (react-hook-form, pre-filled from the row's data) covering the same fields as the booking form plus `status`; submits via `useUpdateAppointment`.

### 4.3 Routing

```
/book                          → PublicBooking       (no auth, outside AdminLayout)
/admin/appointments             → AppointmentList     (ProtectedRoute, any authenticated role)
```

No separate create/edit *routes* for appointments in the admin panel — editing happens in-place via the modal, and creation happens via `/book`.

`AdminLayout`'s sidebar gets an "Appointments" nav link alongside the existing "Dashboard" and "Doctors" links.

## 5. Error Handling

- 404 for a missing appointment on `GET /:id`, `PATCH /:id`, `DELETE /:id`.
- 400 for validation failures (existing `validate` middleware) — e.g. booking a past date, missing required patient fields.
- 429 for the public booking rate limiter, via the existing `express-rate-limit` response shape already established for login in Phase 1.
- Frontend: mutation errors surface via `toast.error(err.message)`, consistent with Phases 1 and 2.

## 6. Verification (no automated test suite, per Phase 1's established decision)

1. Repository/service-layer checks via standalone Node ESM scripts against the real DB: create, filter by each of `status`/`doctorId`/`date` individually and combined, partial update, delete.
2. `curl` sequence: public booking (confirm `status` is always `pending` even if the request body tries to set another value), list/get as admin and as staff, `PATCH` status as staff (expect success), `PATCH` full edit as staff (expect success), `DELETE` as staff (expect 403), `DELETE` as admin (expect success), booking with a past date (expect 400), 6 rapid public bookings from the same IP (expect the 6th to 429).
3. Live browser walkthrough (Playwright): submit a booking via `/book` as an anonymous visitor (no doctor selected), confirm it appears in `/admin/appointments` as `pending`, change its status via the inline dropdown as staff, edit its details via the modal, confirm staff sees no Delete button, log in as admin and delete it.

## 7. Explicitly Out of Scope for Phase 3

- Embedding the booking form into the homepage / full public site chrome (Phase 5) — `/book` stands alone for now.
- Dashboard appointment counts/charts (Phase 6).
- Email/SMS notifications on booking or status change — no notification service exists in the tech stack.
- Double-booking prevention (explicit decision above).
- Pagination on the appointment list — not needed at this scale (YAGNI), matching the Doctor list precedent.
