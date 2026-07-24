# Phase 3: Appointment Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public unauthenticated booking flow (`POST /api/appointments/public` + a standalone `/book` page) and an admin/staff appointment management module (list with filters, inline status changes, an edit modal, admin-only delete) — built on Phase 1's existing `appointments` table and Phase 2's doctor module.

**Architecture:** Same layered backend as Phases 1-2 (`routes → middlewares → controllers → services → repositories → mysql2`). One combined `PATCH /:id` handles both status changes and full edits, since admin and staff share the same write permission on this resource. Frontend adds a standalone public page outside the authenticated shell, plus an admin list page with a filter bar and an edit modal (not a routed page), reusing `AdminLayout`, `ProtectedRoute`, and `ConfirmDialog` from Phases 1-2.

**Tech Stack:** Same as Phases 1-2 — Express, mysql2, zod, express-rate-limit (already installed, extended with a new limiter); React 19, React Hook Form, TanStack Query, react-hot-toast.

**Testing approach:** No automated test suite, per Phase 1's established decision (`docs/superpowers/specs/2026-07-24-phase1-setup-auth-design.md`, §8). Every task ends with manual verification: standalone Node scripts against the real DB for the repository/service layers, curl for the HTTP layer, and a live browser walkthrough for the frontend capstone.

## Global Constraints

- Layered architecture: Controller → Service → Repository → MySQL. No ORM. All SQL parameterized via `mysql2` named placeholders.
- No microservices, event buses, or CQRS.
- No DB schema changes — the `appointments` table already exists from Phase 1's `schema.sql`.
- Role rules: admin and staff can both list, view, and `PATCH` (status change or full edit) appointments. Only admin can `DELETE`. Public (no auth) can only `POST /api/appointments/public`.
- `POST /api/appointments/public` always forces `status = 'pending'` server-side, regardless of any `status` value in the request body.
- No double-booking prevention — a new booking is never rejected for colliding with an existing doctor/date/time.
- Public booking requests are rate-limited: 5 requests per 15 minutes per IP, on top of the existing global `apiLimiter` (300/15min).
- `appointment_date` on public booking must be today or later (server-validated).
- Consistent JSON envelope on every response: `{success, message, data}` / `{success, message, errors}` — reuse Phase 1's `sendResponse`, `AppError`, `errorHandler`.

---

### Task 1: Appointment repository

**Files:**
- Create: `backend/src/repositories/appointmentRepository.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js` (Phase 1).
- Produces: named exports `findAll(filters)`, `findById(id)`, `create(appointment)`, `update(id, fields)`, `remove(id)`.
  - `filters` is `{ status?, doctorId?, date? }` — any subset, all optional. Only provided keys are turned into `WHERE` conditions.
  - `appointment` (for `create`) always has all 9 non-id, non-timestamp columns present: `patient_name, mobile, email, gender, age, doctor_id, appointment_date, appointment_time, problem_description, status` — the service layer (Task 2) is responsible for filling `null` for missing optional fields; this repository applies no defaults.
  - `fields` (for `update`) is a partial object — only the keys present are written to `SET`. Callers must only pass keys that are real `appointments` columns (enforced upstream by the Task 3 validator, not by this repository).
  - `create` resolves to the new row's numeric `id`. `findById`/`findAll` resolve to full row objects (or `null` for a missing `findById`).

- [ ] **Step 1: Create `src/repositories/appointmentRepository.js`**

