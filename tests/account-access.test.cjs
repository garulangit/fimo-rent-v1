const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('public/index.html');
const admin = read('public/admin-config.js');
const permissions = read('public/permissions.js');
const config = read('public/firebase-config.js');
const app = read('public/app.js');
const rules = read('firestore.rules');
const functions = read('functions/index.js');
const policy = read('functions/account-policy.js');
const css = read('public/styles.css');

assert.match(html, /id="admin-accounts-tab"[^>]*aria-selected="true"[^>]*>Akun/);
assert.match(html, /id="admin-access-tab"[^>]*aria-selected="false"[^>]*>Akses/);
assert.match(html, /id="admin-accounts-panel"[^>]*role="tabpanel"/);
assert.match(html, /id="admin-access-panel"[^>]*role="tabpanel"[^>]*hidden/);
for (const heading of ['No', 'Nama', 'Email', 'Role', 'Status', 'Terakhir Diperbarui', 'Aksi', 'Online']) {
  assert.match(html, new RegExp(`<th>${heading}</th>`));
}

assert.match(admin, /account\.uid === user\.uid/);
assert.match(admin, /data-account-delete=/);
assert.match(admin, /if \(!account \|\| account\.uid === user\.uid\) return/);
assert.match(admin, /: can\('users\.manage'\)\s+\? `.*data-account-delete=/s);
assert.match(admin, /adminBackendConfig\.accountDeletionEnabled && app/);
assert.match(admin, /httpsCallable\(getFunctions\(app, adminBackendConfig\.functionsRegion\), 'deleteManagedUser'\)/);
assert.match(config, /accountDeletionEnabled: false/);
assert.match(admin, /targetReference\.delete|deleteManagedUser\(\{ uid \}\)/);
assert.match(functions, /request\.auth/);
assert.match(functions, /getAuth\(\)\.deleteUser\(targetUid\)/);
assert.match(functions, /targetReference\.delete\(\)/);
assert.match(functions, /firestore\.runTransaction/);
assert.match(functions, /active: false/);
assert.match(functions, /callerData\.permissions\.includes\('users\.manage'\)/);
assert.match(functions, /alreadyDeleted: true/);
assert.match(functions, /activeSuperadminCount/);
assert.match(policy, /callerUid === targetUid/);
assert.match(policy, /if \(targetRole === 'superadmin'\) \{\s+if \(callerRole !== 'superadmin'\) return 'protected-superadmin';/);
assert.doesNotMatch(functions, /serviceAccount|privateKey|credential/i);
assert.match(rules, /function canManageUsers\(\) \{\s*return isSuperAdmin\(\) \|\| hasPermission\('users\.manage'\);/);
assert.match(rules, /match \/userPresence\/\{uid\}/);
assert.match(rules, /allow read: if isSignedIn\(\) && \(isAdmin\(\) \|\| hasPermission\('users\.view'\)\)/);
assert.match(rules, /request\.auth\.uid == uid\s+&& isAccountActive\(\)\s+&& currentRole\(\) in \['superadmin', 'admin', 'operator', 'viewer'\]/);
assert.match(rules, /request\.resource\.data\.lastSeen == request\.time/);
assert.match(admin, /watchPresence\(db, updatePresenceIndicators\)/);
assert.match(admin, /accountStatusAvailable\s+\?\s+accountActiveByUid\.get\(account\.uid\) === true\s+:\s+account\.active/);
assert.match(admin, /data-presence-uid=/);
assert.match(admin, /available: presenceAvailable && accountStatusAvailable/);
assert.match(app, /startPresenceHeartbeat\(firebase\.db, user\)/);
assert.match(app, /stopPresence\(\)/);

assert.match(permissions, /superadmin: \['\*'\]/);
assert.match(permissions, /admin: \[/);
assert.match(permissions, /operator: \[/);
assert.match(permissions, /viewer: \[/);
assert.match(admin, /getRolePermissions\(account\.role\)/);
assert.match(admin, /pendingAccessPermissions\.has\(permission\.key\)/);
assert.match(admin, /updateDoc\(doc\(db, 'userRoles', account\.uid\)/);
assert.match(admin, /permissions: getPendingAccessPermissions\(\)/);
assert.match(admin, /role === 'superadmin'\)/);
assert.match(rules, /allow update: if canManageUsers\(\)/);
assert.doesNotMatch(rules, /allow delete: if canManageUsers\(\)/);

assert.match(admin, /data-admin-user-close/);
assert.match(html, /id="admin-user-cancel"[^>]*aria-label="Tutup"[^>]*data-admin-user-close/);
assert.match(admin, /\$\('#admin-user-dialog'\)\.close\(\)/);
assert.match(html, /id="admin-user-form" method="dialog"/);
assert.match(html, /id="admin-delete-user-title">Hapus akun ini\?/);
assert.match(html, /Akun ini akan kehilangan akses ke aplikasi\./);
assert.match(html, /data-admin-delete-close>Batal<\/button>/);
assert.match(html, /id="admin-delete-user-submit"[^>]*>Hapus Akun<\/button>/);
assert.match(admin, /deletionInProgress/);
assert.match(admin, /if \(selectedAccessUid === uid\) selectedAccessUid = ''/);
assert.match(admin, /protectCurrentManager/);
assert.match(css, /\.admin-account-tab:focus-visible/);
assert.match(css, /\.icon-button:focus-visible/);
assert.match(app, /initialiseAdminConfig\(firebase\.db, user, access, firebase\.app\)/);

console.log('Account tabs, permissions, modal, and backend guard checks passed.');
