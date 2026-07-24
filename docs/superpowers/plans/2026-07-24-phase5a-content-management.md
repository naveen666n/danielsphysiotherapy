# Phase 5a: Content Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin/staff CRUD for Services, Testimonials, and Hospital Settings, plus a Contact Messages inbox fed by a new public contact-form endpoint — built on Phase 1's existing tables (no schema changes), with a shared upload-middleware factory extracted from Phase 2's Doctor module and reused by all three new photo-capable modules.

**Architecture:** Same layered backend as Phases 1-4 (`routes → middlewares → controllers → services → repositories → mysql2`). One refactor precedes the new modules: `middlewares/upload.js` extracts a `makeUploadMiddleware(subdir, fieldName)` factory that Doctors (retrofitted), Services, Testimonials, and Settings' logo all call into, instead of four near-duplicate Multer configs. Frontend adds four admin sections under the existing `AdminLayout`, following the established list/form React Query pattern.

**Tech Stack:** Same as Phases 1-4 — Express, mysql2, zod, multer, express-rate-limit; React 19, React Hook Form, TanStack Query, react-hot-toast.

**Testing approach:** No automated test suite, per Phase 1's established decision (`docs/superpowers/specs/2026-07-24-phase1-setup-auth-design.md`, §8). Every task ends with manual verification: standalone Node scripts against the real DB for repository/service layers, curl for the HTTP layer, and a live Playwright browser walkthrough for the frontend capstone.

## Global Constraints

- Layered architecture: Controller → Service → Repository → MySQL. No ORM. All SQL parameterized via `mysql2` named placeholders.
- No DB schema changes — `services`, `testimonials`, `hospital_settings`, `contact_messages` already exist from Phase 1's `schema.sql`.
- Photo upload: Multer, 2MB limit, JPEG/PNG/WEBP only, UUID filenames, MIME-derived extensions — via the shared `makeUploadMiddleware(subdir, fieldName)` factory (Task 1), not duplicated per module.
- RBAC: admin+staff can view Services/Testimonials/Settings/Contact Messages; only admin can create/edit/delete Services/Testimonials, edit Settings, or delete a contact message. Staff can mark a contact message read/unread. Public (no auth) can only read `/public` endpoints and submit `POST /api/contact`.
- No "active"/moderation field on Services or Testimonials — everything created is immediately public (Phase 1 schema decision).
- `POST /api/contact` is rate-limited: 5 requests per 15 minutes per IP, on top of the existing global `apiLimiter` (300/15min).
- Consistent JSON envelope on every response: `{success, message, data}` / `{success, message, errors}` — reuse Phase 1's `sendResponse`, `AppError`, `errorHandler`.

---

### Task 1: Shared upload middleware factory + Doctor retrofit

**Files:**
- Create: `backend/src/middlewares/upload.js`
- Modify: `backend/src/middlewares/uploadPhoto.js`

**Interfaces:**
- Consumes: `AppError` (default export) from `backend/src/utils/AppError.js` (Phase 1).
- Produces: `makeUploadMiddleware(subdir, fieldName)` named export from `upload.js` — returns a configured Multer `.single(fieldName)` middleware that stores files under `backend/src/uploads/<subdir>/` with a UUID filename (extension derived from validated MIME type), rejects non-JPEG/PNG/WEBP files with a 400 `AppError`, and rejects files over 2MB via Multer's own `LIMIT_FILE_SIZE` mechanism (unchanged — still handled by the existing `errorHandler.js` `multer.MulterError` branch from Phase 2). `uploadPhoto.js` keeps its exact existing export name `uploadDoctorPhoto`, now built via the factory, so `doctorRoutes.js` needs zero changes.

- [ ] **Step 1: Create `src/middlewares/upload.js`**

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

- [ ] **Step 2: Modify `src/middlewares/uploadPhoto.js`** to use the factory

Current content:
```js
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCTORS_UPLOAD_DIR = path.join(__dirname, '../uploads/doctors');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCTORS_UPLOAD_DIR),
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

export const uploadDoctorPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('photo');
```

Replace with:
```js
import { makeUploadMiddleware } from './upload.js';

export const uploadDoctorPhoto = makeUploadMiddleware('doctors', 'photo');
```

- [ ] **Step 3: Verify — re-run the exact Doctor photo curl sequence from Phase 2 to confirm zero regression**

```bash
cd backend
npm start &
sleep 1

curl -s -c /tmp/upload-refactor-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

node -e "require('fs').writeFileSync('/tmp/refactor-test-photo.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))"

echo "--- create doctor with photo (should still work identically) ---"
CREATE_RESP=$(curl -s -b /tmp/upload-refactor-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Upload Refactor Test Doctor" \
  -F "active=true" \
  -F "photo=@/tmp/refactor-test-photo.png;type=image/png")
echo "$CREATE_RESP"
DOCTOR_ID=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
PHOTO_URL=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.photo_url))")
echo "photo file exists on disk: $([ -f "src${PHOTO_URL}" ] && echo true || echo false)"

echo "--- wrong file type still rejected (400, AppError message) ---"
echo "not an image" > /tmp/refactor-bad.txt
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/upload-refactor-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Should Fail Type" -F "photo=@/tmp/refactor-bad.txt;type=text/plain"

echo "--- oversized file still rejected (400, Multer's own message) ---"
head -c 3000000 /dev/urandom > /tmp/refactor-big.jpg
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/upload-refactor-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Should Fail Big" -F "photo=@/tmp/refactor-big.jpg;type=image/jpeg"

echo "--- cleanup: delete the test doctor, confirm photo file removed ---"
curl -s -b /tmp/upload-refactor-cookies.txt -X DELETE "http://localhost:5000/api/doctors/$DOCTOR_ID"
echo "photo file gone after delete: $([ ! -f "src${PHOTO_URL}" ] && echo true || echo false)"

kill %1
rm -f /tmp/upload-refactor-cookies.txt /tmp/refactor-test-photo.png /tmp/refactor-bad.txt /tmp/refactor-big.jpg
```

Expected: identical behavior to Phase 2 — `201` with a working photo file on disk; wrong type → `400` with the AppError message; oversized file → `400` with Multer's "File too large" message; delete removes the photo file. Zero behavior change, only the implementation moved into the shared factory.

- [ ] **Step 4: Commit**

```bash
git add backend/src/middlewares/upload.js backend/src/middlewares/uploadPhoto.js
git commit -m "Extract shared upload middleware factory, retrofit Doctor photo upload"
```

---

### Task 2: Services repository + service

**Files:**
- Create: `backend/src/repositories/serviceRepository.js`
- Create: `backend/src/services/serviceService.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js` (Phase 1); `AppError` (default export) from `backend/src/utils/AppError.js` (Phase 1).
- Produces: named exports `findAll()`, `findById(id)`, `create(service)`, `update(id, service)`, `remove(id)` from `serviceRepository.js`. `service` objects always have all 4 non-id columns present (`name, description, image_url, display_order`).
- Produces: named exports `listServices()`, `listPublicServices()`, `getService(id)`, `createService(data, file)`, `updateService(id, data, file)`, `deleteService(id)` from `serviceService.js`. `data` is a plain object with the service's form fields. `file` is `undefined`/`null` or an object with at least `.filename` (Multer's `req.file` shape). `getService` throws `AppError('Service not found.', 404)` if missing.

- [ ] **Step 1: Create `src/repositories/serviceRepository.js`**

```js
import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT * FROM services ORDER BY display_order ASC, name ASC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM services WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(service) {
  const [result] = await pool.query(
    `INSERT INTO services (name, description, image_url, display_order)
     VALUES (:name, :description, :image_url, :display_order)`,
    service
  );
  return result.insertId;
}

export async function update(id, service) {
  await pool.query(
    `UPDATE services SET
      name = :name,
      description = :description,
      image_url = :image_url,
      display_order = :display_order
     WHERE id = :id`,
    { ...service, id }
  );
}

export async function remove(id) {
  await pool.query('DELETE FROM services WHERE id = :id', { id });
}
```

- [ ] **Step 2: Create `src/services/serviceService.js`**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';
import * as serviceRepository from '../repositories/serviceRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/services/${file.filename}` : null;
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
    description: data.description ?? null,
    image_url: photoUrl,
    display_order: data.display_order ?? 0,
  };
}

export async function listServices() {
  return serviceRepository.findAll();
}

export async function listPublicServices() {
  return serviceRepository.findAll();
}

export async function getService(id) {
  const service = await serviceRepository.findById(id);
  if (!service) {
    throw new AppError('Service not found.', 404);
  }
  return service;
}

export async function createService(data, file) {
  const service = toRow(data, buildPhotoUrl(file));
  const id = await serviceRepository.create(service);
  return getService(id);
}

export async function updateService(id, data, file) {
  const existing = await getService(id);

  const photoUrl = file ? buildPhotoUrl(file) : existing.image_url;
  const service = toRow(data, photoUrl);
  await serviceRepository.update(id, service);

  if (file) {
    await deletePhotoFile(existing.image_url);
  }

  return getService(id);
}

export async function deleteService(id) {
  const service = await getService(id);
  await serviceRepository.remove(id);
  await deletePhotoFile(service.image_url);
}
```

(No FK-protection try/catch on delete, unlike Doctors — no other table references `services`. `listPublicServices()` is a separate exported function from `listServices()`, even though both currently call the identical `findAll()`, so the controller/route layer has a stable name to call regardless of whether the two ever diverge later.)

- [ ] **Step 3: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-service.mjs`:

```js
import * as serviceService from '../src/services/serviceService.js';
import pool from '../src/config/db.js';

async function main() {
  const created = await serviceService.createService(
    { name: 'Verify Test Service', description: 'A test service', display_order: 3 },
    null
  );
  console.log('created id:', created.id, 'name:', created.name, 'image_url:', created.image_url);

  const fetched = await serviceService.getService(created.id);
  console.log('fetched display_order:', fetched.display_order);

  const list = await serviceService.listServices();
  console.log('listServices includes new service:', list.some((s) => s.id === created.id));

  const publicList = await serviceService.listPublicServices();
  console.log('listPublicServices includes new service:', publicList.some((s) => s.id === created.id));

  const updated = await serviceService.updateService(created.id, { name: 'Verify Test Service Updated', display_order: 1 }, null);
  console.log('updated name:', updated.name, 'display_order:', updated.display_order);

  await serviceService.deleteService(created.id);

  try {
    await serviceService.getService(created.id);
    console.log('ERROR: expected 404 after delete, but no error was thrown');
  } catch (err) {
    console.log('getService after delete threw as expected:', err.statusCode, err.message);
  }

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
node scripts/tmp-verify-service.mjs
```

