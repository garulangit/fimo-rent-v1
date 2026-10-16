# Project Context

## 1. Project Overview

- **Project Name:** `branding-trans-jogja` (package identifier; displayed in the application as "Dashboard Branding Trans Jogja" / "Branding Trans Jogja", and referenced in code comments as FIMO).
- **Application Purpose:** Internal operational dashboard for managing Trans Jogja bus inventory, booking and advertising (branding) contracts, occupancy monitoring, financial and revenue reporting, administrative document compliance, and operational document generation.
- **Application Type:** Internal single-page application (SPA). Access is restricted to authenticated users with active system roles.
- **Primary Operational Problems Solved:**
  - Eliminates manual scheduling errors and booking collisions across bus fleets and branding placements (Full Body, Back Body, Side Body).
  - Centralizes shared pricelist configuration and PPN (tax) calculations while preserving historical contract pricing via snapshots.
  - Monitors contract expirations and operational occupancy rates in real-time.
  - Digitizes and organizes administrative document workflows (PKS, invoices, transfer receipts, payment receipts, tax invoices, and fleet branding photos).
  - Standardizes the generation of operational correspondence: Nota Dinas to the Legal department, Surat Penawaran (quotation letters), and Surat Konfirmasi (booking confirmation letters).
- **Major Business Domain:** Public transit fleet operations (Trans Jogja), out-of-home (OOH) transit advertising / bus branding inventory management, advertising billing administration, and operational document processing.

## 2. Primary Users

The application implements role-based access control (RBAC). Roles and access scopes are defined in [`public/permissions.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/permissions.js), [`public/admin-config.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-config.js), and database security rules in [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules).

| Role Name | General Responsibility | High-Level Access Scope |
| :--- | :--- | :--- |
| `superadmin` | System administrator with unrestricted oversight. | Full wildcard access (`*`) to all features, data, configurations, and user accounts. Only role permitted to assign or manage other `superadmin` accounts. |
| `admin` | Operational and operational configuration manager. | Access to dashboard, master bus (view & edit), branding and bookings (view, create, edit, import), revenue reports, administrative documents (view, upload), letters/documents (view, create), pricelist (view & edit), master data & dropdowns (view & edit), and user accounts list (`users.view`). Can manage user roles for `admin`, `operator`, and `viewer` if granted `users.manage`. |
| `operator` | Daily operations specialist. | Operational execution: view dashboard and master bus; create, edit, view, and import branding and bookings; view revenue metrics; view and upload administrative documents and photos; create and generate letters/documents. Cannot modify master data dropdowns, shared pricelist, or user accounts. |
| `viewer` | Auditor / read-only observer. | Read-only access across dashboard, master bus, branding data, bookings, revenue reports, administrative documents, and operational letters. Cannot create, edit, delete, or upload records. |

*Note:* Accounts must have `active == true` in their `userRoles/{uid}` record to access the system. Deactivated accounts or accounts without a recognized role are redirected to an access denied screen.

## 3. Main Capabilities

The application features are categorized into six functional areas:

### Dashboard
- **Real-Time Fleet & Branding KPIs:** Real-time counters for Total Bus, Total Active Branding, Available Buses, Occupancy Rate (%), placement breakdown (Full Body, Back Body, Side Body), and estimated revenue.
- **Dynamic Filtering:** Filter dashboard KPIs by bus route/jalur, contract status, branding type, and brand name.
- **Visual Monitoring Calendar:** Interactive monthly calendar visualizing branding timelines across bus fleets, grouped by company and bus, with lane assignment to prevent visual collision.
- **Expiration Tracking:** Categorizes contracts nearing completion into distinct alert buckets (expired, $\le$ 7 days remaining, $\le$ 30 days remaining).

### Operations
- **Master Bus:** Inventory catalog of fleet vehicles, detailing plate number (`noPolisi`), fleet code (`noLamb`), route (`jalurBus`), bus model/type (`tipeBus`), color (`warnaBus`), and coachbuilder (`karoseri`). Includes CSV import, CSV export, and vehicle edit modal.
- **Data Branding & Booking Branding:**
  - Record branding agreements per vehicle with brand name, corporate entity (`namaPT`), placement type (`Full Body`, `Back Body`, `Side Body`), start date, end date, status (`BOOKING`, `PROSES`, `BERJALAN`, `SELESAI`), and notes.
  - Conflict detection engine verifying vehicle availability across date ranges and placement types before saving.
  - Automatic contract duration calculation (months).
  - Historical `pricingSnapshot` preservation.
  - CSV import and export for branding records.
