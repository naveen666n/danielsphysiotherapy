# Phase 5b: Public Website — Design

**Scope:** Second half of Phase 5 ("Public Website" in the original 7-phase plan). Ships the patient-facing marketing site: Home, Services, Doctors, Testimonials, Contact, and a restyled Book Appointment page, all consuming the `/public` endpoints and admin-managed data shipped in Phase 5a. Adds one new backend module — Site Content — so every piece of marketing copy on the public site is admin-editable rather than hardcoded.

## 1. Context

Phase 5a shipped admin CRUD for Services, Testimonials, Hospital Settings, and Contact Messages, plus the public read endpoints (`GET /services/public`, `GET /testimonials/public`, `GET /settings/public`) and the public contact-form endpoint (`POST /api/contact`). Phase 3 shipped `GET /doctors/public` and `POST /appointments/public` (the existing `/book` page). None of that data has a public UI yet — this phase builds it.

Current seeded data: 1 doctor, 0 services, 0 testimonials, a fully populated `hospital_settings` row (real hospital name, address, phone, email, Google Maps link, opening hours; `social_links` present but all empty strings; no logo). The site must render sensibly with today's sparse data (empty states for Services/Testimonials) as well as once real content is added.

## 2. Decisions Confirmed With User

- **Multi-page site**: Home, Services, Doctors, Testimonials, Contact, Book Appointment — separate routes, not a single scrolling page.
- **Visual identity**: calming teal (primary) + white (surface) + warm amber accent (CTAs). Plain Tailwind utility classes, no new UI/icon library — matches the existing codebase convention.
- **Doctors**: card grid only, no individual doctor detail pages (schema has no long-form bio field; only 1 doctor exists today, a detail page would be sparse).
- **Home page**: full trust-building narrative with preview sections (Hero → trust strip → Services preview → About/why-choose-us → Doctors preview → Testimonials preview → Contact/location strip → Footer), each preview linking to its full page.
- **No dedicated `/about` route** — About content folds into a Home section instead of its own page.
- **Staff Login**: small footer text link to the existing `/login` admin panel.
- **All marketing copy is backend-controlled**: every headline, tagline, paragraph, and section heading is admin-editable via a new Site Content module. Fixed UI chrome (button labels, nav labels, form field labels, toast/error messages) stays hardcoded in the frontend — it's app chrome, not content.
- **Hero has no uploadable background image** — a colored gradient (teal-based), consistent with the "text only" scope of the content system. Adding hero imagery is out of scope for this phase.
- **Trust-strip content is honest, not fabricated**: the three trust-strip lines are free text the admin controls (e.g. "Qualified & Experienced Doctors"), not hardcoded numeric claims ("10,000+ patients") with no data behind them.

## 3. Backend — New Module: Site Content

A small key-value CMS so new text blocks never require a future migration.

### 3.1 Schema

