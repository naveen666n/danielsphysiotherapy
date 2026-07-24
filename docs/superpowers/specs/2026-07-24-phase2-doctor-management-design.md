# Phase 2 Design: Doctor Management

**Status:** Approved
**Scope:** Second of 7 phases. Full CRUD for doctors (create/edit/delete restricted to admin, viewing open to admin+staff), photo upload via Multer, and a public unauthenticated list endpoint for the future public website (Phase 5). Builds directly on Phase 1's `doctors` table (no schema changes) and its layered backend/auth infrastructure — this phase adds no new tables.

## 1. Context

Phase 1 delivered the full 8-table schema (including `doctors`), working admin/staff auth (httpOnly JWT cookie, `authenticate`/`authorize` middlewares), the layered backend structure (`routes → middlewares → controllers → services → repositories`), and a frontend shell (`AuthContext`, `ProtectedRoute`, `AdminLayout` with a placeholder sidebar). Phase 2 is the first phase to build real business functionality on top of that scaffold.

Role rules from the original spec apply here: Admin has full CRUD; Staff "can view doctors" but cannot create/edit/delete them.

## 2. Decisions Confirmed With User

- **Public endpoint now, not deferred to Phase 5:** `GET /api/doctors/public` ships in this phase (unauthenticated, active doctors only), since the data layer is already being built and it costs nothing extra to expose now.
- **Delete is blocked if referenced:** `DELETE /api/doctors/:id` fails with `409` and a clear message if any appointment references that doctor (via the existing FK from Phase 1's schema). Admin must deactivate (via the `active` field on the edit form) instead of deleting a doctor with appointment history. No new appointments exist until Phase 3, so this path is tested against a directly-inserted fixture row in this phase's verification.

## 3. Backend

### 3.1 Files

```
backend/src/
  repositories/doctorRepository.js
  services/doctorService.js
  controllers/doctorController.js
  routes/doctorRoutes.js
  middlewares/uploadPhoto.js       (new)
  validators/doctorValidators.js
  uploads/doctors/                  (new subdirectory, created via .gitkeep)
```

Modified: `backend/src/app.js` (serve `/uploads` statically), `backend/src/routes/index.js` (mount `/doctors`), `backend/src/middlewares/errorHandler.js` (handle `multer.MulterError`).

### 3.2 Repository (`doctorRepository.js`)

Raw parameterized SQL only, one function per operation:
- `findAll()` — all doctors, all columns.
- `findActiveOnly()` — `WHERE active = TRUE`, for the public endpoint.
- `findById(id)` — single doctor or `null`.
- `create(doctor)` — insert, returns new id.
- `update(id, doctor)` — update by id.
- `remove(id)` — delete by id. Lets the MySQL FK error propagate — the service layer is what interprets it.

### 3.3 Service (`doctorService.js`)

- `listDoctors()` / `listPublicDoctors()` — thin passthroughs to the repository.
- `getDoctor(id)` — throws `AppError('Doctor not found.', 404)` if missing.
- `createDoctor(data, file)` — builds `photo_url` from the uploaded file (`/uploads/doctors/<filename>` if a file was provided, else `null`), inserts.
- `updateDoctor(id, data, file)` — fetches the existing doctor first (404 if missing); if a new file was uploaded, deletes the old photo from disk (`fs.unlink`, wrapped so a missing/already-gone file doesn't throw) and uses the new `photo_url`; if no new file, keeps the existing `photo_url` untouched. Updates the row.
- `deleteDoctor(id)` — fetches the doctor first (404 if missing), attempts `repository.remove(id)`. Catches a MySQL error with `code === 'ER_ROW_IS_REFERENCED_2'` and rethrows as `AppError('Cannot delete a doctor with existing appointments. Deactivate the doctor instead.', 409)`. On success, deletes the photo file from disk (best-effort).

This is the only place in the codebase that interprets MySQL FK error codes — keeps that knowledge out of the controller and repository.

### 3.4 Photo upload (`middlewares/uploadPhoto.js`)

```js
multer({
  storage: multer.diskStorage({
    destination: 'backend/src/uploads/doctors/',
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  fileFilter: only accept image/jpeg, image/png, image/webp — else reject with a multer error,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
})
```

Exported as `uploadDoctorPhoto` (a configured `.single('photo')` instance), used directly in `doctorRoutes.js` on the `POST`/`PUT` routes, before validation.

`app.js` adds one line: `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))`, so `photo_url` values like `/uploads/doctors/<uuid>.jpg` are directly servable.

`errorHandler.js` gets one new branch, checked before the generic 500 fallback: if `err instanceof multer.MulterError`, respond `400` with `err.message` (Multer's own messages — "File too large", "Unexpected field", etc. — are already user-appropriate) — keeps upload failures inside the standard `{success, message, errors}` envelope instead of an unhandled crash.

### 3.5 Validation (`validators/doctorValidators.js`)

Multipart form fields arrive as strings, so numeric/boolean fields use `z.coerce`:

```js
const doctorSchema = z.object({
  name: z.string().min(2),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  experience_years: z.coerce.number().int().min(0).optional(),
  consultation_fee: z.coerce.number().min(0).optional(),
  working_days: z.string().optional(),      // e.g. "Mon,Tue,Wed" — see 4.2
  available_time: z.string().optional(),    // free text, e.g. "9:00 AM - 5:00 PM"
  active: z.coerce.boolean().optional(),
});
```

`working_days` is deliberately a loosely-validated string, not a strict enum, matching the existing `VARCHAR(100)` column from Phase 1 — the frontend's checkbox UI is what keeps it well-formed day-to-day; over-validating an internal scheduling field on the backend isn't worth the complexity for a single-clinic app.

### 3.6 Routes (`doctorRoutes.js`)

| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/doctors` | `authenticate`, `authorize('admin','staff')` | full list |
| GET | `/api/doctors/public` | none | active only |
| GET | `/api/doctors/:id` | `authenticate`, `authorize('admin','staff')` | |
| POST | `/api/doctors` | `authenticate`, `authorize('admin')`, `uploadDoctorPhoto`, `validate(doctorSchema)` | photo optional |
| PUT | `/api/doctors/:id` | `authenticate`, `authorize('admin')`, `uploadDoctorPhoto`, `validate(doctorSchema)` | photo optional |
| DELETE | `/api/doctors/:id` | `authenticate`, `authorize('admin')` | 409 if referenced |

`/public` is registered before `/:id` in the router so it isn't shadowed by the param route.

## 4. Frontend

### 4.1 Files

```
frontend/src/
  services/doctorService.js
  hooks/useDoctors.js
  pages/admin/doctors/DoctorList.jsx
  pages/admin/doctors/DoctorForm.jsx
  components/ConfirmDialog.jsx
```

Modified: `frontend/src/App.jsx` (new routes), `frontend/src/layouts/AdminLayout.jsx` (real sidebar nav replacing the "Navigation coming soon" placeholder).

### 4.2 Data flow

- `doctorService.js` — `listDoctors()`, `getDoctor(id)`, `createDoctor(formData)`, `updateDoctor(id, formData)`, `deleteDoctor(id)`, `listPublicDoctors()`. Create/update build a `FormData` object from the form values (axios sends it as `multipart/form-data` automatically — no header override needed, consistent with the existing `api.js` instance from Phase 1).
- `useDoctors.js` — React Query wrappers: `useDoctors()` (list), `useDoctor(id)`, `useCreateDoctor()`, `useUpdateDoctor()`, `useDeleteDoctor()` (mutations invalidate the `['doctors']` query key on success).
- `DoctorForm.jsx` — one component reused for create and edit (an `id` prop/route param determines mode). Day-of-week checkboxes (Mon–Sun) are joined into a comma-separated string on submit, matching the backend's `working_days` format; a plain text input for `available_time`; a file input for the photo with a local preview (`URL.createObjectURL`); an `active` checkbox (defaults to checked on create).
- `DoctorList.jsx` — table with a photo thumbnail (`<img>` pointing at `${API_ORIGIN}${photo_url}`, a small util derives `API_ORIGIN` from `VITE_API_URL` by stripping the trailing `/api`), name, specialization, experience, fee, working days, an active/inactive badge, and Edit/Delete actions. Edit/Delete only render when `useAuth().user.role === 'admin'` — the backend's `authorize('admin')` is the actual enforcement; this is just UX (staff shouldn't see buttons that will 403).
- `ConfirmDialog.jsx` — generic modal (`isOpen`, `title`, `message`, `onConfirm`, `onCancel` props), used by `DoctorList` before calling `useDeleteDoctor()`. Deletion failure (409, doctor referenced by an appointment) surfaces via the existing toast pattern from Phase 1.

### 4.3 Routing

```
/admin/doctors            → DoctorList     (ProtectedRoute, any authenticated role)
/admin/doctors/new        → DoctorForm     (ProtectedRoute roles={['admin']})
/admin/doctors/:id/edit   → DoctorForm     (ProtectedRoute roles={['admin']})
```

`AdminLayout`'s sidebar gets a real "Doctors" nav link (and a "Dashboard" link back to `/admin`, since the placeholder text is being replaced anyway) — still minimal, more nav items arrive in later phases as their pages are built.

## 5. Error Handling

- 404 for a missing doctor on `GET /:id`, `PUT /:id`, `DELETE /:id`.
- 409 for delete-blocked-by-FK, with the exact message above.
- 400 for validation failures (existing `validate` middleware) and for Multer failures (file too large / wrong type — new `errorHandler.js` branch).
- Frontend: mutation errors surface via `toast.error(err.message)`, consistent with Phase 1's Login page pattern.

## 6. Verification (no automated test suite, per Phase 1's established decision)

1. `curl -F` sequence: create a doctor with a photo, list (authenticated as admin and as staff), get by id, update (with and without a new photo — confirm the old file is removed from disk on replacement), get the public list unauthenticated, confirm a non-admin (staff) gets 403 on create/update/delete.
2. Insert a fixture appointment row directly via SQL referencing a test doctor (since Phase 3 doesn't exist yet), attempt delete, confirm 409, then delete the fixture appointment and confirm the doctor delete now succeeds (and the photo file is removed from disk).
3. Multer failure checks: upload a >2MB file (expect 400), upload a non-image file (expect 400).
4. Live browser walkthrough (Playwright, as done for Phase 1): log in as admin, create a doctor with a photo, see it in the list with a thumbnail, edit it, delete it (with confirmation dialog), and confirm a staff-role login sees the list but not the Edit/Delete buttons.

## 7. Explicitly Out of Scope for Phase 2

- Appointment booking/management (Phase 3) — the FK-blocked-delete path is tested via a raw SQL fixture row, not through a real appointment UI.
- Public website doctor display UI (Phase 5) — only the public API endpoint ships now.
- Dashboard doctor count card (Phase 6).
- Pagination/filtering on the doctor list — not needed at this scale (YAGNI).