Expected output:
```
created id: <number> name: Verify Test Service image_url: null
fetched display_order: 3
listServices includes new service: true
listPublicServices includes new service: true
updated name: Verify Test Service Updated display_order: 1
getService after delete threw as expected: 404 Service not found.
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-service.mjs
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/repositories/serviceRepository.js backend/src/services/serviceService.js
git commit -m "Add service repository and service layer"
```

---

### Task 3: Services HTTP API — validators, upload middleware, controller, routes, wiring

**Files:**
- Create: `backend/src/validators/serviceValidators.js`
- Create: `backend/src/middlewares/uploadServicePhoto.js`
- Create: `backend/src/controllers/serviceController.js`
- Create: `backend/src/routes/serviceRoutes.js`
- Create: `backend/src/uploads/services/.gitkeep`
- Modify: `backend/.gitignore`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `listServices, listPublicServices, getService, createService, updateService, deleteService` from `serviceService.js` (Task 2); `makeUploadMiddleware` from `middlewares/upload.js` (Task 1); `authenticate`, `authorize(...roles)`, `validate(schema)` from Phase 1's middlewares; `asyncHandler`, `sendResponse` from Phase 1's utils.
- Produces: `serviceSchema` (zod schema) from `serviceValidators.js`; `uploadServicePhoto` (configured Multer single-file middleware, field name `image`) from `uploadServicePhoto.js`; `list, listPublic, getOne, create, update, remove` (Express handlers) from `serviceController.js`; default-exported Express `Router` from `serviceRoutes.js` mounted at `/services`.

- [ ] **Step 1: Create `src/validators/serviceValidators.js`**

```js
import { z } from 'zod';

export const serviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});
```

- [ ] **Step 2: Create `src/middlewares/uploadServicePhoto.js`**

```js
import { makeUploadMiddleware } from './upload.js';

export const uploadServicePhoto = makeUploadMiddleware('services', 'image');
```

- [ ] **Step 3: Create `src/uploads/services/.gitkeep`**

Empty file — reserves the directory in git.

- [ ] **Step 4: Modify `backend/.gitignore`** to track the new subdirectory's `.gitkeep` without tracking uploaded files

Current content:
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

Replace with:
```
node_modules/
.env
src/uploads/*
!src/uploads/.gitkeep
!src/uploads/doctors/
src/uploads/doctors/*
!src/uploads/doctors/.gitkeep
!src/uploads/services/
src/uploads/services/*
!src/uploads/services/.gitkeep
*.log
.DS_Store
```

Verify:
```bash
cd backend
git check-ignore -v src/uploads/services/.gitkeep && echo "BUG: gitkeep is ignored" || echo "OK: gitkeep is NOT ignored"
git check-ignore -v src/uploads/services/some-photo.jpg
```
Expected: first line prints `OK: gitkeep is NOT ignored`; second line prints a match against the `src/uploads/services/*` pattern.

- [ ] **Step 5: Create `src/controllers/serviceController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as serviceService from '../services/serviceService.js';

export const list = asyncHandler(async (req, res) => {
  const services = await serviceService.listServices();
  sendResponse(res, { status: 200, message: 'Services retrieved', data: services });
});

export const listPublic = asyncHandler(async (req, res) => {
  const services = await serviceService.listPublicServices();
  sendResponse(res, { status: 200, message: 'Services retrieved', data: services });
});

export const getOne = asyncHandler(async (req, res) => {
  const service = await serviceService.getService(req.params.id);
  sendResponse(res, { status: 200, message: 'Service retrieved', data: service });
});

export const create = asyncHandler(async (req, res) => {
  const service = await serviceService.createService(req.body, req.file);
  sendResponse(res, { status: 201, message: 'Service created', data: service });
});

export const update = asyncHandler(async (req, res) => {
  const service = await serviceService.updateService(req.params.id, req.body, req.file);
  sendResponse(res, { status: 200, message: 'Service updated', data: service });
});

export const remove = asyncHandler(async (req, res) => {
  await serviceService.deleteService(req.params.id);
  sendResponse(res, { status: 200, message: 'Service deleted' });
});
```

- [ ] **Step 6: Create `src/routes/serviceRoutes.js`**

```js
import { Router } from 'express';
import * as serviceController from '../controllers/serviceController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { serviceSchema } from '../validators/serviceValidators.js';
import { uploadServicePhoto } from '../middlewares/uploadServicePhoto.js';

const router = Router();

router.get('/public', serviceController.listPublic);
router.get('/', authenticate, authorize('admin', 'staff'), serviceController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), serviceController.getOne);
router.post('/', authenticate, authorize('admin'), uploadServicePhoto, validate(serviceSchema), serviceController.create);
router.put('/:id', authenticate, authorize('admin'), uploadServicePhoto, validate(serviceSchema), serviceController.update);
router.delete('/:id', authenticate, authorize('admin'), serviceController.remove);

export default router;
```

- [ ] **Step 7: Modify `src/routes/index.js`** to mount the service routes

Current content:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);

export default router;
```

Replace with:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);

export default router;
```

- [ ] **Step 8: Verify — full curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1

curl -s -c /tmp/svc-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- create service (no photo) ---"
CREATE_RESP=$(curl -s -b /tmp/svc-cookies.txt -X POST http://localhost:5000/api/services \
  -F "name=Sports Injury Rehab" -F "description=Treatment for ligament tears" -F "display_order=1")
echo "$CREATE_RESP"
SERVICE_ID=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")

echo "--- public list (no auth) includes new service ---"
curl -s http://localhost:5000/api/services/public | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$SERVICE_ID))})"

STAFF_JWT=$(node --input-type=module -e "
import env from './src/config/env.js';
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ id: 999, role: 'staff' }, env.JWT_SECRET, { expiresIn: '1h' }));
" | tail -n1)

echo "--- staff CAN list services (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" http://localhost:5000/api/services -o /dev/null

echo "--- staff CANNOT create a service (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X POST http://localhost:5000/api/services -F "name=Should Fail"

echo "--- staff CANNOT delete a service (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X DELETE "http://localhost:5000/api/services/$SERVICE_ID"

echo "--- update service ---"
curl -s -b /tmp/svc-cookies.txt -X PUT "http://localhost:5000/api/services/$SERVICE_ID" \
  -F "name=Sports Injury Rehab Updated" -F "display_order=2"

echo "--- admin deletes the service (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/svc-cookies.txt -X DELETE "http://localhost:5000/api/services/$SERVICE_ID"

kill %1
rm -f /tmp/svc-cookies.txt
```

Expected (key checks): create returns `201`; public list (no cookie) shows the new service; staff JWT gets `200` on list, `403` on create, `403` on delete; update succeeds; admin delete returns `200`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/serviceValidators.js backend/src/middlewares/uploadServicePhoto.js backend/src/controllers/serviceController.js backend/src/routes/serviceRoutes.js backend/src/routes/index.js backend/src/uploads/services/.gitkeep backend/.gitignore
git commit -m "Add service HTTP API: validators, photo upload, controller, routes"
```

---

### Task 4: Services frontend — API layer, hooks, form, list

**Files:**
- Create: `frontend/src/services/serviceService.js`
- Create: `frontend/src/hooks/useServices.js`
- Create: `frontend/src/pages/admin/services/ServiceForm.jsx`
- Create: `frontend/src/pages/admin/services/ServiceList.jsx`

