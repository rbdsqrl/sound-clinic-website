# Simple Hearing Frontend — CLAUDE.md

Developer context for AI assistants working on this codebase.

---

## IMPORTANT: Design System

**Before making any UI changes, read `DESIGN.md` in this directory.** It defines the canonical rules for colours, borders, tabs, badges, typography, cards, and common anti-patterns. Violations (e.g. `borderColor: border.card`, hardcoded hex colours, raw role/status strings) are bugs.

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

App runs on **http://localhost:4321**.  
Vite proxies `/api/*` → `http://localhost:8080` (backend must be running).

---

## File Structure

```
src/
├── App.tsx                          # Root: routes, providers, auth guards
├── index.css                        # Global CSS styles and Tailwind directives
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
│   ├── appointments.ts              # slots + appointments (list, book, update status)
│   ├── auth.ts                      # login, refresh, logout
│   ├── client.ts                    # Axios instance with auth interceptors
│   ├── clinics.ts                   # list, get, create, update clinic
│   ├── conditions.ts                # list conditions (lookup)
│   ├── enrollments.ts               # enrollment management
│   ├── inquiries.ts                 # inquiry management
│   ├── invitations.ts               # invite, list, accept
│   ├── leaves.ts                    # apply, list, review, cancel leave
│   ├── organisation.ts              # get, update org
│   ├── patients.ts                  # CRUD patients + conditions/parents/therapists
│   ├── programs.ts                  # program management
│   ├── public.ts                    # public API endpoints
│   ├── sharedMedia.ts               # list/upload/delete shared videos+notes for a patient
│   ├── subscriptions.ts             # subscription management
│   ├── therapySessions.ts           # therapy session management
│   └── users.ts                     # me, listTherapists, search
│
├── contexts/
│   ├── AuthContext.tsx               # useAuth: user, isAuthenticated, login, logout, switchRole
│   └── ThemeContext.tsx              # useTheme: theme ('light'|'dark'), toggleTheme
│
├── hooks/
│   ├── useCalendarBadge.ts          # Calendar badge hook
│   ├── useInquiryBadge.ts           # Inquiry badge hook
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
    ├── DashboardPage.tsx            # Role-scoped summary cards + recent data
    ├── InvitationsPage.tsx          # Invite by email+role; list sent invites
    ├── LandingPage.tsx              # Public marketing page — always light mode (force-light class)
    ├── OrganisationPage.tsx         # View/edit org profile (BUSINESS_OWNER, CLINIC_HEAD)
    │
    ├── appointments/
    │   ├── AppointmentsPage.tsx     # List appointments (role-scoped view)
    │   └── BookAppointmentPage.tsx  # Book new appointment (PARENT / BUSINESS_OWNER)
    │
    ├── auth/
    │   ├── AcceptInvitePage.tsx     # Accept invite token → set name + password
    │   ├── LoginPage.tsx            # Email + password login form
    │   └── RegisterPage.tsx         # New org registration (file exists but route removed — white-label app)
    │
    ├── availability/
    │   └── AvailabilityPage.tsx     # Manage recurring weekly slots (file exists, route removed from nav)
    │
    ├── calendar/
    │   └── CalendarPage.tsx         # Calendar view for appointments and schedules
    │
    ├── clinics/
    │   ├── ClinicDetailPage.tsx     # View/edit single clinic
    │   └── ClinicsPage.tsx          # List clinics with create modal
    │
    ├── inquiries/
    │   ├── ActionModal.tsx          # Modal for inquiry actions
    │   ├── CalendarView.tsx         # Calendar view for inquiries
    │   ├── InquiriesPage.tsx        # List and manage inquiries
    │   └── MiniCalendar.tsx         # Mini calendar component
    │
    ├── leave/
    │   ├── LeaveManagementPage.tsx  # BUSINESS_OWNER/CLINIC_HEAD: review + approve/reject leave requests
    │   └── MyLeavePage.tsx          # THERAPIST: apply + view own leave requests
    │
    ├── patients/
    │   ├── MyChildrenPage.tsx       # PARENT role: their linked children
    │   ├── PatientDetailPage.tsx    # View patient + manage conditions/parents/therapists
    │   ├── PatientsPage.tsx         # List + filter patients
    │   └── SharedMediaTab.tsx       # "Videos" tab — parent↔clinic video/note sharing
    │
    ├── programs/
    │   └── ProgramsPage.tsx         # Manage programs
    │
    └── therapists/
        └── TherapistsPage.tsx       # List therapists; filter by clinic + search
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
/calendar           → CalendarPage           │
/availability       → AvailabilityPage       │
/therapists         → TherapistsPage         │
/my-leave           → MyLeavePage            │
/leave-management   → LeaveManagementPage   │
/inquiries          → InquiriesPage          │
/programs           → ProgramsPage           ┘

*                   → redirect to /
```

