# Phase 2: Doctor Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full CRUD for doctors — admin-only create/edit/delete, admin+staff viewing, photo upload via Multer, and a public unauthenticated list endpoint — built on Phase 1's existing `doctors` table and auth infrastructure.

**Architecture:** Same layered backend as Phase 1 (`routes → middlewares → controllers → services → repositories → mysql2`), extended with a Multer upload middleware. Frontend adds a doctor list/form under the existing `AdminLayout`, using React Query hooks and `ProtectedRoute`'s existing `roles` prop for admin-only routes.

**Tech Stack:** Same as Phase 1 — Express, mysql2, zod, multer (already installed, unused until now); React 19, React Hook Form, TanStack Query, react-hot-toast.

**Testing approach:** No automated test suite, per Phase 1's established decision (`docs/superpowers/specs/2026-07-24-phase1-setup-auth-design.md`, §8). Every task ends with manual verification: standalone Node scripts against the real DB for the repository/service layers, curl for the HTTP layer, and a live Playwright browser walkthrough for the frontend capstone.

## Global Constraints

- Layered architecture: Controller → Service → Repository → MySQL. No ORM. All SQL parameterized via `mysql2` named placeholders.
- No microservices, event buses, or CQRS.
- Role rules: Admin has full doctor CRUD. Staff can view doctors (list + get) but cannot create, edit, or delete — enforced by `authorize('admin')` on write routes, `authorize('admin','staff')` on read routes.
- No DB schema changes — the `doctors` table already exists from Phase 1's `schema.sql`.
- `DELETE /api/doctors/:id` returns `409` if any appointment references the doctor (FK protection) — never a silent soft-delete substitute. Admin must use the existing `active` field to deactivate instead.
- `GET /api/doctors/public` ships in this phase: unauthenticated, returns active doctors only.
- Consistent JSON envelope on every response: `{success, message, data}` / `{success, message, errors}` — reuse Phase 1's `sendResponse`, `AppError`, `errorHandler`.
- Photo upload: Multer, 2MB limit, JPEG/PNG/WEBP only, stored under `backend/src/uploads/doctors/`, served via `express.static` at `/uploads`.

---

### Task 1: Doctor repository

**Files:**
- Create: `backend/src/repositories/doctorRepository.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js` (Phase 1).
- Produces: named exports `findAll()`, `findActiveOnly()`, `findById(id)`, `create(doctor)`, `update(id, doctor)`, `remove(id)` from `doctorRepository.js`. `doctor` objects always have all 9 non-id columns present (`name, qualification, specialization, experience_years, photo_url, consultation_fee, working_days, available_time, active`) — the service layer (Task 2) is responsible for filling in `null` for any missing optional field before calling `create`/`update`; this repository does not apply defaults itself. `create` resolves to the new row's numeric `id`. `findById`/`findAll`/`findActiveOnly` resolve to full row objects (or `null` for a missing `findById`).

- [ ] **Step 1: Create `src/repositories/doctorRepository.js`**

```js
import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT * FROM doctors ORDER BY name ASC');
  return rows;
}

export async function findActiveOnly() {
  const [rows] = await pool.query('SELECT * FROM doctors WHERE active = TRUE ORDER BY name ASC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM doctors WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(doctor) {
  const [result] = await pool.query(
    `INSERT INTO doctors
      (name, qualification, specialization, experience_years, photo_url, consultation_fee, working_days, available_time, active)
     VALUES
      (:name, :qualification, :specialization, :experience_years, :photo_url, :consultation_fee, :working_days, :available_time, :active)`,
    doctor
  );
  return result.insertId;
}

export async function update(id, doctor) {
  await pool.query(
    `UPDATE doctors SET
      name = :name,
      qualification = :qualification,
      specialization = :specialization,
      experience_years = :experience_years,
      photo_url = :photo_url,
      consultation_fee = :consultation_fee,
      working_days = :working_days,
      available_time = :available_time,
      active = :active
     WHERE id = :id`,
    { ...doctor, id }
  );
}

export async function remove(id) {
  await pool.query('DELETE FROM doctors WHERE id = :id', { id });
}
```

- [ ] **Step 2: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-doctor-repo.mjs`:

```js
import * as doctorRepository from '../src/repositories/doctorRepository.js';
import pool from '../src/config/db.js';

