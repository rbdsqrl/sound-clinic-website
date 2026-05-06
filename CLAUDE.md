# Simple Hearing Frontend — CLAUDE.md

Developer context for AI assistants working on this codebase.

---

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Language       | TypeScript                                  |
| Framework      | React 18                                    |
| Build          | Vite                                        |
| Routing        | React Router v6                             |
| Data fetching  | TanStack Query (React Query v5)             |
| Forms          | React Hook Form                             |
| HTTP client    | Axios (`src/api/client.ts`)                 |
| Styling        | Tailwind CSS + inline styles via `theme.ts` |
| Icons          | Lucide React                                |
| Date utils     | date-fns                                    |

---

## Running Locally

```bash
cd website
npm run dev
```

App runs on **http://localhost:3000**.  
Vite proxies `/api/*` → `http://localhost:8080` (backend must be running).

---

## File Structure

```
src/
├── App.tsx                          # Root: routes, providers, auth guards
├── main.tsx                         # ReactDOM.createRoot entry point
├── theme.ts                         # All design tokens (colors, spacing, styles) + LOGO_SRC
│
├── assets/
│   └── logo.png                     # Brand logo — always reference via LOGO_SRC from theme.ts
│
├── types/
│   └── index.ts                     # All TypeScript types, interfaces, enums
│
├── api/                             # One file per backend resource
│   ├── client.ts                    # Axios instance with auth interceptors
│   ├── auth.ts                      # login, refresh, logout
│   ├── clinics.ts                   # list, get, create, update clinic
│   ├── patients.ts                  # CRUD patients + conditions/parents/therapists
│   ├── appointments.ts              # slots + appointments (list, book, update status)
│   ├── users.ts                     # me, listTherapists, search
│   ├── organisation.ts              # get, update org
│   ├── invitations.ts               # invite, list, accept
│   ├── leaves.ts                    # apply, list, review, cancel leave
│   └── conditions.ts                # list conditions (lookup)
│
├── contexts/
│   ├── AuthContext.tsx               # useAuth: user, isAuthenticated, login, logout, switchRole
│   └── ThemeContext.tsx              # useTheme: theme ('light'|'dark'), toggleTheme
│
├── hooks/
│   └── useToast.ts                  # Toast notifications: toast(message, variant)
│
├── lib/
│   ├── clsx.ts                      # Minimal className joiner utility
│   └── timezones.ts                 # IANA timezone list for select inputs
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx            # Mobile header + Sidebar + <Outlet> shell for protected pages
│   │   └── Sidebar.tsx              # Nav links (role-scoped), theme toggle (bottom), user footer
│   └── ui/
│       ├── Badge.tsx                # Coloured pill badge (variant prop)
│       ├── Button.tsx               # Primary / secondary / ghost variants + loading state
│       ├── Card.tsx                 # Surface card with optional padding prop
│       ├── EmptyState.tsx           # Centered empty-state with icon + message
│       ├── Input.tsx                # Labelled text input with error display
│       ├── Modal.tsx                # Overlay modal with title + close button
│       ├── Select.tsx               # Labelled select with error display
│       ├── Spinner.tsx              # Loading spinner + PageLoader full-screen variant
│       ├── Toast.tsx                # Toast notification component
│       └── UserSearchPicker.tsx     # Async user search-and-select input
│
└── pages/
    ├── LandingPage.tsx              # Public marketing page — always light mode (force-light class)
    ├── DashboardPage.tsx            # Role-scoped summary cards + recent data
    ├── OrganisationPage.tsx         # View/edit org profile (BUSINESS_OWNER, ADMIN)
    ├── InvitationsPage.tsx          # Invite by email+role; list sent invites
    │
    ├── auth/
    │   ├── LoginPage.tsx            # Email + password login form
    │   ├── RegisterPage.tsx         # New org registration (file exists but route removed — white-label app)
    │   └── AcceptInvitePage.tsx     # Accept invite token → set name + password
    │
    ├── clinics/
    │   ├── ClinicsPage.tsx          # List clinics with create modal
    │   └── ClinicDetailPage.tsx     # View/edit single clinic
    │
    ├── patients/
    │   ├── PatientsPage.tsx         # List + filter patients
    │   ├── PatientDetailPage.tsx    # View patient + manage conditions/parents/therapists
    │   └── MyChildrenPage.tsx       # PARENT role: their linked children
    │
    ├── therapists/
    │   └── TherapistsPage.tsx       # List therapists/doctors; filter by clinic + search
    │
    ├── availability/
    │   └── AvailabilityPage.tsx     # Manage recurring weekly slots (file exists, route removed from nav)
    │
    ├── leave/
    │   ├── MyLeavePage.tsx          # THERAPIST/DOCTOR: apply + view own leave requests
    │   └── LeaveManagementPage.tsx  # BUSINESS_OWNER/ADMIN: review + approve/reject leave requests
    │
    └── appointments/
        ├── AppointmentsPage.tsx     # List appointments (role-scoped view)
        └── BookAppointmentPage.tsx  # Book new appointment (PARENT / BUSINESS_OWNER)
```