> `/register` route has been removed — this is a white-labelled app; staff are added via invitations only.

---

## Sidebar Navigation by Role (`Sidebar.tsx`)

```
BUSINESS_OWNER / CLINIC_HEAD:
  Dashboard, Inquiries, Organisation, Clinics, Therapists, Patients, Programs, Calendar, Leave Requests, Add Members

THERAPIST:
  Dashboard, Clinics, Patients, Calendar, My Leave

PARENT:
  Dashboard, My Children, Progress, Calendar

PATIENT:
  Dashboard
```

Dark/Light mode toggle lives at the **bottom** of the sidebar as a full-width nav-style row (above the user footer card).

---

## Types (`src/types/index.ts`)

Key types and enums (see file for full list):
- `Role`: User roles (BUSINESS_OWNER, CLINIC_HEAD, THERAPIST, etc.)
- `PatientResponse`: Patient with conditions, parents, therapists
- `InquiryStatus`: Lead status enum
- `AppointmentStatus`: Booking states
- `ApiResponse<T>`: Backend response wrapper
- `allRoles(user)`, `hasRole(user, role)`: Role utilities

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

## Project Workflow

### Authentication & Session Flow

1. **User Navigates to `/login`**
   - `LoginPage.tsx` renders login form
   - User enters email + password

2. **Login Request**
   - `authApi.login({ email, password })` calls `/auth/login`
   - Backend returns `{ accessToken, refreshToken, user }`
   - Tokens stored in localStorage via `tokenStorage` (in `client.ts`)
   - User object stored in AuthContext + localStorage

3. **Automatic Auth Restoration**
   - On app load, `AuthProvider` checks for stored `accessToken`
   - If token exists and user data is missing, calls `authApi.me()` to restore user
   - User is loaded and AuthContext is populated
   - `isLoading` flag prevents routes from rendering until auth check completes

4. **Protected Routes**
   - All routes inside `<PrivateRoute>` require `isAuthenticated = true`
   - If token expires (401), axios interceptor automatically:
     - Calls refresh token endpoint
     - Retries the original request with new token
     - If refresh fails, clears auth and redirects to `/login`

5. **Role-Based Access**
   - Each route is accessible based on user's `role` + `additionalRoles`
   - `useAuth()` hook provides `activeRole` for role-based UI
   - Use `switchRole(role)` to switch between multiple roles
   - Sidebar navigation is scoped by role via `NAV_BY_ROLE` mapping

6. **Logout**
   - `authApi.logout(refreshToken)` invalidates refresh token on server
   - Clear AuthContext, localStorage, and redirect to `/login`

### Data Flow Pattern

```
User Action (e.g., click "Create Patient")
      ↓
Component calls useMutation(mutationFn: () => patientsApi.create(data))
      ↓
API call sent with Authorization header (Bearer token from localStorage)
      ↓
Backend processes request, returns data or error
      ↓
On Success:
  - Component receives response data
  - Invalidate affected query keys via qc.invalidateQueries
  - Show success toast
  - UI automatically re-fetches and re-renders via TanStack Query
  - User sees updated list/table
      ↓
On Error (if 401):
  - Axios interceptor attempts token refresh
  - If successful, retries original request
  - If refresh fails, clears session and redirects to /login
  - Component shows error toast
```

### Role-Scoped Visibility

- **Backend enforces authorization** — API returns only data the user has permission to see
- **Frontend optimizes UX** — Sidebar and page features only render if `hasRole(user, requiredRole)`
- **Pages are never hidden** — If a user somehow navigates to a protected page without the role, they'll see a filtered/limited view or empty state, not a 403 error

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
