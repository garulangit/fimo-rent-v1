# Design System

## 1. Design Philosophy

### Current Implementation
The application UI is an operational enterprise dashboard designed for managing transit advertising assets, schedules, compliance documents, and financial metrics.

Key characteristics of the verified current implementation:
- **Clean & Functional Data Density:** The interface prioritizes scannability with structured data tables, compact filter bars, KPI summary cards, and a visual calendar timeline.
- **Curated Forest Green Palette:** The application uses deep forest green (`#0E4A31`) as its primary brand anchor, complemented by subtle off-white/tinted backgrounds (`#f5f6f3`, `#edf4f0`) and gold/amber highlights (`#FDC421`).
- **Hybrid Typography:** High-level headers and section titles employ an editorial serif typeface (`Cormorant Garamond`), while data tables, forms, labels, and interactive components use a legible geometric sans-serif (`Inter`).
- **Component Consistency:** UI elements share unified border radii (`7px` for inputs/buttons, `12px` for cards, `16px` for modals), subtle shadow elevations, and explicit focus states.

### Intended / Future Direction *(Proposed)*
Future design iterations should reinforce modern enterprise SaaS standards:
- **Airy & Refined Spacing:** Maintain clean whitespace without sacrificing operational information density.
- **Consistent Elevation Scale:** Standardize elevation layers (flat surface, raised panel, floating toast, overlay modal) with subtle, translucent green-tinted shadows.
- **Restrained Visual Effects:** Avoid flashy, non-functional embellishments. Micro-interactions should be swift, functional, and purposeful.
- **Harmonized Typography:** Maintain high legibility across large data sets and numerical tables with consistent tabular numeral alignment.

---

## 2. Color System

### Verified Current Design Tokens (`styles.css` & `login.html`)

All colors currently in active use across the application are defined as CSS custom properties in [`public/styles.css`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/styles.css) and inline on [`public/login.html`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/login.html):

#### Primary Brand Colors
| Token | Hex Value | Verified Usage |
| :--- | :--- | :--- |
| `--color-primary` | `#0E4A31` | Primary brand green; primary buttons, active navigation indicator, key headings, chart bars, calendar tracks. |
| `--color-primary-dark` | `#0b3828` | Hover/active states for primary interactive elements; badge text contrast. |
| `--color-primary-light` | `#174f39` | Hover background for primary buttons and interactive bars. |
| `--color-primary-surface` | `#edf4f0` | Light green background tint for active nav items, table row hover, KPI icon backdrops, and accent cards. |
| `--color-primary-muted` | `#9bb7a9` | Accent border indicator on modal notes. |

#### Accent Colors
| Token | Hex Value | Verified Usage |
| :--- | :--- | :--- |
| `--color-accent` | `#FDC421` | Warm amber/gold; indicator bar for calendar items, count pills, login page accents. |
| `--color-accent-dark` | `#c99300` | High-contrast text on accent surfaces. |
| `--color-accent-surface` | `#fff6d9` | Light warm amber background for accent KPI icons and warning highlights. |

#### Text & Ink Colors
| Token | Hex Value | Verified Usage |
| :--- | :--- | :--- |
| `--color-ink` | `#1b2b25` | Primary body text, table cells, form values, and modal headings. |
| `--color-ink-secondary` | `#4a5f56` | Secondary text, table headers (`th`), input labels, and sidebar links. |
| `--color-ink-muted` | `#73877e` | Subtitles, helper text, empty state messages, timestamps, and captions. |

#### Surface & Background Colors
| Token | Hex Value | Verified Usage |
| :--- | :--- | :--- |
| `--color-surface` | `#ffffff` | Pure white background for cards, modals, table bodies, and inputs. |
| `--color-surface-raised` | `#f6f7f4` | Subtle off-white background for table headers (`th`), readonly inputs, and neutral badge chips. |
| `--color-background` | `#f5f6f3` | Main viewport body background. |
| Sidebar Background | `#fbfcfa` | Dedicated off-white background for the left navigation sidebar. |

#### Border Tokens
| Token | Hex Value | Verified Usage |
| :--- | :--- | :--- |
| `--color-border` | `#e3e8e3` | Default light border for cards, table cells, inputs, and dividers. |
| `--color-border-strong` | `#ccd7d1` | Darker border for hover states, active inputs, and table header separation. |

