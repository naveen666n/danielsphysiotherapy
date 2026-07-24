# Phase 5a Design: Content Management

**Status:** Approved
**Scope:** First half of Phase 5 ("Public Website" in the original 7-phase plan). Admin/staff CRUD for Services, Testimonials, and Hospital Settings, plus a Contact Messages inbox fed by a new public contact-form endpoint. No public-facing UI in this phase — that's Phase 5b, which consumes the `/public` endpoints and data this phase ships. Builds on Phase 1's existing `services`, `testimonials`, `hospital_settings`, `contact_messages` tables (no schema changes) and the layered backend/auth/upload infrastructure from Phases 1-4.

## 1. Context

Phase 1 delivered all 8 tables, including the four this phase owns. Phases 2-4 established the CRUD pattern (repository → service → controller → routes), the Multer photo-upload pattern (Doctors), and RBAC conventions (`authorize('admin')` / `authorize('admin','staff')`). This phase reuses all three, and — since it's about to add two more near-duplicate upload middlewares — extracts the existing Doctor-only upload logic into a shared, reusable factory as part of the work.

The original 12-module spec treats Services, Testimonials, Hospital Settings, and Contact Messages as four separate modules; they're grouped into one phase here because none of them has enough surface area to justify its own phase, and they share no dependencies on each other.

## 2. Decisions Confirmed With User

- **Phase 5 split into 5a (this phase) and 5b:** keeps each implementation plan and whole-branch review to a manageable size, matching the scope of Phases 1-4.
- **Image uploads follow the Doctor pattern exactly:** Multer, 2MB limit, JPEG/PNG/WEBP only, UUID filenames, MIME-derived extensions, orphaned-upload cleanup — extracted into a shared `makeUploadMiddleware(subdir, fieldName)` factory used by Doctors (retrofitted), Services, Testimonials, and Settings' logo.
- **RBAC: staff can view everything in this phase, edit nothing** — matches the Doctors/Appointments pattern (not the admin-only Staff Management pattern), because front-desk staff plausibly need to check services/settings/messages while talking to a patient. Marking a contact message read/unread is the one staff-writable action, treated like an appointment status change — routine, not sensitive.
- **Contact messages support admin-only delete**, in addition to admin+staff mark read/unread — matches the Appointments precedent (staff manage day-to-day, admin handles removal/cleanup).
- **No "active"/moderation field on Services or Testimonials** — this is a Phase 1 schema decision, not revisited here. Everything created is immediately public; there's no draft/approval state.

## 3. Backend

### 3.1 Files

```
backend/src/
  middlewares/upload.js                     (new — shared makeUploadMiddleware(subdir, fieldName) factory)
  middlewares/uploadServicePhoto.js          (new)
  middlewares/uploadTestimonialPhoto.js      (new)
  middlewares/uploadSettingsLogo.js          (new)
  repositories/serviceRepository.js          (new)
  repositories/testimonialRepository.js      (new)
  repositories/settingsRepository.js         (new)
  repositories/contactMessageRepository.js   (new)
  services/serviceService.js                 (new)
  services/testimonialService.js             (new)
  services/settingsService.js                (new)
  services/contactMessageService.js          (new)
  controllers/serviceController.js           (new)
  controllers/testimonialController.js       (new)
  controllers/settingsController.js          (new)
  controllers/contactMessageController.js    (new)
  validators/serviceValidators.js            (new)
  validators/testimonialValidators.js        (new)
  validators/settingsValidators.js           (new)
  validators/contactMessageValidators.js     (new)
  routes/serviceRoutes.js                    (new)
  routes/testimonialRoutes.js                (new)
  routes/settingsRoutes.js                   (new)
  routes/contactMessageRoutes.js             (new)
  uploads/services/.gitkeep                  (new)
  uploads/testimonials/.gitkeep              (new)
  uploads/settings/.gitkeep                  (new)
```

Modified: `backend/src/middlewares/uploadPhoto.js` (becomes a thin wrapper over the new factory — `uploadDoctorPhoto` keeps its exact external behavior and export name, so `doctorRoutes.js` needs no change), `backend/src/routes/index.js` (mount 4 new route groups), `backend/.gitignore` (extend the nested-negation pattern to the 3 new upload subdirectories), `backend/scripts/migrate.js` (seed the default `hospital_settings` row), `backend/src/middlewares/rateLimiters.js` (add `contactLimiter`).

