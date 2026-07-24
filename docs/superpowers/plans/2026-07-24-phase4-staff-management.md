# Phase 4: Staff Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-only CRUD (create/edit/deactivate — no hard delete) for staff-role user accounts, built on Phase 1's existing `users`/`roles` tables, plus a fix to `authenticate` so deactivation takes effect immediately across every route, not just on next login.

**Architecture:** Same layered backend as Phases 1-3 (`routes → middlewares → controllers → services → repositories → mysql2`), extending the existing `userRepository.js`/`roleRepository.js` rather than adding a new table. One cross-cutting change: `authenticate` middleware moves from trusting the JWT payload to a fresh per-request DB lookup. Frontend adds a staff list/form under the existing `AdminLayout`, entirely inside the admin-only nested `ProtectedRoute` (unlike Doctors/Appointments, staff have zero access to this module).

**Tech Stack:** Same as Phases 1-3 — Express, mysql2, zod, bcrypt (already used for the seeded admin); React 19, React Hook Form, TanStack Query, react-hot-toast.

**Testing approach:** No automated test suite, per Phase 1's established decision (`docs/superpowers/specs/2026-07-24-phase1-setup-auth-design.md`, §8). Every task ends with manual verification: standalone Node scripts against the real DB for the repository/service layers, curl for the HTTP layer, and a live Playwright browser walkthrough for the frontend capstone.

## Global Constraints

- Layered architecture: Controller → Service → Repository → MySQL. No ORM. All SQL parameterized via `mysql2` named placeholders.
- No new DB tables — `users` (with `role_id` pointing at the `staff` role) is the staff table, per Phase 1's design.
- Scope: this module manages `role = 'staff'` accounts only. It never returns or accepts an id belonging to a non-staff (admin) user, even if guessed directly — `getStaffMember` 404s in that case.
- RBAC: every `/api/staff*` route requires `authorize('admin')`. Staff have zero access — not even read-only.
- Deactivate only, no hard delete — removing a staff member means `PUT .../:id` with `active: false`. Reactivating is the same endpoint with `active: true`.
- Passwords: admin sets on create, can reset via edit (blank/omitted = unchanged). No self-service change-password feature. `bcrypt.hash(password, 10)` (matches `seedAdmin.js`'s existing rounds). Never returned in any API response.
- `authenticate` middleware must do a fresh DB `active` check on every request (not just `/me`), so deactivation is immediate app-wide, not just at next login.
- Consistent JSON envelope on every response: `{success, message, data}` / `{success, message, errors}` — reuse Phase 1's `sendResponse`, `AppError`, `errorHandler`.

---

### Task 1: User repository additions

**Files:**
- Modify: `backend/src/repositories/userRepository.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js` (Phase 1, unchanged).
- Produces (new named exports, added alongside the existing `findUserByUsername`, `findUserById`, `createUser`): `findStaffUsers()` — resolves to an array of staff-role user rows (same column set as `findUserById`: `id, role_id, role, name, mobile, email, username, active, created_at, updated_at` — no `password_hash`), ordered by name. `updateUser(id, fields)` — `fields` is a partial object (only present keys are written); resolves to nothing meaningful (callers re-fetch via `findUserById` after).

- [ ] **Step 1: Modify `src/repositories/userRepository.js`** to add the two new functions

Current content:
```js
import pool from '../config/db.js';

export async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.password_hash, u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = :username`,
    { username }
  );
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id`,
    { id }
  );
  return rows[0] ?? null;
}

export async function createUser({ roleId, name, mobile, email, username, passwordHash }) {
  const [result] = await pool.query(
    `INSERT INTO users (role_id, name, mobile, email, username, password_hash)
     VALUES (:roleId, :name, :mobile, :email, :username, :passwordHash)`,
    { roleId, name, mobile: mobile ?? null, email: email ?? null, username, passwordHash }
  );
  return result.insertId;
}
```

Replace with:
```js
import pool from '../config/db.js';

export async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.password_hash, u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = :username`,
    { username }
  );
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id`,
    { id }
  );
  return rows[0] ?? null;
}

export async function findStaffUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.role_id, r.name AS role, u.name, u.mobile, u.email, u.username,
            u.active, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'staff'
     ORDER BY u.name ASC`
  );
  return rows;
}

