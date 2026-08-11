# Video Consultation with Razorpay Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, paid video-consultation booking flow (pick doctor + date/time, pay via Razorpay, receive that doctor's Zoom link) built on a standalone, gateway-agnostic payment module and a standalone video-consultation module — plus an admin list to manage bookings and per-doctor fee/Zoom-link configuration.

**Architecture:** Same layered backend as the rest of the app (`routes → middlewares → controllers → services → repositories → mysql2`). A new `backend/src/payments/` library (no HTTP routes of its own) exposes `createOrder()`/`verifyAndCapture()` against a generic `payments` table, behind a gateway factory (`razorpay` today, swappable later). A new `video_consultations` module consumes that library the same way any future feature (e.g. `appointments`) could. Frontend mirrors this with a small `payments/` adapter folder plus a standard service+hook+page set for video consultations.

**Tech Stack:** Same as the rest of the app — Express, mysql2, zod, express-rate-limit; React 19, React Hook Form, TanStack Query, react-hot-toast, axios. New dependency: `razorpay` (backend only, official SDK). Razorpay Checkout is loaded via a script tag on the frontend — no new frontend package.

## Global Constraints

- Layered architecture: Controller → Service → Repository → MySQL. No ORM. All SQL parameterized via `mysql2` named placeholders.
- The payment module (`backend/src/payments/`) has **no public HTTP routes** — it's a service library only. The amount charged is always computed server-side by the calling feature module, never accepted from the client.
- `doctors.video_consultation_zoom_link` must **never** appear in any public/unauthenticated API response. It's only revealed inside the response of the payment-verify endpoint, after payment is confirmed.
- Test/live Razorpay credentials are both present in `.env` at once (`_TEST`/`_LIVE` suffixes); a single `PAYMENT_MODE=test|live` env var picks which pair is active. No admin-UI toggle.
- Video consultations are a fully separate module from `appointments` — own table, own admin list page, no merge into the existing appointments code.
- No automated test suite in this project (established convention). Every task ends with manual verification: standalone Node scripts against the real DB for repository/service layers, curl for the HTTP layer, `npm run build` for not-yet-wired frontend modules, and a live browser walkthrough for the final capstone task.
- Consistent JSON envelope on every response: `{success, message, data}` / `{success, message, errors}` — reuse the existing `sendResponse`, `AppError`, `errorHandler`.
- This project has no incremental-migration mechanism — `migrate.js` re-runs `schema.sql` verbatim (which only creates brand-new tables via `CREATE TABLE IF NOT EXISTS`) and separately runs guarded `ALTER TABLE` checks (via `information_schema.COLUMNS`) for columns added to already-existing tables.

---

### Task 1: Schema, env config, and package setup

**Files:**
- Modify: `backend/src/config/schema.sql`
- Modify: `backend/scripts/migrate.js`
- Modify: `backend/src/config/env.js`
- Modify: `backend/.env` (local file, not committed)
- Modify: `backend/.env.example`
- Modify: `backend/package.json` (via `npm install`)

**Interfaces:**
- Produces: `payments` table (`id, payable_type, payable_id, gateway, gateway_order_id, gateway_payment_id, amount, currency, status, receipt, created_at, updated_at`), `video_consultations` table (`id, patient_name, mobile, email, doctor_id, consultation_date, consultation_time, problem_description, payment_id, status, zoom_link, created_at, updated_at`), and two new nullable columns on `doctors` (`video_consultation_fee DECIMAL(10,2)`, `video_consultation_zoom_link VARCHAR(500)`).
- Produces: `env.PAYMENT_MODE`, `env.PAYMENT_GATEWAY`, `env.RAZORPAY_KEY_ID`, `env.RAZORPAY_KEY_SECRET` on the `env` default export — later tasks import these directly, never `process.env` for Razorpay config.

- [ ] **Step 1: Modify `backend/src/config/schema.sql`** — add two columns to `doctors`

Current `doctors` table:
```sql
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
```

Replace with:
```sql
CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  qualification VARCHAR(150),
  specialization VARCHAR(150),
  experience_years INT,
  photo_url VARCHAR(255),
  consultation_fee DECIMAL(10,2),
  video_consultation_fee DECIMAL(10,2),
  video_consultation_zoom_link VARCHAR(500),
  working_days VARCHAR(100),
  available_time VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: Modify `backend/src/config/schema.sql`** — append two new tables at the end of the file (after the `site_content` table)

```sql

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payable_type VARCHAR(50) NOT NULL,
  payable_id INT NOT NULL,
  gateway VARCHAR(30) NOT NULL,
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  receipt VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_payable (payable_type, payable_id)
);

CREATE TABLE IF NOT EXISTS video_consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  doctor_id INT NOT NULL,
  consultation_date DATE NOT NULL,
  consultation_time VARCHAR(20) NOT NULL,
  problem_description TEXT,
  payment_id INT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
  zoom_link VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);
```

(`payments` is defined before `video_consultations` in the file since `video_consultations.payment_id` has a `FOREIGN KEY` referencing it, and `schema.sql` runs as one multi-statement script — table order matters.)

- [ ] **Step 3: Modify `backend/scripts/migrate.js`** — add guarded `ALTER TABLE` checks for the two new `doctors` columns

Find this block (the existing `service_id` guard):
```js
    const [existingColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'service_id'`,
      [env.DB_NAME]
    );
    if (existingColumns.length === 0) {
      await connection.query('ALTER TABLE appointments ADD COLUMN service_id INT AFTER doctor_id');
      await connection.query(
        'ALTER TABLE appointments ADD CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL'
      );
      console.log('Added service_id column to appointments.');
    }
```

Add this new block directly after it (still inside the `try` block, before the `hospital_settings` guards):
```js

    const [existingVideoFeeColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'doctors' AND COLUMN_NAME = 'video_consultation_fee'`,
      [env.DB_NAME]
    );
    if (existingVideoFeeColumn.length === 0) {
      await connection.query('ALTER TABLE doctors ADD COLUMN video_consultation_fee DECIMAL(10,2) AFTER consultation_fee');
      await connection.query(
        'ALTER TABLE doctors ADD COLUMN video_consultation_zoom_link VARCHAR(500) AFTER video_consultation_fee'
      );
      console.log('Added video_consultation_fee and video_consultation_zoom_link columns to doctors.');
    }
```

- [ ] **Step 4: Modify `backend/src/config/env.js`** — add `PAYMENT_MODE`-resolved Razorpay config

Current content:
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

Replace with:
```js
import dotenv from 'dotenv';

dotenv.config();

const PAYMENT_MODE = process.env.PAYMENT_MODE || 'test';
const isLiveMode = PAYMENT_MODE === 'live';

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
  PAYMENT_MODE,
  PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || 'razorpay',
  RAZORPAY_KEY_ID: isLiveMode ? process.env.RAZORPAY_KEY_ID_LIVE : process.env.RAZORPAY_KEY_ID_TEST,
  RAZORPAY_KEY_SECRET: isLiveMode ? process.env.RAZORPAY_KEY_SECRET_LIVE : process.env.RAZORPAY_KEY_SECRET_TEST,
};

export default env;
```

- [ ] **Step 5: Modify `backend/.env`** — rename the existing Razorpay vars to `_TEST`, add the mode switch and empty `_LIVE` slots

Run (renames keys only, values are preserved and never printed):
```bash
cd backend
sed -i.bak 's/^RAZORPAY_KEY_ID=/RAZORPAY_KEY_ID_TEST=/' .env
sed -i.bak 's/^RAZORPAY_KEY_SECRET=/RAZORPAY_KEY_SECRET_TEST=/' .env
rm .env.bak
cat >> .env << 'EOF'

PAYMENT_MODE=test
PAYMENT_GATEWAY=razorpay
RAZORPAY_KEY_ID_LIVE=
RAZORPAY_KEY_SECRET_LIVE=
EOF
```

- [ ] **Step 6: Modify `backend/.env.example`** — document the new vars

Append to the end of the file:
```
PAYMENT_MODE=test
PAYMENT_GATEWAY=razorpay