- **Rekap Branding:** Centralized tabular summary of all active, in-progress, booked, and completed branding contracts with filtering and quick search.
- **Setting Harga Branding (Pricelist Branding):** Pricing matrix editor managing advertising rates per bus category (`Trans Jogja - Medium`), space (`Left Body`, `Right Body`, `Full Back Body`, `Full Body`), and duration (1, 3, 6, 12 months, or custom month tiers). Configurable PPN (tax toggle and percentage). Shared configuration stored in Firestore (`appConfig/brandingPricing`) with client fallback.
- **Pendapatan Branding (Revenue Dashboard):** Financial analytics calculating base revenue, PPN, gross total revenue, and monthly allocated revenue (spreading multi-month contracts across overlapping calendar months). Includes monthly revenue distribution bar chart powered by Chart.js.

### Monitoring
- **Kelengkapan Administrasi:** Periodic tree view (grouped by year and month) of corporate branding clients. Tracks compliance documentation per client: Perjanjian Kerja Sama (PKS, PDF max 2 MB), Invoice (PDF max 500 KB), Bukti Transfer (PDF max 500 KB), Kwitansi (PDF max 500 KB), and Faktur Pajak (PDF max 500 KB), alongside vehicle branding photographic documentation (JPG/JPEG/PNG max 500 KB).
- **History:** Archived chronological view of past, completed, and closed branding contracts.

### Documents / Letters
- **Buat Nota Dinas ke Legal:** Generates internal legal memos for contract processing. Features standardized auto-numbering (`MM.DD.NNN/AMI/U.6.10/NDN/YYYY`), selectable booking/branding sources, single or 3-stage installment payment schedules, rich-text preview with DOM sanitization, status lifecycle (`DRAFT`, `EDITED`, `FINAL`), print layout stylesheet, and PDF generation. Documents marked `FINAL` are immutably locked.
- **Kirim Surat Penawaran:** Generates commercial quotation letters for prospective clients. Selects candidate records from `BOOKING` status (or active branding), constructs tiered price proposals across media spaces and contract durations, and exports client-ready PDF documents using jsPDF and AutoTable.
- **Kirim Surat Konfirmasi:** Generates formal confirmation letters for confirmed branding reservations. Cross-references vehicle plates/fleet codes with Master Bus routes, renders financial breakdowns, outlines payment deadlines, and exports standardized PDF documents.

### Administration
- **Akun & Akses:** Two-tab `#admin-accounts` interface for viewing/editing `userRoles` records, selecting an account to inspect role-derived and optional custom permissions, and assigning roles (`superadmin`, `admin`, `operator`, `viewer`). Firebase Auth users are not listed automatically by the browser; displayed profile fields come from `userRoles`. Privileged deletion uses the separately deployed Callable Function in `functions/`.
- The account presence indicator uses `userPresence/{uid}.lastSeen`, refreshed every 30 seconds and considered online for at most 2 minutes. Firestore Rules validate the server timestamp and restrict reads to active account viewers; inactive accounts always appear offline. Firestore does not expose immediate disconnect state, so unexpected disconnects age out.
- **Master Data & Dropdown:** System dropdown manager (`#admin-master-data`) configuring available options for bus types, branding types, bus corridors/jalur, and active route codes from `trayek-master.js`.

## 4. High-Level Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    Client (Browser)                                     |
|  SPA Shell: public/index.html | Styles: public/styles.css, public/nota-dinas.css         |
|                                                                                         |
|  +------------------------+  +--------------------------+  +-------------------------+  |
|  |       Auth & Nav       |  |    Operational Logic     |  |   Document Generation   |  |
|  | - firebase.js          |  | - data-features.js       |  | - nota-dinas.js         |  |
|  | - permissions.js       |  | - admin-features.js      |  | - surat-penawaran.js    |  |
|  | - session-security.js  |  | - admin-config.js        |  | - surat-konfirmasi.js   |  |
|  | - app.js               |  | - dashboard-monitoring.js|  | - jsPDF & AutoTable     |  |
|  +------------------------+  +--------------------------+  +-------------------------+  |
+------------------------------+--------------------------+-------------------------------+
               |                             |                              |
               v                             v                              v
      [ Firebase Auth ]            [ Cloud Firestore ]            [ Supabase Storage ]
    Email/Password login,       Structured collections:         Binary uploads:
    password reset, session     buses, brandings, userRoles,    PKS, invoices, receipts,
    tokens & persistence        appConfig, brandAdmins,         tax slips, fleet photos
                                notaDinas                       (admin-files bucket)
