/**
 * session-security.js
 * Session security enforcement for FIMO application.
 *
 * Policies:
 * - Maximum session lifetime: 12 hours (forced logout regardless of activity)
 * - Inactivity timeout: 10 hours (forced logout without meaningful activity)
 * - Manual logout: always available, cleans up listeners & timers
 * - Browser close behavior: follows existing Firebase Auth persistence setting
 * - Independent timers: whichever timeout is reached first terminates the session
 * - Restores timers accurately across page refreshes and multi-tab browsing
 */

export const DEFAULT_MAX_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours (43,200,000 ms)
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 10 * 60 * 60 * 1000;    // 10 hours (36,000,000 ms)
export const DEFAULT_ACTIVITY_THROTTLE_MS = 2000;                    // 2 seconds throttle
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;                  // 30 seconds check

export const SESSION_STORAGE_KEYS = {
  UID: 'fimo_session_uid',
  START_PREFIX: 'fimo_session_start_',
  ACTIVITY_PREFIX: 'fimo_last_activity_',
  EXPIRED_MESSAGE: 'fimo_session_expired_message',
};

export const SESSION_EXPIRED_MESSAGES = {
  inactivity: 'Sesi Anda telah berakhir karena tidak ada aktivitas selama 10 jam. Silakan masuk kembali.',
  max_session: 'Sesi Anda telah berakhir karena telah mencapai batas waktu maksimal (12 jam). Silakan masuk kembali.',
  generic: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
};

// Module state
let currentUid = null;
let authRef = null;
let isSessionActive = false;
let isTerminating = false;

let maxSessionTimerId = null;
let inactivityTimerId = null;
let heartbeatIntervalId = null;

let lastRecordedActivityTime = 0;
let eventListenersBound = false;

let config = {
  maxSessionDurationMs: DEFAULT_MAX_SESSION_DURATION_MS,
  inactivityTimeoutMs: DEFAULT_INACTIVITY_TIMEOUT_MS,
  activityThrottleMs: DEFAULT_ACTIVITY_THROTTLE_MS,
  heartbeatIntervalMs: DEFAULT_HEARTBEAT_INTERVAL_MS,
};

// Activity events to monitor
const ACTIVITY_EVENTS = [
  'mousemove',
  'pointermove',
  'keydown',
  'click',
  'scroll',
  'touchstart',
];

/**
 * Configure timeout durations (primarily for automated testing or adjustments).
 */
export function configureSessionTimeouts(overrides = {}) {
  config = {
    ...config,
    ...overrides,
  };
}

/**
 * Handle meaningful user interaction.
 * Resets inactivity timer only; does NOT reset maximum session timer.
 */
export function recordUserActivity(forced = false) {
  if (!isSessionActive || isTerminating || !currentUid) return;

  const now = Date.now();
  if (!forced && (now - lastRecordedActivityTime < config.activityThrottleMs)) {
    return;
  }
  lastRecordedActivityTime = now;

  try {
    localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVITY_PREFIX + currentUid, now.toString());
  } catch (err) {
    console.warn('[session-security] LocalStorage not accessible for activity tracking:', err);
  }

  resetInactivityTimer(config.inactivityTimeoutMs);
}

function handleActivityEvent(event) {
  recordUserActivity(false);
}

function handleVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    checkSessionExpiration();
  }
}

function handleWindowFocus() {
  checkSessionExpiration();
}

function handleStorageSync(event) {
  if (!currentUid || isTerminating) return;
  if (event.key === SESSION_STORAGE_KEYS.ACTIVITY_PREFIX + currentUid && event.newValue) {
    const remoteActivity = parseInt(event.newValue, 10);
    if (!isNaN(remoteActivity) && remoteActivity > lastRecordedActivityTime) {
      lastRecordedActivityTime = remoteActivity;
      const remaining = config.inactivityTimeoutMs - (Date.now() - remoteActivity);
      resetInactivityTimer(Math.max(0, remaining));
    }
  }
}

function handleNavigationActivity() {
  recordUserActivity(true);
}