```js
import pool from '../config/db.js';

export async function findAll(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.status) {
    conditions.push('status = :status');
    params.status = filters.status;
  }
  if (filters.doctorId) {
    conditions.push('doctor_id = :doctorId');
    params.doctorId = filters.doctorId;
  }
  if (filters.date) {
    conditions.push('appointment_date = :date');
    params.date = filters.date;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM appointments ${whereClause} ORDER BY appointment_date DESC, appointment_time DESC`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM appointments WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(appointment) {
  const [result] = await pool.query(
    `INSERT INTO appointments
      (patient_name, mobile, email, gender, age, doctor_id, appointment_date, appointment_time, problem_description, status)
     VALUES
      (:patient_name, :mobile, :email, :gender, :age, :doctor_id, :appointment_date, :appointment_time, :problem_description, :status)`,
    appointment
  );
  return result.insertId;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE appointments SET ${setClause} WHERE id = :id`, { ...fields, id });
}

export async function remove(id) {
  await pool.query('DELETE FROM appointments WHERE id = :id', { id });
}
```

- [ ] **Step 2: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-appointment-repo.mjs`:

```js
import * as appointmentRepository from '../src/repositories/appointmentRepository.js';
import * as doctorRepository from '../src/repositories/doctorRepository.js';
import pool from '../src/config/db.js';

async function main() {
  const doctorId = await doctorRepository.create({
    name: 'Verify Fixture Doctor',
    qualification: null,
    specialization: null,
    experience_years: null,
    photo_url: null,
    consultation_fee: null,
    working_days: null,
    available_time: null,
    active: true,
  });
  console.log('fixture doctor id:', doctorId);

  const appt1 = {
    patient_name: 'Verify Patient One',
    mobile: '9000000001',
    email: null,
    gender: null,
    age: null,
    doctor_id: doctorId,
    appointment_date: '2026-08-15',
    appointment_time: '10:00 AM',
    problem_description: null,
    status: 'pending',
  };
  const appt2 = {
    patient_name: 'Verify Patient Two',
    mobile: '9000000002',
    email: null,
    gender: null,
    age: null,
    doctor_id: null,
    appointment_date: '2026-08-16',
    appointment_time: '2:00 PM',
    problem_description: null,
    status: 'approved',
  };

  const id1 = await appointmentRepository.create(appt1);
  const id2 = await appointmentRepository.create(appt2);
  console.log('created ids:', id1, id2);

  const fetched1 = await appointmentRepository.findById(id1);
  console.log('fetched1 patient_name:', fetched1.patient_name, 'status:', fetched1.status);

  const all = await appointmentRepository.findAll({});
  console.log('findAll includes both:', all.some((a) => a.id === id1) && all.some((a) => a.id === id2));

  const byStatus = await appointmentRepository.findAll({ status: 'pending' });
  console.log(
    'filter by status=pending includes id1 only:',
    byStatus.some((a) => a.id === id1) && !byStatus.some((a) => a.id === id2)
  );

  const byDoctor = await appointmentRepository.findAll({ doctorId });
  console.log(
    'filter by doctorId includes id1 only:',
    byDoctor.some((a) => a.id === id1) && !byDoctor.some((a) => a.id === id2)
  );

  const byDate = await appointmentRepository.findAll({ date: '2026-08-16' });
  console.log(
    'filter by date includes id2 only:',
    byDate.some((a) => a.id === id2) && !byDate.some((a) => a.id === id1)
  );

  await appointmentRepository.update(id1, { status: 'completed', patient_name: 'Verify Patient One Updated' });
  const updated1 = await appointmentRepository.findById(id1);
  console.log('updated1 status:', updated1.status, 'patient_name:', updated1.patient_name);

  await appointmentRepository.remove(id1);
  await appointmentRepository.remove(id2);
  const afterDelete1 = await appointmentRepository.findById(id1);
  console.log('after delete, findById returns:', afterDelete1);

  await doctorRepository.remove(doctorId);
  console.log('fixture doctor removed');

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
node scripts/tmp-verify-appointment-repo.mjs
```

Expected output:
```
fixture doctor id: <number>
created ids: <number> <number>
fetched1 patient_name: Verify Patient One status: pending
findAll includes both: true
filter by status=pending includes id1 only: true
filter by doctorId includes id1 only: true
filter by date includes id2 only: true
updated1 status: completed patient_name: Verify Patient One Updated
after delete, findById returns: null
fixture doctor removed
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-appointment-repo.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/appointmentRepository.js
git commit -m "Add appointment repository"
```

---

### Task 2: Appointment service

**Files:**
- Create: `backend/src/services/appointmentService.js`

**Interfaces:**
- Consumes: `findAll, findById, create, update, remove` from `appointmentRepository.js` (Task 1); `AppError` (default export) from `backend/src/utils/AppError.js` (Phase 1).
- Produces: named exports `listAppointments(filters)`, `getAppointment(id)`, `createPublicAppointment(data)`, `updateAppointment(id, data)`, `deleteAppointment(id)`.
  - `getAppointment` throws `AppError('Appointment not found.', 404)` if missing.
  - `createPublicAppointment(data)` builds the insert row from `data` (a plain object of the validated public-booking fields), filling `null` for any missing optional field, and **always** sets `status: 'pending'` regardless of any `status` key present in `data`.
  - `updateAppointment(id, data)` fetches the existing appointment first (404 if missing), passes `data` straight through to `appointmentRepository.update` (it is already a partial-fields object — no defaulting), then returns the refreshed row.
  - `deleteAppointment(id)` fetches the appointment first (404 if missing), then removes it.

- [ ] **Step 1: Create `src/services/appointmentService.js`**

```js
import AppError from '../utils/AppError.js';
import * as appointmentRepository from '../repositories/appointmentRepository.js';

function toCreateRow(data) {
  return {
    patient_name: data.patient_name,
    mobile: data.mobile,
    email: data.email ?? null,
    gender: data.gender ?? null,
    age: data.age ?? null,
    doctor_id: data.doctor_id ?? null,
    appointment_date: data.appointment_date,
    appointment_time: data.appointment_time,
    problem_description: data.problem_description ?? null,
    status: 'pending',
  };
}

export async function listAppointments(filters) {
  return appointmentRepository.findAll(filters);
}

export async function getAppointment(id) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404);
  }
  return appointment;
}

