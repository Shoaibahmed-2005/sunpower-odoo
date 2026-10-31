# DESIGN.md — Kiran Visual Design System

> Extracted by Member D from `design/inspiration/01-sidebar-dashboard-wireframes.jpg`.
> **Colours come ONLY from the brand kit (§9). Shapes and structure come from the images.**

---

## Colours (from §9 brand kit — never from images)

| Token              | Hex       | Usage                                                        |
|--------------------|-----------|--------------------------------------------------------------|
| `--primary`        | `#13315C` | Primary buttons, active nav, top bar bg, links               |
| `--primary-fg`     | `#FFFFFF` | Text on primary backgrounds                                  |
| `--accent`         | `#F5A524` | Accent buttons, highlights, badges — never body text         |
| `--accent-fg`      | `#FFFFFF` | Text on accent backgrounds                                   |
| `--bg`             | `#F7F7F5` | Page background                                              |
| `--surface`        | `#FFFFFF` | Cards, modals, inputs                                        |
| `--surface-2`      | `#F0F0ED` | Table header bg, subtle alternation, secondary surfaces      |
| `--border`         | `#E4E4E0` | Card borders, input borders, table separators                |
| `--text`           | `#1B1F24` | Body text, headings                                          |
| `--muted`          | `#5F6670` | Secondary text, labels, empty states                         |
| `--success`        | `#1E8E5A` | Covered/warranty, DONE, APPROVED, paid                       |
| `--warning`        | `#D97706` | IN_PROGRESS, SENT, DUE, attention                            |
| `--danger`         | `#D93F3F` | Expired, REJECTED, CANCELLED, LOST, errors, danger buttons   |
| `--info`           | `#2F6FDE` | NEW, SCHEDULED, informational badges                         |

## Fonts

| Usage       | Family         | Weight       |
|-------------|----------------|--------------|
| Headings    | Poppins        | 600          |
| Body        | Noto Sans      | 400, 500     |
| Refs/serial | JetBrains Mono | 400          |

## Shape tokens (from inspiration image)

Source: `01-sidebar-dashboard-wireframes.jpg` — SaaS dashboard wireframe collage showing a sidebar-nav app with cards, tables, forms, charts, pricing cards, and upload areas.

### Border radius
| Token          | Value  | From image                                                   |
|----------------|--------|--------------------------------------------------------------|
| `--radius-sm`  | `6px`  | Input corners, badges, small buttons — visible in form fields and pill-shaped badges |
| `--radius-md`  | `8px`  | Buttons, dropdowns — medium-rounded button shapes            |
| `--radius-lg`  | `12px` | Cards, modals, page containers — clearly rounded card corners in the integration grid and pricing cards |

### Shadows
| Token            | Value                                   | From image                              |
|------------------|-----------------------------------------|-----------------------------------------|
| `--shadow-card`  | `0 1px 3px rgba(0,0,0,0.08)`           | Cards have very subtle lift, nearly flat — integration cards and pricing cards show minimal shadow |
| `--shadow-pop`   | `0 4px 16px rgba(0,0,0,0.12)`          | Modals and dropdowns — elevated overlays in the score mapping modal |

### Spacing
| Token     | Value  | From image                                          |
|-----------|--------|-----------------------------------------------------|
| `--sp-1`  | `4px`  | Tight inline gaps                                   |
| `--sp-2`  | `8px`  | Icon-to-text gap, badge padding                     |
| `--sp-3`  | `12px` | Input internal padding, small section gap            |
| `--sp-4`  | `16px` | Card padding, gap between form fields                |
| `--sp-5`  | `20px` | Section spacing                                      |
| `--sp-6`  | `24px` | Page padding, card body padding — visible in main content area margins |
| `--sp-8`  | `32px` | Large section gap                                    |

### Control height
| Token              | Value  | From image                                       |
|--------------------|--------|--------------------------------------------------|
| `--control-height` | `40px` | Input and button height — consistent across form fields and CTA buttons |
| `--control-height-lg` | `48px` | Technician/phone buttons (§9 UX rule: 48px)   |

---

## Component styles

### Buttons (from image: rounded medium buttons with clear hover states)
| Variant     | Background      | Text            | Border            | Radius       |
|-------------|-----------------|-----------------|-------------------|--------------|
| `primary`   | `--primary`     | `--primary-fg`  | none              | `--radius-md` |
| `secondary` | `--surface`     | `--primary`     | 1px `--border`    | `--radius-md` |
| `ghost`     | transparent     | `--primary`     | none              | `--radius-md` |
| `danger`    | `--danger`      | `#FFFFFF`       | none              | `--radius-md` |
| `accent`    | `--accent`      | `--accent-fg`   | none              | `--radius-md` |

**States:**
- **Hover:** darken bg 8% (filter brightness)
- **Disabled:** opacity 0.5, cursor not-allowed
- **Loading:** opacity 0.7, spinner icon replaces content, pointer-events none
- Padding: `8px 16px` (standard), `12px 24px` (large / phone)
- Height: `--control-height` (standard), `--control-height-lg` (phone)
- Font: Noto Sans 500, 14px (standard), 16px (large)

### Cards (from image: clean cards with subtle border + slight shadow, rounded corners)
- Background: `--surface`
- Border: `1px solid var(--border)`
- Shadow: `--shadow-card`
- Radius: `--radius-lg`
- Padding: `--sp-6` (24px)
- Header: title left (Poppins 600 16px) + actions right, separated from body by `1px solid var(--border)` bottom border and `--sp-4` padding-bottom

