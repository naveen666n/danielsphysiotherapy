# Vibrant Multi-Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the public site three fully distinct, vibrant visual themes (Warm Recovery, Bright Health-Tech, Premium Calm), switchable site-wide via an admin-only Settings control, with the choice persisted in the database.

**Architecture:** Colors/fonts/radius/shadow become CSS custom properties scoped under `[data-theme="warm"|"bright"|"premium"]` on the public site's root element; components keep referencing the same semantic Tailwind classes/token names regardless of active theme. A `site_theme` column on `hospital_settings` drives which theme is active; `PublicLayout` reads it and sets the `data-theme` attribute plus a `ThemeContext` value used only for three small per-theme "signature touch" pieces on the Home page.

**Tech Stack:** React 19, Tailwind CSS v4 (`@theme` custom properties), React Query, react-hook-form, Express + MySQL (`mysql2`), Zod validators.

## Global Constraints

- No visitor-facing theme switch — only the admin Settings page changes `site_theme`.
- Default theme is `premium` (both as the DB column default and the JS fallback before settings load).
- No automated frontend test runner exists in this repo — verification steps are manual (`npm run dev` + visual check) and `npm run lint` (oxlint), consistent with existing project conventions.
- Follow the existing guarded-`ALTER TABLE` migration pattern already used in `backend/scripts/migrate.js` (see `service_id` example) — do not add a new migration framework.
- Keep every shared component free of theme-name branching (`if (theme === 'warm')`) for colors/type/radius/shadow — those differences must come from CSS tokens only. Theme-name branching is allowed only for the three named "signature touch" elements on Home.

---

### Task 1: Backend — `site_theme` setting

**Files:**
- Modify: `backend/src/config/schema.sql`
- Modify: `backend/scripts/migrate.js`
- Modify: `backend/src/validators/settingsValidators.js`
- Modify: `backend/src/services/settingsService.js`

**Interfaces:**
- Produces: `hospital_settings.site_theme` column (`VARCHAR(20) NOT NULL DEFAULT 'premium'`), accepted by `PUT /settings` via `site_theme` field validated as one of `'warm' | 'bright' | 'premium'`, returned by `GET /settings` and `GET /settings/public` (both call `settingsRepository.find()`, which does `SELECT *`, so no repository change needed).

- [ ] **Step 1: Add the column to schema.sql**

In `backend/src/config/schema.sql`, find the `hospital_settings` table definition and add `site_theme` after `social_links`:

```sql
CREATE TABLE IF NOT EXISTS hospital_settings (
  id INT PRIMARY KEY DEFAULT 1,
  hospital_name VARCHAR(150),
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(150),
  google_map_link VARCHAR(500),
  opening_hours VARCHAR(255),
  social_links JSON,
  site_theme VARCHAR(20) NOT NULL DEFAULT 'premium',
  logo_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: Add a guarded ALTER TABLE for existing databases**

In `backend/scripts/migrate.js`, immediately after the existing `service_id` guarded block (right after the `console.log('Added service_id column to appointments.');` line and its closing `}`), add:

```javascript
    const [existingThemeColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'hospital_settings' AND COLUMN_NAME = 'site_theme'`,
      [env.DB_NAME]
    );
    if (existingThemeColumn.length === 0) {
      await connection.query(
        "ALTER TABLE hospital_settings ADD COLUMN site_theme VARCHAR(20) NOT NULL DEFAULT 'premium' AFTER social_links"
      );
      console.log('Added site_theme column to hospital_settings.');
    }
```

- [ ] **Step 3: Validate the field**

In `backend/src/validators/settingsValidators.js`, add to `settingsSchema`:

```javascript
export const settingsSchema = z.object({
  hospital_name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  google_map_link: z.string().optional(),
  opening_hours: z.string().optional(),
  social_links: socialLinksFromString,
  site_theme: z.enum(['warm', 'bright', 'premium']).optional(),
});
```

- [ ] **Step 4: Accept the field in the service layer**

In `backend/src/services/settingsService.js`, in `toFields()`, add:

```javascript
function toFields(data, logoUrl) {
  const fields = {};
  if (data.hospital_name !== undefined) fields.hospital_name = data.hospital_name;
  if (data.address !== undefined) fields.address = data.address;
  if (data.phone !== undefined) fields.phone = data.phone;
  if (data.email !== undefined) fields.email = data.email;
  if (data.google_map_link !== undefined) fields.google_map_link = data.google_map_link;
  if (data.opening_hours !== undefined) fields.opening_hours = data.opening_hours;
  if (data.social_links !== undefined) fields.social_links = JSON.stringify(data.social_links);
  if (data.site_theme !== undefined) fields.site_theme = data.site_theme;
  if (logoUrl !== undefined) fields.logo_url = logoUrl;
  return fields;
}
```

- [ ] **Step 5: Run the migration and verify**

Run: `cd backend && node scripts/migrate.js`
Expected: Console prints `Added site_theme column to hospital_settings.` (first run) with no errors. Running it a second time should print nothing about that column (idempotent) and still exit cleanly.

Verify the column exists and defaults correctly:
Run: `mysql -u <user> -p <db_name> -e "SELECT id, site_theme FROM hospital_settings;"` (use the credentials from `backend/.env`)
Expected: one row with `site_theme = 'premium'`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/schema.sql backend/scripts/migrate.js backend/src/validators/settingsValidators.js backend/src/services/settingsService.js
git commit -m "feat: add site_theme setting for public site theme switching"
```

---

### Task 2: Frontend — load all theme fonts

**Files:**
- Modify: `frontend/index.html`

**Interfaces:**
- Produces: Google Fonts `Fraunces`, `Playfair Display`, `Plus Jakarta Sans`, `Sora`, `Inter`, `IBM Plex Sans`, `IBM Plex Mono` all available for the CSS token system built in Task 3. `Instrument Serif` is dropped since no theme uses it after this change.

- [ ] **Step 1: Replace the font link**

In `frontend/index.html`, replace the single `<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif...">` line with:

```html
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,600&family=Playfair+Display:ital,wght@0,700;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Verify fonts load**

Run: `cd frontend && npm run dev`
Open the printed local URL in a browser, open DevTools → Network → filter `fonts.gstatic.com`, reload.
Expected: font files for Fraunces, Playfair Display, Plus Jakarta Sans, Sora, Inter, IBM Plex Sans/Mono all return 200 (no 404s).

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: load font families for all three site themes"
```

---

### Task 3: Frontend — theme token system in CSS

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: CSS custom properties consumed by every component task below — `--color-brand-navy`, `--color-brand-blue`, `--color-brand-ice`, `--color-brand-sage`, `--color-brand-ink`, `--color-brand-ink-soft`, `--color-brand-line` (existing, values redefined per theme), plus new tokens `--color-brand-navy-hover`, `--font-body`, `--radius-card`, `--radius-button`, `--shadow-card`, `--card-bg`, `--card-border`, `--card-blur`, `--hero-bg`. All scoped under `[data-theme="warm"]`, `[data-theme="bright"]`, `[data-theme="premium"]` (set by Task 4), with `:root` holding the premium (default) values for the new tokens so the site looks correct before settings finish loading.

- [ ] **Step 1: Replace index.css**

Replace the full contents of `frontend/src/index.css` with:

```css
@import "tailwindcss";

@theme {
  --color-brand-navy: #0b2e4e;
  --color-brand-blue: #6d5ae6;
  --color-brand-ice: #ffffff;
  --color-brand-sage: #f2994a;
  --color-brand-ink: #142430;
  --color-brand-ink-soft: #4a5c68;
  --color-brand-line: #e3e7ec;

  --font-display: "Playfair Display", Georgia, serif;
  --font-mono-brand: "IBM Plex Mono", "SF Mono", Menlo, monospace;
}

/*
 * "Feel" tokens (radius, shadow, card treatment, hero background, body
 * font, hover shade) sit outside the Tailwind @theme color/font system,
 * so they're plain CSS custom properties swapped per [data-theme].
 * :root holds the "premium" (default) values.
 */
:root {
  --font-body: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --color-brand-navy-hover: #0d3a63;
  --radius-card: 6px;
  --radius-button: 4px;
  --shadow-card: 0 30px 70px -34px rgba(11, 46, 78, 0.45);
  --card-bg: #ffffff;
  --card-border: #e3e7ec;
  --card-blur: none;
  --hero-bg: linear-gradient(135deg, rgba(11, 46, 78, 0.04), rgba(109, 90, 230, 0.06)), #ffffff;
}

[data-theme="warm"] {
  --color-brand-navy: #c24a2c;
  --color-brand-blue: #1f6f63;
  --color-brand-ice: #fbf6ef;
  --color-brand-sage: #f2a93b;
  --color-brand-ink: #2b2320;
  --color-brand-ink-soft: #6b5e52;
  --color-brand-line: #e7dcc9;
  --color-brand-navy-hover: #a93d22;

  --font-display: "Fraunces", Georgia, serif;
  --font-mono-brand: "Plus Jakarta Sans", sans-serif;
  --font-body: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  --radius-card: 20px;
  --radius-button: 14px;
  --shadow-card: 0 20px 45px -20px rgba(194, 74, 44, 0.25);
  --card-bg: #ffffff;
  --card-border: #e7dcc9;
  --card-blur: none;
  --hero-bg: radial-gradient(circle at 15% 20%, rgba(242, 169, 59, 0.25), transparent 55%),
    radial-gradient(circle at 85% 80%, rgba(31, 111, 99, 0.18), transparent 50%), #fbf6ef;
}

[data-theme="bright"] {
  --color-brand-navy: #0e7c74;
  --color-brand-blue: #2d6cdf;
  --color-brand-ice: #f5fafa;
  --color-brand-sage: #ff6b5d;
  --color-brand-ink: #101828;
  --color-brand-ink-soft: #475467;
  --color-brand-line: #dceeec;
  --color-brand-navy-hover: #0b645e;

  --font-display: "Sora", sans-serif;
  --font-mono-brand: "Sora", sans-serif;
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  --radius-card: 14px;
  --radius-button: 999px;
  --shadow-card: 0 20px 50px -22px rgba(45, 108, 223, 0.3);
  --card-bg: rgba(255, 255, 255, 0.65);
  --card-border: rgba(255, 255, 255, 0.5);
  --card-blur: blur(14px);
  --hero-bg: radial-gradient(circle at 20% 30%, rgba(45, 108, 223, 0.16), transparent 55%),
    radial-gradient(circle at 80% 20%, rgba(255, 107, 93, 0.14), transparent 50%),
    radial-gradient(circle at 60% 90%, rgba(198, 241, 53, 0.14), transparent 45%), #f5fafa;
}

[data-theme="premium"] {
  --color-brand-navy: #0b2e4e;
  --color-brand-blue: #6d5ae6;
  --color-brand-ice: #ffffff;
  --color-brand-sage: #f2994a;
  --color-brand-ink: #142430;
  --color-brand-ink-soft: #4a5c68;
  --color-brand-line: #e3e7ec;
  --color-brand-navy-hover: #0d3a63;

  --font-display: "Playfair Display", Georgia, serif;
  --font-mono-brand: "IBM Plex Mono", "SF Mono", Menlo, monospace;
  --font-body: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  --radius-card: 6px;
  --radius-button: 4px;
  --shadow-card: 0 30px 70px -34px rgba(11, 46, 78, 0.45);
  --card-bg: #ffffff;
  --card-border: #e3e7ec;
  --card-blur: none;
  --hero-bg: linear-gradient(135deg, rgba(11, 46, 78, 0.04), rgba(109, 90, 230, 0.06)), #ffffff;
}

.public-site {
  font-family: var(--font-body);
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds with no CSS errors (Tailwind v4 accepts arbitrary `@theme` values; the extra `:root`/`[data-theme]` blocks are plain CSS and always valid).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: define CSS token system for warm/bright/premium themes"
```

---

### Task 4: Frontend — ThemeContext and PublicLayout wiring

**Files:**
- Create: `frontend/src/contexts/ThemeContext.jsx`
- Modify: `frontend/src/layouts/PublicLayout.jsx`

**Interfaces:**
- Produces: `ThemeProvider` component and `useTheme()` hook (returns `'warm' | 'bright' | 'premium'`), consumed by Home.jsx in Task 7 for signature-touch conditionals.
- Consumes: `usePublicSettings()` from `frontend/src/hooks/useSettings.js` (already returns `{ data }` where `data.site_theme` will now be populated after Task 1).

- [ ] **Step 1: Create ThemeContext**

Create `frontend/src/contexts/ThemeContext.jsx`:

```jsx
import { createContext, useContext } from 'react';

const ThemeContext = createContext('premium');

export function ThemeProvider({ theme, children }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Wire it into PublicLayout**

Replace the full contents of `frontend/src/layouts/PublicLayout.jsx` with:

```jsx
import { Outlet } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader.jsx';
import PublicFooter from '../components/public/PublicFooter.jsx';
import { usePublicSettings } from '../hooks/useSettings.js';
import { ThemeProvider } from '../contexts/ThemeContext.jsx';

export default function PublicLayout() {
  const { data: settings } = usePublicSettings();
  const theme = settings?.site_theme || 'premium';

  return (
    <ThemeProvider theme={theme}>
      <div data-theme={theme} className="public-site flex min-h-screen flex-col bg-brand-ice text-brand-ink">
        <PublicHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <PublicFooter />
      </div>
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Verify theme attribute renders**

Run: `cd frontend && npm run dev`, open the site in a browser, open DevTools → Elements.
Expected: the `<div class="public-site ...">` wrapping the whole page has `data-theme="premium"` (since the DB default is `premium` after Task 1's migration).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/contexts/ThemeContext.jsx frontend/src/layouts/PublicLayout.jsx
git commit -m "feat: wire site_theme setting into data-theme attribute and ThemeContext"
```

---

### Task 5: Frontend — admin Settings theme dropdown

**Files:**
- Modify: `frontend/src/pages/admin/settings/SettingsForm.jsx`

**Interfaces:**
- Consumes: `useSettings()`, `useUpdateSettings()` from `frontend/src/hooks/useSettings.js` (unchanged signatures — `useUpdateSettings().mutateAsync(formData)` where `formData` is a `FormData` instance, matching the existing pattern for every other field).

- [ ] **Step 1: Add the theme field to the form**

In `frontend/src/pages/admin/settings/SettingsForm.jsx`, update the `defaultValues` in `useForm`:

```javascript
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
      site_theme: 'premium',
    },
```

Update the `reset()` call inside the `useEffect`:

```javascript
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
        site_theme: settings.site_theme ?? 'premium',
      });
```

Update `onSubmit` to send the field:

```javascript
    formData.append('opening_hours', values.opening_hours);
    formData.append('site_theme', values.site_theme);
```

(insert the `site_theme` append line directly after the existing `opening_hours` append line)

- [ ] **Step 2: Add the select input to the JSX**

Insert this block right after the "Opening Hours" field's closing `</div>` and before the Instagram/Facebook/Twitter grid:

```jsx
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Site Theme</label>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('site_theme')}
          >
            <option value="warm">Warm Recovery</option>
            <option value="bright">Bright Health-Tech</option>
            <option value="premium">Premium Calm</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Controls the color palette, fonts, and visual style of the public website.</p>
        </div>
