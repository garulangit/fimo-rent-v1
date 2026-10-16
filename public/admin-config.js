import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import { adminBackendConfig } from './firebase-config.js';
import { TRAYEK_MASTER } from './trayek-master.js';
import { can, getRolePermissions } from './permissions.js';
import { watchPresence } from './presence.js';
import { getPresenceStatus } from './presence-state.js';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character]);
const ROLES = ['superadmin', 'admin', 'operator', 'viewer'];
const ROLE_LABELS = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
};
const PERMISSION_GROUPS = [
  {
    title: 'DASHBOARD',
    permissions: [
      { key: 'dashboard.view', label: 'Lihat Dashboard', description: 'Melihat ringkasan operasional.' },
    ],
  },
  {
    title: 'OPERATIONS',
    permissions: [
      { key: 'masterBus.view', label: 'Lihat Master Bus', description: 'Melihat inventaris bus.' },
      { key: 'masterBus.edit', label: 'Kelola Master Bus', description: 'Mengubah data inventaris bus.' },
      { key: 'branding.view', label: 'Lihat Branding', description: 'Melihat data branding.' },
      { key: 'branding.create', label: 'Buat Branding', description: 'Membuat data branding baru.' },
      { key: 'branding.edit', label: 'Edit Branding', description: 'Mengubah data branding.' },
      { key: 'branding.import', label: 'Impor Branding', description: 'Mengimpor data branding.' },
      { key: 'booking.view', label: 'Lihat Booking', description: 'Melihat booking branding.' },
      { key: 'booking.create', label: 'Buat Booking', description: 'Membuat booking baru.' },
      { key: 'booking.edit', label: 'Edit Booking', description: 'Mengubah booking.' },
    ],
  },
  {
    title: 'REPORTING',
    permissions: [
      { key: 'revenue.view', label: 'Lihat Pendapatan', description: 'Melihat laporan pendapatan branding.' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    permissions: [
      { key: 'administration.view', label: 'Lihat Administrasi', description: 'Melihat dokumen administrasi branding.' },
      { key: 'administration.upload', label: 'Unggah Administrasi', description: 'Mengunggah dokumen dan foto administrasi.' },
      { key: 'masterData.view', label: 'Lihat Master Data', description: 'Melihat konfigurasi master data.' },
      { key: 'masterData.edit', label: 'Kelola Master Data', description: 'Mengubah nilai dropdown master data.' },
      { key: 'pricelist.view', label: 'Lihat Pricelist', description: 'Melihat konfigurasi harga branding.' },
      { key: 'pricelist.edit', label: 'Kelola Pricelist', description: 'Mengubah harga dan pengaturan PPN.' },
    ],
  },
  {
    title: 'DOCUMENTS',
    permissions: [
      { key: 'surat.view', label: 'Lihat Dokumen', description: 'Mengakses alur surat operasional.' },
      { key: 'surat.create', label: 'Buat Dokumen', description: 'Menyusun dan membuat surat operasional.' },
    ],
  },
  {
    title: 'USER MANAGEMENT',
    permissions: [
      { key: 'users.view', label: 'Lihat Akun', description: 'Melihat daftar akun dan role.' },
      { key: 'users.manage', label: 'Kelola Akun', description: 'Mengelola role, status, dan akses akun.' },
    ],
  },
];
const CATEGORY_NAMES = {
  trayek: 'Trayek',
  busTypes: 'Tipe Bus',
  brandingTypes: 'Jenis Branding',
  jalur: 'Jalur',
};

let db;
let user;
let access;
let roleRecords = [];
let masterData = null;
let selectedCategory = 'trayek';
let pricingConfig = null;
let selectedAccessUid = '';
let initialAccessSelectionPending = true;
let pendingAccessPermissions = new Set();
let deleteManagedUser = null;
let deletionInProgress = false;
let accessSaveInProgress = false;
let presenceByUid = new Map();
let presenceAvailable = false;
let accountActiveByUid = new Map();
let accountStatusAvailable = false;
let stopWatchingPresence = null;

function dataDefaults() {
  const dashboardData = window.__brandingDashboardData || {};
  const buses = Array.isArray(dashboardData.buses) ? dashboardData.buses : [];
  const brandings = Array.isArray(dashboardData.brandings) ? dashboardData.brandings : [];
  return {
    values: {
      busTypes: [...new Set(buses.map((bus) => String(bus.tipeBus || '').trim()).filter(Boolean))]
        .map((value) => ({ value, active: true })),
      brandingTypes: [...new Set([...(window.__brandingMasterDefaults?.brandingTypes || []), ...brandings.map((item) => item.jenisBranding).filter(Boolean)])]
        .map((value) => ({ value, active: true })),
      jalur: [...new Set(buses.map((bus) => String(bus.jalurBus || '').trim()).filter(Boolean))]
        .map((value) => ({ value, active: true })),
    },
    trayekActive: {},
  };
}

function normalizeMasterData(stored = {}) {
  const defaults = dataDefaults();
  const values = {};
  Object.keys(defaults.values).forEach((category) => {
    const saved = stored.values?.[category];
    values[category] = Array.isArray(saved)
      ? saved.filter((entry) => entry && String(entry.value || '').trim())
        .map((entry) => ({ value: String(entry.value).trim(), active: entry.active !== false }))
      : defaults.values[category];
  });
  return { values, trayekActive: stored.trayekActive || {} };
}

function activeValues(category) {
  if (category === 'trayek') {
    return TRAYEK_MASTER
      .filter((item) => masterData?.trayekActive?.[item.code] !== false)
      .map((item) => item.code);
  }
  return (masterData?.values?.[category] || [])
    .filter((item) => item.active)
    .map((item) => item.value);
}

function showNotice(message, isError = false) {
  const notice = $('#app-notice');
  if (!notice) return;
  notice.textContent = message;
  notice.className = `app-notice is-visible${isError ? ' is-error' : ''}`;
  clearTimeout(notice._adminConfigTimeout);
  notice._adminConfigTimeout = setTimeout(() => { notice.className = 'app-notice'; }, 5000);
}

async function loadAccounts() {
  if (!can('users.view')) return;
  const snapshot = await getDocs(collection(db, 'userRoles'));
  roleRecords = snapshot.docs.map((entry) => ({ ...entry.data(), uid: entry.id }))
    .sort((a, b) => String(a.email || a.uid).localeCompare(String(b.email || b.uid), 'id'));
  renderAccounts();
  renderAccessSelector();
}

function getAccountPresenceStatus(account) {
  const active = accountStatusAvailable
    ? accountActiveByUid.get(account.uid) === true
    : account.active;
  return getPresenceStatus({
    active,
    lastSeen: presenceByUid.get(account.uid),
    available: presenceAvailable && accountStatusAvailable,
  });
}

function updatePresenceIndicator(element, account) {
  const status = getAccountPresenceStatus(account);
  const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Unknown';
  element.className = `admin-presence is-${status}`;
  element.setAttribute('aria-label', label);
  element.title = label;
  element.querySelector('.admin-presence-label').textContent = label;
}

function updatePresenceIndicators(nextPresence, available, nextAccountActivity, accountActivityAvailable) {
  if (nextPresence instanceof Map) presenceByUid = nextPresence;
  if (typeof available === 'boolean') presenceAvailable = available;
  if (nextAccountActivity instanceof Map) accountActiveByUid = nextAccountActivity;
  if (typeof accountActivityAvailable === 'boolean') accountStatusAvailable = accountActivityAvailable;
  document.querySelectorAll('#admin-users-body [data-presence-uid]').forEach((element) => {
    const account = roleRecords.find((entry) => entry.uid === element.dataset.presenceUid);
    if (account) updatePresenceIndicator(element, account);
  });
}

function getPresenceIndicator(account) {
  const status = getAccountPresenceStatus(account);
  const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Unknown';
  return `<span class="admin-presence is-${status}" data-presence-uid="${escapeHtml(account.uid)}" role="img" aria-label="${label}" title="${label}"><span class="admin-presence-dot" aria-hidden="true"></span><span class="admin-presence-label">${label}</span></span>`;
}

function showAccountLoadError(error) {
  console.error('Gagal membaca daftar akun:', error);
  const message = error?.code === 'permission-denied'
    ? 'Firestore menolak akses daftar role akun. Pastikan akun aktif memiliki izin users.view dan Firestore Rules yang terdeploy mengizinkan pembacaan userRoles.'
    : error?.code === 'unauthenticated'
      ? 'Sesi Firebase tidak terautentikasi. Keluar dan masuk kembali sebelum memuat daftar akun.'
      : 'Daftar akun gagal dimuat. Periksa koneksi Firebase, lalu coba muat ulang.';
  const body = $('#admin-users-body');
  if (body) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(message)}</td></tr>`;
  }
}

async function refreshAccounts() {
  try {
    await loadAccounts();
  } catch (error) {
    showAccountLoadError(error);
  }
}

function renderAccounts() {
  const body = $('#admin-users-body');
  if (!body) return;
  if (!roleRecords.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">Belum ada akun ber-role yang terdaftar.</td></tr>';
  } else {
    body.innerHTML = roleRecords.map((account, index) => {
      const isCurrentAccount = account.uid === user.uid;
      const editButton = `<button type="button" class="action-button" data-account-edit="${escapeHtml(account.uid)}" ${can('users.manage') ? '' : 'disabled'}>Edit</button>`;
      const deleteAction = isCurrentAccount
        ? '<span class="admin-current-account">Akun Anda</span>'
        : can('users.manage')
          ? `<button type="button" class="action-button danger" data-account-delete="${escapeHtml(account.uid)}" ${deleteManagedUser ? '' : 'disabled title="Callable Function penghapusan akun belum dikonfigurasi."'}>Hapus</button>`
          : '—';
      return `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(account.displayName || '—')}</td>
        <td>${escapeHtml(account.email || '—')}</td>
        <td>${escapeHtml(ROLE_LABELS[account.role] || account.role || '—')}</td>
        <td>${escapeHtml(getAccountStatusLabel(account))}</td>
        <td>${escapeHtml(account.updatedAt?.toDate?.().toLocaleString('id-ID') || '—')}</td>
        <td class="admin-account-actions">${editButton}${deleteAction}</td>
        <td>${getPresenceIndicator(account)}</td>
      </tr>`;
    }).join('');
  }
  const note = $('#admin-account-note');
  if (note) {
    const baseMessage = can('users.manage')
      ? 'Daftar menampilkan akun yang memiliki dokumen userRoles. Pembuatan akun Auth tetap melalui proses administrator yang aman.'
      : 'Anda dapat melihat role akun. Perubahan memerlukan izin users.manage atau Super Admin.';
    note.textContent = can('users.manage') && !deleteManagedUser
      ? `${baseMessage} Penghapusan Firebase Authentication dinonaktifkan sampai Callable Function tepercaya dikonfigurasi.`
      : baseMessage;
  }
}

function getAccountStatusLabel(account) {
  if (account.active === false) return 'Inactive';
  if (account.active === undefined || account.active === true) return 'Active';
  return 'Invalid';
}

function renderAccessSelector() {
  const selector = $('#admin-access-account');
  if (!selector) return;
  if (!roleRecords.some((account) => account.uid === selectedAccessUid)) selectedAccessUid = '';
  if (!selectedAccessUid && initialAccessSelectionPending
    && roleRecords.some((account) => account.uid === user.uid)) {
    selectedAccessUid = user.uid;
  }
  initialAccessSelectionPending = false;
  selector.innerHTML = `<option value="">Pilih akun</option>${roleRecords.map((account) => (
    `<option value="${escapeHtml(account.uid)}">${escapeHtml(account.displayName || account.email || account.uid)}${account.email && account.displayName ? ` · ${escapeHtml(account.email)}` : ''}</option>`
  )).join('')}`;
  selector.value = selectedAccessUid;
  const account = roleRecords.find((entry) => entry.uid === selectedAccessUid);
  pendingAccessPermissions = new Set(Array.isArray(account?.permissions)
    ? account.permissions.filter((permission) => typeof permission === 'string')
    : []);
  renderAccessDetails();
}

function renderAccessDetails() {
  const details = $('#admin-access-details');
  const emptyState = $('#admin-access-empty');
  const account = roleRecords.find((entry) => entry.uid === selectedAccessUid);
  if (!details || !emptyState) return;
  if (!account) {
    details.hidden = true;
    emptyState.hidden = false;
    $('#admin-access-actions').hidden = true;
    return;
  }

  details.hidden = false;
  emptyState.hidden = true;
  $('#admin-selected-account-name').textContent = account.displayName || '—';
  $('#admin-selected-account-email').textContent = account.email || '—';
  $('#admin-selected-account-role').textContent = ROLE_LABELS[account.role] || account.role || '—';
  $('#admin-selected-account-active').textContent = getAccountStatusLabel(account);
  $('#admin-selected-account-status').textContent = getAccountStatusLabel(account).toUpperCase();
  $('#admin-selected-account-status').classList.toggle('is-inactive', account.active === false);

  const isSuperadmin = account.role === 'superadmin';
  const rolePermissions = getRolePermissions(account.role);
  const rolePermissionSet = new Set(rolePermissions);
  const permissionGroups = $('#admin-permission-groups');
  permissionGroups.innerHTML = PERMISSION_GROUPS.map((group) => `
    <section class="admin-permission-group" aria-label="${escapeHtml(group.title)}">
      <h4>${escapeHtml(group.title)}</h4>
      ${group.permissions.map((permission) => {
        const isRoleDerived = isSuperadmin || rolePermissionSet.has(permission.key);
        const isChecked = isRoleDerived || pendingAccessPermissions.has(permission.key);
        const protectCurrentManager = account.uid === user.uid
          && permission.key === 'users.manage'
          && can('users.manage');
        const isDisabled = !can('users.manage') || isRoleDerived || protectCurrentManager || accessSaveInProgress;
        return `<label class="admin-permission-row">
          <input type="checkbox" data-admin-access-permission="${escapeHtml(permission.key)}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} />
          <span><strong>${escapeHtml(permission.label)}</strong><small>${escapeHtml(permission.description)}</small></span>
          <span class="admin-permission-source">${isRoleDerived ? (isSuperadmin ? 'Otomatis' : 'Role') : (protectCurrentManager ? 'Akun Anda' : (pendingAccessPermissions.has(permission.key) ? 'Khusus akun' : 'Opsional'))}</span>
        </label>`;
      }).join('')}
    </section>
  `).join('');
  $('#admin-superadmin-notice').hidden = !isSuperadmin;
  const accessSource = isSuperadmin
    ? 'Wildcard role superadmin (*). Tidak ada permission redundan yang disimpan.'
    : `Izin bawaan role ${ROLE_LABELS[account.role] || account.role || 'tidak valid'} ditambah permission khusus akun.`;
  $('#admin-access-source').textContent = getAccountStatusLabel(account) !== 'Active'
    ? `${accessSource} Status akun tidak aktif/valid, sehingga izin ini tidak dapat digunakan.`
    : accessSource;
  $('#admin-access-actions').hidden = isSuperadmin || !can('users.manage');
  updateAccessSaveButton();
}

function getPendingAccessPermissions() {
  const account = roleRecords.find((entry) => entry.uid === selectedAccessUid);
  if (!account || account.role === 'superadmin') return [];
  const rolePermissionSet = new Set(getRolePermissions(account.role));
  const nextPermissions = new Set(Array.isArray(account.permissions)
    ? account.permissions.filter((permission) => typeof permission === 'string')
    : []);
  PERMISSION_GROUPS.flatMap((group) => group.permissions).forEach(({ key }) => {
    if (rolePermissionSet.has(key)) return;
    const checkbox = $(`[data-admin-access-permission="${key}"]`);
    if (checkbox?.checked) nextPermissions.add(key);
    else nextPermissions.delete(key);
  });
  return [...nextPermissions];
}

function accessPermissionsChanged() {
  const account = roleRecords.find((entry) => entry.uid === selectedAccessUid);
  if (!account) return false;
  const current = Array.isArray(account.permissions)
    ? account.permissions.filter((permission) => typeof permission === 'string')
    : [];
  const next = getPendingAccessPermissions();
  return current.length !== next.length || current.some((permission) => !next.includes(permission));
}

function updateAccessSaveButton() {
  const button = $('#admin-access-save');
  if (button) button.disabled = accessSaveInProgress || !accessPermissionsChanged();
}

function openAccountForm(uid = '') {
  if (!can('users.manage')) return;
  const form = $('#admin-user-form');
  const account = roleRecords.find((entry) => entry.uid === uid);
  form.reset();
  form.elements.uid.value = account?.uid || '';
  form.elements.uid.readOnly = Boolean(account);
  form.elements.displayName.value = account?.displayName || '';
  form.elements.email.value = account?.email || '';
  form.elements.role.value = account?.role || 'viewer';
  form.elements.active.checked = account?.active !== false;
  $('#admin-user-dialog-title').textContent = account ? 'Edit Akun & Akses' : 'Daftarkan Akun yang Ada';
  $('#admin-user-error').textContent = '';
  $('#admin-user-dialog').showModal();
}

async function saveAccount(event) {
  event.preventDefault();
  if (!can('users.manage')) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const uid = String(formData.get('uid') || '').trim();
  const role = String(formData.get('role') || '');
  const existing = roleRecords.find((entry) => entry.uid === uid);
  const error = $('#admin-user-error');
  if (!uid || !ROLES.includes(role)) {
    error.textContent = 'UID Firebase dan role yang valid wajib diisi.';
    return;
  }
  if (role === 'superadmin' && access.role !== 'superadmin') {
    error.textContent = 'Hanya Super Admin yang dapat menetapkan role Super Admin.';
    return;
  }
  if (uid === user.uid && (role !== access.role || !form.elements.active.checked)) {
    error.textContent = 'Anda tidak dapat menurunkan role atau menonaktifkan akun yang sedang digunakan.';
    return;
  }
  try {
    await setDoc(doc(db, 'userRoles', uid), {
      role,
      email: String(formData.get('email') || '').trim(),
      displayName: String(formData.get('displayName') || '').trim(),
      active: form.elements.active.checked,
      updatedAt: serverTimestamp(),
      updatedBy: user.email || user.uid,
      ...(existing?.permissions ? { permissions: existing.permissions } : {}),
    }, { merge: true });
    $('#admin-user-dialog').close();
    await loadAccounts();
    showNotice('Akses akun berhasil diperbarui.');
  } catch (saveError) {
    console.error('Gagal menyimpan akses akun:', saveError);
    error.textContent = 'Gagal menyimpan. Periksa Firestore Rules dan izin users.manage.';
  }
}

async function saveAccessPermissions() {
  const account = roleRecords.find((entry) => entry.uid === selectedAccessUid);
  if (!account || account.role === 'superadmin' || !can('users.manage') || accessSaveInProgress) return;
  const saveButton = $('#admin-access-save');
  const cancelButton = $('#admin-access-cancel');
  accessSaveInProgress = true;
  saveButton.disabled = true;
  cancelButton.disabled = true;
  renderAccessDetails();
  try {
    await updateDoc(doc(db, 'userRoles', account.uid), {
      permissions: getPendingAccessPermissions(),
      updatedAt: serverTimestamp(),
      updatedBy: user.email || user.uid,
    });
    await loadAccounts();
    showNotice('Akses khusus akun berhasil diperbarui.');
  } catch (error) {
    console.error('Gagal menyimpan permission akun:', error);
    showNotice('Akses gagal disimpan. Periksa Firestore Rules dan izin users.manage.', true);
  } finally {
    accessSaveInProgress = false;
    renderAccessDetails();
  }
}

function openDeleteConfirmation(uid) {
  if (!can('users.manage') || !deleteManagedUser || deletionInProgress) return;
  const account = roleRecords.find((entry) => entry.uid === uid);
  if (!account || account.uid === user.uid) return;
  $('#admin-delete-user-name').textContent = account.displayName || '—';
  $('#admin-delete-user-email').textContent = account.email || '—';
  $('#admin-delete-user-role').textContent = ROLE_LABELS[account.role] || account.role || '—';
  $('#admin-delete-user-error').textContent = '';
  $('#admin-delete-user-dialog').dataset.uid = account.uid;
  $('#admin-delete-user-dialog').showModal();
}

function getDeleteErrorMessage(error) {
  const messages = {
    'functions/unauthenticated': 'Sesi Firebase tidak valid. Masuk kembali lalu coba lagi.',
    'functions/permission-denied': 'Backend menolak penghapusan. Pastikan akun aktif memiliki users.manage.',
    'functions/failed-precondition': error.message || 'Akun ini tidak dapat dihapus.',
    'functions/not-found': 'Akun atau dokumen role tidak ditemukan.',
    'functions/unavailable': 'Backend penghapusan belum tersedia. Coba lagi setelah Callable Function aktif.',
  };
  return messages[error?.code] || 'Penghapusan akun gagal. Periksa notifikasi dan log backend.';
}

async function deleteAccount(event) {
  event.preventDefault();
  const dialog = $('#admin-delete-user-dialog');
  const uid = dialog.dataset.uid;
  if (!uid || uid === user.uid || !can('users.manage') || !deleteManagedUser || deletionInProgress) return;

  deletionInProgress = true;
  const submitButton = $('#admin-delete-user-submit');
  const closeButtons = dialog.querySelectorAll('[data-admin-delete-close]');
  submitButton.disabled = true;
  closeButtons.forEach((button) => { button.disabled = true; });
  $('#admin-delete-user-error').textContent = '';
  try {
    await deleteManagedUser({ uid });
    roleRecords = roleRecords.filter((account) => account.uid !== uid);
    if (selectedAccessUid === uid) selectedAccessUid = '';
    renderAccounts();
    renderAccessSelector();
    dialog.close();
    showNotice('Akun berhasil dihapus dari Firebase Authentication dan userRoles.');
    await refreshAccounts();
  } catch (error) {
    console.error('Gagal menghapus akun:', {
      uid,
      code: error?.code || 'unknown',
      message: error?.message || String(error),
    });
    await refreshAccounts();
    $('#admin-delete-user-error').textContent = getDeleteErrorMessage(error);
  } finally {
    deletionInProgress = false;
    submitButton.disabled = false;
    closeButtons.forEach((button) => { button.disabled = false; });
  }
}

function setAdminAccountTab(tabName, focusTab = false) {
  const activeTab = document.querySelector(`[data-admin-account-tab="${tabName}"]`);
  if (!activeTab) return;
  document.querySelectorAll('[data-admin-account-tab]').forEach((tab) => {
    const isActive = tab === activeTab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  $('#admin-accounts-panel').hidden = tabName !== 'accounts';
  $('#admin-access-panel').hidden = tabName !== 'access';
  if (focusTab) activeTab.focus();
}

function handleAdminAccountTabKeydown(event) {
  const tabs = [...document.querySelectorAll('[data-admin-account-tab]')];
  const currentIndex = tabs.indexOf(event.target);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else return;
  event.preventDefault();
  setAdminAccountTab(tabs[nextIndex].dataset.adminAccountTab, true);
}

function handleAccessPermissionChange(event) {
  const checkbox = event.target.closest('[data-admin-access-permission]');
  const account = roleRecords.find((entry) => entry.uid === selectedAccessUid);
  if (!checkbox || !account || account.role === 'superadmin' || !can('users.manage')) return;
  const key = checkbox.dataset.adminAccessPermission;
  if (getRolePermissions(account.role).includes(key)) return;
  if (checkbox.checked) pendingAccessPermissions.add(key);
  else pendingAccessPermissions.delete(key);
  updateAccessSaveButton();
  const source = checkbox.closest('.admin-permission-row')?.querySelector('.admin-permission-source');
  if (source) source.textContent = checkbox.checked ? 'Khusus akun' : 'Opsional';
}

function cancelAccessPermissionChanges() {
  const account = roleRecords.find((entry) => entry.uid === selectedAccessUid);
  pendingAccessPermissions = new Set(Array.isArray(account?.permissions)
    ? account.permissions.filter((permission) => typeof permission === 'string')
    : []);
  renderAccessDetails();
}

function renderMasterData() {
  const tableBody = $('#admin-master-data-body');
  const title = $('#admin-master-data-category-title');
  const addForm = $('#admin-master-data-form');
  if (!tableBody) return;
  title.textContent = CATEGORY_NAMES[selectedCategory];
  const isTrayek = selectedCategory === 'trayek';
  addForm.hidden = isTrayek || !can('masterData.edit');
  const rows = isTrayek
    ? TRAYEK_MASTER.map((entry) => ({
      value: entry.code,
      label: entry.name,
      active: masterData?.trayekActive?.[entry.code] !== false,
    }))
    : (masterData?.values?.[selectedCategory] || []).map((entry) => ({
      value: entry.value,
      label: entry.value,
      active: entry.active,
    }));
  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada nilai master data.</td></tr>';
    return;
  }
  tableBody.innerHTML = rows.map((entry) => `<tr>
    <td>${escapeHtml(entry.value)}</td>
    <td>${escapeHtml(entry.label)}</td>
    <td>${entry.active ? 'Active' : 'Inactive'}</td>
    <td>${can('masterData.edit')
      ? `<button type="button" class="action-button" data-master-edit="${escapeHtml(entry.value)}" ${isTrayek ? 'disabled title="Nama trayek dikelola oleh mapping pusat"' : ''}>Edit</button>
        <button type="button" class="action-button" data-master-toggle="${escapeHtml(entry.value)}">${entry.active ? 'Nonaktifkan' : 'Aktifkan'}</button>`
      : '—'}</td>
  </tr>`).join('');
}

async function saveMasterData() {
  await setDoc(doc(db, 'appConfig', 'masterData'), {
    ...masterData,
    updatedAt: serverTimestamp(),
    updatedBy: user.email || user.uid,
  }, { merge: true });
  window.__adminMasterData = masterData;
  window.getAdminMasterDataValues = activeValues;
  window.refreshAdminManagedDropdowns?.();
}

async function loadMasterData() {
  const snapshot = await getDoc(doc(db, 'appConfig', 'masterData'));
  masterData = normalizeMasterData(snapshot.exists() ? snapshot.data() : {});
  window.__adminMasterData = masterData;
  window.getAdminMasterDataValues = activeValues;
  window.refreshAdminManagedDropdowns?.();
  if (can('masterData.view')) renderMasterData();
}

async function handleMasterDataClick(event) {
  if (!can('masterData.edit')) return;
  const toggle = event.target.closest('[data-master-toggle]');
  const edit = event.target.closest('[data-master-edit]');
  try {
    if (toggle && selectedCategory === 'trayek') {
      const code = toggle.dataset.masterToggle;
      masterData.trayekActive[code] = masterData.trayekActive[code] === false;
    } else if (toggle) {
      const entry = masterData.values[selectedCategory].find((item) => item.value === toggle.dataset.masterToggle);
      if (entry) entry.active = !entry.active;
    } else if (edit) {
      const entry = masterData.values[selectedCategory].find((item) => item.value === edit.dataset.masterEdit);
      const nextValue = window.prompt('Nama nilai master data', entry?.value || '');
      if (!entry || nextValue === null) return;
      const normalized = nextValue.trim();
      if (!normalized) { showNotice('Nilai tidak boleh kosong.', true); return; }
      if (masterData.values[selectedCategory].some((item) => item !== entry && item.value.toLowerCase() === normalized.toLowerCase())) {
        showNotice('Nilai tersebut sudah ada.', true);
        return;
      }
      entry.value = normalized;
    } else {
      return;
    }
    await saveMasterData();
    renderMasterData();
    showNotice('Master data berhasil diperbarui.');
  } catch (error) {
    console.error('Gagal memperbarui master data:', error);
    showNotice('Master data gagal disimpan. Periksa Firestore Rules.', true);
  }
}

async function addMasterData(event) {
  event.preventDefault();
  if (!can('masterData.edit') || selectedCategory === 'trayek') return;
  const input = $('#admin-master-data-value');
  const value = input.value.trim();
  if (!value) return;
  const entries = masterData.values[selectedCategory];
  if (entries.some((entry) => entry.value.toLowerCase() === value.toLowerCase())) {
    showNotice('Nilai tersebut sudah ada.', true);
    return;
  }
  entries.push({ value, active: true });
  try {
    await saveMasterData();
    input.value = '';
    renderMasterData();
    showNotice('Nilai master data berhasil ditambahkan.');
  } catch (error) {
    entries.pop();
    console.error('Gagal menambahkan master data:', error);
    showNotice('Nilai gagal disimpan. Periksa Firestore Rules.', true);
  }
}

async function loadPricing() {
  const snapshot = await getDoc(doc(db, 'appConfig', 'brandingPricing'));
  pricingConfig = snapshot.exists() ? snapshot.data() : null;
  window.__brandingPricingVersion = Number(pricingConfig?.version || 0);
  window.__brandingPricingShared = Boolean(pricingConfig);
  if (pricingConfig) {
    window.applyBrandingPricingConfiguration?.(pricingConfig);
    $('#admin-pricing-status').textContent = `Pricelist bersama versi ${pricingConfig.version || 1}. Terakhir diperbarui ${pricingConfig.updatedAt?.toDate?.().toLocaleString('id-ID') || '—'}.`;
  } else {
    $('#admin-pricing-status').textContent = 'Pricelist bersama belum dibuat. Simpan harga saat ini untuk menjadikannya konfigurasi bersama.';
  }
}

async function savePricing(priceList, ppn) {
  if (!can('pricelist.edit')) throw new Error('Anda tidak memiliki izin mengubah pricelist.');
  const nextVersion = Number(pricingConfig?.version || 0) + 1;
  const next = {
    priceList,
    ppn,
    version: nextVersion,
    updatedAt: serverTimestamp(),
    updatedBy: user.email || user.uid,
  };
  await setDoc(doc(db, 'appConfig', 'brandingPricing'), next);
  pricingConfig = { ...next, updatedAt: null };
  window.__brandingPricingVersion = nextVersion;
  window.__brandingPricingShared = true;
  window.applyBrandingPricingConfiguration?.({ ...next, updatedAt: null });
  const status = $('#admin-pricing-status');
  if (status) status.textContent = `Pricelist bersama versi ${nextVersion} berhasil disimpan.`;
}

export async function initialiseAdminConfig(firestore, currentUser, currentAccess, app) {
  db = firestore;
  user = currentUser;
  access = currentAccess;
  deleteManagedUser = adminBackendConfig.accountDeletionEnabled && app
    ? httpsCallable(getFunctions(app, adminBackendConfig.functionsRegion), 'deleteManagedUser')
    : null;
  window.saveBrandingPricingConfiguration = savePricing;
  const canEditPricing = can('pricelist.edit');
  const priceSaveButton = $('#save-brand-pricing');
  if (priceSaveButton) priceSaveButton.disabled = !canEditPricing;
  document.querySelectorAll('#pricing-table-body input, #ppn-enabled, #ppn-percent').forEach((input) => {
    input.disabled = !canEditPricing;
  });
  if (can('users.view')) {
    stopWatchingPresence?.();
    stopWatchingPresence = watchPresence(db, updatePresenceIndicators);
    await refreshAccounts();
    $('#admin-users-refresh')?.addEventListener('click', refreshAccounts);
    $('#admin-user-add')?.addEventListener('click', () => openAccountForm());
    $('#admin-users-body')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-account-edit]');
      const deleteButton = event.target.closest('[data-account-delete]');
      if (button) openAccountForm(button.dataset.accountEdit);
      else if (deleteButton) openDeleteConfirmation(deleteButton.dataset.accountDelete);
    });
    $('#admin-user-form')?.addEventListener('submit', saveAccount);
    $('#admin-delete-user-form')?.addEventListener('submit', deleteAccount);
    document.querySelectorAll('[data-admin-user-close]').forEach((button) => {
      button.addEventListener('click', () => $('#admin-user-dialog').close());
    });
    document.querySelectorAll('[data-admin-delete-close]').forEach((button) => {
      button.addEventListener('click', () => $('#admin-delete-user-dialog').close());
    });
    document.querySelectorAll('[data-admin-account-tab]').forEach((button) => {
      button.addEventListener('click', () => setAdminAccountTab(button.dataset.adminAccountTab));
      button.addEventListener('keydown', handleAdminAccountTabKeydown);
    });
    $('#admin-access-account')?.addEventListener('change', (event) => {
      selectedAccessUid = event.currentTarget.value;
      renderAccessSelector();
    });
    $('#admin-permission-groups')?.addEventListener('change', handleAccessPermissionChange);
    $('#admin-access-cancel')?.addEventListener('click', cancelAccessPermissionChanges);
    $('#admin-access-save')?.addEventListener('click', saveAccessPermissions);
  }
  try {
    await loadMasterData();
  } catch (error) {
    if (can('masterData.view')) {
      console.error('Gagal membaca master data:', error);
      $('#admin-master-data-body').innerHTML = '<tr><td colspan="4" class="empty-state">Master data tidak dapat dimuat. Periksa Firestore Rules.</td></tr>';
    }
    console.error('Gagal memuat konfigurasi dropdown master data:', error);
    showNotice('Konfigurasi dropdown tidak dapat dimuat. Periksa Firestore Rules.', true);
  }
  if (can('masterData.view')) {
    $('#admin-master-data-category')?.addEventListener('change', (event) => {
      selectedCategory = event.target.value;
      renderMasterData();
    });
    $('#admin-master-data-body')?.addEventListener('click', handleMasterDataClick);
    $('#admin-master-data-form')?.addEventListener('submit', addMasterData);
  }
  try {
    await loadPricing();
  } catch (error) {
    window.__brandingPricingShared = false;
    console.error('Gagal membaca pricelist bersama:', error);
    $('#admin-pricing-status').textContent = 'Pricelist bersama gagal dimuat. Terapkan Firestore Rules terbaru sebelum menyimpan perubahan harga.';
    showNotice('Pricelist bersama gagal dimuat. Periksa Firestore Rules.', true);
  }
  if (!can('users.manage')) {
    $('#admin-user-add')?.setAttribute('hidden', '');
  }
  if (!can('masterData.edit')) {
    $('#admin-master-data-form')?.setAttribute('hidden', '');
  }
}
