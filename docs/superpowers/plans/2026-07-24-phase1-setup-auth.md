# Phase 1: Project Setup, Folder Structure, Database Schema, Authentication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `backend/` and `frontend/` projects, create the full MySQL schema, and ship a working admin/staff login flow (backend API + browser UI) that later phases build on.

**Architecture:** Layered Express backend (`routes → middlewares → controllers → services → repositories → mysql2`) with cookie-based JWT auth, and a Vite/React 19 frontend with a React Query-backed `AuthContext` gating a `/admin` shell behind `ProtectedRoute`.

**Tech Stack:** Node.js + Express + mysql2 + bcrypt + jsonwebtoken + zod + helmet + cors + express-rate-limit; React 19 + Vite + React Router v6 + Tailwind CSS v4 + Axios + TanStack Query + React Hook Form + react-hot-toast.

**Testing approach:** Per the approved design (`docs/superpowers/specs/2026-07-24-phase1-setup-auth-design.md`, §8), no automated test framework is introduced in this phase. Every task ends with an explicit manual verification (curl commands with expected output, or a build/browser check) instead of an automated test step.

## Global Constraints

- Frontend: React 19, React Router, Axios, Tailwind CSS, React Hook Form, TanStack Query (React Query) — per spec.
- Backend: Node.js, Express.js, MySQL, JWT auth, bcrypt, Multer, dotenv — per spec.
- Layered architecture required: Controller → Service → Repository → MySQL. No ORM, no query builder — raw parameterized SQL via `mysql2`.
- No microservices, event buses, or CQRS. Keep this a simple two-project (backend/frontend) app.
- All SQL parameterized (no string concatenation of user input).
- JWT delivered via httpOnly cookie (not localStorage) — confirmed by user.
- Consistent JSON envelope on every API response: `{ success, message, data }` (or `errors` on failure).
- No public registration endpoint; only a seed script creates the first admin.

---

### Task 1: Backend project scaffold and shared utilities

**Files:**
- Create: `backend/package.json` (via `npm init` + `npm install`)
- Create: `backend/.gitignore`
- Create: `backend/.env.example`
- Create: `backend/src/config/env.js`
- Create: `backend/src/utils/AppError.js`
- Create: `backend/src/utils/sendResponse.js`
- Create: `backend/src/utils/asyncHandler.js`
- Create: `backend/src/uploads/.gitkeep`

**Interfaces:**
- Produces: `AppError` class (`new AppError(message, statusCode = 500, errors = null)`, sets `.statusCode`, `.errors`, `.isOperational`), default export from `backend/src/utils/AppError.js`.
- Produces: `sendResponse(res, { status, message, data })` named export from `backend/src/utils/sendResponse.js`.
- Produces: `asyncHandler(fn)` named export from `backend/src/utils/asyncHandler.js` — wraps an async Express handler and forwards rejections to `next`.
- Produces: `env` default export object from `backend/src/config/env.js` with fields: `NODE_ENV, PORT, FRONTEND_URL, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, JWT_EXPIRES_IN, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAME`.

- [ ] **Step 1: Initialize the backend package**

```bash
mkdir -p backend
cd backend
npm init -y
npm pkg set type="module"
npm pkg set scripts.dev="nodemon src/server.js"
npm pkg set scripts.start="node src/server.js"
npm pkg set scripts.migrate="node scripts/migrate.js"
npm pkg set scripts.seed:admin="node scripts/seedAdmin.js"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install express mysql2 bcrypt jsonwebtoken cookie-parser zod helmet cors express-rate-limit morgan dotenv multer
npm install -D nodemon
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.env
uploads/*
!uploads/.gitkeep
*.log
.DS_Store
```

- [ ] **Step 4: Create `.env.example`**

```
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=physio_clinic

JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=8h

ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
ADMIN_NAME=Administrator
```

- [ ] **Step 5: Create `src/uploads/.gitkeep`**