```

- [ ] **Step 3: Verify the dropdown saves**

Run: `cd frontend && npm run dev` and `cd backend && npm run dev` (or however the backend dev server is started — check `backend/package.json` scripts if unsure).
Log into `/admin/settings`, change "Site Theme" to "Warm Recovery", click "Save Settings".
Expected: toast shows "Settings updated"; reloading the admin Settings page shows "Warm Recovery" still selected (confirms persistence); visiting the public site (`/`) shows `data-theme="warm"` on the root div (per Task 4's verification method).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/settings/SettingsForm.jsx
git commit -m "feat: add site theme picker to admin Settings"
```

---

### Task 6: Frontend — tokenize shared public components

**Files:**
- Modify: `frontend/src/components/public/ServiceCard.jsx`
- Modify: `frontend/src/components/public/DoctorCard.jsx`
- Modify: `frontend/src/components/public/TestimonialCard.jsx`
- Modify: `frontend/src/components/public/EmptyState.jsx`
- Modify: `frontend/src/components/public/ContactForm.jsx`
- Modify: `frontend/src/components/public/GoogleMapEmbed.jsx`
- Modify: `frontend/src/components/public/PublicHeader.jsx`
- Modify: `frontend/src/pages/public/Services.jsx` (no change expected — verify only)
- Modify: `frontend/src/pages/public/Contact.jsx`