**Interfaces:**
- Consumes: `api` (default export) from `frontend/src/services/api.js` (Phase 1); `getPhotoUrl` from `frontend/src/utils/photoUrl.js` (Phase 2 — generic, works for any `*_url` path regardless of upload subdirectory); `ConfirmDialog` from `frontend/src/components/ConfirmDialog.jsx` (Phase 2); `useAuth` from `frontend/src/contexts/AuthContext.jsx` (Phase 1).
- Produces: `listServices()`, `getService(id)`, `createService(formData)`, `updateService(id, formData)`, `deleteService(id)` named exports from `serviceService.js`. `useServices()`, `useService(id)`, `useCreateService()`, `useUpdateService()`, `useDeleteService()` named exports from `useServices.js` (`useUpdateService()`'s mutation takes `{ id, formData }`). Default exports `ServiceForm`, `ServiceList` — neither wired into `App.jsx` yet (routing happens in Task 14).

- [ ] **Step 1: Create `src/services/serviceService.js`**

```js
import api from './api.js';

export async function listServices() {
  const { data } = await api.get('/services');
  return data.data;
}

export async function getService(id) {
  const { data } = await api.get(`/services/${id}`);
  return data.data;
}

export async function createService(formData) {
  const { data } = await api.post('/services', formData);
  return data.data;
}

export async function updateService(id, formData) {
  const { data } = await api.put(`/services/${id}`, formData);
  return data.data;
}

export async function deleteService(id) {
  await api.delete(`/services/${id}`);
}
```

- [ ] **Step 2: Create `src/hooks/useServices.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as serviceService from '../services/serviceService.js';

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: serviceService.listServices });
}

export function useService(id) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => serviceService.getService(id),
    enabled: Boolean(id),
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: serviceService.createService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => serviceService.updateService(id, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: serviceService.deleteService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}
```

- [ ] **Step 3: Create `src/pages/admin/services/ServiceForm.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useService, useCreateService, useUpdateService } from '../../../hooks/useServices.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';

export default function ServiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: service, isLoading: isLoadingService } = useService(id);
  const createService = useCreateService();
  const updateService = useUpdateService();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      description: '',
      display_order: '',
    },
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (service) {
      reset({
        name: service.name ?? '',
        description: service.description ?? '',
        display_order: service.display_order ?? '',
      });
      setPhotoPreview(getPhotoUrl(service.image_url));
    }
  }, [service, reset]);

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
    if (values.description) formData.append('description', values.description);
    if (values.display_order !== '') formData.append('display_order', values.display_order);
    if (photoFile) formData.append('image', photoFile);

    try {
      if (isEdit) {
        await updateService.mutateAsync({ id, formData });
        toast.success('Service updated');
      } else {
        await createService.mutateAsync(formData);
        toast.success('Service created');
      }
      navigate('/admin/services');
    } catch (err) {
      toast.error(err.message || 'Failed to save service.');
    }
  }

  if (isEdit && isLoadingService) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">{isEdit ? 'Edit Service' : 'Add Service'}</h1>
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            rows="3"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('description')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Display Order</label>
          <input
            type="number"
            min="0"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('display_order')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Photo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          {photoPreview && (
            <img src={photoPreview} alt="Service preview" className="mt-2 h-24 w-24 rounded object-cover" />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Service' : 'Create Service'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/services')}
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

- [ ] **Step 4: Create `src/pages/admin/services/ServiceList.jsx`**

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useServices, useDeleteService } from '../../../hooks/useServices.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function ServiceList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: services, isLoading } = useServices();
  const deleteService = useDeleteService();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function confirmDelete() {
    try {
      await deleteService.mutateAsync(pendingDeleteId);
      toast.success('Service deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete service.');
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
        <h1 className="text-2xl font-semibold text-slate-800">Services</h1>
        {isAdmin && (
          <Link
            to="/admin/services/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Service
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Order</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services?.map((service) => (
              <tr key={service.id}>
                <td className="px-4 py-3">
                  {service.image_url ? (
                    <img
                      src={getPhotoUrl(service.image_url)}
                      alt={service.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-slate-200" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{service.name}</td>
                <td className="px-4 py-3 text-slate-600">{service.description || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{service.display_order}</td>
                {isAdmin && (
                  <td className="space-x-3 px-4 py-3">
                    <Link to={`/admin/services/${service.id}/edit`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => setPendingDeleteId(service.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {services?.length === 0 && <p className="p-6 text-center text-slate-500">No services added yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Service"
        message="Are you sure you want to delete this service? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 13).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/serviceService.js frontend/src/hooks/useServices.js frontend/src/pages/admin/services/ServiceForm.jsx frontend/src/pages/admin/services/ServiceList.jsx
git commit -m "Add services frontend: API layer, hooks, form, list"
```

---

### Task 5: Testimonials repository + service

**Files:**
- Create: `backend/src/repositories/testimonialRepository.js`
- Create: `backend/src/services/testimonialService.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js` (Phase 1); `AppError` (default export) from `backend/src/utils/AppError.js` (Phase 1).
- Produces: named exports `findAll()`, `findById(id)`, `create(testimonial)`, `update(id, testimonial)`, `remove(id)` from `testimonialRepository.js`. `testimonial` objects always have all 4 non-id columns present (`patient_name, review, rating, photo_url`).
- Produces: named exports `listTestimonials()`, `listPublicTestimonials()`, `getTestimonial(id)`, `createTestimonial(data, file)`, `updateTestimonial(id, data, file)`, `deleteTestimonial(id)` from `testimonialService.js`. `getTestimonial` throws `AppError('Testimonial not found.', 404)` if missing.

- [ ] **Step 1: Create `src/repositories/testimonialRepository.js`**

```js
import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT * FROM testimonials ORDER BY created_at DESC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM testimonials WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(testimonial) {
  const [result] = await pool.query(
    `INSERT INTO testimonials (patient_name, review, rating, photo_url)
     VALUES (:patient_name, :review, :rating, :photo_url)`,
    testimonial
  );
  return result.insertId;
}

export async function update(id, testimonial) {
  await pool.query(
    `UPDATE testimonials SET
      patient_name = :patient_name,
      review = :review,
      rating = :rating,
      photo_url = :photo_url
     WHERE id = :id`,
    { ...testimonial, id }
  );
}

export async function remove(id) {
  await pool.query('DELETE FROM testimonials WHERE id = :id', { id });
}
```

- [ ] **Step 2: Create `src/services/testimonialService.js`**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';
import * as testimonialRepository from '../repositories/testimonialRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/testimonials/${file.filename}` : null;
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
    patient_name: data.patient_name,
    review: data.review,
    rating: data.rating,
    photo_url: photoUrl,
  };
}

export async function listTestimonials() {
  return testimonialRepository.findAll();
}

export async function listPublicTestimonials() {
  return testimonialRepository.findAll();
}

export async function getTestimonial(id) {
  const testimonial = await testimonialRepository.findById(id);
  if (!testimonial) {
    throw new AppError('Testimonial not found.', 404);
  }
  return testimonial;
}

export async function createTestimonial(data, file) {
  const testimonial = toRow(data, buildPhotoUrl(file));
  const id = await testimonialRepository.create(testimonial);
  return getTestimonial(id);
}

export async function updateTestimonial(id, data, file) {
  const existing = await getTestimonial(id);

  const photoUrl = file ? buildPhotoUrl(file) : existing.photo_url;
  const testimonial = toRow(data, photoUrl);
  await testimonialRepository.update(id, testimonial);

  if (file) {
    await deletePhotoFile(existing.photo_url);
  }

  return getTestimonial(id);
}

export async function deleteTestimonial(id) {
  const testimonial = await getTestimonial(id);
  await testimonialRepository.remove(id);
  await deletePhotoFile(testimonial.photo_url);
}
```

(Same shape as `serviceService.js` from Task 2 — no FK-protection on delete, since no other table references `testimonials`.)

- [ ] **Step 3: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-testimonial.mjs`:

```js
import * as testimonialService from '../src/services/testimonialService.js';
import pool from '../src/config/db.js';

async function main() {
  const created = await testimonialService.createTestimonial(
    { patient_name: 'Verify Test Patient', review: 'Great care and recovery.', rating: 5 },
    null
  );
  console.log('created id:', created.id, 'patient_name:', created.patient_name, 'rating:', created.rating);

  const fetched = await testimonialService.getTestimonial(created.id);
  console.log('fetched review:', fetched.review);

  const list = await testimonialService.listTestimonials();
  console.log('listTestimonials includes new testimonial:', list.some((t) => t.id === created.id));

  const publicList = await testimonialService.listPublicTestimonials();
  console.log('listPublicTestimonials includes new testimonial:', publicList.some((t) => t.id === created.id));

  const updated = await testimonialService.updateTestimonial(created.id, { patient_name: 'Verify Test Patient Updated', review: 'Still great.', rating: 4 }, null);
  console.log('updated patient_name:', updated.patient_name, 'rating:', updated.rating);

  await testimonialService.deleteTestimonial(created.id);

  try {
    await testimonialService.getTestimonial(created.id);
    console.log('ERROR: expected 404 after delete, but no error was thrown');
  } catch (err) {
    console.log('getTestimonial after delete threw as expected:', err.statusCode, err.message);
  }

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
node scripts/tmp-verify-testimonial.mjs
```

Expected output:
```
created id: <number> patient_name: Verify Test Patient rating: 5
fetched review: Great care and recovery.
listTestimonials includes new testimonial: true
listPublicTestimonials includes new testimonial: true
updated patient_name: Verify Test Patient Updated rating: 4
getTestimonial after delete threw as expected: 404 Testimonial not found.
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-testimonial.mjs
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/repositories/testimonialRepository.js backend/src/services/testimonialService.js
git commit -m "Add testimonial repository and service layer"
```

---

### Task 6: Testimonials HTTP API — validators, upload middleware, controller, routes, wiring

**Files:**
- Create: `backend/src/validators/testimonialValidators.js`
- Create: `backend/src/middlewares/uploadTestimonialPhoto.js`
- Create: `backend/src/controllers/testimonialController.js`
- Create: `backend/src/routes/testimonialRoutes.js`
- Create: `backend/src/uploads/testimonials/.gitkeep`
- Modify: `backend/.gitignore`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `listTestimonials, listPublicTestimonials, getTestimonial, createTestimonial, updateTestimonial, deleteTestimonial` from `testimonialService.js` (Task 5); `makeUploadMiddleware` from `middlewares/upload.js` (Task 1); `authenticate`, `authorize(...roles)`, `validate(schema)` from Phase 1's middlewares; `asyncHandler`, `sendResponse` from Phase 1's utils.
- Produces: `testimonialSchema` (zod schema) from `testimonialValidators.js`; `uploadTestimonialPhoto` (configured Multer single-file middleware, field name `photo`) from `uploadTestimonialPhoto.js`; `list, listPublic, getOne, create, update, remove` (Express handlers) from `testimonialController.js`; default-exported Express `Router` from `testimonialRoutes.js` mounted at `/testimonials`.

- [ ] **Step 1: Create `src/validators/testimonialValidators.js`**

```js
import { z } from 'zod';

export const testimonialSchema = z.object({
  patient_name: z.string().min(2, 'Name must be at least 2 characters'),
  review: z.string().min(5, 'Review must be at least 5 characters'),
  rating: z.coerce.number().int().min(1).max(5),
});
```

- [ ] **Step 2: Create `src/middlewares/uploadTestimonialPhoto.js`**

```js
import { makeUploadMiddleware } from './upload.js';

export const uploadTestimonialPhoto = makeUploadMiddleware('testimonials', 'photo');
```

- [ ] **Step 3: Create `src/uploads/testimonials/.gitkeep`**

Empty file — reserves the directory in git.

- [ ] **Step 4: Modify `backend/.gitignore`** to track the new subdirectory's `.gitkeep` without tracking uploaded files

Current content:
```
node_modules/
.env
src/uploads/*
!src/uploads/.gitkeep
!src/uploads/doctors/
src/uploads/doctors/*
!src/uploads/doctors/.gitkeep
!src/uploads/services/
src/uploads/services/*
!src/uploads/services/.gitkeep
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
!src/uploads/services/
src/uploads/services/*
!src/uploads/services/.gitkeep
!src/uploads/testimonials/
src/uploads/testimonials/*
!src/uploads/testimonials/.gitkeep
*.log
.DS_Store
```

Verify:
```bash
cd backend
git check-ignore -v src/uploads/testimonials/.gitkeep && echo "BUG: gitkeep is ignored" || echo "OK: gitkeep is NOT ignored"
git check-ignore -v src/uploads/testimonials/some-photo.jpg
```
Expected: first line prints `OK: gitkeep is NOT ignored`; second line prints a match against the `src/uploads/testimonials/*` pattern.