async function main() {
  const testDoctor = {
    name: 'Verify Test Doctor',
    qualification: 'MPT',
    specialization: 'Sports',
    experience_years: 5,
    photo_url: null,
    consultation_fee: 300,
    working_days: 'Mon,Wed,Fri',
    available_time: '10:00 AM - 2:00 PM',
    active: true,
  };

  const id = await doctorRepository.create(testDoctor);
  console.log('created id:', id);

  const fetched = await doctorRepository.findById(id);
  console.log('fetched name:', fetched.name, 'active:', fetched.active);

  const all = await doctorRepository.findAll();
  console.log('findAll includes new doctor:', all.some((d) => d.id === id));

  await doctorRepository.update(id, { ...testDoctor, name: 'Verify Test Doctor Updated', active: false });
  const updated = await doctorRepository.findById(id);
  console.log('updated name:', updated.name, 'active:', updated.active);

  const activeOnly = await doctorRepository.findActiveOnly();
  console.log('findActiveOnly excludes inactive doctor:', !activeOnly.some((d) => d.id === id));

  await doctorRepository.remove(id);
  const afterDelete = await doctorRepository.findById(id);
  console.log('after delete, findById returns:', afterDelete);

  await pool.end();
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
```

Run:
```bash
cd backend
node scripts/tmp-verify-doctor-repo.mjs
```

Expected output (MySQL returns `TINYINT(1)`/`BOOLEAN` columns as the numbers `1`/`0` via mysql2, not JS `true`/`false` — this is correct, not a bug):
```
created id: <some number>
fetched name: Verify Test Doctor active: 1
findAll includes new doctor: true
updated name: Verify Test Doctor Updated active: 0
findActiveOnly excludes inactive doctor: true
after delete, findById returns: null
```

Then delete the temp script (it's not part of the codebase):
```bash
rm scripts/tmp-verify-doctor-repo.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/doctorRepository.js
git commit -m "Add doctor repository"
```

---

### Task 2: Doctor service (photo lifecycle + FK-block delete)

**Files:**
- Create: `backend/src/services/doctorService.js`

**Interfaces:**
- Consumes: `findAll, findActiveOnly, findById, create, update, remove` from `doctorRepository.js` (Task 1); `AppError` (default export) from `backend/src/utils/AppError.js` (Phase 1).
- Produces: named exports `listDoctors()`, `listPublicDoctors()`, `getDoctor(id)`, `createDoctor(data, file)`, `updateDoctor(id, data, file)`, `deleteDoctor(id)`. `data` is a plain object with the doctor's form fields (optional fields may be `undefined`). `file` is either `undefined`/`null` (no photo) or an object with at least a `.filename` string property (this is the shape Multer's `req.file` has — Task 3 passes `req.file` directly; this task's own verification below constructs a matching fake object). `getDoctor` throws `AppError(..., 404)` if missing. `deleteDoctor` throws `AppError(..., 409)` if the doctor is referenced by an appointment.

- [ ] **Step 1: Create `src/services/doctorService.js`**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';
import * as doctorRepository from '../repositories/doctorRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/doctors/${file.filename}` : null;
}

