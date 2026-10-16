import { connectFirebase, signOutUser, watchAuthentication } from './firebase.js';
import { initialiseDataFeatures } from './data-features.js';
import { initialiseAdminFeatures } from './admin-features.js';
import { initialiseAdminConfig } from './admin-config.js';
import { initialiseNotaDinasFeatures } from './nota-dinas.js';
import { initialiseSuratPenawaranFeatures } from './surat-penawaran.js';
import { initialiseSuratKonfirmasiFeatures } from './surat-konfirmasi.js';
import { initSessionSecurity, cleanupSessionSecurity, getSessionSecurityStatus } from './session-security.js';
import { can, clearAccessContext, loadAccessContext } from './permissions.js';
import { initialiseStickyLayout } from './sticky-layout.js';
import { startPresenceHeartbeat, stopPresence } from './presence.js';

const firebaseStatus = document.querySelector('#firebase-status');
const signedInUser = document.querySelector('#signed-in-user');
const logoutButton = document.querySelector('#logout-button');
const views = document.querySelectorAll('.app-view');
const navigation = document.querySelector('nav');
const sidebar = document.querySelector('.sidebar');
const mobileNavToggle = document.querySelector('#mobile-nav-toggle');
const dashboardThemeStorageKey = 'branding-dashboard-theme-v1';
let authStateRevision = 0;
const stickyLayout = initialiseStickyLayout(views);

function buildNavigation() {
  if (!navigation) return;
  navigation.innerHTML = `
    <div class="nav-section nav-dashboard">
      <a class="nav-primary-link active" data-permission="dashboard.view" href="index.html#dashboard"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-7h6v7"/></svg></span><span>Dashboard</span></a>
    </div>
    <div class="nav-section nav-group" data-nav-group="operations">
      <button class="nav-group-toggle" type="button" aria-expanded="false"><span class="nav-group-title"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/><path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 12h8"/><path d="M12 12v3"/><path d="M3 14h18"/></svg></span><span>Operations</span></span><span class="nav-chevron" aria-hidden="true">▾</span></button>
      <div class="nav-group-panel">
        <a data-permission="masterBus.view" href="index.html#master-bus"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 18v2"/><path d="M17 18v2"/><path d="M7 10h10"/><path d="M7 14h10"/><path d="M6 6V4"/><path d="M18 6V4"/></svg></span><span>Master Bus</span></a>
        <a data-permission="branding.view" href="index.html#branding"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg></span><span>Data Branding</span></a>
      </div>
    </div>
    <div class="nav-section nav-group" data-nav-group="branding">
      <button class="nav-group-toggle" type="button" aria-expanded="false"><span class="nav-group-title"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg></span><span>Branding</span></span><span class="nav-chevron" aria-hidden="true">▾</span></button>
      <div class="nav-group-panel">
        <a data-permission="booking.view" href="index.html#booking"><span class="nav-icon" aria-hidden="true">＋</span><span>Booking Branding</span></a>
        <a data-permission="booking.view" href="index.html#rekap-branding"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 3v18"/><path d="M3 15h18"/></svg></span><span>Rekap Branding</span></a>
        <a data-permission="revenue.view" href="index.html#pendapatan-branding"><span class="nav-icon" aria-hidden="true">◔</span><span>Pendapatan Branding</span></a>
      </div>
    </div>
    <div class="nav-section nav-group" data-nav-group="monitoring">
      <button class="nav-group-toggle" type="button" aria-expanded="false"><span class="nav-group-title"><span class="nav-icon" aria-hidden="true">◫</span><span>Monitoring</span></span><span class="nav-chevron" aria-hidden="true">▾</span></button>
      <div class="nav-group-panel">
        <a data-permission="administration.view" href="index.html#administrasi-branding"><span class="nav-icon" aria-hidden="true">☑</span><span>Kelengkapan Administrasi</span></a>
        <a data-permission="branding.view" href="index.html#history"><span class="nav-icon" aria-hidden="true">◷</span><span>History</span></a>
      </div>
    </div>
    <div class="nav-section nav-group" data-nav-group="letters">
      <button class="nav-group-toggle" type="button" aria-expanded="false"><span class="nav-group-title"><span class="nav-icon" aria-hidden="true">▤</span><span>BUAT SURAT</span></span><span class="nav-chevron" aria-hidden="true">▾</span></button>
      <div class="nav-group-panel">
        <a data-permission="surat.view" href="index.html#kirim-surat-penawaran"><span class="nav-icon" aria-hidden="true">✉</span><span>Kirim Surat Penawaran</span></a>
        <a data-permission="surat.view" href="index.html#kirim-surat-konfirmasi"><span class="nav-icon" aria-hidden="true">✓</span><span>Kirim Surat Konfirmasi</span></a>
        <a data-permission="surat.view" href="index.html#buat-nota-dinas"><span class="nav-icon" aria-hidden="true">▤</span><span>Buat Nota Dinas ke Legal</span></a>
      </div>
    </div>
    <div class="nav-section nav-group" data-nav-group="admin">
      <button class="nav-group-toggle" type="button" aria-expanded="false"><span class="nav-group-title"><span class="nav-icon" aria-hidden="true">⚙</span><span>ADMIN</span></span><span class="nav-chevron" aria-hidden="true">▾</span></button>
      <div class="nav-group-panel">
        <a data-permission="users.view" href="index.html#admin-accounts"><span class="nav-icon" aria-hidden="true">♙</span><span>Akun &amp; Akses</span></a>
        <a data-permission="masterData.view" href="index.html#admin-master-data"><span class="nav-icon" aria-hidden="true">▤</span><span>Master Data &amp; Dropdown</span></a>
        <a data-permission="pricelist.view" href="index.html#setting-harga-branding"><span class="nav-icon" aria-hidden="true">◆</span><span>Pricelist Branding</span></a>
      </div>
    </div>`;
}