export async function createUser({ roleId, name, mobile, email, username, passwordHash }) {
  const [result] = await pool.query(
    `INSERT INTO users (role_id, name, mobile, email, username, password_hash)
     VALUES (:roleId, :name, :mobile, :email, :username, :passwordHash)`,
    { roleId, name, mobile: mobile ?? null, email: email ?? null, username, passwordHash }
  );
  return result.insertId;
}

export async function updateUser(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE users SET ${setClause} WHERE id = :id`, { ...fields, id });
}
```

(`updateUser`'s dynamic `SET` clause mirrors `appointmentRepository.update` from Phase 3 exactly — safe because `fields`'s keys always come from a service-layer object built from a fixed, zod-validated whitelist, never raw user input.)

- [ ] **Step 2: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-user-repo.mjs`:

```js
import * as userRepository from '../src/repositories/userRepository.js';
import * as roleRepository from '../src/repositories/roleRepository.js';
import pool from '../src/config/db.js';

async function main() {
  const staffRole = await roleRepository.findRoleByName('staff');
  console.log('staff role id:', staffRole.id);

  const id = await userRepository.createUser({
    roleId: staffRole.id,
    name: 'Verify Staff One',
    mobile: '9000000010',
    email: 'verifystaff1@example.com',
    username: 'verifystaff1',
    passwordHash: 'not-a-real-hash-for-verification',
  });
  console.log('created id:', id);

  const staffList = await userRepository.findStaffUsers();
  console.log('findStaffUsers includes new user:', staffList.some((u) => u.id === id));
  console.log('findStaffUsers rows have no password_hash field:', staffList.every((u) => u.password_hash === undefined));

  await userRepository.updateUser(id, { name: 'Verify Staff One Updated', active: false });
  const updated = await userRepository.findUserById(id);
  console.log('updated name:', updated.name, 'active:', updated.active);

  await pool.query('DELETE FROM users WHERE id = :id', { id });
  const afterDelete = await userRepository.findUserById(id);
  console.log('after delete, findUserById returns:', afterDelete);

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
node scripts/tmp-verify-user-repo.mjs
```

Expected output (MySQL returns `BOOLEAN` columns as `1`/`0` via mysql2, not JS `true`/`false` — this is correct, not a bug):
```
staff role id: <number>
created id: <number>
findStaffUsers includes new user: true
findStaffUsers rows have no password_hash field: true
updated name: Verify Staff One Updated active: 0
after delete, findUserById returns: null
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-user-repo.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/userRepository.js
git commit -m "Add staff-scoped list and partial-update to user repository"
```

---

### Task 2: Staff service

**Files:**
- Create: `backend/src/services/staffService.js`

**Interfaces:**
- Consumes: `findStaffUsers, findUserById, createUser, updateUser` from `userRepository.js` (Task 1); `findRoleByName` from `backend/src/repositories/roleRepository.js` (Phase 1, unchanged); `AppError` (default export) from `backend/src/utils/AppError.js` (Phase 1); `bcrypt` (npm package, already a dependency since Phase 1's `seedAdmin.js` uses it).
- Produces: named exports `listStaff()`, `getStaffMember(id)`, `createStaffMember(data)`, `updateStaffMember(id, data)`.
  - `listStaff()` resolves to an array of public staff profiles (no `password_hash`, no `role_id`/`role` — every row here is implicitly staff).
  - `getStaffMember(id)` throws `AppError('Staff member not found.', 404)` if the id doesn't exist OR belongs to a non-staff user.
  - `createStaffMember(data)` — `data` has `name` (required), `mobile`/`email` (optional), `username` (required), `password` (required, plaintext — hashed inside this function). Throws `AppError('Username already taken.', 409)` on a duplicate username.
  - `updateStaffMember(id, data)` — `data`'s fields are all optional (partial update); an empty/absent `data.password` leaves the stored hash untouched; a non-empty `data.password` is hashed and replaces it. Same 404/409 behavior as above.

- [ ] **Step 1: Create `src/services/staffService.js`**

```js
import bcrypt from 'bcrypt';
import AppError from '../utils/AppError.js';
import * as userRepository from '../repositories/userRepository.js';
import * as roleRepository from '../repositories/roleRepository.js';

function toPublicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    username: user.username,
    active: user.active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function listStaff() {
  const staff = await userRepository.findStaffUsers();
  return staff.map(toPublicProfile);
}

export async function getStaffMember(id) {
  const user = await userRepository.findUserById(id);
  if (!user || user.role !== 'staff') {
    throw new AppError('Staff member not found.', 404);
  }
  return toPublicProfile(user);
}

export async function createStaffMember(data) {
  const staffRole = await roleRepository.findRoleByName('staff');
  const passwordHash = await bcrypt.hash(data.password, 10);

  let id;
  try {
    id = await userRepository.createUser({
      roleId: staffRole.id,
      name: data.name,
      mobile: data.mobile ?? null,
      email: data.email ?? null,
      username: data.username,
      passwordHash,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('Username already taken.', 409);
    }
    throw err;
  }

  return getStaffMember(id);
}

export async function updateStaffMember(id, data) {
  await getStaffMember(id);

  const fields = {};
  if (data.name !== undefined) fields.name = data.name;
  if (data.mobile !== undefined) fields.mobile = data.mobile;
  if (data.email !== undefined) fields.email = data.email;
  if (data.username !== undefined) fields.username = data.username;
  if (data.active !== undefined) fields.active = data.active;
  if (data.password) {
    fields.password_hash = await bcrypt.hash(data.password, 10);
  }

  try {
    await userRepository.updateUser(id, fields);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('Username already taken.', 409);
    }
    throw err;
  }

  return getStaffMember(id);
}
```

(`getStaffMember`'s `user.role !== 'staff'` check is the only place this module's scope boundary — "never touch admin accounts" — is enforced. `updateStaffMember` only hashes and includes `password_hash` when `data.password` is a non-empty string, so an omitted or empty-string password leaves the existing hash untouched.)

- [ ] **Step 2: Verify — write and run a standalone script against the real DB**

Create `backend/scripts/tmp-verify-staff-service.mjs`:

```js
import bcrypt from 'bcrypt';
import * as staffService from '../src/services/staffService.js';
import * as userRepository from '../src/repositories/userRepository.js';
import pool from '../src/config/db.js';

async function main() {
  const created = await staffService.createStaffMember({
    name: 'Service Verify Staff',
    mobile: '9111111112',
    email: 'serviceverify@example.com',
    username: 'serviceverifystaff',
    password: 'password123',
  });
  console.log('created id:', created.id, 'name:', created.name, 'active:', created.active);
  console.log(
    'response has no password fields:',
    created.password === undefined && created.password_hash === undefined
  );

  const fetched = await staffService.getStaffMember(created.id);
  console.log('fetched username:', fetched.username);

  const beforeUpdate = await userRepository.findUserById(created.id);
  const updated = await staffService.updateStaffMember(created.id, {
    name: 'Service Verify Staff Updated',
    password: 'newpassword456',
  });
  console.log('name updated:', updated.name);

  const afterPasswordUpdate = await userRepository.findUserById(created.id);
  const oldPasswordStillMatches = await bcrypt.compare('password123', afterPasswordUpdate.password_hash);
  const newPasswordMatches = await bcrypt.compare('newpassword456', afterPasswordUpdate.password_hash);
  console.log('old password no longer matches:', !oldPasswordStillMatches);
  console.log('new password matches:', newPasswordMatches);

  await staffService.updateStaffMember(created.id, { active: false });
  const afterNoPasswordUpdate = await userRepository.findUserById(created.id);
  console.log(
    'password unchanged when omitted from update:',
    afterPasswordUpdate.password_hash === afterNoPasswordUpdate.password_hash
  );
  console.log('active updated:', afterNoPasswordUpdate.active);

  try {
    await staffService.createStaffMember({
      name: 'Duplicate Username Test',
      username: 'serviceverifystaff',
      password: 'password789',
    });
    console.log('ERROR: expected 409 for duplicate username, but no error was thrown');
  } catch (err) {
    console.log('duplicate username threw as expected:', err.statusCode, err.message);
  }

  try {
    await staffService.getStaffMember(999999);
    console.log('ERROR: expected 404 for missing id, but no error was thrown');
  } catch (err) {
    console.log('getStaffMember for missing id threw as expected:', err.statusCode, err.message);
  }

  const [adminRows] = await pool.query(
    "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' LIMIT 1"
  );
  const adminId = adminRows[0]?.id;
  if (adminId) {
    try {
      await staffService.getStaffMember(adminId);
      console.log('ERROR: expected 404 for an admin id via staff service, but no error was thrown');
    } catch (err) {
      console.log('getStaffMember for an admin id threw as expected:', err.statusCode, err.message);
    }
  }

  await pool.query('DELETE FROM users WHERE id = :id', { id: created.id });
  console.log('cleanup done');

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
node scripts/tmp-verify-staff-service.mjs
```

Expected output:
```
created id: <number> name: Service Verify Staff active: 1
response has no password fields: true
fetched username: serviceverifystaff
name updated: Service Verify Staff Updated
old password no longer matches: true
new password matches: true
password unchanged when omitted from update: true
active updated: 0
duplicate username threw as expected: 409 Username already taken.
getStaffMember for missing id threw as expected: 404 Staff member not found.
getStaffMember for an admin id threw as expected: 404 Staff member not found.
cleanup done
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-staff-service.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/staffService.js
git commit -m "Add staff service"
```

---

### Task 3: Staff HTTP API — validators, controller, routes, wiring

**Files:**
- Create: `backend/src/validators/staffValidators.js`
- Create: `backend/src/controllers/staffController.js`
- Create: `backend/src/routes/staffRoutes.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `listStaff, getStaffMember, createStaffMember, updateStaffMember` from `staffService.js` (Task 2); `authenticate`, `authorize(...roles)`, `validate(schema)` from Phase 1's middlewares; `asyncHandler`, `sendResponse` from Phase 1's utils.
- Produces: `createStaffSchema`, `updateStaffSchema` (zod schemas) from `staffValidators.js`; `list, getOne, create, update` (Express handlers) from `staffController.js`; default-exported Express `Router` from `staffRoutes.js` mounted at `/staff`.

- [ ] **Step 1: Create `src/validators/staffValidators.js`**

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

(`password: z.string().min(6).optional().or(z.literal(''))` lets the edit form send an empty string to mean "no change" — simpler than omitting the key from a plain JSON body. `booleanFromString` is the same preprocess used in `doctorValidators.js` — this body is JSON, not multipart, so `active` normally arrives as a real boolean already, but this stays defensive and consistent with the rest of the codebase.)

- [ ] **Step 2: Create `src/controllers/staffController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as staffService from '../services/staffService.js';

export const list = asyncHandler(async (req, res) => {
  const staff = await staffService.listStaff();
  sendResponse(res, { status: 200, message: 'Staff retrieved', data: staff });
});

export const getOne = asyncHandler(async (req, res) => {
  const staff = await staffService.getStaffMember(req.params.id);
  sendResponse(res, { status: 200, message: 'Staff member retrieved', data: staff });
});

export const create = asyncHandler(async (req, res) => {
  const staff = await staffService.createStaffMember(req.body);
  sendResponse(res, { status: 201, message: 'Staff member created', data: staff });
});

export const update = asyncHandler(async (req, res) => {
  const staff = await staffService.updateStaffMember(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Staff member updated', data: staff });
});
```

- [ ] **Step 3: Create `src/routes/staffRoutes.js`**

```js
import { Router } from 'express';
import * as staffController from '../controllers/staffController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { createStaffSchema, updateStaffSchema } from '../validators/staffValidators.js';

const router = Router();

router.get('/', authenticate, authorize('admin'), staffController.list);
router.get('/:id', authenticate, authorize('admin'), staffController.getOne);
router.post('/', authenticate, authorize('admin'), validate(createStaffSchema), staffController.create);
router.put('/:id', authenticate, authorize('admin'), validate(updateStaffSchema), staffController.update);

export default router;
```

- [ ] **Step 4: Modify `src/routes/index.js`** to mount the staff routes

Current content:
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

Replace with:
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

- [ ] **Step 5: Verify — full curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1
curl -s http://localhost:5000/api/health

# Login as admin (use your real ADMIN_USERNAME/ADMIN_PASSWORD from backend/.env if different)
curl -s -c /tmp/staff-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- create staff member ---"
CREATE_RESP=$(curl -s -b /tmp/staff-cookies.txt -X POST http://localhost:5000/api/staff \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Staff Curl","mobile":"9222222222","email":"teststaffcurl@example.com","username":"teststaffcurl","password":"password123"}')
echo "$CREATE_RESP"
STAFF_ID=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
echo "STAFF_ID=$STAFF_ID"

echo "--- list includes new staff, no password_hash field ---"
curl -s -b /tmp/staff-cookies.txt http://localhost:5000/api/staff | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$STAFF_ID)); console.log('no password_hash field:', !('password_hash' in r.data[0]))})"

echo "--- get by id ---"
curl -s -b /tmp/staff-cookies.txt "http://localhost:5000/api/staff/$STAFF_ID"

echo "--- duplicate username rejected (409) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/staff-cookies.txt -X POST http://localhost:5000/api/staff \
  -H "Content-Type: application/json" \
  -d '{"name":"Dup Test","username":"teststaffcurl","password":"password456"}'

echo "--- new staff member can log in with the set password ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -c /tmp/newstaff-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teststaffcurl","password":"password123"}'

# Craft a staff-role JWT directly to test RBAC (this module has NO staff access at all)
STAFF_JWT=$(node --input-type=module -e "
import env from './src/config/env.js';
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ id: 999, role: 'staff' }, env.JWT_SECRET, { expiresIn: '1h' }));
" | tail -n1)

echo "--- staff CANNOT list staff (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" http://localhost:5000/api/staff

echo "--- staff CANNOT create staff (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X POST http://localhost:5000/api/staff \
  -H "Content-Type: application/json" -d '{"name":"Should Fail","username":"shouldfail","password":"password123"}'

echo "--- staff CANNOT update staff (403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b "token=$STAFF_JWT" -X PUT "http://localhost:5000/api/staff/$STAFF_ID" \
  -H "Content-Type: application/json" -d '{"name":"Should Fail Update"}'

echo "--- update staff member (name + deactivate), password omitted so it stays unchanged ---"
curl -s -b /tmp/staff-cookies.txt -X PUT "http://localhost:5000/api/staff/$STAFF_ID" \
  -H "Content-Type: application/json" -d '{"name":"Test Staff Curl Updated","active":false}'

echo "--- deactivated staff member can no longer log in ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teststaffcurl","password":"password123"}'