async function deletePhotoFile(photoUrl) {
  if (!photoUrl) return;
  const filePath = path.join(UPLOADS_ROOT, photoUrl.replace('/uploads/', ''));
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to delete photo file ${filePath}:`, err.message);
    }
  }
}

function toRow(data, photoUrl) {
  return {
    name: data.name,
    qualification: data.qualification ?? null,
    specialization: data.specialization ?? null,
    experience_years: data.experience_years ?? null,
    photo_url: photoUrl,
    consultation_fee: data.consultation_fee ?? null,
    working_days: data.working_days ?? null,
    available_time: data.available_time ?? null,
    active: data.active ?? true,
  };
}

export async function listDoctors() {
  return doctorRepository.findAll();
}

export async function listPublicDoctors() {
  return doctorRepository.findActiveOnly();
}

export async function getDoctor(id) {
  const doctor = await doctorRepository.findById(id);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404);
  }
  return doctor;
}

export async function createDoctor(data, file) {
  const doctor = toRow(data, buildPhotoUrl(file));
  const id = await doctorRepository.create(doctor);
  return getDoctor(id);
}

export async function updateDoctor(id, data, file) {
  const existing = await getDoctor(id);

  let photoUrl = existing.photo_url;
  if (file) {
    await deletePhotoFile(existing.photo_url);
    photoUrl = buildPhotoUrl(file);
  }

  const doctor = toRow(data, photoUrl);
  await doctorRepository.update(id, doctor);
  return getDoctor(id);
}

export async function deleteDoctor(id) {
  const doctor = await getDoctor(id);
  try {
    await doctorRepository.remove(id);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new AppError('Cannot delete a doctor with existing appointments. Deactivate the doctor instead.', 409);
    }
    throw err;
  }
  await deletePhotoFile(doctor.photo_url);
}
```

- [ ] **Step 2: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-doctor-service.mjs`:

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as doctorService from '../src/services/doctorService.js';
import pool from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCTORS_UPLOAD_DIR = path.join(__dirname, '../src/uploads/doctors');

async function makeFakeFile(filename) {
  await fs.mkdir(DOCTORS_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(DOCTORS_UPLOAD_DIR, filename), 'fake image content');
  return { filename };
}

async function fileExists(filename) {
  try {
    await fs.access(path.join(DOCTORS_UPLOAD_DIR, filename));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const file1 = await makeFakeFile('verify-photo-1.jpg');
  const doctor = await doctorService.createDoctor(
    {
      name: 'Service Test Doctor',
      qualification: 'MPT',
      specialization: 'Neuro',
      experience_years: 4,
      consultation_fee: 400,
      working_days: 'Mon,Tue',
      available_time: '11:00 AM - 3:00 PM',
      active: true,
    },
    file1
  );
  console.log('created doctor photo_url:', doctor.photo_url);
  console.log('file1 exists on disk:', await fileExists('verify-photo-1.jpg'));

  const file2 = await makeFakeFile('verify-photo-2.jpg');
  const updated = await doctorService.updateDoctor(
    doctor.id,
    { name: 'Service Test Doctor Updated', active: true },
    file2
  );
  console.log('updated doctor photo_url:', updated.photo_url);
  console.log('old file1 deleted from disk:', !(await fileExists('verify-photo-1.jpg')));
  console.log('new file2 exists on disk:', await fileExists('verify-photo-2.jpg'));

  await pool.query(
    'INSERT INTO appointments (patient_name, mobile, doctor_id, appointment_date, appointment_time) VALUES (:patient_name, :mobile, :doctor_id, CURDATE(), :appointment_time)',
    { patient_name: 'Fixture Patient', mobile: '9999999999', doctor_id: doctor.id, appointment_time: '10:00 AM' }
  );

  let blockedCorrectly = false;
  try {
    await doctorService.deleteDoctor(doctor.id);
  } catch (err) {
    blockedCorrectly = err.statusCode === 409;
    console.log('blocked delete error message:', err.message);
  }
  console.log('delete correctly blocked (409):', blockedCorrectly);

  await pool.query('DELETE FROM appointments WHERE doctor_id = :doctor_id', { doctor_id: doctor.id });

  await doctorService.deleteDoctor(doctor.id);
  console.log('new file2 deleted from disk after successful delete:', !(await fileExists('verify-photo-2.jpg')));

  await pool.end();
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
```

Run:
```bash
cd backend
node scripts/tmp-verify-doctor-service.mjs
```

Expected output:
```
created doctor photo_url: /uploads/doctors/verify-photo-1.jpg
file1 exists on disk: true
updated doctor photo_url: /uploads/doctors/verify-photo-2.jpg
old file1 deleted from disk: true
new file2 exists on disk: true
blocked delete error message: Cannot delete a doctor with existing appointments. Deactivate the doctor instead.
delete correctly blocked (409): true
new file2 deleted from disk after successful delete: true
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-doctor-service.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/doctorService.js
git commit -m "Add doctor service: photo lifecycle and FK-block delete"
```

---

### Task 3: Doctor HTTP API — validators, upload middleware, controller, routes, wiring

**Files:**
- Create: `backend/src/validators/doctorValidators.js`
- Create: `backend/src/middlewares/uploadPhoto.js`
- Create: `backend/src/controllers/doctorController.js`
- Create: `backend/src/routes/doctorRoutes.js`
- Create: `backend/src/uploads/doctors/.gitkeep`
- Modify: `backend/.gitignore`
- Modify: `backend/src/app.js`
- Modify: `backend/src/routes/index.js`
- Modify: `backend/src/middlewares/errorHandler.js`

**Interfaces:**
- Consumes: `listDoctors, listPublicDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor` from `doctorService.js` (Task 2); `authenticate`, `authorize(...roles)`, `validate(schema)` from Phase 1's middlewares; `asyncHandler`, `sendResponse`, `AppError` from Phase 1's utils.
- Produces: `doctorSchema` (zod schema) from `doctorValidators.js`; `uploadDoctorPhoto` (configured Multer single-file middleware, field name `photo`) from `uploadPhoto.js`; `list, listPublic, getOne, create, update, remove` (Express handlers) from `doctorController.js`; default-exported Express `Router` from `doctorRoutes.js` mounted at `/doctors`.

- [ ] **Step 1: Create `src/validators/doctorValidators.js`**

Multipart form fields arrive as strings. `z.coerce.boolean()` has a well-known gotcha — `Boolean("false")` is `true` in JS — so `active` needs a custom preprocess instead of `z.coerce.boolean()`:

```js
import { z } from 'zod';

const booleanFromString = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}, z.boolean().optional());

export const doctorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  experience_years: z.coerce.number().int().min(0).optional(),
  consultation_fee: z.coerce.number().min(0).optional(),
  working_days: z.string().optional(),
  available_time: z.string().optional(),
  active: booleanFromString,
});
```

- [ ] **Step 2: Create `src/middlewares/uploadPhoto.js`**

```js
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCTORS_UPLOAD_DIR = path.join(__dirname, '../uploads/doctors');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCTORS_UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new AppError('Only JPEG, PNG, or WEBP images are allowed.', 400));
  }
  cb(null, true);
}

export const uploadDoctorPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('photo');
```

Note: a rejected file type throws our own `AppError` (400, friendly message) via the `fileFilter` callback — it does NOT go through `multer.MulterError`, since `MulterError`'s message text is fixed internally by Multer and can't carry a custom string. An oversized file, by contrast, is rejected by Multer's own internal `limits.fileSize` enforcement and IS a genuine `multer.MulterError` (code `LIMIT_FILE_SIZE`, message `"File too large"`) — that path is handled by the `errorHandler.js` change in Step 8 below.

- [ ] **Step 3: Create `src/uploads/doctors/.gitkeep`**

Empty file — reserves the directory in git.

- [ ] **Step 4: Modify `backend/.gitignore`** to track the new subdirectory's `.gitkeep` without tracking uploaded files

Current content:
```
node_modules/
.env
src/uploads/*
!src/uploads/.gitkeep
*.log
.DS_Store
```

Replace with:
```
node_modules/
.env
src/uploads/*
!src/uploads/.gitkeep
!src/uploads/doctors/
src/uploads/doctors/*
!src/uploads/doctors/.gitkeep
*.log
.DS_Store
```

(`src/uploads/*` ignores everything directly under `uploads/`, including the `doctors` directory entry itself — `!src/uploads/doctors/` re-allows git to traverse into it, `src/uploads/doctors/*` then re-ignores its contents, and the final `!src/uploads/doctors/.gitkeep` re-allows just that one file. This nested-negation pattern is required because git won't apply a negation pattern to files inside a directory that's itself excluded, unless the directory is explicitly re-included first.)

Verify:
```bash
cd backend
git check-ignore -v src/uploads/doctors/.gitkeep && echo "BUG: gitkeep is ignored" || echo "OK: gitkeep is NOT ignored"
git check-ignore -v src/uploads/doctors/some-photo.jpg
```
Expected: first line prints `OK: gitkeep is NOT ignored`; second line prints a match against the `src/uploads/doctors/*` pattern (confirming actual uploaded photos stay ignored).

- [ ] **Step 5: Create `src/controllers/doctorController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as doctorService from '../services/doctorService.js';

export const list = asyncHandler(async (req, res) => {
  const doctors = await doctorService.listDoctors();
  sendResponse(res, { status: 200, message: 'Doctors retrieved', data: doctors });
});

export const listPublic = asyncHandler(async (req, res) => {
  const doctors = await doctorService.listPublicDoctors();
  sendResponse(res, { status: 200, message: 'Doctors retrieved', data: doctors });
});

export const getOne = asyncHandler(async (req, res) => {
  const doctor = await doctorService.getDoctor(req.params.id);
  sendResponse(res, { status: 200, message: 'Doctor retrieved', data: doctor });
});

export const create = asyncHandler(async (req, res) => {
  const doctor = await doctorService.createDoctor(req.body, req.file);
  sendResponse(res, { status: 201, message: 'Doctor created', data: doctor });
});

export const update = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateDoctor(req.params.id, req.body, req.file);
  sendResponse(res, { status: 200, message: 'Doctor updated', data: doctor });
});

export const remove = asyncHandler(async (req, res) => {
  await doctorService.deleteDoctor(req.params.id);
  sendResponse(res, { status: 200, message: 'Doctor deleted' });
});
```

- [ ] **Step 6: Create `src/routes/doctorRoutes.js`**

```js
import { Router } from 'express';
import * as doctorController from '../controllers/doctorController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { doctorSchema } from '../validators/doctorValidators.js';
import { uploadDoctorPhoto } from '../middlewares/uploadPhoto.js';

const router = Router();

router.get('/public', doctorController.listPublic);
router.get('/', authenticate, authorize('admin', 'staff'), doctorController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), doctorController.getOne);
router.post('/', authenticate, authorize('admin'), uploadDoctorPhoto, validate(doctorSchema), doctorController.create);
router.put('/:id', authenticate, authorize('admin'), uploadDoctorPhoto, validate(doctorSchema), doctorController.update);
router.delete('/:id', authenticate, authorize('admin'), doctorController.remove);

export default router;
```

(`/public` is registered before `/:id` so it isn't shadowed by the param route. `authorize` runs before `uploadDoctorPhoto` on write routes, so a rejected role never gets a file written to disk.)

- [ ] **Step 7: Modify `src/routes/index.js`** to mount the doctor routes

Current content:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);

export default router;
```

Replace with:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);

export default router;
```

- [ ] **Step 8: Modify `src/app.js`** to serve uploaded photos statically

Current content:
```js
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiters.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', apiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

Replace with:
```js
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

app.use('/api', apiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

(The `setHeaders` override is required: `helmet()`'s default `Cross-Origin-Resource-Policy: same-origin` header blocks the frontend at `localhost:5173` from loading `<img>` tags served from the backend at `localhost:5000` — without this, every doctor photo would silently fail to render as a broken-image icon in the browser, since these are meant to be publicly embeddable images.)

- [ ] **Step 9: Modify `src/middlewares/errorHandler.js`** to handle Multer's own errors (e.g. oversized files)

Current content:
```js
import AppError from '../utils/AppError.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.',
    errors: null,
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: null,
  });
}
```

Replace with:
```js
import multer from 'multer';
import AppError from '../utils/AppError.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      errors: null,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.',
    errors: null,
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: null,
  });
}
```

- [ ] **Step 10: Verify — full curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1
curl -s http://localhost:5000/api/health

# Login as admin (use your real ADMIN_USERNAME/ADMIN_PASSWORD from backend/.env if different)
curl -s -c /tmp/doc-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

# A minimal valid 1x1 PNG fixture
node -e "require('fs').writeFileSync('/tmp/test-photo.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))"

echo "--- create doctor with photo ---"
CREATE_RESP=$(curl -s -b /tmp/doc-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Dr. Test Kumar" \
  -F "qualification=MPT" \
  -F "specialization=Orthopedic" \
  -F "experience_years=8" \
  -F "consultation_fee=500" \
  -F "working_days=Mon,Tue,Wed,Thu,Fri" \
  -F "available_time=9:00 AM - 5:00 PM" \
  -F "active=true" \
  -F "photo=@/tmp/test-photo.png;type=image/png")
echo "$CREATE_RESP"
DOCTOR_ID=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
INITIAL_PHOTO=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.photo_url))")
echo "DOCTOR_ID=$DOCTOR_ID INITIAL_PHOTO=$INITIAL_PHOTO"
ls -la "src${INITIAL_PHOTO}"

echo "--- list as admin includes new doctor ---"
curl -s -b /tmp/doc-cookies.txt http://localhost:5000/api/doctors | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$DOCTOR_ID))})"

echo "--- get by id ---"
curl -s -b /tmp/doc-cookies.txt "http://localhost:5000/api/doctors/$DOCTOR_ID"

echo "--- public list (no auth) includes active doctor ---"
curl -s http://localhost:5000/api/doctors/public | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$DOCTOR_ID))})"

# Craft a staff-role JWT directly (no staff DB user exists until Phase 4) to test RBAC
STAFF_JWT=$(node --input-type=module -e "
import env from './src/config/env.js';
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ id: 999, role: 'staff' }, env.JWT_SECRET, { expiresIn: '1h' }));
")