Empty file — reserves the directory for Multer uploads starting Phase 2 (git doesn't track empty directories).

- [ ] **Step 6: Create `src/config/env.js`**

```js
import dotenv from 'dotenv';

dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'physio_clinic',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  ADMIN_NAME: process.env.ADMIN_NAME || 'Administrator',
};

export default env;
```

- [ ] **Step 7: Create `src/utils/AppError.js`**

```js
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
```

- [ ] **Step 8: Create `src/utils/sendResponse.js`**

```js
export function sendResponse(res, { status = 200, message = '', data = null } = {}) {
  return res.status(status).json({ success: status < 400, message, data });
}
```

- [ ] **Step 9: Create `src/utils/asyncHandler.js`**

```js
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

- [ ] **Step 10: Verify**

Run (from `backend/`):
```bash
node --input-type=module -e "import env from './src/config/env.js'; console.log(env.PORT, env.DB_NAME, env.JWT_EXPIRES_IN);"
```
Expected output: `5000 physio_clinic 8h`

- [ ] **Step 11: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/.gitignore backend/.env.example backend/src/config/env.js backend/src/utils backend/src/uploads/.gitkeep
git commit -m "Backend scaffold: package config, env loader, shared utils"
```

---

### Task 2: Express app skeleton, error handling, health route

**Files:**
- Create: `backend/src/middlewares/errorHandler.js`
- Create: `backend/src/middlewares/rateLimiters.js`
- Create: `backend/src/routes/index.js`
- Create: `backend/src/app.js`
- Create: `backend/src/server.js`

**Interfaces:**
- Consumes: `env` from `backend/src/config/env.js` (Task 1); `AppError` from `backend/src/utils/AppError.js` (Task 1).
- Produces: `errorHandler(err, req, res, next)` and `notFoundHandler(req, res)` named exports from `backend/src/middlewares/errorHandler.js`.
- Produces: `apiLimiter` and `loginLimiter` named exports (Express middleware) from `backend/src/middlewares/rateLimiters.js`.
- Produces: default export Express `Router` from `backend/src/routes/index.js`, mounted at `/api` in `app.js`, with `GET /health` defined. Task 6 will modify this file to mount `/auth`.
- Produces: default export Express app instance from `backend/src/app.js`.

- [ ] **Step 1: Create `src/middlewares/errorHandler.js`**

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

- [ ] **Step 2: Create `src/middlewares/rateLimiters.js`**

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

- [ ] **Step 3: Create `src/routes/index.js`**

```js
import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

export default router;
```

- [ ] **Step 4: Create `src/app.js`**

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

- [ ] **Step 5: Create `src/server.js`**

```js
import app from './app.js';
import env from './config/env.js';

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a strong secret in production.');
}

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});
```

- [ ] **Step 6: Verify**

```bash
cd backend
npm start &
sleep 1
curl -s http://localhost:5000/api/health
curl -s http://localhost:5000/api/does-not-exist
kill %1
```
Expected first curl: `{"success":true,"message":"OK","data":{"uptime":...}}`
Expected second curl: `{"success":false,"message":"Route not found: GET /api/does-not-exist","errors":null}`

- [ ] **Step 7: Commit**

```bash
git add backend/src/middlewares backend/src/routes backend/src/app.js backend/src/server.js
git commit -m "Backend app skeleton: security middleware, error handling, health route"
```

---

### Task 3: Database config, schema, and migration script

**Files:**
- Create: `backend/src/config/db.js`
- Create: `backend/src/config/schema.sql`
- Create: `backend/scripts/migrate.js`

**Interfaces:**
- Consumes: `env` from `backend/src/config/env.js` (Task 1).
- Produces: `pool` default export (a `mysql2/promise` `Pool`) from `backend/src/config/db.js`, used by every repository from Task 4 onward.

- [ ] **Step 1: Create `.env` from the example and point it at your MySQL server**

```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` and set `DB_USER`, `DB_PASSWORD`, `DB_NAME` to match your existing local MySQL server (the user for `DB_USER` needs `CREATE DATABASE`/`CREATE TABLE` privileges since `migrate.js` creates the database if it doesn't exist).

- [ ] **Step 2: Create `src/config/db.js`**

```js
import mysql from 'mysql2/promise';
import env from './env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

export default pool;
```

- [ ] **Step 3: Create `src/config/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20),
  email VARCHAR(150),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  qualification VARCHAR(150),
  specialization VARCHAR(150),
  experience_years INT,
  photo_url VARCHAR(255),
  consultation_fee DECIMAL(10,2),
  working_days VARCHAR(100),
  available_time VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  gender VARCHAR(10),
  age INT,
  doctor_id INT,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  problem_description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  image_url VARCHAR(255),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  review TEXT NOT NULL,
  rating TINYINT NOT NULL,
  photo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospital_settings (
  id INT PRIMARY KEY DEFAULT 1,
  hospital_name VARCHAR(150),
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(150),
  google_map_link VARCHAR(500),
  opening_hours VARCHAR(255),
  social_links JSON,
  logo_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 4: Create `scripts/migrate.js`**

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

- [ ] **Step 5: Verify**

```bash
cd backend
npm run migrate
```
Expected output: `Database schema applied successfully to "physio_clinic".` (or whatever `DB_NAME` you set).

Then confirm the 8 tables and 2 roles exist, e.g.:
```bash
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "USE physio_clinic; SHOW TABLES; SELECT * FROM roles;"
```
Expected: `roles, users, doctors, appointments, services, testimonials, hospital_settings, contact_messages` listed, and `roles` containing `admin` and `staff` rows.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/db.js backend/src/config/schema.sql backend/scripts/migrate.js
git commit -m "Add MySQL pool, full schema, and migration script"
```
(`.env` stays untracked per `.gitignore`.)

---

### Task 4: Role/User repositories and admin seed script

**Files:**
- Create: `backend/src/repositories/roleRepository.js`
- Create: `backend/src/repositories/userRepository.js`
- Create: `backend/scripts/seedAdmin.js`

**Interfaces:**
- Consumes: `pool` from `backend/src/config/db.js` (Task 3); `env` from `backend/src/config/env.js` (Task 1).
- Produces: `findRoleByName(name)` and `findRoleById(id)` named exports from `roleRepository.js`, each resolving to `{ id, name } | null`.
- Produces: `findUserByUsername(username)`, `findUserById(id)`, `createUser({ roleId, name, mobile, email, username, passwordHash })` named exports from `userRepository.js`. `findUserByUsername` resolves to `{ id, role_id, role, name, mobile, email, username, password_hash, active, created_at, updated_at } | null` (includes `password_hash` — used only by the auth service for the bcrypt compare). `findUserById` resolves to the same shape minus `password_hash`. `createUser` resolves to the new row's numeric `id`.

- [ ] **Step 1: Create `src/repositories/roleRepository.js`**

```js
import pool from '../config/db.js';

export async function findRoleByName(name) {
  const [rows] = await pool.query('SELECT id, name FROM roles WHERE name = :name', { name });
  return rows[0] ?? null;
}

export async function findRoleById(id) {
  const [rows] = await pool.query('SELECT id, name FROM roles WHERE id = :id', { id });
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Create `src/repositories/userRepository.js`**

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

- [ ] **Step 3: Create `scripts/seedAdmin.js`**

```js
import bcrypt from 'bcrypt';
import env from '../src/config/env.js';
import pool from '../src/config/db.js';
import { findRoleByName } from '../src/repositories/roleRepository.js';
import { findUserByUsername, createUser } from '../src/repositories/userRepository.js';

async function seedAdmin() {
  const existing = await findUserByUsername(env.ADMIN_USERNAME);
  if (existing) {
    console.log(`Admin user "${env.ADMIN_USERNAME}" already exists. Skipping.`);
    return;
  }

  const adminRole = await findRoleByName('admin');
  if (!adminRole) {
    throw new Error('Admin role not found. Run "npm run migrate" first.');
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const id = await createUser({
    roleId: adminRole.id,
    name: env.ADMIN_NAME,
    mobile: null,
    email: null,
    username: env.ADMIN_USERNAME,
    passwordHash,
  });

  console.log(`Admin user "${env.ADMIN_USERNAME}" created with id ${id}.`);
}

seedAdmin()
  .catch((err) => {
    console.error('Seeding admin failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
```

- [ ] **Step 4: Verify**

```bash
cd backend
npm run seed:admin
npm run seed:admin
```
Expected first run: `Admin user "admin" created with id 1.`
Expected second run: `Admin user "admin" already exists. Skipping.`

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories backend/scripts/seedAdmin.js
git commit -m "Add role/user repositories and admin seed script"
```

---

### Task 5: Auth validators and auth middlewares

**Files:**
- Create: `backend/src/validators/authValidators.js`
- Create: `backend/src/middlewares/validate.js`
- Create: `backend/src/middlewares/authenticate.js`
- Create: `backend/src/middlewares/authorize.js`

**Interfaces:**
- Consumes: `env` and `AppError` from Task 1.
- Produces: `loginSchema` (a zod object schema requiring `username` (string, min 3) and `password` (string, min 6)) named export from `authValidators.js`.
- Produces: `validate(schema)` named export from `validate.js` — Express middleware factory; on failure calls `next(new AppError('Validation failed', 400, fieldErrors))`, on success replaces `req.body` with the parsed value.
- Produces: `authenticate(req, res, next)` named export from `authenticate.js` — reads `req.cookies.token`, verifies it, sets `req.user = { id, role }`, else calls `next(new AppError(..., 401))`.
- Produces: `authorize(...allowedRoles)` named export from `authorize.js` — Express middleware factory; `403` via `AppError` if `req.user.role` isn't in `allowedRoles`.

- [ ] **Step 1: Create `src/validators/authValidators.js`**

```js
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
```

- [ ] **Step 2: Create `src/middlewares/validate.js`**

```js
import AppError from '../utils/AppError.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return next(new AppError('Validation failed', 400, fieldErrors));
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 3: Create `src/middlewares/authenticate.js`**

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

- [ ] **Step 4: Create `src/middlewares/authorize.js`**

```js
import AppError from '../utils/AppError.js';

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}
```

- [ ] **Step 5: Verify**

```bash
cd backend
node --input-type=module -e "
import { loginSchema } from './src/validators/authValidators.js';
import { validate } from './src/middlewares/validate.js';
import { authenticate } from './src/middlewares/authenticate.js';
import { authorize } from './src/middlewares/authorize.js';
console.log(typeof loginSchema.safeParse, typeof validate, typeof authenticate, typeof authorize);
console.log(loginSchema.safeParse({ username: 'ab', password: '123' }).success);
"
```
Expected output:
```
function function function function
false
```
(the second line is `false` because `username: 'ab'` is under the 3-character minimum)

- [ ] **Step 6: Commit**

```bash
git add backend/src/validators backend/src/middlewares/validate.js backend/src/middlewares/authenticate.js backend/src/middlewares/authorize.js
git commit -m "Add auth validators and authenticate/authorize/validate middlewares"
```

---

### Task 6: Auth service, controller, routes — wire up login/me/logout

**Files:**
- Create: `backend/src/services/authService.js`
- Create: `backend/src/controllers/authController.js`
- Create: `backend/src/routes/authRoutes.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `findUserByUsername`, `findUserById` from `userRepository.js` (Task 4); `AppError` (Task 1); `env` (Task 1); `loginSchema` (Task 5); `validate`, `authenticate`, `loginLimiter` (Tasks 5 & 2); `asyncHandler`, `sendResponse` (Task 1).
- Produces: `login({ username, password })` and `getCurrentUser(userId)` named exports from `authService.js`. `login` resolves to `{ token, user }` where `user` is `{ id, name, username, role, email, mobile }`; throws `AppError(401)` on bad credentials or inactive user. `getCurrentUser` resolves to the same `user` shape; throws `AppError(401)` if the user is missing/inactive.
- Produces: `login`, `me`, `logout` named exports (Express handlers) from `authController.js`.
- Produces: default export Express `Router` from `authRoutes.js` with `POST /login`, `GET /me`, `POST /logout`.

- [ ] **Step 1: Create `src/services/authService.js`**

```js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import { findUserByUsername, findUserById } from '../repositories/userRepository.js';

function toPublicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    email: user.email,
    mobile: user.mobile,
  };
}

export async function login({ username, password }) {
  const user = await findUserByUsername(username);
  if (!user || !user.active) {
    throw new AppError('Invalid username or password.', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError('Invalid username or password.', 401);
  }

  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { token, user: toPublicProfile(user) };
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);
  if (!user || !user.active) {
    throw new AppError('Your session is no longer valid.', 401);
  }
  return toPublicProfile(user);
}
```

- [ ] **Step 2: Create `src/controllers/authController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import env from '../config/env.js';
import * as authService from '../services/authService.js';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

export const login = asyncHandler(async (req, res) => {
  const { token, user } = await authService.login(req.body);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  sendResponse(res, { status: 200, message: 'Login successful', data: user });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  sendResponse(res, { status: 200, message: 'Current user', data: user });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  sendResponse(res, { status: 200, message: 'Logged out successfully' });
});
```

- [ ] **Step 3: Create `src/routes/authRoutes.js`**

```js
import { Router } from 'express';
import { login, me, logout } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema } from '../validators/authValidators.js';
import { loginLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

export default router;
```

- [ ] **Step 4: Modify `src/routes/index.js`** to mount the auth routes

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

- [ ] **Step 5: Verify — full login/me/logout flow**

```bash
cd backend
npm start &
sleep 1

echo "--- wrong password ---"
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpass"}'

echo "\n--- correct login ---"
curl -s -c /tmp/cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}'

echo "\n--- /me with cookie ---"
curl -s -b /tmp/cookies.txt http://localhost:5000/api/auth/me

echo "\n--- /me without cookie ---"
curl -s http://localhost:5000/api/auth/me

echo "\n--- logout ---"
curl -s -X POST -b /tmp/cookies.txt -c /tmp/cookies.txt http://localhost:5000/api/auth/logout

echo "\n--- /me after logout (cookie cleared) ---"
curl -s -b /tmp/cookies.txt http://localhost:5000/api/auth/me

kill %1
rm -f /tmp/cookies.txt
```

Expected:
- wrong password → `{"success":false,"message":"Invalid username or password.","errors":null}`
- correct login → `{"success":true,"message":"Login successful","data":{"id":1,"name":"Administrator","username":"admin","role":"admin","email":null,"mobile":null}}`
- `/me` with cookie → `{"success":true,"message":"Current user","data":{...same user...}}`
- `/me` without cookie → `{"success":false,"message":"You must be logged in to access this resource.","errors":null}`
- logout → `{"success":true,"message":"Logged out successfully","data":null}`
- `/me` after logout → `{"success":false,"message":"You must be logged in to access this resource.","errors":null}`

(Use the `ADMIN_USERNAME`/`ADMIN_PASSWORD` you actually set in `backend/.env` if different from the defaults.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/authService.js backend/src/controllers/authController.js backend/src/routes/authRoutes.js backend/src/routes/index.js
git commit -m "Wire up login/me/logout auth flow"
```

---

### Task 7: Frontend scaffold with Tailwind CSS v4

**Files:**
- Create: `frontend/` (via `npm create vite@latest`)
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/.env.example`
- Create: `frontend/.env`

**Interfaces:**
- Produces: a working Vite dev server on port 5173 serving a Tailwind-styled placeholder page. No JS interfaces consumed by later tasks yet (Task 8 builds on the scaffolded project structure only).

- [ ] **Step 1: Scaffold the Vite React project**

From the repo root:
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

- [ ] **Step 2: Confirm React 19, upgrade if not**

```bash
node -e "console.log(require('./package.json').dependencies.react)"
```
If it does not print `^19.x.x`, run:
```bash
npm install react@^19 react-dom@^19
```

- [ ] **Step 3: Install app dependencies**

```bash
npm install react-router-dom axios @tanstack/react-query react-hook-form react-hot-toast
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 4: Modify `vite.config.js`** to add the Tailwind plugin

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 5: Replace `src/index.css`** with the Tailwind import

```css
@import "tailwindcss";
```

- [ ] **Step 6: Replace `src/App.jsx`** with a Tailwind smoke-test placeholder

```jsx
export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <h1 className="text-3xl font-bold text-blue-700">Physiotherapy Clinic — Frontend Ready</h1>
    </div>
  );
}
```

- [ ] **Step 7: Create `.env.example` and `.env`**

```
VITE_API_URL=http://localhost:5000/api
```
```bash
cp .env.example .env
```

- [ ] **Step 8: Verify**

```bash
cd frontend
npm run dev &
sleep 2
curl -s http://localhost:5173/ | grep -o '<div id="root"></div>'
curl -s http://localhost:5173/src/App.jsx | grep -o "Physiotherapy Clinic"
kill %1
```
Expected: first curl prints `<div id="root"></div>`, second prints `Physiotherapy Clinic`.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "Frontend scaffold: Vite + React 19 + Tailwind CSS v4"
```

---

### Task 8: Frontend API layer, AuthContext, ProtectedRoute

**Files:**
- Create: `frontend/src/services/api.js`
- Create: `frontend/src/services/authService.js`
- Create: `frontend/src/contexts/AuthContext.jsx`
- Create: `frontend/src/routes/ProtectedRoute.jsx`

**Interfaces:**
- Consumes: `VITE_API_URL` env var (Task 7).
- Produces: default export `api` (configured Axios instance, `withCredentials: true`) from `services/api.js`.
- Produces: `loginRequest({ username, password })`, `fetchCurrentUser()`, `logoutRequest()` named exports from `services/authService.js` — thin wrappers around `api` calling `/auth/login`, `/auth/me`, `/auth/logout` and unwrapping `response.data.data`.
- Produces: `AuthProvider` and `useAuth()` named exports from `contexts/AuthContext.jsx`. `useAuth()` returns `{ user, isLoading, login(credentials), logout() }`; `user` is `null` when logged out, otherwise `{ id, name, username, role, email, mobile }`.
- Produces: default export `ProtectedRoute({ roles })` from `routes/ProtectedRoute.jsx` — an Outlet-rendering route guard; redirects to `/login` if unauthenticated or (when `roles` is given) if `user.role` isn't included.

- [ ] **Step 1: Create `src/services/api.js`**

```js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default api;
```

- [ ] **Step 2: Create `src/services/authService.js`**

```js
import api from './api.js';

export async function loginRequest({ username, password }) {
  const { data } = await api.post('/auth/login', { username, password });
  return data.data;
}

export async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function logoutRequest() {
  await api.post('/auth/logout');
}
```

- [ ] **Step 3: Create `src/contexts/AuthContext.jsx`**

```jsx
import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, loginRequest, logoutRequest } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: Infinity,
  });

  async function login(credentials) {
    const loggedInUser = await loginRequest(credentials);
    queryClient.setQueryData(['currentUser'], loggedInUser);
    return loggedInUser;
  }

  async function logout() {
    await logoutRequest();
    queryClient.setQueryData(['currentUser'], null);
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 4: Create `src/routes/ProtectedRoute.jsx`**

```jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ roles }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 5: Verify — project builds with no import/syntax errors**

```bash
cd frontend
npm run build
```
Expected: build completes successfully (`✓ built in ...`), no errors. (`App.jsx` doesn't reference these new modules yet — this step only proves they're syntactically valid and their imports resolve; end-to-end behavior is verified in Task 9.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services frontend/src/contexts frontend/src/routes
git commit -m "Add frontend API layer, AuthContext, and ProtectedRoute"
```

---

### Task 9: Login page, admin shell, routing — full login walkthrough

**Files:**
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/NotFound.jsx`
- Create: `frontend/src/pages/admin/AdminHome.jsx`
- Create: `frontend/src/layouts/AdminLayout.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/main.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 8), `ProtectedRoute` (Task 8), `AuthProvider` (Task 8).
- Produces: the complete Phase 1 frontend route table: `/` → redirect to `/login`, `/login` → `Login`, `/admin` (protected) → `AdminLayout` with index route `AdminHome`, `*` → `NotFound`.

- [ ] **Step 1: Create `src/pages/Login.jsx`**

```jsx
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  async function onSubmit(values) {
    try {
      await login(values);
      navigate('/admin', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed. Please try again.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-semibold text-blue-700">
          Clinic Admin Login
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('username', { required: 'Username is required' })}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/NotFound.jsx`**

```jsx
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-600">
      <h1 className="text-3xl font-bold">404</h1>
      <p>Page not found.</p>
      <Link to="/login" className="text-blue-600 hover:underline">
        Back to login
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/layouts/AdminLayout.jsx`**

```jsx
import { Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    toast.success('Logged out successfully');
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

- [ ] **Step 4: Create `src/pages/admin/AdminHome.jsx`**

```jsx
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function AdminHome() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Welcome, {user?.name}</h1>
      <p className="mt-2 text-slate-500">
        The full dashboard is built in a later phase. Login is working.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/App.jsx`**

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

- [ ] **Step 6: Replace `src/main.jsx`**

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 7: Automated smoke check — both servers up, login page renders**

```bash
cd backend && npm start &
sleep 1
cd ../frontend && npm run dev &
sleep 2
curl -s http://localhost:5173/src/pages/Login.jsx | grep -o "Clinic Admin Login"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin
kill %1 %2
```
Expected: first curl prints `Clinic Admin Login`; second curl prints `200` (Vite serves the SPA shell for any path — the client-side redirect to `/login` happens in the browser, not at the HTTP layer).

- [ ] **Step 8: Manual browser verification (do this yourself — no headless browser is installed)**

With both `npm run dev` (frontend, port 5173) and `npm start` (backend, port 5000) running:
1. Visit `http://localhost:5173/admin` while logged out → you should be redirected to `/login`.
2. Log in with your seeded admin credentials → you should land on `/admin` and see "Welcome, Administrator" (or your `ADMIN_NAME`).
3. Refresh the page → you should stay logged in (the `/auth/me` cookie check keeps the session).
4. Click "Logout" → you should see a success toast and be redirected to `/login`.
5. Try logging in with a wrong password → you should see an error toast and stay on `/login`.

Confirm with the user that this walkthrough passes before considering Phase 1 done.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages frontend/src/layouts frontend/src/App.jsx frontend/src/main.jsx
git commit -m "Add login page, admin shell, and full auth routing"
```

---

## Self-Review Notes

- **Spec coverage:** repo layout (Task 1, 7), all 8 DB tables (Task 3), roles+users tables with seeded admin (Tasks 3–4), login/me/logout with httpOnly JWT cookie (Tasks 5–6), rate limiting + helmet + cors + zod validation + parameterized SQL (Tasks 2, 3, 5), frontend stack — Vite/React 19/Router/Tailwind/Axios/React Query/React Hook Form (Tasks 7–9), protected `/admin` route + toasts + loading/error handling (Tasks 8–9). All Phase 1 design sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO markers; every step has runnable commands or complete file contents.
- **Type/name consistency checked:** `env` fields used identically across Tasks 1–6; `pool` from Task 3 imported the same way in Tasks 4; `AppError(message, statusCode, errors)` signature consistent in Tasks 2, 5, 6; `authService.login`/`getCurrentUser` return shape (`{id, name, username, role, email, mobile}`) matches what `authController.js` and the frontend `authService.js`/`AuthContext` expect; `useAuth()` return shape (`{user, isLoading, login, logout}`) matches usage in `Login.jsx`, `AdminLayout.jsx`, `ProtectedRoute.jsx`.
