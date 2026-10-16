const VALID_ROLES = new Set(['superadmin', 'admin', 'operator', 'viewer']);

function getAccountDeletionError({
  callerUid,
  callerRole,
  callerActive,
  callerPermissions,
  targetUid,
  targetRole,
  targetActive,
  activeSuperadminCount = 0,
}) {
  if (!callerUid) return 'unauthenticated';
  if (callerUid === targetUid) return 'self-delete';

  const active = callerActive === undefined || callerActive === true;
  const canManageUsers = active && (
    callerRole === 'superadmin'
    || (Array.isArray(callerPermissions) && callerPermissions.includes('users.manage'))
  );
  if (!canManageUsers) return 'permission-denied';
  if (!VALID_ROLES.has(targetRole)) return 'invalid-target-role';
  if (targetRole === 'superadmin') {
    if (callerRole !== 'superadmin') return 'protected-superadmin';
    const targetIsActive = targetActive === undefined || targetActive === true;
    if (targetIsActive && activeSuperadminCount <= 1) return 'last-superadmin';
  }
  return '';
}

module.exports = { getAccountDeletionError };