- [ ] **Step 5: Create `src/controllers/testimonialController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as testimonialService from '../services/testimonialService.js';

export const list = asyncHandler(async (req, res) => {
  const testimonials = await testimonialService.listTestimonials();
  sendResponse(res, { status: 200, message: 'Testimonials retrieved', data: testimonials });
});

export const listPublic = asyncHandler(async (req, res) => {
  const testimonials = await testimonialService.listPublicTestimonials();
  sendResponse(res, { status: 200, message: 'Testimonials retrieved', data: testimonials });
});

export const getOne = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.getTestimonial(req.params.id);
  sendResponse(res, { status: 200, message: 'Testimonial retrieved', data: testimonial });
});

export const create = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.createTestimonial(req.body, req.file);
  sendResponse(res, { status: 201, message: 'Testimonial created', data: testimonial });
});

export const update = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.updateTestimonial(req.params.id, req.body, req.file);
  sendResponse(res, { status: 200, message: 'Testimonial updated', data: testimonial });
});

export const remove = asyncHandler(async (req, res) => {
  await testimonialService.deleteTestimonial(req.params.id);
  sendResponse(res, { status: 200, message: 'Testimonial deleted' });
});
```

- [ ] **Step 6: Create `src/routes/testimonialRoutes.js`**

```js
import { Router } from 'express';
import * as testimonialController from '../controllers/testimonialController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { testimonialSchema } from '../validators/testimonialValidators.js';
import { uploadTestimonialPhoto } from '../middlewares/uploadTestimonialPhoto.js';

const router = Router();

router.get('/public', testimonialController.listPublic);
router.get('/', authenticate, authorize('admin', 'staff'), testimonialController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), testimonialController.getOne);
router.post('/', authenticate, authorize('admin'), uploadTestimonialPhoto, validate(testimonialSchema), testimonialController.create);
router.put('/:id', authenticate, authorize('admin'), uploadTestimonialPhoto, validate(testimonialSchema), testimonialController.update);
router.delete('/:id', authenticate, authorize('admin'), testimonialController.remove);

export default router;
```

- [ ] **Step 7: Modify `src/routes/index.js`** to mount the testimonial routes

Current content:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);

export default router;
```

Replace with:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import testimonialRoutes from './testimonialRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);
router.use('/testimonials', testimonialRoutes);

export default router;
```

- [ ] **Step 8: Verify — full curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1

curl -s -c /tmp/tst-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- create testimonial (no photo) ---"
CREATE_RESP=$(curl -s -b /tmp/tst-cookies.txt -X POST http://localhost:5000/api/testimonials \
  -F "patient_name=Ramesh Kumar" -F "review=Excellent recovery experience" -F "rating=5")
echo "$CREATE_RESP"
TESTIMONIAL_ID=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")

echo "--- rating out of range rejected (400) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/tst-cookies.txt -X POST http://localhost:5000/api/testimonials \
  -F "patient_name=Bad Rating" -F "review=Should fail validation" -F "rating=6"

echo "--- public list (no auth) includes new testimonial ---"
curl -s http://localhost:5000/api/testimonials/public | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$TESTIMONIAL_ID))})"

STAFF_JWT=$(node --input-type=module -e "
import env from './src/config/env.js';
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ id: 999, role: 'staff' }, env.JWT_SECRET, { expiresIn: '1h' }));
" | tail -n1)

echo "--- staff CAN list testimonials (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" http://localhost:5000/api/testimonials -o /dev/null

echo "--- staff CANNOT create a testimonial (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X POST http://localhost:5000/api/testimonials -F "patient_name=Should Fail" -F "review=Should fail" -F "rating=5"

echo "--- staff CANNOT delete a testimonial (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X DELETE "http://localhost:5000/api/testimonials/$TESTIMONIAL_ID"

echo "--- update testimonial ---"
curl -s -b /tmp/tst-cookies.txt -X PUT "http://localhost:5000/api/testimonials/$TESTIMONIAL_ID" \
  -F "patient_name=Ramesh Kumar Updated" -F "review=Still excellent" -F "rating=4"

echo "--- admin deletes the testimonial (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/tst-cookies.txt -X DELETE "http://localhost:5000/api/testimonials/$TESTIMONIAL_ID"

kill %1
rm -f /tmp/tst-cookies.txt
```

Expected (key checks): create returns `201`; out-of-range rating returns `400`; public list shows the new testimonial; staff JWT gets `200` on list, `403` on create, `403` on delete; update succeeds; admin delete returns `200`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/testimonialValidators.js backend/src/middlewares/uploadTestimonialPhoto.js backend/src/controllers/testimonialController.js backend/src/routes/testimonialRoutes.js backend/src/routes/index.js backend/src/uploads/testimonials/.gitkeep backend/.gitignore
git commit -m "Add testimonial HTTP API: validators, photo upload, controller, routes"
```

---

### Task 7: Testimonials frontend — API layer, hooks, form, list

**Files:**
- Create: `frontend/src/services/testimonialService.js`
- Create: `frontend/src/hooks/useTestimonials.js`
- Create: `frontend/src/pages/admin/testimonials/TestimonialForm.jsx`
- Create: `frontend/src/pages/admin/testimonials/TestimonialList.jsx`

**Interfaces:**
- Consumes: `api` from `frontend/src/services/api.js` (Phase 1); `getPhotoUrl` from `frontend/src/utils/photoUrl.js` (Phase 2); `ConfirmDialog` from `frontend/src/components/ConfirmDialog.jsx` (Phase 2); `useAuth` from `frontend/src/contexts/AuthContext.jsx` (Phase 1).
- Produces: `listTestimonials()`, `getTestimonial(id)`, `createTestimonial(formData)`, `updateTestimonial(id, formData)`, `deleteTestimonial(id)` named exports from `testimonialService.js`. `useTestimonials()`, `useTestimonial(id)`, `useCreateTestimonial()`, `useUpdateTestimonial()`, `useDeleteTestimonial()` named exports from `useTestimonials.js` (`useUpdateTestimonial()`'s mutation takes `{ id, formData }`). Default exports `TestimonialForm`, `TestimonialList` — not yet wired into `App.jsx` (routing happens in Task 14).

- [ ] **Step 1: Create `src/services/testimonialService.js`**

```js
import api from './api.js';

export async function listTestimonials() {
  const { data } = await api.get('/testimonials');
  return data.data;
}

export async function getTestimonial(id) {
  const { data } = await api.get(`/testimonials/${id}`);
  return data.data;
}

export async function createTestimonial(formData) {
  const { data } = await api.post('/testimonials', formData);
  return data.data;
}

export async function updateTestimonial(id, formData) {
  const { data } = await api.put(`/testimonials/${id}`, formData);
  return data.data;
}

export async function deleteTestimonial(id) {
  await api.delete(`/testimonials/${id}`);
}
```

- [ ] **Step 2: Create `src/hooks/useTestimonials.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as testimonialService from '../services/testimonialService.js';

export function useTestimonials() {
  return useQuery({ queryKey: ['testimonials'], queryFn: testimonialService.listTestimonials });
}

export function useTestimonial(id) {
  return useQuery({
    queryKey: ['testimonials', id],
    queryFn: () => testimonialService.getTestimonial(id),
    enabled: Boolean(id),
  });
}

export function useCreateTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testimonialService.createTestimonial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['testimonials'] }),
  });
}

export function useUpdateTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => testimonialService.updateTestimonial(id, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['testimonials'] }),
  });
}

export function useDeleteTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testimonialService.deleteTestimonial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['testimonials'] }),
  });
}
```

- [ ] **Step 3: Create `src/pages/admin/testimonials/TestimonialForm.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTestimonial, useCreateTestimonial, useUpdateTestimonial } from '../../../hooks/useTestimonials.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';

export default function TestimonialForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: testimonial, isLoading: isLoadingTestimonial } = useTestimonial(id);
  const createTestimonial = useCreateTestimonial();
  const updateTestimonial = useUpdateTestimonial();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      patient_name: '',
      review: '',
      rating: '5',
    },
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (testimonial) {
      reset({
        patient_name: testimonial.patient_name ?? '',
        review: testimonial.review ?? '',
        rating: String(testimonial.rating ?? 5),
      });
      setPhotoPreview(getPhotoUrl(testimonial.photo_url));
    }
  }, [testimonial, reset]);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  async function onSubmit(values) {
    const formData = new FormData();
    formData.append('patient_name', values.patient_name);
    formData.append('review', values.review);
    formData.append('rating', values.rating);
    if (photoFile) formData.append('photo', photoFile);

    try {
      if (isEdit) {
        await updateTestimonial.mutateAsync({ id, formData });
        toast.success('Testimonial updated');
      } else {
        await createTestimonial.mutateAsync(formData);
        toast.success('Testimonial created');
      }
      navigate('/admin/testimonials');
    } catch (err) {
      toast.error(err.message || 'Failed to save testimonial.');
    }
  }

  if (isEdit && isLoadingTestimonial) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">{isEdit ? 'Edit Testimonial' : 'Add Testimonial'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('patient_name', { required: 'Name is required' })}
          />
          {errors.patient_name && <p className="mt-1 text-sm text-red-600">{errors.patient_name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Review</label>
          <textarea
            rows="4"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('review', {
              required: 'Review is required',
              minLength: { value: 5, message: 'Review must be at least 5 characters' },
            })}
          />
          {errors.review && <p className="mt-1 text-sm text-red-600">{errors.review.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Rating</label>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('rating', { required: true })}
          >
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} star{r > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Photo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          {photoPreview && (
            <img src={photoPreview} alt="Testimonial preview" className="mt-2 h-24 w-24 rounded-full object-cover" />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Testimonial' : 'Create Testimonial'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/testimonials')}
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

- [ ] **Step 4: Create `src/pages/admin/testimonials/TestimonialList.jsx`**

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useTestimonials, useDeleteTestimonial } from '../../../hooks/useTestimonials.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function TestimonialList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: testimonials, isLoading } = useTestimonials();
  const deleteTestimonial = useDeleteTestimonial();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function confirmDelete() {
    try {
      await deleteTestimonial.mutateAsync(pendingDeleteId);
      toast.success('Testimonial deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete testimonial.');
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
        <h1 className="text-2xl font-semibold text-slate-800">Testimonials</h1>
        {isAdmin && (
          <Link
            to="/admin/testimonials/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Testimonial
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Rating</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {testimonials?.map((testimonial) => (
              <tr key={testimonial.id}>
                <td className="px-4 py-3">
                  {testimonial.photo_url ? (
                    <img
                      src={getPhotoUrl(testimonial.photo_url)}
                      alt={testimonial.patient_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{testimonial.patient_name}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{testimonial.review}</td>
                <td className="px-4 py-3 text-slate-600">{testimonial.rating} / 5</td>
                {isAdmin && (
                  <td className="space-x-3 px-4 py-3">
                    <Link to={`/admin/testimonials/${testimonial.id}/edit`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => setPendingDeleteId(testimonial.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {testimonials?.length === 0 && <p className="p-6 text-center text-slate-500">No testimonials added yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Testimonial"
        message="Are you sure you want to delete this testimonial? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 13).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/testimonialService.js frontend/src/hooks/useTestimonials.js frontend/src/pages/admin/testimonials/TestimonialForm.jsx frontend/src/pages/admin/testimonials/TestimonialList.jsx
git commit -m "Add testimonials frontend: API layer, hooks, form, list"
```

---

### Task 8: Hospital Settings repository + service + default-row seed

**Files:**
- Create: `backend/src/repositories/settingsRepository.js`
- Create: `backend/src/services/settingsService.js`
- Modify: `backend/scripts/migrate.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js` (Phase 1).
- Produces: named exports `find()`, `update(fields)` from `settingsRepository.js`. `find()` resolves to the single row (id=1, always present after migration) or `null` if somehow missing. `update(fields)` is a partial update (only provided keys written), same dynamic-`SET` pattern as `appointmentRepository.update` from Phase 3 — always targets `id = 1`, no `id` parameter.
- Produces: named exports `getSettings()`, `getPublicSettings()`, `updateSettings(data, file)` from `settingsService.js`. `data`'s `social_links` field, if present, is a plain JS object (already parsed from its JSON-string form by the validator in Task 9) — the service re-serializes it to a JSON string before writing, since raw JS objects aren't reliably escaped as valid JSON text by the MySQL driver. `updateSettings` never throws 404 (the row always exists).

- [ ] **Step 1: Create `src/repositories/settingsRepository.js`**

```js
import pool from '../config/db.js';

export async function find() {
  const [rows] = await pool.query('SELECT * FROM hospital_settings WHERE id = 1');
  return rows[0] ?? null;
}

export async function update(fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE hospital_settings SET ${setClause} WHERE id = 1`, fields);
}
```

- [ ] **Step 2: Create `src/services/settingsService.js`**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as settingsRepository from '../repositories/settingsRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

function buildPhotoUrl(file) {
  return file ? `/uploads/settings/${file.filename}` : null;
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

function toFields(data, logoUrl) {
  const fields = {};
  if (data.hospital_name !== undefined) fields.hospital_name = data.hospital_name;
  if (data.address !== undefined) fields.address = data.address;
  if (data.phone !== undefined) fields.phone = data.phone;
  if (data.email !== undefined) fields.email = data.email;
  if (data.google_map_link !== undefined) fields.google_map_link = data.google_map_link;
  if (data.opening_hours !== undefined) fields.opening_hours = data.opening_hours;
  if (data.social_links !== undefined) fields.social_links = JSON.stringify(data.social_links);
  if (logoUrl !== undefined) fields.logo_url = logoUrl;
  return fields;
}

export async function getSettings() {
  return settingsRepository.find();
}

export async function getPublicSettings() {
  return settingsRepository.find();
}

export async function updateSettings(data, file) {
  const existing = await settingsRepository.find();
  const fields = toFields(data, file ? buildPhotoUrl(file) : undefined);

  await settingsRepository.update(fields);

  if (file && existing?.logo_url) {
    await deletePhotoFile(existing.logo_url);
  }

  return settingsRepository.find();
}
```

