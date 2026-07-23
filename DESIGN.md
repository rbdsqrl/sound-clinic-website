# Design Language — Sound Clinic Web App

All design decisions in one place. Read this before touching any component or page.

---

## 1. Design Tokens (`src/theme.ts`)

Never hardcode a colour, shadow, or radius. Always use the token:

```ts
import { colors, border, surface, shadow, radius, gradient,
         styles, palette, paletteStyle,
         accentAlpha, ctaAlpha, dangerAlpha, successAlpha,
         warningAlpha, borderAlpha } from '../../theme'
```

### Colour hierarchy

| Token | Use |
|-------|-----|
| `colors.text.heading` | Page/section titles |
| `colors.text.primary` | Body text, data values |
| `colors.text.muted` | Labels, secondary info |
| `colors.text.dim` | Placeholders, meta info |
| `colors.accent` | Teal — links, active states, accent icons |
| `colors.cta` | Coral — primary action buttons |
| `colors.status.success/warning/danger/info` | Semantic states |

### Role colours (`colors.role`)

```ts
colors.role = {
  BUSINESS_OWNER: '#E0A840',  // amber
  OFFICE_ADMIN:   '#2B80C8',  // blue
  THERAPIST:      '#9864DC',  // purple
  DOCTOR:         '#2B80C8',  // blue
  PARENT:         '#DC64A0',  // pink
  ADMIN:          '#D96060',  // coral-red
  PATIENT:        '#6B8499',  // slate
}
```

---

## 2. Border Rules (CRITICAL)

`--border-card` and `--border-medium` are **full CSS shorthands** (`1px solid rgba(...)`).  
`--border-divider`, `--border-sidebar` are **colour values only** (`rgba(...)`).

| Property | Correct token | Wrong |
|----------|--------------|-------|
| `border:` | `border.card` or `border.medium` | – |
| `borderTop/Bottom/Left/Right:` | `border.card` or `border.medium` | – |
| `borderColor:` | `border.divider` | ~~`border.card`~~ |
| `style={{ borderColor: border.card }}` | **NEVER** — card is a shorthand, not a colour | – |

### Row / list dividers

Use `.divide-subtle` utility class on the parent container — it bakes `var(--border-divider)` directly into child borders, avoiding the CSS inheritance bug with `divide-y`:

```tsx
<div className="divide-subtle">
  {items.map(item => <Row key={item.id} {...item} />)}
</div>
```

For table rows, use:
```tsx
<tr className="border-b" style={{ borderColor: border.divider }}>
```

---

## 3. Tab Patterns

### Primary navigation tabs (underline style)

Use for top-level page navigation (Members, Patients, Organisation sections, etc.).

```tsx
<div className="flex gap-0 border-b overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0"
  style={{ borderColor: border.divider }}>
  {TABS.map(t => (
    <button
      key={t.key}
      onClick={() => setTab(t.key)}
      className="flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium -mb-px transition-colors"
      style={tab === t.key ? styles.tabActive : styles.tabInactive}
    >
      {t.label}
    </button>
  ))}
</div>
```

**Why `-mb-px`?** The active button has a 2px bottom border. `-mb-px` shifts it down 1px so it overlaps the container's 1px bottom border, creating a clean underline without a gap.

### Filter chips (ghost outline style)

Use for sub-filtering within a section (status filters, clinic filters, type filters).

```tsx
<div className="flex gap-1.5 overflow-x-auto pb-1 flex-wrap">
  {FILTERS.map(f => (
    <button
      key={f.value}
      onClick={() => setFilter(f.value)}
      className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
      style={filter === f.value ? styles.filterTabActive : styles.filterTabInactive}
    >
      {f.label}
    </button>
  ))}
</div>
```

Both active AND inactive chips have a visible border. Active: accent tint background + accent colour + accent border. Inactive: transparent background + muted text + subtle border.

---

## 4. Role and Status Badges

Always use the helpers from `Badge.tsx`. Never render raw role/status strings with ad-hoc styles.

```tsx
import { roleBadge, statusBadge, roleLabel } from '../../components/ui/Badge'

// Role pill — uses colors.role[role] as the tint
{roleBadge(member.role)}

// Status pill — semantic colour (green=accepted, yellow=pending, red=expired)
{statusBadge(invite.status)}

// Just the label text (for non-badge use)
{roleLabel(member.role)}  // → 'Business Owner', 'Office Admin', etc.
```