RAZORPAY_KEY_ID_TEST=
RAZORPAY_KEY_SECRET_TEST=
RAZORPAY_KEY_ID_LIVE=
RAZORPAY_KEY_SECRET_LIVE=
```

- [ ] **Step 7: Install the Razorpay SDK**

```bash
cd backend
npm install razorpay
```

- [ ] **Step 8: Verify — run the migration and confirm env resolution**

```bash
cd backend
npm run migrate
```
Expected output includes: `Added video_consultation_fee and video_consultation_zoom_link columns to doctors.` (only on first run against an existing DB — silent on a fresh DB since `schema.sql` already has the columns).

Then confirm the schema landed:
```bash
node --input-type=module -e "
import pool from './src/config/db.js';
const [cols] = await pool.query(\"SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'doctors' AND COLUMN_NAME LIKE 'video_consultation%'\");
console.log('doctors video columns:', cols.map(c => c.COLUMN_NAME));
const [tables] = await pool.query(\"SHOW TABLES LIKE 'payments'\");
console.log('payments table exists:', tables.length === 1);
const [tables2] = await pool.query(\"SHOW TABLES LIKE 'video_consultations'\");
console.log('video_consultations table exists:', tables2.length === 1);
await pool.end();
"
```
Expected:
```
doctors video columns: [ 'video_consultation_fee', 'video_consultation_zoom_link' ]
payments table exists: true
video_consultations table exists: true
```

Then confirm env resolution picks the test pair correctly:
```bash
node --input-type=module -e "
import env from './src/config/env.js';
console.log('PAYMENT_MODE:', env.PAYMENT_MODE);
console.log('PAYMENT_GATEWAY:', env.PAYMENT_GATEWAY);
console.log('RAZORPAY_KEY_ID starts with rzp_test_:', env.RAZORPAY_KEY_ID?.startsWith('rzp_test_'));
console.log('RAZORPAY_KEY_SECRET is set:', Boolean(env.RAZORPAY_KEY_SECRET));
"
```
Expected: `PAYMENT_MODE: test`, `PAYMENT_GATEWAY: razorpay`, `RAZORPAY_KEY_ID starts with rzp_test_: true`, `RAZORPAY_KEY_SECRET is set: true`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/config/schema.sql backend/scripts/migrate.js backend/src/config/env.js backend/.env.example backend/package.json backend/package-lock.json
git commit -m "Add payments/video_consultations schema, PAYMENT_MODE env config, razorpay dependency"
```

(`.env` is gitignored — it is not part of this commit.)

---

### Task 2: Payment gateway abstraction (Razorpay adapter)

**Files:**
- Create: `backend/src/payments/gateways/PaymentGateway.js`
- Create: `backend/src/payments/gateways/razorpayGateway.js`
- Create: `backend/src/payments/gateways/index.js`

**Interfaces:**
- Consumes: `env.RAZORPAY_KEY_ID`, `env.RAZORPAY_KEY_SECRET`, `env.PAYMENT_GATEWAY` from `backend/src/config/env.js` (Task 1).
- Produces: `getGateway()` named export from `gateways/index.js`, returning an object with `async createOrder({ amount, currency, receipt, notes }) → { gatewayOrderId, amount, currency, raw }`, `async verifyPayment({ gatewayOrderId, gatewayPaymentId, signature }) → boolean`, `getPublicConfig() → { keyId }`. This is the only surface Task 3 depends on — swapping vendors later means writing one new file implementing the same three methods and adding one line to the `gateways` map in `index.js`.

- [ ] **Step 1: Create `backend/src/payments/gateways/PaymentGateway.js`**

```js
export class PaymentGateway {
  async createOrder(_params) {
    throw new Error('createOrder() not implemented');
  }

  async verifyPayment(_params) {
    throw new Error('verifyPayment() not implemented');
  }

  getPublicConfig() {
    throw new Error('getPublicConfig() not implemented');
  }
}
```

- [ ] **Step 2: Create `backend/src/payments/gateways/razorpayGateway.js`**

```js
import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import { PaymentGateway } from './PaymentGateway.js';

class RazorpayGateway extends PaymentGateway {
  constructor() {
    super();
    this.client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }

  async createOrder({ amount, currency = 'INR', receipt, notes }) {
    const order = await this.client.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes,
    });
    return { gatewayOrderId: order.id, amount, currency: order.currency, raw: order };
  }

  async verifyPayment({ gatewayOrderId, gatewayPaymentId, signature }) {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');
    return expectedSignature === signature;
  }

  getPublicConfig() {
    return { keyId: env.RAZORPAY_KEY_ID };
  }
}

export default new RazorpayGateway();
```

- [ ] **Step 3: Create `backend/src/payments/gateways/index.js`**

```js
import env from '../../config/env.js';
import razorpayGateway from './razorpayGateway.js';

const gateways = {
  razorpay: razorpayGateway,
};

export function getGateway() {
  const gateway = gateways[env.PAYMENT_GATEWAY];
  if (!gateway) {
    throw new Error(`Unknown payment gateway: ${env.PAYMENT_GATEWAY}`);
  }
  return gateway;
}
```

- [ ] **Step 4: Verify — standalone script against the real Razorpay test API**

Create `backend/scripts/tmp-verify-gateway.mjs`:
```js
import { getGateway } from '../src/payments/gateways/index.js';

async function main() {
  const gateway = getGateway();

  console.log('public config:', gateway.getPublicConfig());

  const order = await gateway.createOrder({
    amount: 500,
    currency: 'INR',
    receipt: 'tmp_verify_receipt_1',
  });
  console.log('created order id:', order.gatewayOrderId, 'amount (rupees):', order.amount, 'currency:', order.currency);

  const validWithWrongSignature = await gateway.verifyPayment({
    gatewayOrderId: order.gatewayOrderId,
    gatewayPaymentId: 'pay_fake_id_for_verify_test',
    signature: 'not-a-real-signature',
  });
  console.log('verify with wrong signature returns false:', validWithWrongSignature === false);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
```

Run:
```bash
cd backend
node scripts/tmp-verify-gateway.mjs
```
Expected output:
```
public config: { keyId: 'rzp_test_...' }
created order id: order_... amount (rupees): 500 currency: INR
verify with wrong signature returns false: true
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-gateway.mjs
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/payments/gateways
git commit -m "Add Razorpay payment gateway adapter behind a vendor-agnostic factory"
```

---

### Task 3: Generic payment service (`payments` module)

**Files:**
- Create: `backend/src/payments/paymentRepository.js`
- Create: `backend/src/payments/paymentService.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js`; `getGateway()` from `gateways/index.js` (Task 2); `env.PAYMENT_GATEWAY` from `backend/src/config/env.js`; `AppError` (default export) from `backend/src/utils/AppError.js`.
- Produces (from `paymentService.js`, the only file feature modules import from this whole `payments/` directory): `async createOrder({ payableType, payableId, amount, currency = 'INR', receipt, notes }) → { paymentId, gatewayOrderId, amount, currency, keyId }`; `async verifyAndCapture({ gatewayOrderId, gatewayPaymentId, signature }) → paymentRow` (the full DB row, including `payable_type`/`payable_id`) — throws `AppError('Payment order not found.', 404)` if no matching payment, or `AppError('Payment verification failed.', 400)` if the signature is invalid (after still recording the row as `status: 'failed'`).

- [ ] **Step 1: Create `backend/src/payments/paymentRepository.js`**

```js
import pool from '../config/db.js';

export async function create(payment) {
  const [result] = await pool.query(
    `INSERT INTO payments (payable_type, payable_id, gateway, amount, currency, status, receipt)
     VALUES (:payable_type, :payable_id, :gateway, :amount, :currency, :status, :receipt)`,
    payment
  );
  return result.insertId;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function findByGatewayOrderId(gatewayOrderId) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE gateway_order_id = :gatewayOrderId', { gatewayOrderId });
  return rows[0] ?? null;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE payments SET ${setClause} WHERE id = :id`, { ...fields, id });
}
```

- [ ] **Step 2: Create `backend/src/payments/paymentService.js`**

```js
import AppError from '../utils/AppError.js';
import env from '../config/env.js';
import * as paymentRepository from './paymentRepository.js';
import { getGateway } from './gateways/index.js';

export async function createOrder({ payableType, payableId, amount, currency = 'INR', receipt, notes }) {
  const paymentId = await paymentRepository.create({
    payable_type: payableType,
    payable_id: payableId,
    gateway: env.PAYMENT_GATEWAY,
    amount,
    currency,
    status: 'created',
    receipt,
  });

  const gateway = getGateway();
  const order = await gateway.createOrder({ amount, currency, receipt, notes });
  await paymentRepository.update(paymentId, { gateway_order_id: order.gatewayOrderId });

  const { keyId } = gateway.getPublicConfig();
  return { paymentId, gatewayOrderId: order.gatewayOrderId, amount, currency: order.currency, keyId };
}

export async function verifyAndCapture({ gatewayOrderId, gatewayPaymentId, signature }) {
  const payment = await paymentRepository.findByGatewayOrderId(gatewayOrderId);
  if (!payment) {
    throw new AppError('Payment order not found.', 404);
  }

  const gateway = getGateway();
  const isValid = await gateway.verifyPayment({ gatewayOrderId, gatewayPaymentId, signature });

  await paymentRepository.update(payment.id, {
    gateway_payment_id: gatewayPaymentId,
    status: isValid ? 'paid' : 'failed',
  });

  if (!isValid) {
    throw new AppError('Payment verification failed.', 400);
  }

  return paymentRepository.findById(payment.id);
}
```

- [ ] **Step 3: Verify — standalone script against the real DB and Razorpay test API**

Create `backend/scripts/tmp-verify-payment-service.mjs`:
```js
import * as paymentService from '../src/payments/paymentService.js';
import pool from '../src/config/db.js';

async function main() {
  const order = await paymentService.createOrder({
    payableType: 'tmp_verify',
    payableId: 999,
    amount: 750,
    currency: 'INR',
    receipt: 'tmp_verify_ps_1',
  });
  console.log('order created:', { hasPaymentId: Boolean(order.paymentId), hasGatewayOrderId: Boolean(order.gatewayOrderId), amount: order.amount, keyId: order.keyId?.startsWith('rzp_') });

  try {
    await paymentService.verifyAndCapture({
      gatewayOrderId: order.gatewayOrderId,
      gatewayPaymentId: 'pay_fake_for_verify_test',
      signature: 'not-a-real-signature',
    });
    console.log('ERROR: expected verification to throw, but it did not');
  } catch (err) {
    console.log('verify with bad signature threw as expected:', err.statusCode, err.message);
  }

  try {
    await paymentService.verifyAndCapture({
      gatewayOrderId: 'order_does_not_exist',
      gatewayPaymentId: 'pay_x',
      signature: 'sig_x',
    });
    console.log('ERROR: expected 404, but no error was thrown');
  } catch (err) {
    console.log('verify with unknown order threw as expected:', err.statusCode, err.message);
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
node scripts/tmp-verify-payment-service.mjs
```
Expected output:
```
order created: { hasPaymentId: true, hasGatewayOrderId: true, amount: 750, keyId: true }
verify with bad signature threw as expected: 400 Payment verification failed.
verify with unknown order threw as expected: 404 Payment order not found.
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-payment-service.mjs
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/payments/paymentRepository.js backend/src/payments/paymentService.js
git commit -m "Add generic payment service (payments table, order creation, signature verification)"
```

---

### Task 4: Doctor module extension (video consultation fee + Zoom link)

**Files:**
- Modify: `backend/src/validators/doctorValidators.js`
- Modify: `backend/src/repositories/doctorRepository.js`
- Modify: `backend/src/services/doctorService.js`

**Interfaces:**
- Consumes: nothing new — extends the existing doctor CRUD.
- Produces: `doctorSchema` now accepts `video_consultation_fee` and `video_consultation_zoom_link`; `doctorRepository.create`/`update` persist them; **`doctorService.listPublicDoctors()` now strips `video_consultation_zoom_link` from every row before returning** — this is the enforcement point for the "never expose the Zoom link publicly" constraint. `doctorService.listDoctors()` (the authenticated admin/staff listing) is unchanged and still returns the raw link. This task must land before any later task that expects a doctor row to actually carry a usable fee/Zoom link (video consultation repository/service verification scripts, and the video consultation HTTP API's curl walkthrough, all create fixture doctors with these fields set).

- [ ] **Step 1: Modify `backend/src/validators/doctorValidators.js`**

Current content:
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

Replace with:
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
  video_consultation_fee: z.coerce.number().min(0).optional(),
  video_consultation_zoom_link: z.string().url('Enter a valid URL').optional(),
  working_days: z.string().optional(),
  available_time: z.string().optional(),
  active: booleanFromString,
});
```

- [ ] **Step 2: Modify `backend/src/repositories/doctorRepository.js`**

Current `create`:
```js
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
```

Replace with:
```js
export async function create(doctor) {
  const [result] = await pool.query(
    `INSERT INTO doctors
      (name, qualification, specialization, experience_years, photo_url, consultation_fee, video_consultation_fee, video_consultation_zoom_link, working_days, available_time, active)
     VALUES
      (:name, :qualification, :specialization, :experience_years, :photo_url, :consultation_fee, :video_consultation_fee, :video_consultation_zoom_link, :working_days, :available_time, :active)`,
    doctor
  );
  return result.insertId;
}
```

Current `update`:
```js
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
```

Replace with:
```js
export async function update(id, doctor) {
  await pool.query(
    `UPDATE doctors SET
      name = :name,
      qualification = :qualification,
      specialization = :specialization,
      experience_years = :experience_years,
      photo_url = :photo_url,
      consultation_fee = :consultation_fee,
      video_consultation_fee = :video_consultation_fee,
      video_consultation_zoom_link = :video_consultation_zoom_link,
      working_days = :working_days,
      available_time = :available_time,
      active = :active
     WHERE id = :id`,
    { ...doctor, id }
  );
}
```

- [ ] **Step 3: Modify `backend/src/services/doctorService.js`**

Current `toRow`:
```js
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
```

Replace with:
```js
function toRow(data, photoUrl) {
  return {
    name: data.name,
    qualification: data.qualification ?? null,
    specialization: data.specialization ?? null,
    experience_years: data.experience_years ?? null,
    photo_url: photoUrl,
    consultation_fee: data.consultation_fee ?? null,
    video_consultation_fee: data.video_consultation_fee ?? null,
    video_consultation_zoom_link: data.video_consultation_zoom_link ?? null,
    working_days: data.working_days ?? null,
    available_time: data.available_time ?? null,
    active: data.active ?? true,
  };
}
```

Current `listPublicDoctors`:
```js
export async function listPublicDoctors() {
  return doctorRepository.findActiveOnly();
}
```

Replace with:
```js
export async function listPublicDoctors() {
  const doctors = await doctorRepository.findActiveOnly();
  return doctors.map(({ video_consultation_zoom_link, ...rest }) => rest);
}
```

(This is the enforcement point for "never expose the Zoom link publicly" — `video_consultation_zoom_link` is destructured out and discarded, so the key is entirely absent from every object in the response, not just nulled out.)

- [ ] **Step 4: Verify — curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1

curl -s -c /tmp/doctor-vc-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- admin: create a doctor with video consultation fields (multipart) ---"
DOCTOR_RESP=$(curl -s -b /tmp/doctor-vc-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Dr Video Fields Test" \
  -F "video_consultation_fee=499" \
  -F "video_consultation_zoom_link=https://zoom.us/j/1112223334" \
  -F "active=true")
echo "$DOCTOR_RESP"
DOCTOR_ID=$(echo "$DOCTOR_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
echo "DOCTOR_ID=$DOCTOR_ID"
echo "created doctor has fee and zoom link saved: $(echo "$DOCTOR_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).data;console.log(r.video_consultation_fee == 499 && r.video_consultation_zoom_link === 'https://zoom.us/j/1112223334')})")"

echo "--- public: doctors/public exposes fee but never the zoom link key ---"
curl -s "http://localhost:5000/api/doctors/public" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).data;const doc=r.find(x=>x.id==$DOCTOR_ID);console.log('has fee:', doc.video_consultation_fee != null, 'has zoom_link key:', 'video_consultation_zoom_link' in doc)})"

