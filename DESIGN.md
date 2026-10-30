# DESIGN.md — WAEC MOS Command Console

> Read this file before every UI task. If a request conflicts with this file, follow this file and say so.
> Stack: Next.js 16 (App Router), React 19, Tailwind v4 (CSS-first, no tailwind.config), shadcn `base-nova` + `@base-ui/react`, lucide-react, Leaflet, Recharts, Drizzle + Neon.

## 1. Product feel

A calm, dense, trustworthy operations console for people who must spot a distress signal in under 3 seconds.
Reference density: Linear, Vercel dashboard, Stripe. Not a sci-fi terminal.

Three principles:
1. **Quiet by default, loud only for danger.** Most of the screen is neutral. Red appears only for SOS and critical incidents.
2. **Scan, don't read.** Name, status, battery, time. Max 2 lines per roster row.
3. **Every state is designed.** Loading, empty, error, and "all clear" are first-class screens.

Identity: WAEC deep navy + slate + a restrained yellow. Yellow is a brand accent, not a status colour.

## 2. Hard rules (never break)

- Use only `components/ui/*` (shadcn). Need a new primitive? Add it via shadcn, never hand-roll a styled `div` button, card, badge, input, tabs or dialog.
- No inline hex/rgb/oklch values in components. Use semantic tokens (`bg-card`, `text-muted-foreground`, `text-status-sos`).
- No arbitrary Tailwind values (`w-[437px]`, `text-[11px]`, `tracking-[0.2em]`) except map and chart sizing.
- No gradients, glows, glassmorphism, neon borders, or animated backgrounds.
- No uppercase + letter-spaced labels except the sidebar section label and table headers (`text-xs uppercase tracking-wide`).
- No all-monospace UI. Mono is for data only (section 4).
- No bracketed text tags like `[ON-SITE 07:54 GMT]`. Use `StatusBadge`.
- No emoji in the UI. Icons are lucide, 16px (`size-4`) default, 20px max.
- One border radius family: `--radius` (0.625rem). Cards `rounded-lg`, controls `rounded-md`, pills `rounded-full`.
- Spacing on a 4px grid only (`p-2/3/4/6`, `gap-2/3/4/6`).

## 3. Colour tokens

**Fix first:** `app/globals.css` currently declares `--foreground`, `--card`, `--primary` etc. twice inside `:root`, so the light values override the dark ones. Replace `:root`, `.dark` and the `prefers-color-scheme` block with ONE token set. This console is dark-only: set `<html class="dark">` in `app/layout.tsx` and delete the light and media-query blocks.