buildNavigation();
const navigationLinks = document.querySelectorAll('nav a');
const navGroupToggles = document.querySelectorAll('.nav-group-toggle');

function getDashboardTheme() {
  return document.documentElement.dataset.dashboardTheme === 'dark' ? 'dark' : 'light';
}

function updateThemeToggleUI() {
  const isDark = getDashboardTheme() === 'dark';
  const toggle = document.querySelector('#theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-checked', String(isDark));
    const label = isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }
}

function updateSidebarLogo() {
  const isDark = getDashboardTheme() === 'dark';
  const logo = document.querySelector('.sidebar-logo');
  if (logo) {
    logo.src = isDark ? 'icon/white svg logo tj.svg' : 'icon/logo-full.png';
  }
}

function updateViewChrome() {
  const theme = getDashboardTheme();
  document.documentElement.dataset.dashboardTheme = theme;
  document.documentElement.dataset.theme = theme;
  document.body.dataset.dashboardTheme = theme;
  document.body.dataset.theme = theme;

  updateThemeToggleUI();
  updateSidebarLogo();
}

function setDashboardTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.dashboardTheme = normalizedTheme;
  document.documentElement.dataset.theme = normalizedTheme;
  document.body.dataset.dashboardTheme = normalizedTheme;
  document.body.dataset.theme = normalizedTheme;
  try {
    localStorage.setItem(dashboardThemeStorageKey, normalizedTheme);
  } catch {
    // Appearance preferences remain optional when storage is unavailable.
  }
  updateViewChrome();
  window.dispatchEvent(new CustomEvent('dashboard-theme-change'));
}

function initialiseViewChrome() {
  updateViewChrome();
  const themeToggle = document.querySelector('#theme-toggle');
  themeToggle?.addEventListener('click', () => {
    setDashboardTheme(getDashboardTheme() === 'dark' ? 'light' : 'dark');
  });
}

initialiseViewChrome();

mobileNavToggle?.addEventListener('click', () => {
  const isOpen = mobileNavToggle.getAttribute('aria-expanded') === 'true';
  mobileNavToggle.setAttribute('aria-expanded', String(!isOpen));
  sidebar?.classList.toggle('is-nav-open', !isOpen);
});

navigationLinks.forEach((link) => {
  link.addEventListener('click', () => {
    if (!window.matchMedia('(max-width: 850px)').matches || !mobileNavToggle) return;
    mobileNavToggle.setAttribute('aria-expanded', 'false');
    sidebar?.classList.remove('is-nav-open');
  });
});

function setNavGroupOpen(group, open) {
  if (!group) return;
  group.classList.toggle('is-open', open);
  const toggle = group.querySelector(':scope > .nav-group-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
}

function updateNavigation() {
  const viewId = window.location.hash.slice(1) || 'dashboard';
  let activeView = [...views].find((view) => view.id === viewId) || document.querySelector('#dashboard');
  const viewPermissions = {
    dashboard: 'dashboard.view',
    'master-bus': 'masterBus.view',
    branding: 'branding.view',
    booking: 'booking.view',
    'rekap-branding': 'booking.view',
    'pendapatan-branding': 'revenue.view',
    'administrasi-branding': 'administration.view',
    history: 'branding.view',
    'setting-harga-branding': 'pricelist.view',
    'buat-nota-dinas': 'surat.view',
    'kirim-surat-penawaran': 'surat.view',
    'kirim-surat-konfirmasi': 'surat.view',
    'admin-accounts': 'users.view',
    'admin-master-data': 'masterData.view',
  };
  if (!can(viewPermissions[activeView.id] || 'dashboard.view')) {
    activeView = document.querySelector('#dashboard');
    if (window.location.hash !== '#dashboard') window.history.replaceState(null, '', '#dashboard');
  }

  views.forEach((view) => {
    view.hidden = view !== activeView;
  });

  document.querySelectorAll('[data-permission]').forEach((node) => {
    node.hidden = !can(node.dataset.permission);
  });
  document.querySelectorAll('.nav-group').forEach((group) => {
    if (group.dataset.permission && !can(group.dataset.permission)) {
      group.hidden = true;
      return;
    }
    group.hidden = ![...group.querySelectorAll('.nav-group-panel a')].some((link) => !link.hidden);
  });

  navigationLinks.forEach((link) => {
    const targetHash = link.hash;
    const isExactMatch = targetHash === `#${activeView.id}`;
    link.classList.toggle('active', isExactMatch);
  });

  document.querySelectorAll('.nav-group').forEach((group) => {
    if (group.querySelector('a.active')) setNavGroupOpen(group, true);
  });

  updateViewChrome();
  stickyLayout.refresh();
}

function showAccessDenied(title, message) {
  document.querySelectorAll('.app-view').forEach((view) => {
    view.hidden = view.id !== 'access-denied';
  });
  document.querySelector('#access-denied h2').textContent = title;
  document.querySelector('#access-denied p').textContent = message;
  document.body.classList.remove('auth-pending');
}

function getAccessLoadErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return {
      title: 'Akses data role ditolak',
      message: 'Firestore menolak pembacaan role akun. Periksa aturan akses baca dokumen userRoles milik akun ini.',
    };
  }
  if (error?.code === 'unauthenticated') {
    return {
      title: 'Sesi autentikasi tidak valid',
      message: 'Firebase tidak mengenali sesi pengguna saat memeriksa role. Silakan masuk kembali.',
    };
  }
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(error?.code)) {
    return {
      title: 'Koneksi Firebase bermasalah',
      message: 'Firestore tidak dapat dijangkau. Periksa koneksi dan konfigurasi Firebase lalu coba lagi.',
    };
  }
  return {
    title: 'Tidak dapat memverifikasi akses',
    message: 'Terjadi kesalahan saat memuat role akun. Periksa koneksi dan log Firebase untuk detailnya.',
  };
}