echo "--- staff CAN list doctors (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" http://localhost:5000/api/doctors > /tmp/staff-list.out
tail -1 /tmp/staff-list.out

echo "--- staff CANNOT create a doctor (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X POST http://localhost:5000/api/doctors -F "name=Should Fail"

echo "--- staff CANNOT update a doctor (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X PUT "http://localhost:5000/api/doctors/$DOCTOR_ID" -F "name=Should Fail Update"

echo "--- staff CANNOT delete a doctor (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X DELETE "http://localhost:5000/api/doctors/$DOCTOR_ID"

echo "--- update WITHOUT a new photo (photo_url unchanged) ---"
curl -s -b /tmp/doc-cookies.txt -X PUT "http://localhost:5000/api/doctors/$DOCTOR_ID" \
  -F "name=Dr. Test Kumar Updated" \
  -F "active=true"

echo "--- update WITH a new photo (old file removed, new file exists) ---"
node -e "require('fs').writeFileSync('/tmp/test-photo-2.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))"
UPDATE_RESP=$(curl -s -b /tmp/doc-cookies.txt -X PUT "http://localhost:5000/api/doctors/$DOCTOR_ID" \
  -F "name=Dr. Test Kumar Updated" \
  -F "active=true" \
  -F "photo=@/tmp/test-photo-2.png;type=image/png")