echo "--- cleanup: remove test staff row ---"
node --input-type=module -e "
import pool from './src/config/db.js';
await pool.query('DELETE FROM users WHERE username = :u', { u: 'teststaffcurl' });
await pool.end();
console.log('cleanup done');
"

kill %1
rm -f /tmp/staff-cookies.txt /tmp/newstaff-cookies.txt
```

Expected (key checks): health `200`; create returns `201` with the new staff member (no `password`/`password_hash` field anywhere in the response); list/get show the new staff member; duplicate username → `409` "Username already taken."; the new account can log in with the password that was set; staff JWT gets `403` on all three staff routes tried; update succeeds and omitting `password` leaves the original password working — this is confirmed indirectly by the subsequent step showing the account is deactivated (not by a login attempt with the old password, since `active:false` makes any login fail regardless — Task 2's service-level test already directly confirmed password-preservation via hash comparison); deactivated account's login attempt → `401`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/validators/staffValidators.js backend/src/controllers/staffController.js backend/src/routes/staffRoutes.js backend/src/routes/index.js
git commit -m "Add staff HTTP API: validators, controller, routes"
```

---

### Task 4: Fix `authenticate` to revoke deactivated sessions immediately

**Files:**
- Modify: `backend/src/middlewares/authenticate.js`