function initialiseDashboard() {
  const firebase = connectFirebase();
  firebaseStatus.textContent = firebase.message;
  firebaseStatus.classList.toggle('is-ready', firebase.connected);

  if (!firebase.connected) {
    document.body.classList.remove('auth-pending');
    return;
  }

  watchAuthentication(firebase.auth, async (user) => {
    const currentRevision = ++authStateRevision;
    stopPresence();
    if (!user) {
      cleanupSessionSecurity();
      clearAccessContext();
      window.location.replace('login.html');
      return;
    }

    signedInUser.textContent = user.email || 'Pengguna terautentikasi';
    initSessionSecurity(firebase.auth, user);
    let access;
    try {
      access = await loadAccessContext(firebase.db, user);
    } catch (error) {
      if (currentRevision !== authStateRevision) return;
      clearAccessContext();
      console.error('[FIRESTORE DEBUG] Gagal membaca role akun:', {
        path: `userRoles/${user.uid}`,
        code: error?.code || 'unknown',
        message: error?.message || String(error),
      });
      const accessError = getAccessLoadErrorMessage(error);
      showAccessDenied(accessError.title, accessError.message);
      firebaseStatus.textContent = 'Akses akun gagal diverifikasi.';
      return;
    }
    if (currentRevision !== authStateRevision) return;
    if (!access.active) {
      const accessMessages = {
        'missing-role': ['Akun belum terdaftar / role belum dikonfigurasi', 'Dokumen role akun belum tersedia. Hubungi Super Admin untuk menyiapkan akses.'],
        inactive: ['Akun belum aktif', 'Akun ini dinonaktifkan. Hubungi Super Admin jika akses perlu dipulihkan.'],
        'invalid-role': ['Role akun tidak valid', 'Role pada dokumen userRoles tidak dikenali. Hubungi Super Admin untuk memperbaiki konfigurasi role.'],
        'invalid-status': ['Status akun tidak valid', 'Nilai active pada dokumen userRoles harus berupa boolean. Hubungi Super Admin.'],
      };
      const [title, message] = accessMessages[access.status] || accessMessages['missing-role'];
      showAccessDenied(title, message);
      firebaseStatus.textContent = title;
      return;
    }
    const session = getSessionSecurityStatus();
    if (!session.isSessionActive || session.isTerminating || session.currentUid !== user.uid) {
      stopPresence();
      return;
    }
    startPresenceHeartbeat(firebase.db, user);
    updateNavigation();
    await initialiseDataFeatures(firebase.db, user);
    await initialiseAdminFeatures(firebase.db, firebase.auth);
    await initialiseAdminConfig(firebase.db, user, access, firebase.app);
    await initialiseNotaDinasFeatures(firebase.db, user);
    await initialiseSuratPenawaranFeatures(firebase.db, user);
    await initialiseSuratKonfirmasiFeatures();
    updateNavigation();
    document.body.classList.remove('auth-pending');
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      cleanupSessionSecurity();
      clearAccessContext();
      await signOutUser(firebase.auth);
      window.location.replace('login.html');
    } catch (error) {
      console.error('Gagal keluar:', error);
      logoutButton.disabled = false;
      firebaseStatus.textContent = 'Gagal keluar. Coba lagi.';
    }
  });
}

window.addEventListener('hashchange', updateNavigation);
navGroupToggles.forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const group = toggle.parentElement;
    setNavGroupOpen(group, !group.classList.contains('is-open'));
  });
});
initialiseDashboard();