Neutral scale (navy-tinted, hue 265):

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.16 0.02 265)` | App canvas |
| `--card` | `oklch(0.20 0.02 265)` | Panels, roster, stats |
| `--popover` | `oklch(0.22 0.02 265)` | Menus, tooltips, dialogs |
| `--muted` | `oklch(0.25 0.02 265)` | Hover fills, skeletons |
| `--border` | `oklch(1 0 0 / 9%)` | All dividers and outlines |
| `--foreground` | `oklch(0.96 0.01 265)` | Primary text |
| `--muted-foreground` | `oklch(0.70 0.02 265)` | Secondary text (AA on card) |
| `--primary` | `oklch(0.62 0.17 265)` | Selected nav, primary button, focus ring |
| `--brand` | `oklch(0.84 0.16 90)` | WAEC yellow: logo mark and one header accent only |

Status tokens (add to `@theme inline`, expose as `bg-status-*`, `text-status-*`):

| Token | Value | Meaning |
|---|---|---|
| `--status-sos` | `oklch(0.64 0.23 25)` | Active SOS, critical incident. Nothing else is ever red |
| `--status-ok` | `oklch(0.74 0.16 155)` | Verified on-site |
| `--status-warn` | `oklch(0.80 0.15 80)` | En route, pending, overdue |
| `--status-idle` | `oklch(0.65 0.02 265)` | Offline, off duty, not started |

Rules:
- Each status has a 3-step recipe: text `status-*`, background `status-* / 12%`, border `status-* / 30%`.
- Colour is never the only signal. Every status pairs colour with an icon or label text.
- Primary blue is for interaction (selected, focus, links). Never use it for status.
- Chart palette: `--chart-1..5` map to ok, warn, primary, sos, idle.

## 3.1 Map marker colours
Same status tokens: ok (inside geofence), warn (outside geofence), sos (distress, pulsing ring), idle (offline). Geofence circle: 1px `primary` stroke, 8% fill, no dashes.

## 4. Typography

Load with `next/font` in `app/layout.tsx` (currently no fonts are loaded):
- **Inter** → `--font-sans`, all UI text
- **JetBrains Mono** → `--font-mono`, data only

Mono is allowed ONLY on: battery %, timestamps, coordinates, distance in metres, staff IDs, incident numbers (`INC-2026-0042`), numeric stat values. Add `tabular-nums` to all numeric displays so columns do not jitter on live updates.

| Role | Class |
|---|---|
| Page title | `text-xl font-semibold` |
| Panel title | `text-sm font-semibold` |
| Body / row primary | `text-sm font-medium` |
| Secondary / meta | `text-xs text-muted-foreground` |
| Stat value | `text-2xl font-semibold tabular-nums font-mono` |
| Section label | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |

Never go below `text-xs` (12px). Max two font weights per screen (500, 600).

## 5. Layout

Desktop console (≥1280px) is a 3-zone grid, full viewport height, no page scroll:

```
┌────────────────────────────── Header 56px ──────────────────────────────┐
│ Sidebar 232px │ Map (flex-1)                          │ Roster 360px   │
│ (collapsible  │  ┌ Toolbar (top-left, one row) ┐       │ search         │
│  to 64px)     │  │ Region chips │ Stats strip  │       │ tabs           │
│               │  └──────────────────────────────┘       │ scroll list    │
│               │  Legend (bottom-left, collapsible)      │                │
└────────────────────────────────────────────────────────────────────────┘
```

- Map overlays live in ONE flex-column container with `gap-2`. Never absolutely position two overlays at the same offset (current bug: filter chips overlap the stats bar).
- Below 1024px: roster becomes a bottom `Sheet`, sidebar becomes an icon rail.
- Map controls: top-right, vertical stack, 36px buttons.
- Legend: bottom-left, hidden below `lg`, never overlapping map controls.

## 6. Component specs

### Header (56px)
Left: logo mark (yellow) + "MOS Command" (`text-sm font-semibold`) + muted region name "Ashanti Regional Hub". Centre: only when active, a single SOS alert pill. Right: gateway status (dot + "Online"), user menu (avatar + name + role in a dropdown, with Sign out inside it).
Remove: version badge from the header (move to the footer or settings), the separate "Sign Out" button.

### Sidebar
Items: icon + label `text-sm`, 36px height, selected = `bg-primary/15 text-primary`, hover = `bg-muted`. The Incident Logs unread dot becomes a count `Badge` in `status-sos`. Footer card "Shift operations": 3 lines max.

### Stats strip
Four equal columns (`grid grid-cols-4`), each: label `text-xs muted`, value `text-2xl mono`. Deployed, On-site, En route, SOS. Only the SOS value turns red, and only when `> 0`. The on-site percentage is a small muted suffix, not a second large number.

### Region / center filter chips
shadcn `ToggleGroup` or `Tabs`, `h-8`, count in muted text. Horizontal scroll if overflowing, never wrap.

### Roster panel
Search `Input` with icon, then `Tabs`: All / On-site / Pending / SOS with counts. Groups are collapsible with `Collapsible`; group header shows name, "3/5 on-site" and an SOS badge if any member is in distress. SOS groups sort to the top.

### Roster row (`OfficerRow`)
```
[Avatar 32]  Kofi Mensah  ★                  84% 🔋  [call] [locate]
             Prempeh College · ● On-site · 07:54