**Interfaces:**
- Consumes: `findUserById` from `backend/src/repositories/userRepository.js` (unchanged signature); `asyncHandler` from `backend/src/utils/asyncHandler.js` (Phase 1, already used to wrap controller handlers — this task reuses it to wrap a middleware for the first time, since `asyncHandler`'s `(req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)` shape works identically for any Express middleware, not just route handlers).
- Produces: `authenticate` (named export, same name/call signature as before — `(req, res, next)` — so no other file needs to change). Still sets `req.user = { id, role }`, but the values now come from a fresh DB row instead of the JWT payload.

This task touches shared middleware used by every protected route in the app (Doctors, Appointments, Staff, and all future phases) — review it with that in mind.

- [ ] **Step 1: Modify `src/middlewares/authenticate.js`**

Current content:
```js
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

export function authenticate(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return next(new AppError('Your session has expired. Please log in again.', 401));
  }
}
```

Replace with:
```js
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import { findUserById } from '../repositories/userRepository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(new AppError('Your session has expired. Please log in again.', 401));
  }

  const user = await findUserById(payload.id);
  if (!user || !user.active) {
    return next(new AppError('Your session is no longer valid.', 401));
  }

  req.user = { id: user.id, role: user.role };
  next();
});
```

(The "Your session is no longer valid." message is copied verbatim from `authService.js`'s existing `getCurrentUser` — same wording for the same underlying condition, whether it's hit via `/me` or via this middleware now. `req.user.role` now comes from the fresh DB row rather than the JWT payload — a second, unplanned benefit: a role correction, if one were ever made, would also take effect immediately, though no current phase changes a user's role after creation.)

- [ ] **Step 2: Verify — full curl regression sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1

# Login as admin
curl -s -c /tmp/auth-admin-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- create a real staff account ---"
CREATE_RESP=$(curl -s -b /tmp/auth-admin-cookies.txt -X POST http://localhost:5000/api/staff \
  -H "Content-Type: application/json" \
  -d '{"name":"Auth Fix Test Staff","username":"authfixteststaff","password":"password123"}')
echo "$CREATE_RESP"
STAFF_ID=$(echo "$CREATE_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")

echo "--- log in as that staff member (real cookie, not a crafted JWT) ---"
curl -s -c /tmp/auth-staff-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"authfixteststaff","password":"password123"}' > /dev/null

echo "--- staff cookie CAN access a staff-permitted route before deactivation (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/auth-staff-cookies.txt http://localhost:5000/api/doctors -o /dev/null

echo "--- admin deactivates that staff account ---"
curl -s -b /tmp/auth-admin-cookies.txt -X PUT "http://localhost:5000/api/staff/$STAFF_ID" \
  -H "Content-Type: application/json" -d '{"active":false}'

echo "--- the SAME still-valid (unexpired) staff cookie is now rejected (401) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/auth-staff-cookies.txt http://localhost:5000/api/doctors

echo "--- GET /api/auth/me with the same cookie is also now 401 ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/auth-staff-cookies.txt http://localhost:5000/api/auth/me

echo "--- admin's own session is unaffected throughout (200) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/auth-admin-cookies.txt http://localhost:5000/api/auth/me -o /dev/null

echo "--- cleanup ---"
node --input-type=module -e "
import pool from './src/config/db.js';
await pool.query('DELETE FROM users WHERE username = :u', { u: 'authfixteststaff' });
await pool.end();
console.log('cleanup done');
"

kill %1
rm -f /tmp/auth-admin-cookies.txt /tmp/auth-staff-cookies.txt
```

Expected (key checks): staff cookie gets `200` on `/api/doctors` before deactivation; after the admin deactivates the account, the exact same cookie (never re-issued, still within its 8h expiry) gets `401` on both `/api/doctors` and `/api/auth/me`; the admin's own session is never affected by any of this.

- [ ] **Step 3: Commit**

```bash
git add backend/src/middlewares/authenticate.js
git commit -m "Make authenticate revoke deactivated sessions immediately"
```

---

### Task 5: Frontend staff API layer and hooks

**Files:**
- Create: `frontend/src/services/staffService.js`
- Create: `frontend/src/hooks/useStaff.js`

**Interfaces:**
- Consumes: `api` (default export) from `frontend/src/services/api.js` (Phase 1).
- Produces: `listStaff()`, `getStaffMember(id)`, `createStaffMember(payload)`, `updateStaffMember(id, payload)` named exports from `staffService.js`.
- Produces: `useStaffList()`, `useStaffMember(id)`, `useCreateStaff()`, `useUpdateStaff()` named exports from `useStaff.js` (React Query hooks). `useUpdateStaff()`'s mutation function takes `{ id, payload }`. Both mutation hooks invalidate the `['staff']` query key on success.

- [ ] **Step 1: Create `src/services/staffService.js`**

```js
import api from './api.js';

export async function listStaff() {
  const { data } = await api.get('/staff');
  return data.data;
}

export async function getStaffMember(id) {
  const { data } = await api.get(`/staff/${id}`);
  return data.data;
}

export async function createStaffMember(payload) {
  const { data } = await api.post('/staff', payload);
  return data.data;
}

export async function updateStaffMember(id, payload) {
  const { data } = await api.put(`/staff/${id}`, payload);
  return data.data;
}
```

- [ ] **Step 2: Create `src/hooks/useStaff.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as staffService from '../services/staffService.js';

export function useStaffList() {
  return useQuery({ queryKey: ['staff'], queryFn: staffService.listStaff });
}

export function useStaffMember(id) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffService.getStaffMember(id),
    enabled: Boolean(id),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffService.createStaffMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => staffService.updateStaffMember(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (these modules aren't wired into any page yet — this only proves imports resolve and there's no syntax error; end-to-end behavior is verified in Task 8).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/staffService.js frontend/src/hooks/useStaff.js
git commit -m "Add frontend staff API layer and React Query hooks"
```

---

### Task 6: Staff create/edit form

**Files:**
- Create: `frontend/src/pages/admin/staff/StaffForm.jsx`

**Interfaces:**
- Consumes: `useStaffMember`, `useCreateStaff`, `useUpdateStaff` from `hooks/useStaff.js` (Task 5).
- Produces: default export `StaffForm` — not yet wired into `App.jsx` (routing happens in Task 8).

- [ ] **Step 1: Create `src/pages/admin/staff/StaffForm.jsx`**

```jsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStaffMember, useCreateStaff, useUpdateStaff } from '../../../hooks/useStaff.js';

export default function StaffForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: staffMember, isLoading: isLoadingStaff } = useStaffMember(id);
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      mobile: '',
      email: '',
      username: '',
      password: '',
      active: true,
    },
  });

  useEffect(() => {
    if (staffMember) {
      reset({
        name: staffMember.name ?? '',
        mobile: staffMember.mobile ?? '',
        email: staffMember.email ?? '',
        username: staffMember.username ?? '',
        password: '',
        active: Boolean(staffMember.active),
      });
    }
  }, [staffMember, reset]);

  async function onSubmit(values) {
    const payload = {
      name: values.name,
      username: values.username,
      active: values.active,
    };
    if (values.mobile) payload.mobile = values.mobile;
    if (values.email) payload.email = values.email;
    if (values.password) payload.password = values.password;

    try {
      if (isEdit) {
        await updateStaff.mutateAsync({ id, payload });
        toast.success('Staff member updated');
      } else {
        await createStaff.mutateAsync(payload);
        toast.success('Staff member created');
      }
      navigate('/admin/staff');
    } catch (err) {
      toast.error(err.message || 'Failed to save staff member.');
    }
  }

  if (isEdit && isLoadingStaff) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">
        {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
      </h1>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Mobile</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('mobile')}
            />
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'Username must be at least 3 characters' },
            })}
          />
          {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
          </label>
          <input
            type="password"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register(
              'password',
              isEdit
                ? {}
                : {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' },
                  }
            )}
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
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
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Staff Member' : 'Create Staff Member'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/staff')}
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

