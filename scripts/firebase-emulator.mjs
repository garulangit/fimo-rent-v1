import assert from 'node:assert/strict';

const projectId = 'demo-branding-transjogja';
const authEmulator = 'http://127.0.0.1:9099';
const firestoreEmulator = 'http://127.0.0.1:8080';
const apiKey = 'local-emulator-api-key';
const accounts = [
  { role: 'superadmin', email: 'superadmin@fimo-emulator.test', password: 'LocalOnly-Superadmin-2026!' },
  { role: 'admin', email: 'admin@fimo-emulator.test', password: 'LocalOnly-Admin-2026!' },
  { role: 'operator', email: 'operator@fimo-emulator.test', password: 'LocalOnly-Operator-2026!' },
  { role: 'viewer', email: 'viewer@fimo-emulator.test', password: 'LocalOnly-Viewer-2026!' },
];

async function requestJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(4000) });
  } catch (error) {
    throw new Error(`Firebase Emulator tidak terjangkau di ${new URL(url).origin}. Jalankan npm run emulators terlebih dahulu.`, { cause: error });
  }
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function signInOrCreate(account) {
  const signUp = await requestJson(
    `${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    },
  );
  if (signUp.response.ok) return signUp.body;
  if (signUp.body.error?.message !== 'EMAIL_EXISTS') {
    throw new Error(`Auth Emulator account setup failed for ${account.role}: ${signUp.body.error?.message || signUp.response.status}`);
  }

  const signIn = await requestJson(
    `${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    },
  );
  if (!signIn.response.ok) {
    throw new Error(`Existing local Auth Emulator account could not sign in for ${account.role}: ${signIn.body.error?.message || signIn.response.status}`);
  }
  return signIn.body;
}

function accountDocumentUrl(uid) {
  return `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/userRoles/${encodeURIComponent(uid)}`;
}

async function seedAccounts() {
  const seeded = [];
  for (const account of accounts) {
    const authUser = await signInOrCreate(account);
    const { response, body } = await requestJson(accountDocumentUrl(authUser.localId), {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer owner',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          role: { stringValue: account.role },
          active: { booleanValue: true },
          email: { stringValue: account.email },
          displayName: { stringValue: `Local ${account.role}` },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Firestore Emulator role seeding failed for ${account.role}: ${body.error?.message || response.status}`);
    }
    seeded.push({ ...account, uid: authUser.localId, idToken: authUser.idToken });
    console.log(`Seeded local ${account.role} account: ${account.email}`);
  }
  return seeded;
}

function readRoleDocumentFields(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [
    key,
    value.stringValue ?? value.booleanValue ?? value.integerValue ?? null,
  ]));
}

async function testAccounts() {
  const seeded = await seedAccounts();
  const canViewAccounts = new Set(['superadmin', 'admin']);

  const unauthenticatedList = await requestJson(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/userRoles?pageSize=100`,
  );
  assert.notEqual(unauthenticatedList.response.status, 200, 'unauthenticated clients cannot list userRoles');
  assert.equal(unauthenticatedList.body.error?.status, 'PERMISSION_DENIED');
  console.log('PASS unauthenticated: userRoles list denied by Firestore Rules');

  for (const account of seeded) {
    const ownRole = await requestJson(accountDocumentUrl(account.uid), {
      headers: { Authorization: `Bearer ${account.idToken}` },
    });
    assert.equal(ownRole.response.status, 200, `${account.role} can read own role`);
    const role = readRoleDocumentFields(ownRole.body);
    assert.equal(role.role, account.role);
    assert.equal(role.active, true);

    const list = await requestJson(
      `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/userRoles?pageSize=100`,
      { headers: { Authorization: `Bearer ${account.idToken}` } },
    );
    if (canViewAccounts.has(account.role)) {
      assert.equal(list.response.status, 200, `${account.role} can list userRoles`);
      assert.equal(list.body.documents?.length, accounts.length, `${account.role} receives all seeded userRoles`);
      console.log(`PASS ${account.role}: Auth, active role, userRoles list allowed (${list.body.documents.length} records)`);
    } else {
      assert.notEqual(list.response.status, 200, `${account.role} cannot list userRoles`);
      assert.equal(list.body.error?.status, 'PERMISSION_DENIED', `${account.role} is denied by Firestore Rules`);
      console.log(`PASS ${account.role}: Auth, active role, userRoles list denied by Firestore Rules`);
    }

    if (account.role !== 'superadmin') {
      const target = seeded.find((candidate) => candidate.role === 'viewer');
      const escalation = await requestJson(accountDocumentUrl(target.uid), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${account.idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            role: { stringValue: 'superadmin' },
            active: { booleanValue: true },
          },
        }),
      });
      assert.notEqual(escalation.response.status, 200, `${account.role} cannot assign superadmin`);
      assert.equal(escalation.body.error?.status, 'PERMISSION_DENIED', `${account.role} cannot escalate another role`);
    }
  }
  console.log('PASS non-superadmin: superadmin role escalation denied by Firestore Rules');
}

const command = process.argv[2] || 'test';
if (command === 'seed') {
  await seedAccounts();
  console.log('Local-only Firebase Emulator accounts are ready. Credentials are defined in this script.');
} else if (command === 'test') {
  await testAccounts();
  console.log('Firebase Authentication and Firestore Rules Emulator tests passed.');
} else {
  throw new Error(`Unknown command "${command}". Use "seed" or "test".`);
}
