# Video Consultation with Razorpay Payments — Design

**Scope:** Let a patient book a paid video consultation with a doctor: pick a doctor, date, and time; pay online via Razorpay; receive that doctor's Zoom link on success. Payment processing is built as a standalone, gateway-agnostic module so a future vendor swap or reuse by the existing in-person `appointments`/bookings flow requires minimal work.

## 1. Context

The site currently has one booking flow (`appointments`) — a free request form with no payment step, reviewed manually by staff. This feature adds a second, independent flow for **paid video consultations**, deliberately kept separate rather than merged into `appointments` (confirmed with user — see Decisions).

Explicitly out of scope for this iteration:
- Auto-generated per-booking Zoom meetings via the Zoom API (would need a Zoom Server-to-Server OAuth app). Using static, admin-configured, per-doctor Zoom links instead.
- Razorpay webhooks. Signature-verified client callback is sufficient for MVP; webhook support is a documented future hardening step (see Error Handling).
- Refunds, cancellations-with-refund, or automatic cleanup of abandoned/unpaid bookings.
- Email/SMS confirmation (matches existing `appointments` flow, which also has none — confirmation is on-screen only).

## 2. Decisions Confirmed With User

- **Zoom link**: static, per-doctor, admin-configured (not Zoom-API-generated). Stored on `doctors`, snapshotted onto the consultation record at payment time.
- **Fee**: per-doctor, admin-configured (not one global price).
- **Scheduling**: patient picks a date + time when booking (same UX shape as the existing appointment form), not instant/on-demand.
- **Admin visibility**: a separate "Video Consultations" admin list — not merged into the existing Appointments list. Keeps the new payment-bearing flow decoupled from existing appointment code.
- **Test/live payment mode**: controlled by one env var, `PAYMENT_MODE=test|live`. Both Razorpay key pairs (`_TEST` / `_LIVE`) live in `.env` simultaneously; flipping the var (+ restart) switches which pair is active. No admin-UI toggle — env-var control only.

## 3. Architecture

Two new pieces, plus a small extension to `doctors`:

### 3.1 Payment module (`backend/src/payments/`) — standalone, gateway-agnostic

```
payments/
  gateways/
    PaymentGateway.js      # interface contract (JSDoc typedef), no logic
    razorpayGateway.js      # Razorpay implementation
    index.js                # factory: getGateway() reads env.PAYMENT_GATEWAY
  paymentRepository.js      # CRUD on `payments` table
  paymentService.js         # createOrder(), verifyAndCapture()
```

**Contract every gateway adapter implements** (`PaymentGateway.js`, documented via JSDoc — plain JS, no TS in this repo):
- `createOrder({ amount, currency, receipt, notes }) → { gatewayOrderId, amount, currency, raw }`
- `verifyPayment({ gatewayOrderId, gatewayPaymentId, signature }) → boolean`
- `getPublicConfig() → { keyId }` (whatever non-secret config the frontend checkout needs; shape may differ per vendor)

**`gateways/index.js`** — `getGateway()` reads `env.PAYMENT_GATEWAY` (default `'razorpay'`) and returns the matching adapter instance. Adding a new vendor later = write one adapter file implementing the same three methods + register it here. No other module changes.

**`gateways/razorpayGateway.js`** — uses the official `razorpay` npm package for order creation, and Node's built-in `crypto.createHmac('sha256', keySecret)` for signature verification (Razorpay's documented verification method: HMAC of `order_id|payment_id` compared to the signature returned by Checkout). Reads its active key pair from `env.RAZORPAY_KEY_ID` / `env.RAZORPAY_KEY_SECRET`, which `env.js` resolves from the `_TEST`/`_LIVE` pair based on `PAYMENT_MODE` (see §5).

