const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { getAccountDeletionError } = require('./account-policy');

initializeApp();

const firestore = getFirestore();

const deletionErrors = {
  'self-delete': ['failed-precondition', 'Anda tidak dapat menghapus akun yang sedang digunakan.'],
  'invalid-target-role': ['failed-precondition', 'Role akun target tidak valid; akun tidak dihapus.'],
  'protected-superadmin': ['permission-denied', 'Hanya Super Admin yang dapat menghapus akun Super Admin.'],
  'last-superadmin': ['failed-precondition', 'Akun Super Admin aktif terakhir tidak dapat dihapus.'],
  'permission-denied': ['permission-denied', 'Izin users.manage diperlukan untuk menghapus akun.'],
};

exports.deleteManagedUser = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sesi Firebase diperlukan.');
  }

  const callerUid = request.auth.uid;
  const targetUid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : '';
  if (!targetUid || targetUid.length > 128) {
    throw new HttpsError('invalid-argument', 'UID akun target tidak valid.');
  }
  if (callerUid === targetUid) {
    throw new HttpsError('failed-precondition', 'Anda tidak dapat menghapus akun yang sedang digunakan.');
  }

  try {
    const callerReference = firestore.collection('userRoles').doc(callerUid);
    const targetReference = firestore.collection('userRoles').doc(targetUid);
    const targetRoleExists = await firestore.runTransaction(async (transaction) => {
      const callerSnapshot = await transaction.get(callerReference);
      const callerData = callerSnapshot.exists ? callerSnapshot.data() : {};
      const callerActive = callerData.active === undefined || callerData.active === true;
      const hasManagePermission = callerData.role === 'superadmin'
        || (callerActive && Array.isArray(callerData.permissions) && callerData.permissions.includes('users.manage'));
      if (!callerSnapshot.exists || !hasManagePermission || !callerActive) {
        throw new HttpsError('permission-denied', 'Akun aktif dengan izin users.manage diperlukan.');
      }

      const targetSnapshot = await transaction.get(targetReference);
      if (!targetSnapshot.exists) {
        return false;
      }
      const targetData = targetSnapshot.data();
      let activeSuperadminCount = 0;
      if (targetData.role === 'superadmin') {
        const superadmins = await transaction.get(
          firestore.collection('userRoles').where('role', '==', 'superadmin'),
        );
        activeSuperadminCount = superadmins.docs.filter((entry) => {
          const active = entry.data().active;
          return active === undefined || active === true;
        }).length;
      }
      const policyError = getAccountDeletionError({
        callerUid,
        callerRole: callerData.role,
        callerActive: callerData.active,
        callerPermissions: callerData.permissions,
        targetUid,
        targetRole: targetData.role,
        targetActive: targetData.active,
        activeSuperadminCount,
      });
      if (policyError) {
        const [code, message] = deletionErrors[policyError] || ['failed-precondition', 'Akun tidak dapat dihapus.'];
        throw new HttpsError(code, message);
      }

      transaction.update(targetReference, {
        active: false,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: callerUid,
      });
      return true;
    });
    if (!targetRoleExists) {
      try {
        await getAuth().getUser(targetUid);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          return { uid: targetUid, deleted: true, alreadyDeleted: true };
        }
        throw error;
      }
      throw new HttpsError('not-found', 'Dokumen role akun target tidak ditemukan.');
    }

    try {
      await getAuth().deleteUser(targetUid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
    await targetReference.delete();

    return { uid: targetUid, deleted: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Managed account deletion failed:', {
      callerUid,
      targetUid,
      code: error?.code || 'unknown',
    });
    throw new HttpsError('internal', 'Penghapusan akun gagal. Tidak semua perubahan mungkin selesai; periksa log backend sebelum mencoba lagi.');
  }
});