```

- **Frontend Architecture:** Pure Single Page Application (SPA) using standard HTML5, CSS3, and modern JavaScript (ES Modules). No heavyweight framework (React, Vue, or Angular) is used. Navigation is managed via hash routing (`#dashboard`, `#master-bus`, `#branding`, etc.) in [`public/app.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/app.js).
- **Backend / Server Architecture:** Lightweight static file server implemented in [`server.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/server.js) using Node.js core modules (`http`, `fs`, `path`) listening on port 5173. Normal application logic runs in the browser directly interfacing with cloud services. A Firebase Callable Function using the Admin SDK is isolated to privileged account deletion; it verifies an active caller with `users.manage` and does not expose Admin credentials to the browser.
- **Authentication:** Firebase Authentication (Web SDK 12.19.0). Handles email/password sign-in and password resets. Enforces a 12-hour absolute maximum session duration and a 10-hour inactivity timeout via [`public/session-security.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/session-security.js).
- **Database:** Google Cloud Firestore. Houses all persistent application data, operational documents, user roles, short-lived account presence signals, and master configurations. Writes and reads are protected by database rules in [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules).
- **File Storage:** Supabase Storage. Used by [`public/admin-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-features.js) via `@supabase/supabase-js` v2 to store administrative PDF files and bus photos in the `admin-files` bucket. Metadata and public download URLs are recorded in Firestore (`brandAdmins`). *(Note: Firebase Storage rules and bucket configuration exist in the repository root, but active client upload paths utilize Supabase Storage).*
- **PDF & Document Generation:** Client-side generation using `jspdf` (v2.5.1) and `jspdf-autotable` (v3.8.2) loaded from CDN, complemented by specialized CSS print stylesheets in [`public/nota-dinas.css`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/nota-dinas.css) for Nota Dinas rendering.
- **External Dependencies:**
  - Firebase Web SDK (v12.19.0) from Google CDN (`gstatic.com`)
  - Supabase JS (v2) from `esm.sh`
  - Chart.js (v4.4.4) from jsDelivr
  - jsPDF (v2.5.1) & AutoTable (v3.8.2) from cdnjs
  - Google Fonts (Inter & Cormorant Garamond)
- **Hosting / Deployment Configuration:** Configured for Firebase Hosting with rewrite rules mapping all paths (`**`) to `/index.html` in [`firebase.json`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firebase.json). Production deployment scripts and CI/CD pipelines: Not verified in repository.

## 5. Application Data Flow

```
1. User Access & Authentication:
   User visits app -> Firebase Auth state checked ->
   If unauthenticated: Redirect to login.html -> User enters credentials -> Firebase Auth returns user credential -> Redirect to index.html

2. Session Security & Authorization:
   User credential -> session-security.js initializes inactivity (10h) & max session (12h) timers ->
   permissions.js fetches userRoles/{uid} from Firestore ->
   Role verified ('superadmin' | 'admin' | 'operator' | 'viewer') and active == true ->
   Access context cached on window.__accessContext and window.can() ->
   If inactive or role missing: Render #access-denied view

3. Routing & UI Initialization:
   window.location.hash parsed -> updateNavigation() evaluates target view permission ->
   Sidebar navigation links toggled; unauthorized views hidden ->
   Feature modules initialize concurrently (data features, admin features, config, documents)

4. Operational Data Retrieval & Mutation:
   Firestore collections ('buses', 'brandings', 'appConfig') loaded into in-memory state ->
   UI components render tables, KPIs, and monitoring calendar ->
   When creating/editing bookings:
     Client-side conflict detection checks dates & space collisions ->
     Pricing snapshot calculated from shared pricelist ->
     Firestore batch or setDoc commits record with audit fields (createdBy, createdAt, updatedBy, updatedAt)

5. Administrative Uploads & Storage:
   User uploads PDF document or bus photo in Kelengkapan Administrasi ->
   Client validates MIME type and file size limits ->
   Binary uploaded to Supabase Storage bucket ('brands/{brandId}/...') ->
   Public URL obtained ->
   Metadata document brandAdmins/{brandId} updated in Firestore

6. Operational Document Generation:
   User selects source records in Nota Dinas, Surat Penawaran, or Surat Konfirmasi ->
   Data mapped and financial calculations performed ->
   Sanitized preview displayed in DOM ->
   Draft or Final state persisted to Firestore ('notaDinas' collection) ->
   Exported to client via jsPDF / browser print dialog
```

## 6. Important Modules

| Module Name | Purpose | Relevant Files | Primary Data Source | Key Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **Shell & Lifecycle** | Bootstrap application, hash navigation, view toggling, authentication observer. | [`public/app.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/app.js), [`public/index.html`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/index.html) | Local DOM, Hash URL | [`public/firebase.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/firebase.js), [`public/permissions.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/permissions.js) |
| **Auth & Security** | User login, password reset, session timeout enforcement (10h/12h). | [`public/firebase.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/firebase.js), [`public/firebase-config.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/firebase-config.js), [`public/login.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/login.js), [`public/session-security.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/session-security.js) | Firebase Auth, `localStorage` | Firebase Auth SDK |
| **Permissions** | Role-to-permission mapping and client-side authorization helper `can()`. | [`public/permissions.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/permissions.js) | Firestore (`userRoles/{uid}`) | Firebase Firestore SDK |
| **Fleet & Branding Operations** | CRUD master bus, branding records, booking engine, conflict detection, CSV handling. | [`public/data-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/data-features.js), [`public/dashboard-monitoring.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/dashboard-monitoring.js), [`public/trayek-master.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/trayek-master.js) | Firestore (`buses`, `brandings`) | Firebase Firestore SDK |
| **Administrative Monitoring** | Document uploads (PKS, invoices, receipts, tax slips), fleet photos, period grouping. | [`public/admin-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-features.js), [`public/admin-period-grouping.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-period-grouping.js), [`public/supabase.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/supabase.js) | Supabase Storage, Firestore (`brandAdmins`) | Supabase JS SDK, Firebase Firestore SDK |
| **System Administration** | User accounts manager, master data options, shared pricelist synchronization. | [`public/admin-config.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-config.js) | Firestore (`userRoles`, `appConfig`) | Firebase Firestore SDK |
| **Account Presence** | Server-timestamped per-user heartbeat and account-manager-only presence view; stale signals expire in the UI. | [`public/presence.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/presence.js), [`public/presence-state.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/presence-state.js) | Firestore (`userPresence`) | Firebase Firestore SDK |
| **Privileged Account Deletion** | Authenticated Callable Function for account deletion and matching role-document cleanup. | [`functions/index.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/functions/index.js) | Firebase Authentication, Firestore (`userRoles`) | Firebase Admin SDK, Cloud Functions |
| **Pricelist & Revenue** | Catalog pricing calculations, PPN configuration, monthly revenue allocation, Chart.js. | Inline script in [`public/index.html`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/index.html) | Firestore (`appConfig/brandingPricing`), `localStorage` | Chart.js |
| **Nota Dinas ke Legal** | Operational memo drafting, installment scheduling, rich-text preview, PDF/print. | [`public/nota-dinas.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/nota-dinas.js), [`public/nota-dinas.css`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/nota-dinas.css) | Firestore (`notaDinas`, `buses`, `brandings`) | Firebase Firestore SDK |
| **Surat Penawaran** | Commercial quotation generator, multi-tier pricing table, PDF export. | [`public/surat-penawaran.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-penawaran.js), [`public/surat-penawaran-model.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-penawaran-model.js) | In-memory booking records & pricelist | jsPDF, AutoTable |
| **Surat Konfirmasi** | Booking confirmation letter, route/plate cross-referencing, PDF export. | [`public/surat-konfirmasi.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-konfirmasi.js), [`public/surat-konfirmasi-model.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-konfirmasi-model.js) | In-memory booking & bus records | jsPDF, AutoTable |