function bindEventListeners() {
  if (eventListenersBound || typeof window === 'undefined') return;

  ACTIVITY_EVENTS.forEach((type) => {
    const options = (type === 'scroll' || type === 'touchstart') ? { passive: true } : false;
    window.addEventListener(type, handleActivityEvent, options);
  });

  window.addEventListener('hashchange', handleNavigationActivity);
  window.addEventListener('popstate', handleNavigationActivity);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('storage', handleStorageSync);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  eventListenersBound = true;
}

function removeEventListeners() {
  if (!eventListenersBound || typeof window === 'undefined') return;

  ACTIVITY_EVENTS.forEach((type) => {
    const options = (type === 'scroll' || type === 'touchstart') ? { passive: true } : false;
    window.removeEventListener(type, handleActivityEvent, options);
  });

  window.removeEventListener('hashchange', handleNavigationActivity);
  window.removeEventListener('popstate', handleNavigationActivity);
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('storage', handleStorageSync);

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  eventListenersBound = false;
}

function resetInactivityTimer(delayMs) {
  if (inactivityTimerId) {
    clearTimeout(inactivityTimerId);
    inactivityTimerId = null;
  }
  if (!isSessionActive || isTerminating) return;

  inactivityTimerId = setTimeout(() => {
    handleSessionExpired('inactivity');
  }, delayMs);
}

function scheduleMaxSessionTimer(delayMs) {
  if (maxSessionTimerId) {
    clearTimeout(maxSessionTimerId);
    maxSessionTimerId = null;
  }
  if (!isSessionActive || isTerminating) return;

  maxSessionTimerId = setTimeout(() => {
    handleSessionExpired('max_session');
  }, delayMs);
}

/**
 * Heartbeat check: ensures clock skew or sleep mode does not delay timeout enforcement.
 */
function checkSessionExpiration() {
  if (!isSessionActive || isTerminating || !currentUid) return;

  const now = Date.now();
  const sessionStart = parseInt(localStorage.getItem(SESSION_STORAGE_KEYS.START_PREFIX + currentUid) || '0', 10);
  const lastActivity = parseInt(localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVITY_PREFIX + currentUid) || '0', 10);

  if (!sessionStart) return;

  // Maximum session duration exceeded (12 hours)
  if (now - sessionStart >= config.maxSessionDurationMs) {
    handleSessionExpired('max_session');
    return;
  }

  // Inactivity timeout exceeded (10 hours)
  if (lastActivity && (now - lastActivity >= config.inactivityTimeoutMs)) {
    handleSessionExpired('inactivity');
    return;
  }
}

/**
 * Force logout when either timeout is reached.
 */
export async function handleSessionExpired(reason = 'inactivity') {
  if (isTerminating) return;
  isTerminating = true;

  console.info(`[session-security] Session expired due to: ${reason}`);

  const messageText = SESSION_EXPIRED_MESSAGES[reason] || SESSION_EXPIRED_MESSAGES.generic;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEYS.EXPIRED_MESSAGE, messageText);
  } catch (err) {
    console.warn('[session-security] Unable to store session expired message in sessionStorage:', err);
  }

  const authToSignOut = authRef;
  const expiredUid = currentUid;

  cleanupSessionSecurity(expiredUid);

  try {
    if (authToSignOut && typeof authToSignOut.signOut === 'function') {
      await authToSignOut.signOut();
    }
  } catch (err) {
    console.error('[session-security] Error signing out on session expiration:', err);
  }

  if (typeof window !== 'undefined' && window.location) {
    window.location.replace(`login.html?expired=${encodeURIComponent(reason)}`);
  }
}

/**
 * Initialize session security when user authentication is established.
 */