**`paymentService.js`** — the only thing feature modules talk to:
- `createOrder({ payableType, payableId, amount, currency = 'INR', receipt, notes })` — inserts a `payments` row (`status='created'`), calls `gateway.createOrder()`, updates the row with `gateway_order_id`, returns `{ paymentId, gatewayOrderId, amount, currency, keyId }`.
- `verifyAndCapture({ gatewayOrderId, gatewayPaymentId, signature })` — looks up the `payments` row by `gateway_order_id`, calls `gateway.verifyPayment()`, updates `status` to `'paid'` or `'failed'`, returns the updated row (including `payable_type`/`payable_id` so the caller knows what to update).

**No public HTTP routes for this module.** It's a service library, not an API surface. Deliberate: a public "create an order for this amount" endpoint would let a client dictate the charge amount. The amount is always computed server-side by the calling feature module (here, from `doctors.video_consultation_fee`) — this is what makes the module safely reusable by future features without each one having to re-solve that trust boundary.

**`payments` table** (new, generic — reusable by any future payable):
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
```
`status`: `created` → `paid` | `failed`. No FK on `payable_id` (polymorphic — can't FK to multiple possible tables), same trade-off as any polymorphic-association table.

### 3.2 Video Consultation module — standalone feature, same layering as `appointments`

```
backend/src/
  repositories/videoConsultationRepository.js
  services/videoConsultationService.js
  controllers/videoConsultationController.js
  routes/videoConsultationRoutes.js
  validators/videoConsultationValidators.js
```

**`doctors` table** gets two new nullable columns:
```sql
ALTER TABLE doctors ADD COLUMN video_consultation_fee DECIMAL(10,2) AFTER consultation_fee;
ALTER TABLE doctors ADD COLUMN video_consultation_zoom_link VARCHAR(500) AFTER video_consultation_fee;
```
A doctor with either left `NULL` doesn't offer video consultations — the public video-consultation page's doctor dropdown only lists doctors where both are set and `active = TRUE`.

**`video_consultations` table** (new):
```sql
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
`status`: `pending_payment` → `paid` | `failed` | `cancelled`. `zoom_link` starts `NULL` and is filled in (copied from `doctors.video_consultation_zoom_link`) only once `status` becomes `paid` — this is the snapshot that protects a confirmed booking from a later admin edit to the doctor's link.

## 4. Data Flow

1. Patient fills the video-consultation form (name, mobile, email, doctor, date, time, optional problem description) on the public page → `POST /api/video-consultations/orders`.
2. `videoConsultationController` → `videoConsultationService.createOrder(data)`:
   - loads the doctor, rejects if it doesn't offer video consultations (400),
   - inserts a `video_consultations` row (`status='pending_payment'`),
   - calls `paymentService.createOrder({ payableType: 'video_consultation', payableId: row.id, amount: doctor.video_consultation_fee, receipt: 'vc_<id>' })`,
   - returns `{ consultationId, gatewayOrderId, amount, currency, keyId, doctorName }`.
3. Frontend receives that payload and opens Razorpay Checkout through `frontend/src/payments/razorpayAdapter.js` (loads `checkout.js` once, opens the modal with `keyId`/`gatewayOrderId`/`amount`), which resolves with `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }` on success, or rejects on dismiss/failure.
4. On success, frontend calls `POST /api/video-consultations/:id/verify` with those three fields.
5. `videoConsultationService.verifyPayment(id, { gatewayOrderId, gatewayPaymentId, signature })`:
   - calls `paymentService.verifyAndCapture(...)`,
   - if verified: updates the `video_consultations` row — `status='paid'`, `zoom_link` = the doctor's current `video_consultation_zoom_link`, `payment_id` set,
   - if not verified: `status='failed'`,
   - returns the updated consultation (including `zoom_link`, date/time, doctor name) or throws a 400.
