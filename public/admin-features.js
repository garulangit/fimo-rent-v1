/**
 * admin-features.js
 * Kelengkapan Administrasi Branding — fitur baru, terpisah dari data-features.js
 *
 * Struktur Firestore:
 *   brandAdmins/{brandId}
 *     .namaBrand, .namaPT, .createdAt
 *     .dokumen.{pks|invoice|buktiTransfer|kwitansi|fakturPajak}
 *       .storageRef, .downloadURL, .fileName, .uploadedAt, .uploadedBy
 *
 *   brandAdmins/{brandId}/fotoBranding/{noPolisi}
 *     .storageRef, .downloadURL, .fileName, .uploadedAt, .uploadedBy
 *
 *   userRoles/{uid}  →  { role: 'admin' | 'operator' | 'viewer' }
 *
 * Supabase Storage paths:
 *   brands/{brandId}/administrasi/{docKey}/{filename}
 *   brands/{brandId}/foto-branding/{noPolisi}/{filename}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { supabase, BUCKET_NAME } from './supabase.js';
import { brandingPeriod, filterAdminPeriodGroups, groupAdminPeriods } from './admin-period-grouping.js';

// ============================================================
// MODULE STATE
// ============================================================
let db;
let auth;
let currentUserRole = 'viewer';
let adminEventsBound = false;

let brandings = [];
let buses = [];
let brandGroups = [];
let adminSearch = '';
const currentDate = new Date();
const expandedAdminYears = new Set([currentDate.getFullYear()]);
const expandedAdminMonths = new Set([`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`]);

let activeBrandId = null;
let activeBrandData = null;
let activeBusNoPolisi = [];
let activeFotoMap = new Map();

const DOC_KEYS = ['pks', 'invoice', 'buktiTransfer', 'kwitansi', 'fakturPajak'];
const DOC_LABELS = {
  pks: 'Perjanjian Kerja Sama',
  invoice: 'Invoice',
  buktiTransfer: 'Bukti Transfer',
  kwitansi: 'Kwitansi',
  fakturPajak: 'Faktur Pajak',
};
const DOC_STORAGE_PATHS = {
  pks: 'administrasi/pks',
  invoice: 'administrasi/invoice',
  buktiTransfer: 'administrasi/bukti-transfer',
  kwitansi: 'administrasi/kwitansi',
  fakturPajak: 'administrasi/faktur-pajak',
};

export const DOCUMENT_UPLOAD_LIMITS = {
  pks: {
    maxBytes: 2 * 1024 * 1024,
    label: 'Perjanjian Kerja Sama',
    maxLabel: '2 MB',
    errorMessage: 'Ukuran file Perjanjian Kerja Sama maksimal 2 MB.',
    hint: 'PDF • Maks. 2 MB',
    isPhoto: false,
  },
  invoice: {
    maxBytes: 500 * 1024,
    label: 'Invoice',
    maxLabel: '500 KB',
    errorMessage: 'Ukuran file Invoice maksimal 500 KB.',
    hint: 'PDF • Maks. 500 KB',
    isPhoto: false,
  },
  buktiTransfer: {
    maxBytes: 500 * 1024,
    label: 'Bukti Transfer',
    maxLabel: '500 KB',
    errorMessage: 'Ukuran file Bukti Transfer maksimal 500 KB.',
    hint: 'PDF • Maks. 500 KB',
    isPhoto: false,
  },
  kwitansi: {
    maxBytes: 500 * 1024,
    label: 'Kwitansi',
    maxLabel: '500 KB',
    errorMessage: 'Ukuran file Kwitansi maksimal 500 KB.',
    hint: 'PDF • Maks. 500 KB',
    isPhoto: false,
  },
  fakturPajak: {
    maxBytes: 500 * 1024,
    label: 'Faktur Pajak',
    maxLabel: '500 KB',
    errorMessage: 'Ukuran file Faktur Pajak maksimal 500 KB.',
    hint: 'PDF • Maks. 500 KB',
    isPhoto: false,
  },
  foto: {
    maxBytes: 500 * 1024,
    label: 'Foto',
    maxLabel: '500 KB',
    errorMessage: 'Ukuran foto maksimal 500 KB.',
    hint: 'JPG / JPEG / PNG • Maks. 500 KB',
    isPhoto: true,
  },
};

const ALLOWED_DOC_TYPES = ['application/pdf'];
const ALLOWED_DOC_EXTS = ['.pdf'];
const ALLOWED_FOTO_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const ALLOWED_FOTO_EXTS = ['.jpg', '.jpeg', '.png'];

// ============================================================
// UTILS
// ============================================================

function makeBrandId(namaBrand, namaPT) {
  const raw = `${(namaBrand || '').trim()}|||${(namaPT || '').trim()}`;
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 80);
}

const escHtml = (text = '') =>
  String(text).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[c]);

const byId = (id) => document.getElementById(id);

function showNoticeAdmin(message, type = 'success') {
  const notice = byId('app-notice');
  if (!notice) return;
  notice.textContent = message;
  notice.className = `app-notice is-visible ${type}`;
  clearTimeout(notice._adminTimeout);
  notice._adminTimeout = setTimeout(() => { notice.className = 'app-notice'; }, 5000);
}

// ============================================================
// ROLE
// ============================================================

async function loadUserRole(uid) {
  const rolePath = `userRoles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'userRoles', uid));
    console.info('[admin-role]', JSON.stringify({ uid, rolePath, exists: snap.exists(), role: snap.data()?.role ?? null }));
    if (snap.exists()) {
      const role = snap.data().role;
      if (['superadmin', 'admin', 'operator', 'viewer'].includes(role)) {
        return role;
      }
      return 'viewer';
    }
    return 'viewer';
  } catch (error) {
    console.info('[admin-role]', JSON.stringify({ uid, rolePath, error: error?.code || error?.message || String(error) }));
    return 'viewer';
  }
}

const isAdmin = () => currentUserRole === 'admin' || currentUserRole === 'superadmin';
const isOperator = () => currentUserRole === 'operator';
const isViewer = () => currentUserRole === 'viewer';
const canUpload = () => isAdmin() || isOperator();
const canEdit = () => canUpload();

// ============================================================
// FILE VALIDATION
// ============================================================

function resolveUploadContentType(file, isPhoto) {
  const type = String(file.type || '').toLowerCase();
  const ext = '.' + String(file.name || '').split('.').pop().toLowerCase();
  if (isPhoto) {
    if (type === 'image/png' || ext === '.png') return 'image/png';
    if (type === 'image/jpeg' || type === 'image/jpg' || ext === '.jpg' || ext === '.jpeg') {
      return type === 'image/jpg' ? 'image/jpg' : 'image/jpeg';
    }
  } else if (type === 'application/pdf' || ext === '.pdf') {
    return 'application/pdf';
  }
  return type || 'application/octet-stream';
}

export function validateFile(file, docKey) {
  // 1. Validate file exists
  if (!file) return 'Tidak ada file yang dipilih.';

  // Determine document type & configuration
  const resolvedKey = typeof docKey === 'boolean'
    ? (docKey ? 'foto' : 'invoice')
    : docKey;
  const config = DOCUMENT_UPLOAD_LIMITS[resolvedKey] || (resolvedKey === 'foto' ? DOCUMENT_UPLOAD_LIMITS.foto : null);
  const isPhoto = Boolean(config?.isPhoto || docKey === 'foto' || docKey === true);

  // 2. Validate file type
  const ext = '.' + String(file.name || '').split('.').pop().toLowerCase();
  if (isPhoto) {
    if (!ALLOWED_FOTO_TYPES.includes(file.type) && !ALLOWED_FOTO_EXTS.includes(ext)) {
      return 'Format tidak didukung. Gunakan JPG, JPEG, atau PNG.';
    }
  } else {
    if (!ALLOWED_DOC_TYPES.includes(file.type) && !ALLOWED_DOC_EXTS.includes(ext)) {
      return 'Format tidak didukung. Gunakan PDF.';
    }
  }

  // 3. Determine maximum size & 4. Validate file.size
  const maxBytes = config ? config.maxBytes : 500 * 1024;
  if (file.size > maxBytes) {
    if (config?.errorMessage) {
      return config.errorMessage;
    }
    return isPhoto
      ? 'Ukuran foto maksimal 500 KB.'
      : `Ukuran file maksimal ${(maxBytes / 1024).toFixed(0)} KB.`;
  }

  return null;
}

// ============================================================
// BRAND GROUPING
// ============================================================

function buildBrandGroups() {
  const groupMap = new Map();
  for (const b of brandings) {
    const namaBrand = (b.namaBrand || b['Nama Brand'] || b.brand || '').trim();
    const namaPT = (b.namaPT || b['Nama PT'] || b.ptName || '').trim();
    if (!namaBrand) continue;
    const brandId = makeBrandId(namaBrand, namaPT);
    const period = brandingPeriod(b);
    const periodKey = `${period.key}::${brandId}`;
    const noPolisi = (b.noPolisi || b['No Polisi'] || '').trim();
    if (!groupMap.has(periodKey)) {
      groupMap.set(periodKey, { brandId, namaBrand, namaPT, period, periodKey, busSet: new Set(), adminDoc: null });
    }
    if (noPolisi) groupMap.get(periodKey).busSet.add(noPolisi);
  }
  return [...groupMap.values()];
}

// ============================================================
// COMPLETION SCORE
// ============================================================

function getCompletionScore(adminDoc, busCount) {
  if (!adminDoc) return { filled: 0, total: 5, fotoFilled: 0, fotoTotal: busCount };
  const dokumen = adminDoc.dokumen || {};
  let filled = 0;
  for (const key of DOC_KEYS) {
    if (dokumen[key] && dokumen[key].storageRef) filled++;
  }
  return {
    filled,
    total: 5,
    fotoFilled: adminDoc._fotoCount || 0,
    fotoTotal: busCount,
  };
}

// ============================================================
// LOAD DATA
// ============================================================

async function loadBrandingsAndBuses() {
  const [busSnap, brandingSnap] = await Promise.all([
    getDocs(collection(db, 'buses')),
    getDocs(collection(db, 'brandings')),
  ]);
  buses = busSnap.docs.map((s) => ({ ...s.data(), noPolisi: s.data().noPolisi || s.id }));
  brandings = brandingSnap.docs.map((s) => ({ ...s.data(), id: s.id }));
}

async function loadAdminDocs(groups) {
  const adminDocs = new Map();
  await Promise.all(
    [...new Set(groups.map((group) => group.brandId))].map(async (brandId) => {
      try {
        const snap = await getDoc(doc(db, 'brandAdmins', brandId));
        if (snap.exists()) {
          const data = snap.data();
          const fotoSnap = await getDocs(
            collection(db, 'brandAdmins', brandId, 'fotoBranding')
          );
          data._fotoCount = fotoSnap.size;
          data._fotoMap = new Map(fotoSnap.docs.map((d) => [d.id, d.data()]));
          adminDocs.set(brandId, data);
        }
      } catch { /* silent */ }
    })
  );
  return groups.map((group) => ({ ...group, adminDoc: adminDocs.get(group.brandId) || null }));
}