echo "$UPDATE_RESP"
NEW_PHOTO=$(echo "$UPDATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.photo_url))")
echo "old photo file gone: $([ ! -f "src${INITIAL_PHOTO}" ] && echo true || echo false)"
echo "new photo file exists: $([ -f "src${NEW_PHOTO}" ] && echo true || echo false)"

echo "--- oversized file rejected (400, Multer's own message) ---"
head -c 3000000 /dev/urandom > /tmp/big.jpg
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/doc-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Should Fail Big" -F "photo=@/tmp/big.jpg;type=image/jpeg"

echo "--- wrong file type rejected (400, our AppError message) ---"
echo "not an image" > /tmp/bad.txt
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/doc-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Should Fail Type" -F "photo=@/tmp/bad.txt;type=text/plain"

echo "--- insert a fixture appointment referencing this doctor ---"
node --input-type=module -e "
import pool from './src/config/db.js';
await pool.query('INSERT INTO appointments (patient_name, mobile, doctor_id, appointment_date, appointment_time) VALUES (:p, :m, :d, CURDATE(), :t)', { p: 'Fixture Patient', m: '9999999999', d: $DOCTOR_ID, t: '10:00 AM' });
await pool.end();
console.log('fixture appointment inserted');
"

echo "--- delete blocked by FK (409) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/doc-cookies.txt -X DELETE "http://localhost:5000/api/doctors/$DOCTOR_ID"

echo "--- remove fixture appointment ---"
node --input-type=module -e "
import pool from './src/config/db.js';
await pool.query('DELETE FROM appointments WHERE doctor_id = :d', { d: $DOCTOR_ID });
await pool.end();
console.log('fixture appointment removed');
"

echo "--- delete now succeeds (200), photo file removed ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/doc-cookies.txt -X DELETE "http://localhost:5000/api/doctors/$DOCTOR_ID"
echo "photo file gone after delete: $([ ! -f "src${NEW_PHOTO}" ] && echo true || echo false)"