#### Semantic & Status Tokens
| Semantic Role | Token / Class | Text Hex | Surface Hex | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `--color-success` / `.status-berjalan` | `#166043` | `#e8f4ef` | Active branding status ("BERJALAN"), success toasts, ready statuses. |
| **Warning / In Progress** | `--color-warning-text` / `.status-proses` | `#b45309` / `#7a4800` | `#fef3c7` / `#fef3d0` | In-progress branding status ("PROSES"), upcoming deadlines. |
| **Booking / Info** | `.status-booking` / `--color-info-text` | `#1d4ed8` / `#1255a0` | `#dbeafe` / `#e0eeff` | Reserved status ("BOOKING"), informational badges. |
| **Danger / Expired** | `--color-danger` / `.status-expired` | `#c0392b` / `#94554e` | `#fdecea` / `#f8eeec` | Delete buttons, validation errors, expired branding alert buckets. |
| **Completed / Neutral** | `.status-selesai` / `.status-none` | `#73877e` | `#f6f7f4` | Completed contracts ("SELESAI"), inactive states. |

#### Login Page Tokens (`login.html` inline)
| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| `--green` | `#0E5A3C` | Primary button and branding element on login view. |
| `--green-muted` | `#8DB09A` | Illustration accent on login stage. |
| `--yellow` | `#F2B632` | Focus-visible outline rings on login controls. |
| `--charcoal` | `#23272A` | Illustration fill color. |
| `--bg` | `#EDEBE4` | Login background wallpaper. |
| `--stage` | `#F5F3EE` | Illustration backdrop stage. |
| `--card` | `#FFFFFF` | Login card background. |
| `--line` | `#E3E0D8` | Form field borders and card dividers. |
| `--text` | `#1E2420` | Login form heading and input text. |
| `--sub` | `#66706A` | Login subtitle and label helper text. |

---

## 3. Proposed Future SaaS Palette *(Proposed)*
For future design alignment across enterprise modules:

- **Primary:** `#0E4A31`
- **Accent:** `#FDC421`
- **Background:** `#F6F8F7`
- **Surface:** `#FFFFFF`
- **Text:** `#17211D`
- **Secondary:** `#66736D`
- **Border:** `#E3E8E5`
- **Success:** `#16A34A`
- **Warning:** `#F59E0B`
- **Danger:** `#DC2626`
- **Info:** `#2563EB`

---

## 3. Typography

### Verified Font Families
- **Interface Sans-Serif (`--font-sans`):** `'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif` (loaded via Google Fonts with weights 400, 500, 600, 700, 800).
- **Editorial Display Serif (`--font-display`):** `'Cormorant Garamond', Georgia, serif` (loaded via Google Fonts with weights 500, 600, 700). Used exclusively for prominent titles and panel headings.
- **Login Shell Font:** `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif` (loaded on `login.html`).
- **Code / Monospace:** Browser system monospace (`code` elements styled with font-size `12px`, background `#f6f7f4`, border `#e3e8e3`).

### Hierarchy and Type Scales

| Element / Class | Font Family | Size | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Eyebrow Label** (`.eyebrow`) | `Inter` | `10.5px` | 700 | 1.0 | `0.14em` (Uppercase) |
| **Page Heading** (`.page-header h1`) | `Cormorant Garamond` | `clamp(1.9rem, 2.5vw, 2.25rem)` | 600 | 1.08 | `-0.035em` |
| **Panel Heading** (`.panel-heading h2`) | `Cormorant Garamond` | `22px` | 600 | 1.1 | `-0.025em` |
| **Card Heading** (`h3`, `.chart-card-header h3`) | `Inter` | `13.5px`–`14px` | 700 | 1.2 | Standard |
| **Subtitle** (`.subtitle`) | `Inter` | `15px` | 400 | 1.5 | Standard |
| **Body Base** (`body`, `td`) | `Inter` | `14px` (body) / `12.5px` (td) | 400 / 500 | 1.5 | Standard |
| **Table Header** (`th`) | `Inter` | `10.5px` | 700 | 1.2 | `0.07em` (Uppercase) |
| **Form Labels** (`label`) | `Inter` | `11px` | 700 | 1.2 | `0.04em` (Uppercase) |
| **KPI Big Numbers** (`.kpi-grid strong`) | `Inter` | `26px` (main) / `20px` (rev) | 600 | 1.0 | `-0.02em` |
| **Small / Help Text** (`small`, `.nota-help`) | `Inter` | `10px`–`11.5px` | 400–500 | 1.45 | Standard |