## 7. Navigation Structure

The actual navigation structure implemented in [`public/app.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/app.js) (`buildNavigation()`):

```
- Overview
  └── Dashboard                           (#dashboard, permission: dashboard.view)

- Operations (Group: 'operations')
  ├── Master Bus                          (#master-bus, permission: masterBus.view)
  └── Data Branding                       (#branding, permission: branding.view)

- Branding (Group: 'branding')
  ├── Booking Branding                    (#booking, permission: booking.view)
  ├── Rekap Branding                      (#rekap-branding, permission: booking.view)
  └── Pendapatan Branding                 (#pendapatan-branding, permission: revenue.view)

- Monitoring (Group: 'monitoring')
  ├── Kelengkapan Administrasi            (#administrasi-branding, permission: administration.view)
  └── History                             (#history, permission: branding.view)

- BUAT SURAT (Group: 'letters')
  ├── Kirim Surat Penawaran               (#kirim-surat-penawaran, permission: surat.view)
  ├── Kirim Surat Konfirmasi              (#kirim-surat-konfirmasi, permission: surat.view)
  └── Buat Nota Dinas ke Legal            (#buat-nota-dinas, permission: surat.view)

- ADMIN (Group: 'admin')
  ├── Akun & Akses                        (#admin-accounts, permission: users.view)
  ├── Master Data & Dropdown              (#admin-master-data, permission: masterData.view)
  └── Pricelist Branding                  (#setting-harga-branding, permission: pricelist.view)

- Non-Navigation Views:
  └── Tidak Ada Akses                     (#access-denied, displayed for unauthorized or inactive accounts)
```

## 8. Operational Context

The application mirrors the real-world operational environment of **Trans Jogja** urban bus transit system in Yogyakarta, Indonesia:

- **Fleet Entities & Operators:** Trans Jogja operates medium buses across multiple transit corridors. The system tracks fleet identifiers including license plate number (`noPolisi`), fleet number (`noLamb`), and operating consortium/operator references (e.g., PT AMI and PT JTT).
- **Corridors and Routes (`Trayek`):** Fixed public bus transit lines (e.g., `1A: Malioboro - Prambanan`, `2A: Terminal Condongcatur - XT Square via Malioboro`, etc., defined in [`public/trayek-master.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/trayek-master.js)). Bus advertising exposure is directly correlated with the assigned transit route.
- **Advertising Spaces & Conflict Constraints:**
  - Standard spaces: `Full Body`, `Back Body`, `Side Body` (combination of Left Body and Right Body), `Left Body`, and `Right Body`.
  - Mutual exclusion rule: A vehicle cannot carry multiple conflicting branding placements simultaneously during overlapping dates. For example, a `Full Body` contract prevents any other brand from booking the bus for that period.
- **Financial & Commercial Terms:**
  - Contracts are priced in Indonesian Rupiah (IDR) based on media category (`Trans Jogja - Medium`), space, and duration tiers (1, 3, 6, 12 months).
  - PPN (Value Added Tax, standard 11%) is applied according to Indonesian tax regulations.
  - Multi-month contracts have their revenue apportioned across the calendar months in which the campaign runs.
- **Administrative & Legal Compliance:**
  - Before a branding campaign goes live or completes, formal compliance documents must be secured: Perjanjian Kerja Sama (PKS), Invoice, Bukti Transfer, Kwitansi, and Faktur Pajak.
  - Photo documentation verifies the actual visual installation of the advertisement on the vehicle.
  - Operational correspondence follows standardized administrative protocol: Nota Dinas to the Legal unit for contract review, formal Surat Penawaran for quotations, and Surat Konfirmasi for client agreements.

## 9. Important Architectural Principles

Future AI coding agents, developers, and maintainers must strictly uphold the following principles:

1. **Maintain the Vanilla ES Module Architecture:**
   Do not introduce complex frontend frameworks (React, Vue, Vite, etc.) or bundle pipelines unless explicitly requested by the project owner. Maintain native browser ES module imports and standalone structure.
2. **Preserve Dual Storage Roles:**
   - **Firebase Firestore** is the single source of truth for identity, application state, and metadata.
   - **Supabase Storage** is the active repository for administrative file and photo binaries. Do not migrate metadata out of Firestore without an explicit migration plan.
3. **Preserve Pricing Snapshots (`pricingSnapshot`):**
   When a booking or branding record is saved, it captures a snapshot of the active price calculation (`basePrice`, `ppn`, `totalWithPpn`, `monthlyRevenue`, duration, version). Historical records must never recalculate retroactively when the master pricelist is modified.
4. **Preserve Audit Fields:**
   All mutations on Firestore collections must maintain audit timestamps and user identifiers (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`). The Firestore security rules for `notaDinas` explicitly require these fields on create and update.
5. **Honor Final Document Immutability:**
   Records marked as `FINAL` (such as finalized Nota Dinas documents) are locked at both the UI level and by database security rules in [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules). They cannot be overwritten or updated.
6. **Enforce Database-Level Security (Never Rely Solely on Client Guards):**
   The client `can(permission)` check controls UI visibility only. The ultimate security boundary is maintained by [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules) and [`storage.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/storage.rules). Never bypass security rules.
7. **Maintain Rigorous Conflict Detection:**
   Never disable or bypass the bus conflict checking engine in [`public/data-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/data-features.js). All booking creations, updates, and CSV imports must validate date overlaps and placement collisions.
8. **Preserve Session Security Parameters:**
   The 12-hour maximum session limit and 10-hour inactivity timeout in [`public/session-security.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/session-security.js) must be preserved.

## 10. Current Limitations / Known Issues

1. **Local Server SPA Fallback:**
   The built-in local development server in [`server.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/server.js) is a basic static file server. It does not implement SPA fallback routing (unlike Firebase Hosting which rewrites `**` to `/index.html`). Direct requests to paths without corresponding physical files return 404 or 500.
2. **Client-Side Concurrency & Race Conditions:**
   Conflict validation is performed in the client browser prior to Firestore writes. There are no atomic database transactions or Cloud Functions locking fleet dates; concurrent conflicting bookings submitted at the exact same moment across different browsers are not transactionally blocked at the database layer.
3. **Storage Configuration Discrepancy:**
   - Active client upload code in [`public/admin-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-features.js) uses Supabase Storage.
   - The repository also maintains Firebase Storage rules in [`storage.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/storage.rules), but Firebase Storage is not the primary upload path in the current client code.
   - The runtime bucket name configured in [`public/supabase-config.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/supabase-config.js) is `'Name: admin-files'`, while the setup script in [`supabase-storage-setup.sql`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/supabase-storage-setup.sql) specifies `'admin-files'`.
4. **Node.js Test Typeless Warning:**
   Running `npm test` triggers Node.js `[MODULE_TYPELESS_PACKAGE_JSON]` warnings because [`package.json`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/package.json) lacks `"type": "module"`, while several test files import ES Modules dynamically.
5. **External Cloud Deployments:**
   Live Firebase project rules, deployed Supabase bucket permissions, active Cloud Firestore indexes, and external hosting status: *Not verified in repository.*

## 11. Documentation References

- **Existing in repository:**
  - [`fimo.AGENTS.md`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/fimo.AGENTS.md) (repository root: agent development rules, technology stack, architecture, and security policies).
- **Not verified in repository (files do not exist in the repository currently):**
  - `docs/BUSINESS_RULES.md`
  - `docs/DESIGN_SYSTEM.md`
  - `docs/DATABASE.md`
  - `docs/SECURITY.md`
  - `docs/ROADMAP.md`

## 12. Verification Status

### Verified in Repository
- SPA architecture, HTML shell, CSS stylesheets, and vanilla JS ES module files in `public/`.
- Local static server implementation in `server.js` and Firebase Hosting config in `firebase.json`.
- Authentication, session security timers (10h/12h), and role-to-permission maps in `permissions.js`.
- Firestore collections and security rules (`buses`, `brandings`, `userRoles`, `appConfig`, `brandAdmins`, `notaDinas`).
- Supabase Storage client integration, allowed document types, file size limits (PKS 2 MB, others 500 KB), and upload pathways in `admin-features.js`.
- All 6 automated test suites in `tests/` (`revenue-calculation`, `trayek-master`, `permissions`, `dashboard-monitoring`, `surat-penawaran`, `surat-konfirmasi`).
- Document generation logic for Nota Dinas, Surat Penawaran, and Surat Konfirmasi.
- Master trayek route definitions in `trayek-master.js`.

### Not Verified in Repository
- Live deployment status on Firebase Hosting.
- Live deployed status and active rules in the production Firebase project (`dashboard-branding-transjogja`).
- Live Supabase project state, active bucket configuration, and deployed SQL policies on project `xtgmdkpldsrktscfuphh`.
- Real-time contents of production Firestore database.
- CI/CD pipelines, production release scripts, or automated deployment hooks.
