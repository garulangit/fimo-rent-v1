# Roadmap

Dated project investigation and change notes are recorded in [CHANGELOG.md](CHANGELOG.md).

## 1. Current Status

The application (**Branding Trans Jogja / FIMO**) is an active internal single-page operational dashboard running on vanilla JavaScript (ES Modules), HTML5, and CSS3, backed by Google Cloud Firestore for database state and Supabase Storage for administrative binary file uploads.

The core operational modules (Fleet inventory, Data Branding, Booking engine, Pricelist configuration, Revenue reporting, Administrative compliance tracking, and Document/Letter generation) are functional in the client codebase and backed by automated Node.js unit tests.

Status indicators used across this roadmap:
- `[COMPLETED]`: Fully implemented and verified in the repository.
- `[IN PROGRESS]`: Partial implementation evidence found in the repository.
- `[PLANNED]`: Explicitly represented in documentation, configuration, or codebase comments.
- `[BLOCKED]`: Dependent on external configuration or unverified external states.
- `[NOT VERIFIED]`: Cannot be confirmed from the local repository codebase.

---

## 2. Completed

The following features and systems are fully implemented in the codebase and verified through source inspection and automated tests:

| Feature / System | Relevant Source / Module | Verification Status |
| :--- | :--- | :--- |
| **Authentication & Session Lifecycle** | [`public/firebase.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/firebase.js), [`public/login.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/login.js), [`public/session-security.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/session-security.js) | `[COMPLETED]` Verified via source inspection and login flow logic (12h max session, 10h inactivity). |
| **Role-Based Access Control (RBAC)** | [`public/permissions.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/permissions.js), [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules), [`tests/permissions.test.cjs`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/tests/permissions.test.cjs) | `[COMPLETED]` Verified via test suite (`permissions.test.cjs`) for `superadmin`, `admin`, `operator`, `viewer`. |
| **Master Bus Management** | [`public/data-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/data-features.js), [`public/trayek-master.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/trayek-master.js), [`tests/trayek-master.test.cjs`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/tests/trayek-master.test.cjs) | `[COMPLETED]` Verified via test suite and CRUD/modal logic. |
| **Booking Engine & Conflict Detection** | [`public/data-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/data-features.js) (`getDisabledTypes()`, `getBusConflict()`) | `[COMPLETED]` Verified via source inspection (Full Body, Back Body, Side Body conflict matrix). |
| **Shared Pricelist & PPN Tax Engine** | Inline script in [`public/index.html`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/index.html), [`tests/revenue-calculation.test.cjs`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/tests/revenue-calculation.test.cjs) | `[COMPLETED]` Verified via automated unit tests (`revenue-calculation.test.cjs`). |
| **Revenue Dashboard & Charting** | Inline script in [`public/index.html`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/index.html), [`public/dashboard-monitoring.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/dashboard-monitoring.js) | `[COMPLETED]` Verified via unit test suite and Chart.js integration. |
| **Occupancy KPI & Visual Calendar Timeline** | [`public/dashboard-monitoring.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/dashboard-monitoring.js), [`tests/dashboard-monitoring.test.cjs`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/tests/dashboard-monitoring.test.cjs) | `[COMPLETED]` Verified via calendar lane allocation and expiration bucket tests. |
| **Administrative Document Uploads & Photos** | [`public/admin-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-features.js), [`public/admin-period-grouping.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-period-grouping.js), [`public/supabase.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/supabase.js) | `[COMPLETED]` Verified via upload limits (PKS 2 MB, others 500 KB) and Supabase client integration. |
| **Operational Nota Dinas Generation** | [`public/nota-dinas.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/nota-dinas.js), [`public/nota-dinas.css`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/nota-dinas.css), [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules) | `[COMPLETED]` Verified via draft/final lifecycle, auto-numbering, and immutable final locking in security rules. |
| **Surat Penawaran (Quotation Letters)** | [`public/surat-penawaran.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-penawaran.js), [`public/surat-penawaran-model.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-penawaran-model.js), [`tests/surat-penawaran.test.cjs`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/tests/surat-penawaran.test.cjs) | `[COMPLETED]` Verified via unit test suite and jsPDF / AutoTable generation. |
| **Surat Konfirmasi (Confirmation Letters)** | [`public/surat-konfirmasi.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-konfirmasi.js), [`public/surat-konfirmasi-model.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/surat-konfirmasi-model.js), [`tests/surat-konfirmasi.test.cjs`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/tests/surat-konfirmasi.test.cjs) | `[COMPLETED]` Verified via unit test suite, vehicle route matching, and PDF generation. |
| **User Account & Master Data Management** | [`public/admin-config.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-config.js), [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules) | `[COMPLETED]` Verified via user role administration and master dropdown persistence in `appConfig/masterData`. |