**Interfaces:**
- Consumes: CSS tokens from Task 3 (`--radius-card`, `--radius-button`, `--shadow-card`, `--card-bg`, `--card-border`, `--card-blur`, `--color-brand-navy-hover`).

This task replaces every remaining hardcoded `rounded-[Npx]`, hardcoded hover hex color, and hardcoded card background/border with the token-driven equivalents, so all three themes render these components correctly.

- [ ] **Step 1: ServiceCard.jsx**

Replace the outer `<div>` className in `frontend/src/components/public/ServiceCard.jsx`:

```jsx
    <div className="overflow-hidden border transition-shadow rounded-[var(--radius-card)] border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)] hover:shadow-[inset_0_-3px_0_var(--color-brand-sage)]">
```

- [ ] **Step 2: DoctorCard.jsx**

Replace the outer `<div>` className in `frontend/src/components/public/DoctorCard.jsx`:

```jsx
    <div className="overflow-hidden border transition-shadow rounded-[var(--radius-card)] border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)] hover:shadow-[var(--shadow-card)]">
```

- [ ] **Step 3: TestimonialCard.jsx**

Replace the outer `<div>` className logic in `frontend/src/components/public/TestimonialCard.jsx`:

```jsx
    <div
      className={`rounded-[var(--radius-card)] p-6 ${
        dark ? 'border border-white/14 bg-white/4' : 'border border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)]'
      }`}
    >
```

- [ ] **Step 4: EmptyState.jsx**

Replace the className in `frontend/src/components/public/EmptyState.jsx`:

```jsx
    <div className="rounded-[var(--radius-card)] border border-dashed border-brand-line bg-brand-ice px-6 py-14 text-center">
```

- [ ] **Step 5: ContactForm.jsx**

In `frontend/src/components/public/ContactForm.jsx`, update the two class constants and the JSX:

```javascript
const fieldClass =
  'w-full rounded-[var(--radius-button)] border border-brand-line px-3.5 py-3 text-[14.5px] text-brand-ink focus:border-brand-sage focus:outline-2 focus:outline-brand-sage focus:outline-offset-1';
```

Replace the "submitted" state div:

```jsx
      <div className="rounded-[var(--radius-card)] border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center">
```

Replace the `<form>` className:

```jsx
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[var(--radius-card)] border border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)] p-9">
```

Replace the submit `<button>` className:

```jsx
        className="mt-5 w-full rounded-[var(--radius-button)] bg-brand-navy px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)] disabled:opacity-50"
```

- [ ] **Step 6: GoogleMapEmbed.jsx default className**

In `frontend/src/components/public/GoogleMapEmbed.jsx`, update the default parameter:

```jsx
export default function GoogleMapEmbed({ address, className = 'h-64 w-full rounded-[var(--radius-card)] border border-brand-line' }) {
```

- [ ] **Step 7: PublicHeader.jsx**

In `frontend/src/components/public/PublicHeader.jsx`, replace the fallback logo SVG:

```jsx
            <svg viewBox="0 0 40 40" fill="none" className="h-9 w-9 shrink-0">
              <circle cx="20" cy="20" r="19" style={{ stroke: 'var(--color-brand-blue)' }} strokeWidth="1.4" />
              <rect x="17" y="10" width="6" height="20" rx="1.5" style={{ fill: 'var(--color-brand-navy)' }} />
              <rect x="10" y="17" width="20" height="6" rx="1.5" style={{ fill: 'var(--color-brand-sage)' }} />
            </svg>
```

Replace the "Hospital Login" desktop link className:

```jsx
            className="rounded-[var(--radius-button)] border border-brand-navy px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
```

Replace the "Book Appointment" desktop link className:

```jsx
            className="rounded-[var(--radius-button)] bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
```

Replace the mobile menu "Hospital Login" link className:

```jsx
            className="mt-1 rounded-[var(--radius-button)] border border-brand-navy px-4 py-2 text-center text-sm font-semibold text-brand-navy"
```

Replace the mobile menu "Book Appointment" link className:

```jsx
            className="mt-1 rounded-[var(--radius-button)] bg-brand-navy px-5 py-2 text-center text-sm font-semibold text-white"
```

- [ ] **Step 8: Contact.jsx**

In `frontend/src/pages/public/Contact.jsx`, replace the `GoogleMapEmbed` className prop:

```jsx
          <GoogleMapEmbed address={settings?.address} className="h-56 w-full rounded-[var(--radius-card)] border border-brand-line" />
```

Replace the "Get Directions" anchor className:

```jsx
              className="rounded-[var(--radius-button)] bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
```

Replace the "Contact Us" link className:

```jsx
              className="rounded-[var(--radius-button)] border border-brand-navy px-6 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
```

- [ ] **Step 9: Verify visually across all three themes**

Run: `cd frontend && npm run dev`. In the admin Settings page, switch `site_theme` to each of `warm`, `bright`, `premium` in turn, saving between each. After each save, visit `/services`, `/doctors`, `/testimonials`, `/contact`, and the header/footer on any page.
Expected for **every** theme: no visible hardcoded-radius mismatches (e.g. a card with sharp corners next to rounded ones), the "Book Appointment" and "Get Directions" buttons take the theme's button shape (sharp for premium, soft-rounded for warm, pill for bright), and card backgrounds/borders look correct (frosted/translucent for bright, solid white for warm/premium).

- [ ] **Step 10: Lint and commit**

Run: `cd frontend && npm run lint`
Expected: no new errors introduced.

```bash
git add frontend/src/components/public/ServiceCard.jsx frontend/src/components/public/DoctorCard.jsx frontend/src/components/public/TestimonialCard.jsx frontend/src/components/public/EmptyState.jsx frontend/src/components/public/ContactForm.jsx frontend/src/components/public/GoogleMapEmbed.jsx frontend/src/components/public/PublicHeader.jsx frontend/src/pages/public/Contact.jsx
git commit -m "feat: tokenize shared public components for theme-driven radius/shadow/color"
```

---

### Task 7: Frontend — Home page tokenization + signature touches

**Files:**
- Create: `frontend/src/hooks/useScrolledPast.js`
- Create: `frontend/src/components/public/home/StatsStrip.jsx`
- Create: `frontend/src/components/public/home/StickyBookCta.jsx`
- Create: `frontend/src/components/public/home/CredentialsTicker.jsx`
- Modify: `frontend/src/pages/public/Home.jsx`

