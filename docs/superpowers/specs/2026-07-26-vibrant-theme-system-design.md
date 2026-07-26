# Vibrant Multi-Theme Redesign — Design Spec

Date: 2026-07-26

## Problem

The public site currently uses a single, muted editorial palette (navy `#0b2e4e` / sage `#4c8c6b` / ice `#eef4f7`) across every page. The clinic wants a more vibrant, patient-attractive visual identity, but rather than committing to one direction, wants three genuinely distinct design directions built, with the admin able to pick — and permanently switch between — whichever one represents the clinic's site.

## Goals

- Three distinct, fully vibrant visual themes, each with its own color palette, font pairing, and "feel" (corner radius, shadows, decorative motifs), plus one small signature structural touch.
- Themes apply across the entire public site: header, footer, Home, Services, Doctors, Testimonials, Contact.
- An admin-only control (Settings page) sets which theme is live for all visitors, persisted in the database.
- The mechanism is a **permanent** feature, not a one-time throwaway comparison tool — all three themes and the switch stay in the codebase indefinitely.

## Non-goals

- No visitor-facing theme toggle — only admins change the site theme.
- No changes to page content, data model of services/doctors/testimonials, or routing.
- No dark-mode variant of any theme.

## Architecture

### Theme tokens via CSS custom properties

`frontend/src/index.css` already declares brand colors as Tailwind v4 `@theme` variables, which compile to real CSS custom properties (e.g. `--color-brand-navy`) that Tailwind utilities reference via `var(...)`. This means the values can be swapped at runtime per `data-theme` attribute without a rebuild.

Each theme redefines a shared token set, scoped under `[data-theme="warm"]`, `[data-theme="bright"]`, `[data-theme="premium"]` selectors on `<html>` or the `PublicLayout` root:

- Color tokens: `--color-brand-navy`, `--color-brand-blue`, `--color-brand-ice`, `--color-brand-sage`, `--color-brand-ink`, `--color-brand-ink-soft`, `--color-brand-line` (reused as semantic slots — primary/secondary/background/accent/text/text-soft/border — even though the literal colors differ per theme; component code keeps using the same class names like `bg-brand-navy`, `text-brand-sage`).
- New tokens needed for feel differentiation: `--radius-card` (e.g. `4px` / `24px` / `10px`), `--shadow-card`, `--hero-bg` (gradient or solid), `--font-display`, `--font-mono-brand`.
- Google Fonts for all three theme's display/body fonts are preloaded in `index.html` up front (Fraunces, Plus Jakarta Sans, Sora, Inter, IBM Plex Sans/Mono, Instrument Serif can stay or be dropped if unused) so switching is instant with no font-load flash.

Components keep referencing the same semantic Tailwind classes (`bg-brand-navy`, `font-display`, `rounded-(--radius-card)`, `shadow-(--shadow-card)`) — no per-component theme branching for colors/type/spacing. This keeps one shared JSX tree across all three themes for the bulk of the UI.

### Signature structural touches

Each theme has exactly one small distinguishing structural element, implemented as a conditionally-rendered piece (not a forked page):

- **Warm Recovery**: a rounded stats strip ("500+ patients recovered · 10+ years · 98% satisfaction") rendered under the Home hero.
- **Bright Health-Tech**: a sticky pill-shaped "Book Now" CTA that fades in bottom-right after the user scrolls past the hero (Home page only, via a small scroll-position hook).
- **Premium Calm**: a credentials/awards ticker strip under the Home hero, and a vivid accent connector line drawn through the existing Process timeline on Home.

These are read from a `useTheme()` hook / `ThemeContext` that exposes the active theme string, and gated with a simple `{theme === 'warm' && <StatsStrip />}` conditional inside `Home.jsx`. No other page gets structural conditionals — the signature touches all live on Home, since that's where they have the most impact and keeps the blast radius small.

### Theme selection plumbing

- **Backend**: add `site_theme VARCHAR(20) NOT NULL DEFAULT 'premium'` to `hospital_settings` (via `ALTER TABLE ... ADD COLUMN` guarded by the existing `information_schema.COLUMNS` check pattern already used in `backend/scripts/migrate.js` for `appointments.service_id`). Add `site_theme: z.enum(['warm', 'bright', 'premium']).optional()` to `settingsValidators.js`. No new routes — it rides the existing `PUT /settings` endpoint and `hospital_settings` row.
- **Frontend admin**: `SettingsForm.jsx` gets a "Site Theme" `<select>` with the three options (labeled "Warm Recovery", "Bright Health-Tech", "Premium Calm"), wired into the existing `react-hook-form` + `useUpdateSettings` flow like every other field.
- **Frontend public**: `PublicLayout.jsx` reads `site_theme` from `usePublicSettings()` (already fetched there indirectly via header/footer — `PublicLayout` will call the hook directly) and sets `data-theme={settings?.site_theme || 'premium'}` on its root wrapper div. A `ThemeContext` provider wraps `Outlet` so `Home.jsx` can read the active theme for its signature-touch conditionals without re-fetching settings.
- Default theme (before any admin changes it, and as DB default): **Premium Calm** — closest continuation of the current navy identity, safest default for an already-live clinic site.

