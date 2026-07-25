# Phase 5b: Public Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the patient-facing marketing site (Home, Services, Doctors, Testimonials, Contact, restyled Book Appointment) plus a new Site Content backend module so every piece of marketing copy is admin-editable.

**Architecture:** A new `site_content` key-value table + layered backend module (repository → service → validator → controller → routes, mirroring every prior module) powers a public `PublicLayout` (Header/Footer + 6 routed pages) built with plain Tailwind. Public pages read data through `usePublic*` TanStack Query hooks that mirror the existing `usePublicDoctors` pattern.

**Tech Stack:** Express 5, mysql2 (raw SQL, named placeholders), zod, React 19, React Router v7, TanStack Query, react-hook-form, react-hot-toast, Tailwind v4. No new dependencies.

## Global Constraints

- No automated test suite in this project (Phase 1 decision) — verification is standalone Node ESM scripts against the real DB, `curl` sequences, and live Playwright walkthroughs. Do not add a test framework and do not flag its absence.
- No new npm packages, frontend or backend.
- Visual palette for **public pages only**: primary `teal-600`/`teal-700` (links, in-page form submit buttons), `amber-500`/`amber-600` reserved specifically for "Book Appointment" navigational CTAs (header button, hero button), white/`slate-50` surfaces, `slate-800`/`slate-600`/`slate-500`/`slate-400` text hierarchy. The **admin panel keeps its existing blue palette** (`AdminLayout.jsx` and all `pages/admin/**`) — this phase does not restyle admin.
- Every new public data hook follows the `usePublicDoctors` naming/shape precedent exactly: `useQuery({ queryKey: ['<resource>', 'public'], queryFn: <service>.listPublic<Resource> })`.
- Reuse `frontend/src/utils/photoUrl.js`'s `getPhotoUrl()` for every image URL on the public site — do not re-implement it.
- `contactMessageSchema.email` is `z.string().email().optional()` — it rejects empty strings. Any form submitting to `/api/contact` (the new `ContactForm`) must conditionally omit `email`/`phone` when blank, exactly like `PublicBooking.jsx` already does for its own optional fields.
- `PublicBooking.jsx`'s field registration, validation rules, and submit payload logic are reviewed-and-fixed from Phase 3 — the one task touching this file changes CSS classes and layout only, never the `register(...)` calls, validation rules, or `onSubmit` payload logic.
- `authenticate` does a fresh DB lookup by JWT `id` on every request (Phase 4). Any `curl`-based RBAC verification script must sign test JWTs with a real, active seeded user's id — never a fabricated id like `999`.
- Backend RBAC for the new Site Content module matches the Settings precedent exactly: `GET /content/public` unauthenticated, `GET /content` `authorize('admin', 'staff')`, `PUT /content` `authorize('admin')` only. The frontend only builds an admin-facing edit screen (no staff-facing read screen), also matching Settings.
- `migrate.js` uses a raw `mysql.createConnection(...)` **without** `namedPlaceholders: true` — any new query added there must use positional `?` placeholders, not the `:name` syntax used by `pool` (`config/db.js`) elsewhere in the codebase.

---

### Task 1: Backend Site Content Module

**Files:**
- Create: `backend/src/repositories/contentRepository.js`
- Create: `backend/src/services/contentService.js`
- Create: `backend/src/validators/contentValidators.js`
- Create: `backend/src/controllers/contentController.js`
- Create: `backend/src/routes/contentRoutes.js`
- Modify: `backend/src/config/schema.sql`
- Modify: `backend/scripts/migrate.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `pool` from `../config/db.js` (named placeholders), `authenticate`/`authorize`/`validate` middlewares (all pre-existing, same as `settingsRoutes.js`).
- Produces: `GET /api/content/public` (unauthenticated) → `{success, message, data: {<28 keys>: string}}`. `GET /api/content` (admin/staff) → same shape. `PUT /api/content` (admin only, body = partial object of any subset of the 28 keys) → returns the full updated map. `CONTENT_KEYS` array exported from `contentValidators.js` (the exhaustive list of valid keys — Task 2's frontend does not need this list, but Task 3's admin form does, so keep this export public).

- [ ] **Step 1: Add the `site_content` table to the schema**

Append to `backend/src/config/schema.sql`:

```sql

CREATE TABLE IF NOT EXISTS site_content (
  content_key VARCHAR(100) PRIMARY KEY,
  content_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: Create the repository**

Create `backend/src/repositories/contentRepository.js`:

```js
import pool from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT content_key, content_value FROM site_content');
  return rows;
}

export async function upsertMany(fields) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO site_content (content_key, content_value) VALUES (:key, :value)
       ON DUPLICATE KEY UPDATE content_value = :value`,
      { key, value }
    );
  }
}
```

- [ ] **Step 3: Create the service**

Create `backend/src/services/contentService.js`:

```js
import * as contentRepository from '../repositories/contentRepository.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.content_key, row.content_value]));
}

export async function getContent() {
  return toMap(await contentRepository.findAll());
}

export async function getPublicContent() {
  return toMap(await contentRepository.findAll());
}

export async function updateContent(data) {
  await contentRepository.upsertMany(data);
  return getContent();
}
```

- [ ] **Step 4: Create the validator with the full key allowlist**

Create `backend/src/validators/contentValidators.js`:

```js
import { z } from 'zod';

export const CONTENT_KEYS = [
  'hero_title', 'hero_subtitle',
  'trust_line_1', 'trust_line_2', 'trust_line_3',
  'home_about_heading', 'home_about_body',
  'why_title_1', 'why_body_1', 'why_title_2', 'why_body_2',
  'why_title_3', 'why_body_3', 'why_title_4', 'why_body_4',
  'home_services_heading', 'home_doctors_heading',
  'home_testimonials_heading', 'home_contact_heading',
  'services_page_heading', 'services_page_subheading',
  'doctors_page_heading', 'doctors_page_subheading',
  'testimonials_page_heading', 'testimonials_page_subheading',
  'contact_page_heading', 'contact_page_subheading',
  'footer_tagline',
];

export const contentSchema = z
  .object(Object.fromEntries(CONTENT_KEYS.map((key) => [key, z.string().min(1).max(2000).optional()])))
  .strict();