(`logoUrl` is only passed to `toFields` as a defined value when a new file was uploaded — `toFields` only includes `logo_url` in the returned partial-update object when that happens, so editing settings without touching the logo leaves `logo_url` untouched, matching the Doctor/Service/Testimonial pattern. The old logo file is deleted only after `settingsRepository.update` commits, and only when a new file was actually uploaded — same post-commit-delete ordering fixed in Phase 2's review.)

- [ ] **Step 3: Modify `backend/scripts/migrate.js`** to seed the default settings row

Current content:
```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, '../src/config/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\``);
    await connection.query(`USE \`${env.DB_NAME}\``);
    await connection.query(schema);
    await connection.query("INSERT IGNORE INTO roles (name) VALUES ('admin'), ('staff')");
    console.log(`Database schema applied successfully to "${env.DB_NAME}".`);
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
```

Replace with:
```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, '../src/config/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\``);
    await connection.query(`USE \`${env.DB_NAME}\``);
    await connection.query(schema);
    await connection.query("INSERT IGNORE INTO roles (name) VALUES ('admin'), ('staff')");
    await connection.query('INSERT IGNORE INTO hospital_settings (id) VALUES (1)');
    console.log(`Database schema applied successfully to "${env.DB_NAME}".`);
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Verify — re-run migrate, then a standalone script against the real DB**

```bash
cd backend
npm run migrate
```
Expected: runs cleanly, `INSERT IGNORE INTO hospital_settings (id) VALUES (1)` either creates the row (fresh DB) or is a no-op (row already exists from a prior run) — either way, no error.

Create `backend/scripts/tmp-verify-settings.mjs`:

```js
import * as settingsService from '../src/services/settingsService.js';
import pool from '../src/config/db.js';

async function main() {
  const initial = await settingsService.getSettings();
  console.log('settings row exists after migrate:', initial !== null, 'id:', initial?.id);

  const updated = await settingsService.updateSettings(
    {
      hospital_name: 'Verify Test Hospital',
      address: '123 Test Street',
      social_links: { instagram: 'https://instagram.com/test', facebook: 'https://facebook.com/test' },
    },
    null
  );
  console.log('updated hospital_name:', updated.hospital_name);
  console.log('updated address:', updated.address);
  console.log('social_links is an object:', typeof updated.social_links === 'object');
  console.log('social_links.instagram:', updated.social_links.instagram);

  const publicSettings = await settingsService.getPublicSettings();
  console.log('getPublicSettings matches:', publicSettings.hospital_name === 'Verify Test Hospital');

  const partial = await settingsService.updateSettings({ phone: '9999999999' }, null);
  console.log('partial update kept hospital_name unchanged:', partial.hospital_name === 'Verify Test Hospital');
  console.log('partial update set phone:', partial.phone);

  await settingsService.updateSettings(
    { hospital_name: null, address: null, phone: null, social_links: {} },
    null
  );
  console.log('cleanup: settings reset to blank');

  await pool.end();
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
```

Run:
```bash
node scripts/tmp-verify-settings.mjs
```

Expected output:
```
settings row exists after migrate: true id: 1
updated hospital_name: Verify Test Hospital
updated address: 123 Test Street
social_links is an object: true
social_links.instagram: https://instagram.com/test
getPublicSettings matches: true
partial update kept hospital_name unchanged: true
partial update set phone: 9999999999
cleanup: settings reset to blank
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-settings.mjs
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/settingsRepository.js backend/src/services/settingsService.js backend/scripts/migrate.js
git commit -m "Add hospital settings repository and service, seed default row"
```

---

### Task 9: Hospital Settings HTTP API — validators, upload middleware, controller, routes, wiring

**Files:**
- Create: `backend/src/validators/settingsValidators.js`
- Create: `backend/src/middlewares/uploadSettingsLogo.js`
- Create: `backend/src/controllers/settingsController.js`
- Create: `backend/src/routes/settingsRoutes.js`
- Create: `backend/src/uploads/settings/.gitkeep`
- Modify: `backend/.gitignore`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `getSettings, getPublicSettings, updateSettings` from `settingsService.js` (Task 8); `makeUploadMiddleware` from `middlewares/upload.js` (Task 1); `authenticate`, `authorize(...roles)`, `validate(schema)` from Phase 1's middlewares; `asyncHandler`, `sendResponse` from Phase 1's utils.
- Produces: `settingsSchema` (zod schema) from `settingsValidators.js`; `uploadSettingsLogo` (configured Multer single-file middleware, field name `logo`) from `uploadSettingsLogo.js`; `getSettings, getPublicSettings, updateSettings` (Express handlers) from `settingsController.js`; default-exported Express `Router` from `settingsRoutes.js` mounted at `/settings`. This module has no list/create/delete — only get/get-public/update, since it's a singleton.

- [ ] **Step 1: Create `src/validators/settingsValidators.js`**

```js
import { z } from 'zod';

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
```

- [ ] **Step 2: Create `src/middlewares/uploadSettingsLogo.js`**

```js
import { makeUploadMiddleware } from './upload.js';

export const uploadSettingsLogo = makeUploadMiddleware('settings', 'logo');
```

- [ ] **Step 3: Create `src/uploads/settings/.gitkeep`**

Empty file — reserves the directory in git.

- [ ] **Step 4: Modify `backend/.gitignore`** to track the new subdirectory's `.gitkeep` without tracking uploaded files

Current content:
```
node_modules/
.env
src/uploads/*
!src/uploads/.gitkeep
!src/uploads/doctors/
src/uploads/doctors/*
!src/uploads/doctors/.gitkeep
!src/uploads/services/
src/uploads/services/*
!src/uploads/services/.gitkeep
!src/uploads/testimonials/
src/uploads/testimonials/*
!src/uploads/testimonials/.gitkeep
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
!src/uploads/services/
src/uploads/services/*
!src/uploads/services/.gitkeep
!src/uploads/testimonials/
src/uploads/testimonials/*
!src/uploads/testimonials/.gitkeep
!src/uploads/settings/
src/uploads/settings/*
!src/uploads/settings/.gitkeep
*.log
.DS_Store
```

Verify:
```bash
cd backend
git check-ignore -v src/uploads/settings/.gitkeep && echo "BUG: gitkeep is ignored" || echo "OK: gitkeep is NOT ignored"
git check-ignore -v src/uploads/settings/some-photo.jpg
```
Expected: first line prints `OK: gitkeep is NOT ignored`; second line prints a match against the `src/uploads/settings/*` pattern.

- [ ] **Step 5: Create `src/controllers/settingsController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as settingsService from '../services/settingsService.js';

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  sendResponse(res, { status: 200, message: 'Settings retrieved', data: settings });
});

export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getPublicSettings();
  sendResponse(res, { status: 200, message: 'Settings retrieved', data: settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.file);
  sendResponse(res, { status: 200, message: 'Settings updated', data: settings });
});
```