### Document Typography (`nota-dinas.css`)
Operational letters (Nota Dinas) rendered for printing follow formal office administrative conventions:
- Standard system serif / sans-serif with high contrast black-on-white.
- Document title: `14pt` bold centered.
- Document metadata & body text: `10pt`–`11pt` with 1.4 line height.
- Signature block and official table borders: clean 1px solid borders with padded cells.

---

## 4. Layout

### Grid System & Dimensions
- **App Shell (`.app-shell`):** CSS Grid with two columns: `248px` (fixed sidebar) and `minmax(0, 1fr)` (flexible content area). Maximum wrapper width is capped at `1800px` and horizontally centered.
- **Sidebar (`.sidebar`):** Sticky viewport navigation (`height: 100vh`, `position: sticky; top: 0;`), internal vertical scrolling (`overflow-y: auto`, thin scrollbar), border right `1px solid var(--color-border)`.
- **Main Content Area (`main`):** Padded at `32px clamp(20px, 3.5vw, 42px)` for breathable desktop viewing.
- **Page Header (`.page-header`, `.panel-heading`):** Flexbox container aligning page titles and action buttons (`.button-group`). Standard operational views use a shared scroll-aware sticky header that compacts while scrolling; document/print views are excluded.

### Structural Cards & Panels
- **Data Panels (`.data-panel`):** Primary card container for tabular data with a `.panel-heading` header, horizontal filter toolbar, and horizontally scrollable `.table-wrap`. `overflow: clip` preserves rounded clipping without creating a scroll container that prevents sticky positioning.
- **KPI Grid (`.kpi-grid`):** 4-column responsive grid (`repeat(4, minmax(140px, 1fr))`) with 14px gaps.
- **Forms Grid (`.booking-form`, `.bus-edit-grid`):** 2-column grid (`repeat(2, minmax(0, 1fr))`) with 12px–14px gaps, supporting full-width spans via `.wide-field` / `.modal-wide`.

### Modals & Dialogs
- Native HTML `<dialog>` element implementation (`.bus-modal`, `.confirm-modal`).
- Fixed widths: `.bus-modal` (`min(680px, calc(100vw - 32px))`), `.confirm-modal` (`min(440px, calc(100vw - 32px))`).
- Translucent forest green backdrop: `background: rgba(14, 74, 49, 0.30)`.
- Elevation shadow: `--shadow-modal: 0 18px 54px rgba(17, 39, 31, 0.16)`.

---

## 5. Components

### 1. Buttons
- **Primary Button (`button`, `.button-link`):** Solid green (`#0E4A31`), white text, border radius `7px`, font-size `13px`, font-weight `600`, `9px 16px` padding. Hover: `#174f39` with `--shadow-sm`. Active: `translateY(1px)`.
- **Secondary Button (`.secondary`, `.button-link.secondary`):** Green text on light green surface (`var(--color-primary-surface)`), `1px solid var(--color-border)`.
- **Danger Button (`.danger`, `.action-button.danger`):** Red background (`#c0392b`) or red outline on light red surface (`#fdecea`).
- **Text Button (`.text-button`):** Muted transparent button that highlights green on hover.
- **Table Action Buttons (`.action-button`):** Compact 28px height, `5px 9px` padding, font-size `11.5px`.
- **Icon Button (`.icon-button`):** Square 32x32px centered grid with light gray background.

### 2. Form Inputs & Selects
- Inputs (`input[type="text"]`, `input[type="date"]`, `select`, `textarea`): Height `38px`–`42px`, border `1px solid var(--color-border)`, border radius `7px`, background `#ffffff`.
- Focus State: `outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(14, 74, 49, 0.09)`.
- Hover State: Border darkens to `--color-border-strong` (`#ccd7d1`).
- Readonly / Disabled: Background `#f6f7f4`, text `--color-ink-muted`, cursor not-allowed.