### Inputs (from image: bordered rectangles with rounded corners, label above)
- Height: `--control-height`
- Background: `--surface`
- Border: `1px solid var(--border)`
- Radius: `--radius-sm`
- Padding: `0 var(--sp-3)` (12px horizontal)
- Font: Noto Sans 400, 14px
- Focus: border `--primary`, ring `0 0 0 2px rgba(19,49,92,0.15)`
- Error: border `--danger`
- Label: Noto Sans 500, 13px, `--muted`, margin-bottom 6px

### Dropdowns / Selects
- Same as input styling
- Chevron icon right-aligned, `--muted` color

### Tables (from image: clean tables with header row, thin bottom borders, comfortable row height)
- Header: bg `--surface-2`, text `--muted` 12px uppercase Noto Sans 600, padding `--sp-3`
- Row: bg `--surface`, border-bottom `1px solid var(--border)`, height 48px, padding `--sp-3`
- Row hover: bg `--surface-2`
- Clickable rows: cursor pointer
- Text: 14px, right-align numbers

### Badges / Pills (from image: small rounded pills with colored backgrounds)
- Radius: `--radius-sm`
- Padding: `2px 8px`
- Font: Noto Sans 500, 12px
- Status mapping:
  - DONE / APPROVED / PAID / DELIVERED / Covered → bg `success/15%`, text `--success`
  - IN_PROGRESS / SENT / DUE / SUBMITTED → bg `warning/15%`, text `--warning`
  - NEW / SCHEDULED / ASSIGNED / DRAFT / READY → bg `info/15%`, text `--info`
  - REJECTED / CANCELLED / LOST / EXPIRED / Expired → bg `danger/15%`, text `--danger`
  - CLOSED / PICKED / CONTACTED / QUALIFIED → bg `--surface-2`, text `--muted`

### Modals (from image: centered overlay with rounded container, visible in score mapping)
- Overlay: `rgba(0,0,0,0.4)`
- Container: bg `--surface`, radius `--radius-lg`, shadow `--shadow-pop`, max-width 480px
- Header: Poppins 600 18px, padding `--sp-6`, border-bottom
- Body: padding `--sp-6`
- Footer: padding `--sp-4 --sp-6`, border-top, buttons right-aligned, gap `--sp-2`

### StatusBar (stepper — derived from image navigation patterns)
- Horizontal row of steps connected by a line
- Active step: `--primary` circle + bold text
- Completed: `--success` circle + check icon
- Future: `--border` circle + `--muted` text
- Line between steps: 2px, `--border` (completed: `--success`)

### Page layout (from image: sidebar + content with clear page header)
- Top bar: height 56px, bg `--primary`, text `--primary-fg`
- Sidebar: width 240px desktop, collapsed on mobile, bg `--surface`, border-right
- Actually per §9: top bar + role-filtered menu. Plan says top bar, not sidebar. Using top bar layout.
- Page header: title (Poppins 600 24px) left + actions right, margin-bottom `--sp-6`
- Content: max-width 1200px, padding `--sp-6`, bg `--bg`

### Icons
- Size: 20px default, 16px small (badges), 24px large (nav)
- Stroke: 1.5px (lucide default)
- Color: inherits text color

### Typography scale
| Element       | Font      | Size | Weight | Color     |
|---------------|-----------|------|--------|-----------|
| Page title    | Poppins   | 24px | 600    | `--text`  |
| Section title | Poppins   | 18px | 600    | `--text`  |
| Card title    | Poppins   | 16px | 600    | `--text`  |
| Body          | Noto Sans | 14px | 400    | `--text`  |
| Body bold     | Noto Sans | 14px | 500    | `--text`  |
| Small / label | Noto Sans | 13px | 500    | `--muted` |
| Caption       | Noto Sans | 12px | 400    | `--muted` |
| Ref / serial  | JetBrains Mono | 13px | 400 | `--text` |



---

## UI rules for new pages

1. **Always use shared templates and components:**
   - List views must use `<ListPage>` with `<DataTable>`.
   - Single-record views must use `<RecordPage>` with `<StatusBar>` and `<Card>`.
   - Dashboard views must use `<DashboardPage>` and KPI cards.
   - Mobile technician views must use `<PhonePage>` and `<PhoneLayout>`.
2. **No raw HTML primitives for core UI:**
   - No raw `<table>`, `<thead>`, `<tbody>` → use `<DataTable>`.
   - No raw `<button>` → use `<Button variant="..." size="...">`.
   - No raw inputs without `<Field label="..." error="...">`.
   - Form groups must use `<FormSection title="..." columns={1|2|3}>`.
3. **No hard-coded colors or one-off arbitrary styles:**
   - Use tokens exclusively (`text-primary`, `bg-surface`, `border-border`, `text-muted`).
   - Spacing must stick to the 4/8/12/16/24/32 scale (`sp1` through `sp8` or standard tailwind 1, 2, 3, 4, 6, 8).
4. **Primary action rule:**
   - Maximum one primary action button per page/view (`variant="primary"`). All secondary actions must be `variant="secondary"` or `variant="ghost"`.
5. **Data representations:**
   - All workflow statuses must be displayed via `<Badge status={...} />`.
   - All currencies must be formatted in Indian Rupees using `formatINR(val)` (e.g. ₹1,95,000, never `$`).
   - All dates must be formatted via `formatDate(val)` or `formatDateTime(val)`.
   - Serial numbers and reference IDs must use `font-mono` (JetBrains Mono).
6. **Robust list behavior:**
   - Every list must have search (`onSearch` or `searchPlaceholder`), an empty state (`emptyMessage`), and loading skeleton state (`loading={isLoading}`).
7. **Gated buttons:**
   - Any button blocked by a workflow gate or permission must be `disabled={true}` with an explanatory `disabledReason="Why action is blocked"`.