Add to `backend/src/config/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS site_content (
  content_key VARCHAR(100) PRIMARY KEY,
  content_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 3.2 Content Keys (seeded with real defaults via `migrate.js`, `INSERT IGNORE` per key — never overwrites an admin edit on re-run)

| Key | Used on | Default value |
|---|---|---|
| `hero_title` | Home hero | `Expert Physiotherapy Care You Can Trust` |
| `hero_subtitle` | Home hero | `Personalized treatment plans to help you move, heal, and live pain-free.` |
| `trust_line_1` | Home trust strip | `Qualified & Experienced Doctors` |
| `trust_line_2` | Home trust strip | `Modern Treatment Techniques` |
| `trust_line_3` | Home trust strip | `Personalized Patient Care` |
| `home_about_heading` | Home about section | `Why Patients Choose Us` |
| `home_about_body` | Home about section | `At Daniel's Physiotherapy Hospital, we combine expert clinical care with a warm, patient-first approach — helping you recover safely and get back to the life you love.` |
| `why_title_1` / `why_body_1` | Home why-us | `Expert Care` / `Treatment plans built around your specific condition and recovery goals.` |
| `why_title_2` / `why_body_2` | Home why-us | `Modern Equipment` / `Evidence-based techniques and equipment for effective, lasting recovery.` |
| `why_title_3` / `why_body_3` | Home why-us | `Personalized Attention` / `Every patient gets focused, one-on-one attention throughout their treatment.` |
| `why_title_4` / `why_body_4` | Home why-us | `Convenient Hours` / `Flexible scheduling that fits around your daily routine.` |
| `home_services_heading` | Home services preview | `Our Services` |
| `home_doctors_heading` | Home doctors preview | `Meet Our Doctors` |
| `home_testimonials_heading` | Home testimonials preview | `What Our Patients Say` |
| `home_contact_heading` | Home contact strip | `Visit Us` |
| `services_page_heading` / `services_page_subheading` | Services page | `Our Services` / `Comprehensive physiotherapy treatments tailored to your needs.` |
| `doctors_page_heading` / `doctors_page_subheading` | Doctors page | `Meet Our Doctors` / `Experienced specialists dedicated to your recovery.` |
| `testimonials_page_heading` / `testimonials_page_subheading` | Testimonials page | `Patient Stories` / `Hear from patients we've helped recover.` |
| `contact_page_heading` / `contact_page_subheading` | Contact page | `Get In Touch` / `We'd love to hear from you — reach out with any questions.` |
| `footer_tagline` | Footer | `Compassionate physiotherapy care for lasting recovery.` |

(26 keys total.)

### 3.3 Files

```
backend/src/
  repositories/contentRepository.js   (new)
  services/contentService.js          (new)
  validators/contentValidators.js     (new)
  controllers/contentController.js    (new)
  routes/contentRoutes.js             (new)
  routes/index.js                     (modified — mount at /content)
  config/schema.sql                   (modified — new table)
  scripts/migrate.js                  (modified — seed 26 default rows)
```

### 3.4 Repository (`contentRepository.js`)

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

### 3.5 Service (`contentService.js`)

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

### 3.6 Validator (`contentValidators.js`)

Exact allowlist of the 26 keys above, each optional (partial updates allowed), `.strict()` so unknown keys are rejected with a 400 rather than silently dropped or inserted:

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

### 3.7 Controller (`contentController.js`)

Same shape as `settingsController.js`:

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

### 3.8 Routes (`contentRoutes.js`)