---

## 3. In Progress

Items with partial implementation or configuration alignment evidence in the codebase:

- **Supabase Storage Bucket Configuration Alignment** `[IN PROGRESS]`
  - *Evidence:* [`public/supabase-config.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/supabase-config.js) uses `bucketName: 'Name: admin-files'` while [`supabase-storage-setup.sql`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/supabase-storage-setup.sql) defines `bucket_id = 'admin-files'`.
  - *Status:* Client upload logic is functional, but bucket name strings between code and SQL setup script require synchronization and production verification.
- **Node.js Test Typeless Module Warning Elimination** `[IN PROGRESS]`
  - *Evidence:* Running `npm test` executes tests successfully but emits `[MODULE_TYPELESS_PACKAGE_JSON]` warnings because [`package.json`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/package.json) lacks `"type": "module"`.
  - *Status:* Tests pass with exit code 0; clean warning suppression or ESM declarations remain in progress.
- **Account Presence Runtime Verification** `[IN PROGRESS]`
  - *Evidence:* Client heartbeat, server-timestamp validation, account-manager-only Firestore reads, and expiry-based UI states are implemented in `public/presence.js`, `public/presence-state.js`, and `firestore.rules`.
  - *Status:* Automated state tests cover fresh, stale, inactive, unavailable, and invalid timestamps. Firestore Rules were reported successfully released to `dashboard-branding-transjogja` by the Firebase CLI on 2026-10-09; this does not verify heartbeat writes or presence behavior in an authenticated production session. The cause of active accounts displaying `Unknown` remains unconfirmed.
- **Online Presence Diagnosis** `[IN PROGRESS]`
  - Investigate why an active account, including `andhikafbry@gmail.com`, displays `Unknown` in Admin → Akun & Akses.
  - Confirm whether the authenticated session writes and refreshes `userPresence/{uid}.lastSeen`, and whether the account-management listener receives fresh, server-confirmed presence data.
- **Production Login Visual Integration** `[IN PROGRESS]`
  - Integrate the uploaded `index_fimo_layout_fixed.html` design as a visual reference in the actual `public/login.html` entry point, preserving the existing Firebase Authentication and session lifecycle.
  - Local markup/module integration and a browser smoke check are present in the current working tree; real-account authentication regression and full responsive verification remain pending.

### Blocked

- A Chrome DevTools opening attempt through the `computer-use` MCP tool timed out (`MCP error -32001: Request timed out`), blocking that specific console/network diagnostic attempt. Other diagnostic approaches remain available.

### Pending Verification

- Confirm the root cause of the online-presence issue; do not infer Online from account activation or from the presence feature's source code alone.
- Verify presence for login, logout, multiple tabs, unexpected browser closure, network interruptions and recovery, and stale-session expiry.
- Verify the login redesign in the actual application, including the existing authentication flow and responsive layouts.
- Run or repeat relevant automated tests and browser checks after any implementation changes; distinguish unit-test results from end-to-end behavior.
- Verify Firebase Rules, application/Hosting deployment, and local-development behavior as separate deployment states.

---

## 4. Planned

Items explicitly referenced in project documentation (`fimo.AGENTS.md`, `PROJECT_CONTEXT.md`, `DESIGN_SYSTEM.md`) or codebase configuration:

- **Unified Documentation Suite** `[PLANNED]`
  - Complete the standardized project documentation set:
    - `docs/BUSINESS_RULES.md` `[PLANNED]`
    - `docs/DATABASE.md` `[PLANNED]`
    - `docs/SECURITY.md` `[PLANNED]`
- **Local Development SPA Rewrite Handling** `[PLANNED]`
  - Update [`server.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/server.js) to mimic Firebase Hosting rewrite behavior (`**` -> `/index.html`) so local non-hash deep links or browser refreshes do not return 404/500 errors.
- **Design Reference Asset Catalog** `[PLANNED]`
  - Initialize and populate `docs/design-reference/` with visual guidelines and asset references.

*Note: Additional product features outside the verified codebase and documentation are `[NOT VERIFIED]`.*

---

## 5. Technical Improvements

Verified technical debt and optimization opportunities:

1. **Extraction of Inline Pricing & Revenue Engine**
   - *Current State:* The pricing configuration, PPN toggle, duration calculation, and Chart.js rendering logic currently reside in a single large inline script block in [`public/index.html`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/index.html) (lines 998–1822).
   - *Improvement Opportunity:* Extract this inline script into a dedicated ES Module (e.g., `public/pricing-revenue.js`) to enhance maintainability, testability, and CSP compliance.