export async function createPublicAppointment(data) {
  const appointment = toCreateRow(data);
  const id = await appointmentRepository.create(appointment);
  return getAppointment(id);
}

export async function updateAppointment(id, data) {
  await getAppointment(id);
  await appointmentRepository.update(id, data);
  return getAppointment(id);
}

export async function deleteAppointment(id) {
  await getAppointment(id);
  await appointmentRepository.remove(id);
}
```

(`createPublicAppointment` builds its own row via `toCreateRow` — which hardcodes `status: 'pending'` — rather than spreading `data` directly, so a client that includes a `status` field in the public booking payload can never influence the stored status.)

- [ ] **Step 2: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-appointment-service.mjs`:

```js
import * as appointmentService from '../src/services/appointmentService.js';
import pool from '../src/config/db.js';

async function main() {
  const created = await appointmentService.createPublicAppointment({
    patient_name: 'Service Verify Patient',
    mobile: '9111111111',
    appointment_date: '2026-08-20',
    appointment_time: '9:00 AM',
    status: 'approved', // must be ignored/forced to pending
  });
  console.log('created status (should be pending):', created.status);
  console.log('created id:', created.id);

  const fetched = await appointmentService.getAppointment(created.id);
  console.log('fetched patient_name:', fetched.patient_name);

  const updated = await appointmentService.updateAppointment(created.id, { status: 'approved' });
  console.log('updated status:', updated.status, 'patient_name unchanged:', updated.patient_name === 'Service Verify Patient');

  await appointmentService.deleteAppointment(created.id);

  try {
    await appointmentService.getAppointment(created.id);
    console.log('ERROR: expected 404 after delete, but no error was thrown');
  } catch (err) {
    console.log('getAppointment after delete threw as expected:', err.statusCode, err.message);
  }

  try {
    await appointmentService.getAppointment(999999);
    console.log('ERROR: expected 404 for missing id, but no error was thrown');
  } catch (err) {
    console.log('getAppointment for missing id threw as expected:', err.statusCode, err.message);
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
node scripts/tmp-verify-appointment-service.mjs
```

Expected output:
```
created status (should be pending): pending
created id: <number>
fetched patient_name: Service Verify Patient
updated status: approved patient_name unchanged: true
getAppointment after delete threw as expected: 404 Appointment not found.
getAppointment for missing id threw as expected: 404 Appointment not found.
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-appointment-service.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/appointmentService.js
git commit -m "Add appointment service"
```

---

### Task 3: Appointment HTTP API — validators, rate limiter, controller, routes, wiring

**Files:**
- Create: `backend/src/validators/appointmentValidators.js`
- Create: `backend/src/controllers/appointmentController.js`
- Create: `backend/src/routes/appointmentRoutes.js`
- Modify: `backend/src/middlewares/rateLimiters.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `listAppointments, getAppointment, createPublicAppointment, updateAppointment, deleteAppointment` from `appointmentService.js` (Task 2); `authenticate`, `authorize(...roles)`, `validate(schema)` from Phase 1's middlewares; `asyncHandler`, `sendResponse` from Phase 1's utils.
- Produces: `publicBookingSchema`, `appointmentUpdateSchema` (zod schemas) from `appointmentValidators.js`; `bookingLimiter` (rate-limit middleware) from `rateLimiters.js`; `list, getOne, createPublic, update, remove` (Express handlers) from `appointmentController.js`; default-exported Express `Router` from `appointmentRoutes.js` mounted at `/appointments`.

- [ ] **Step 1: Create `src/validators/appointmentValidators.js`**

```js
import { z } from 'zod';

export const publicBookingSchema = z.object({
  patient_name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().min(7, 'Enter a valid mobile number'),
  email: z.string().email().optional(),
  gender: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  doctor_id: z.coerce.number().int().optional(),
  appointment_date: z.string().refine((val) => {
    if (Number.isNaN(Date.parse(val))) return false;
    const today = new Date().toISOString().slice(0, 10);
    return val >= today;
  }, 'Appointment date must be today or later.'),
  appointment_time: z.string().min(1, 'Appointment time is required'),
  problem_description: z.string().optional(),
});