### 3. Tables
- Structure: Full width table with `min-width: 1040px` inside a `.table-wrap` horizontal scroll wrapper.
- Sticky Header: `th` keeps an opaque raised-surface background and sticky positioning. Since `.table-wrap` scrolls horizontally, the shared `public/sticky-layout.js` controller mirrors the active table header into a fixed overlay below the compact page header; horizontal scroll and sortable-header clicks stay synchronized with the source table.
- Sticky Offset: `--page-header-sticky-height` is updated from the active compact header, so table headings do not overlap page titles. Reduced-motion preferences shorten the header transition.
- Row Stripping & Hover: Subtle zebra striping on even rows (`rgba(27, 43, 37, 0.012)`), hover highlight on all rows (`var(--color-primary-surface)`).
- Sortable Headers (`th.sortable`): Interactive cursor pointer with sort arrows (`⇅`, `▲`, `▼`).

### Account & Access Administration
- **Segmented tabs (`.admin-account-tabs`):** The Akun & Akses view uses an accessible two-option tablist. The active tab uses the primary green token; inactive tabs use the raised surface and border tokens.
- **Access summary and permissions (`.admin-selected-account`, `.admin-permission-group`):** Account identity and role/status appear before grouped native checkboxes. Role-derived grants are checked and read-only; optional account-level grants are editable only by users with the existing `users.manage` permission.
- **Superadmin:** The permission groups display all grants as checked/read-only and explain the wildcard behavior rather than persisting redundant permissions.
- **Online status:** The account table ends with a compact presence column that shows a green dot and `Online`, a muted dot and `Offline`, or a neutral dot and `Unknown`. The text label remains visible so status is not conveyed by color alone; inactive accounts always display offline.
- **Responsive behavior:** Permission groups use two columns on wide screens and one column at the existing 850px breakpoint.

### 4. Status Badges & Chips (`.status-chip`)
- Pill container (`border-radius: 999px`) with a 5px circular dot prefix rendered via `::before`.
- Font-size: `10.5px`, font-weight: `700`, uppercase tracking `0.04em`.
- Variants: `.status-berjalan` (green), `.status-proses` (amber), `.status-booking` (blue), `.status-selesai` (gray), `.status-expired` (red).

### 5. Toast Notifications (`.app-notice`)
- Fixed position: Bottom-right (`right: 24px; bottom: 24px; z-index: 100`).
- Card layout: Max width `380px`, border radius `12px`, padding `13px 17px`, shadow `--shadow-lg`.
- Success state: Green background (`var(--color-success)`), white text.
- Error state (`.app-notice.error`): Red background (`var(--color-danger)`), white text.
- Transition: Smooth slide-and-fade (`opacity 0.2s ease, transform 0.2s ease`).

### 6. Navigation Accordion
- Group Toggles (`.nav-group-toggle`): Uppercase section titles with a rotating chevron (`▾`) transitioning from `-90deg` to `0deg`.
- Active Link Indicator: Nav links contain a left accent bar (`nav a.active::before`) in `--color-primary` scaling from `scaleY(0)` to `scaleY(1)`.

### 7. Tabs
- Container (`.dashboard-tabs`, `.branding-tabs`): Inline flexbox with light gray raised background (`#f6f7f4`), border radius `12px`, padding `5px`.
- Tab Buttons (`.dash-tab`, `.branding-tab`): Border radius `7px`, active state adopts white surface with `--shadow-sm`.

---

## 6. Data Visualization

### 1. KPI Cards
- Structure: Flexible card displaying an icon badge (32x32px), uppercase metric title (`11px`), and bold quantitative figure (`26px`).
- Revenue KPI Card: Features monetary formatting (`Rp...`), supplementary calculation subtitle, and full-width card spanning.

### 2. Monthly Revenue Charts (Chart.js)
- Engine: Chart.js v4.4.4 UMD loaded via CDN.
- Chart Style: Single-series bar chart rendering monthly revenue allocations.
- Colors: Solid forest green bars (`#0E4A31`) with rounded top corners (`borderRadius: 6, borderSkipped: false`).
- Tooltips & Grid: Clean gridlines in light gray, formatted Indonesian Rupiah currency tooltips.