**Interfaces:**
- Consumes: `useTheme()` from `frontend/src/contexts/ThemeContext.jsx` (Task 4).
- Produces: `useScrolledPast(thresholdPx: number): boolean`, `<StatsStrip />`, `<StickyBookCta />`, `<CredentialsTicker />` — each a self-contained, prop-less component.

- [ ] **Step 1: Create the scroll hook**

Create `frontend/src/hooks/useScrolledPast.js`:

```javascript
import { useEffect, useState } from 'react';

export function useScrolledPast(thresholdPx) {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolledPast(window.scrollY > thresholdPx);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [thresholdPx]);

  return scrolledPast;
}
```

- [ ] **Step 2: Create StatsStrip (Warm Recovery signature touch)**

Create `frontend/src/components/public/home/StatsStrip.jsx`:

```jsx
const stats = [
  { value: '500+', label: 'Patients Recovered' },
  { value: '10+', label: 'Years of Care' },
  { value: '98%', label: 'Satisfaction Rate' },
];

export default function StatsStrip() {
  return (
    <div className="border-b border-brand-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-[var(--radius-card)] bg-brand-ice px-6 py-5">
            <span className="font-display text-3xl text-brand-navy">{stat.value}</span>
            <span className="font-mono-brand text-xs tracking-[0.08em] text-brand-ink-soft uppercase">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create StickyBookCta (Bright Health-Tech signature touch)**

Create `frontend/src/components/public/home/StickyBookCta.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { useScrolledPast } from '../../../hooks/useScrolledPast.js';