export const appointmentUpdateSchema = z.object({
  patient_name: z.string().min(2).optional(),
  mobile: z.string().min(7).optional(),
  email: z.string().email().optional(),
  gender: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  doctor_id: z.coerce.number().int().optional(),
  appointment_date: z.string().optional(),
  appointment_time: z.string().optional(),
  problem_description: z.string().optional(),
  status: z.enum(['pending', 'approved', 'cancelled', 'completed']).optional(),
});
```

(`doctor_id` has no `.nullable()` in either schema — a request simply omits the field to leave it unset/unchanged. The frontend, built in Tasks 5-6, never sends `doctor_id: null`; it omits the key entirely when no doctor is selected, matching this contract.)

- [ ] **Step 2: Modify `src/middlewares/rateLimiters.js`** to add a public-booking limiter

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
```

- [ ] **Step 3: Create `src/controllers/appointmentController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as appointmentService from '../services/appointmentService.js';

export const list = asyncHandler(async (req, res) => {
  const { status, doctorId, date } = req.query;
  const filters = {
    status: status || undefined,
    doctorId: doctorId ? Number(doctorId) : undefined,
    date: date || undefined,
  };
  const appointments = await appointmentService.listAppointments(filters);
  sendResponse(res, { status: 200, message: 'Appointments retrieved', data: appointments });
});

export const getOne = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.getAppointment(req.params.id);
  sendResponse(res, { status: 200, message: 'Appointment retrieved', data: appointment });
});

export const createPublic = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.createPublicAppointment(req.body);
  sendResponse(res, { status: 201, message: 'Appointment booked', data: appointment });
});

export const update = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateAppointment(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Appointment updated', data: appointment });
});

export const remove = asyncHandler(async (req, res) => {
  await appointmentService.deleteAppointment(req.params.id);
  sendResponse(res, { status: 200, message: 'Appointment deleted' });
});
```

- [ ] **Step 4: Create `src/routes/appointmentRoutes.js`**

```js
import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { publicBookingSchema, appointmentUpdateSchema } from '../validators/appointmentValidators.js';
import { bookingLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/public', bookingLimiter, validate(publicBookingSchema), appointmentController.createPublic);
router.get('/', authenticate, authorize('admin', 'staff'), appointmentController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), appointmentController.getOne);
router.patch('/:id', authenticate, authorize('admin', 'staff'), validate(appointmentUpdateSchema), appointmentController.update);
router.delete('/:id', authenticate, authorize('admin'), appointmentController.remove);

export default router;
```

(`/public` is registered before `/:id` so it isn't shadowed by the param route, matching Phase 2's `/doctors/public` precedent.)

- [ ] **Step 5: Modify `src/routes/index.js`** to mount the appointment routes

Current content:
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

Replace with:
```js
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
```

- [ ] **Step 6: Verify — full curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1
curl -s http://localhost:5000/api/health

# Login as admin (use your real ADMIN_USERNAME/ADMIN_PASSWORD from backend/.env if different)
curl -s -c /tmp/appt-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- public booking succeeds, status forced to pending even if client sends another value ---"
BOOK_RESP=$(curl -s -X POST http://localhost:5000/api/appointments/public \
  -H "Content-Type: application/json" \
  -d '{"patient_name":"Test Patient","mobile":"9876543210","appointment_date":"2026-08-01","appointment_time":"10:00 AM","status":"approved"}')
echo "$BOOK_RESP"
APPT_ID=$(echo "$BOOK_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
echo "APPT_ID=$APPT_ID"
echo "status forced to pending: $(echo "$BOOK_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.status === 'pending'))")"

echo "--- booking with a past date is rejected (400) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:5000/api/appointments/public \
  -H "Content-Type: application/json" \
  -d '{"patient_name":"Test Patient","mobile":"9876543210","appointment_date":"2020-01-01","appointment_time":"10:00 AM"}'

echo "--- list as admin includes new appointment ---"
curl -s -b /tmp/appt-cookies.txt http://localhost:5000/api/appointments | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$APPT_ID))})"

echo "--- filter by status=pending includes it, status=completed excludes it ---"
curl -s -b /tmp/appt-cookies.txt "http://localhost:5000/api/appointments?status=pending" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found in pending:', r.data.some(x=>x.id==$APPT_ID))})"
curl -s -b /tmp/appt-cookies.txt "http://localhost:5000/api/appointments?status=completed" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found in completed:', r.data.some(x=>x.id==$APPT_ID))})"

# Craft a staff-role JWT directly (no staff DB user exists until Phase 4)
STAFF_JWT=$(node --input-type=module -e "
import env from './src/config/env.js';
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ id: 999, role: 'staff' }, env.JWT_SECRET, { expiresIn: '1h' }));
")