// ============================================================
// RENDER TABLE
// ============================================================

function renderAdminTableRows(groups) {
  return [...groups].sort((a, b) => a.namaBrand.localeCompare(b.namaBrand, 'id') || a.namaPT.localeCompare(b.namaPT, 'id'))
    .map((group, i) => {
    const busCount = group.busSet.size;
    const fotoFilled = group.adminDoc?._fotoMap instanceof Map
      ? [...group.adminDoc._fotoMap.keys()].filter((noPolisi) => group.busSet.has(noPolisi)).length
      : group.adminDoc?._fotoCount || 0;
    const adminDoc = group.adminDoc ? { ...group.adminDoc, _fotoCount: fotoFilled } : null;
    const score = getCompletionScore(adminDoc, busCount);
    const pct = score.total > 0 ? score.filled / score.total : 0;
    const badgeClass = pct === 1 ? 'complete' : pct > 0 ? 'partial' : 'empty';

    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(group.namaBrand)}</strong></td>
      <td>${escHtml(group.namaPT || '—')}</td>
      <td><span style="font-weight:700;color:var(--color-primary)">${busCount}</span> bus</td>
      <td>
        <span class="admin-completion-badge ${badgeClass}">${score.filled}/${score.total}</span>
        ${score.fotoTotal > 0
        ? `<br><small style="color:var(--color-ink-muted);font-size:10.5px;margin-top:3px;display:inline-block">&#128247; ${score.fotoFilled}/${score.fotoTotal} bus</small>`
        : ''}
      </td>
      <td class="action-cell">
        <button type="button" class="eye-button" data-admin-action="detail"
          data-brand-id="${escHtml(group.brandId)}"
          data-period-key="${escHtml(group.periodKey)}"
          title="Lihat Detail Administrasi"
          aria-label="Lihat detail administrasi ${escHtml(group.namaBrand)}">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function filterAdminGroups(groups) {
  return filterAdminPeriodGroups(groups, adminSearch);
}

function adminMonthSummary(groups) {
  const busCount = new Set(groups.flatMap((group) => [...group.busSet])).size;
  const brandCount = new Set(groups.map((group) => group.brandId)).size;
  return `${brandCount} Brand | ${busCount} Bus`;
}

function adminPeriodTable(groups) {
  return `<div class="table-wrap admin-period-table-wrap"><table class="admin-period-table">
    <thead><tr><th style="width:48px">No</th><th>Nama Brand</th><th>PT / Company</th><th style="width:110px">Jumlah Bus</th><th style="width:120px">Kelengkapan</th><th style="width:70px">Aksi</th></tr></thead>
    <tbody>${renderAdminTableRows(groups)}</tbody>
  </table></div>`;
}

function renderAdminTable() {
  const container = byId('admin-period-groups');
  if (!container) return;
  const visibleGroups = filterAdminGroups(brandGroups);
  if (!visibleGroups.length) {
    container.innerHTML = `<p class="empty-state admin-period-empty">${brandGroups.length
      ? 'Tidak ada data administrasi yang cocok dengan pencarian.'
      : 'Belum ada data branding. Tambahkan data branding terlebih dahulu.'}</p>`;
    return;
  }

  const { years, undated } = groupAdminPeriods(visibleGroups);
  const yearMarkup = years.map(({ year, months }) => {
    const expanded = expandedAdminYears.has(year);
    const yearGroups = months.flatMap((month) => month.groups);
    const monthMarkup = months.map((month) => {
      const monthExpanded = expandedAdminMonths.has(month.key);
      return `<section class="admin-month-group">
        <button type="button" class="admin-month-toggle" data-admin-month-toggle="${escHtml(month.key)}" aria-expanded="${monthExpanded}">
          <span class="admin-accordion-chevron${monthExpanded ? ' is-expanded' : ''}" aria-hidden="true">▸</span>
          <span class="admin-month-name">${escHtml(month.label)}</span>
          <span class="admin-month-summary">${adminMonthSummary(month.groups)}</span>
        </button>
        ${monthExpanded ? adminPeriodTable(month.groups) : ''}
      </section>`;
    }).join('');
    return `<section class="admin-year-group">
      <button type="button" class="admin-year-toggle" data-admin-year-toggle="${year}" aria-expanded="${expanded}">
        <span class="admin-accordion-chevron${expanded ? ' is-expanded' : ''}" aria-hidden="true">▸</span>
        <span>${year}</span><span class="admin-year-summary">${adminMonthSummary(yearGroups)}</span>
      </button>
      ${expanded ? `<div class="admin-year-months">${monthMarkup}</div>` : ''}
    </section>`;
  }).join('');
  const undatedMarkup = undated.length
    ? `<section class="admin-year-group admin-undated-group">
        <button type="button" class="admin-year-toggle" data-admin-undated-toggle aria-expanded="${expandedAdminYears.has('undated')}">
          <span class="admin-accordion-chevron${expandedAdminYears.has('undated') ? ' is-expanded' : ''}" aria-hidden="true">▸</span>
          <span>Tanggal awal belum tersedia</span><span class="admin-year-summary">${adminMonthSummary(undated)}</span>
        </button>
        ${expandedAdminYears.has('undated') ? adminPeriodTable(undated) : ''}
      </section>`
    : '';
  container.innerHTML = `${yearMarkup}${undatedMarkup}`;
}

// ============================================================
// MODAL OPEN / CLOSE
// ============================================================

async function openAdminModal(brandId, periodKey = '') {
  const group = brandGroups.find((g) => g.brandId === brandId && (!periodKey || g.periodKey === periodKey))
    || brandGroups.find((g) => g.brandId === brandId);
  if (!group) return;

  activeBrandId = brandId;
  activeBrandData = { namaBrand: group.namaBrand, namaPT: group.namaPT };
  activeBusNoPolisi = [...group.busSet];

  const modal = byId('admin-detail-modal');
  if (!modal) return;

  const subtitleEl = byId('admin-modal-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `${group.namaBrand}${group.namaPT ? ' \u2014 ' + group.namaPT : ''}`;
  }

  const errEl = byId('admin-upload-error');
  if (errEl) errEl.textContent = '';

  const busListEl = byId('admin-bus-list');
  if (busListEl) {
    if (!activeBusNoPolisi.length) {
      busListEl.textContent = 'Belum ada bus terkait.';
    } else {
      const parts = activeBusNoPolisi.map((nopol) => {
        const bus = buses.find((b) => b.noPolisi === nopol);
        return bus ? `${bus.jalurBus || '\u2014'}; ${bus.noLamb || nopol}` : nopol;
      });
      busListEl.textContent = parts.join(', ');
    }
  }

  // Load fresh admin doc
  let adminData = null;
  try {
    const snap = await getDoc(doc(db, 'brandAdmins', brandId));
    if (snap.exists()) adminData = snap.data();
  } catch { /* silent */ }

  // Load foto sub-collection
  activeFotoMap = new Map();
  try {
    const fotoSnap = await getDocs(
      collection(db, 'brandAdmins', brandId, 'fotoBranding')
    );
    fotoSnap.docs.forEach((d) => activeFotoMap.set(d.id, d.data()));
  } catch { /* silent */ }

  for (const key of DOC_KEYS) {
    populateDocCard(key, adminData?.dokumen?.[key] || null);
  }
  populateFotoSection(activeBusNoPolisi);

  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.setAttribute('open', '');
}

function closeAdminModal() {
  const modal = byId('admin-detail-modal');
  if (!modal) return;
  if (typeof modal.close === 'function') modal.close();
  else modal.removeAttribute('open');
  activeBrandId = null;
  activeBrandData = null;
}

// ============================================================
// POPULATE CARDS
// ============================================================

function populateDocCard(docKey, dokumen) {
  const statusEl = document.querySelector(`[data-doc-status="${docKey}"]`);
  const actionsEl = document.querySelector(`[data-doc-actions="${docKey}"]`);
  if (!statusEl || !actionsEl) return;

  console.info('[admin-role]', JSON.stringify({ docKey, hasDocument: Boolean(dokumen?.storageRef), currentUserRole, canUpload: canUpload() }));

  if (dokumen && dokumen.storageRef) {
    statusEl.className = 'admin-doc-status has-file';
    statusEl.textContent = 'Ada';
    actionsEl.innerHTML = `
      <button type="button" class="admin-view-btn" data-doc-view="${escHtml(docKey)}">Lihat</button>
      ${canUpload() ? `<button type="button" class="admin-replace-btn" data-doc-replace="${escHtml(docKey)}">Replace</button>` : ''}
    `;
  } else {
    statusEl.className = 'admin-doc-status';
    statusEl.textContent = 'Belum ada dokumen';
    actionsEl.innerHTML = canUpload()
      ? `<button type="button" class="admin-upload-btn" data-doc-upload="${escHtml(docKey)}">&#11014; Upload</button>`
      : '<span style="color:var(--color-ink-muted);font-size:11.5px;">\u2014</span>';
  }
}

function populateFotoSection(busArr) {
  const listEl = byId('admin-foto-bus-list');
  const countEl = byId('admin-foto-count');
  if (!listEl) return;

  if (!busArr.length) {
    listEl.innerHTML = '<p style="color:var(--color-ink-muted);font-size:12px;margin:0">Tidak ada bus terkait brand ini.</p>';
    if (countEl) countEl.textContent = '0/0 Bus';
    return;
  }

  let filled = 0;
  const items = busArr.map((nopol) => {
    const bus = buses.find((b) => b.noPolisi === nopol);
    const label = bus ? `${bus.jalurBus || '\u2014'}; No.Lamb ${bus.noLamb || nopol}` : nopol;
    const fotoDoc = activeFotoMap.get(nopol);

    if (fotoDoc && fotoDoc.storageRef) {
      filled++;
      return `<div class="admin-foto-bus-item" data-bus-nopol="${escHtml(nopol)}">
        <span class="admin-foto-bus-label">${escHtml(label)}</span>
        <span class="admin-foto-status">&#10003; Ada foto</span>
        <div class="admin-foto-bus-actions">
          <button type="button" class="admin-view-btn" data-foto-view="${escHtml(nopol)}">Lihat</button>
          ${canUpload() ? `<button type="button" class="admin-replace-btn" data-foto-replace="${escHtml(nopol)}">Replace</button>` : ''}
        </div>
      </div>`;
    } else {
      return `<div class="admin-foto-bus-item" data-bus-nopol="${escHtml(nopol)}">
        <span class="admin-foto-bus-label">${escHtml(label)}</span>
        <span class="admin-foto-status missing">Belum ada foto</span>
        <div class="admin-foto-bus-actions">
          ${canUpload()
          ? `<button type="button" class="admin-upload-btn" data-foto-upload="${escHtml(nopol)}">&#11014; Upload</button>`
          : '<span style="color:var(--color-ink-muted);font-size:11px;">\u2014</span>'}
        </div>
      </div>`;
    }
  });

  listEl.innerHTML = items.join('');
  if (countEl) countEl.textContent = `${filled}/${busArr.length} Bus`;
}

// ============================================================
// SUPABASE STORAGE OPERATIONS
// ============================================================

async function uploadToStorage(file, storagePath) {
  if (!supabase) {
    throw new Error('Supabase client belum terinisialisasi. Periksa konfigurasi supabase-config.js.');
  }

  const isPhoto = storagePath.includes('/foto-branding/');
  const contentType = resolveUploadContentType(file, isPhoto);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType,
      // Setiap upload memakai nama unik berbasis timestamp. INSERT murni
      // menghindari kebutuhan policy UPDATE/SELECT pada bucket Supabase.
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Bucket admin-files dikonfigurasi public, jadi URL tidak kedaluwarsa.
  const { data: pubData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);
  const downloadURL = pubData?.publicUrl || '';
  if (!downloadURL) {
    throw new Error('URL publik file tidak dapat dibuat. Periksa konfigurasi bucket Supabase.');
  }

  return { downloadURL, storagePath };
}

async function deleteFromStorage(storagePath) {
  if (!supabase || !storagePath) return;
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);
    if (error) {
      console.warn('Gagal menghapus file lama di Supabase Storage:', error.message || error);
    }
  } catch (err) {
    console.warn('Error saat menghapus file lama dari storage:', err);
  }
}

function setModalLoading(loading) {
  const modal = byId('admin-detail-modal');
  if (!modal) return;
  modal.querySelectorAll('button:not(#close-admin-modal)').forEach((b) => {
    b.disabled = loading;
  });
}

function setDocCardLoading(docKey, loading) {
  const actionsEl = document.querySelector(`[data-doc-actions="${docKey}"]`);
  if (!actionsEl) return;
  if (loading) {
    actionsEl.innerHTML = `<span class="admin-upload-progress"><span class="admin-upload-spinner"></span> Mengupload&hellip;</span>`;
    setModalLoading(true);
  } else {
    setModalLoading(false);
  }
}

function setFotoItemLoading(noPolisi, loading) {
  const itemEl = document.querySelector(`.admin-foto-bus-item[data-bus-nopol="${CSS.escape(noPolisi)}"]`);
  if (!itemEl) return;
  const actEl = itemEl.querySelector('.admin-foto-bus-actions');
  if (!actEl) return;
  if (loading) {
    actEl.innerHTML = `<span class="admin-upload-progress"><span class="admin-upload-spinner"></span> Mengupload&hellip;</span>`;
    setModalLoading(true);
  } else {
    setModalLoading(false);
  }
}

async function ensureBrandAdminDoc(brandId, namaBrand, namaPT) {
  const ref_ = doc(db, 'brandAdmins', brandId);
  const snap = await getDoc(ref_);
  if (!snap.exists()) {
    await setDoc(ref_, {
      namaBrand,
      namaPT,
      createdAt: new Date().toISOString(),
      dokumen: {},
    });
  }
  return ref_;
}

async function handleDocUpload(docKey, file, isReplace) {
  const errEl = byId('admin-upload-error');
  if (errEl) errEl.textContent = '';

  const err = validateFile(file, docKey);
  if (err) { if (errEl) errEl.textContent = err; return; }
  if (!activeBrandId || !activeBrandData) return;

  setDocCardLoading(docKey, true);

  try {
    let oldStoragePath = null;
    if (isReplace) {
      const snap = await getDoc(doc(db, 'brandAdmins', activeBrandId));
      oldStoragePath = snap.data()?.dokumen?.[docKey]?.storageRef || null;
    }

    await ensureBrandAdminDoc(activeBrandId, activeBrandData.namaBrand, activeBrandData.namaPT);

    const ext = file.name.split('.').pop().toLowerCase();
    const ts = Date.now();
    const storagePath = `brands/${activeBrandId}/${DOC_STORAGE_PATHS[docKey]}/${ts}_${docKey}.${ext}`;
    const { downloadURL } = await uploadToStorage(file, storagePath);

    const adminRef = doc(db, 'brandAdmins', activeBrandId);
    await updateDoc(adminRef, {
      [`dokumen.${docKey}`]: {
        storageRef: storagePath,
        downloadURL,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: auth.currentUser?.email || 'unknown',
      },
    });

    if (isReplace && oldStoragePath && oldStoragePath !== storagePath) {
      await deleteFromStorage(oldStoragePath);
    }

    // Refresh card
    const updatedSnap = await getDoc(doc(db, 'brandAdmins', activeBrandId));
    const updatedData = updatedSnap.data();
    updatedData._fotoMap = activeFotoMap;
    updatedData._fotoCount = activeFotoMap.size;
    populateDocCard(docKey, updatedData?.dokumen?.[docKey] || null);

    // Update group admin doc for table
    brandGroups.filter((group) => group.brandId === activeBrandId).forEach((group) => {
      group.adminDoc = updatedData;
    });
    renderAdminTable();

    showNoticeAdmin(`${DOC_LABELS[docKey]} berhasil diupload.`);
  } catch (error) {
    console.error('Upload gagal:', error);
    if (errEl) errEl.textContent = `Upload gagal: ${error.message || 'Periksa koneksi atau policy Supabase Storage.'}`;
    // Re-populate to restore buttons
    try {
      const snap = await getDoc(doc(db, 'brandAdmins', activeBrandId));
      populateDocCard(docKey, snap.data()?.dokumen?.[docKey] || null);
    } catch { /* silent */ }
  } finally {
    setModalLoading(false);
  }
}

async function handleFotoUpload(noPolisi, file, isReplace) {
  const errEl = byId('admin-upload-error');
  if (errEl) errEl.textContent = '';

  const err = validateFile(file, 'foto');
  if (err) { if (errEl) errEl.textContent = err; return; }
  if (!activeBrandId || !activeBrandData) return;

  setFotoItemLoading(noPolisi, true);

  try {
    let oldStoragePath = null;
    if (isReplace) {
      const existing = activeFotoMap.get(noPolisi);
      if (existing) oldStoragePath = existing.storageRef || null;
    }

    await ensureBrandAdminDoc(activeBrandId, activeBrandData.namaBrand, activeBrandData.namaPT);

    const ext = file.name.split('.').pop().toLowerCase();
    const ts = Date.now();
    const safeNopol = noPolisi.replace(/\s+/g, '_');
    const storagePath = `brands/${activeBrandId}/foto-branding/${safeNopol}/${ts}.${ext}`;
    const { downloadURL } = await uploadToStorage(file, storagePath);

    const fotoRef = doc(db, 'brandAdmins', activeBrandId, 'fotoBranding', noPolisi);
    await setDoc(fotoRef, {
      storageRef: storagePath,
      downloadURL,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.currentUser?.email || 'unknown',
    });

    if (isReplace && oldStoragePath && oldStoragePath !== storagePath) {
      await deleteFromStorage(oldStoragePath);
    }

    activeFotoMap.set(noPolisi, { storageRef: storagePath, downloadURL, fileName: file.name });
    populateFotoSection(activeBusNoPolisi);

    brandGroups.filter((group) => group.brandId === activeBrandId).forEach((group) => {
      if (!group.adminDoc) group.adminDoc = {};
      if (!group.adminDoc._fotoMap) group.adminDoc._fotoMap = new Map();
      group.adminDoc._fotoMap.set(noPolisi, activeFotoMap.get(noPolisi));
      group.adminDoc._fotoCount = group.adminDoc._fotoMap.size;
    });
    renderAdminTable();

    showNoticeAdmin(`Foto branding bus ${noPolisi} berhasil diupload.`);
  } catch (error) {
    console.error('Upload foto gagal:', error);
    if (errEl) errEl.textContent = `Upload foto gagal: ${error.message || 'Periksa koneksi atau policy Supabase Storage.'}`;
    populateFotoSection(activeBusNoPolisi);
  } finally {
    setModalLoading(false);
  }
}

async function viewFile(storagePath, fallbackUrl = '') {
  try {
    if (!storagePath && fallbackUrl) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (storagePath && (storagePath.startsWith('http://') || storagePath.startsWith('https://'))) {
      window.open(storagePath, '_blank', 'noopener,noreferrer');
      return;
    }

    let url = '';

    if (!url) {
      const { data: pubData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);
      url = pubData?.publicUrl || '';
    }

    const targetUrl = url || fallbackUrl;
    if (!targetUrl) {
      throw new Error('URL file tidak dapat dibuat.');
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Gagal membuka file:', error);
    const errEl = byId('admin-upload-error');
    if (errEl) errEl.textContent = `Gagal membuka file: ${error.message || 'File mungkin tidak tersedia.'}`;
  }
}

// ============================================================
// FILE INPUT TRIGGER
// ============================================================

function triggerFileInput(accept, callback) {
  let input = byId('admin-file-input');
  if (!input) return;

  // Clone to remove previous event listeners
  const newInput = input.cloneNode(true);
  newInput.accept = accept;
  newInput.value = '';
  input.parentNode.replaceChild(newInput, input);

  newInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) callback(file);
  }, { once: true });

  newInput.click();
}

// ============================================================
// EVENT BINDING
// ============================================================

function bindModalEvents() {
  const modal = byId('admin-detail-modal');
  if (!modal) return;

  byId('close-admin-modal')?.addEventListener('click', closeAdminModal);

  // Backdrop close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAdminModal();
  });

  // Action delegation
  modal.addEventListener('click', async (e) => {
    const t = e.target;

    const docUpload = t.dataset.docUpload;
    if (docUpload) {
      triggerFileInput('.pdf,application/pdf', (f) => handleDocUpload(docUpload, f, false));
      return;
    }

    const docReplace = t.dataset.docReplace;
    if (docReplace) {
      triggerFileInput('.pdf,application/pdf', (f) => handleDocUpload(docReplace, f, true));
      return;
    }

    const docView = t.dataset.docView;
    if (docView) {
      try {
        const snap = await getDoc(doc(db, 'brandAdmins', activeBrandId));
        const docObj = snap.data()?.dokumen?.[docView];
        const path = docObj?.storageRef;
        if (path) {
          await viewFile(path, docObj?.downloadURL);
        } else if (docObj?.downloadURL) {
          await viewFile(docObj.downloadURL, docObj.downloadURL);
        }
      } catch {
        const errEl = byId('admin-upload-error');
        if (errEl) errEl.textContent = 'Gagal mengambil URL file.';
      }
      return;
    }

    const fotoUpload = t.dataset.fotoUpload;
    if (fotoUpload) {
      triggerFileInput('.jpg,.jpeg,.png,image/jpeg,image/png',
        (f) => handleFotoUpload(fotoUpload, f, false));
      return;
    }

    const fotoReplace = t.dataset.fotoReplace;
    if (fotoReplace) {
      triggerFileInput('.jpg,.jpeg,.png,image/jpeg,image/png',
        (f) => handleFotoUpload(fotoReplace, f, true));
      return;
    }

    const fotoView = t.dataset.fotoView;
    if (fotoView) {
      const fotoDoc = activeFotoMap.get(fotoView);
      if (fotoDoc?.storageRef) {
        await viewFile(fotoDoc.storageRef, fotoDoc?.downloadURL);
      } else if (fotoDoc?.downloadURL) {
        await viewFile(fotoDoc.downloadURL, fotoDoc.downloadURL);
      }
      return;
    }
  });
}

function bindAdminNavigationEvents() {
  const handleHash = () => {
    const currentHash = window.location.hash.slice(1);
    if (currentHash === 'administrasi-branding') {
      loadAdminData();
    }
  };
  window.addEventListener('hashchange', handleHash);
  if (window.location.hash.slice(1) === 'administrasi-branding') {
    loadAdminData();
  }
}

function bindAdminTableEvents() {
  const container = byId('admin-period-groups');
  if (!container) return;
  container.addEventListener('click', (event) => {
    const detailButton = event.target.closest('[data-admin-action="detail"]');
    if (detailButton) {
      const brandId = detailButton.dataset.brandId;
      if (brandId) openAdminModal(brandId, detailButton.dataset.periodKey);
      return;
    }
    const yearButton = event.target.closest('[data-admin-year-toggle]');
    if (yearButton) {
      const year = Number(yearButton.dataset.adminYearToggle);
      const yearGroups = groupAdminPeriods(brandGroups).years.find((item) => item.year === year);
      if (expandedAdminYears.has(year)) {
        expandedAdminYears.delete(year);
        yearGroups?.months.forEach((month) => expandedAdminMonths.delete(month.key));
      } else {
        expandedAdminYears.add(year);
        yearGroups?.months.forEach((month) => expandedAdminMonths.add(month.key));
      }
      renderAdminTable();
      return;
    }
    const monthButton = event.target.closest('[data-admin-month-toggle]');
    if (monthButton) {
      const monthKey = monthButton.dataset.adminMonthToggle;
      if (expandedAdminMonths.has(monthKey)) expandedAdminMonths.delete(monthKey);
      else expandedAdminMonths.add(monthKey);
      renderAdminTable();
      return;
    }
    if (event.target.closest('[data-admin-undated-toggle]')) {
      if (expandedAdminYears.has('undated')) expandedAdminYears.delete('undated');
      else expandedAdminYears.add('undated');
      renderAdminTable();
    }
  });
}

// ============================================================
// LOAD + RENDER
// ============================================================

async function loadAdminData() {
  const container = byId('admin-period-groups');
  if (container) {
    container.innerHTML = '<p class="empty-state admin-period-empty">Memuat data…</p>';
  }
  try {
    await loadBrandingsAndBuses();
    brandGroups = buildBrandGroups();
    brandGroups = await loadAdminDocs(brandGroups);
    renderAdminTable();
  } catch (error) {
    console.error('Admin data load error:', error);
    if (container) {
      container.innerHTML = '<p class="empty-state admin-period-empty" style="color:var(--color-danger)">Gagal memuat data. Periksa koneksi Firebase dan Firestore Rules.</p>';
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

export async function initialiseAdminFeatures(firestore, maybeStorageOrAuth, maybeAuth) {
  db = firestore;
  auth = maybeAuth || maybeStorageOrAuth;

  currentUserRole = 'viewer';
  const user = auth?.currentUser;
  console.info('[admin-role]', JSON.stringify({ phase: 'initialise', authUid: user?.uid ?? null }));
  if (window.__accessContext?.uid === user?.uid) {
    currentUserRole = window.__accessContext.role;
  } else if (user) {
    currentUserRole = await loadUserRole(user.uid);
  }
  console.info('[admin-role]', JSON.stringify({ phase: 'loaded', currentUserRole, canUpload: canUpload(), adminEventsBound }));

  if (adminEventsBound) return;
  adminEventsBound = true;

  bindAdminNavigationEvents();
  bindAdminTableEvents();
  bindModalEvents();
  byId('admin-search')?.addEventListener('input', (event) => {
    adminSearch = event.currentTarget.value;
    renderAdminTable();
  });

  byId('refresh-admin')?.addEventListener('click', () => {
    loadAdminData();
    showNoticeAdmin('Data administrasi diperbarui.');
  });
}