6. Frontend shows a confirmation screen (same pattern as `PublicBooking.jsx`'s post-submit state) with the Zoom link and appointment date/time on success, or an inline retry-safe error otherwise.
7. Admin: `GET /api/video-consultations` (filters: status, doctorId, date — mirrors `appointments`' filter shape) powers a new **Video Consultations** list page. `PATCH /api/video-consultations/:id` allows staff/admin to change `status` (e.g., to `cancelled`).

### Routes (`videoConsultationRoutes.js`)
```
POST   /api/video-consultations/orders        public, rate-limited (new videoConsultationLimiter, same shape as bookingLimiter)
POST   /api/video-consultations/:id/verify    public, rate-limited
GET    /api/video-consultations               admin, staff
GET    /api/video-consultations/:id           admin, staff
PATCH  /api/video-consultations/:id           admin, staff
```
No DELETE — cancellation is a status change, not a row removal (payment history should persist).

## 5. Configuration

**`backend/.env`** — existing `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` renamed to explicit test/live pairs, plus the mode switch:
```
PAYMENT_MODE=test          # test | live
PAYMENT_GATEWAY=razorpay   # gateway factory selector

RAZORPAY_KEY_ID_TEST=...
RAZORPAY_KEY_SECRET_TEST=...
RAZORPAY_KEY_ID_LIVE=
RAZORPAY_KEY_SECRET_LIVE=
```

**`backend/src/config/env.js`** resolves the active pair once at load:
```js
PAYMENT_MODE: process.env.PAYMENT_MODE || 'test',
PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || 'razorpay',
RAZORPAY_KEY_ID: process.env.PAYMENT_MODE === 'live'
  ? process.env.RAZORPAY_KEY_ID_LIVE
  : process.env.RAZORPAY_KEY_ID_TEST,
RAZORPAY_KEY_SECRET: process.env.PAYMENT_MODE === 'live'
  ? process.env.RAZORPAY_KEY_SECRET_LIVE
  : process.env.RAZORPAY_KEY_SECRET_TEST,
```
`razorpayGateway.js` just reads `env.RAZORPAY_KEY_ID`/`env.RAZORPAY_KEY_SECRET` — it never sees the mode directly, keeping the mode-switch logic in one place. `.env.example` updated to document all five new vars with comments. Frontend never receives the key secret; it only ever sees the `keyId` returned inside the order-creation response.

`backend/package.json` gets a new dependency: `razorpay` (official SDK, used only inside `razorpayGateway.js`).

## 6. Frontend Changes

**`frontend/src/payments/`** — mirrors the backend's gateway-factory shape:
```
payments/
  razorpayAdapter.js   # loadScript() + openCheckout(options) → Promise
  index.js             # getPaymentAdapter(gateway) factory
```
`razorpayAdapter.openCheckout({ keyId, gatewayOrderId, amount, currency, name, description, prefill })` dynamically injects `https://checkout.razorpay.com/v1/checkout.js` (once), constructs `new window.Razorpay({...})`, and wraps its `handler`/`modal.ondismiss` callbacks in a Promise that resolves on success or rejects on dismiss.

**`frontend/src/services/videoConsultationService.js`** — `createOrder(payload)`, `verifyPayment(id, payload)`, plus admin `list(filters)`, `get(id)`, `update(id, payload)` — same shape as `appointmentService.js`.

**`frontend/src/hooks/useVideoConsultations.js`** — react-query hooks mirroring `useAppointments.js` (`useVideoConsultations`, `useCreateVideoConsultationOrder`, `useVerifyVideoConsultationPayment`, `useUpdateVideoConsultation`).

**New public page** `frontend/src/pages/PublicVideoConsultation.jsx`, route `/video-consultation`:
- form: patient name, mobile, email (optional), doctor (only those offering video consults), date, time, problem description (optional) — same field/validation conventions as `PublicBooking.jsx`.
- on submit: create order → open Razorpay checkout via the adapter → on resolve, call verify → on success show a confirmation screen with the Zoom link (as a clickable/copyable link) and the booked date/time; on checkout rejection or verify failure, show a toast error and leave the form resubmittable (a fresh order/row is created on retry — the old `pending_payment` row is simply abandoned, harmless).

**Admin doctor form** (`frontend/src/pages/admin/doctors/DoctorForm.jsx` + `doctorValidators.js` equivalent on the frontend if one exists, plus backend `doctorValidators.js`) — two new optional fields: "Video Consultation Fee" (number) and "Zoom Link" (url/text), alongside the existing `consultation_fee` field. Backend `doctorSchema`, `doctorRepository` (`create`/`update` column lists), and `doctorService` updated to pass these through — same mechanical change as every existing doctor field.

**New admin page** `frontend/src/pages/admin/videoConsultations/VideoConsultationList.jsx`, route `/admin/video-consultations` — mirrors `AppointmentList.jsx`: filters (status, doctor, date), table (patient, doctor, date/time, fee, status badge, zoom link if paid), status-change control (no edit-modal for patient details needed — simpler than `AppointmentEditModal`, just a status dropdown per row).

**Navigation** — add "Video Consultation" to the public nav (`PublicLayout`) and "Video Consultations" to the admin sidebar (`AdminLayout`), following whatever pattern those already use for existing links.

**`App.jsx`** — two new routes: `/video-consultation` (public) and `/admin/video-consultations` (protected, admin+staff like the existing appointments route).

## 7. Error Handling

- **Doctor doesn't offer video consults** (fee or zoom link missing) → 400 at order-creation, friendly message, doctor shouldn't even appear in the dropdown but this is the server-side backstop.
- **Patient abandons/dismisses checkout** → the `video_consultations` row stays `pending_payment` forever; no link ever shown, no admin action needed. Acceptable for MVP (no cleanup job) — flagged as a possible future enhancement (e.g., a scheduled job to mark old `pending_payment` rows as `cancelled`), not built now (YAGNI).
- **Signature verification fails** → row marked `failed`, patient sees a clear error and can resubmit the form (creates a new row/order); no destructive state.
- **No webhook in this iteration** — if the patient closes the tab/browser between Razorpay confirming payment and the verify call completing, the money is captured on Razorpay's side but the local row stays `pending_payment`/unlinked. Documented as a known gap; a future Razorpay webhook (`payment.captured` event, verified via Razorpay's webhook secret) would close it by reconciling `payments` rows independent of the client callback. Not building it now per YAGNI — flag if this becomes a real occurrence.
- **DB FK violation on `doctor_id`** (deleted/bad doctor id) → same friendly-400 pattern as `appointmentService.js`'s `referencedRowError`.

## 8. Testing

No automated test suite in this project (established convention — verification via live curl/browser, per existing specs). Manual verification plan:
1. Run `npm run migrate` against the dev DB; confirm `payments`, `video_consultations` tables and the two new `doctors` columns exist.
2. In the admin Doctor form, set a video consultation fee + Zoom link for a test doctor.
3. On the public `/video-consultation` page, book a slot for that doctor; complete payment with a Razorpay **test-mode** card (`PAYMENT_MODE=test`); confirm the success screen shows the correct Zoom link and date/time.
4. Confirm the `payments` and `video_consultations` rows are correctly linked and `status='paid'` in the DB.
5. Dismiss the Razorpay modal instead of paying; confirm the row stays `pending_payment` and the UI shows a retry-safe error.
6. Confirm the admin Video Consultations list shows the booking with the right status, and a status change (e.g., to `cancelled`) persists.
7. Confirm a doctor with no fee/zoom link configured does not appear in the public video-consultation doctor dropdown.
8. Sanity-check `PAYMENT_MODE` switching: flip to `live` locally with dummy live-shaped keys, confirm `razorpayGateway` picks up `RAZORPAY_KEY_ID_LIVE` (e.g., via a log statement or by checking the `keyId` returned to the frontend), then flip back to `test`.