echo "--- staff CAN list appointments (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" http://localhost:5000/api/appointments -o /dev/null

echo "--- staff CAN update status (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X PATCH "http://localhost:5000/api/appointments/$APPT_ID" \
  -H "Content-Type: application/json" -d '{"status":"approved"}'

echo "--- staff CAN edit full details, partial update leaves status untouched (200) ---"
curl -s -b "token=$STAFF_JWT" -X PATCH "http://localhost:5000/api/appointments/$APPT_ID" \
  -H "Content-Type: application/json" -d '{"patient_name":"Updated By Staff"}'

echo "--- staff CANNOT delete (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X DELETE "http://localhost:5000/api/appointments/$APPT_ID"

echo "--- admin CAN delete (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/appt-cookies.txt -X DELETE "http://localhost:5000/api/appointments/$APPT_ID"

echo "--- get after delete returns 404 ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/appt-cookies.txt "http://localhost:5000/api/appointments/$APPT_ID" -o /dev/null

echo "--- rate limit: bookingLimiter max=5/15min; this script has already made 2 requests to /public above (1 success + 1 past-date-reject) ---"
echo "--- so of these next 6 requests, the first 3 succeed (bringing the total to 5) and the last 3 return 429 ---"
for i in 1 2 3 4 5 6; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/appointments/public \
    -H "Content-Type: application/json" \
    -d "{\"patient_name\":\"Rate Test $i\",\"mobile\":\"9876543210\",\"appointment_date\":\"2026-08-01\",\"appointment_time\":\"11:00 AM\"}")
  echo "request $i: $STATUS"
done

kill %1
rm -f /tmp/appt-cookies.txt
```

Expected (key checks): health `200`; public booking returns `201` with `status: pending` even though the request body sent `status: approved`; past-date booking returns `400`; admin list/filter-by-status both work correctly; staff JWT gets `200` on list, `200` on status PATCH, `200` on full-edit PATCH, `403` on DELETE; admin DELETE returns `200`; a subsequent GET on the deleted id returns `404`; the rate-limit loop prints `201` (or `400`, irrelevant to the counter) for requests 1-3 and `429` for requests 4-6.

- [ ] **Step 7: Commit**

```bash
git add backend/src/validators/appointmentValidators.js backend/src/controllers/appointmentController.js backend/src/routes/appointmentRoutes.js backend/src/routes/index.js backend/src/middlewares/rateLimiters.js
git commit -m "Add appointment HTTP API: validators, rate limiter, controller, routes"
```

---

### Task 4: Frontend appointment API layer and hooks

**Files:**
- Create: `frontend/src/services/appointmentService.js`
- Create: `frontend/src/hooks/useAppointments.js`

**Interfaces:**
- Consumes: `api` (default export) from `frontend/src/services/api.js` (Phase 1).
- Produces: `listAppointments(filters)`, `getAppointment(id)`, `bookAppointmentPublic(payload)`, `updateAppointment(id, payload)`, `deleteAppointment(id)` named exports from `appointmentService.js`.
- Produces: `useAppointments(filters)`, `useAppointment(id)`, `useBookAppointment()`, `useUpdateAppointment()`, `useDeleteAppointment()` named exports from `useAppointments.js` (React Query hooks). `useUpdateAppointment()`'s mutation function takes `{ id, payload }`. `useUpdateAppointment`/`useDeleteAppointment` invalidate the `['appointments']` query key on success; `useBookAppointment` does not (the public booking page has no appointments list to refresh).

- [ ] **Step 1: Create `src/services/appointmentService.js`**

```js
import api from './api.js';

export async function listAppointments(filters = {}) {
  const { data } = await api.get('/appointments', { params: filters });
  return data.data;
}

export async function getAppointment(id) {
  const { data } = await api.get(`/appointments/${id}`);
  return data.data;
}

export async function bookAppointmentPublic(payload) {
  const { data } = await api.post('/appointments/public', payload);
  return data.data;
}

export async function updateAppointment(id, payload) {
  const { data } = await api.patch(`/appointments/${id}`, payload);
  return data.data;
}

export async function deleteAppointment(id) {
  await api.delete(`/appointments/${id}`);
}
```

(Axios drops `null`/`undefined`-valued keys from `params` automatically, so `listAppointments({ status: undefined, doctorId: undefined, date: undefined })` sends a plain `GET /appointments` with no query string — safe to call with a filter object that has some or all keys unset.)

- [ ] **Step 2: Create `src/hooks/useAppointments.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as appointmentService from '../services/appointmentService.js';

export function useAppointments(filters = {}) {
  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: () => appointmentService.listAppointments(filters),
  });
}