Role labels are always **title-case** (Business Owner, Office Admin, Therapist…).  
Status labels are always **title-case** (Accepted, Pending, Expired…).  
**Never** render `member.role` or `invite.status` directly as visible text.

---

## 5. Card

```tsx
// All cards use the same token
<div className="rounded-2xl p-4" style={styles.card}>

// styles.card expands to:
{
  background:     surface.card,
  border:         border.card,
  borderRadius:   radius.lg,     // 16px
  backdropFilter: 'var(--card-backdrop)',
  boxShadow:      shadow.card,
}
```

Never use `rounded-xl` for a card — it's `rounded-2xl` (matches `radius.lg = 16px`).

---

## 6. Avatar / Initials Circle

```tsx
<div
  className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
  style={styles.avatar}
>
  {initials}
</div>
```

`styles.avatar` = `{ background: accentAlpha(0.12), color: colors.accent }`.

Sizes:
- Small (list rows): `h-8 w-8 rounded-lg text-xs`
- Medium (cards): `h-9 w-9 rounded-xl text-sm`
- Large (detail header): `h-12 w-12 rounded-xl text-base`

---

## 7. Buttons

Always use the `<Button>` component. Never write raw `<button>` for primary/secondary/danger actions.

| Variant | Use |
|---------|-----|
| `<Button>` (default) | Primary CTA — coral gradient |
| `<Button variant="secondary">` | Secondary action — accent tint |
| `<Button variant="ghost">` | Subtle / tertiary |
| `<Button variant="danger">` | Destructive — red tint |

Raw `<button>` is only acceptable for:
- Inline text links (e.g. "Cancel" as a text-only action)
- Icon-only controls embedded inside other components (view toggle, close X)
- Filter chips and tab buttons (which have their own style via `styles.*Tab*`)

---

## 8. Typography

```tsx
// Page title
<h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>

// Section / card heading
<h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>

// Sub-heading / label
<p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>

// Body
<p className="text-sm" style={{ color: colors.text.primary }}>

// Meta / muted
<p className="text-xs" style={{ color: colors.text.muted }}>

// Micro / dim
<p className="text-[11px]" style={{ color: colors.text.dim }}>
```

---

## 9. Page Layout

```tsx
// Standard wrapper — always use this, never hardcode px-8
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">

// Page header
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Title</h1>
    <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>Subtitle</p>
  </div>
  <Button>Primary Action</Button>
</div>
```

---

## 10. Tables

Desktop table inside a card:

```tsx
<div className="overflow-x-auto rounded-2xl" style={styles.card}>
  <table className="w-full text-sm">
    <thead>
      <tr style={{ borderBottom: border.card }}>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
          style={{ color: colors.text.muted }}>Column</th>
      </tr>
    </thead>
    <tbody>
      {items.map(item => (
        <tr key={item.id} className="border-b" style={{ borderColor: border.divider }}>
          <td className="px-4 py-3" style={{ color: colors.text.primary }}>{item.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Table divider rule**: thead uses `borderBottom: border.card` (full shorthand on the element).  
Data rows use `className="border-b" style={{ borderColor: border.divider }}` (colour only).

---

## 11. Empty States

```tsx
import { EmptyState } from '../../components/ui/EmptyState'

<EmptyState
  icon={<Users size={32} />}
  title="No members found"
  description="Invite someone to get started."
  action={{ label: 'Invite Member', onClick: () => setShowModal(true) }}
/>
```

---

## 12. Common Anti-Patterns (Don't Do These)

| ❌ Wrong | ✅ Right |
|---------|---------|
| `style={{ borderColor: border.card }}` | `style={{ borderColor: border.divider }}` |
| `className="divide-y" style={{ borderColor: border.divider }}` | `className="divide-subtle"` |
| `<span style={{ color: '#9864DC' }}>Therapist</span>` | `{roleBadge('THERAPIST')}` |
| `{inv.status}` as visible text | `{statusBadge(inv.status)}` |
| `{member.role.replace(/_/g, ' ')}` | `{roleLabel(member.role)}` |
| `<button style={{ background: accentAlpha(0.1), ... }}>` (for primary action) | `<Button>` |
| Hardcoded `px-8` at page root | `p-4 md:p-6 lg:p-8` |
| `rounded-xl` on a card | `rounded-2xl` with `styles.card` |
| `className="filled pill"` (solid background + white text) for tabs | `styles.tabActive` / `styles.tabInactive` |