---

## Routing & Auth Guards (`App.tsx`)

```
/                   → LandingPage      (always public — no auth redirect)
/login              → LoginPage        (PublicRoute — redirects to /dashboard if logged in)
/accept-invite      → AcceptInvitePage (always public)

/dashboard          → DashboardPage         ┐
/organisation       → OrganisationPage       │
/clinics            → ClinicsPage            │
/clinics/:id        → ClinicDetailPage       │
/patients           → PatientsPage           │
/patients/:id       → PatientDetailPage      │ all wrapped in PrivateRoute → AppLayout
/my-children        → MyChildrenPage         │
/invitations        → InvitationsPage        │
/appointments       → AppointmentsPage       │
/appointments/book  → BookAppointmentPage    │
/availability       → AvailabilityPage       │
/therapists         → TherapistsPage         │
/my-leave           → MyLeavePage            │
/leave-management   → LeaveManagementPage   ┘

*                   → redirect to /
```

> `/register` route has been removed — this is a white-labelled app; staff are added via invitations only.

---

## Sidebar Navigation by Role (`Sidebar.tsx`)

```
BUSINESS_OWNER / ADMIN:
  Dashboard, Organisation, Clinics, Therapists, Patients, Appointments, Leave Requests, Add Members

THERAPIST / DOCTOR:
  Dashboard, Clinics, Patients, Appointments, My Leave

PARENT:
  Dashboard, My Children, Appointments, Book Appointment

PATIENT:
  Dashboard
```

Dark/Light mode toggle lives at the **bottom** of the sidebar as a full-width nav-style row (above the user footer card).

---

## Types (`src/types/index.ts`)

All API contracts live here. Keep in sync with backend DTOs.

| Export                             | Description                                              |
|------------------------------------|----------------------------------------------------------|
| `Role`                             | Union type of all user roles                             |
| `Gender`                           | `'MALE' \| 'FEMALE' \| 'OTHER'`                         |
| `InvitationStatus`                 | `'PENDING' \| 'ACCEPTED' \| 'EXPIRED' \| 'CANCELLED'`   |
| `AppointmentStatus`                | `'PENDING' \| 'CONFIRMED' \| 'CANCELLED' \| 'COMPLETED'`|
| `DayOfWeek`                        | `'MONDAY' \| ... \| 'SUNDAY'`                            |
| `LeaveType`                        | `'FULL_DAY' \| 'HALF_DAY'`                               |
| `LeaveStatus`                      | `'PENDING' \| 'APPROVED' \| 'REJECTED'`                 |
| `UserResponse`                     | Logged-in user / therapist profile                       |
| `LoginRequest / LoginResponse`     | Auth payloads                                            |
| `OrganisationResponse`             | Org profile                                              |
| `UpdateOrganisationRequest`        | Org update payload                                       |
| `ClinicResponse`                   | Clinic DTO                                               |
| `CreateClinicRequest`              | Clinic creation payload                                  |
| `PatientResponse`                  | Patient with embedded conditions, parents, therapists    |
| `CreatePatientRequest`             | Patient creation payload                                 |
| `SlotResponse`                     | Recurring availability slot                              |
| `CreateSlotRequest`                | Slot creation payload                                    |
| `AppointmentResponse`              | Appointment with enriched names                          |
| `BookAppointmentRequest`           | Appointment booking payload                              |
| `UpdateAppointmentStatusRequest`   | Status change payload                                    |
| `LeaveResponse`                    | Leave request with therapist + reviewer names            |
| `CreateLeaveRequest`               | Apply for leave payload                                  |
| `ReviewLeaveRequest`               | Approve/reject payload: `{ status: 'APPROVED' \| 'REJECTED' }` |
| `InviteRequest / InviteResponse`   | Invitation payloads                                      |
| `AcceptInviteRequest`              | Accept invite payload                                    |
| `ConditionResponse`                | Condition lookup item                                    |
| `ApiResponse<T>`                   | Universal backend wrapper                                |
| `allRoles(user)`                   | Returns primary + additional roles array                 |
| `hasRole(user, role)`              | Checks if user holds a specific role                     |

