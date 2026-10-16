import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  PRESENCE_REFRESH_INTERVAL_MS,
} from './presence-state.js';
import { getSessionSecurityStatus } from './session-security.js';

const presenceWatchers = new Set();
let heartbeatCleanup = null;

async function refreshPresence(db, uid, reportFailure) {
  try {
    await setDoc(doc(db, 'userPresence', uid), {
      lastSeen: serverTimestamp(),
    }, { merge: true });
    reportFailure(false);
  } catch (error) {
    if (reportFailure(true)) {
      console.error('Gagal memperbarui sinyal kehadiran akun:', {
        uid,
        code: error?.code || 'unknown',
        message: error?.message || String(error),
      });
    }
  }
}

export function startPresenceHeartbeat(db, user) {
  heartbeatCleanup?.();
  if (!db || !user?.uid) return;

  let failureReported = false;
  const reportFailure = (failed) => {
    const shouldReport = failed && !failureReported;
    failureReported = failed;
    return shouldReport;
  };
  let stopThisHeartbeat = () => {};
  let writeInProgress = false;
  const write = async () => {
    if (writeInProgress) return;
    const session = getSessionSecurityStatus();
    if (!session.isSessionActive || session.isTerminating || session.currentUid !== user.uid) {
      stopThisHeartbeat();
      return;
    }
    writeInProgress = true;
    try {
      await refreshPresence(db, user.uid, reportFailure);
    } finally {
      writeInProgress = false;
    }
  };
  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') void write();
  };

  const timerId = window.setInterval(() => { void write(); }, PRESENCE_HEARTBEAT_INTERVAL_MS);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  const cleanup = () => {
    window.clearInterval(timerId);
    document.removeEventListener('visibilitychange', refreshWhenVisible);
    if (heartbeatCleanup === cleanup) heartbeatCleanup = null;
  };
  stopThisHeartbeat = cleanup;
  heartbeatCleanup = cleanup;

  void write();
}

export function watchPresence(db, onChange) {
  let active = true;
  let availabilityTimer = null;
  let lastSeenByUid = new Map();
  let presenceAvailable = false;
  let activeByUid = new Map();
  let accountStatusAvailable = false;
  const notify = () => onChange(lastSeenByUid, presenceAvailable, activeByUid, accountStatusAvailable);
  const unsubscribePresence = onSnapshot(collection(db, 'userPresence'), { includeMetadataChanges: true }, (snapshot) => {
    if (!active) return;
    if (snapshot.metadata.fromCache) {
      lastSeenByUid = new Map();
      presenceAvailable = false;
      notify();
      return;
    }
    lastSeenByUid = new Map();
    snapshot.docs.forEach((entry) => {
      const lastSeen = entry.data().lastSeen;
      lastSeenByUid.set(
        entry.id,
        !entry.metadata.hasPendingWrites && typeof lastSeen?.toMillis === 'function'
          ? lastSeen.toMillis()
          : NaN,
      );
    });
    presenceAvailable = true;
    notify();
  }, (error) => {
    if (!active) return;
    console.error('Gagal memantau kehadiran akun:', {
      code: error?.code || 'unknown',
      message: error?.message || String(error),
    });
    lastSeenByUid = new Map();
    presenceAvailable = false;
    notify();
  });
  const unsubscribeAccountStatus = onSnapshot(collection(db, 'userRoles'), { includeMetadataChanges: true }, (snapshot) => {
    if (!active) return;
    if (snapshot.metadata.fromCache) {
      activeByUid = new Map();
      accountStatusAvailable = false;
      notify();
      return;
    }
    activeByUid = new Map(snapshot.docs.map((entry) => {
      const account = entry.data();
      return [entry.id, (account.active === undefined || account.active === true)
        && ['superadmin', 'admin', 'operator', 'viewer'].includes(account.role)];
    }));
    accountStatusAvailable = true;
    notify();
  }, (error) => {
    if (!active) return;
    console.error('Gagal memverifikasi status akun untuk kehadiran:', {
      code: error?.code || 'unknown',
      message: error?.message || String(error),
    });
    activeByUid = new Map();
    accountStatusAvailable = false;
    notify();
  });

  availabilityTimer = window.setInterval(() => {
    if (active) notify();
  }, PRESENCE_REFRESH_INTERVAL_MS);

  const cleanup = () => {
    if (!active) return;
    active = false;
    unsubscribePresence();
    unsubscribeAccountStatus();
    window.clearInterval(availabilityTimer);
    presenceWatchers.delete(cleanup);
    onChange(new Map(), false, new Map(), false);
  };
  presenceWatchers.add(cleanup);
  return cleanup;
}

export function stopPresence() {
  heartbeatCleanup?.();
  [...presenceWatchers].forEach((cleanup) => cleanup());
}