2. **Server-Side Atomic Conflict Enforcement**
   - *Current State:* Vehicle booking collisions and date overlap checks execute purely in the browser in [`public/data-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/data-features.js).
   - *Improvement Opportunity:* Back client-side checks with Firestore atomic transaction logic or Cloud Functions to guarantee zero race-condition fleet collisions across simultaneous users.
3. **Consolidation of Binary Storage Strategy**
   - *Current State:* The repository contains both Firebase Storage rules in [`storage.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/storage.rules) and active Supabase Storage client code in [`public/admin-features.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/admin-features.js).
   - *Improvement Opportunity:* Formally standardize binary asset storage and retire unused configuration paths.

---

## 6. Security / Reliability Priorities

Key areas to preserve and reinforce before expanding application scope:

1. **Storage Authorization Enforcement**
   - The current SQL setup uses `anon` public policies for Supabase Storage uploads. Elevating to authenticated signed URLs or server-side token validation is a high security priority.
2. **Immutable Final Document Protection**
   - Maintain the strict Firestore rule condition rejecting updates to `notaDinas` records where `resource.data.status == 'FINAL'`.
3. **Audit Stamp Enforcement**
   - Maintain mandatory audit fields (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`) across all database mutations.
4. **Session Security Limits**
   - Retain the 12-hour maximum session lifetime and 10-hour inactivity timeout in [`public/session-security.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/session-security.js).
5. **Superadmin Role Escalation Prevention**
   - Preserve the rule restriction in `firestore.rules` preventing non-superadmin users from assigning or escalating accounts to the `superadmin` role.

---

## 7. Documentation Priorities

Remaining documentation files identified during repository inspection:

| Documentation File | Subject Area | Status |
| :--- | :--- | :--- |
| **`docs/PROJECT_CONTEXT.md`** | High-level system architecture, user roles, data flow, modules | `[COMPLETED]` |
| **`docs/DESIGN_SYSTEM.md`** | Color tokens, typography, components, layouts, responsive design | `[COMPLETED]` |
| **`docs/ROADMAP.md`** | Current status, completed modules, technical debt, definition of done | `[COMPLETED]` |
| **`docs/BUSINESS_RULES.md`** | Comprehensive business logic, conflict rules, pricing snapshot rules | `[PLANNED]` |
| **`docs/DATABASE.md`** | Full Firestore collections schema, field types, relationships, indexes | `[PLANNED]` |
| **`docs/SECURITY.md`** | Authentication flow, RBAC matrix, Firestore/Storage rules audit | `[PLANNED]` |

---

## 8. Future Architecture

- **Framework Migration:** `[NOT VERIFIED]`
  - No migration to React, Vue, Next.js, or Vite is specified or initiated in the repository. The project remains committed to standard browser ES Modules.
- **Backend Migration:** `[NOT VERIFIED]`
  - No server-side API framework (Express, Nest, etc.) is planned in the codebase; the architecture maintains a direct client-to-BaaS (Firebase & Supabase) model.
- **Production CI/CD Pipelines:** `[NOT VERIFIED]`
  - GitHub Actions, GitLab CI, or automated cloud deployment pipelines are not present in the local repository.

---

## 9. Definition of Done

When developing new features, fixes, or improvements, future developers and AI coding agents must fulfill the following standards before considering work complete:

1. **Automated Verification:**
   - Run `npm test` and verify that all unit test suites (`revenue-calculation`, `trayek-master`, `permissions`, `dashboard-monitoring`, `surat-penawaran`, `surat-konfirmasi`) pass cleanly.
   - Add new test cases in `tests/*.test.cjs` for newly introduced business calculations or data mappers.
2. **Permission & Security Compliance:**
   - Guard new UI elements using the client permission helper `can(permission)`.
   - Update [`firestore.rules`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/firestore.rules) and [`public/permissions.js`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/permissions.js) synchronously for any new data collections or actions.
   - Never rely on client-side guards as the sole security barrier.
3. **Data Integrity & Audit Preservation:**
   - Preserve `pricingSnapshot` immutability on created branding/booking records.
   - Attach audit fields (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`) to every mutation.
   - Verify that bus conflict checks are enforced prior to booking commits.
4. **UI & Responsive Verification:**
   - Use established design tokens from [`public/styles.css`](file:///d:/14.%20Project/dashboard-branding-transjogja%20V2.0/public/styles.css) (no ad-hoc colors or custom utility libraries).
   - Test UI responsiveness at desktop and mobile (`850px` sidebar collapse breakpoint).
   - Check browser developer console to ensure zero runtime exceptions.
5. **Documentation Alignment:**
   - Document new business rules, collections, or visual tokens in the appropriate `docs/` files.