export default function StickyBookCta() {
  const visible = useScrolledPast(480);

  return (
    <Link
      to="/book"
      className={`fixed right-5 bottom-5 z-30 rounded-[var(--radius-button)] bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-all duration-300 hover:bg-[var(--color-brand-navy-hover)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      Book Now
    </Link>
  );
}
```

- [ ] **Step 4: Create CredentialsTicker (Premium Calm signature touch)**

Create `frontend/src/components/public/home/CredentialsTicker.jsx`:

```jsx
const credentials = [
  '10+ Years of Clinical Experience',
  'Certified Physiotherapists',
  '500+ Patients Treated',
  'Evidence-Based Rehabilitation',
];

export default function CredentialsTicker() {
  return (
    <div className="border-b border-brand-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 sm:px-6">
        {credentials.map((item, i) => (
          <span key={item} className="flex items-center gap-2.5 font-mono-brand text-[11.5px] tracking-[0.08em] text-brand-ink-soft uppercase">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-brand-blue" aria-hidden="true" />}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite Home.jsx**

Replace the full contents of `frontend/src/pages/public/Home.jsx` with:

```jsx
import { Link } from 'react-router-dom';
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicServices } from '../../hooks/useServices.js';
import { usePublicDoctors } from '../../hooks/useDoctors.js';
import { usePublicTestimonials } from '../../hooks/useTestimonials.js';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { getPhotoUrl } from '../../utils/photoUrl.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ServiceCard from '../../components/public/ServiceCard.jsx';
import DoctorCard from '../../components/public/DoctorCard.jsx';
import TestimonialCard from '../../components/public/TestimonialCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';
import GoogleMapEmbed from '../../components/public/GoogleMapEmbed.jsx';
import StatsStrip from '../../components/public/home/StatsStrip.jsx';
import StickyBookCta from '../../components/public/home/StickyBookCta.jsx';
import CredentialsTicker from '../../components/public/home/CredentialsTicker.jsx';
import fallbackDoctorPhoto from '../../assets/doctor-daniel.jpg';

const whyIcons = [
  <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
  <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>,
  <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"
    />
  </svg>,
  <svg key="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
];

const processSteps = [
  {
    title: 'Assessment & Diagnosis',
    body: 'A full physical evaluation, movement screening, and diagnostic review to identify the root cause — not just the symptom.',
  },
  {
    title: 'Personalised Treatment Plan',
    body: 'A tailored plan combining manual therapy, targeted exercises, and measurable recovery milestones.',
  },
  {
    title: 'Active Rehabilitation',
    body: 'Guided in-clinic sessions with progress tracked against range-of-motion and strength benchmarks.',
  },
  {
    title: 'Maintenance & Prevention',
    body: 'A long-term movement plan to prevent re-injury and maintain full function.',
  },
];

const seeMoreLinkClass =
  'inline-flex items-center gap-1.5 font-mono-brand text-xs tracking-[0.08em] text-brand-navy uppercase transition-colors hover:text-brand-sage';

export default function Home() {
  usePageTitle('Home');
  const { data: content } = usePublicContent();
  const { data: services } = usePublicServices();
  const { data: doctors } = usePublicDoctors();
  const { data: testimonials } = usePublicTestimonials();
  const { data: settings } = usePublicSettings();
  const theme = useTheme();

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
      {theme === 'bright' && <StickyBookCta />}

      {/* ---------- Hero ---------- */}
      <section
        className="relative flex min-h-[calc(100vh-77px)] items-center overflow-hidden border-b border-brand-line"
        style={{ backgroundImage: 'var(--hero-bg)' }}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="mb-4 flex items-center gap-2.5 font-mono-brand text-xs tracking-[0.14em] text-brand-blue uppercase">
              <span className="h-px w-7 bg-brand-blue" aria-hidden="true" />
              Trusted Physiotherapy Care
            </span>
            <h1 className="font-display text-[clamp(34px,4.4vw,50px)] leading-[1.08] font-normal text-brand-navy">{content?.hero_title}</h1>
            <p className="mt-4 max-w-[470px] text-[16.5px] text-brand-ink-soft">{content?.hero_subtitle}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                to="/book"
                className="rounded-[var(--radius-button)] bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
              >
                Book a Consultation
              </Link>
              <Link
                to="/services"
                className="rounded-[var(--radius-button)] border border-brand-navy px-6 py-3.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
              >
                View Services
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative aspect-4/5 w-full max-w-[360px] overflow-hidden rounded-[var(--radius-card)] border border-brand-line bg-brand-ice shadow-[var(--shadow-card)]">
              <img
                src={content?.hero_image_url ? getPhotoUrl(content.hero_image_url) : fallbackDoctorPhoto}
                alt="Dr. Chenna Daniel"
                className="h-full w-full object-cover"
              />
              <svg className="absolute top-4.5 right-4.5 opacity-90" width="46" height="30" viewBox="0 0 46 30">
                <path d="M3 28 A20 20 0 0 1 43 28" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4" />
              </svg>
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-(--color-brand-navy)/90 to-(--color-brand-navy)/5 px-5.5 pt-5 pb-4.5">
                <div className="font-display text-[22px] leading-[1.1] text-white italic">Dr. Chenna Daniel</div>
                <div className="mt-1.5 font-mono-brand text-[10.5px] tracking-[0.1em] text-white/70 uppercase">
                  Founder &amp; Lead Physiotherapist
                </div>
              </div>
            </div>

            <div className="absolute bottom-8 left-0 flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-line bg-white px-4.5 py-3.5 shadow-[var(--shadow-card)] lg:left-[-40px]">
              <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-brand-ice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-brand-sage">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <div>
                <div className="font-display text-[19px] leading-none text-brand-navy">10+ yrs</div>
                <div className="mt-1 font-mono-brand text-[9.5px] tracking-[0.05em] text-brand-ink-soft uppercase">Certified &amp; Trusted</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {theme === 'warm' && <StatsStrip />}
      {theme === 'premium' && <CredentialsTicker />}

      {/* ---------- Trust strip ---------- */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          {trustLines.map((line, i) => (
            <p key={i} className="flex items-center gap-2.5 font-mono-brand text-[13px] text-brand-ink-soft">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-sage" aria-hidden="true" />
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* ---------- Why us / About ---------- */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="About Us" title={content?.home_about_heading} subtitle={content?.home_about_body} />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-brand-line bg-brand-line sm:grid-cols-2 lg:grid-cols-4">
            {whyItems.map((item, i) => (
              <div key={i} className="bg-white p-8">
                <div className="flex h-13 w-13 items-center justify-center rounded-full bg-brand-ice text-brand-blue">{whyIcons[i]}</div>
                <h3 className="mt-5 font-display text-lg font-normal text-brand-navy">{item.title}</h3>
                <p className="mt-2 text-sm text-brand-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section className="border-y border-brand-line bg-brand-ice py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="What We Treat" title={content?.home_services_heading} align="left" />
          {previewServices.length === 0 ? (
            <EmptyState label="Services" />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {previewServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link to="/services" className={seeMoreLinkClass}>
              See all services →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Doctors ---------- */}
      <section className="border-b border-brand-line bg-brand-ice py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Meet the Team" title={content?.home_doctors_heading} align="left" />
          {previewDoctors.length === 0 ? (
            <EmptyState label="Doctor profiles" />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {previewDoctors.map((doctor) => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link to="/doctors" className={seeMoreLinkClass}>
              Meet all doctors →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Patient Stories ---------- */}
      <section className="bg-brand-navy py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <span className="mb-4 flex items-center gap-2.5 font-mono-brand text-xs tracking-[0.14em] text-white/60 uppercase">
              <span className="h-px w-7 bg-white/60" aria-hidden="true" />
              Patient Stories
            </span>
            <h2 className="font-display text-3xl leading-[1.15] font-normal text-white sm:text-4xl">{content?.home_testimonials_heading}</h2>
          </div>
          {previewTestimonials.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-white/20 bg-white/4 px-6 py-14 text-center">
              <p className="text-white/60">Patient testimonials coming soon — check back shortly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
              {previewTestimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} dark />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Process ---------- */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="The Approach"
            title="Your recovery, mapped out."
            subtitle="A structured process from first visit to full function — because guesswork has no place in rehabilitation."
            align="left"
          />
          <div className="relative flex flex-col">
            {theme === 'premium' && (
              <div className="absolute top-0 bottom-0 left-[27px] w-px bg-brand-blue sm:left-[44px]" aria-hidden="true" />
            )}
            {processSteps.map((step, i) => (
              <div key={step.title} className="grid grid-cols-[56px_1fr] gap-6 border-t border-brand-line py-7 last:border-b sm:grid-cols-[90px_1fr] sm:gap-7">
                <div className="font-mono-brand text-[13px] text-brand-sage">
                  <svg width="34" height="22" viewBox="0 0 34 22" className="mb-2">
                    <path d="M2 20 A15 15 0 0 1 32 20" fill="none" style={{ stroke: 'var(--color-brand-sage)' }} strokeWidth="1.6" />
                  </svg>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 className="font-display text-2xl font-normal text-brand-navy">{step.title}</h3>
                  <p className="mt-1.5 max-w-[560px] text-[15px] text-brand-ink-soft">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section className="bg-brand-ice py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Get In Touch" title={content?.home_contact_heading} align="left" />
          <GoogleMapEmbed address={settings?.address} className="mb-6 h-64 w-full rounded-[var(--radius-card)] border border-brand-line" />
          <div className="grid grid-cols-1 gap-6 rounded-[var(--radius-card)] border border-brand-line bg-white p-8 sm:grid-cols-2">
            <div className="space-y-2 text-brand-ink-soft">
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
                  className="rounded-[var(--radius-button)] bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
                >
                  Get Directions
                </a>
              )}
              <Link
                to="/contact"
                className="rounded-[var(--radius-button)] border border-brand-navy px-6 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Verify all three signature touches**

Run: `cd frontend && npm run dev`. In admin Settings, set theme to `warm`, save, visit `/`.
Expected: a rounded 3-stat strip appears directly under the hero.

Set theme to `premium`, save, visit `/`.
Expected: the stat strip is gone; a horizontal credentials strip appears under the hero instead; scrolling to the "The Approach" section shows a thin vertical accent line running through the numbered steps.

Set theme to `bright`, save, visit `/`, scroll down past the hero.
Expected: neither strip appears under the hero; a pill-shaped "Book Now" button fades in at the bottom-right of the viewport once you've scrolled past ~480px, and clicking it navigates to `/book`.

- [ ] **Step 7: Lint and commit**

Run: `cd frontend && npm run lint`
Expected: no new errors.

```bash
git add frontend/src/hooks/useScrolledPast.js frontend/src/components/public/home frontend/src/pages/public/Home.jsx
git commit -m "feat: tokenize Home page and add per-theme signature touches"
```

---

### Task 8: Full cross-theme manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full page sweep on each theme**

Run: `cd frontend && npm run dev` and `cd backend && npm run dev` (check `backend/package.json` for the exact dev script name if different).

For each of the three `site_theme` values (set via `/admin/settings`, one at a time):
1. Visit `/` (Home) — check hero, trust strip, About cards, Services preview, Doctors preview, Patient Stories (dark section), Process timeline, Contact section, and the theme's signature touch.
2. Visit `/services`, `/doctors`, `/testimonials`, `/contact` — check card radius/shadow/background match the theme, buttons match the theme's button shape, forms render correctly.
3. Check the header (desktop nav + mobile hamburger menu) and footer on any page.
4. Resize the browser to a narrow (mobile) width and repeat the header/mobile-menu check.

Expected: every page reflects the active theme's color palette, fonts (headings noticeably switch between Fraunces/Sora/Playfair Display), corner radius (soft/pill/sharp), and shadow style, with no leftover hardcoded colors or radii that clash with the active theme, and no console errors.

- [ ] **Step 2: Confirm default and persistence**

Set `site_theme` back to `premium` and confirm the DB row set-up in Task 1 truly defaults new rows to `premium` (already verified in Task 1, re-confirm here after all the UI work): reload `/admin/settings` and the public site once more.

Expected: "Premium Calm" is selected in the dropdown and `data-theme="premium"` is present on the public site root.

- [ ] **Step 3: Final full-repo lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

No commit for this task — it's verification only. If any issue is found, fix it in the relevant task's files and amend that task's commit message context (create a small follow-up commit describing the fix).