- [ ] **Step 6: Create `src/routes/settingsRoutes.js`**

```js
import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { settingsSchema } from '../validators/settingsValidators.js';
import { uploadSettingsLogo } from '../middlewares/uploadSettingsLogo.js';

const router = Router();

router.get('/public', settingsController.getPublicSettings);
router.get('/', authenticate, authorize('admin', 'staff'), settingsController.getSettings);
router.put('/', authenticate, authorize('admin'), uploadSettingsLogo, validate(settingsSchema), settingsController.updateSettings);

export default router;
```

(`/public` registered before `/`, matching the established precedent, though there's no `:id` route here to shadow — kept for consistency across modules.)

- [ ] **Step 7: Modify `src/routes/index.js`** to mount the settings routes

Current content:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import testimonialRoutes from './testimonialRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);
router.use('/testimonials', testimonialRoutes);

export default router;
```

Replace with:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import testimonialRoutes from './testimonialRoutes.js';
import settingsRoutes from './settingsRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/settings', settingsRoutes);

export default router;
```

- [ ] **Step 8: Verify — full curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1

curl -s -c /tmp/set-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- default row already exists (from Task 8's migrate) ---"
curl -s -b /tmp/set-cookies.txt http://localhost:5000/api/settings

echo "--- update settings with social_links as a JSON string field ---"
curl -s -b /tmp/set-cookies.txt -X PUT http://localhost:5000/api/settings \
  -F "hospital_name=Daniel's Physiotherapy Hospital" \
  -F "phone=+91 98765 43210" \
  -F 'social_links={"instagram":"https://instagram.com/danielsphysio","facebook":"https://facebook.com/danielsphysio"}'

echo "--- public settings (no auth) reflects the update ---"
curl -s http://localhost:5000/api/settings/public | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('hospital_name:', r.data.hospital_name, 'instagram:', r.data.social_links.instagram)})"

STAFF_JWT=$(node --input-type=module -e "
import env from './src/config/env.js';
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ id: 999, role: 'staff' }, env.JWT_SECRET, { expiresIn: '1h' }));
" | tail -n1)

echo "--- staff CAN view settings (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" http://localhost:5000/api/settings -o /dev/null

echo "--- staff CANNOT update settings (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X PUT http://localhost:5000/api/settings -F "hospital_name=Should Fail"

echo "--- partial update: only phone changes, hospital_name untouched ---"
curl -s -b /tmp/set-cookies.txt -X PUT http://localhost:5000/api/settings -F "phone=+91 00000 00000"
curl -s -b /tmp/set-cookies.txt http://localhost:5000/api/settings | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('hospital_name still set:', r.data.hospital_name === \"Daniel's Physiotherapy Hospital\"); console.log('phone updated:', r.data.phone)})"

echo "--- cleanup: reset settings to blank ---"
curl -s -b /tmp/set-cookies.txt -X PUT http://localhost:5000/api/settings \
  -F "hospital_name=" -F "phone=" -F 'social_links={}' > /dev/null

kill %1
rm -f /tmp/set-cookies.txt
```

Expected (key checks): default row already exists (from Task 8's `npm run migrate`); update with a JSON-string `social_links` field succeeds and the public endpoint reflects it with `social_links` as a real nested object (`instagram` key readable directly, not a string); staff gets `200` on GET, `403` on PUT; a partial update (only `phone`) leaves `hospital_name` untouched.

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/settingsValidators.js backend/src/middlewares/uploadSettingsLogo.js backend/src/controllers/settingsController.js backend/src/routes/settingsRoutes.js backend/src/routes/index.js backend/src/uploads/settings/.gitkeep backend/.gitignore
git commit -m "Add hospital settings HTTP API: validators, logo upload, controller, routes"
```

---

### Task 10: Hospital Settings frontend — API layer, hook, form

**Files:**
- Create: `frontend/src/services/settingsService.js`
- Create: `frontend/src/hooks/useSettings.js`
- Create: `frontend/src/pages/admin/settings/SettingsForm.jsx`

**Interfaces:**
- Consumes: `api` from `frontend/src/services/api.js` (Phase 1); `getPhotoUrl` from `frontend/src/utils/photoUrl.js` (Phase 2).
- Produces: `getSettings()`, `updateSettings(formData)` named exports from `settingsService.js`. `useSettings()`, `useUpdateSettings()` named exports from `useSettings.js`. Default export `SettingsForm` — not yet wired into `App.jsx` (routing happens in Task 14). No list page and no separate create route — this module has one always-editable form bound directly to the singleton row.

- [ ] **Step 1: Create `src/services/settingsService.js`**

```js
import api from './api.js';

export async function getSettings() {
  const { data } = await api.get('/settings');
  return data.data;
}

export async function updateSettings(formData) {
  const { data } = await api.put('/settings', formData);
  return data.data;
}
```

- [ ] **Step 2: Create `src/hooks/useSettings.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as settingsService from '../services/settingsService.js';

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsService.getSettings });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
}
```

- [ ] **Step 3: Create `src/pages/admin/settings/SettingsForm.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';

export default function SettingsForm() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      hospital_name: '',
      address: '',
      phone: '',
      email: '',
      google_map_link: '',
      opening_hours: '',
      instagram: '',
      facebook: '',
      twitter: '',
    },
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (settings) {
      reset({
        hospital_name: settings.hospital_name ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        google_map_link: settings.google_map_link ?? '',
        opening_hours: settings.opening_hours ?? '',
        instagram: settings.social_links?.instagram ?? '',
        facebook: settings.social_links?.facebook ?? '',
        twitter: settings.social_links?.twitter ?? '',
      });
      setLogoPreview(getPhotoUrl(settings.logo_url));
    }
  }, [settings, reset]);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  async function onSubmit(values) {
    const formData = new FormData();
    formData.append('hospital_name', values.hospital_name);
    formData.append('address', values.address);
    formData.append('phone', values.phone);
    if (values.email) formData.append('email', values.email);
    formData.append('google_map_link', values.google_map_link);
    formData.append('opening_hours', values.opening_hours);
    formData.append(
      'social_links',
      JSON.stringify({
        instagram: values.instagram,
        facebook: values.facebook,
        twitter: values.twitter,
      })
    );
    if (logoFile) formData.append('logo', logoFile);

    try {
      await updateSettings.mutateAsync(formData);
      toast.success('Settings updated');
    } catch (err) {
      toast.error(err.message || 'Failed to save settings.');
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Hospital Settings</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hospital Name</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('hospital_name')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('address')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('phone')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('email', {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              })}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Google Map Link</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('google_map_link')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Opening Hours</label>
          <input
            type="text"
            placeholder="e.g. Mon-Sat: 9:00 AM - 7:00 PM"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('opening_hours')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Instagram</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('instagram')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Facebook</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('facebook')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Twitter</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('twitter')}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Logo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} />
          {logoPreview && (
            <img src={logoPreview} alt="Logo preview" className="mt-2 h-16 w-16 rounded object-cover" />
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 13).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/settingsService.js frontend/src/hooks/useSettings.js frontend/src/pages/admin/settings/SettingsForm.jsx
git commit -m "Add hospital settings frontend: API layer, hook, form"
```

---

### Task 11: Contact Messages repository + service

**Files:**
- Create: `backend/src/repositories/contactMessageRepository.js`
- Create: `backend/src/services/contactMessageService.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js` (Phase 1); `AppError` (default export) from `backend/src/utils/AppError.js` (Phase 1).
- Produces: named exports `findAll(filters)`, `findById(id)`, `create(message)`, `update(id, fields)`, `remove(id)` from `contactMessageRepository.js`. `filters` is `{ isRead? }` (optional); `create`'s `message` always has all 5 non-id, non-`created_at` columns present (`name, phone, email, message, is_read`); `update`'s `fields` is a partial object (used for the read/unread toggle).
- Produces: named exports `listMessages(filters)`, `getMessage(id)`, `createMessage(data)`, `markMessageRead(id, isRead)`, `deleteMessage(id)` from `contactMessageService.js`. `getMessage` throws `AppError('Message not found.', 404)` if missing. `createMessage(data)` always forces `is_read: false` on the created row, regardless of any `is_read` value present in `data` — mirroring Phase 3's status-forcing pattern for the other public unauthenticated write path in this app.

- [ ] **Step 1: Create `src/repositories/contactMessageRepository.js`**

```js
import pool from '../config/db.js';

export async function findAll(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.isRead !== undefined) {
    conditions.push('is_read = :isRead');
    params.isRead = filters.isRead;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM contact_messages ${whereClause} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM contact_messages WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(message) {
  const [result] = await pool.query(
    `INSERT INTO contact_messages (name, phone, email, message, is_read)
     VALUES (:name, :phone, :email, :message, :is_read)`,
    message
  );
  return result.insertId;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE contact_messages SET ${setClause} WHERE id = :id`, { ...fields, id });
}

export async function remove(id) {
  await pool.query('DELETE FROM contact_messages WHERE id = :id', { id });
}
```

- [ ] **Step 2: Create `src/services/contactMessageService.js`**

```js
import AppError from '../utils/AppError.js';
import * as contactMessageRepository from '../repositories/contactMessageRepository.js';

function toCreateRow(data) {
  return {
    name: data.name,
    phone: data.phone ?? null,
    email: data.email ?? null,
    message: data.message,
    is_read: false,
  };
}

export async function listMessages(filters) {
  return contactMessageRepository.findAll(filters);
}

export async function getMessage(id) {
  const message = await contactMessageRepository.findById(id);
  if (!message) {
    throw new AppError('Message not found.', 404);
  }
  return message;
}

export async function createMessage(data) {
  const message = toCreateRow(data);
  const id = await contactMessageRepository.create(message);
  return getMessage(id);
}

export async function markMessageRead(id, isRead) {
  await getMessage(id);
  await contactMessageRepository.update(id, { is_read: isRead });
  return getMessage(id);
}

export async function deleteMessage(id) {
  await getMessage(id);
  await contactMessageRepository.remove(id);
}
```

(`createMessage` builds its own row via `toCreateRow` — which hardcodes `is_read: false` — rather than spreading `data` directly, so a client that includes an `is_read` field in the public contact payload can never influence the stored value. Same structural defense as `appointmentService.createPublicAppointment` from Phase 3.)

- [ ] **Step 3: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-contact-message.mjs`:

```js
import * as contactMessageService from '../src/services/contactMessageService.js';
import pool from '../src/config/db.js';

async function main() {
  const created = await contactMessageService.createMessage({
    name: 'Service Verify Sender',
    phone: '9333333333',
    message: 'I would like to know more about your services.',
    is_read: true, // must be ignored/forced to false
  });
  console.log('created is_read (should be false):', created.is_read);
  console.log('created id:', created.id);

  const fetched = await contactMessageService.getMessage(created.id);
  console.log('fetched name:', fetched.name);

  const unreadList = await contactMessageService.listMessages({ isRead: false });
  console.log('unread filter includes new message:', unreadList.some((m) => m.id === created.id));

  const readList = await contactMessageService.listMessages({ isRead: true });
  console.log('read filter excludes new message:', !readList.some((m) => m.id === created.id));

  const marked = await contactMessageService.markMessageRead(created.id, true);
  console.log('marked is_read:', marked.is_read);

  await contactMessageService.deleteMessage(created.id);

  try {
    await contactMessageService.getMessage(created.id);
    console.log('ERROR: expected 404 after delete, but no error was thrown');
  } catch (err) {
    console.log('getMessage after delete threw as expected:', err.statusCode, err.message);
  }

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
node scripts/tmp-verify-contact-message.mjs
```

Expected output (MySQL returns `BOOLEAN` columns as `1`/`0` via mysql2, not JS `true`/`false`):
```
created is_read (should be false): 0
created id: <number>
fetched name: Service Verify Sender
unread filter includes new message: true
read filter excludes new message: true
marked is_read: 1
getMessage after delete threw as expected: 404 Message not found.
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-contact-message.mjs
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/repositories/contactMessageRepository.js backend/src/services/contactMessageService.js
git commit -m "Add contact message repository and service"
```

---

### Task 12: Contact Messages HTTP API — validators, rate limiter, controller, routes, wiring

**Files:**
- Create: `backend/src/validators/contactMessageValidators.js`
- Create: `backend/src/controllers/contactMessageController.js`
- Create: `backend/src/routes/contactMessageRoutes.js`
- Modify: `backend/src/middlewares/rateLimiters.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `listMessages, getMessage, createMessage, markMessageRead, deleteMessage` from `contactMessageService.js` (Task 11); `authenticate`, `authorize(...roles)`, `validate(schema)` from Phase 1's middlewares; `asyncHandler`, `sendResponse` from Phase 1's utils.
- Produces: `contactMessageSchema`, `markReadSchema` (zod schemas) from `contactMessageValidators.js`; `contactLimiter` (rate-limit middleware) from `rateLimiters.js`; `list, create, markRead, remove` (Express handlers) from `contactMessageController.js`; default-exported Express `Router` from `contactMessageRoutes.js`.
- **Note on URL shape:** unlike every other module in this phase, the public write endpoint lives at a genuinely different path (`POST /api/contact`) than the admin CRUD (`/api/contact-messages`), matching the design spec's route table exactly — there's no shared `/contact-messages/public` sub-route the way Doctors/Services/Testimonials have. `contactMessageRoutes.js` therefore only contains the 3 admin-facing routes (`GET /`, `PATCH /:id`, `DELETE /:id`, mounted at `/contact-messages`); the public `POST /contact` route is registered directly in `routes/index.js` instead of inside a router file, since it's the only route at that path.

- [ ] **Step 1: Create `src/validators/contactMessageValidators.js`**

```js
import { z } from 'zod';

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

- [ ] **Step 2: Modify `src/middlewares/rateLimiters.js`** to add a contact-form limiter

Current content:
```js
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.', errors: null },
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait a minute and try again.', errors: null },
});

export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking attempts. Please wait and try again.', errors: null },
});
```

Replace with:
```js
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.', errors: null },
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait a minute and try again.', errors: null },
});

export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking attempts. Please wait and try again.', errors: null },
});

export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent. Please wait and try again.', errors: null },
});
```

- [ ] **Step 3: Create `src/controllers/contactMessageController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as contactMessageService from '../services/contactMessageService.js';

export const list = asyncHandler(async (req, res) => {
  const { isRead } = req.query;
  const filters = {
    isRead: isRead === undefined ? undefined : isRead === 'true',
  };
  const messages = await contactMessageService.listMessages(filters);
  sendResponse(res, { status: 200, message: 'Messages retrieved', data: messages });
});

export const create = asyncHandler(async (req, res) => {
  const message = await contactMessageService.createMessage(req.body);
  sendResponse(res, { status: 201, message: 'Message sent', data: message });
});

export const markRead = asyncHandler(async (req, res) => {
  const message = await contactMessageService.markMessageRead(req.params.id, req.body.is_read);
  sendResponse(res, { status: 200, message: 'Message updated', data: message });
});

export const remove = asyncHandler(async (req, res) => {
  await contactMessageService.deleteMessage(req.params.id);
  sendResponse(res, { status: 200, message: 'Message deleted' });
});
```

- [ ] **Step 4: Create `src/routes/contactMessageRoutes.js`**

```js
import { Router } from 'express';
import * as contactMessageController from '../controllers/contactMessageController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { markReadSchema } from '../validators/contactMessageValidators.js';

const router = Router();

router.get('/', authenticate, authorize('admin', 'staff'), contactMessageController.list);
router.patch('/:id', authenticate, authorize('admin', 'staff'), validate(markReadSchema), contactMessageController.markRead);
router.delete('/:id', authenticate, authorize('admin'), contactMessageController.remove);

export default router;
```

- [ ] **Step 5: Modify `src/routes/index.js`** to add the public contact route and mount the admin router

Current content:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import testimonialRoutes from './testimonialRoutes.js';
import settingsRoutes from './settingsRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/settings', settingsRoutes);

export default router;
```

Replace with:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import staffRoutes from './staffRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import testimonialRoutes from './testimonialRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import contactMessageRoutes from './contactMessageRoutes.js';
import * as contactMessageController from '../controllers/contactMessageController.js';
import { validate } from '../middlewares/validate.js';
import { contactMessageSchema } from '../validators/contactMessageValidators.js';
import { contactLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/services', serviceRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/settings', settingsRoutes);
router.post('/contact', contactLimiter, validate(contactMessageSchema), contactMessageController.create);
router.use('/contact-messages', contactMessageRoutes);

export default router;
```

- [ ] **Step 6: Verify — full curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1

curl -s -c /tmp/cm-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- public contact submission, is_read forced to false even if client sends true ---"
SUBMIT_RESP=$(curl -s -X POST http://localhost:5000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Sender","phone":"9876543210","message":"I want to know more about your clinic.","is_read":true}')
echo "$SUBMIT_RESP"
MSG_ID=$(echo "$SUBMIT_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
echo "is_read forced false: $(echo "$SUBMIT_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.is_read === false))")"

echo "--- admin list includes new message ---"
curl -s -b /tmp/cm-cookies.txt http://localhost:5000/api/contact-messages | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$MSG_ID))})"

STAFF_JWT=$(node --input-type=module -e "
import env from './src/config/env.js';
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ id: 999, role: 'staff' }, env.JWT_SECRET, { expiresIn: '1h' }));
" | tail -n1)

echo "--- staff CAN list messages (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" http://localhost:5000/api/contact-messages -o /dev/null

echo "--- staff CAN mark read (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X PATCH "http://localhost:5000/api/contact-messages/$MSG_ID" \
  -H "Content-Type: application/json" -d '{"is_read":true}'

echo "--- staff CANNOT delete (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X DELETE "http://localhost:5000/api/contact-messages/$MSG_ID"

echo "--- admin CAN delete (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/cm-cookies.txt -X DELETE "http://localhost:5000/api/contact-messages/$MSG_ID"

echo "--- get after delete returns 404 ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/cm-cookies.txt "http://localhost:5000/api/contact-messages/$MSG_ID" -o /dev/null

echo "--- rate limit: contactLimiter max=5/15min; this script already made 1 request to /contact above ---"
echo "--- so of these next 6 requests, the first 4 succeed (bringing the total to 5) and the last 2 return 429 ---"
for i in 1 2 3 4 5 6; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/contact \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Rate Test $i\",\"message\":\"Rate limit test message body.\"}")
  echo "request $i: $STATUS"
done

kill %1
rm -f /tmp/cm-cookies.txt
```

Expected (key checks): public submission returns `201` with `is_read: false` despite the request sending `is_read: true`; admin list includes it; staff gets `200` on list, `200` on mark-read, `403` on delete; admin delete returns `200`; a subsequent GET returns `404`; the rate-limit loop prints `201` for requests 1-4 and `429` for requests 5-6.

- [ ] **Step 7: Commit**

```bash
git add backend/src/validators/contactMessageValidators.js backend/src/controllers/contactMessageController.js backend/src/routes/contactMessageRoutes.js backend/src/routes/index.js backend/src/middlewares/rateLimiters.js
git commit -m "Add contact message HTTP API: validators, rate limiter, controller, routes"
```

---

### Task 13: Contact Messages frontend — API layer, hook, list

**Files:**
- Create: `frontend/src/services/contactMessageService.js`
- Create: `frontend/src/hooks/useContactMessages.js`
- Create: `frontend/src/pages/admin/contact/ContactMessageList.jsx`

**Interfaces:**
- Consumes: `api` from `frontend/src/services/api.js` (Phase 1); `ConfirmDialog` from `frontend/src/components/ConfirmDialog.jsx` (Phase 2); `useAuth` from `frontend/src/contexts/AuthContext.jsx` (Phase 1).
- Produces: `listMessages(filters)`, `markMessageRead(id, isRead)`, `deleteMessage(id)` named exports from `contactMessageService.js`. `useContactMessages(filters)`, `useMarkMessageRead()`, `useDeleteMessage()` named exports from `useContactMessages.js` (`useMarkMessageRead()`'s mutation takes `{ id, isRead }`). Default export `ContactMessageList` — not yet wired into `App.jsx` (routing happens in Task 14). No form/create page — messages are only created via the public `/contact` endpoint (Phase 5b), never by an admin.

- [ ] **Step 1: Create `src/services/contactMessageService.js`**

```js
import api from './api.js';

export async function listMessages(filters = {}) {
  const { data } = await api.get('/contact-messages', { params: filters });
  return data.data;
}