### 3. Visual Timeline Calendar
- Calendar Matrix: Interactive grid showing days of the month (1 to 28/30/31).
- Background Track: SVG dash pattern representing individual day intervals (`.dashboard-calendar-track`).
- Schedule Bars (`.dashboard-calendar-bar`): Positioned absolutely across active date spans, styled with a gold left indicator border (`border-left: 3px solid var(--color-accent)`) and green background growth animation (`@keyframes calendar-bar-grow`).
- Lane Collisions: Multi-booking vehicle timelines are dynamically assigned distinct lanes (`laneIndex`) to prevent visual overlap.

---

## 7. Animation and Interaction

### Verified Existing Animations

```css
/* Modal Entrance */
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.97) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* Modal Backdrop */
@keyframes backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Calendar Timeline Bar Fill */
@keyframes calendar-bar-grow {
  to { transform: scaleX(1); }
}

/* Accordion Chevron Rotation */
@keyframes calendar-chevron-expand {
  from { transform: rotate(0deg); }
  to   { transform: rotate(90deg); }
}
@keyframes calendar-chevron-collapse {
  from { transform: rotate(90deg); }
  to   { transform: rotate(0deg); }
}

/* Button Loading Spinner */
@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
```

### Motion Design Guidelines *(Proposed)*
- **Transition Timing:** Use `120ms`–`180ms` (`--transition-fast`, `--transition-base`) for standard hover and state transitions; maximum `250ms` for drawer/modal expands.
- **Hardware Acceleration:** Restrict continuous CSS transitions strictly to `opacity` and `transform`. Avoid animating layout triggers (`width`, `height`, `margin`, `padding`).
- **Reduced Motion Compliance:** Always respect user accessibility preferences. Verified `@media (prefers-reduced-motion: reduce)` in `styles.css` reduces all animation durations to `1ms`.

---

## 8. Accessibility

### Current Verified Implementation
- **Semantic HTML5:** Proper use of landmark tags (`<aside>`, `<nav>`, `<main>`, `<header>`, `<section>`, `<article>`, `<dialog>`).
- **ARIA Attributes:** Active state toggling using `aria-expanded="true/false"`, `aria-controls`, `aria-label`, `aria-hidden="true"` on decorative icons, `aria-invalid` on erroneous inputs, and `aria-pressed` on password toggles.
- **Focus Rings:** Explicit focus visibility rules on buttons, nav links, and form fields:
  ```css
  :focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  ```
- **Reduced Motion Support:** `@media (prefers-reduced-motion: reduce)` blocks present for calendar animations, chevrons, and transitions.

### Future Accessibility Directives *(Proposed)*
- **Contrast Ratios:** Maintain minimum WCAG AA compliance (4.5:1 for standard body text, 3:1 for large display titles) across all surface/ink pairings.
- **Focus Trapping:** Ensure modal dialogs trap keyboard tab focus internally and return focus to the trigger element upon dismissal.
- **Screen Reader Announcements:** Add `aria-live="polite"` containers for dynamic toast messages and status changes.

---

## 9. Responsive Design

### Verified Breakpoints & Behaviors

| Breakpoint | Source File | Verified Layout Adaptation |
| :--- | :--- | :--- |
| **`max-width: 1200px`** | `styles.css` | Adjusts grid columns for medium desktop displays. |
| **`max-width: 1180px`** | `nota-dinas.css` | Collapses 2-column Nota Dinas workspace into a single stacked column. |
| **`max-width: 980px`** | `styles.css` | Collapses pricing layout and revenue summary grid from multi-column to single-column. |
| **`max-width: 900px`** | `login.html`, `styles.css` | Collapses login shell from 2-column split (illustration + form) to single column; rekap summary grid collapses to 2 columns. |
| **`max-width: 850px`** | `styles.css` | **Primary Mobile Breakpoint:**<br>• App shell collapses from 2 columns to 1 column.<br>• Sidebar converts to a top header with a visible mobile menu button (`#mobile-nav-toggle`).<br>• Navigation menu collapses into an expandable overlay (`.sidebar.is-nav-open nav`).<br>• KPI grid and filter toolbars collapse to 2 columns.<br>• Charts and calendar controls stack vertically. |
| **`max-width: 640px`** | `styles.css`, `nota-dinas.css` | Mobile table wrappers enforce horizontal scrolling; button groups stack. |
| **`max-width: 560px`** | `styles.css` | Single-column navigation links on mobile dropdown; PPN toggle row wraps. |

