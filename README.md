# Simple Hearing — Web Dashboard

React 18 + TypeScript admin dashboard for managing clinics, patients, and staff.

## Tech Stack

- **React 18** with TypeScript
- **Vite** — dev server and bundler
- **React Router v6** — client-side routing
- **TanStack Query** — server state / data fetching
- **Axios** — HTTP client
- **React Hook Form + Zod** — form validation
- **Tailwind CSS** — styling

## Requirements

- Node 18+
- npm

## Starting the App

```bash
npm install
npm run dev
```

App runs at **http://localhost:3000**

API calls to `/api/*` are proxied to `http://localhost:8080` (the backend). The backend does not need to be running if you use the dev auth bypass (see below).

### Other scripts

```bash
npm run build    # type-check + production build → dist/
npm run preview  # serve the production build locally
```

## Dev Auth Bypass

Authentication is **disabled by default** for local development. The app logs you in automatically as a hardcoded dev user — no backend required.

**Controlled by two flags:**

| File | Line |
|------|------|
| [`src/App.tsx`](src/App.tsx) | 18 |
| [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) | 21 |

```typescript
const BYPASS_AUTH = true  // change to false to enable real auth
```

When `true`, the app:
- Skips login/register pages entirely and redirects straight to `/dashboard`
- Injects a hardcoded dev user into the auth context:
  - **Email**: `dev@simplehearing.com`
  - **Role**: `BUSINESS_OWNER`
  - **Org ID**: `00000000-0000-0000-0000-000000000002`

To use real JWT authentication, set `BYPASS_AUTH = false` in **both files** and start the backend.

## Pages

| Route | Page |
|-------|------|
| `/dashboard` | Overview |
| `/organisation` | Organisation settings |
| `/clinics` | Clinic list |
| `/clinics/:id` | Clinic detail |
| `/patients` | Patient list |
| `/patients/:id` | Patient detail |
| `/invitations` | Staff invitations |
| `/login` | Login (only reachable when `BYPASS_AUTH = false`) |
| `/register` | Register (only reachable when `BYPASS_AUTH = false`) |

## Project Structure

```
src/
├── api/            # Axios API calls per domain (auth, clinics, patients…)
├── components/
│   ├── layout/     # AppLayout, Sidebar
│   └── ui/         # Shared components (Button, Input, Modal, Toast…)
├── contexts/       # AuthContext — user state + login/logout
├── hooks/          # useToast
├── pages/          # Route-level page components
├── types/          # Shared TypeScript types
└── lib/            # Utilities (clsx)
```
