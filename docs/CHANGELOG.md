# Changelog

Project changes and investigation notes are recorded here in reverse-chronological order. Entries distinguish repository changes from runtime verification and deployment evidence. See [ROADMAP.md](ROADMAP.md) for current project status.

## 2026-10-09

### Investigated

- `andhikafbry@gmail.com` was observed as `Unknown` in Admin → Akun & Akses while the account was in use. Account activation and live presence are separate: an active `userRoles/{uid}` record alone does not mean the user is online.
- The repository already contains a Firestore presence implementation: an authenticated client writes `userPresence/{uid}.lastSeen` with a server timestamp every 30 seconds; the UI considers a signal online for up to 120 seconds. Missing, pending, cached, invalid, or unavailable presence/account-status data can resolve to `Unknown`. The cause of the observed account status was not established.
- The current per-user timestamp is not a per-session lease. Logout stops the local heartbeat but does not immediately expire the Firestore signal; stale data ages out. Multi-tab and other lifecycle cases still need end-to-end verification.

### Blocked

- An attempt to open Chrome DevTools through the `computer-use` MCP tool timed out with `MCP error -32001: Request timed out`. Successful DevTools console or network inspection was not confirmed.

### Changed

- The local production login entry point is `public/login.html`; the supplied `index_fimo_layout_fixed.html` is a visual reference, not a separate production route. The working tree contains local visual integration and `public/login-mascots.js` wiring through the existing `public/login.js` module.
- A local browser smoke check loaded `/login.html`, the official logo, the login modules, and the mascot UI. This did not verify sign-in against a real Firebase account, invalid-credential feedback from Firebase, or password-reset delivery.

### Verification and Deployment

- `npm test` and JavaScript syntax checks passed during the preceding local implementation work. They do not verify real-user presence lifecycle scenarios or production authentication regression behavior.
- The Firebase CLI reported that Firestore Rules were successfully compiled and released to project `dashboard-branding-transjogja`. This was a Rules deployment only; no Firebase Hosting/application deployment was confirmed.
- No source-code fix for the observed `Unknown` presence result was confirmed. The issue and its root cause remain unresolved; do not treat the existing implementation or Rules deployment as proof of end-to-end presence.

### Pending

- Verify actual Firestore heartbeat writes and the admin presence listener for an authenticated user, then test login, logout, multiple tabs, unexpected closure, network interruption/recovery, and stale-session expiry.
- Complete production-auth regression and responsive/browser verification for the local login redesign before describing it as fully verified.