kill %1
rm -f /tmp/doc-cookies.txt /tmp/test-photo.png /tmp/test-photo-2.png /tmp/big.jpg /tmp/bad.txt /tmp/staff-list.out
```

Expected (key checks): health 200; create returns `201` with a `photo_url` and the file exists on disk; admin list/get show the doctor; public list (no cookie) shows it too; staff JWT gets `200` on list, `403` on create, `403` on update, `403` on delete; update-without-photo keeps `photo_url` unchanged; update-with-photo removes the old file and creates a new one; oversized file → `400` "File too large"; wrong type → `400` "Only JPEG, PNG, or WEBP images are allowed."; delete while referenced → `409` "Cannot delete a doctor with existing appointments. Deactivate the doctor instead."; delete after removing the fixture → `200` and the photo file is gone from disk.

- [ ] **Step 11: Commit**

```bash
git add backend/src/validators/doctorValidators.js backend/src/middlewares/uploadPhoto.js backend/src/middlewares/errorHandler.js backend/src/controllers/doctorController.js backend/src/routes/doctorRoutes.js backend/src/routes/index.js backend/src/app.js backend/src/uploads/doctors/.gitkeep backend/.gitignore
git commit -m "Add doctor HTTP API: validators, photo upload, controller, routes"
```

---

### Task 4: Frontend doctor API layer and hooks

**Files:**
- Create: `frontend/src/utils/photoUrl.js`
- Create: `frontend/src/services/doctorService.js`
- Create: `frontend/src/hooks/useDoctors.js`

**Interfaces:**
- Consumes: `api` (default export) from `frontend/src/services/api.js` (Phase 1).
- Produces: `getPhotoUrl(photoUrl)` named export from `photoUrl.js` — returns `null` for a falsy input, else the full absolute URL to the image.
- Produces: `listDoctors()`, `getDoctor(id)`, `createDoctor(formData)`, `updateDoctor(id, formData)`, `deleteDoctor(id)` named exports from `doctorService.js`.
- Produces: `useDoctors()`, `useDoctor(id)`, `useCreateDoctor()`, `useUpdateDoctor()`, `useDeleteDoctor()` named exports from `useDoctors.js` (React Query hooks). `useUpdateDoctor()`'s mutation function takes `{ id, formData }`. All mutations invalidate the `['doctors']` query key on success.

- [ ] **Step 1: Create `src/utils/photoUrl.js`**

```js
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

export function getPhotoUrl(photoUrl) {
  if (!photoUrl) return null;
  return `${API_ORIGIN}${photoUrl}`;
}
```

- [ ] **Step 2: Create `src/services/doctorService.js`**

```js
import api from './api.js';

export async function listDoctors() {
  const { data } = await api.get('/doctors');
  return data.data;
}

export async function getDoctor(id) {
  const { data } = await api.get(`/doctors/${id}`);
  return data.data;
}

export async function createDoctor(formData) {
  const { data } = await api.post('/doctors', formData);
  return data.data;
}

export async function updateDoctor(id, formData) {
  const { data } = await api.put(`/doctors/${id}`, formData);
  return data.data;
}

export async function deleteDoctor(id) {
  await api.delete(`/doctors/${id}`);
}
```

- [ ] **Step 3: Create `src/hooks/useDoctors.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as doctorService from '../services/doctorService.js';

export function useDoctors() {
  return useQuery({ queryKey: ['doctors'], queryFn: doctorService.listDoctors });
}