```
- Line 1: name `text-sm font-medium`, leader shown as a small `Star` icon with tooltip, not text.
- Line 2: centre name, then `StatusBadge`. All `text-xs`.
- Battery: mono, `text-muted-foreground`; below 20% turns `status-warn`, below 10% `status-sos`.
- Actions: `Button variant="ghost" size="icon"` 32px with `aria-label` and Tooltip.
- SOS row: `bg-status-sos/10`, 2px left border `status-sos`, pulse on the badge only (respect `prefers-reduced-motion`). SOS rows are the ONLY rows with a tinted background.
- Row height consistent at 64px. No per-row borders; use a single `divide-y`.

### StatusBadge (build once in `components/shared/status-badge.tsx`)
Props: `status: 'ON_SITE' | 'EN_ROUTE' | 'PENDING' | 'SOS' | 'OFFLINE'`, optional `detail` (time or distance).
Renders: `Badge variant="outline"`, `h-5`, dot or icon + label, detail in mono. Example: `● On-site · 07:54`, `● 450 m away`, `▲ SOS`.
All status UI in the app uses this component.

### Buttons
`default` = primary (one per view). `secondary` for neutral. `ghost` for icon and row actions. `destructive` only for irreversible actions (revoke, suspend) and always behind a confirm `Dialog`.

### Tables (users, incidents, audit logs)
shadcn `Table`, 44px rows, sticky header, sortable columns, mono for IDs and timestamps, row hover `bg-muted/50`. Paginate at 25. Provide a filter bar above, never inside the header row.

### Forms and dialogs
Label above input, helper text `text-xs muted`, error text `status-sos` with an icon. Primary action bottom-right. Escape closes. Focus trapped.

## 7. States (required for every list, map, stat, chart)

| State | Pattern |
|---|---|
| Loading | `Skeleton` matching final layout (roster: 6 rows; stats: 4 blocks; map: dark surface + centred spinner) |
| Empty | Icon, one-line title, one-line hint, optional action. e.g. "No active SOS · All officers are reporting normally" |
| Error | Inline `Alert` with the failed resource, a Retry button, and the HTTP/error code in mono |
| Stale | If telemetry is older than 60s show "Last updated 2 min ago" in `status-warn`; older than 5 min mark the officer Offline |
| Offline/gateway down | Header status turns `status-warn`, with a banner "Live updates paused. Showing last known positions" |

## 8. Data rules (no mock data)

- UI components receive data via props or hooks. No arrays of fake people, centres or incidents inside any `.tsx` file.
- Seed data lives ONLY in `scripts/seed.ts` (Drizzle), runs manually, and is never imported by app code.
- Data access goes through `lib/db/queries/*.ts` using Drizzle. The in-memory `MosV1Store` class in `lib/db/index.ts` is to be deleted once routes are migrated.
- Types come from Drizzle (`typeof table.$inferSelect`), not hand-written duplicates.
- Never hardcode a fallback identity (e.g. `session?.name || 'Kofi Mensah'`). If there is no session, redirect to login.
- Realtime: start with polling every 10s via a single `useFleet()` hook (SWR or TanStack Query). Upgrade to SSE or websockets later without touching components.

## 9. Map (Leaflet)

- Keep Leaflet. Tiles must work with no API key. Use CARTO dark raster `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` with attribution, and check CARTO's terms before production traffic. Remove any keyed provider.
- Markers: 12px dots using status tokens, white 2px ring. SOS marker 16px with a CSS pulse ring. Cluster markers when zoomed out.
- Clicking a roster row flies the map to the officer and opens a `Popover` card (name, centre, status, battery, call/navigate actions). Clicking a marker scrolls the roster to the row.
- Default view: fit bounds to all active officers; if none, the region centre.
- The map must never show provider watermark text.

## 10. Accessibility and motion

- WCAG 2.1 AA contrast (PRD requirement). Muted text on card must be ≥ 4.5:1.
- All icon buttons have `aria-label`. All interactive elements show a 2px `ring` focus outline.
- Keyboard: `/` focuses search, `Esc` closes sheets, arrow keys move through roster rows.
- Motion: 150ms ease-out for hover and expand. The only looping animation is the SOS pulse. Wrap in `motion-safe:`.
- SOS alerts also use `role="alert"` so screen readers announce them.

## 11. File and code conventions

- Split the 2,100-line `app/admin/page.tsx`. Target structure:
  ```
  components/admin/
    header/CommandHeader.tsx
    sidebar/AdminSidebar.tsx
    fleet/FleetMap.tsx
    fleet/StatsStrip.tsx
    fleet/RegionFilters.tsx
    roster/RosterPanel.tsx
    roster/OfficerRow.tsx
    roster/GroupSection.tsx
    shared/StatusBadge.tsx
    shared/EmptyState.tsx
    shared/ErrorState.tsx
  ```
- One component per file, under ~150 lines. Page files only compose.
- Server Components by default; add `'use client'` only for interactivity and map.
- Next.js 16 has breaking changes. Read `node_modules/next/dist/docs/` before using any Next API (per `AGENTS.md`).

## 12. Definition of done (per task)

1. Uses only tokens, shadcn components, and `StatusBadge`.
2. Loading, empty, and error states exist and were seen.
3. No hardcoded data, no new `font-mono` outside the allowed list.
4. Works at 1280px and 390px widths.
5. Screenshot attached to the task for review.