---

## Theme System (`src/theme.ts`)

**All colours, styles, and brand assets live in `theme.ts`. Never hardcode hex values or asset paths in components.**

| Export              | Description                                                        |
|---------------------|--------------------------------------------------------------------|
| `LOGO_SRC`          | Brand logo path — import this instead of hardcoding the path       |
| `colors`            | Text, status, role, accent colours — reads CSS vars                |
| `surface`           | Background surfaces (card, sidebar, hover states)                  |
| `border`            | Border colours (card, divider, sidebar)                            |
| `shadow`            | Box shadows (glow, nav dot)                                        |
| `gradient`          | Gradient strings (login background, logo badge, buttons)           |
| `palette`           | Named colour palettes: `blue`, `purple`, `green`, `yellow`, `slate`|
| `styles`            | Composed style objects: `card`, `sidebar`, `navActive`, `navInactive`, `button*`, `emptyIcon`, `avatar`, `slotBadge`, `filterTabActive`, `filterTabInactive` |
| `rgba(raw, a)`      | Compose `rgba(r,g,b, alpha)` from a raw CSS var string             |
| `accentAlpha(a)`    | Accent colour at given opacity                                      |
| `dangerAlpha(a)`    | Danger colour at given opacity                                      |
| `borderAlpha(a)`    | Border colour at given opacity                                      |
| `paletteStyle(name, a)` | Returns `{background, color}` style for a palette name         |

### Brand colour

The accent colour is **Brand Blue (`#2B80C8`)** — not teal. All CSS variable names still read from `--color-accent` / `--color-accent-raw`.

### Light / Dark Mode
- Toggled by adding/removing `.dark` class on `<html>`
- CSS custom properties defined in `index.css` under `:root` (light) and `.dark`
- `ThemeContext` persists preference to `localStorage`
- Theme toggle is a nav-row at the bottom of the Sidebar

### Landing page — always light
- `LandingPage.tsx` wraps its root `<div>` in `className="force-light"`
- `force-light` is defined in `index.css` and re-pins all CSS vars to light-mode values
- This ensures the public marketing page is unaffected by the user's dark/light preference

### CSS Classes (defined in `index.css`)
- `form-input` — styled text/select input
- `form-label` — field label
- `form-error` — red validation message
- `glass-card` — frosted-glass auth card
- `nav-active` / `nav-inactive` — sidebar nav link states
- `force-light` — overrides all CSS vars to light-mode values (used on LandingPage)
- `brand-logo` — applies `filter: brightness(0) invert(1) opacity(0.9)` in dark mode for white logo tint

---

## UI Components (`src/components/ui/`)

**Always reuse existing UI components instead of writing raw HTML equivalents. Never recreate styling inline when a component already exists.**

| Component | Import | Use for |
|-----------|--------|---------|
| `Input` | `../../components/ui/Input` | Every text / number / date / email input field |
| `Select` | `../../components/ui/Select` | Every `<select>` dropdown |
| `Modal` | `../../components/ui/Modal` | Modal overlays with title + close button |
| `Button` | `../../components/ui/Button` | Primary / secondary / ghost / danger buttons with loading state |
| `Badge` | `../../components/ui/Badge` | Coloured status pills |
| `Card` | `../../components/ui/Card` | Surface cards with padding |
| `EmptyState` | `../../components/ui/EmptyState` | Centred empty-state with icon + message |
| `Spinner` / `PageLoader` | `../../components/ui/Spinner` | Loading indicators |

### Forms — mandatory rules

- **Always use `<Input>` for text inputs** — never write `<input className="...">` or `<input style={{...}}>` directly.
- **Always use `<Select>` for dropdowns** — never write `<select className="...">` directly.
- **Labels:** use the `label` prop on `Input`/`Select`, or the CSS class `form-label` on a bare `<label>`.
- **Errors:** use the `error` prop on `Input`/`Select`, or the CSS class `form-error` on a bare `<p>`.
- **Textareas:** no wrapper component exists — use `<textarea className="form-input ...">` directly.
- **Icon-prefixed inputs** (e.g. ₹ symbol, search icon): render the icon as an `absolute`-positioned sibling and add `className="pl-8"` (or similar) to the `<Input>` to offset the text. Do not create a custom input.