```

- [ ] **Step 5: Create the controller**

Create `backend/src/controllers/contentController.js`:

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import * as contentService from '../services/contentService.js';

export const getContent = asyncHandler(async (req, res) => {
  const content = await contentService.getContent();
  sendResponse(res, { status: 200, message: 'Content retrieved', data: content });
});

export const getPublicContent = asyncHandler(async (req, res) => {
  const content = await contentService.getPublicContent();
  sendResponse(res, { status: 200, message: 'Content retrieved', data: content });
});

export const updateContent = asyncHandler(async (req, res) => {
  const content = await contentService.updateContent(req.body);
  sendResponse(res, { status: 200, message: 'Content updated', data: content });
});
```

- [ ] **Step 6: Create the routes**

Create `backend/src/routes/contentRoutes.js`:

```js
import { Router } from 'express';
import * as contentController from '../controllers/contentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { contentSchema } from '../validators/contentValidators.js';

const router = Router();

router.get('/public', contentController.getPublicContent);
router.get('/', authenticate, authorize('admin', 'staff'), contentController.getContent);
router.put('/', authenticate, authorize('admin'), validate(contentSchema), contentController.updateContent);

export default router;
```

- [ ] **Step 7: Mount the routes**

In `backend/src/routes/index.js`, add the import alongside the other route imports:

```js
import contentRoutes from './contentRoutes.js';
```

And mount it alongside the other `router.use(...)` calls (after `settingsRoutes`):

```js
router.use('/content', contentRoutes);
```

- [ ] **Step 8: Seed default content in the migration script**

In `backend/scripts/migrate.js`, add this constant above the `migrate()` function:

```js
const DEFAULT_CONTENT = {
  hero_title: 'Expert Physiotherapy Care You Can Trust',
  hero_subtitle: 'Personalized treatment plans to help you move, heal, and live pain-free.',
  trust_line_1: 'Qualified & Experienced Doctors',
  trust_line_2: 'Modern Treatment Techniques',
  trust_line_3: 'Personalized Patient Care',
  home_about_heading: 'Why Patients Choose Us',
  home_about_body:
    "At Daniel's Physiotherapy Hospital, we combine expert clinical care with a warm, patient-first approach — helping you recover safely and get back to the life you love.",
  why_title_1: 'Expert Care',
  why_body_1: 'Treatment plans built around your specific condition and recovery goals.',
  why_title_2: 'Modern Equipment',
  why_body_2: 'Evidence-based techniques and equipment for effective, lasting recovery.',
  why_title_3: 'Personalized Attention',
  why_body_3: 'Every patient gets focused, one-on-one attention throughout their treatment.',
  why_title_4: 'Convenient Hours',
  why_body_4: 'Flexible scheduling that fits around your daily routine.',
  home_services_heading: 'Our Services',
  home_doctors_heading: 'Meet Our Doctors',
  home_testimonials_heading: 'What Our Patients Say',
  home_contact_heading: 'Visit Us',
  services_page_heading: 'Our Services',
  services_page_subheading: 'Comprehensive physiotherapy treatments tailored to your needs.',
  doctors_page_heading: 'Meet Our Doctors',
  doctors_page_subheading: 'Experienced specialists dedicated to your recovery.',
  testimonials_page_heading: 'Patient Stories',
  testimonials_page_subheading: "Hear from patients we've helped recover.",
  contact_page_heading: 'Get In Touch',
  contact_page_subheading: "We'd love to hear from you — reach out with any questions.",
  footer_tagline: 'Compassionate physiotherapy care for lasting recovery.',
};
```

Then, inside `migrate()`, immediately after the existing `await connection.query('INSERT IGNORE INTO hospital_settings (id) VALUES (1)');` line, add (note: `?` positional placeholders, not `:name` — this connection has no `namedPlaceholders` option):

```js
    for (const [key, value] of Object.entries(DEFAULT_CONTENT)) {
      await connection.query('INSERT IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)', [key, value]);
    }
```

- [ ] **Step 9: Run the migration**

Run: `cd backend && npm run migrate`
Expected: `Database schema applied successfully to "physio_clinic".` with no errors.

- [ ] **Step 10: Verify with a standalone script**

Create a temporary script (not committed) at the repo root, e.g. `/tmp/verify-content.mjs`, adjust DB env vars to match `backend/.env`:

```js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: '127.0.0.1', port: 3306, user: 'root', password: process.env.DB_PASSWORD || '',
  database: 'physio_clinic', namedPlaceholders: true,
});

const [rows] = await pool.query('SELECT COUNT(*) as c FROM site_content');
console.log('Row count (expect 28):', rows[0].c);

await pool.query(
  `INSERT INTO site_content (content_key, content_value) VALUES (:key, :value)
   ON DUPLICATE KEY UPDATE content_value = :value`,
  { key: 'hero_title', value: 'Test Update' }
);
const [check] = await pool.query('SELECT content_value FROM site_content WHERE content_key = :key', { key: 'hero_title' });
console.log('Upsert worked (expect "Test Update"):', check[0].content_value);

await pool.query(
  `INSERT INTO site_content (content_key, content_value) VALUES (:key, :value)
   ON DUPLICATE KEY UPDATE content_value = :value`,
  { key: 'hero_title', value: 'Expert Physiotherapy Care You Can Trust' }
);
process.exit(0);
```

Run: `node /tmp/verify-content.mjs`
Expected: row count 28 (the seeded keys), then confirms the upsert-then-restore round-trip. Delete the script after running.

- [ ] **Step 11: Verify RBAC and validation via curl**

With the backend running (`npm run dev` in `backend/`), and using a real seeded admin/staff user's credentials (per the Global Constraints JWT note):

```bash
# Public — no auth needed
curl -s http://localhost:5000/api/content/public | head -c 300

# Admin PUT with a partial update — should succeed
curl -s -X PUT http://localhost:5000/api/content \
  -H "Content-Type: application/json" \
  -b "token=<real-admin-jwt>" \
  -d '{"hero_title": "Test Hero"}'

# Unknown key — should 400
curl -s -X PUT http://localhost:5000/api/content \
  -H "Content-Type: application/json" \
  -b "token=<real-admin-jwt>" \
  -d '{"not_a_real_key": "x"}'

# Staff PUT — should 403
curl -s -X PUT http://localhost:5000/api/content \
  -H "Content-Type: application/json" \
  -b "token=<real-staff-jwt>" \
  -d '{"hero_title": "Test"}'
```