echo "--- admin: authenticated listing still includes the raw zoom link ---"
curl -s -b /tmp/doctor-vc-cookies.txt "http://localhost:5000/api/doctors/$DOCTOR_ID" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).data;console.log('admin view has zoom link:', r.video_consultation_zoom_link === 'https://zoom.us/j/1112223334')})"

echo "--- cleanup ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/doctor-vc-cookies.txt -X DELETE "http://localhost:5000/api/doctors/$DOCTOR_ID" -o /dev/null

kill %1
rm -f /tmp/doctor-vc-cookies.txt
```

Expected (key checks): doctor creation `201` with `video_consultation_fee`/`video_consultation_zoom_link` correctly saved; `GET /doctors/public` includes `video_consultation_fee` for that doctor but the key `video_consultation_zoom_link` is **absent** entirely from the object; the authenticated `GET /doctors/:id` still returns the raw Zoom link; cleanup delete returns `200`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/validators/doctorValidators.js backend/src/repositories/doctorRepository.js backend/src/services/doctorService.js
git commit -m "Extend doctor module with video consultation fee/Zoom link; never expose link publicly"
```

---

### Task 5: Video consultation repository

**Files:**
- Create: `backend/src/repositories/videoConsultationRepository.js`

**Interfaces:**
- Consumes: `pool` (default export) from `backend/src/config/db.js`.
- Produces: `findAll(filters)`, `findById(id)`, `create(consultation)`, `update(id, fields)`. `filters` is `{ status?, doctorId?, date? }`. `consultation` (for `create`) always has `patient_name, mobile, email, doctor_id, consultation_date, consultation_time, problem_description, status` present — the service layer (Task 6) fills defaults. `create` resolves to the new row's numeric `id`.

