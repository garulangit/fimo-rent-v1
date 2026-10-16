# Local Firebase Emulator Workflow

By default, the local app uses the Firebase project in `public/firebase-config.js`, the same project used by the deployed app. Firebase Authentication and Firestore emulators are an explicit local-only opt-in: open `http://localhost:5173/login.html?firebaseEmulator=1`. This choice is kept in the current browser tab's session so it survives the login redirect. To return that tab to production Firebase, open `http://localhost:5173/login.html?firebaseEmulator=0`, or close the tab and open a new one.

Emulator mode initializes a separate Firebase app with the non-production project ID `demo-branding-transjogja` and connects only to `127.0.0.1:9099` (Auth) and `127.0.0.1:8080` (Firestore). Emulator opt-in is ignored on non-local hosts. If the emulator is unavailable, local emulator operations fail; the client does not fall back between emulator and production.

The Firestore Emulator loads the repository's `firestore.rules`. Those Rules are unchanged for this local setup. Emulator test-account role documents are seeded using the emulator's local-only `Bearer owner` bypass; app requests use Firebase Auth emulator ID tokens and are evaluated by the Firestore Rules.

## Requirements

- Node.js supported by the repository.
- Java installed and available on `PATH` for the Firestore Emulator.
- npm dependencies installed with `npm install`.

If Firebase CLI reports that it cannot spawn `java -version`, set `JAVA_HOME` to the installed JDK and add its `bin` directory to `PATH` in the same terminal before starting the emulators.

The Firebase Emulator UI is available at `http://127.0.0.1:4000`.

## Run the app locally

1. Terminal 1: `npm run emulators`
2. Terminal 2: `npm run emulators:seed`
3. Terminal 3: `npm start`
4. Open `http://localhost:5173/login.html?firebaseEmulator=1` and sign in with one of the local accounts below.

## Local-only test accounts

The seed script creates or reuses these accounts in the Authentication Emulator and writes the corresponding active `userRoles/{uid}` documents:

| Role | Email | Password |
|---|---|---|
| superadmin | `superadmin@fimo-emulator.test` | `LocalOnly-Superadmin-2026!` |
| admin | `admin@fimo-emulator.test` | `LocalOnly-Admin-2026!` |
| operator | `operator@fimo-emulator.test` | `LocalOnly-Operator-2026!` |
| viewer | `viewer@fimo-emulator.test` | `LocalOnly-Viewer-2026!` |

These credentials are intentionally deterministic and valid only in the local emulator. They are not production credentials. The seed script refuses to contact non-loopback hosts and uses only the demo emulator project ID.

## Verify authentication and Rules

- With the emulators running, `npm run emulators:seed` creates/repairs the four local users and role records.
- `npm run emulators:test` starts fresh Auth and Firestore emulators, seeds all four accounts, then authenticates each and tests `userRoles/{uid}` and collection access against the Firestore Emulator Rules.
- Superadmin and admin must be able to list all four role documents. Operator and viewer may read only their own role document and must be denied a collection list with `PERMISSION_DENIED`.
- `npm test` runs the existing client permission tests, including the role-to-permission and `#admin-accounts` guard checks.
- For the browser check, explicitly open `http://localhost:5173/login.html?firebaseEmulator=1` while emulators are running. Admin/superadmin can open **Akun & Akses**; operator/viewer do not receive `users.view`, and direct `#admin-accounts` navigation returns to the dashboard.

The emulator is isolated from production services. These checks do not deploy Rules and do not read or write production users or Firestore data.