### When a raw element is acceptable

Only reach for a raw `<input>` / `<select>` / `<button>` when:
1. The component prop set genuinely cannot express what you need (very rare).
2. You are building a new reusable component inside `src/components/ui/` itself.

In all other cases, use the component — inconsistent styling is a bug.

---

## API Layer (`src/api/`)

### `client.ts`
- Axios instance with `baseURL: /api/v1`
- Request interceptor: attaches `Authorization: Bearer <token>` from localStorage
- Response interceptor: on 401, attempts token refresh then retries; on second 401, clears auth and redirects to `/login`

### Adding a new API module
1. Create `src/api/<feature>.ts`
2. Import `client` from `./client` and response types from `../types`
3. Export a named object (e.g. `export const leavesApi = { ... }`)
4. Call it in components via `useQuery` / `useMutation` from TanStack Query

---

## Data Fetching Patterns

```tsx
// Read
const { data, isLoading } = useQuery({
  queryKey: ['resource', filterId],
  queryFn: () => resourceApi.list(filterId || undefined),
})

// Write
const mut = useMutation({
  mutationFn: (payload) => resourceApi.create(payload),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['resource'] })
    toast('Created!', 'success')
  },
  onError: () => toast('Failed', 'error'),
})
```

- `queryKey` arrays must be consistent — scoped by filters so cache is correctly invalidated
- Always call `qc.invalidateQueries` after mutations to keep UI in sync

---

## Adding a New Page

1. Create `src/pages/<feature>/<FeatureName>Page.tsx`
2. Add types to `src/types/index.ts`
3. Add API calls to `src/api/<feature>.ts`
4. Register route in `App.tsx` inside the `<PrivateRoute><AppLayout />` block
5. Add nav entry to `NAV_BY_ROLE` in `Sidebar.tsx` for the appropriate roles
6. Update this file's routing table and sidebar table

---

## Responsive Design

**All screens must work on mobile (≥ 320px), tablet (≥ 768px), and desktop (≥ 1024px). Design mobile-first.**

### Breakpoints (Tailwind standard)

| Prefix | Min-width | Typical target          |
|--------|-----------|-------------------------|
| _(none)_ | 0px     | Mobile — base styles    |
| `sm:`  | 640px     | Large phones / landscape|
| `md:`  | 768px     | Tablets                 |
| `lg:`  | 1024px    | Desktop / laptop        |
| `xl:`  | 1280px    | Wide desktop            |

Always write base styles for mobile, then override at larger breakpoints:
```tsx
// ✅ correct — mobile-first
<div className="p-3 md:p-6 text-sm md:text-base">

// ❌ wrong — desktop-first causes mobile breakage
<div className="p-6 max-md:p-3">
```

---

### Layout Shell (`AppLayout.tsx` + `Sidebar.tsx`)

The shell already handles mobile:
- **Mobile (< lg):** A top header bar is shown with a hamburger menu; sidebar slides in as a drawer overlay.
- **Desktop (≥ lg):** Sidebar is always visible on the left; no top header.

**Rule:** Never add left padding or margin to page content to "avoid the sidebar" — `AppLayout` handles the offset via its flex/grid structure. Page components only need to worry about their own inner padding.

---

### Page Layout Rules

#### Padding / max-width

```tsx
// Standard page wrapper
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
```

Never use fixed `px-8` at the top level — it overflows on narrow screens.

#### Page header (title + action button)

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
  <h1 className="text-xl font-bold" style={{ color: colors.text.heading }}>Page Title</h1>
  <button ...>Primary Action</button>
</div>
```

---

### Grids and Stat Cards

```tsx
// Analytics / stat cards — 2 cols on mobile, 4 on desktop
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

// General card grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

---

### Tables → Cards on Mobile

**Tables must never overflow on mobile.** Use one of two patterns:

#### Pattern A — Hide columns on small screens

```tsx
<div className="overflow-x-auto rounded-xl" style={styles.card}>
  <table className="w-full text-sm">
    <thead>
      <tr>
        <th>Name</th>
        <th className="hidden md:table-cell">Phone</th>   {/* hide on mobile */}
        <th className="hidden lg:table-cell">Reason</th>  {/* hide below desktop */}
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <p>John Smith</p>
          <p className="md:hidden text-xs text-muted">+91 98765 43210</p> {/* show inline on mobile */}
        </td>
        <td className="hidden md:table-cell">+91 98765 43210</td>
        ...
      </tr>
    </tbody>
  </table>
</div>
```