export function initSessionSecurity(auth, user, customConfig = null) {
  if (!auth || !user?.uid) return;

  if (customConfig) {
    configureSessionTimeouts(customConfig);
  }

  // Avoid duplicate registration if already active for same user
  if (isSessionActive && currentUid === user.uid) {
    return;
  }

  // If active for a previous user, clean up first
  if (isSessionActive && currentUid && currentUid !== user.uid) {
    cleanupSessionSecurity(currentUid);
  }

  authRef = auth;
  currentUid = user.uid;
  isTerminating = false;
  isSessionActive = true;

  const now = Date.now();
  const storedUid = localStorage.getItem(SESSION_STORAGE_KEYS.UID);
  let sessionStart = null;
  let lastActivity = null;

  if (storedUid === user.uid) {
    const rawStart = parseInt(localStorage.getItem(SESSION_STORAGE_KEYS.START_PREFIX + user.uid) || '0', 10);
    const rawActivity = parseInt(localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVITY_PREFIX + user.uid) || '0', 10);
    if (!isNaN(rawStart) && rawStart > 0) {
      sessionStart = rawStart;
    }
    if (!isNaN(rawActivity) && rawActivity > 0) {
      lastActivity = rawActivity;
    }
  }

  // If brand new session or stored data invalid
  if (!sessionStart) {
    sessionStart = now;
    lastActivity = now;
    try {
      localStorage.setItem(SESSION_STORAGE_KEYS.UID, user.uid);
      localStorage.setItem(SESSION_STORAGE_KEYS.START_PREFIX + user.uid, sessionStart.toString());
      localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVITY_PREFIX + user.uid, lastActivity.toString());
    } catch (err) {
      console.warn('[session-security] LocalStorage write failed during session init:', err);
    }
  }

  lastRecordedActivityTime = lastActivity || now;

  // Immediate expiration check (e.g. browser was closed and reopened after timeouts)
  if (now - sessionStart >= config.maxSessionDurationMs) {
    handleSessionExpired('max_session');
    return;
  }
  if (now - lastRecordedActivityTime >= config.inactivityTimeoutMs) {
    handleSessionExpired('inactivity');
    return;
  }

  // Calculate remaining durations for independent timers
  const maxRemaining = Math.max(0, config.maxSessionDurationMs - (now - sessionStart));
  const inactivityRemaining = Math.max(0, config.inactivityTimeoutMs - (now - lastRecordedActivityTime));

  scheduleMaxSessionTimer(maxRemaining);
  resetInactivityTimer(inactivityRemaining);

  bindEventListeners();

  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
  }
  heartbeatIntervalId = setInterval(checkSessionExpiration, config.heartbeatIntervalMs);

  console.info('[session-security] Session security active.', {
    uid: user.uid,
    sessionStart: new Date(sessionStart).toISOString(),
    maxRemainingMs: maxRemaining,
    inactivityRemainingMs: inactivityRemaining,
  });
}

/**
 * Clean up all session timers, event listeners, and stored session state.
 */
export function cleanupSessionSecurity(uid = currentUid) {
  isSessionActive = false;
  isTerminating = false;

  if (maxSessionTimerId) {
    clearTimeout(maxSessionTimerId);
    maxSessionTimerId = null;
  }
  if (inactivityTimerId) {
    clearTimeout(inactivityTimerId);
    inactivityTimerId = null;
  }
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }

  removeEventListeners();

  const targetUid = uid || currentUid;
  if (targetUid) {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEYS.START_PREFIX + targetUid);
      localStorage.removeItem(SESSION_STORAGE_KEYS.ACTIVITY_PREFIX + targetUid);
      if (localStorage.getItem(SESSION_STORAGE_KEYS.UID) === targetUid) {
        localStorage.removeItem(SESSION_STORAGE_KEYS.UID);
      }
    } catch { /* silent */ }
  }

  currentUid = null;
  authRef = null;
}

/**
 * Get internal state for inspection/testing.
 */
export function getSessionSecurityStatus() {
  return {
    isSessionActive,
    isTerminating,
    currentUid,
    config: { ...config },
    hasMaxTimer: maxSessionTimerId !== null,
    hasInactivityTimer: inactivityTimerId !== null,
    hasHeartbeat: heartbeatIntervalId !== null,
    eventListenersBound,
    lastRecordedActivityTime,
  };
}
