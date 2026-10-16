const assert = require('node:assert/strict');
const test = require('node:test');
const { getAccountDeletionError } = require('../account-policy');

const authorizedOperator = {
  callerUid: 'manager-uid',
  callerRole: 'admin',
  callerActive: true,
  callerPermissions: ['users.manage'],
};

test('rejects missing authentication and self deletion', () => {
  assert.equal(getAccountDeletionError({ targetUid: 'target', targetRole: 'viewer' }), 'unauthenticated');
  assert.equal(getAccountDeletionError({
    ...authorizedOperator,
    targetUid: 'manager-uid',
    targetRole: 'admin',
  }), 'self-delete');
});

test('requires an active user with users.manage or the superadmin role', () => {
  assert.equal(getAccountDeletionError({
    ...authorizedOperator,
    callerPermissions: [],
    targetUid: 'target',
    targetRole: 'viewer',
  }), 'permission-denied');
  assert.equal(getAccountDeletionError({
    ...authorizedOperator,
    callerActive: false,
    targetUid: 'target',
    targetRole: 'viewer',
  }), 'permission-denied');
  assert.equal(getAccountDeletionError({
    callerUid: 'root',
    callerRole: 'superadmin',
    callerActive: true,
    targetUid: 'target',
    targetRole: 'viewer',
  }), '');
});

test('prevents non-superadmins from deleting a superadmin account', () => {
  assert.equal(getAccountDeletionError({
    ...authorizedOperator,
    targetUid: 'root',
    targetRole: 'superadmin',
  }), 'protected-superadmin');
});

test('preserves the last active superadmin account', () => {
  assert.equal(getAccountDeletionError({
    callerUid: 'root',
    callerRole: 'superadmin',
    callerActive: true,
    targetUid: 'other-root',
    targetRole: 'superadmin',
    activeSuperadminCount: 1,
  }), 'last-superadmin');
  assert.equal(getAccountDeletionError({
    callerUid: 'root',
    callerRole: 'superadmin',
    callerActive: true,
    targetUid: 'other-root',
    targetRole: 'superadmin',
    activeSuperadminCount: 2,
  }), '');
  assert.equal(getAccountDeletionError({
    callerUid: 'root',
    callerRole: 'superadmin',
    callerActive: true,
    targetUid: 'inactive-root',
    targetRole: 'superadmin',
    targetActive: false,
    activeSuperadminCount: 0,
  }), '');
});

test('rejects unknown target roles and permits managed non-superadmin accounts', () => {
  assert.equal(getAccountDeletionError({
    ...authorizedOperator,
    targetUid: 'target',
    targetRole: 'unknown',
  }), 'invalid-target-role');
  assert.equal(getAccountDeletionError({
    ...authorizedOperator,
    targetUid: 'target',
    targetRole: 'operator',
  }), '');
});