### 3.2 Shared upload middleware (`middlewares/upload.js`)

```js
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function makeUploadMiddleware(subdir, fieldName) {
  const uploadDir = path.join(UPLOADS_ROOT, subdir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${MIME_EXTENSIONS[file.mimetype]}`);
    },
  });

  function fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new AppError('Only JPEG, PNG, or WEBP images are allowed.', 400));
    }
    cb(null, true);
  }

  return multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } }).single(fieldName);
}
```

`uploadPhoto.js` becomes:

```js
import { makeUploadMiddleware } from './upload.js';

export const uploadDoctorPhoto = makeUploadMiddleware('doctors', 'photo');
```

`uploadServicePhoto.js` / `uploadTestimonialPhoto.js` / `uploadSettingsLogo.js` follow the identical one-line pattern, with field names `image`, `photo`, `logo` respectively (matching each table's `*_url` column name in spirit).

### 3.3 Repositories

- **`serviceRepository.js`** — `findAll()` (`ORDER BY display_order ASC, name ASC`), `findById(id)`, `create(service)`, `update(id, service)`, `remove(id)`. No active/inactive split — the public endpoint reuses `findAll()`.
- **`testimonialRepository.js`** — `findAll()` (`ORDER BY created_at DESC`), `findById(id)`, `create(testimonial)`, `update(id, testimonial)`, `remove(id)`. Public endpoint reuses `findAll()`.
- **`settingsRepository.js`** — `find()` (returns the single row, id=1 — always exists after the migration seed), `update(fields)` (dynamic partial `SET`, same pattern as `appointmentRepository.update` from Phase 3 — no `id` param needed, always targets `id = 1`).
- **`contactMessageRepository.js`** — `findAll(filters)` (`filters = { isRead? }`, same incremental-`WHERE` pattern as `appointmentRepository.findAll`, `ORDER BY created_at DESC`), `findById(id)`, `create(message)`, `update(id, fields)` (used for the read/unread toggle), `remove(id)`.

All raw parameterized SQL via `mysql2` named placeholders, one function per operation — no ORM.

### 3.4 Services

- **`serviceService.js`** — `listServices()` / `listPublicServices()` (both call `serviceRepository.findAll()`), `getService(id)` (404 if missing), `createService(data, file)` / `updateService(id, data, file)` (photo lifecycle identical to `doctorService.js`: old file deleted only after the DB update commits), `deleteService(id)` (fetch-then-remove, then best-effort delete the photo file — no FK protection needed, since no other table references `services`).
- **`testimonialService.js`** — same shape as `serviceService.js`, applied to testimonials' fields (`patient_name`, `review`, `rating`, `photo_url`).
- **`settingsService.js`** — `getSettings()` / `getPublicSettings()` (both call `settingsRepository.find()` — no 404 possible, the row always exists), `updateSettings(data, file)` (fetches the current row to know the existing `logo_url` for the same delete-old-file-after-update-commits lifecycle, then applies the partial update).
- **`contactMessageService.js`** — `listMessages(filters)`, `getMessage(id)` (404 if missing), `createMessage(data)` (public, no `is_read` in the accepted fields — always inserted as `false`, mirroring Phase 3's status-forcing pattern for public writes), `markMessageRead(id, isRead)` (fetch-then-update via `getMessage` + `contactMessageRepository.update`), `deleteMessage(id)` (fetch-then-remove).

### 3.5 Validators

```js
// serviceValidators.js
export const serviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

// testimonialValidators.js
export const testimonialSchema = z.object({
  patient_name: z.string().min(2, 'Name must be at least 2 characters'),
  review: z.string().min(5, 'Review must be at least 5 characters'),
  rating: z.coerce.number().int().min(1).max(5),
});

// settingsValidators.js
const socialLinksFromString = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val; // let the record() check below fail validation naturally
  }
}, z.record(z.string(), z.string()).optional());

export const settingsSchema = z.object({
  hospital_name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  google_map_link: z.string().optional(),
  opening_hours: z.string().optional(),
  social_links: socialLinksFromString,
});