Expected: first call returns all 28 keys; second returns 200 with `hero_title: "Test Hero"`; third returns 400 validation error; fourth returns 403. After verifying, `PUT` `hero_title` back to its default value from `DEFAULT_CONTENT`.

- [ ] **Step 12: Commit**

```bash
git add backend/src/repositories/contentRepository.js backend/src/services/contentService.js \
  backend/src/validators/contentValidators.js backend/src/controllers/contentController.js \
  backend/src/routes/contentRoutes.js backend/src/config/schema.sql backend/scripts/migrate.js \
  backend/src/routes/index.js
git commit -m "feat: add Site Content backend module for admin-editable marketing copy"
```

---

### Task 2: Frontend Data Layer (Services, Hooks — No UI)

**Files:**
- Create: `frontend/src/services/contentService.js`
- Create: `frontend/src/hooks/useContent.js`
- Create: `frontend/src/hooks/usePublicContent.js`
- Create: `frontend/src/hooks/usePageTitle.js`
- Modify: `frontend/src/services/serviceService.js`
- Modify: `frontend/src/hooks/useServices.js`
- Modify: `frontend/src/services/testimonialService.js`
- Modify: `frontend/src/hooks/useTestimonials.js`
- Modify: `frontend/src/services/settingsService.js`
- Modify: `frontend/src/hooks/useSettings.js`
- Modify: `frontend/src/services/contactMessageService.js`
- Modify: `frontend/src/hooks/useContactMessages.js`

**Interfaces:**
- Consumes: Task 1's `GET/PUT /content`, `GET /content/public`; the existing `GET /services/public`, `GET /testimonials/public`, `GET /settings/public`, `POST /contact` endpoints (all already live from Phase 5a/3).
- Produces (exact names later tasks import): `usePublicContent()`, `useContent()`, `useUpdateContent()`, `usePageTitle(title)`, `usePublicServices()`, `usePublicTestimonials()`, `usePublicSettings()`, `useSubmitContactMessage()`.

- [ ] **Step 1: Content service**

Create `frontend/src/services/contentService.js`:

```js
import api from './api.js';

export async function getContent() {
  const { data } = await api.get('/content');
  return data.data;
}

export async function getPublicContent() {
  const { data } = await api.get('/content/public');
  return data.data;
}

export async function updateContent(fields) {
  const { data } = await api.put('/content', fields);
  return data.data;
}
```

- [ ] **Step 2: Content hooks**

Create `frontend/src/hooks/useContent.js`:

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as contentService from '../services/contentService.js';