export function useAppointment(id) {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: () => appointmentService.getAppointment(id),
    enabled: Boolean(id),
  });
}

export function useBookAppointment() {
  return useMutation({ mutationFn: appointmentService.bookAppointmentPublic });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => appointmentService.updateAppointment(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appointmentService.deleteAppointment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (these modules aren't wired into any page yet — this only proves imports resolve and there's no syntax error; end-to-end behavior is verified in Task 7).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/appointmentService.js frontend/src/hooks/useAppointments.js
git commit -m "Add frontend appointment API layer and React Query hooks"
```

---

### Task 5: Public booking page

**Files:**
- Modify: `frontend/src/services/doctorService.js`
- Modify: `frontend/src/hooks/useDoctors.js`
- Create: `frontend/src/pages/PublicBooking.jsx`

**Interfaces:**
- Consumes: `useBookAppointment` from `hooks/useAppointments.js` (Task 4); `api` (default export) from `services/api.js` (Phase 1).
- Produces: `listPublicDoctors()` named export added to `doctorService.js` (calls the existing `GET /doctors/public` endpoint from Phase 2 — unauthenticated). Produces `usePublicDoctors()` named export added to `useDoctors.js`. Produces default export `PublicBooking` from `PublicBooking.jsx` — not yet wired into `App.jsx` (routing happens in Task 7).

- [ ] **Step 1: Modify `src/services/doctorService.js`** to add a public-doctors call

Current content:
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

Replace with:
```js
import api from './api.js';

export async function listDoctors() {
  const { data } = await api.get('/doctors');
  return data.data;
}

export async function listPublicDoctors() {
  const { data } = await api.get('/doctors/public');
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

- [ ] **Step 2: Modify `src/hooks/useDoctors.js`** to add a public-doctors hook

Current content:
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as doctorService from '../services/doctorService.js';

export function useDoctors() {
  return useQuery({ queryKey: ['doctors'], queryFn: doctorService.listDoctors });
}
```
(rest of file unchanged)

Add this export directly below `useDoctors`:
```js
export function usePublicDoctors() {
  return useQuery({ queryKey: ['doctors', 'public'], queryFn: doctorService.listPublicDoctors });
}
```

The full resulting file:
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as doctorService from '../services/doctorService.js';

export function useDoctors() {
  return useQuery({ queryKey: ['doctors'], queryFn: doctorService.listDoctors });
}

export function usePublicDoctors() {
  return useQuery({ queryKey: ['doctors', 'public'], queryFn: doctorService.listPublicDoctors });
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

- [ ] **Step 3: Create `src/pages/PublicBooking.jsx`**

```jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { usePublicDoctors } from '../hooks/useDoctors.js';
import { useBookAppointment } from '../hooks/useAppointments.js';

function formatTime12Hour(time24) {
  const [hoursStr, minutes] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

const today = new Date().toISOString().slice(0, 10);

export default function PublicBooking() {
  const { data: doctors } = usePublicDoctors();
  const bookAppointment = useBookAppointment();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      patient_name: '',
      mobile: '',
      email: '',
      gender: '',
      age: '',
      doctor_id: '',
      appointment_date: today,
      appointment_time: '',
      problem_description: '',
    },
  });

  async function onSubmit(values) {
    const payload = {
      patient_name: values.patient_name,
      mobile: values.mobile,
      appointment_date: values.appointment_date,
      appointment_time: formatTime12Hour(values.appointment_time),
    };
    if (values.email) payload.email = values.email;
    if (values.gender) payload.gender = values.gender;
    if (values.age !== '') payload.age = values.age;
    if (values.doctor_id) payload.doctor_id = values.doctor_id;
    if (values.problem_description) payload.problem_description = values.problem_description;

    try {
      await bookAppointment.mutateAsync(payload);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Failed to book appointment.');
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
          <h1 className="mb-2 text-2xl font-semibold text-blue-700">Appointment Requested</h1>
          <p className="text-slate-600">
            Thank you! We've received your request and will contact you shortly to confirm.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-semibold text-blue-700">Book an Appointment</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('patient_name', {
                required: 'Name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
              })}
            />
            {errors.patient_name && <p className="mt-1 text-sm text-red-600">{errors.patient_name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mobile Number</label>
            <input
              type="tel"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('mobile', {
                required: 'Mobile number is required',
                minLength: { value: 7, message: 'Enter a valid mobile number' },
              })}
            />
            {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label>
              <input
                type="email"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('email')}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Age (optional)</label>
              <input
                type="number"
                min="0"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('age')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Gender (optional)</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('gender')}
            >
              <option value="">Prefer not to say</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Doctor</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('doctor_id')}
            >
              <option value="">General Inquiry / Not sure</option>
              {doctors?.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} ({doctor.specialization || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Date</label>
              <input
                type="date"
                min={today}
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('appointment_date', { required: 'Date is required' })}
              />
              {errors.appointment_date && (
                <p className="mt-1 text-sm text-red-600">{errors.appointment_date.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Time</label>
              <input
                type="time"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('appointment_time', { required: 'Time is required' })}
              />
              {errors.appointment_time && (
                <p className="mt-1 text-sm text-red-600">{errors.appointment_time.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Problem Description (optional)</label>
            <textarea
              rows="3"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('problem_description')}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Booking...' : 'Book Appointment'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 7).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/doctorService.js frontend/src/hooks/useDoctors.js frontend/src/pages/PublicBooking.jsx
git commit -m "Add public appointment booking page"
```

---

### Task 6: Admin appointment list and edit modal

**Files:**
- Create: `frontend/src/pages/admin/appointments/AppointmentList.jsx`
- Create: `frontend/src/pages/admin/appointments/AppointmentEditModal.jsx`

**Interfaces:**
- Consumes: `useAppointments, useUpdateAppointment, useDeleteAppointment` from `hooks/useAppointments.js` (Task 4); `useDoctors` from `hooks/useDoctors.js` (Phase 2 — the full authenticated list, used here rather than `usePublicDoctors` so inactive doctors referenced by existing appointments still display a name); `useAuth` from `contexts/AuthContext.jsx` (Phase 1); `ConfirmDialog` from `components/ConfirmDialog.jsx` (Phase 2).
- Produces: default export `AppointmentList` from `AppointmentList.jsx` — not yet wired into `App.jsx` (routing happens in Task 7). Default export `AppointmentEditModal` from `AppointmentEditModal.jsx`, props `{ appointment, doctors, onClose }`.
- Note: the edit modal's time field starts blank and is only sent (converted to `"h:mm AM/PM"`) if the user sets a new value — leaving it blank keeps the appointment's existing `appointment_time` unchanged, since the stored free-text format (`"h:mm AM/PM"`) can't be round-tripped into an HTML `<input type="time">`'s `HH:MM` value. The current time is shown as read-only hint text next to the field.

- [ ] **Step 1: Create `src/pages/admin/appointments/AppointmentEditModal.jsx`**

```jsx
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useUpdateAppointment } from '../../../hooks/useAppointments.js';

const STATUSES = ['pending', 'approved', 'cancelled', 'completed'];

function formatTime12Hour(time24) {
  const [hoursStr, minutes] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

export default function AppointmentEditModal({ appointment, doctors, onClose }) {
  const updateAppointment = useUpdateAppointment();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      patient_name: appointment.patient_name ?? '',
      mobile: appointment.mobile ?? '',
      email: appointment.email ?? '',
      gender: appointment.gender ?? '',
      age: appointment.age ?? '',
      doctor_id: appointment.doctor_id ?? '',
      appointment_date: appointment.appointment_date?.slice(0, 10) ?? '',
      appointment_time: '',
      problem_description: appointment.problem_description ?? '',
      status: appointment.status,
    },
  });

  async function onSubmit(values) {
    const payload = {
      patient_name: values.patient_name,
      mobile: values.mobile,
      appointment_date: values.appointment_date,
      status: values.status,
    };
    if (values.email) payload.email = values.email;
    if (values.gender) payload.gender = values.gender;
    if (values.age !== '') payload.age = values.age;
    if (values.doctor_id) payload.doctor_id = values.doctor_id;
    if (values.appointment_time) payload.appointment_time = formatTime12Hour(values.appointment_time);
    if (values.problem_description) payload.problem_description = values.problem_description;

    try {
      await updateAppointment.mutateAsync({ id: appointment.id, payload });
      toast.success('Appointment updated');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update appointment.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Edit Appointment</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('patient_name', { required: 'Name is required' })}
            />
            {errors.patient_name && <p className="mt-1 text-sm text-red-600">{errors.patient_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mobile</label>
              <input
                type="tel"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('mobile', { required: 'Mobile is required' })}
              />
              {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('email')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('gender')}
              >
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Age</label>
              <input
                type="number"
                min="0"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('age')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Doctor</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('doctor_id')}
            >
              <option value="">General Inquiry / Not sure</option>
              {doctors?.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('appointment_date', { required: 'Date is required' })}
              />
              {errors.appointment_date && (
                <p className="mt-1 text-sm text-red-600">{errors.appointment_date.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Time <span className="font-normal text-slate-400">(current: {appointment.appointment_time})</span>
              </label>
              <input
                type="time"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('appointment_time')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('status')}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Problem Description</label>
            <textarea
              rows="3"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('problem_description')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/admin/appointments/AppointmentList.jsx`**

```jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useAppointments, useUpdateAppointment, useDeleteAppointment } from '../../../hooks/useAppointments.js';
import { useDoctors } from '../../../hooks/useDoctors.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';
import AppointmentEditModal from './AppointmentEditModal.jsx';

const STATUSES = ['pending', 'approved', 'cancelled', 'completed'];

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
};

export default function AppointmentList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [statusFilter, setStatusFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filters = {
    status: statusFilter || undefined,
    doctorId: doctorFilter || undefined,
    date: dateFilter || undefined,
  };

  const { data: appointments, isLoading } = useAppointments(filters);
  const { data: doctors } = useDoctors();
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);

  async function handleStatusChange(id, status) {
    try {
      await updateAppointment.mutateAsync({ id, payload: { status } });
      toast.success('Status updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
    }
  }

  async function confirmDelete() {
    try {
      await deleteAppointment.mutateAsync(pendingDeleteId);
      toast.success('Appointment deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete appointment.');
    } finally {
      setPendingDeleteId(null);
    }
  }

  function clearFilters() {
    setStatusFilter('');
    setDoctorFilter('');
    setDateFilter('');
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Appointments</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Doctors</option>
          {doctors?.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {(statusFilter || doctorFilter || dateFilter) && (
          <button
            onClick={clearFilters}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments?.map((appointment) => {
              const doctor = doctors?.find((d) => d.id === appointment.doctor_id);
              return (
                <tr key={appointment.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{appointment.patient_name}</td>
                  <td className="px-4 py-3 text-slate-600">{appointment.mobile}</td>
                  <td className="px-4 py-3 text-slate-600">{doctor?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{appointment.appointment_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{appointment.appointment_time}</td>
                  <td className="px-4 py-3">
                    <select
                      value={appointment.status}
                      onChange={(e) => handleStatusChange(appointment.id, e.target.value)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[appointment.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="space-x-3 px-4 py-3">
                    <button onClick={() => setEditingAppointment(appointment)} className="text-blue-600 hover:underline">
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setPendingDeleteId(appointment.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {appointments?.length === 0 && <p className="p-6 text-center text-slate-500">No appointments found.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Appointment"
        message="Are you sure you want to delete this appointment? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      {editingAppointment && (
        <AppointmentEditModal
          appointment={editingAppointment}
          doctors={doctors}
          onClose={() => setEditingAppointment(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 7).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/appointments/AppointmentList.jsx frontend/src/pages/admin/appointments/AppointmentEditModal.jsx
git commit -m "Add admin appointment list and edit modal"
```

---

### Task 7: Wire up routing and admin nav — full walkthrough

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/AdminLayout.jsx`

**Interfaces:**
- Consumes: `PublicBooking` (Task 5), `AppointmentList` (Task 6), `ProtectedRoute` (Phase 1).
- Produces: the complete Phase 3 route additions: `/book` (no auth, outside `AdminLayout`), `/admin/appointments` (any authenticated role).

- [ ] **Step 1: Modify `src/App.jsx`**

Current content:
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
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Modify `src/layouts/AdminLayout.jsx`** to add an "Appointments" nav link

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
          </nav>
```

- [ ] **Step 3: Automated smoke check — both servers up, new routes reachable**

```bash
cd backend && npm start &
sleep 1
cd ../frontend && npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/book
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin/appointments
kill %1 %2
```
Expected: both print `200` (Vite serves the SPA shell for any path — actual auth/routing behavior is client-side, verified in Step 4).

- [ ] **Step 4: Live browser walkthrough**

With both `npm run dev` (frontend) and `npm start` (backend) running against the real Docker MySQL database:
1. As an anonymous visitor (no login), open `/book`, fill the form leaving "Doctor" on "General Inquiry / Not sure", submit → see the "Appointment Requested" confirmation view.
2. Log in as admin, open `/admin/appointments` → the new appointment appears with status "Pending" and doctor "—".
3. Change its status via the inline dropdown → toast confirms, row updates.
4. Click "Edit" → modal opens pre-filled → change the patient name and pick a doctor → save → row reflects the new name and doctor.
5. Log out, log in as a staff user (create a temporary fixture user directly via SQL + bcrypt if no staff user exists yet, matching Phase 2's approach — delete it after the walkthrough) → confirm the list is visible, the status dropdown and Edit button work, and there is no Delete button/link anywhere in the row.
6. Log back in as admin → confirm the Delete button is present → delete the test appointment via the confirm dialog → row disappears.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/layouts/AdminLayout.jsx
git commit -m "Wire up appointment routes and admin sidebar navigation"
```