## The three themes

### 1. Warm Recovery

| Token | Value |
|---|---|
| Primary (navy slot) | `#C24A2C` (deep terracotta) |
| Blue slot (secondary) | `#1F6F63` (deep teal) |
| Ice slot (background) | `#FBF6EF` (warm cream) |
| Sage slot (accent) | `#F2A93B` (golden amber) |
| Ink / ink-soft | `#2B2320` / `#6B5E52` |
| Line | `#E7DCC9` |
| Display font | "Fraunces" (italic accents) |
| Body font | "Plus Jakarta Sans" |
| Radius | `20px` (rounded-2xl/3xl feel) |
| Shadow | soft, diffused, warm-tinted (`0 20px 45px -20px rgba(194,74,44,0.25)`) |
| Motifs | organic blob shapes behind hero image, soft gradient section dividers |
| Signature touch | rounded stats strip under Home hero |

### 2. Bright Health-Tech

| Token | Value |
|---|---|
| Primary (navy slot) | `#0E7C74` (vivid teal, used for headings/buttons) |
| Blue slot (secondary) | `#2D6CDF` (electric blue) |
| Ice slot (background) | `#F5FAFA` with a soft gradient-mesh hero background |
| Sage slot (accent) | `#FF6B5D` (coral) with `#C6F135` (lime) as a secondary highlight |
| Ink / ink-soft | `#101828` / `#475467` |
| Line | `#DCEEEC` |
| Display font | "Sora" |
| Body font | "Inter" |
| Radius | `14px` |
| Shadow | glassmorphism — translucent white panels, `backdrop-blur`, subtle border, soft glow shadow |
| Motifs | animated gradient-mesh hero background, hover glow/scale micro-motion on cards and buttons |
| Signature touch | sticky pill "Book Now" CTA, bottom-right, appears on scroll past hero |

### 3. Premium Calm (default)

| Token | Value |
|---|---|
| Primary (navy slot) | `#0B2E4E` (kept — current brand navy) |
| Blue slot (secondary) | `#6D5AE6` (vivid violet-indigo, replaces muted blue) |
| Ice slot (background) | `#FFFFFF` |
| Sage slot (accent) | `#F2994A` (warm gold highlight, replaces muted sage) |
| Ink / ink-soft | `#142430` / `#4A5C68` (kept) |
| Line | `#E3E7EC` |
| Display font | "Fraunces" bold italic (bigger/punchier than current Instrument Serif) |
| Body font | "IBM Plex Sans" (kept for continuity) |
| Radius | `6px` (sharper than the other two) |
| Shadow | high-contrast, dramatic (`0 30px 70px -34px rgba(11,46,78,0.45)`) |
| Motifs | duotone navy+violet treatment on the hero photo, editorial asymmetric grid |
| Signature touch | credentials/awards ticker strip under Home hero; vivid violet connector line through the Process timeline |

## Pages affected

All public pages consume the same semantic tokens, so no page needs theme-specific JSX beyond Home's signature touches:

- `PublicHeader.jsx`, `PublicFooter.jsx` — colors/fonts/radius via tokens only.
- `Home.jsx` — tokens + the three conditional signature-touch blocks.
- `Services.jsx`, `Doctors.jsx`, `Testimonials.jsx`, `Contact.jsx` — tokens only (card radius/shadow, buttons, headings all already flow through shared components: `ServiceCard`, `DoctorCard`, `TestimonialCard`, `SectionHeading`, `ContactForm`, `GoogleMapEmbed`).
- Shared components (`ServiceCard`, `DoctorCard`, `TestimonialCard`, `SectionHeading`, `EmptyState`, `ConfirmDialog` is admin-only so excluded) — updated once to use token-based radius/shadow instead of hardcoded `rounded-[4px]` etc., so all three themes render them correctly.

## Testing

- Manual verification: toggle the admin Settings theme dropdown through all three values and click through every public page (Home, Services, Doctors, Testimonials, Contact, header/footer, mobile menu) confirming colors/fonts/radius/shadows update and no layout breaks.
- Verify the default (no `site_theme` set / fresh DB row) renders Premium Calm.
- Verify the migration is idempotent (running `migrate.js` twice doesn't error) per the existing guarded-ALTER pattern.
- No automated test suite exists for the frontend currently (no test runner configured) — this stays consistent with existing project conventions; verification is manual/visual.

## Open risks

- Font loading: preloading 5–6 font families up front adds page-weight; acceptable trade-off for instant theme switching without flash-of-unstyled-font. If this becomes a real performance concern later, fonts could be lazy-loaded per active theme instead — out of scope for this pass.
- Shared components currently use hardcoded pixel values (e.g. `rounded-[4px]`) in several places (Home.jsx hero card, contact section, etc.) — these all need to move to the `--radius-card` / `--shadow-card` tokens as part of this work, not left mixed.