- [ ] **Step 1: Create `backend/src/repositories/videoConsultationRepository.js`**

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
    conditions.push('consultation_date = :date');
    params.date = filters.date;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM video_consultations ${whereClause} ORDER BY consultation_date DESC, consultation_time DESC`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM video_consultations WHERE id = :id', { id });
  return rows[0] ?? null;
}

export async function create(consultation) {
  const [result] = await pool.query(
    `INSERT INTO video_consultations
      (patient_name, mobile, email, doctor_id, consultation_date, consultation_time, problem_description, status)
     VALUES
      (:patient_name, :mobile, :email, :doctor_id, :consultation_date, :consultation_time, :problem_description, :status)`,
    consultation
  );
  return result.insertId;
}

export async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((key) => `${key} = :${key}`).join(', ');
  await pool.query(`UPDATE video_consultations SET ${setClause} WHERE id = :id`, { ...fields, id });
}
```

- [ ] **Step 2: Verify — standalone script against the real DB**

Create `backend/scripts/tmp-verify-vc-repo.mjs`:
```js
import * as videoConsultationRepository from '../src/repositories/videoConsultationRepository.js';
import * as doctorRepository from '../src/repositories/doctorRepository.js';
import pool from '../src/config/db.js';

async function main() {
  const doctorId = await doctorRepository.create({
    name: 'VC Verify Fixture Doctor',
    qualification: null,
    specialization: null,
    experience_years: null,
    photo_url: null,
    consultation_fee: null,
    video_consultation_fee: 500,
    video_consultation_zoom_link: 'https://zoom.us/j/1234567890',
    working_days: null,
    available_time: null,
    active: true,
  });

  const id1 = await videoConsultationRepository.create({
    patient_name: 'VC Verify Patient',
    mobile: '9000000010',
    email: null,
    doctor_id: doctorId,
    consultation_date: '2026-09-01',
    consultation_time: '10:00 AM',
    problem_description: null,
    status: 'pending_payment',
  });
  console.log('created id:', id1);

  const fetched = await videoConsultationRepository.findById(id1);
  console.log('fetched status:', fetched.status, 'doctor_id matches:', fetched.doctor_id === doctorId);

  const byStatus = await videoConsultationRepository.findAll({ status: 'pending_payment' });
  console.log('findAll by status includes id1:', byStatus.some((c) => c.id === id1));

  await videoConsultationRepository.update(id1, { status: 'paid', zoom_link: 'https://zoom.us/j/1234567890' });
  const updated = await videoConsultationRepository.findById(id1);
  console.log('updated status:', updated.status, 'zoom_link set:', updated.zoom_link === 'https://zoom.us/j/1234567890');

  await pool.query('DELETE FROM video_consultations WHERE id = :id', { id: id1 });
  await doctorRepository.remove(doctorId);
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
node scripts/tmp-verify-vc-repo.mjs
```
Expected output:
```
created id: <number>
fetched status: pending_payment doctor_id matches: true
findAll by status includes id1: true
updated status: paid zoom_link set: true
cleanup done
```

Then delete the temp script:
```bash
rm scripts/tmp-verify-vc-repo.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/videoConsultationRepository.js
git commit -m "Add video consultation repository"
```

---

### Task 6: Video consultation service

**Files:**
- Create: `backend/src/services/videoConsultationService.js`

**Interfaces:**
- Consumes: `findAll, findById, create, update` from `videoConsultationRepository.js` (Task 5); `findById` from `backend/src/repositories/doctorRepository.js` (existing, extended in Task 4 to carry `video_consultation_fee`/`video_consultation_zoom_link`); `createOrder, verifyAndCapture` from `backend/src/payments/paymentService.js` (Task 3); `AppError` from `backend/src/utils/AppError.js`.
- Produces: `listConsultations(filters)`, `getConsultation(id)` (throws `AppError('Video consultation not found.', 404)` if missing), `createOrder(data)` (validates the doctor offers video consults, creates the `video_consultations` row, creates a payment order, links `payment_id`, returns `{ consultationId, gatewayOrderId, amount, currency, keyId, doctorName }`), `verifyPayment(id, { gatewayOrderId, gatewayPaymentId, signature })` (on success sets `status: 'paid'` and snapshots `zoom_link` from the doctor; on failure sets `status: 'failed'` and rethrows), `updateConsultation(id, data)`.

- [ ] **Step 1: Create `backend/src/services/videoConsultationService.js`**

```js
import AppError from '../utils/AppError.js';
import * as videoConsultationRepository from '../repositories/videoConsultationRepository.js';
import * as doctorRepository from '../repositories/doctorRepository.js';
import * as paymentService from '../payments/paymentService.js';

function toCreateRow(data) {
  return {
    patient_name: data.patient_name,
    mobile: data.mobile,
    email: data.email ?? null,
    doctor_id: data.doctor_id,
    consultation_date: data.consultation_date,
    consultation_time: data.consultation_time,
    problem_description: data.problem_description ?? null,
    status: 'pending_payment',
  };
}

export async function listConsultations(filters) {
  return videoConsultationRepository.findAll(filters);
}

export async function getConsultation(id) {
  const consultation = await videoConsultationRepository.findById(id);
  if (!consultation) {
    throw new AppError('Video consultation not found.', 404);
  }
  return consultation;
}

export async function createOrder(data) {
  const doctor = await doctorRepository.findById(data.doctor_id);
  if (!doctor || !doctor.active) {
    throw new AppError('Selected doctor does not exist.', 400);
  }
  if (!doctor.video_consultation_fee || !doctor.video_consultation_zoom_link) {
    throw new AppError('Selected doctor does not offer video consultations.', 400);
  }

  const consultationId = await videoConsultationRepository.create(toCreateRow(data));

  const payment = await paymentService.createOrder({
    payableType: 'video_consultation',
    payableId: consultationId,
    amount: Number(doctor.video_consultation_fee),
    currency: 'INR',
    receipt: `vc_${consultationId}`,
  });

  await videoConsultationRepository.update(consultationId, { payment_id: payment.paymentId });

  return {
    consultationId,
    gatewayOrderId: payment.gatewayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    keyId: payment.keyId,
    doctorName: doctor.name,
  };
}

export async function verifyPayment(id, { gatewayOrderId, gatewayPaymentId, signature }) {
  const consultation = await getConsultation(id);
  const doctor = await doctorRepository.findById(consultation.doctor_id);

  try {
    await paymentService.verifyAndCapture({ gatewayOrderId, gatewayPaymentId, signature });
  } catch (err) {
    await videoConsultationRepository.update(id, { status: 'failed' });
    throw err;
  }

  await videoConsultationRepository.update(id, {
    status: 'paid',
    zoom_link: doctor.video_consultation_zoom_link,
  });

  return getConsultation(id);
}

export async function updateConsultation(id, data) {
  await getConsultation(id);
  await videoConsultationRepository.update(id, data);
  return getConsultation(id);
}
```

- [ ] **Step 2: Verify — standalone script against the real DB and Razorpay test API**