// contactMessageValidators.js
export const contactMessageSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  message: z.string().min(5, 'Message must be at least 5 characters'),
});

const booleanFromString = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}, z.boolean());

export const markReadSchema = z.object({
  is_read: booleanFromString,
});
```

`serviceSchema`/`testimonialSchema` are multipart (photo upload), so numeric fields use `z.coerce`. `settingsSchema` is also multipart (optional logo upload); `social_links` arrives as a JSON-encoded string field in the `FormData` (the frontend does `formData.append('social_links', JSON.stringify(values))`), so it needs the `socialLinksFromString` preprocess to parse it back into an object before the `z.record` check. `contactMessageSchema` is plain JSON (no file). `markReadSchema` reuses the `booleanFromString` preprocess from `doctorValidators.js`/`staffValidators.js` for consistency, even though a JSON body would normally send a real boolean — defensive, matching established codebase convention.

### 3.6 Routes

| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/services` | `authenticate`, `authorize('admin','staff')` | |
| GET | `/api/services/public` | none | |
| GET | `/api/services/:id` | `authenticate`, `authorize('admin','staff')` | |
| POST | `/api/services` | `authenticate`, `authorize('admin')`, `uploadServicePhoto`, `validate(serviceSchema)` | |
| PUT | `/api/services/:id` | `authenticate`, `authorize('admin')`, `uploadServicePhoto`, `validate(serviceSchema)` | |
| DELETE | `/api/services/:id` | `authenticate`, `authorize('admin')` | |
| GET | `/api/testimonials` | `authenticate`, `authorize('admin','staff')` | |
| GET | `/api/testimonials/public` | none | |
| GET | `/api/testimonials/:id` | `authenticate`, `authorize('admin','staff')` | |
| POST | `/api/testimonials` | `authenticate`, `authorize('admin')`, `uploadTestimonialPhoto`, `validate(testimonialSchema)` | |
| PUT | `/api/testimonials/:id` | `authenticate`, `authorize('admin')`, `uploadTestimonialPhoto`, `validate(testimonialSchema)` | |
| DELETE | `/api/testimonials/:id` | `authenticate`, `authorize('admin')` | |
| GET | `/api/settings` | `authenticate`, `authorize('admin','staff')` | |
| GET | `/api/settings/public` | none | |
| PUT | `/api/settings` | `authenticate`, `authorize('admin')`, `uploadSettingsLogo`, `validate(settingsSchema)` | |
| POST | `/api/contact` | `contactLimiter`, `validate(contactMessageSchema)` | no auth |
| GET | `/api/contact-messages` | `authenticate`, `authorize('admin','staff')` | |
| PATCH | `/api/contact-messages/:id` | `authenticate`, `authorize('admin','staff')`, `validate(markReadSchema)` | |
| DELETE | `/api/contact-messages/:id` | `authenticate`, `authorize('admin')` | |

`/public` registered before `/:id` in each router, matching the Doctors precedent. `authorize` runs before any upload middleware, so a rejected role never writes a file to disk.

### 3.7 `rateLimiters.js` addition

`contactLimiter`: 5 requests / 15 minutes per IP, same shape as `bookingLimiter` from Phase 3, applied only to `POST /api/contact`.

### 3.8 `migrate.js` addition

```js
await connection.query("INSERT IGNORE INTO roles (name) VALUES ('admin'), ('staff')");
await connection.query('INSERT IGNORE INTO hospital_settings (id) VALUES (1)');
```

Ensures the singleton settings row exists immediately after migration, before any admin ever opens the Settings page — `updateSettings` never has to handle a "no row yet" case.

## 4. Frontend

### 4.1 Files

```
frontend/src/
  services/serviceService.js
  services/testimonialService.js
  services/settingsService.js
  services/contactMessageService.js
  hooks/useServices.js
  hooks/useTestimonials.js
  hooks/useSettings.js
  hooks/useContactMessages.js
  pages/admin/services/ServiceList.jsx
  pages/admin/services/ServiceForm.jsx
  pages/admin/testimonials/TestimonialList.jsx
  pages/admin/testimonials/TestimonialForm.jsx
  pages/admin/settings/SettingsForm.jsx
  pages/admin/contact/ContactMessageList.jsx
```

