# Simple Hearing — Web Dashboard

React 18 + TypeScript admin dashboard for managing clinics, patients, and staff.

## Tech Stack

- **React 18** with TypeScript
- **Vite** — dev server and bundler
- **React Router v6** — client-side routing
- **TanStack Query** — server state / data fetching
- **Axios** — HTTP client
- **React Hook Form** — form handling
- **Tailwind CSS** — utility classes
- **Lucide React** — icons

## Requirements

- Node 18+
- npm

## Starting the App

```bash
npm install
npm run dev
```

App runs at **http://localhost:3000**. API calls to `/api/*` are proxied to `http://localhost:8080` (the backend).

```bash
npm run build    # type-check + production build → dist/
npm run preview  # serve the production build locally
```

---

## Theming — How colours work

All colours are controlled in **two places only**. You never need to touch individual component files to change how the app looks.

### 1. `src/index.css` — the single source of truth

This file defines every visual token as a CSS custom property (variable). There are two blocks:

| Block | Purpose |
|-------|---------|
| `:root { … }` | **Light mode** defaults — active when the `<html>` element has no `.dark` class |
| `.dark { … }` | **Dark mode** overrides — active when `<html>` has the `.dark` class |

#### How to change the background colour

Find `--surface-app` inside the `:root` block (around line 36) and change its value:

```css
:root {
  --surface-app: #E8EEF6;   /* ← this controls the light-mode page background */
}
```

The `body` is already wired to use it:

```css
body {
  background-color: var(--surface-app);
}
```

So editing one hex value repaints the entire app background instantly — no component changes needed.

#### Key surface variables

| Variable | Controls |
|----------|---------|
| `--surface-app` | Main page background (behind cards) |
| `--surface-card` | Card / panel background |
| `--surface-sidebar` | Sidebar background |
| `--surface-footer` | Footer chip / badge backgrounds |
| `--surface-filter-strip` | Tab-filter strip background |
| `--surface-row-hover` | Table row hover highlight |

#### Key colour variables

| Variable | Controls |
|----------|---------|
| `--color-accent` | Nav highlights, links, active states (teal) |
| `--color-cta` | Primary action buttons (coral) |
| `--text-heading` | Page `<h1>` titles |
| `--text-primary` | Body text, card titles |
| `--text-muted` | Secondary labels |
| `--text-dim` | Placeholders, descriptions |

#### Dark mode

The `.dark` block (around line 108) overrides only the values that need to change in dark mode. The toggle lives in the Sidebar — it adds/removes the `.dark` class on `<html>` and saves the preference to `localStorage`.

To change the dark mode background, edit `--surface-app` inside the `.dark` block:

```css
.dark {
  --surface-app: #18202E;   /* ← dark mode page background */
}
```

### 2. `src/theme.ts` — typed JS references for inline styles

Components receive colour values as inline `style` props (not Tailwind classes), so TypeScript can catch typos. `theme.ts` reads the CSS variables and exports typed helpers:

```ts
colors.text.heading   // reads --text-heading
colors.text.muted     // reads --text-muted
colors.accent         // reads --color-accent
surface.sidebarFooter // reads --surface-footer
border.divider        // reads --border-divider
```

**You do not hardcode hex values in components.** Always use a `theme.ts` export. If you need a new token:

1. Add the CSS variable to `:root` (and `.dark` if it differs between modes) in `index.css`
2. Export it from `theme.ts`
3. Use it in the component

---

## Dev Auth Bypass

Set `BYPASS_AUTH = true` in **both** of the files below to skip login during development:

| File | ~Line |
|------|-------|
| `src/App.tsx` | 24 |
| `src/contexts/AuthContext.tsx` | 21 |

When `true`, the app injects a hardcoded dev user (role: `BUSINESS_OWNER`) and skips all auth redirects. Set both flags to `false` and start the backend for real JWT auth.

---

## Pages & Routes

| Route | Page | Roles |
|-------|------|-------|
| `/dashboard` | Overview | All |
| `/organisation` | Org settings | BUSINESS_OWNER, ADMIN |
| `/clinics` | Clinic list | All |
| `/clinics/:id` | Clinic detail | All |
| `/patients` | Patient list | BUSINESS_OWNER, ADMIN, THERAPIST|
| `/patients/:id` | Patient detail | BUSINESS_OWNER, ADMIN, THERAPIST|
| `/my-children` | Linked children | PARENT |
| `/therapists` | Therapist directory | BUSINESS_OWNER, ADMIN |
| `/appointments` | Appointment list | All |
| `/appointments/book` | Book appointment | PARENT, BUSINESS_OWNER |
| `/my-leave` | Apply for leave | THERAPIST|
| `/leave-management` | Review leave requests | BUSINESS_OWNER, ADMIN |
| `/invitations` | Staff invitations | BUSINESS_OWNER, ADMIN |
| `/login` | Login | Public |
| `/register` | Register | Public |

---

## Project Structure

```
src/
├── index.css           # ★ ALL colour tokens live here (:root + .dark)
├── theme.ts            # ★ JS/TS typed exports of the CSS vars (for inline styles)
├── App.tsx             # Routes + auth guards
├── main.tsx            # ReactDOM.createRoot entry
│
├── api/                # One file per backend resource
├── components/
│   ├── layout/         # AppLayout, Sidebar
│   └── ui/             # Button, Card, Input, Modal, Toast …
├── contexts/           # AuthContext, ThemeContext
├── hooks/              # useToast
├── lib/                # clsx, timezones
├── pages/              # Route-level page components
└── types/              # Shared TypeScript interfaces & enums
```
