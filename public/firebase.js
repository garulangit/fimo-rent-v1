import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const LOCAL_FIREBASE_PROJECT_ID = 'demo-branding-transjogja';
const FIREBASE_EMULATOR_SESSION_KEY = 'fimo-firebase-emulator-opt-in';
const LOCAL_FIREBASE_CONFIG = Object.freeze({
  apiKey: 'local-emulator-api-key',
  authDomain: 'localhost',
  projectId: LOCAL_FIREBASE_PROJECT_ID,
  storageBucket: `${LOCAL_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: '123456789000',
  appId: '1:123456789000:web:localemulator',
});

function isLocalDevelopmentHost() {
  const hostname = window.location.hostname.replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function isFirebaseEmulatorOptedIn() {
  if (!isLocalDevelopmentHost()) return false;

  const emulatorMode = new URLSearchParams(window.location.search).get('firebaseEmulator');
  try {
    if (emulatorMode === '1') {
      sessionStorage.setItem(FIREBASE_EMULATOR_SESSION_KEY, 'true');
    } else if (emulatorMode === '0') {
      sessionStorage.removeItem(FIREBASE_EMULATOR_SESSION_KEY);
    }
    return sessionStorage.getItem(FIREBASE_EMULATOR_SESSION_KEY) === 'true';
  } catch (error) {
    console.error('Firebase Emulator opt-in tidak dapat dibaca:', error);
    return false;
  }
}

export function connectFirebase() {
  const useEmulators = isFirebaseEmulatorOptedIn();
  if (!useEmulators && !hasFirebaseConfig) {
    return { connected: false, message: 'Konfigurasi Firebase belum diisi.' };
  }

  try {
    const appName = useEmulators ? 'firebase-emulator' : '[DEFAULT]';
    const existingApp = getApps().find((candidate) => candidate.name === appName);
    const app = existingApp || (useEmulators
      ? initializeApp(LOCAL_FIREBASE_CONFIG, appName)
      : initializeApp(firebaseConfig));
    const auth = getAuth(app);
    const db = getFirestore(app);

    if (useEmulators && !existingApp) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }

    return {
      connected: true,
      app,
      auth,
      db,
      message: useEmulators ? 'Firebase Emulator lokal.' : 'Database Online.',
    };
  } catch (error) {
    console.error('Firebase tidak dapat dihubungkan:', error);
    return { connected: false, message: 'Koneksi Firebase gagal. Periksa konfigurasi.' };
  }
}

export function watchAuthentication(auth, callback) {
  return onAuthStateChanged(auth, callback);
}

export function signIn(auth, email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function sendPasswordResetEmail(auth, email) {
  return firebaseSendPasswordResetEmail(auth, email);
}

export function signOutUser(auth) {
  return signOut(auth);
}