export function useContent() {
  return useQuery({ queryKey: ['content'], queryFn: contentService.getContent });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contentService.updateContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
```

Create `frontend/src/hooks/usePublicContent.js`:

```js
import { useQuery } from '@tanstack/react-query';
import * as contentService from '../services/contentService.js';

export function usePublicContent() {
  return useQuery({
    queryKey: ['content', 'public'],
    queryFn: contentService.getPublicContent,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Page title hook**

Create `frontend/src/hooks/usePageTitle.js`:

```js
import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Daniel's Physiotherapy Hospital` : "Daniel's Physiotherapy Hospital";
  }, [title]);
}
```

- [ ] **Step 4: Public services list**

In `frontend/src/services/serviceService.js`, add (after `listServices`):

```js
export async function listPublicServices() {
  const { data } = await api.get('/services/public');
  return data.data;
}
```

In `frontend/src/hooks/useServices.js`, add (after `useServices`):

```js
export function usePublicServices() {
  return useQuery({ queryKey: ['services', 'public'], queryFn: serviceService.listPublicServices });
}
```

- [ ] **Step 5: Public testimonials list**

In `frontend/src/services/testimonialService.js`, add (after `listTestimonials`):

```js
export async function listPublicTestimonials() {
  const { data } = await api.get('/testimonials/public');
  return data.data;
}
```

In `frontend/src/hooks/useTestimonials.js`, add (after `useTestimonials`):

```js
export function usePublicTestimonials() {
  return useQuery({ queryKey: ['testimonials', 'public'], queryFn: testimonialService.listPublicTestimonials });
}
```

- [ ] **Step 6: Public settings**

In `frontend/src/services/settingsService.js`, add (after `getSettings`):

```js
export async function getPublicSettings() {
  const { data } = await api.get('/settings/public');
  return data.data;
}
```

In `frontend/src/hooks/useSettings.js`, add (after `useSettings`):

```js
export function usePublicSettings() {
  return useQuery({ queryKey: ['settings', 'public'], queryFn: settingsService.getPublicSettings });
}
```

- [ ] **Step 7: Public contact-form submission**

In `frontend/src/services/contactMessageService.js`, add (after the existing exports):

```js
export async function submitContactMessage(payload) {
  const { data } = await api.post('/contact', payload);
  return data.data;
}
```

In `frontend/src/hooks/useContactMessages.js`, add (after the existing exports):

```js
export function useSubmitContactMessage() {
  return useMutation({ mutationFn: contactMessageService.submitContactMessage });
}
```

- [ ] **Step 8: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no errors (these are pure additions — no existing export is renamed or removed, so nothing consuming the old exports can break).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/contentService.js frontend/src/hooks/useContent.js \
  frontend/src/hooks/usePublicContent.js frontend/src/hooks/usePageTitle.js \
  frontend/src/services/serviceService.js frontend/src/hooks/useServices.js \
  frontend/src/services/testimonialService.js frontend/src/hooks/useTestimonials.js \
  frontend/src/services/settingsService.js frontend/src/hooks/useSettings.js \
  frontend/src/services/contactMessageService.js frontend/src/hooks/useContactMessages.js
git commit -m "feat: add frontend data layer for site content and public data hooks"
```

---

### Task 3: Admin Site Content UI

**Files:**
- Create: `frontend/src/pages/admin/content/SiteContentForm.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/AdminLayout.jsx`

**Interfaces:**
- Consumes: `useContent`, `useUpdateContent` from Task 2 (`frontend/src/hooks/useContent.js`).
- Produces: `/admin/content` route (admin-only), rendering `SiteContentForm`.

- [ ] **Step 1: Create the admin form**

Create `frontend/src/pages/admin/content/SiteContentForm.jsx`:

```jsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useContent, useUpdateContent } from '../../../hooks/useContent.js';

const SECTIONS = [
  {
    title: 'Hero',
    fields: [
      { key: 'hero_title', label: 'Hero Title', type: 'input' },
      { key: 'hero_subtitle', label: 'Hero Subtitle', type: 'textarea' },
    ],
  },
  {
    title: 'Trust Strip',
    fields: [
      { key: 'trust_line_1', label: 'Trust Line 1', type: 'input' },
      { key: 'trust_line_2', label: 'Trust Line 2', type: 'input' },
      { key: 'trust_line_3', label: 'Trust Line 3', type: 'input' },
    ],
  },
  {
    title: 'Home — About Section',
    fields: [
      { key: 'home_about_heading', label: 'Heading', type: 'input' },
      { key: 'home_about_body', label: 'Body', type: 'textarea' },
    ],
  },
  {
    title: 'Home — Why Choose Us (4 Points)',
    fields: [
      { key: 'why_title_1', label: 'Point 1 Title', type: 'input' },
      { key: 'why_body_1', label: 'Point 1 Body', type: 'textarea' },
      { key: 'why_title_2', label: 'Point 2 Title', type: 'input' },
      { key: 'why_body_2', label: 'Point 2 Body', type: 'textarea' },
      { key: 'why_title_3', label: 'Point 3 Title', type: 'input' },
      { key: 'why_body_3', label: 'Point 3 Body', type: 'textarea' },
      { key: 'why_title_4', label: 'Point 4 Title', type: 'input' },
      { key: 'why_body_4', label: 'Point 4 Body', type: 'textarea' },
    ],
  },
  {
    title: 'Home — Section Headings',
    fields: [
      { key: 'home_services_heading', label: 'Services Preview Heading', type: 'input' },
      { key: 'home_doctors_heading', label: 'Doctors Preview Heading', type: 'input' },
      { key: 'home_testimonials_heading', label: 'Testimonials Preview Heading', type: 'input' },
      { key: 'home_contact_heading', label: 'Contact Strip Heading', type: 'input' },
    ],
  },
  {
    title: 'Services Page',
    fields: [
      { key: 'services_page_heading', label: 'Heading', type: 'input' },
      { key: 'services_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Doctors Page',
    fields: [
      { key: 'doctors_page_heading', label: 'Heading', type: 'input' },
      { key: 'doctors_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Testimonials Page',
    fields: [
      { key: 'testimonials_page_heading', label: 'Heading', type: 'input' },
      { key: 'testimonials_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Contact Page',
    fields: [
      { key: 'contact_page_heading', label: 'Heading', type: 'input' },
      { key: 'contact_page_subheading', label: 'Subheading', type: 'input' },
    ],
  },
  {
    title: 'Footer',
    fields: [{ key: 'footer_tagline', label: 'Footer Tagline', type: 'input' }],
  },
];

const ALL_KEYS = SECTIONS.flatMap((section) => section.fields.map((field) => field.key));
const DEFAULT_VALUES = Object.fromEntries(ALL_KEYS.map((key) => [key, '']));

export default function SiteContentForm() {
  const { data: content, isLoading } = useContent();
  const updateContent = useUpdateContent();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (content) {
      reset(Object.fromEntries(ALL_KEYS.map((key) => [key, content[key] ?? ''])));
    }
  }, [content, reset]);

  async function onSubmit(values) {
    try {
      await updateContent.mutateAsync(values);
      toast.success('Site content updated');
    } catch (err) {
      toast.error(err.message || 'Failed to save site content.');
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Site Content</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {SECTIONS.map((section) => (
          <fieldset key={section.title} className="space-y-4 rounded-lg bg-white p-6 shadow">
            <legend className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </legend>
            {section.fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium text-slate-700">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    rows="3"
                    className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    {...register(field.key, { required: 'Required', maxLength: { value: 2000, message: 'Too long' } })}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    {...register(field.key, { required: 'Required', maxLength: { value: 2000, message: 'Too long' } })}
                  />
                )}
              </div>
            ))}
          </fieldset>
        ))}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Site Content'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

Note this form intentionally keeps the **admin panel's existing blue palette** (`focus:border-blue-500`, `bg-blue-600` button) — the teal/amber palette from the Global Constraints applies to public pages only, not this admin screen.

- [ ] **Step 2: Wire the admin route**

In `frontend/src/App.jsx`, add the import:

```js
import SiteContentForm from './pages/admin/content/SiteContentForm.jsx';
```

And add the route inside the existing `<Route element={<ProtectedRoute roles={['admin']} />}>` block (the same one wrapping `settings`), after the `settings` route:

```jsx
            <Route path="content" element={<SiteContentForm />} />
```

- [ ] **Step 3: Add the nav link**

In `frontend/src/layouts/AdminLayout.jsx`, add a new admin-only `NavLink` after the existing Settings one:

```jsx
            {user?.role === 'admin' && (
              <NavLink to="/admin/content" className={navLinkClass}>
                Site Content
              </NavLink>
            )}
```

- [ ] **Step 4: Verify in the browser**

With both servers running, log in as admin, navigate to `/admin/content`. Confirm: all 28 fields pre-fill with the seeded defaults from Task 1, editing a field and clicking "Save Site Content" shows a success toast, and reloading the page shows the edited value persisted (confirms the `GET /content` → form → `PUT /content` → refetch round-trip). Log in as staff and confirm no "Site Content" link appears in the sidebar.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/content/SiteContentForm.jsx frontend/src/App.jsx frontend/src/layouts/AdminLayout.jsx
git commit -m "feat: add admin Site Content editor"
```

---

### Task 4: Public Site Shell + Home Page

**Files:**
- Create: `frontend/src/layouts/PublicLayout.jsx`
- Create: `frontend/src/components/public/PublicHeader.jsx`
- Create: `frontend/src/components/public/PublicFooter.jsx`
- Create: `frontend/src/components/public/SectionHeading.jsx`
- Create: `frontend/src/components/public/StarRating.jsx`
- Create: `frontend/src/components/public/EmptyState.jsx`
- Create: `frontend/src/components/public/ServiceCard.jsx`
- Create: `frontend/src/components/public/DoctorCard.jsx`
- Create: `frontend/src/components/public/TestimonialCard.jsx`
- Create: `frontend/src/pages/public/Home.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `usePublicContent`, `usePublicServices`, `usePublicTestimonials`, `usePublicSettings` (Task 2), the pre-existing `usePublicDoctors` (`frontend/src/hooks/useDoctors.js`), `usePageTitle` (Task 2), `getPhotoUrl` (`frontend/src/utils/photoUrl.js`, pre-existing).
- Produces (imported by Tasks 5 and 6): `PublicLayout`, `PublicHeader`, `PublicFooter`, `SectionHeading({ eyebrow, title, subtitle, align })`, `StarRating({ rating })`, `EmptyState({ label })`, `ServiceCard({ service })`, `DoctorCard({ doctor })`, `TestimonialCard({ testimonial })`.

- [ ] **Step 1: Shared `SectionHeading`**

Create `frontend/src/components/public/SectionHeading.jsx`:

```jsx
export default function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  const alignment = align === 'center' ? 'text-center items-center' : 'text-left items-start';
  return (
    <div className={`mx-auto mb-10 flex max-w-2xl flex-col ${alignment}`}>
      {eyebrow && <span className="text-sm font-semibold uppercase tracking-wide text-teal-600">{eyebrow}</span>}
      <h2 className="mt-1 text-3xl font-bold text-slate-800 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-slate-500">{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Shared `StarRating` and `EmptyState`**

Create `frontend/src/components/public/StarRating.jsx`:

```jsx
export default function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} viewBox="0 0 20 20" className={`h-4 w-4 ${star <= rating ? 'fill-amber-400' : 'fill-slate-200'}`}>
          <path d="M10 1.5l2.6 5.4 5.9.7-4.3 4.1 1.1 5.8L10 14.7l-5.3 2.8 1.1-5.8L1.5 7.6l5.9-.7L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}
```

Create `frontend/src/components/public/EmptyState.jsx`:

```jsx
export default function EmptyState({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
      <p className="text-slate-500">{label} coming soon — check back shortly.</p>
    </div>
  );
}
```

- [ ] **Step 3: Card components**

Create `frontend/src/components/public/ServiceCard.jsx`:

```jsx
import { getPhotoUrl } from '../../utils/photoUrl.js';

export default function ServiceCard({ service }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="h-44 w-full bg-teal-50">
        {service.image_url ? (
          <img src={getPhotoUrl(service.image_url)} alt={service.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-teal-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-12 w-12">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 21c-4.4-2.7-8-6.6-8-11a8 8 0 0116 0c0 4.4-3.6 8.3-8 11z"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-slate-800">{service.name}</h3>
        {service.description && <p className="mt-2 text-sm text-slate-500">{service.description}</p>}
      </div>
    </div>
  );
}
```

Create `frontend/src/components/public/DoctorCard.jsx`:

```jsx
import { getPhotoUrl } from '../../utils/photoUrl.js';

export default function DoctorCard({ doctor }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white text-center shadow-sm transition hover:shadow-md">
      <div className="mx-auto mt-6 h-28 w-28 overflow-hidden rounded-full bg-teal-50">
        {doctor.photo_url ? (
          <img src={getPhotoUrl(doctor.photo_url)} alt={doctor.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-teal-300">
            {doctor.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-slate-800">{doctor.name}</h3>
        {doctor.specialization && <p className="text-sm text-teal-600">{doctor.specialization}</p>}
        {doctor.qualification && <p className="mt-1 text-sm text-slate-500">{doctor.qualification}</p>}
        {doctor.experience_years != null && (
          <p className="mt-1 text-xs text-slate-400">{doctor.experience_years}+ years experience</p>
        )}
        {(doctor.working_days || doctor.available_time) && (
          <p className="mt-3 text-xs text-slate-500">
            {doctor.working_days}
            {doctor.working_days && doctor.available_time ? ' · ' : ''}
            {doctor.available_time}
          </p>
        )}
        {doctor.consultation_fee != null && (
          <p className="mt-2 text-sm font-medium text-slate-700">Consultation: ₹{doctor.consultation_fee}</p>
        )}
      </div>
    </div>
  );
}
```

Create `frontend/src/components/public/TestimonialCard.jsx`:

```jsx
import { getPhotoUrl } from '../../utils/photoUrl.js';
import StarRating from './StarRating.jsx';

export default function TestimonialCard({ testimonial }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <StarRating rating={testimonial.rating} />
      <p className="mt-4 text-sm text-slate-600">&ldquo;{testimonial.review}&rdquo;</p>
      <div className="mt-5 flex items-center gap-3">
        {testimonial.photo_url ? (
          <img
            src={getPhotoUrl(testimonial.photo_url)}
            alt={testimonial.patient_name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
            {testimonial.patient_name.charAt(0)}
          </div>
        )}
        <span className="text-sm font-medium text-slate-800">{testimonial.patient_name}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `PublicHeader`**

Create `frontend/src/components/public/PublicHeader.jsx`:

```jsx
import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { getPhotoUrl } from '../../utils/photoUrl.js';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/contact', label: 'Contact' },
];

const desktopLinkClass = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-teal-700' : 'text-slate-600 hover:text-teal-700'}`;

const mobileLinkClass = ({ isActive }) =>
  `block rounded px-2 py-2 text-sm font-medium ${isActive ? 'text-teal-700' : 'text-slate-600'}`;

export default function PublicHeader() {
  const { data: settings } = usePublicSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          {settings?.logo_url ? (
            <img
              src={getPhotoUrl(settings.logo_url)}
              alt={settings?.hospital_name || 'Hospital logo'}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
              {(settings?.hospital_name || 'H').charAt(0)}
            </span>
          )}
          <span className="text-lg font-semibold text-slate-800">
            {settings?.hospital_name || "Daniel's Physiotherapy Hospital"}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={desktopLinkClass}>
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/book"
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            Book Appointment
          </Link>
        </nav>

        <button type="button" className="md:hidden" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
          <svg className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/book"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-full bg-amber-500 px-5 py-2 text-center text-sm font-semibold text-white"
          >
            Book Appointment
          </Link>
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 5: `PublicFooter`**

Create `frontend/src/components/public/PublicFooter.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePublicContent } from '../../hooks/usePublicContent.js';

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/contact', label: 'Contact' },
];

const socialIcons = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.5.7.2 1.2.6 1.7 1.1.5.5.9 1 1.1 1.7.3.6.5 1.3.5 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.5 2.4-.2.7-.6 1.2-1.1 1.7-.5.5-1 .9-1.7 1.1-.6.3-1.3.5-2.4.5-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.5-.7-.2-1.2-.6-1.7-1.1-.5-.5-.9-1-1.1-1.7-.3-.6-.5-1.3-.5-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.5-2.4.2-.7.6-1.2 1.1-1.7.5-.5 1-.9 1.7-1.1.6-.3 1.3-.5 2.4-.5C8.9 2 9.3 2 12 2Zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.7.3-1 .6-.3.3-.5.6-.6 1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.3.7.6 1 .3.3.6.5 1 .6.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.3 1-.6.3-.3.5-.6.6-1 .1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7-.2-.4-.3-.7-.6-1-.3-.3-.6-.5-1-.6-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1Zm0 3.5a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 1.8a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm5-2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22 5.9c-.7.3-1.5.6-2.3.7.8-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.6a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5v.1c0 2 1.4 3.6 3.3 4a4.1 4.1 0 0 1-1.9.1c.5 1.6 2 2.8 3.8 2.8A8.2 8.2 0 0 1 2 18.4a11.6 11.6 0 0 0 6.3 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1Z" />
    </svg>
  ),
};

export default function PublicFooter() {
  const { data: settings } = usePublicSettings();
  const { data: content } = usePublicContent();
  const socialLinks = settings?.social_links || {};
  const hasSocialLinks = Object.values(socialLinks).some((url) => url);

  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            {settings?.hospital_name || "Daniel's Physiotherapy Hospital"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">{content?.footer_tagline}</p>
          {hasSocialLinks && (
            <div className="mt-4 flex gap-3">
              {Object.entries(socialLinks).map(([platform, url]) =>
                url ? (
                  <a key={platform} href={url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-teal-600" aria-label={platform}>
                    {socialIcons[platform]}
                  </a>
                ) : null
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick Links</h4>
          <ul className="mt-3 space-y-2">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-slate-600 hover:text-teal-700">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {settings?.address && <li>{settings.address}</li>}
            {settings?.phone && <li>{settings.phone}</li>}
            {settings?.email && <li>{settings.email}</li>}
            {settings?.opening_hours && <li>{settings.opening_hours}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
        <p>
          © {new Date().getFullYear()} {settings?.hospital_name || "Daniel's Physiotherapy Hospital"}. All rights reserved.
          {' · '}
          <Link to="/login" className="hover:text-teal-600">
            Staff Login
          </Link>
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: `PublicLayout`**

Create `frontend/src/layouts/PublicLayout.jsx`:

```jsx
import { Outlet } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader.jsx';
import PublicFooter from '../components/public/PublicFooter.jsx';

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
```

- [ ] **Step 7: `Home` page**

Create `frontend/src/pages/public/Home.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicServices } from '../../hooks/useServices.js';
import { usePublicDoctors } from '../../hooks/useDoctors.js';
import { usePublicTestimonials } from '../../hooks/useTestimonials.js';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ServiceCard from '../../components/public/ServiceCard.jsx';
import DoctorCard from '../../components/public/DoctorCard.jsx';
import TestimonialCard from '../../components/public/TestimonialCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';

const whyIcons = [
  <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
  <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>,
  <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"
    />
  </svg>,
  <svg key="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
];

export default function Home() {
  usePageTitle('Home');
  const { data: content } = usePublicContent();
  const { data: services } = usePublicServices();
  const { data: doctors } = usePublicDoctors();
  const { data: testimonials } = usePublicTestimonials();
  const { data: settings } = usePublicSettings();

  const previewServices = (services || []).slice(0, 4);
  const previewDoctors = (doctors || []).slice(0, 3);
  const previewTestimonials = (testimonials || []).slice(0, 3);

  const whyItems = content
    ? [
        { title: content.why_title_1, body: content.why_body_1 },
        { title: content.why_title_2, body: content.why_body_2 },
        { title: content.why_title_3, body: content.why_body_3 },
        { title: content.why_title_4, body: content.why_body_4 },
      ]
    : [];

  const trustLines = content ? [content.trust_line_1, content.trust_line_2, content.trust_line_3] : [];

  return (
    <div>
      <section className="bg-gradient-to-br from-teal-600 to-teal-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-4xl font-bold sm:text-5xl">{content?.hero_title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-teal-50">{content?.hero_subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/book" className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white shadow-lg hover:bg-amber-600">
              Book Appointment
            </Link>
            <Link to="/services" className="rounded-full border border-white/60 px-8 py-3 font-semibold text-white hover:bg-white/10">
              Our Services
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 text-center sm:grid-cols-3 sm:px-6">
          {trustLines.map((line, i) => (
            <p key={i} className="text-sm font-semibold text-slate-600">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title={content?.home_services_heading} />
        {previewServices.length === 0 ? (
          <EmptyState label="Services" />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {previewServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
        <div className="mt-8 text-center">
          <Link to="/services" className="font-semibold text-teal-600 hover:text-teal-700">
            View All Services →
          </Link>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={content?.home_about_heading} subtitle={content?.home_about_body} />
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {whyItems.map((item, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                  {whyIcons[i]}
                </div>
                <h3 className="mt-4 font-semibold text-slate-800">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title={content?.home_doctors_heading} />
        {previewDoctors.length === 0 ? (
          <EmptyState label="Doctor profiles" />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {previewDoctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        )}
        <div className="mt-8 text-center">
          <Link to="/doctors" className="font-semibold text-teal-600 hover:text-teal-700">
            Meet All Doctors →
          </Link>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={content?.home_testimonials_heading} />
          {previewTestimonials.length === 0 ? (
            <EmptyState label="Patient testimonials" />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {previewTestimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title={content?.home_contact_heading} />
        <div className="grid grid-cols-1 gap-6 rounded-xl bg-teal-600 p-8 text-white sm:grid-cols-2">
          <div className="space-y-2">
            {settings?.address && <p>{settings.address}</p>}
            {settings?.phone && <p>{settings.phone}</p>}
            {settings?.opening_hours && <p>{settings.opening_hours}</p>}
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {settings?.google_map_link && (
              <a
                href={settings.google_map_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-6 py-2.5 font-semibold text-teal-700 hover:bg-teal-50"
              >
                Get Directions
              </a>
            )}
            <Link to="/contact" className="rounded-full border border-white/60 px-6 py-2.5 font-semibold hover:bg-white/10">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 8: Wire routing**

In `frontend/src/App.jsx`, remove the `Navigate` import and the existing `<Route path="/" element={<Navigate to="/login" replace />} />` line, and remove the standalone `<Route path="/book" element={<PublicBooking />} />` line (it moves under `PublicLayout` in Task 7). Add these imports:

```js
import PublicLayout from './layouts/PublicLayout.jsx';
import Home from './pages/public/Home.jsx';
```

And add this route block as the new first `<Route>` inside `<Routes>` (before `/login`):

```jsx
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
      </Route>
```

`PublicBooking` stays imported for now (Task 7 moves its route). `/login` and everything under `/admin` are unaffected.

- [ ] **Step 9: Verify in the browser**

Run both dev servers. Visit `http://localhost:5173/`. Confirm: header shows the real hospital name (from seeded settings), hero title/subtitle render the Task 1 defaults, trust strip shows 3 lines, Services preview shows the `EmptyState` (0 seeded services), Doctors preview shows the 1 seeded doctor's card, Testimonials preview shows the `EmptyState` (0 seeded testimonials), footer shows real address/phone/hours and a working "Staff Login" link to `/login`. Resize to a 375px-wide viewport and confirm the header collapses to a hamburger menu that opens/closes correctly.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/layouts/PublicLayout.jsx frontend/src/components/public/ \
  frontend/src/pages/public/Home.jsx frontend/src/App.jsx
git commit -m "feat: add public site shell (layout, header, footer) and Home page"
```

---

### Task 5: Services + Doctors Pages

**Files:**
- Create: `frontend/src/pages/public/Services.jsx`
- Create: `frontend/src/pages/public/Doctors.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `usePublicContent`, `usePublicServices` (Task 2), `usePublicDoctors` (pre-existing), `usePageTitle` (Task 2), `SectionHeading`, `ServiceCard`, `DoctorCard`, `EmptyState` (Task 4).

- [ ] **Step 1: Services page**

Create `frontend/src/pages/public/Services.jsx`:

```jsx
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicServices } from '../../hooks/useServices.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ServiceCard from '../../components/public/ServiceCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';

export default function Services() {
  usePageTitle('Services');
  const { data: content } = usePublicContent();
  const { data: services, isLoading } = usePublicServices();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading title={content?.services_page_heading} subtitle={content?.services_page_subheading} />
      {isLoading ? (
        <p className="text-center text-slate-400">Loading services...</p>
      ) : (services || []).length === 0 ? (
        <EmptyState label="Services" />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Doctors page**

Create `frontend/src/pages/public/Doctors.jsx`:

```jsx
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicDoctors } from '../../hooks/useDoctors.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import DoctorCard from '../../components/public/DoctorCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';

export default function Doctors() {
  usePageTitle('Doctors');
  const { data: content } = usePublicContent();
  const { data: doctors, isLoading } = usePublicDoctors();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading title={content?.doctors_page_heading} subtitle={content?.doctors_page_subheading} />
      {isLoading ? (
        <p className="text-center text-slate-400">Loading doctors...</p>
      ) : (doctors || []).length === 0 ? (
        <EmptyState label="Doctor profiles" />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire routing**

In `frontend/src/App.jsx`, add imports:

```js
import Services from './pages/public/Services.jsx';
import Doctors from './pages/public/Doctors.jsx';
```

And add these two routes inside the existing `<Route element={<PublicLayout />}>` block, after the `/` route:

```jsx
        <Route path="/services" element={<Services />} />
        <Route path="/doctors" element={<Doctors />} />
```

- [ ] **Step 4: Verify in the browser**

Visit `/services` (confirm `EmptyState`, "Services" heading from Task 1 defaults) and `/doctors` (confirm the 1 seeded doctor's card renders with all fields). Confirm the header's "Services" and "Doctors" nav links highlight as active on their respective pages.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/public/Services.jsx frontend/src/pages/public/Doctors.jsx frontend/src/App.jsx
git commit -m "feat: add public Services and Doctors pages"
```

---

### Task 6: Testimonials + Contact Pages

**Files:**
- Create: `frontend/src/pages/public/Testimonials.jsx`
- Create: `frontend/src/components/public/ContactForm.jsx`
- Create: `frontend/src/pages/public/Contact.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `usePublicContent`, `usePublicTestimonials`, `usePublicSettings`, `useSubmitContactMessage` (Task 2), `usePageTitle` (Task 2), `SectionHeading`, `TestimonialCard`, `EmptyState` (Task 4).

- [ ] **Step 1: Testimonials page**

Create `frontend/src/pages/public/Testimonials.jsx`:

```jsx
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicTestimonials } from '../../hooks/useTestimonials.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import TestimonialCard from '../../components/public/TestimonialCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';

export default function Testimonials() {
  usePageTitle('Testimonials');
  const { data: content } = usePublicContent();
  const { data: testimonials, isLoading } = usePublicTestimonials();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading title={content?.testimonials_page_heading} subtitle={content?.testimonials_page_subheading} />
      {isLoading ? (
        <p className="text-center text-slate-400">Loading testimonials...</p>
      ) : (testimonials || []).length === 0 ? (
        <EmptyState label="Patient testimonials" />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `ContactForm` component**

Create `frontend/src/components/public/ContactForm.jsx`. Per the Global Constraints, `email` must be omitted (not sent as `''`) when blank, matching `PublicBooking.jsx`'s existing pattern:

```jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSubmitContactMessage } from '../../hooks/useContactMessages.js';

export default function ContactForm() {
  const submitMessage = useSubmitContactMessage();
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', phone: '', email: '', message: '' } });

  async function onSubmit(values) {
    const payload = { name: values.name, message: values.message };
    if (values.phone) payload.phone = values.phone;
    if (values.email) payload.email = values.email;

    try {
      await submitMessage.mutateAsync(payload);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send message.');
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-teal-50 p-8 text-center">
        <h3 className="text-lg font-semibold text-teal-700">Message Sent</h3>
        <p className="mt-2 text-sm text-teal-600">Thank you for reaching out. We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
        <input
          type="text"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
          {...register('name', {
            required: 'Name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
          })}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label>
          <input
            type="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('phone')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('email')}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
        <textarea
          rows="4"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
          {...register('message', {
            required: 'Message is required',
            minLength: { value: 5, message: 'Message must be at least 5 characters' },
          })}
        />
        {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Contact page**

Create `frontend/src/pages/public/Contact.jsx`:

```jsx
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ContactForm from '../../components/public/ContactForm.jsx';

export default function Contact() {
  usePageTitle('Contact');
  const { data: content } = usePublicContent();
  const { data: settings } = usePublicSettings();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <SectionHeading title={content?.contact_page_heading} subtitle={content?.contact_page_subheading} />
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Reach Us</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {settings?.address && <li>{settings.address}</li>}
            {settings?.phone && <li>{settings.phone}</li>}
            {settings?.email && <li>{settings.email}</li>}
            {settings?.opening_hours && <li>{settings.opening_hours}</li>}
          </ul>
          {settings?.google_map_link && (
            <a
              href={settings.google_map_link}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-full bg-teal-600 px-6 py-2.5 font-semibold text-white hover:bg-teal-700"
            >
              Get Directions
            </a>
          )}
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire routing**

In `frontend/src/App.jsx`, add imports:

```js
import Testimonials from './pages/public/Testimonials.jsx';
import Contact from './pages/public/Contact.jsx';
```

And add these two routes inside the `<Route element={<PublicLayout />}>` block, after `/doctors`:

```jsx
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/contact" element={<Contact />} />
```

- [ ] **Step 5: Verify in the browser**

Visit `/testimonials` (confirm `EmptyState`, 0 seeded testimonials). Visit `/contact`, fill in the form (name + message only, leaving phone/email blank), submit, and confirm the thank-you state appears. Then log into the admin panel as admin, go to `/admin/messages`, and confirm the submitted message appears in the inbox with the correct name/message. Submit a second contact message including an email address and confirm it also succeeds (validates the conditional-omit logic works both ways).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/public/Testimonials.jsx frontend/src/components/public/ContactForm.jsx \
  frontend/src/pages/public/Contact.jsx frontend/src/App.jsx
git commit -m "feat: add public Testimonials and Contact pages"
```

---

### Task 7: Book Appointment Restyle + Final Integration

**Files:**
- Modify: `frontend/src/pages/PublicBooking.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `PublicLayout` (Task 4), `SectionHeading` (Task 4), `usePageTitle` (Task 2). Reuses `usePublicDoctors` and `useBookAppointment` — both pre-existing and unchanged.

- [ ] **Step 1: Restyle `PublicBooking.jsx`**

Replace the full contents of `frontend/src/pages/PublicBooking.jsx` with (this changes only imports, wrapper markup, and CSS classes — every `register(...)` call, validation rule, and the `onSubmit` payload-building logic is byte-for-byte identical to the current file, per the Global Constraints):

```jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { usePublicDoctors } from '../hooks/useDoctors.js';
import { useBookAppointment } from '../hooks/useAppointments.js';
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

export default function PublicBooking() {
  usePageTitle('Book Appointment');
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
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="mb-2 text-2xl font-semibold text-teal-700">Appointment Requested</h1>
        <p className="text-slate-600">
          Thank you! We've received your request and will contact you shortly to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <SectionHeading title="Book an Appointment" subtitle="Fill in your details and we'll confirm your slot shortly." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('email')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Age (optional)</label>
            <input
              type="number"
              min="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('age')}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Gender (optional)</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('appointment_date', { required: 'Date is required' })}
            />
            {errors.appointment_date && <p className="mt-1 text-sm text-red-600">{errors.appointment_date.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Time</label>
            <input
              type="time"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('appointment_time', { required: 'Time is required' })}
            />
            {errors.appointment_time && <p className="mt-1 text-sm text-red-600">{errors.appointment_time.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Problem Description (optional)</label>
          <textarea
            rows="3"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('problem_description')}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Booking...' : 'Book Appointment'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Wire the final route**

In `frontend/src/App.jsx`, add the `/book` route inside the `<Route element={<PublicLayout />}>` block, after `/contact` (this is the route that was removed as a standalone route back in Task 4 Step 8):

```jsx
        <Route path="/book" element={<PublicBooking />} />
```

At this point `App.jsx`'s `<Route element={<PublicLayout />}>` block should contain exactly 6 child routes: `/`, `/services`, `/doctors`, `/testimonials`, `/contact`, `/book`.

- [ ] **Step 3: Full-site verification pass**

Run: `cd frontend && npm run build`
Expected: clean build, no errors, no unused-import warnings (confirms the `Navigate` import removed in Task 4 isn't still referenced anywhere).

Then, with both servers running, walk every page at both a desktop width and a 375px mobile width:
- `/` — hero, trust strip, all preview sections, footer
- `/services`, `/doctors`, `/testimonials` — headings from Site Content, correct empty/populated states
- `/contact` — form submits successfully, appears in `/admin/messages`
- `/book` — restyled, full booking flow works end-to-end (submit → confirmation state)
- Header nav on every page — all links resolve, active-link highlighting works, mobile hamburger opens/closes
- Footer on every page — "Staff Login" reaches `/login`, quick links resolve
- `/admin/content` — edit `hero_title`, save, reload `/` and confirm the new value appears (end-to-end proof the whole content pipeline works)
- `/login` still works as the admin entry point exactly as before (unaffected by any of this phase's changes)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PublicBooking.jsx frontend/src/App.jsx
git commit -m "feat: restyle Book Appointment page and finalize public site routing"
```

---

## Self-Review Notes

- **Spec coverage:** All 7 sections of the design doc are covered — Site Content backend (Task 1), all 6 public pages + shell (Tasks 2, 4, 5, 6, 7), admin content editor (Task 3), restyled booking (Task 7). Empty states, mobile-first, `document.title`, honest trust-strip copy, and the amber-vs-teal CTA distinction are all represented in the Global Constraints and carried through every task.
- **Placeholder scan:** No TBD/TODO; every step contains complete, runnable code.
- **Type/interface consistency:** `usePublicContent`/`usePublicServices`/`usePublicTestimonials`/`usePublicSettings`/`useSubmitContactMessage`/`usePageTitle` are defined once in Task 2 and referenced with identical names and shapes in every later task. `CONTENT_KEYS` (Task 1) and the `SECTIONS`/`ALL_KEYS` field list (Task 3) contain the same 28 keys — cross-checked against the design doc's table.