Create `backend/scripts/tmp-verify-vc-service.mjs`:
```js
import * as videoConsultationService from '../src/services/videoConsultationService.js';
import * as doctorRepository from '../src/repositories/doctorRepository.js';
import pool from '../src/config/db.js';

async function main() {
  const doctorId = await doctorRepository.create({
    name: 'VC Service Verify Doctor',
    qualification: null,
    specialization: null,
    experience_years: null,
    photo_url: null,
    consultation_fee: null,
    video_consultation_fee: 600,
    video_consultation_zoom_link: 'https://zoom.us/j/9998887770',
    working_days: null,
    available_time: null,
    active: true,
  });

  const order = await videoConsultationService.createOrder({
    patient_name: 'VC Service Patient',
    mobile: '9111111122',
    doctor_id: doctorId,
    consultation_date: '2026-09-05',
    consultation_time: '11:00 AM',
  });
  console.log('order:', { hasConsultationId: Boolean(order.consultationId), hasGatewayOrderId: Boolean(order.gatewayOrderId), amount: order.amount, doctorName: order.doctorName });

  const beforePay = await videoConsultationService.getConsultation(order.consultationId);
  console.log('status before pay:', beforePay.status, 'zoom_link before pay:', beforePay.zoom_link);

  try {
    await videoConsultationService.verifyPayment(order.consultationId, {
      gatewayOrderId: order.gatewayOrderId,
      gatewayPaymentId: 'pay_fake_for_service_test',
      signature: 'not-a-real-signature',
    });
    console.log('ERROR: expected verifyPayment to throw');
  } catch (err) {
    console.log('verifyPayment with bad signature threw as expected:', err.statusCode);
  }

  const afterFailedVerify = await videoConsultationService.getConsultation(order.consultationId);
  console.log('status after failed verify:', afterFailedVerify.status);

  const doctorWithoutVideo = await doctorRepository.create({
    name: 'No Video Doctor',
    qualification: null,
    specialization: null,
    experience_years: null,
    photo_url: null,
    consultation_fee: null,
    video_consultation_fee: null,
    video_consultation_zoom_link: null,
    working_days: null,
    available_time: null,
    active: true,
  });
  try {
    await videoConsultationService.createOrder({
      patient_name: 'X',
      mobile: '9000000000',
      doctor_id: doctorWithoutVideo,
      consultation_date: '2026-09-06',
      consultation_time: '12:00 PM',
    });
    console.log('ERROR: expected rejection for doctor without video consult config');
  } catch (err) {
    console.log('createOrder for non-video doctor threw as expected:', err.statusCode, err.message);
  }

  await pool.query('DELETE FROM video_consultations WHERE id = :id', { id: order.consultationId });
  await doctorRepository.remove(doctorId);
  await doctorRepository.remove(doctorWithoutVideo);

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
node scripts/tmp-verify-vc-service.mjs
```
Expected output (key lines): `status before pay: pending_payment zoom_link before pay: null`; `verifyPayment with bad signature threw as expected: 400`; `status after failed verify: failed`; `createOrder for non-video doctor threw as expected: 400 Selected doctor does not offer video consultations.`

Then delete the temp script:
```bash
rm scripts/tmp-verify-vc-service.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/videoConsultationService.js
git commit -m "Add video consultation service orchestrating doctor lookup and payment"
```

---

### Task 7: Video consultation HTTP API

**Files:**
- Create: `backend/src/validators/videoConsultationValidators.js`
- Create: `backend/src/controllers/videoConsultationController.js`
- Create: `backend/src/routes/videoConsultationRoutes.js`
- Modify: `backend/src/middlewares/rateLimiters.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `listConsultations, getConsultation, createOrder, verifyPayment, updateConsultation` from `videoConsultationService.js` (Task 6); `authenticate`, `authorize(...roles)`, `validate(schema)` from existing middlewares; `asyncHandler`, `sendResponse` from existing utils.
- Produces: `createOrderSchema`, `verifyPaymentSchema`, `updateConsultationSchema` (zod) from the validators file; `videoConsultationLimiter` from `rateLimiters.js`; default-exported Express `Router` from `videoConsultationRoutes.js` mounted at `/video-consultations`.

- [ ] **Step 1: Create `backend/src/validators/videoConsultationValidators.js`**

```js
import { z } from 'zod';

export const createOrderSchema = z.object({
  patient_name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().min(7, 'Enter a valid mobile number'),
  email: z.string().email().optional(),
  doctor_id: z.coerce.number().int(),
  consultation_date: z.string().refine((val) => {
    if (Number.isNaN(Date.parse(val))) return false;
    const today = new Date().toISOString().slice(0, 10);
    return val >= today;
  }, 'Consultation date must be today or later.'),
  consultation_time: z.string().min(1, 'Consultation time is required'),
  problem_description: z.string().optional(),
});

export const verifyPaymentSchema = z.object({
  gatewayOrderId: z.string().min(1),
  gatewayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const updateConsultationSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'failed', 'cancelled']).optional(),
});
```

- [ ] **Step 2: Modify `backend/src/middlewares/rateLimiters.js`** — add a limiter for the public video-consultation endpoints

Add this export at the end of the file:
```js

export const videoConsultationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait and try again.', errors: null },
});
```

- [ ] **Step 3: Create `backend/src/controllers/videoConsultationController.js`**

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as videoConsultationService from '../services/videoConsultationService.js';

export const list = asyncHandler(async (req, res) => {
  const { status, doctorId, date } = req.query;
  const filters = {
    status: status || undefined,
    doctorId: doctorId ? Number(doctorId) : undefined,
    date: date || undefined,
  };
  const consultations = await videoConsultationService.listConsultations(filters);
  sendResponse(res, { status: 200, message: 'Video consultations retrieved', data: consultations });
});

export const getOne = asyncHandler(async (req, res) => {
  const consultation = await videoConsultationService.getConsultation(req.params.id);
  sendResponse(res, { status: 200, message: 'Video consultation retrieved', data: consultation });
});

export const createOrder = asyncHandler(async (req, res) => {
  const order = await videoConsultationService.createOrder(req.body);
  sendResponse(res, { status: 201, message: 'Order created', data: order });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const consultation = await videoConsultationService.verifyPayment(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Payment verified', data: consultation });
});

export const update = asyncHandler(async (req, res) => {
  const consultation = await videoConsultationService.updateConsultation(req.params.id, req.body);
  sendResponse(res, { status: 200, message: 'Video consultation updated', data: consultation });
});
```

- [ ] **Step 4: Create `backend/src/routes/videoConsultationRoutes.js`**

```js
import { Router } from 'express';
import * as videoConsultationController from '../controllers/videoConsultationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import {
  createOrderSchema,
  verifyPaymentSchema,
  updateConsultationSchema,
} from '../validators/videoConsultationValidators.js';
import { videoConsultationLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/orders', videoConsultationLimiter, validate(createOrderSchema), videoConsultationController.createOrder);
router.post('/:id/verify', videoConsultationLimiter, validate(verifyPaymentSchema), videoConsultationController.verifyPayment);
router.get('/', authenticate, authorize('admin', 'staff'), videoConsultationController.list);
router.get('/:id', authenticate, authorize('admin', 'staff'), videoConsultationController.getOne);
router.patch(
  '/:id',
  authenticate,
  authorize('admin', 'staff'),
  validate(updateConsultationSchema),
  videoConsultationController.update
);

export default router;
```

- [ ] **Step 5: Modify `backend/src/routes/index.js`** — mount the new routes

Current relevant lines:
```js
import dashboardRoutes from './dashboardRoutes.js';
```
```js
router.use('/dashboard', dashboardRoutes);

export default router;
```

Add the import alongside the others, and mount it alongside `router.use('/dashboard', dashboardRoutes);`:
```js
import dashboardRoutes from './dashboardRoutes.js';
import videoConsultationRoutes from './videoConsultationRoutes.js';
```
```js
router.use('/dashboard', dashboardRoutes);
router.use('/video-consultations', videoConsultationRoutes);

export default router;
```

- [ ] **Step 6: Verify — curl sequence against the real server and DB**

```bash
cd backend
npm start &
sleep 1

# Login as admin
curl -s -c /tmp/vc-cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null

echo "--- create a doctor with video consultation configured (multipart, admin) ---"
DOCTOR_RESP=$(curl -s -b /tmp/vc-cookies.txt -X POST http://localhost:5000/api/doctors \
  -F "name=Dr Video Test" \
  -F "video_consultation_fee=499" \
  -F "video_consultation_zoom_link=https://zoom.us/j/1112223334" \
  -F "active=true")
echo "$DOCTOR_RESP"
DOCTOR_ID=$(echo "$DOCTOR_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.id))")
echo "DOCTOR_ID=$DOCTOR_ID"

echo "--- public: create order ---"
ORDER_RESP=$(curl -s -X POST http://localhost:5000/api/video-consultations/orders \
  -H "Content-Type: application/json" \
  -d "{\"patient_name\":\"Curl Patient\",\"mobile\":\"9876500000\",\"doctor_id\":$DOCTOR_ID,\"consultation_date\":\"2026-09-10\",\"consultation_time\":\"3:00 PM\"}")
echo "$ORDER_RESP"
CONSULT_ID=$(echo "$ORDER_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.consultationId))")
echo "CONSULT_ID=$CONSULT_ID"
echo "response has keyId and no zoom link leaked: $(echo "$ORDER_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).data;console.log(Boolean(r.keyId) && !('zoom_link' in r))})")"

echo "--- public: verify with a bad signature returns 400, status becomes failed ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://localhost:5000/api/video-consultations/$CONSULT_ID/verify" \
  -H "Content-Type: application/json" \
  -d '{"gatewayOrderId":"order_fake","gatewayPaymentId":"pay_fake","signature":"sig_fake"}'

echo "--- admin: list includes the consultation with status failed ---"
curl -s -b /tmp/vc-cookies.txt "http://localhost:5000/api/video-consultations?status=failed" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('found:', r.data.some(x=>x.id==$CONSULT_ID))})"

echo "--- admin: patch status to cancelled ---"
curl -s -b /tmp/vc-cookies.txt -X PATCH "http://localhost:5000/api/video-consultations/$CONSULT_ID" \
  -H "Content-Type: application/json" -d '{"status":"cancelled"}'

echo "--- public: doctors/public never exposes zoom link, but exposes fee ---"
curl -s "http://localhost:5000/api/doctors/public" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).data;const doc=r.find(x=>x.id==$DOCTOR_ID);console.log('has fee:', doc.video_consultation_fee != null, 'has zoom_link key:', 'video_consultation_zoom_link' in doc)})"

echo "--- cleanup: delete the fixture doctor (admin) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -b /tmp/vc-cookies.txt -X DELETE "http://localhost:5000/api/doctors/$DOCTOR_ID" -o /dev/null

kill %1
rm -f /tmp/vc-cookies.txt
```