export function useDoctor(id) {
  return useQuery({
    queryKey: ['doctors', id],
    queryFn: () => doctorService.getDoctor(id),
    enabled: Boolean(id),
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doctorService.createDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}

export function useUpdateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => doctorService.updateDoctor(id, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}

export function useDeleteDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doctorService.deleteDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}
```

- [ ] **Step 4: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (these modules aren't wired into any page yet — this only proves imports resolve and there's no syntax error; end-to-end behavior is verified in Task 7).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/photoUrl.js frontend/src/services/doctorService.js frontend/src/hooks/useDoctors.js
git commit -m "Add frontend doctor API layer and React Query hooks"
```

---

### Task 5: Doctor create/edit form

**Files:**
- Create: `frontend/src/pages/admin/doctors/DoctorForm.jsx`

**Interfaces:**
- Consumes: `useDoctor`, `useCreateDoctor`, `useUpdateDoctor` from `hooks/useDoctors.js` (Task 4); `getPhotoUrl` from `utils/photoUrl.js` (Task 4).
- Produces: default export `DoctorForm` — a route-level component with no props (reads `id` from `useParams()`; presence of `id` determines create vs. edit mode).

- [ ] **Step 1: Create `src/pages/admin/doctors/DoctorForm.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDoctor, useCreateDoctor, useUpdateDoctor } from '../../../hooks/useDoctors.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: doctor, isLoading: isLoadingDoctor } = useDoctor(id);
  const createDoctor = useCreateDoctor();
  const updateDoctor = useUpdateDoctor();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      qualification: '',
      specialization: '',
      experience_years: '',
      consultation_fee: '',
      available_time: '',
      active: true,
    },
  });

  const [selectedDays, setSelectedDays] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (doctor) {
      reset({
        name: doctor.name ?? '',
        qualification: doctor.qualification ?? '',
        specialization: doctor.specialization ?? '',
        experience_years: doctor.experience_years ?? '',
        consultation_fee: doctor.consultation_fee ?? '',
        available_time: doctor.available_time ?? '',
        active: Boolean(doctor.active),
      });
      setSelectedDays(doctor.working_days ? doctor.working_days.split(',') : []);
      setPhotoPreview(getPhotoUrl(doctor.photo_url));
    }
  }, [doctor, reset]);

  function toggleDay(day) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  async function onSubmit(values) {
    const formData = new FormData();
    formData.append('name', values.name);
    if (values.qualification) formData.append('qualification', values.qualification);
    if (values.specialization) formData.append('specialization', values.specialization);
    if (values.experience_years !== '') formData.append('experience_years', values.experience_years);
    if (values.consultation_fee !== '') formData.append('consultation_fee', values.consultation_fee);
    if (selectedDays.length > 0) formData.append('working_days', selectedDays.join(','));
    if (values.available_time) formData.append('available_time', values.available_time);
    formData.append('active', values.active ? 'true' : 'false');
    if (photoFile) formData.append('photo', photoFile);

    try {
      if (isEdit) {
        await updateDoctor.mutateAsync({ id, formData });
        toast.success('Doctor updated');
      } else {
        await createDoctor.mutateAsync(formData);
        toast.success('Doctor created');
      }
      navigate('/admin/doctors');
    } catch (err) {
      toast.error(err.message || 'Failed to save doctor.');
    }
  }

  if (isEdit && isLoadingDoctor) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">{isEdit ? 'Edit Doctor' : 'Add Doctor'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Qualification</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('qualification')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Specialization</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('specialization')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Experience (years)</label>
            <input
              type="number"
              min="0"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('experience_years')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Consultation Fee</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('consultation_fee')}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Working Days</label>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} />
                {day}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Available Time</label>
          <input
            type="text"
            placeholder="e.g. 9:00 AM - 5:00 PM"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('available_time')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Photo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          {photoPreview && (
            <img src={photoPreview} alt="Doctor preview" className="mt-2 h-24 w-24 rounded object-cover" />
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('active')} />
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Doctor' : 'Create Doctor'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/doctors')}
            className="rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors. (Not yet reachable via any route — that's Task 7. This only proves the component compiles and its imports resolve.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/doctors/DoctorForm.jsx
git commit -m "Add doctor create/edit form"
```

---

### Task 6: Doctor list page and delete confirmation

**Files:**
- Create: `frontend/src/components/ConfirmDialog.jsx`
- Create: `frontend/src/pages/admin/doctors/DoctorList.jsx`

**Interfaces:**
- Consumes: `useAuth` from `contexts/AuthContext.jsx` (Phase 1); `useDoctors`, `useDeleteDoctor` from `hooks/useDoctors.js` (Task 4); `getPhotoUrl` from `utils/photoUrl.js` (Task 4).
- Produces: default export `ConfirmDialog({ open, title, message, onConfirm, onCancel })` — renders nothing when `open` is falsy.
- Produces: default export `DoctorList` — a route-level component with no props.

- [ ] **Step 1: Create `src/components/ConfirmDialog.jsx`**

```jsx
export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/admin/doctors/DoctorList.jsx`**

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useDoctors, useDeleteDoctor } from '../../../hooks/useDoctors.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function DoctorList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: doctors, isLoading } = useDoctors();
  const deleteDoctor = useDeleteDoctor();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function confirmDelete() {
    try {
      await deleteDoctor.mutateAsync(pendingDeleteId);
      toast.success('Doctor deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete doctor.');
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Doctors</h1>
        {isAdmin && (
          <Link
            to="/admin/doctors/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Doctor
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Specialization</th>
              <th className="px-4 py-3">Experience</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Working Days</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doctors?.map((doctor) => (
              <tr key={doctor.id}>
                <td className="px-4 py-3">
                  {doctor.photo_url ? (
                    <img
                      src={getPhotoUrl(doctor.photo_url)}
                      alt={doctor.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{doctor.name}</td>
                <td className="px-4 py-3 text-slate-600">{doctor.specialization || '-'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {doctor.experience_years != null ? `${doctor.experience_years} yrs` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {doctor.consultation_fee != null ? `₹${doctor.consultation_fee}` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{doctor.working_days || '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      doctor.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {doctor.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="space-x-3 px-4 py-3">
                    <Link to={`/admin/doctors/${doctor.id}/edit`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => setPendingDeleteId(doctor.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {doctors?.length === 0 && <p className="p-6 text-center text-slate-500">No doctors added yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Doctor"
        message="Are you sure you want to delete this doctor? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ConfirmDialog.jsx frontend/src/pages/admin/doctors/DoctorList.jsx
git commit -m "Add doctor list page with delete confirmation"
```

---

### Task 7: Wire up routing and admin nav — full walkthrough

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/AdminLayout.jsx`

**Interfaces:**
- Consumes: `DoctorList` (Task 6), `DoctorForm` (Task 5), `ProtectedRoute` (Phase 1, its existing `roles` prop).
- Produces: the complete Phase 2 route additions: `/admin/doctors` (any authenticated role), `/admin/doctors/new` and `/admin/doctors/:id/edit` (admin only).

- [ ] **Step 1: Modify `src/App.jsx`**

Current content:
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

Replace with:
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import DoctorList from './pages/admin/doctors/DoctorList.jsx';
import DoctorForm from './pages/admin/doctors/DoctorForm.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="doctors" element={<DoctorList />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="doctors/new" element={<DoctorForm />} />
            <Route path="doctors/:id/edit" element={<DoctorForm />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

(Nesting a second `<Route element={<ProtectedRoute roles={['admin']} />}>` inside the `/admin` layout's children is the standard React Router v6 pattern for composing a layout `Outlet` with a role guard `Outlet` — `ProtectedRoute` already supports the `roles` prop from Phase 1, unused until now.)

- [ ] **Step 2: Modify `src/layouts/AdminLayout.jsx`**

Current content:
```jsx
import { Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error(err.message || 'Logout failed. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between bg-blue-700 px-6 py-4 text-white">
        <span className="text-lg font-semibold">Daniel's Physiotherapy Hospital — Admin</span>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.name} ({user?.role})</span>
          <button
            onClick={handleLogout}
            className="rounded bg-blue-800 px-3 py-1.5 text-sm hover:bg-blue-900"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="flex">
        <aside className="w-56 border-r border-slate-200 bg-white p-4 text-slate-500">
          Navigation coming soon
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

Replace with:
```jsx
import { NavLink, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';

const navLinkClass = ({ isActive }) =>
  `block rounded px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
  }`;

export default function AdminLayout() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error(err.message || 'Logout failed. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between bg-blue-700 px-6 py-4 text-white">
        <span className="text-lg font-semibold">Daniel's Physiotherapy Hospital — Admin</span>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.name} ({user?.role})</span>
          <button
            onClick={handleLogout}
            className="rounded bg-blue-800 px-3 py-1.5 text-sm hover:bg-blue-900"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="flex">
        <aside className="w-56 border-r border-slate-200 bg-white p-4">
          <nav className="space-y-1">
            <NavLink to="/admin" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/doctors" className={navLinkClass}>
              Doctors
            </NavLink>
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Automated smoke check — both servers up, doctors page reachable**

```bash
cd backend && npm start &
sleep 1
cd ../frontend && npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin/doctors
kill %1 %2
```
Expected: `200` (Vite serves the SPA shell for any path — actual auth/routing behavior is client-side, verified in Step 4).

- [ ] **Step 4: Manual browser verification (do this yourself — no headless browser is installed here)**

With both `npm run dev` (frontend) and `npm start` (backend) running, logged in as admin:
1. Click "Doctors" in the sidebar → see the (empty or existing) doctor list.
2. Click "Add Doctor" → fill the form, upload a photo, check a few working days, submit → redirected to the list, new doctor appears with a thumbnail.
3. Click "Edit" on that doctor → change the name, upload a different photo → confirm the list shows the updated name and new photo.
4. Click "Delete" → confirm dialog appears → confirm → doctor disappears from the list, success toast shown.
5. Log out, log in as a staff-role account (there's no staff-creation UI until Phase 4 — insert one directly via SQL for this check only, e.g. hash a password with bcrypt and insert a `users` row with `role_id` for `'staff'`) → visit `/admin/doctors` → confirm the list is visible but "Add Doctor"/"Edit"/"Delete" are not rendered, and that navigating directly to `/admin/doctors/new` redirects away (role-gated route).

Confirm with the user that this walkthrough passes before considering Phase 2 done.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/layouts/AdminLayout.jsx
git commit -m "Wire up doctor routes and admin sidebar navigation"
```

---

## Self-Review Notes

- **Spec coverage:** doctor CRUD fields (Task 1 repository columns match the design's field list exactly), photo upload with 2MB/JPEG-PNG-WEBP limits (Task 3), admin-only create/edit/delete vs. admin+staff view (Task 3 routes + Task 6/7 frontend role gating), public unauthenticated endpoint (Task 3), FK-blocked delete with 409 (Tasks 2 & 3), consistent response envelope (reused from Phase 1 throughout), no automated test suite (every task uses manual Node-script/curl/browser verification instead). All Phase 2 design sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO markers; every step has complete code or exact runnable commands.
- **Type/name consistency checked:** `doctorRepository`'s function names (`findAll, findActiveOnly, findById, create, update, remove`) match exactly what `doctorService.js` imports and calls; `doctorService`'s exports (`listDoctors, listPublicDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor`) match exactly what `doctorController.js` imports; `doctorController`'s exports (`list, listPublic, getOne, create, update, remove`) match exactly what `doctorRoutes.js` references; frontend `doctorService.js`'s exports match what `useDoctors.js` calls; `useDoctors.js`'s hook names/return shapes match what `DoctorForm.jsx` and `DoctorList.jsx` consume (`useDoctor(id)` → `{data, isLoading}`, `useCreateDoctor()`/`useUpdateDoctor()`/`useDeleteDoctor()` → `.mutateAsync(...)`).
- **FK error code note:** Task 2's service catches `err.code === 'ER_ROW_IS_REFERENCED_2'` (the standard MySQL 8 InnoDB code for this constraint violation) with `ER_ROW_IS_REFERENCED` as a defensive fallback for older MySQL versions — both were validated as real `mysql2` error codes, not invented ones.