RBAC mirrors Settings exactly: staff can read (consistent with the Phase 5a "staff can view everything" doctrine, even though the frontend won't expose a staff-facing content-edit screen — see 4.4), only admin can write.

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

Mounted in `routes/index.js` as `router.use('/content', contentRoutes);`.

### 3.9 Migration Seed

In `backend/scripts/migrate.js`, after the existing hospital_settings seed, insert all 26 default rows (from the table in 3.2) with `INSERT IGNORE INTO site_content (content_key, content_value) VALUES (:key, :value)`, one per key — same non-destructive pattern as the existing roles/settings seeds.

## 4. Frontend

### 4.1 Files

```
frontend/src/
  layouts/PublicLayout.jsx                      (new)
  components/public/PublicHeader.jsx             (new)
  components/public/PublicFooter.jsx             (new)
  components/public/SectionHeading.jsx           (new)
  components/public/ServiceCard.jsx              (new)
  components/public/DoctorCard.jsx               (new)
  components/public/TestimonialCard.jsx          (new)
  components/public/StarRating.jsx               (new)
  components/public/ContactForm.jsx              (new)
  components/public/EmptyState.jsx               (new — shared "coming soon" block)
  pages/public/Home.jsx                          (new)
  pages/public/Services.jsx                      (new)
  pages/public/Doctors.jsx                       (new)
  pages/public/Testimonials.jsx                  (new)
  pages/public/Contact.jsx                       (new)
  pages/PublicBooking.jsx                        (modified — restyled into PublicLayout, palette only, field logic untouched)
  pages/admin/content/SiteContentForm.jsx        (new)
  hooks/usePublicContent.js                      (new)
  hooks/useContent.js                            (new — admin get/update)
  hooks/useServices.js                           (modified — add usePublicServices)
  hooks/useTestimonials.js                       (modified — add usePublicTestimonials)
  hooks/useSettings.js                           (modified — add usePublicSettings)
  services/contentService.js                     (new)
  services/contactMessageService.js               (modified — add submitContactMessage)
  services/serviceService.js                     (modified — add listPublicServices)
  services/testimonialService.js                 (modified — add listPublicTestimonials)
  services/settingsService.js                    (modified — add getPublicSettings)
  App.jsx                                        (modified — new public routes + admin content route)
  layouts/AdminLayout.jsx                        (modified — new "Site Content" nav link, admin-only guard)
  hooks/usePageTitle.js                          (new — tiny `document.title` effect hook)
```

### 4.2 Routing (`App.jsx`)

```
/                    → Home
/services            → Services
/doctors             → Doctors
/testimonials        → Testimonials
/contact             → Contact
/book                → PublicBooking (existing, restyled)
```

All six wrapped in a new `<Route element={<PublicLayout />}>`, replacing the current standalone `<Route path="/" element={<Navigate to="/login" replace />} />` and the standalone `/book` route. `/login` stays outside `PublicLayout` (unchanged, it's the admin entry point, not a marketing page).

Admin gets one new nested route, admin-only like Staff/Settings:
```
/admin/content → SiteContentForm
```

### 4.3 `usePublicContent` — Shared Content Hook

```js
// hooks/usePublicContent.js
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

Every public page calls this once. Because the DB is always fully seeded (26 keys, `INSERT IGNORE` guarantees every key exists after migrate), `content.hero_title` etc. are always defined once the query resolves — no per-field fallback chains needed. While loading, pages render their static structural chrome (layout, images, buttons) with text nodes empty/skeleton rather than blocking the whole page — same `isLoading` pattern used elsewhere in the app.

### 4.4 `SiteContentForm.jsx` (admin)

Single always-editable form, same pattern as `SettingsForm.jsx`: one `useContent()` query pre-fills a `react-hook-form`, grouped into visually separated sections matching 3.2's grouping (Hero, Trust Strip, About, Why Choose Us ×4, Section Headings, Page Headers ×4, Footer) with `<input>` for short titles and `<textarea>` for body copy. One `useUpdateContent()` mutation submits the full form (all 26 fields — simpler than diffing, matches the field count and avoids partial-update UI complexity for a form this size). Admin-only route and nav link, matching Settings — staff never see this screen in the UI even though the backend permits staff reads.

### 4.5 `PublicLayout.jsx`, Header, Footer

- `PublicHeader`: reads `usePublicSettings()` for `hospital_name`/`logo_url` (falls back to plain text if no logo). Nav links: Home, Services, Doctors, Testimonials, Contact. "Book Appointment" rendered as a filled amber button, visually distinct from the plain nav links. Mobile: hamburger toggle via local `useState`, no new dependency.
- `PublicFooter`: reads `usePublicSettings()` (address/phone/email/hours/social_links) and `usePublicContent()` (`footer_tagline`). Social icons (simple inline SVGs, no icon library) render only for non-empty URLs in `social_links`. Quick links mirror the header nav. "Staff Login" small text link to `/login`. Copyright line with current year (`new Date().getFullYear()`).

### 4.6 Page Component Pattern

Each of Services/Doctors/Testimonials/Contact follows the same shape: `usePublicContent()` for heading/subheading, the relevant `usePublic*()` data hook, a loading skeleton, an `EmptyState` (shared component, "X coming soon" message with the resource name as a prop) when the array is empty, otherwise a responsive grid of the relevant card component. `Home.jsx` composes `usePublicContent()`, `usePublicServices()`, `usePublicDoctors()`, `usePublicTestimonials()`, `usePublicSettings()` together, slicing each list to its preview count (4 services, 3 doctors, 3 testimonials) and reusing the same card components as their full pages.

### 4.7 `ContactForm.jsx`

Fields: name, phone (optional), email (optional), message — matches `contactMessageSchema` from Phase 5a exactly (`name` and `message` required). On submit, calls the new `useSubmitContactMessage()` mutation (`POST /api/contact` via the new `submitContactMessage` service function — Phase 5a shipped this endpoint with zero frontend consumer until now). Success swaps the form for a thank-you confirmation, matching `/book`'s existing submitted-state pattern. Failure (including the existing 5-per-15-min `contactLimiter` 429) shows `toast.error(err.message)`.

### 4.8 `PublicBooking.jsx` Restyle

Wrapped by `PublicLayout` instead of being a full-screen standalone page; container/colors updated from the current slate/blue palette to the new teal/white/amber system. All field registration, validation rules, and submit payload logic (reviewed and fixed in Phase 3) stay untouched — this is a visual-only change.

### 4.9 `usePageTitle` Hook

```js
// hooks/usePageTitle.js
import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Daniel's Physiotherapy Hospital` : "Daniel's Physiotherapy Hospital";
  }, [title]);
}
```

Called once per public page with a short static string (e.g. `usePageTitle('Services')`) — no new dependency, no dynamic SEO metadata beyond the title (out of scope, see §7).

## 5. Error Handling

- 400 for unknown-key or oversized (`>2000` char) content updates (existing `errorHandler.js`/zod validation branches, unchanged).
- 403 for non-admin `PUT /content` (existing `authorize` middleware, unchanged).
- 429 for the contact-form rate limiter (existing `contactLimiter`, unchanged — this phase adds no new limiters).
- Empty-array states (Services/Testimonials, both 0 rows today) render `EmptyState`, never a blank gap or a spinner stuck forever.
- Network/mutation errors on the admin Site Content form and the public Contact form both use the established `toast.error(err.message)` pattern.

## 6. Verification (no automated test suite, per Phase 1's standing decision)

1. Backend: a standalone Node ESM script exercising `contentRepository`/`contentService` against the real DB (seed presence, `upsertMany` partial update, unknown-key rejection at the validator level).
2. `curl` sequences: `GET /content/public` unauthenticated returns all 26 keys; `GET /content` as staff succeeds (read), `PUT /content` as staff returns 403; `PUT /content` as admin with a partial payload updates only those keys and leaves the rest unchanged; `PUT /content` with an unknown key returns 400.
3. Live Playwright walkthrough: all six public pages plus `/book`, at both a desktop and a mobile (375px) viewport — verify real seeded data renders (1 doctor, hospital settings), Services/Testimonials empty states render correctly, the Home preview sections link to the right full pages, the contact form successfully posts and the message appears in the admin inbox, nav/footer links resolve (including `/login`), and an admin edit in `/admin/content` (e.g. changing `hero_title`) is immediately reflected on the public Home page after a refresh.
4. Doctor-photo and existing-module regression spot-check: confirm nothing in Phase 5a's admin screens broke (no backend files from prior phases are modified except `routes/index.js`, `schema.sql`, and `migrate.js`, all additive).

## 7. Explicitly Out of Scope for Phase 5b

- Individual doctor detail pages — card grid only (see §2).
- Uploadable hero background image — gradient only; Site Content is text-only.
- Dynamic per-page SEO metadata (Open Graph tags, meta descriptions, sitemap) — only a basic `document.title` per page.
- A staff-facing UI for editing Site Content — backend permits staff reads (parity with Settings), but no frontend screen is built for it.
- Multi-language/i18n support.
- Any change to booking/appointment logic beyond `/book`'s visual restyle.
