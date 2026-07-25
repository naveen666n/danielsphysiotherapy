# Services ↔ Patients: Appointment Linking — Design

**Scope:** Seed the currently-empty `services` table with realistic day-to-day physiotherapy services, and link appointment bookings to a selected service via a new nullable `service_id` foreign key — so a patient booking an appointment can indicate which treatment they need, and staff can see/edit it in the admin panel.

## 1. Context

`services` exists as a full CRUD module (repository/service/controller/routes, admin form, public listing) but the table is empty — no admin has added a service yet. Separately, `appointments` has no concept of "which service" a booking is for; it only links to `doctor_id`. This spec closes both gaps: real service content, and a real connection from a booking to a service.

Explicitly out of scope (confirmed with user): no "Book This Service" CTA on the public Services page. Service selection on booking happens only via the existing general booking form, mirroring how `doctor_id` selection already works there.

## 2. Decisions Confirmed With User

- **Link bookings to a service** via `appointments.service_id`, not just cosmetic content — this is the "connect to real patients" requirement.
- **Seed real service content** now, since the table is empty and there's nothing to link to otherwise.
- **No service-card booking CTA** — Services page stays informational; service selection happens on the booking form only.
- `service_id` is **nullable** — mirrors `doctor_id`, since "General Inquiry / not sure" is a valid existing booking path.

## 3. Seed Data — 8 Services

Added via `backend/scripts/migrate.js`, only if the `services` table is currently empty (checked with `SELECT COUNT(*)`, since `services` has no unique column to key an `INSERT IGNORE` off of):

| name | description | display_order |
|---|---|---|
| Sports Injury Rehabilitation | Assessment and recovery programs for sprains, strains, ligament tears, and other sports-related injuries. | 1 |
| Post-Surgery Rehabilitation | Guided recovery plans after orthopedic or joint-replacement surgery to restore strength and mobility safely. | 2 |
| Back & Neck Pain Therapy | Targeted treatment for chronic back pain, cervical spondylosis, sciatica, and posture-related discomfort. | 3 |
| Manual Therapy & Joint Mobilization | Hands-on techniques to relieve stiffness, improve joint range of motion, and reduce muscular tension. | 4 |
| Electrotherapy & Pain Management | TENS, ultrasound, and other modalities used alongside exercise therapy to manage acute and chronic pain. | 5 |
| Neuro Rehabilitation | Physiotherapy for stroke, paralysis, and other neurological conditions, focused on regaining movement and independence. | 6 |
| Pediatric Physiotherapy | Developmental and mobility support for children with delayed milestones or movement difficulties. | 7 |
| Geriatric Physiotherapy | Balance training, fall-prevention, and mobility care tailored to the needs of elderly patients. | 8 |

`image_url` left `NULL` for all — the public `ServiceCard` already handles a missing image with a placeholder icon (confirmed in exploration); admin can upload real photos later via the existing service form.

## 4. Schema Change

`backend/src/config/schema.sql` — `appointments` table gets one new column + FK, placed right after `doctor_id` to mirror it:

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  gender VARCHAR(10),
  age INT,
  doctor_id INT,
  service_id INT,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  problem_description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);
```

`ON DELETE SET NULL` (not present on `doctor_id`'s FK) so deleting a service later never blocks and never cascades-deletes appointment history — an appointment just loses its service reference and displays as "—", same as an appointment with no doctor today.

This project has no incremental-migration mechanism — `migrate.js` re-runs `schema.sql` verbatim, and every table uses `CREATE TABLE IF NOT EXISTS`, so re-running it against your existing database will **not** add the column to the already-created `appointments` table. `migrate.js` gets a guarded step: check `information_schema.COLUMNS` for `appointments.service_id`; if absent, run `ALTER TABLE appointments ADD COLUMN service_id INT, ADD CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`. This keeps `schema.sql` correct for fresh installs and makes your current database catch up the same way `migrate.js` is already run (`npm run migrate` or equivalent).

## 5. Backend Changes

**`backend/src/validators/appointmentValidators.js`** — add `service_id` alongside `doctor_id` in both schemas:
```js
// publicBookingSchema
service_id: z.coerce.number().int().optional(),

// appointmentUpdateSchema
service_id: z.coerce.number().int().nullable().optional(),
```

**`backend/src/services/appointmentService.js`** — `toCreateRow` maps `service_id: data.service_id ?? null` (same as `doctor_id`); the existing FK-violation catch block (`ER_NO_REFERENCED_ROW*`) gets a matching friendly message, "Selected service does not exist", alongside the current doctor one.

**`backend/src/repositories/appointmentRepository.js`** — add `service_id` to the explicit INSERT column/value list. `update()` is already dynamic (builds SET from whatever keys are passed), so no change needed there.

## 6. Frontend Changes

**Public booking form (`frontend/src/pages/PublicBooking.jsx`)** — a service `<select>` placed next to the existing doctor `<select>`, same structure:

```jsx
<select className="..." {...register('service_id')}>
  <option value="">Not sure / General</option>
  {services?.map((service) => (
    <option key={service.id} value={service.id}>
      {service.name}
    </option>
  ))}
</select>
```

Data comes from the already-existing `usePublicServices()` hook (same one the Services page uses). `service_id` added to the form's `defaultValues` and to the submit payload, mirroring how `doctor_id` is handled at lines 43-54.

**Admin appointment list (`frontend/src/pages/admin/appointments/AppointmentList.jsx`)** — add a "Service" column, resolved client-side exactly like the doctor name is today: `useServices()` loads all services, then per row `services?.find((s) => s.id === appointment.service_id)`, rendered as `{service?.name || '—'}`.

**Admin edit modal (`frontend/src/pages/admin/appointments/AppointmentEditModal.jsx`)** — add a service `<select>` mirroring the doctor one, driven by a new `services` prop passed down from `AppointmentList` (same pattern as the existing `doctors` prop).

## 7. Error Handling

- Invalid/non-existent `service_id` on booking → 400 with "Selected service does not exist" (mirrors doctor behavior), not a raw DB error.
- Missing/empty `service_id` → treated as "no service selected," stored as `NULL`, appointment still books successfully (matches current doctor-optional behavior).
- Deleting a service that has appointments referencing it → allowed; those appointments' `service_id` becomes `NULL` automatically (`ON DELETE SET NULL`), no orphaned-FK error surfaces to the admin.

## 8. Testing

No automated test suite in this project (established convention — verification via live curl/browser). Manual verification plan:
1. Run the migration step against the existing dev database; confirm `service_id` column and FK exist, and the 8 services are seeded (only once — re-running doesn't duplicate).
2. Book a public appointment selecting a specific service; confirm it's stored and the friendly error appears for a bogus `service_id` (e.g., via curl with a nonexistent id).
3. Confirm the admin appointment list shows the correct service name per row, and the edit modal can change/clear it.
4. Confirm the public Services page renders all 8 seeded services correctly (name, description, placeholder image icon).