Expected (key checks): doctor creation `201`; order creation `201` with a `keyId` present and no `zoom_link` key in the response; bad-signature verify returns `400`; the consultation then shows up under `status=failed` in the admin list; the `PATCH` to `cancelled` succeeds `200`; `GET /doctors/public` includes `video_consultation_fee` but the key `video_consultation_zoom_link` is **absent** from the object entirely (this relies on Task 4's `listPublicDoctors` change, already in place).

- [ ] **Step 7: Commit**

```bash
git add backend/src/validators/videoConsultationValidators.js backend/src/controllers/videoConsultationController.js backend/src/routes/videoConsultationRoutes.js backend/src/routes/index.js backend/src/middlewares/rateLimiters.js
git commit -m "Add video consultation HTTP API: validators, rate limiter, controller, routes"
```

---

### Task 8: Frontend payment adapter (Razorpay Checkout)

**Files:**
- Create: `frontend/src/payments/razorpayAdapter.js`
- Create: `frontend/src/payments/index.js`

**Interfaces:**
- Consumes: nothing internal — talks directly to the `window.Razorpay` global loaded from Razorpay's CDN script.
- Produces: `getPaymentAdapter(gateway = 'razorpay')` from `payments/index.js`, returning `{ openCheckout(options) }`. `openCheckout({ keyId, gatewayOrderId, amount, currency, name, description, prefill })` returns a `Promise<{ gatewayOrderId, gatewayPaymentId, signature }>` that resolves on successful payment and rejects (with a human-readable `Error.message`) on dismissal or failure. `amount` is in rupees (matches the backend's `payments.amount`/`video_consultations` amount unit) — the adapter does the ×100-to-paise conversion internally.

- [ ] **Step 1: Create `frontend/src/payments/razorpayAdapter.js`**

```js
let scriptPromise = null;

function loadCheckoutScript() {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the payment checkout. Check your connection and try again.'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export async function openCheckout({ keyId, gatewayOrderId, amount, currency, name, description, prefill }) {
  await loadCheckoutScript();

  return new Promise((resolve, reject) => {
    const razorpay = new window.Razorpay({
      key: keyId,
      order_id: gatewayOrderId,
      amount: Math.round(amount * 100),
      currency,
      name,
      description,
      prefill,
      handler: (response) => {
        resolve({
          gatewayOrderId: response.razorpay_order_id,
          gatewayPaymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled.')),
      },
    });

    razorpay.on('payment.failed', (response) => {
      reject(new Error(response.error?.description || 'Payment failed. Please try again.'));
    });

    razorpay.open();
  });
}
```

- [ ] **Step 2: Create `frontend/src/payments/index.js`**

```js
import { openCheckout as razorpayOpenCheckout } from './razorpayAdapter.js';

const adapters = {
  razorpay: { openCheckout: razorpayOpenCheckout },
};

export function getPaymentAdapter(gateway = 'razorpay') {
  const adapter = adapters[gateway];
  if (!adapter) {
    throw new Error(`Unknown payment gateway: ${gateway}`);
  }
  return adapter;
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors (not yet wired into a page — end-to-end checkout is verified live in Task 11).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/payments
git commit -m "Add frontend payment adapter (Razorpay Checkout) behind a gateway factory"
```

---

### Task 9: Frontend video consultation API layer and hooks

**Files:**
- Create: `frontend/src/services/videoConsultationService.js`
- Create: `frontend/src/hooks/useVideoConsultations.js`

**Interfaces:**
- Consumes: `api` (default export) from `frontend/src/services/api.js`.
- Produces: `createOrder(payload)`, `verifyPayment(id, payload)`, `listConsultations(filters)`, `getConsultation(id)`, `updateConsultation(id, payload)` from `videoConsultationService.js`. Produces `useVideoConsultations(filters)`, `useCreateVideoConsultationOrder()`, `useVerifyVideoConsultationPayment()`, `useUpdateVideoConsultation()` React Query hooks. `useCreateVideoConsultationOrder()`'s mutation function takes the create-order payload directly; `useVerifyVideoConsultationPayment()`'s takes `{ id, payload }`; `useUpdateVideoConsultation()`'s takes `{ id, payload }` and invalidates `['video-consultations']` on success.

- [ ] **Step 1: Create `frontend/src/services/videoConsultationService.js`**

```js
import api from './api.js';

export async function createOrder(payload) {
  const { data } = await api.post('/video-consultations/orders', payload);
  return data.data;
}

export async function verifyPayment(id, payload) {
  const { data } = await api.post(`/video-consultations/${id}/verify`, payload);
  return data.data;
}

export async function listConsultations(filters = {}) {
  const { data } = await api.get('/video-consultations', { params: filters });
  return data.data;
}

export async function getConsultation(id) {
  const { data } = await api.get(`/video-consultations/${id}`);
  return data.data;
}

export async function updateConsultation(id, payload) {
  const { data } = await api.patch(`/video-consultations/${id}`, payload);
  return data.data;
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useVideoConsultations.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as videoConsultationService from '../services/videoConsultationService.js';

export function useVideoConsultations(filters = {}) {
  return useQuery({
    queryKey: ['video-consultations', filters],
    queryFn: () => videoConsultationService.listConsultations(filters),
  });
}

export function useCreateVideoConsultationOrder() {
  return useMutation({ mutationFn: videoConsultationService.createOrder });
}

export function useVerifyVideoConsultationPayment() {
  return useMutation({
    mutationFn: ({ id, payload }) => videoConsultationService.verifyPayment(id, payload),
  });
}

export function useUpdateVideoConsultation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => videoConsultationService.updateConsultation(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video-consultations'] }),
  });
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
git add frontend/src/services/videoConsultationService.js frontend/src/hooks/useVideoConsultations.js
git commit -m "Add frontend video consultation API layer and React Query hooks"
```

---

### Task 10: Admin doctor form — video consultation fields

**Files:**
- Modify: `frontend/src/pages/admin/doctors/DoctorForm.jsx`

**Interfaces:**
- Consumes: nothing new — extends the existing form's `defaultValues`, `reset()` call, and submit `FormData` construction.
- Produces: no new exports; the existing `DoctorForm` default export now also captures/sends `video_consultation_fee` and `video_consultation_zoom_link`.

- [ ] **Step 1: Modify `frontend/src/pages/admin/doctors/DoctorForm.jsx`** — add the two fields to `defaultValues`

Current:
```js
    defaultValues: {
      name: '',
      qualification: '',
      specialization: '',
      experience_years: '',
      consultation_fee: '',
      available_time: '',
      active: true,
    },
```

Replace with:
```js
    defaultValues: {
      name: '',
      qualification: '',
      specialization: '',
      experience_years: '',
      consultation_fee: '',
      video_consultation_fee: '',
      video_consultation_zoom_link: '',
      available_time: '',
      active: true,
    },
```

- [ ] **Step 2: Modify the `reset()` call inside the `useEffect`**

Current:
```js
      reset({
        name: doctor.name ?? '',
        qualification: doctor.qualification ?? '',
        specialization: doctor.specialization ?? '',
        experience_years: doctor.experience_years ?? '',
        consultation_fee: doctor.consultation_fee ?? '',
        available_time: doctor.available_time ?? '',
        active: Boolean(doctor.active),
      });
```

Replace with:
```js
      reset({
        name: doctor.name ?? '',
        qualification: doctor.qualification ?? '',
        specialization: doctor.specialization ?? '',
        experience_years: doctor.experience_years ?? '',
        consultation_fee: doctor.consultation_fee ?? '',
        video_consultation_fee: doctor.video_consultation_fee ?? '',
        video_consultation_zoom_link: doctor.video_consultation_zoom_link ?? '',
        available_time: doctor.available_time ?? '',
        active: Boolean(doctor.active),
      });
```

- [ ] **Step 3: Modify `onSubmit`'s `FormData` construction**

Current:
```js
    if (values.consultation_fee !== '') formData.append('consultation_fee', values.consultation_fee);
    if (selectedDays.length > 0) formData.append('working_days', selectedDays.join(','));
```

Replace with:
```js
    if (values.consultation_fee !== '') formData.append('consultation_fee', values.consultation_fee);
    if (values.video_consultation_fee !== '') formData.append('video_consultation_fee', values.video_consultation_fee);
    if (values.video_consultation_zoom_link) formData.append('video_consultation_zoom_link', values.video_consultation_zoom_link);
    if (selectedDays.length > 0) formData.append('working_days', selectedDays.join(','));
```

- [ ] **Step 4: Add the two input fields to the JSX**, directly after the Experience/Consultation Fee grid block

Current block to locate:
```jsx
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
```

Add this new block directly after it:
```jsx

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Video Consultation Fee</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave blank to disable video consultations"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('video_consultation_fee')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Zoom Link</label>
            <input
              type="url"
              placeholder="https://zoom.us/j/..."
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('video_consultation_zoom_link')}
            />
            {errors.video_consultation_zoom_link && (
              <p className="mt-1 text-sm text-red-600">{errors.video_consultation_zoom_link.message}</p>
            )}
          </div>
        </div>
```

(Both fee and Zoom link must be set for a doctor to offer video consultations — enforced server-side in `videoConsultationService.createOrder`, Task 6. Leaving either blank silently disables the offering for that doctor, no separate checkbox needed.)

- [ ] **Step 5: Verify — live browser check**

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
```
In the browser: log in as admin, go to `/admin/doctors/new` (or edit an existing doctor), fill in Video Consultation Fee and Zoom Link, save. Reload the edit page and confirm both values persisted.

Stop both dev servers when done (`kill %1 %2` or close the terminal tabs).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/doctors/DoctorForm.jsx
git commit -m "Add video consultation fee and Zoom link fields to admin doctor form"
```

---

### Task 11: Public video consultation booking page

**Files:**
- Create: `frontend/src/pages/PublicVideoConsultation.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `usePublicDoctors` from `frontend/src/hooks/useDoctors.js` (existing — now returns `video_consultation_fee` per doctor, with `video_consultation_zoom_link` absent per Task 4); `useCreateVideoConsultationOrder`, `useVerifyVideoConsultationPayment` from Task 9; `getPaymentAdapter` from Task 8; `usePageTitle` from `frontend/src/hooks/usePageTitle.js`; `SectionHeading` from `frontend/src/components/public/SectionHeading.jsx`.
- Produces: default export `PublicVideoConsultation`, routed at `/video-consultation`.

- [ ] **Step 1: Create `frontend/src/pages/PublicVideoConsultation.jsx`**

```jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { usePublicDoctors } from '../hooks/useDoctors.js';
import { useCreateVideoConsultationOrder, useVerifyVideoConsultationPayment } from '../hooks/useVideoConsultations.js';
import { getPaymentAdapter } from '../payments/index.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import SectionHeading from '../components/public/SectionHeading.jsx';

function formatTime12Hour(time24) {
  const [hoursStr, minutes] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

const today = new Date().toISOString().slice(0, 10);

const fieldClass =
  'w-full rounded-[var(--radius-button)] border border-brand-line px-3.5 py-3 text-[14.5px] text-brand-ink focus:border-brand-sage focus:outline-2 focus:outline-brand-sage focus:outline-offset-1';
const labelClass = 'mb-2 block font-mono-brand text-[11.5px] tracking-[0.06em] text-brand-ink-soft uppercase';

export default function PublicVideoConsultation() {
  usePageTitle('Video Consultation');
  const { data: doctors } = usePublicDoctors();
  const videoDoctors = doctors?.filter((doctor) => doctor.video_consultation_fee != null) ?? [];
  const createOrder = useCreateVideoConsultationOrder();
  const verifyPayment = useVerifyVideoConsultationPayment();
  const [confirmation, setConfirmation] = useState(null);
  const [isPaying, setIsPaying] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      patient_name: '',
      mobile: '',
      email: '',
      doctor_id: '',
      consultation_date: today,
      consultation_time: '',
      problem_description: '',
    },
  });

  const selectedDoctor = videoDoctors.find((doctor) => String(doctor.id) === String(watch('doctor_id')));

  async function onSubmit(values) {
    const payload = {
      patient_name: values.patient_name,
      mobile: values.mobile,
      doctor_id: values.doctor_id,
      consultation_date: values.consultation_date,
      consultation_time: formatTime12Hour(values.consultation_time),
    };
    if (values.email) payload.email = values.email;
    if (values.problem_description) payload.problem_description = values.problem_description;

    setIsPaying(true);
    try {
      const order = await createOrder.mutateAsync(payload);
      const adapter = getPaymentAdapter('razorpay');
      const result = await adapter.openCheckout({
        keyId: order.keyId,
        gatewayOrderId: order.gatewayOrderId,
        amount: order.amount,
        currency: order.currency,
        name: "Daniel's Physiotherapy Hospital",
        description: `Video consultation with ${order.doctorName}`,
        prefill: { name: values.patient_name, contact: values.mobile, email: values.email || undefined },
      });

      const consultation = await verifyPayment.mutateAsync({
        id: order.consultationId,
        payload: result,
      });

      setConfirmation(consultation);
    } catch (err) {
      toast.error(err.message || 'Payment could not be completed.');
    } finally {
      setIsPaying(false);
    }
  }

  if (confirmation) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="font-display mb-2 text-2xl font-normal text-brand-navy">Payment Successful</h1>
        <p className="text-brand-ink-soft">
          Your video consultation is confirmed for {confirmation.consultation_date?.slice(0, 10)} at{' '}
          {confirmation.consultation_time}.
        </p>
        <a
          href={confirmation.zoom_link}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block rounded-[var(--radius-button)] bg-brand-navy px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-navy-hover)]"
        >
          Join Zoom Meeting
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="Consult Online"
        title="Book a Video Consultation"
        subtitle="Pick a doctor and time, pay securely, and get your Zoom link instantly."
      />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4.5 rounded-[var(--radius-card)] border border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)] p-6 sm:p-8"
      >
        <div>
          <label className={labelClass}>Full Name</label>
          <input
            type="text"
            className={fieldClass}
            {...register('patient_name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
            })}
          />
          {errors.patient_name && <p className="mt-1.5 text-sm text-red-600">{errors.patient_name.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Mobile Number</label>
          <input
            type="tel"
            className={fieldClass}
            {...register('mobile', {
              required: 'Mobile number is required',
              minLength: { value: 7, message: 'Enter a valid mobile number' },
            })}
          />
          {errors.mobile && <p className="mt-1.5 text-sm text-red-600">{errors.mobile.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Email (optional)</label>
          <input type="email" className={fieldClass} {...register('email')} />
        </div>

        <div>
          <label className={labelClass}>Doctor</label>
          <select className={fieldClass} {...register('doctor_id', { required: 'Please select a doctor' })}>
            <option value="">Select a doctor</option>
            {videoDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} ({doctor.specialization || 'General'}) — ₹{doctor.video_consultation_fee}
              </option>
            ))}
          </select>
          {errors.doctor_id && <p className="mt-1.5 text-sm text-red-600">{errors.doctor_id.message}</p>}
          {videoDoctors.length === 0 && (
            <p className="mt-1.5 text-sm text-brand-ink-soft">No doctors are currently offering video consultations.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Preferred Date</label>
            <input
              type="date"
              min={today}
              className={fieldClass}
              {...register('consultation_date', { required: 'Date is required' })}
            />
            {errors.consultation_date && <p className="mt-1.5 text-sm text-red-600">{errors.consultation_date.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Preferred Time</label>
            <input type="time" className={fieldClass} {...register('consultation_time', { required: 'Time is required' })} />
            {errors.consultation_time && <p className="mt-1.5 text-sm text-red-600">{errors.consultation_time.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Problem Description (optional)</label>
          <textarea rows="3" className={fieldClass} {...register('problem_description')} />
        </div>

        <button
          type="submit"
          disabled={isPaying || videoDoctors.length === 0}
          className="w-full rounded-[var(--radius-button)] bg-brand-navy px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)] disabled:opacity-50"
        >
          {isPaying ? 'Processing...' : selectedDoctor ? `Pay ₹${selectedDoctor.video_consultation_fee} & Book` : 'Pay & Book'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Modify `frontend/src/App.jsx`** — add the public route

Current:
```jsx
import PublicBooking from './pages/PublicBooking.jsx';
```
```jsx
        <Route path="/book" element={<PublicBooking />} />
```

Replace with:
```jsx
import PublicBooking from './pages/PublicBooking.jsx';
import PublicVideoConsultation from './pages/PublicVideoConsultation.jsx';
```
```jsx
        <Route path="/book" element={<PublicBooking />} />
        <Route path="/video-consultation" element={<PublicVideoConsultation />} />
```

- [ ] **Step 3: Verify — live browser walkthrough with a Razorpay test card**

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
```

In the browser, with a doctor already configured with a video consultation fee + Zoom link (from Task 10):
1. Go to `http://localhost:5173/video-consultation`.
2. Fill the form, select that doctor, submit.
3. In the Razorpay Checkout modal, use a Razorpay test card (e.g. `4111 1111 1111 1111`, any future expiry, any CVV, any OTP if prompted — confirm the exact test card from the Razorpay dashboard's test-mode documentation since these change).
4. Confirm the success screen shows the correct date/time and a working "Join Zoom Meeting" link matching the doctor's configured link.
5. Repeat the flow but close/dismiss the Checkout modal instead of paying — confirm a toast error appears and the form is still usable (no crash, no stuck loading state).

Stop both dev servers when done.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PublicVideoConsultation.jsx frontend/src/App.jsx
git commit -m "Add public video consultation booking page with Razorpay checkout"
```

---

### Task 12: Admin video consultations list

**Files:**
- Create: `frontend/src/pages/admin/videoConsultations/VideoConsultationList.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/AdminLayout.jsx`

**Interfaces:**
- Consumes: `useVideoConsultations`, `useUpdateVideoConsultation` from Task 9; `useDoctors` from `frontend/src/hooks/useDoctors.js` (existing, authenticated listing — includes the raw Zoom link, appropriate for admin view).
- Produces: default export `VideoConsultationList`, routed at `/admin/video-consultations` (admin + staff, matching the existing `/admin/appointments` access level).

- [ ] **Step 1: Create `frontend/src/pages/admin/videoConsultations/VideoConsultationList.jsx`**

```jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useVideoConsultations, useUpdateVideoConsultation } from '../../../hooks/useVideoConsultations.js';
import { useDoctors } from '../../../hooks/useDoctors.js';

const STATUSES = ['pending_payment', 'paid', 'failed', 'cancelled'];

const STATUS_STYLES = {
  pending_payment: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default function VideoConsultationList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filters = {
    status: statusFilter || undefined,
    doctorId: doctorFilter || undefined,
    date: dateFilter || undefined,
  };

  const { data: consultations, isLoading } = useVideoConsultations(filters);
  const { data: doctors } = useDoctors();
  const updateConsultation = useUpdateVideoConsultation();

  async function handleStatusChange(id, status) {
    try {
      await updateConsultation.mutateAsync({ id, payload: { status } });
      toast.success('Status updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
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
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Video Consultations</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
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
              <th className="px-4 py-3">Zoom Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {consultations?.map((consultation) => {
              const doctor = doctors?.find((d) => d.id === consultation.doctor_id);
              return (
                <tr key={consultation.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{consultation.patient_name}</td>
                  <td className="px-4 py-3 text-slate-600">{consultation.mobile}</td>
                  <td className="px-4 py-3 text-slate-600">{doctor?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{consultation.consultation_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{consultation.consultation_time}</td>
                  <td className="px-4 py-3">
                    <select
                      value={consultation.status}
                      onChange={(e) => handleStatusChange(consultation.id, e.target.value)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[consultation.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {consultation.zoom_link ? (
                      <a href={consultation.zoom_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        Open
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {consultations?.length === 0 && <p className="p-6 text-center text-slate-500">No video consultations found.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `frontend/src/App.jsx`** — add the admin route

Current:
```jsx
import AppointmentList from './pages/admin/appointments/AppointmentList.jsx';
```
```jsx
          <Route path="appointments" element={<AppointmentList />} />
```

Replace with:
```jsx
import AppointmentList from './pages/admin/appointments/AppointmentList.jsx';
import VideoConsultationList from './pages/admin/videoConsultations/VideoConsultationList.jsx';
```
```jsx
          <Route path="appointments" element={<AppointmentList />} />
          <Route path="video-consultations" element={<VideoConsultationList />} />
```

- [ ] **Step 3: Modify `frontend/src/layouts/AdminLayout.jsx`** — add the sidebar link

Current:
```jsx
            <NavLink to="/admin/appointments" className={navLinkClass}>
              Appointments
            </NavLink>
```

Replace with:
```jsx
            <NavLink to="/admin/appointments" className={navLinkClass}>
              Appointments
            </NavLink>
            <NavLink to="/admin/video-consultations" className={navLinkClass}>
              Video Consultations
            </NavLink>
```

- [ ] **Step 4: Verify — live browser check**

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
```
Log in as admin, go to `/admin/video-consultations`. Confirm the video consultation booked in Task 11's verification appears with the correct patient/doctor/date/status, and that changing its status via the dropdown persists after a page reload.

Stop both dev servers when done.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/videoConsultations frontend/src/App.jsx frontend/src/layouts/AdminLayout.jsx
git commit -m "Add admin video consultations list page"
```

---

### Task 13: Public navigation link and full end-to-end walkthrough

**Files:**
- Modify: `frontend/src/components/public/PublicHeader.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports — adds a "Video Consultation" call-to-action alongside the existing "Book Appointment" link, in both the desktop and mobile nav.

- [ ] **Step 1: Modify `frontend/src/components/public/PublicHeader.jsx`** — add the link next to "Book Appointment" in both the desktop and mobile nav

Desktop nav — current:
```jsx
          <Link
            to="/book"
            className="rounded-[var(--radius-button)] bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
          >
            Book Appointment
          </Link>
        </div>

        <button type="button" className="xl:hidden" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
```

Replace with:
```jsx
          <Link
            to="/video-consultation"
            className="rounded-[var(--radius-button)] border border-brand-navy px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
          >
            Video Consultation
          </Link>
          <Link
            to="/book"
            className="rounded-[var(--radius-button)] bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
          >
            Book Appointment
          </Link>
        </div>

        <button type="button" className="xl:hidden" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
```

Mobile nav — current:
```jsx
          <Link
            to="/book"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-[var(--radius-button)] bg-brand-navy px-5 py-2 text-center text-sm font-semibold text-white"
          >
            Book Appointment
          </Link>
        </nav>
      )}
```

Replace with:
```jsx
          <Link
            to="/video-consultation"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-[var(--radius-button)] border border-brand-navy px-4 py-2 text-center text-sm font-semibold text-brand-navy"
          >
            Video Consultation
          </Link>
          <Link
            to="/book"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-[var(--radius-button)] bg-brand-navy px-5 py-2 text-center text-sm font-semibold text-white"
          >
            Book Appointment
          </Link>
        </nav>
      )}
```

- [ ] **Step 2: Verify — full end-to-end live walkthrough**

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
```

1. On the public site homepage, confirm the "Video Consultation" nav link is visible (desktop and, via the hamburger menu, mobile width) and navigates to `/video-consultation`.
2. As admin, in `/admin/doctors`, set video consultation fee + Zoom link on a doctor that doesn't have them yet; confirm that doctor now appears in the `/video-consultation` doctor dropdown, and a doctor with neither field set does not appear.
3. Complete a full booking with a Razorpay test card; confirm the success screen and the "Join Zoom Meeting" link.
4. In `/admin/video-consultations`, confirm the new booking shows `status: paid` with the correct doctor/date/time and a working Zoom link.
5. Confirm `GET http://localhost:5000/api/doctors/public` (e.g. via the browser or curl) never contains a `video_consultation_zoom_link` key for any doctor, even the ones offering video consultations.
6. Flip `PAYMENT_MODE=live` in `backend/.env` with placeholder live-shaped values (`RAZORPAY_KEY_ID_LIVE=rzp_live_placeholder`, `RAZORPAY_KEY_SECRET_LIVE=placeholder`), restart the backend, and confirm (via the same env-check script from Task 1 Step 8, or by checking the `keyId` returned from `POST /api/video-consultations/orders`) that `RAZORPAY_KEY_ID` now resolves to the live placeholder — then flip back to `PAYMENT_MODE=test` and restart before continuing any real testing.

Stop both dev servers when done.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/public/PublicHeader.jsx
git commit -m "Add Video Consultation link to public navigation"
```
