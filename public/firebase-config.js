// Konfigurasi Web App Firebase: dashboard-branding-transjogja.
export const firebaseConfig = {
  apiKey: 'AIzaSyALw1S2ngaQ8m7uXkWyvck-cFyg_CtcZI4',
  authDomain: 'dashboard-branding-transjogja.firebaseapp.com',
  projectId: 'dashboard-branding-transjogja',
  storageBucket: 'dashboard-branding-transjogja.firebasestorage.app',
  messagingSenderId: '330447901761',
  appId: '1:330447901761:web:21e0f968c36dc4b3aa22c0',
  measurementId: 'G-VPQLDXJQ1F',
};

// Set true only after the managed-account Firebase Callable Function is deployed.
export const adminBackendConfig = Object.freeze({
  accountDeletionEnabled: false,
  functionsRegion: 'us-central1',
});

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