---

## 10. Brand Assets

### Verified Asset Files in Repository

```
icon/
├── favicon.ico                   (113,226 B - multi-resolution browser favicon)
├── logo-full.png                 (48,086 B - full color Trans Jogja brand logo with bus emblem)
├── logo-icon.png                 (12,546 B - square icon badge)
└── logo-white.png                (47,605 B - white monochrome logo for dark backdrops)

public/icon/
├── favicon.ico                   (113,226 B - web app favicon)
├── logo-full.png                 (48,086 B - sidebar brand mark)
├── logo-icon.png                 (12,546 B - header icon badge)
├── logo-white.png                (47,605 B - monochrome asset)
└── login-redesign-illustration.svg (5,080 B - interactive animated bus/character SVG)

public/assets/
├── surat-konfirmasi/
│   └── image1.png                (108,415 B - official Trans Jogja letterhead header)
└── surat-penawaran/
    ├── image1.png                (108,415 B - letterhead header)
    ├── image2.png ... image40.png (Route diagrams, vehicle placement schematics, fleet photos for PDF)
```

*Guideline:* Never overwrite or redraw brand assets. Always preserve original aspect ratios (`object-fit: contain`).

---

## 11. Design Reference Images

The design system incorporates visual layout mockups specified under `docs/design-reference/`:

- **`docs/design-reference/dashboard-reference.png`**
  - **Intended Influence:** Controls the main dashboard layout, real-time KPI card layout (Total Bus, Total Branding, Bus Tersedia, Occupancy, Full/Back/Side breakdown, and Estimasi Pendapatan), chart card containers, active branding data table alignment, and top header action buttons (`+ Booking`).
- **`docs/design-reference/calendar-reference.png`**
  - **Intended Influence:** Guides the visual timeline calendar grid, vehicle schedule progress bars with gold accent indicator borders (`#FDC421`), multi-lane collision avoidance logic, company group accordions, and contract expiration alert summary cards (expired, $\le$ 7 days, $\le$ 30 days).
- **`docs/design-reference/login-reference.png`**
  - **Intended Influence:** Dictates the split-screen authentication page design (left illustration stage with animated SVG bus graphic, right login form card), input field focus indicators, typography (`Plus Jakarta Sans`), password visibility eye toggle, yellow focus rings (`#F2B632`), and status/error notice banners.
- **`docs/design-reference/nota-dinas-reference.png`**
  - **Intended Influence:** Governs the operational letter (Nota Dinas ke Legal) drafting workspace, step-by-step form panel, installment payment schedule breakdown, official letterhead alignment, sanitized rich-text DOM preview, and browser print layout stylesheet ([`public/nota-dinas.css`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/nota-dinas.css)).

---

## 12. Design Principles for Future Agents

When maintaining or extending the user interface, future AI coding agents and developers must adhere to the following rules:

1. **Strictly Use Design Tokens:**
   Never hardcode arbitrary hex colors (e.g. random blues, purples, or neon greens). Always reference CSS variables (`var(--color-primary)`, `var(--color-ink)`, `var(--color-border)`, etc.).
2. **Preserve the Vanilla CSS Architecture:**
   Do not inject Tailwind CSS, Bootstrap, or heavy CSS-in-JS libraries unless explicitly instructed. Keep all rules organized in [`public/styles.css`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/styles.css) and component stylesheets.
3. **Reuse Established Component Patterns:**
   - Tables: wrap in `.data-panel` and `.table-wrap` with sticky `th`.
   - Metrics: wrap in `.kpi-grid` and `article` with `.kpi-icon`.
   - Badges: use `.status-chip` with semantic modifier classes (`.status-berjalan`, `.status-proses`, etc.).
   - Notifications: trigger `.app-notice` rather than custom popup alerts.
4. **Maintain Restrained Operational Aesthetics:**
   Avoid decorative gradients, intense blurs, or gratuitous parallax. Keep the interface focused on operational clarity, data legibility, and high performance.
5. **Enforce Responsive & Accessible Standards:**
   - Always ensure interactive elements have keyboard `:focus-visible` styles.
   - Always maintain `prefers-reduced-motion` fallbacks for any new animation.
   - Test layout integrity against the `850px` mobile navigation breakpoint.