export async function markMessageRead(id, isRead) {
  const { data } = await api.patch(`/contact-messages/${id}`, { is_read: isRead });
  return data.data;
}

export async function deleteMessage(id) {
  await api.delete(`/contact-messages/${id}`);
}
```

- [ ] **Step 2: Create `src/hooks/useContactMessages.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as contactMessageService from '../services/contactMessageService.js';

export function useContactMessages(filters = {}) {
  return useQuery({
    queryKey: ['contactMessages', filters],
    queryFn: () => contactMessageService.listMessages(filters),
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isRead }) => contactMessageService.markMessageRead(id, isRead),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactMessages'] }),
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contactMessageService.deleteMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactMessages'] }),
  });
}
```

- [ ] **Step 3: Create `src/pages/admin/contact/ContactMessageList.jsx`**

```jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useContactMessages, useMarkMessageRead, useDeleteMessage } from '../../../hooks/useContactMessages.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function ContactMessageList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: messages, isLoading } = useContactMessages();
  const markMessageRead = useMarkMessageRead();
  const deleteMessage = useDeleteMessage();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function toggleRead(message) {
    try {
      await markMessageRead.mutateAsync({ id: message.id, isRead: !message.is_read });
    } catch (err) {
      toast.error(err.message || 'Failed to update message.');
    }
  }

  async function confirmDelete() {
    try {
      await deleteMessage.mutateAsync(pendingDeleteId);
      toast.success('Message deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete message.');
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Contact Messages</h1>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messages?.map((message) => (
              <tr key={message.id} className={message.is_read ? '' : 'bg-blue-50/40'}>
                <td className="px-4 py-3 font-medium text-slate-800">{message.name}</td>
                <td className="px-4 py-3 text-slate-600">{message.phone || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{message.email || '-'}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{message.message}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(message.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      message.is_read ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {message.is_read ? 'Read' : 'Unread'}
                  </span>
                </td>
                <td className="space-x-3 px-4 py-3">
                  <button onClick={() => toggleRead(message)} className="text-blue-600 hover:underline">
                    {message.is_read ? 'Mark Unread' : 'Mark Read'}
                  </button>
                  {isAdmin && (
                    <button onClick={() => setPendingDeleteId(message.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {messages?.length === 0 && <p className="p-6 text-center text-slate-500">No messages yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Message"
        message="Are you sure you want to delete this message? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
```

(The read/unread toggle is available to both roles — matches the design's "staff can mark read/unread" decision. Delete is gated `isAdmin` UX-only, same pattern as every other list page; the real enforcement is the server-side `authorize('admin')` from Task 12.)

- [ ] **Step 4: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 14).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/contactMessageService.js frontend/src/hooks/useContactMessages.js frontend/src/pages/admin/contact/ContactMessageList.jsx
git commit -m "Add contact messages frontend: API layer, hook, list"
```

---

### Task 14: Wire up routing and admin nav — full walkthrough

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/AdminLayout.jsx`

**Interfaces:**
- Consumes: `ServiceList`/`ServiceForm` (Task 4), `TestimonialList`/`TestimonialForm` (Task 7), `SettingsForm` (Task 10), `ContactMessageList` (Task 13), `ProtectedRoute` (Phase 1, its existing `roles` prop).
- Produces: the complete Phase 5a route additions — `/admin/services`, `/admin/testimonials`, `/admin/messages` (any authenticated role); `/admin/services/new`, `/admin/services/:id/edit`, `/admin/testimonials/new`, `/admin/testimonials/:id/edit`, `/admin/settings` (admin only).

- [ ] **Step 1: Modify `src/App.jsx`**

Current content:
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import PublicBooking from './pages/PublicBooking.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import DoctorList from './pages/admin/doctors/DoctorList.jsx';
import DoctorForm from './pages/admin/doctors/DoctorForm.jsx';
import AppointmentList from './pages/admin/appointments/AppointmentList.jsx';
import StaffList from './pages/admin/staff/StaffList.jsx';
import StaffForm from './pages/admin/staff/StaffForm.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/book" element={<PublicBooking />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="doctors" element={<DoctorList />} />
          <Route path="appointments" element={<AppointmentList />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="doctors/new" element={<DoctorForm />} />
            <Route path="doctors/:id/edit" element={<DoctorForm />} />
            <Route path="staff" element={<StaffList />} />
            <Route path="staff/new" element={<StaffForm />} />
            <Route path="staff/:id/edit" element={<StaffForm />} />
          </Route>
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
import PublicBooking from './pages/PublicBooking.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import DoctorList from './pages/admin/doctors/DoctorList.jsx';
import DoctorForm from './pages/admin/doctors/DoctorForm.jsx';
import AppointmentList from './pages/admin/appointments/AppointmentList.jsx';
import StaffList from './pages/admin/staff/StaffList.jsx';
import StaffForm from './pages/admin/staff/StaffForm.jsx';
import ServiceList from './pages/admin/services/ServiceList.jsx';
import ServiceForm from './pages/admin/services/ServiceForm.jsx';
import TestimonialList from './pages/admin/testimonials/TestimonialList.jsx';
import TestimonialForm from './pages/admin/testimonials/TestimonialForm.jsx';
import SettingsForm from './pages/admin/settings/SettingsForm.jsx';
import ContactMessageList from './pages/admin/contact/ContactMessageList.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/book" element={<PublicBooking />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="doctors" element={<DoctorList />} />
          <Route path="appointments" element={<AppointmentList />} />
          <Route path="services" element={<ServiceList />} />
          <Route path="testimonials" element={<TestimonialList />} />
          <Route path="messages" element={<ContactMessageList />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="doctors/new" element={<DoctorForm />} />
            <Route path="doctors/:id/edit" element={<DoctorForm />} />
            <Route path="staff" element={<StaffList />} />
            <Route path="staff/new" element={<StaffForm />} />
            <Route path="staff/:id/edit" element={<StaffForm />} />
            <Route path="services/new" element={<ServiceForm />} />
            <Route path="services/:id/edit" element={<ServiceForm />} />
            <Route path="testimonials/new" element={<TestimonialForm />} />
            <Route path="testimonials/:id/edit" element={<TestimonialForm />} />
            <Route path="settings" element={<SettingsForm />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

(`services`, `testimonials`, `messages` join the outer any-authenticated-role tier alongside `doctors`/`appointments` — staff can view all three. `services/new`, `services/:id/edit`, `testimonials/new`, `testimonials/:id/edit`, `settings` join the existing admin-only nested tier alongside `doctors/new`/`staff` — matches the design's RBAC table exactly.)

- [ ] **Step 2: Modify `src/layouts/AdminLayout.jsx`** to add the four new nav links

Current content:
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
            <NavLink to="/admin/appointments" className={navLinkClass}>
              Appointments
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin/staff" className={navLinkClass}>
                Staff
              </NavLink>
            )}
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

Replace the `<nav>` block with:
```jsx
          <nav className="space-y-1">
            <NavLink to="/admin" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/doctors" className={navLinkClass}>
              Doctors
            </NavLink>
            <NavLink to="/admin/appointments" className={navLinkClass}>
              Appointments
            </NavLink>
            <NavLink to="/admin/services" className={navLinkClass}>
              Services
            </NavLink>
            <NavLink to="/admin/testimonials" className={navLinkClass}>
              Testimonials
            </NavLink>
            <NavLink to="/admin/messages" className={navLinkClass}>
              Messages
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin/staff" className={navLinkClass}>
                Staff
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin/settings" className={navLinkClass}>
                Settings
              </NavLink>
            )}
          </nav>
```

(`Services`, `Testimonials`, `Messages` are unconditional, matching Doctors/Appointments — staff has view access. `Settings` is wrapped in the same `user?.role === 'admin'` guard as `Staff`, since the route itself is admin-only.)

- [ ] **Step 3: Automated smoke check — both servers up, one route per RBAC tier reachable**

```bash
cd backend && npm start &
sleep 1
cd ../frontend && npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin/services
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin/testimonials
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin/messages
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin/settings
kill %1 %2
```
Expected: all four print `200` (Vite serves the SPA shell for any path — actual auth/routing behavior is client-side, verified in Step 4).

- [ ] **Step 4: Live browser walkthrough**

With both `npm run dev` (frontend) and `npm start` (backend) running against the real Docker MySQL database, logged in as admin unless noted:

1. **Services:** open `/admin/services`, click "Add Service", fill name/description/display_order, upload a photo, submit → appears in the list with a thumbnail. Edit it (change the name, leave the photo untouched) → list reflects the new name, thumbnail unchanged. Delete it → removed from the list.
2. **Testimonials:** same create/edit/delete cycle at `/admin/testimonials`, including the rating select and an optional photo.
3. **Hospital Settings:** open `/admin/settings`, fill in hospital name/address/phone/social links, upload a logo, save → reload the page, confirm every field (including the parsed `social_links` object's `instagram`/`facebook`/`twitter` values) persisted correctly.
4. **Contact Messages:** open `/book` in a new tab (or any public page) is not required here — submit a message directly via `curl -X POST http://localhost:5000/api/contact -H "Content-Type: application/json" -d '{"name":"Walkthrough Sender","message":"Testing the inbox end to end."}'`, then reload `/admin/messages` in the browser and confirm it appears with an "Unread" badge. Click "Mark Read" → badge flips to "Read". Delete it → removed from the list.
5. **Staff RBAC across all four new modules:** log out, log in as a staff account (create a temporary fixture via SQL + bcrypt if none exists, matching the pattern from Phases 2-4 — delete it after the walkthrough), confirm: `/admin/services`, `/admin/testimonials`, `/admin/messages` are all visible with no Add/Edit/Delete buttons except the Mark Read/Unread toggle on messages; direct navigation to `/admin/services/new`, `/admin/testimonials/new`, or `/admin/settings` redirects away (admin-only guard); `/admin/settings` and the "Settings" nav link are not visible at all.
6. **Regression check — shared upload middleware refactor (Task 1):** log back in as admin, create a doctor with a photo at `/admin/doctors/new` one more time, confirm the photo uploads and displays correctly exactly as it did before this phase's `upload.js` extraction — proves the Task 1 refactor introduced no regression in already-shipped functionality.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/layouts/AdminLayout.jsx
git commit -m "Wire up services, testimonials, settings, and contact message routes and admin nav"
```