Modified: `frontend/src/App.jsx` (new routes), `frontend/src/layouts/AdminLayout.jsx` (4 new nav links, visible to both roles).

### 4.2 Data flow

- Each of `serviceService.js`/`testimonialService.js` mirrors `doctorService.js` exactly (list/get/create/update send `FormData` for the photo, delete is a plain call).
- `settingsService.js` — `getSettings()`, `updateSettings(formData)` (no create/delete — singleton).
- `contactMessageService.js` — `listMessages(filters)`, `markMessageRead(id, isRead)`, `deleteMessage(id)`.
- Hooks mirror `useDoctors.js`/`useAppointments.js`: React Query wrappers, mutations invalidate their own query key on success.
- `ServiceForm.jsx`/`TestimonialForm.jsx` mirror `DoctorForm.jsx`'s structure (text fields + optional photo input with preview).
- `SettingsForm.jsx` is a single always-editable form (no list page, no "new" route) — one form bound to `useSettings()`'s data, with social links as a small set of named inputs (`instagram`, `facebook`, `twitter` — matching the static site's existing footer icons) that get assembled into the `social_links` object on submit and sent as a JSON string in the `FormData`.
- `ContactMessageList.jsx` — table with name/phone/email/message/date columns, a read/unread toggle per row (calls `markMessageRead`), Delete button gated `user?.role === 'admin'` (same UX-gating pattern as Doctors/Appointments — the real enforcement is server-side).

### 4.3 Routing

```
/admin/services                 → ServiceList        (any authenticated role)
/admin/services/new              → ServiceForm        (admin only)
/admin/services/:id/edit         → ServiceForm        (admin only)
/admin/testimonials               → TestimonialList    (any authenticated role)
/admin/testimonials/new           → TestimonialForm    (admin only)
/admin/testimonials/:id/edit      → TestimonialForm    (admin only)
/admin/settings                   → SettingsForm       (admin only — viewing and editing are the same page, and only admin can reach it; staff's "view" access to settings is satisfied by the public data being visible on the eventual public site in Phase 5b, not by giving staff a dedicated read-only admin settings screen for a handful of contact-info fields)
/admin/messages                   → ContactMessageList (any authenticated role)
```

Sidebar gains "Services", "Testimonials", "Settings", "Messages" links. "Settings" is wrapped in the same `user?.role === 'admin'` guard as "Staff" from Phase 4 (since the route itself is admin-only); the other three are unconditional, matching Doctors/Appointments.

## 5. Error Handling

- 404 for missing service/testimonial/message ids.
- 400 for validation failures and Multer failures (existing `errorHandler.js` branches, unchanged).
- 429 for the contact-form rate limiter.
- No 409 cases in this phase (no unique constraints on any of these four tables).
- Frontend: mutation errors surface via `toast.error(err.message)`, consistent with all prior phases.

## 6. Verification (no automated test suite, per Phase 1's established decision)

1. Repository/service-layer checks via standalone Node ESM scripts against the real DB, for each of the four modules.
2. Upload-middleware refactor: re-verify Doctor photo upload still works unchanged (create/update/delete a doctor with a photo) after `uploadPhoto.js` is rewritten to use the shared factory — this is the one place a regression in existing, already-shipped functionality is possible.
3. `curl` sequences per module: CRUD as admin, staff gets 403 on writes but 200 on reads, public endpoints work unauthenticated, contact-form rate limiting (5 succeed, 6th+ returns 429), settings' default row exists immediately after a fresh `npm run migrate` (no manual insert needed before the first `PUT`).
4. Live Playwright walkthrough covering all four modules: create/edit/delete a service and a testimonial (with photos), edit hospital settings (including social links), submit a contact message anonymously and see it in the admin inbox, toggle it read, delete it as admin.

## 7. Explicitly Out of Scope for Phase 5a

- The public-facing website UI (Phase 5b) — this phase ships data and endpoints only.
- Service reordering via drag-and-drop — `display_order` is a plain number field.
- Testimonial moderation/approval workflow — no `active` field exists on the table (Phase 1 decision); everything created is immediately public.
- Email/SMS notifications on new contact messages.
- A staff-facing read-only Settings screen — staff's need to "see" hospital info is met by the public site itself once Phase 5b ships.