#### Pattern B — Full card list on mobile, table on desktop (preferred for data-heavy screens)

```tsx
{/* Mobile card list */}
<div className="flex flex-col gap-3 md:hidden">
  {items.map(item => (
    <div key={item.id} className="rounded-xl p-4" style={styles.card}>
      <div className="flex justify-between items-start">
        <p className="font-semibold">{item.name}</p>
        <StatusBadge status={item.status} />
      </div>
      <p className="text-sm mt-1" style={{ color: colors.text.muted }}>{item.phone}</p>
      <p className="text-sm" style={{ color: colors.text.muted }}>{item.reason}</p>
    </div>
  ))}
</div>

{/* Desktop table */}
<div className="hidden md:block overflow-x-auto rounded-xl" style={styles.card}>
  <table>...</table>
</div>
```

---

### Filter Tabs

Wrap filter tabs in a horizontally scrollable container — never let them wrap or overflow the page:

```tsx
<div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
  {TABS.map(tab => (
    <button key={tab.key} className="flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm"
      style={activeTab === tab.key ? styles.filterTabActive : styles.filterTabInactive}>
      {tab.label}
    </button>
  ))}
</div>
```

The `-mx-4 px-4` trick extends the scroll area to the page edges on mobile without clipping the shadow.

---

### Modals

```tsx
// Modal inner container — full screen on mobile, sized on desktop
<div className="relative w-full mx-4 sm:mx-auto sm:max-w-lg rounded-2xl p-5 md:p-6"
  style={styles.card}>
```

- On mobile: near-full-width with `mx-4` margin
- On desktop: fixed max-width centered
- Scrollable content: wrap the body in `<div className="overflow-y-auto max-h-[70vh] md:max-h-[80vh]">`
- Never use `max-w-lg` without `w-full` — it won't constrain on mobile

---

### Forms inside Modals / Pages

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <Input label="First Name" ... />
  <Input label="Last Name" ... />
  <div className="sm:col-span-2">
    <Input label="Reason" ... />
  </div>
</div>
```

---

### Touch Targets

All interactive elements must have a minimum tap target of **44 × 44px** on mobile:
- Buttons: use `min-h-[44px]` or `py-3` for primary actions
- Icon-only buttons: use `p-2.5` or `p-3` (never `p-1` alone on mobile)
- Row action buttons: pad to at least `px-3 py-2`

---

### Typography Scale

```tsx
// Page title
<h1 className="text-lg md:text-xl lg:text-2xl font-bold">

// Section heading
<h2 className="text-base md:text-lg font-semibold">

// Body
<p className="text-sm md:text-base">

// Meta / muted
<p className="text-xs md:text-sm">
```

---

### Calendar & Complex Views

Complex views (calendar, timeline, charts) should:
- Show a simplified version on mobile (e.g., list view instead of month grid)
- Or wrap in `overflow-x-auto` with a `min-w-[600px]` inner container
- Provide a view toggle: `List` as the default on mobile, `Calendar` for tablet+

```tsx
// Only show calendar on md+; show list on mobile
<div className="block md:hidden">
  <UpcomingList inquiries={upcoming} />
</div>
<div className="hidden md:block">
  <CalendarView inquiries={inquiries} onSelect={setSelected} />
</div>
```

---

### Sidebar pipeline cards / analytics chips

Horizontal scroll on mobile, grid on desktop:

```tsx
<div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 lg:grid-cols-6">
  {STAGES.map(stage => (
    <button key={stage.key} className="flex-shrink-0 w-36 md:w-auto ...">
      ...
    </button>
  ))}
</div>
```

---

### Checklist for Every New Screen

Before marking a screen done, verify:

- [ ] No horizontal scroll at 375px viewport width (iPhone SE)
- [ ] All buttons meet 44px touch target
- [ ] Tables either use Pattern A (hidden columns) or Pattern B (card list)
- [ ] Page header stacks vertically on mobile
- [ ] Modals are full-width on mobile with visible close button
- [ ] Filter tabs scroll horizontally without wrapping
- [ ] Empty states and loading spinners are centered and visible on all widths
- [ ] Text does not overflow its container (use `truncate` or `break-words` as appropriate)