(`register('password', isEdit ? {} : {...})` is the key detail: the password field is only `required` in create mode. In edit mode it's an unvalidated optional field — leaving it blank means "don't change the password," matching the backend's `updateStaffSchema` contract.)

- [ ] **Step 2: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 8).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/staff/StaffForm.jsx
git commit -m "Add staff create/edit form"
```

---

### Task 7: Staff list page

**Files:**
- Create: `frontend/src/pages/admin/staff/StaffList.jsx`

**Interfaces:**
- Consumes: `useStaffList` from `hooks/useStaff.js` (Task 5).
- Produces: default export `StaffList` — not yet wired into `App.jsx` (routing happens in Task 8).

This page has no role-conditional rendering (no "staff can view but not edit" tier, unlike `DoctorList.jsx`/`AppointmentList.jsx`) — the entire route it will live on is admin-only, so a staff user can never reach this component at all.

- [ ] **Step 1: Create `src/pages/admin/staff/StaffList.jsx`**

```jsx
import { Link } from 'react-router-dom';
import { useStaffList } from '../../../hooks/useStaff.js';

export default function StaffList() {
  const { data: staff, isLoading } = useStaffList();

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Staff</h1>
        <Link
          to="/admin/staff/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Staff
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff?.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{member.name}</td>
                <td className="px-4 py-3 text-slate-600">{member.username}</td>
                <td className="px-4 py-3 text-slate-600">{member.mobile || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{member.email || '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      member.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {member.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/admin/staff/${member.id}/edit`} className="text-blue-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff?.length === 0 && <p className="p-6 text-center text-slate-500">No staff added yet.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a route — verified live in Task 8).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/staff/StaffList.jsx
git commit -m "Add staff list page"
```

---

### Task 8: Wire up routing and admin nav — full walkthrough

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/AdminLayout.jsx`

**Interfaces:**
- Consumes: `StaffList` (Task 7), `StaffForm` (Task 6), `ProtectedRoute` (Phase 1, its existing `roles` prop).
- Produces: the complete Phase 4 route additions: `/admin/staff`, `/admin/staff/new`, `/admin/staff/:id/edit` (all admin only).

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

(All three staff routes are added inside the existing `<Route element={<ProtectedRoute roles={['admin']} />}>` block that already wraps the doctor create/edit routes — unlike Doctors/Appointments, there's no "staff can view" tier for this module.)

- [ ] **Step 2: Modify `src/layouts/AdminLayout.jsx`** to add an admin-only "Staff" nav link

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
            {user?.role === 'admin' && (
              <NavLink to="/admin/staff" className={navLinkClass}>
                Staff
              </NavLink>
            )}
          </nav>
```

(The `user?.role === 'admin'` guard is UX-only — the real enforcement is the route-level `ProtectedRoute roles={['admin']}` from Step 1 — but it keeps a staff user from ever seeing a nav link that would just redirect them away.)

- [ ] **Step 3: Automated smoke check — both servers up, staff page reachable**

```bash
cd backend && npm start &
sleep 1
cd ../frontend && npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin/staff
kill %1 %2
```
Expected: `200` (Vite serves the SPA shell for any path — actual auth/routing behavior is client-side, verified in Step 4).

- [ ] **Step 4: Live browser walkthrough**

With both `npm run dev` (frontend) and `npm start` (backend) running against the real Docker MySQL database:
1. Log in as admin, click "Staff" in the sidebar, land on `/admin/staff`.
2. Click "Add Staff", fill the form (name, username, password), submit → redirected to the list, new staff member appears with an "Active" badge.
3. Click "Edit" on that staff member → change the name, leave password blank → save → list reflects the new name; the account can still log in with its original password (confirms leaving the password field blank truly left it unchanged).
4. Log out, log in as that new staff member → confirm no "Staff" link appears in the sidebar, and navigating directly to `/admin/staff` redirects away.
5. Log back in as admin, edit that staff member again, uncheck "Active", save → badge shows "Inactive".
6. In a second browser context that's still logged in as the (now-deactivated) staff member from step 4, attempt any action (e.g. reload `/admin/doctors`) → confirm it's immediately redirected to `/login` (the `authenticate` fix from Task 4 revoking the still-valid session).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/layouts/AdminLayout.jsx
git commit -m "Wire up staff routes and admin sidebar navigation"
```
