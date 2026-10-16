import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { busTrayek, busTrayekCode, findTrayek, TRAYEK_MASTER, trayekLabel } from './trayek-master.js';
import {
  assignCalendarLanes,
  calendarPreviewLanes,
  daysUntil,
  expirationBucket,
  filterCalendarRecords,
  groupCalendarRecordsByCompanyAndBus,
  overlapsMonth,
} from './dashboard-monitoring.js';

const BRANDING_TYPES = ['Full Body', 'Back Body', 'Side Body'];
const BRANDING_STATUSES = ['BOOKING', 'PROSES', 'BERJALAN', 'SELESAI'];
const PT_PALETTE = ['#0E4A31', '#3F725B', '#6D927E', '#96AA9E', '#D4AE46', '#B4A27C', '#647C8D', '#8A9DA7', '#7B7590', '#9C836F', '#B17F68', '#6D9692', '#818A85'];
const BRANDING_CSV_COLUMNS = ['ID Branding', 'NO', 'JALUR', 'No. Lamb', 'Kode1', 'Kode2', 'Status', 'No Polisi', 'Type', 'Nama Brand', 'Nama PT', 'Tanggal Booking', 'Tanggal Mulai', 'Akhir Penayangan', 'Jenis Branding', 'Keterangan'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

let db;
let currentUser;
let buses = [];
let brandings = [];
let noticeTimeout;
let eventsBound = false;
let selectedBookingBusIds = new Set();
let dashboardCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const dashboardCalendarCompanies = new Set();
const expandedCalendarCompanies = new Set();

// Sort state per table — key=null means natural order (NO = display index)
const sortState = {
  masterBus: { key: null, dir: 'asc' },
  branding:  { key: null, dir: 'asc' },
  history:   { key: null, dir: 'asc' },
  rekap:     { key: null, dir: 'asc' },
};

const byId = (id) => document.querySelector(`#${id}`);
const value = (id) => byId(id).value;
const escapeHtml = (text = '') => String(text).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

function can(permission) { return typeof window.can !== 'function' || window.can(permission); }

function configuredValues(category, fallbackValues = []) {
  return typeof window.getAdminMasterDataValues === 'function'
    ? window.getAdminMasterDataValues(category)
    : fallbackValues;
}

function refreshManagedDropdowns() {
  const setSelect = (select, values, selected = '', placeholder = '') => {
    if (!select) return;
    const merged = [...new Set([...values, ...(selected ? [selected] : [])])];
    select.innerHTML = `${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}${merged.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
    select.value = selected && merged.includes(selected) ? selected : '';
  };
  const types = configuredValues('brandingTypes', BRANDING_TYPES);
  setSelect(byId('booking-type'), types, value('booking-type'), 'Pilih jenis');
  setSelect(byId('rekap-filter-type'), types, value('rekap-filter-type'), 'Semua Type');
  const brandingType = document.querySelector('#branding-edit-form [name="jenisBranding"]');
  setSelect(brandingType, types, brandingType?.value || types[0] || '');
  const busForm = byId('bus-edit-form');
  if (busForm) {
    setSelect(busForm.elements.tipeBus, configuredValues('busTypes', buses.map((bus) => bus.tipeBus).filter(Boolean)), busForm.elements.tipeBus.value, 'Pilih tipe bus');
    setSelect(busForm.elements.jalurBus, configuredValues('jalur', buses.map((bus) => bus.jalurBus).filter(Boolean)), busForm.elements.jalurBus.value, 'Pilih jalur');
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseToIsoDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'object') {
    if (typeof dateStr.toDate === 'function') dateStr = dateStr.toDate().toISOString();
    else if (dateStr instanceof Date) dateStr = dateStr.toISOString();
    else if (typeof dateStr.seconds === 'number') dateStr = new Date(dateStr.seconds * 1000).toISOString();
  }
  if (typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 3) {
    const mIndex = MONTHS.findIndex((m) => m.toLowerCase() === parts[1].toLowerCase());
    if (mIndex !== -1 && /^\d{4}$/.test(parts[2])) {
      return `${parts[2]}-${String(mIndex + 1).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
    }
  }
  return trimmed;
}

function formatDate(date) {
  if (!date) return '—';
  const iso = parseToIsoDate(date);
  if (iso && iso.includes('-')) {
    const [year, month, day] = iso.split('-');
    return year && month && day ? `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}` : date;
  }
  return date;
}

function getBrandingNoPolisi(b) {
  return (b.noPolisi || b['No Polisi'] || b.no_polisi || '').trim();
}

function getBrandingJenis(b) {
  const t = (b.jenisBranding || b['Jenis Branding'] || b.jenis_branding || b.type || '').trim();
  if (/full/i.test(t)) return 'Full Body';
  if (/back/i.test(t)) return 'Back Body';
  if (/side/i.test(t)) return 'Side Body';
  return t || 'Full Body';
}

function getBrandingPT(b) {
  const pt = (b.namaPT || b['Nama PT'] || b.ptName || b.nama_pt || b.PT || '').trim();
  return pt || 'Tidak diketahui';
}

function getBrandingBrand(b) {
  return (b.namaBrand || b['Nama Brand'] || b.brand || '').trim();
}

function getBrandingRoute(b) {
  return (b.jalurBus || b['Jalur Bus'] || b.jalur || b.JALUR || '').trim();
}

function effectiveStatus(branding) {
  const rawStatus = (branding.status || branding.Status || '').trim().toUpperCase();
  if (rawStatus === 'SELESAI') return 'SELESAI';
  const rawEnd = branding.tanggalSelesai || branding['Akhir Penayangan'] || '';
  const isoEnd = parseToIsoDate(rawEnd);
  if (isoEnd && /^\d{4}-\d{2}-\d{2}$/.test(isoEnd) && isoEnd < today()) return 'SELESAI';
  if (rawStatus === 'BRANDING' || rawStatus === 'BERJALAN') return 'BERJALAN';
  if (rawStatus === 'PROSES') return 'PROSES';
  if (rawStatus === 'BOOKING') return 'BOOKING';
  return rawStatus || 'BERJALAN';
}

function isActive(branding) {
  return effectiveStatus(branding) !== 'SELESAI';
}

function showNotice(message, type = 'success') {
  const notice = byId('app-notice');
  notice.textContent = message;
  notice.className = `app-notice is-visible ${type}`;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { notice.className = 'app-notice'; }, 5000);
}

function showConfirmModal(title, message, confirmText = 'Konfirmasi', isDanger = false) {
  return new Promise((resolve) => {
    const modal = byId('global-confirm-modal');
    if (!modal) { resolve(window.confirm(`${title}\n\n${message}`)); return; }
    const titleEl = byId('confirm-modal-title');
    const messageEl = byId('confirm-modal-message');
    const cancelBtn = byId('cancel-confirm-btn');
    const submitBtn = byId('submit-confirm-btn');
    const closeBtn = byId('close-confirm-modal');
    titleEl.textContent = title;
    messageEl.textContent = message;
    submitBtn.textContent = confirmText;
    submitBtn.className = isDanger ? 'danger' : '';
    const cleanup = () => {
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      submitBtn.removeEventListener('click', onConfirm);
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    };
    const onCancel = () => { cleanup(); resolve(false); };
    const onConfirm = (e) => { e.preventDefault(); cleanup(); resolve(true); };
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    submitBtn.addEventListener('click', onConfirm);
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  });
}

function setOptions(id, values, placeholder) {
  const select = byId(id);
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${[...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'id')).map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
  select.value = [...select.options].some((option) => option.value === current) ? current : '';
}

function emptyRow(columns, text) {
  return `<tr><td colspan="${columns}" class="empty-state">${escapeHtml(text)}</td></tr>`;
}

function renderTrayekOptions(select, selectedCode = '') {
  const activeCodes = configuredValues('trayek', TRAYEK_MASTER.map((trayek) => trayek.code));
  const routeOptions = TRAYEK_MASTER.filter((trayek) => activeCodes.includes(trayek.code) || trayek.code === selectedCode);
  select.innerHTML = `<option value="">Kode trayek belum tersedia</option>${routeOptions.map((trayek) =>
    `<option value="${escapeHtml(trayek.code)}">${escapeHtml(trayek.code)} — ${escapeHtml(trayek.name)}</option>`
  ).join('')}`;
  select.value = findTrayek(selectedCode)?.code || '';
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = ''; continue;
    }
    cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// SORT HELPERS — reusable for all tables
// ============================================================

function compareValues(a, b) {
  const aEmpty = a === '' || a === null || a === undefined;
  const bEmpty = b === '' || b === null || b === undefined;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
  return String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' });
}

function applySort(rows, key, dir, getValueFn) {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const va = getValueFn(a, key);
    const vb = getValueFn(b, key);
    const aEmpty = va === '' || va === null || va === undefined;
    const bEmpty = vb === '' || vb === null || vb === undefined;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const result = compareValues(va, vb);
    return dir === 'desc' ? -result : result;
  });
}

function getBusSortValue(bus, key) {
  switch (key) {
    case 'no':       return isNaN(Number(bus.no)) ? (bus.no || '') : Number(bus.no);
    case 'noPolisi':  return bus.noPolisi  || '';
    case 'noLamb':   return isNaN(Number(bus.noLamb))  ? (bus.noLamb  || '') : Number(bus.noLamb);
    case 'tipeBus':  return bus.tipeBus   || '';
    case 'trayek':   return trayekLabel(busTrayekCode(bus)) || 'Kode trayek belum tersedia';
    case 'warnaBus': return bus.warnaBus  || '';
    case 'jalurBus': return bus.jalurBus  || '';
    case 'karoseri': return bus.karoseri  || '';
    default:         return '';
  }
}

function getBrandingSortValue(b, key) {
  switch (key) {
    case 'jalur':          return getBrandingRoute(b);
    case 'noLamb':         return isNaN(Number(b.noLamb)) ? (b.noLamb || '') : Number(b.noLamb);
    case 'status':         return effectiveStatus(b);
    case 'noPolisi':       return getBrandingNoPolisi(b);
    case 'tipeBus':        return b.tipeBus   || '';
    case 'namaBrand':      return getBrandingBrand(b);
    case 'namaPT':         return getBrandingPT(b);
    case 'tanggalMulai':   return parseToIsoDate(b.tanggalMulai || b['Tanggal Mulai']) || '';
    case 'tanggalSelesai': return parseToIsoDate(b.tanggalSelesai || b['Akhir Penayangan']) || '';
    case 'durasiKontrak':  return getContractDurationMonths(b) ?? '';
    case 'jenisBranding':  return getBrandingJenis(b);
    case 'keterangan':     return b.keterangan || '';
    default:               return '';
  }
}

function getRekapSortValue(row, key) {
  const { bus, branding } = row;
  switch (key) {
    case 'no':             return row._busIdx ?? 0;
    case 'jalur':          return bus.jalurBus || '';
    case 'noLamb':         return isNaN(Number(bus.noLamb)) ? (bus.noLamb || '') : Number(bus.noLamb);
    case 'status':         return row.status || (branding ? effectiveStatus(branding) : 'NONE');
    case 'noPolisi':       return bus.noPolisi || '';
    case 'type':           return branding ? getBrandingJenis(branding) : '';
    case 'tipeBus':        return bus.tipeBus  || '';
    case 'namaBrand':      return branding ? getBrandingBrand(branding) : '';
    case 'tanggalMulai':   return branding ? (parseToIsoDate(branding.tanggalMulai || branding['Tanggal Mulai']) || '') : '';
    case 'tanggalSelesai': return branding ? (parseToIsoDate(branding.tanggalSelesai || branding['Akhir Penayangan']) || '') : '';
    case 'durasiKontrak':  return branding ? getContractDurationMonths(branding) ?? '' : '';
    case 'referensi':      return branding ? (branding.referensi || branding.pks || branding.keterangan || '') : '';
    default:               return '';
  }
}

function getAuditTimestampParts(value) {
  if (!value) return null;
  let date;
  if (typeof value.toDate === 'function') date = value.toDate();
  else if (value instanceof Date) date = value;
  else if (typeof value.seconds === 'number') date = new Date(value.seconds * 1000);
  else date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', timeZone: 'Asia/Jakarta',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return { date: `${part('day')} ${part('month').replace('.', '')} ${part('year')}`, time: `${part('hour')}:${part('minute')} WIB` };
}

function auditFields() {
  return { updatedBy: currentUser?.displayName || currentUser?.email || currentUser?.uid || '', updatedAt: serverTimestamp() };
}

function getBookingPricingReason(booking) {
  const result = typeof window.calculateBookingFinancials === 'function'
    ? window.calculateBookingFinancials(booking)
    : null;
  return result?.reason || '';
}

function getPricingSnapshot(booking) {
  return typeof window.createPricingSnapshot === 'function'
    ? window.createPricingSnapshot(booking)
    : null;
}

function parseCalendarDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime())
      ? null
      : new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }
  if (typeof dateValue === 'object') {
    if (typeof dateValue.toDate === 'function') return parseCalendarDate(dateValue.toDate());
    if (typeof dateValue.seconds === 'number') return parseCalendarDate(new Date(dateValue.seconds * 1000));
  }

  const value = String(dateValue).trim();
  if (!value) return null;
  let year;
  let month;
  let day;
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:$|\s)/);
    if (match) {
      [, day, month, year] = match.map(Number);
    } else {
      const iso = parseToIsoDate(value);
      if (!iso || iso === value) return null;
      return parseCalendarDate(iso);
    }
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
    ? null
    : parsed;
}

function getContractDurationMonths(branding) {
  const start = parseCalendarDate(branding.tanggalMulai || branding['Tanggal Mulai']);
  const end = parseCalendarDate(branding.tanggalSelesai || branding['Akhir Penayangan']);
  if (!start || !end || end < start) return null;

  const daysCovered = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  if (daysCovered < 26) return null;
  if (daysCovered <= 34) return 1;

  return (end.getFullYear() - start.getFullYear()) * 12
    + (end.getMonth() - start.getMonth())
    + 1;
}

window.getContractDurationMonths = getContractDurationMonths;
window.parseBrandingDateToIso = parseToIsoDate;

function updateSortHeaders(tableId, state) {
  const table = document.querySelector(`#${tableId}`);
  if (!table) return;
  table.querySelectorAll('th[data-sort-key]').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sortKey === state.key) {
      th.classList.add(state.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

// ============================================================
// CONFLICT DETECTION — per-type rules
// ============================================================

function overlaps(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

function getActiveOverlappingBrandings(bus, tanggalMulai, tanggalSelesai, excludedId = '') {
  if (!tanggalMulai || !tanggalSelesai) return [];
  return brandings.filter((b) =>
    b.id !== excludedId &&
    b.noPolisi === bus.noPolisi &&
    isActive(b) &&
    b.tanggalMulai && b.tanggalSelesai &&
    overlaps(tanggalMulai, tanggalSelesai, b.tanggalMulai, b.tanggalSelesai)
  );
}

/**
 * Compute which branding types are blocked for a bus during a period.
 * Rules:
 *   Full Body active            → Full + Side + Back all disabled
 *   Side Body active only       → Side + Full disabled; Back available
 *   Back Body active only       → Back + Full disabled; Side available
 *   Side Body AND Back Body     → all three disabled
 */
function getDisabledTypes(bus, tanggalMulai, tanggalSelesai, excludedId = '') {
  const active = getActiveOverlappingBrandings(bus, tanggalMulai, tanggalSelesai, excludedId);
  if (!active.length) return { disabled: new Set(), conflictMap: new Map() };

  const conflictMap = new Map();
  active.forEach((b) => {
    const jenis = getBrandingJenis(b);
    if (!conflictMap.has(jenis)) conflictMap.set(jenis, b);
  });

  const activeTypes = new Set(conflictMap.keys());
  const disabled = new Set();

  if (activeTypes.has('Full Body')) {
    disabled.add('Full Body'); disabled.add('Side Body'); disabled.add('Back Body');
  }
  if (activeTypes.has('Side Body')) {
    disabled.add('Side Body'); disabled.add('Full Body');
  }
  if (activeTypes.has('Back Body')) {
    disabled.add('Back Body'); disabled.add('Full Body');
  }
  if (activeTypes.has('Side Body') && activeTypes.has('Back Body')) {
    disabled.add('Full Body'); disabled.add('Side Body'); disabled.add('Back Body');
  }

  return { disabled, conflictMap };
}

function getBusConflict(bus, jenisBranding, tanggalMulai, tanggalSelesai, excludedBrandingId = '') {
  if (!jenisBranding || !tanggalMulai || !tanggalSelesai) return undefined;
  const { disabled, conflictMap } = getDisabledTypes(bus, tanggalMulai, tanggalSelesai, excludedBrandingId);
  if (!disabled.has(jenisBranding)) return undefined;
  return conflictMap.get(jenisBranding) || [...conflictMap.values()][0];
}

function busHasConflict(bus, jenisBranding, tanggalMulai, tanggalSelesai) {
  return Boolean(getBusConflict(bus, jenisBranding, tanggalMulai, tanggalSelesai));
}

function buildConflictReason(activeTypes) {
  if (activeTypes.includes('Full Body')) return 'Full Body sedang berjalan';
  if (activeTypes.includes('Side Body') && activeTypes.includes('Back Body')) return 'Side Body & Back Body sudah digunakan';
  if (activeTypes.includes('Side Body')) return 'Side Body sudah digunakan';
  if (activeTypes.includes('Back Body')) return 'Back Body sudah digunakan';
  return `${activeTypes.join(' & ')} sedang berjalan`;
}

// ============================================================
// FILTER HELPERS
// ============================================================

function brandingMatches(branding, filters) {
  const status = effectiveStatus(branding);
  const route = getBrandingRoute(branding);
  const type = getBrandingJenis(branding);
  const brand = getBrandingBrand(branding);
  const nopol = getBrandingNoPolisi(branding);
  const pt = getBrandingPT(branding);
  const searchText = `${brand} ${pt} ${nopol} ${branding.noLamb || ''}`.toLowerCase();
  return (!filters.route || route === filters.route)
    && (!filters.status || status === filters.status)
    && (!filters.type || type === filters.type)
    && (!filters.brand || brand === filters.brand)
    && (!filters.search || searchText.includes(filters.search.toLowerCase()));
}

function currentBrandingFilters(prefix = 'branding') {
  return {
    route:  value(`${prefix}-route`),
    status: byId(`${prefix}-status`) ? value(`${prefix}-status`) : '',
    type:   value(`${prefix}-type`),
    brand:  value(`${prefix}-brand`),
    search: byId(`${prefix}-search`) ? value(`${prefix}-search`).trim() : '',
  };
}

function filteredBrandings(prefix = 'branding') {
  return brandings.filter((branding) => brandingMatches(branding, currentBrandingFilters(prefix)));
}

// ============================================================
// TABLE ROWS — shared renderer for Data Branding & History
// ============================================================

function tableRows(items, withActions = false, state = null, includeContractColumns = false) {
  const baseColumns = withActions ? 12 : 11;
  const columns = baseColumns + (includeContractColumns ? 2 : 0);
  if (!items.length) return emptyRow(columns, 'Belum ada data untuk ditampilkan.');
  const sorted = state && state.key ? applySort(items, state.key, state.dir, getBrandingSortValue) : items;
  return sorted.map((branding, index) => {
    const startDate = formatDate(branding.tanggalMulai || branding['Tanggal Mulai']) || '—';
    const endDate = formatDate(branding.tanggalSelesai || branding['Akhir Penayangan']) || '—';
    const durationMonths = getContractDurationMonths(branding);
    const durationText = durationMonths === null ? '—' : `${durationMonths} Bulan`;
    return `<tr>
    <td>${index + 1}</td><td>${escapeHtml(getBrandingRoute(branding))}</td><td>${escapeHtml(String(branding.noLamb || '—'))}</td><td><span class="status-chip status-${effectiveStatus(branding).toLowerCase()}">${escapeHtml(effectiveStatus(branding))}</span></td>
    <td>${escapeHtml(getBrandingNoPolisi(branding))}</td><td>${escapeHtml(branding.tipeBus || '—')}</td><td>${escapeHtml(getBrandingBrand(branding))}</td><td>${escapeHtml(getBrandingPT(branding))}</td>
    ${includeContractColumns ? `<td>${escapeHtml(startDate)}</td><td>${escapeHtml(endDate)}</td><td>${escapeHtml(durationText)}</td>` : `<td>${escapeHtml(endDate)}</td>`}
    <td>${escapeHtml(getBrandingJenis(branding))}</td><td>${escapeHtml(branding.keterangan || '—')}</td>
    ${withActions ? `<td class="action-cell">${can('branding.edit') ? `<button type="button" class="action-button" data-branding-action="edit" data-branding-id="${escapeHtml(branding.id)}">Edit</button><button type="button" class="action-button danger" data-branding-action="delete" data-branding-id="${escapeHtml(branding.id)}">Hapus</button>` : '—'}</td>` : ''}
  </tr>`;
  }).join('');
}

// ============================================================
// RENDER — MASTER BUS
// ============================================================

function renderMasterBus() {
  const search = value('master-search').trim().toLowerCase();
  const route = value('master-route');
  const trayek = value('master-trayek');
  let rows = buses.filter((bus) => {
    const trayekText = `${busTrayekCode(bus)} ${trayekLabel(busTrayekCode(bus))}`.toLowerCase();
    const text = `${bus.noPolisi} ${bus.noLamb} ${bus.tipeBus} ${bus.ket} ${bus.warnaBus} ${bus.jalurBus} ${bus.karoseri} ${trayekText}`.toLowerCase();
    const matchesTrayek = !trayek
      || (trayek === '__unset__' ? !busTrayek(bus) : busTrayekCode(bus) === trayek);
    return (!route || bus.jalurBus === route) && matchesTrayek && (!search || text.includes(search));
  });
  if (sortState.masterBus.key) {
    rows = applySort(rows, sortState.masterBus.key, sortState.masterBus.dir, getBusSortValue);
  }
  byId('master-count').textContent = buses.length;
  byId('master-missing-trayek-count').textContent = buses.filter((bus) => !busTrayek(bus)).length;
  const cell = (content, className = '') => `<td class="${className}" title="${escapeHtml(String(content))}">${escapeHtml(String(content))}</td>`;
  byId('master-bus-body').innerHTML = rows.length
    ? rows.map((bus, i) => {
      const routeName = busTrayek(bus)?.name || '';
      const routeCell = routeName
        ? cell(routeName, 'bus-trayek')
        : `<td class="bus-trayek bus-trayek-missing" title="Kode trayek belum tersedia">Kode trayek belum tersedia</td>`;
      const actions = can('masterBus.edit')
        ? `<button type="button" class="action-button" data-action="edit" data-bus-id="${escapeHtml(bus.noPolisi)}">Edit</button><button type="button" class="action-button danger" data-action="delete" data-bus-id="${escapeHtml(bus.noPolisi)}">Hapus</button>`
        : '—';
      return `<tr>${cell(i + 1, 'bus-no')}${cell(bus.noPolisi)}${cell(bus.jalurBus)}${cell(bus.noLamb)}${routeCell}${cell(bus.tipeBus)}${cell(bus.warnaBus)}${cell(bus.karoseri)}<td class="action-cell">${actions}</td></tr>`;
    }).join('')
    : emptyRow(9, 'Belum ada bus yang sesuai.');
  updateSortHeaders('master-bus-table', sortState.masterBus);
}

// ============================================================
// RENDER — DATA BRANDING
// ============================================================

function renderBrandings() {
  const items = filteredBrandings();
  byId('branding-body').innerHTML = tableRows(items, true, sortState.branding, true);
  updateSortHeaders('branding-table', sortState.branding);
}

// ============================================================
// RENDER — HISTORY
// ============================================================

function historyFilters() {
  return {
    year: value('history-year'), month: value('history-month'),
    route: value('history-route'), brand: value('history-brand'), type: value('history-type'),
  };
}

function filteredHistory() {
  const filters = historyFilters();
  return brandings.filter((branding) => {
    if (effectiveStatus(branding) !== 'SELESAI') return false;
    const isoEnd = parseToIsoDate(branding.tanggalSelesai || branding['Akhir Penayangan']);
    const [year, month] = (isoEnd || '').split('-');
    return (!filters.year || year === filters.year) && (!filters.month || month === filters.month)
      && (!filters.route || getBrandingRoute(branding) === filters.route)
      && (!filters.brand || getBrandingBrand(branding) === filters.brand)
      && (!filters.type || getBrandingJenis(branding) === filters.type);
  });
}

function renderHistory() {
  const items = filteredHistory();
  byId('history-body').innerHTML = tableRows(items, false, sortState.history);
  updateSortHeaders('history-table', sortState.history);
}

// ============================================================
// REKAP BRANDING
// ============================================================

let lastRekapRows = [];

function buildRekapRows() {
  const searchPolisi = byId('rekap-search-polisi') ? value('rekap-search-polisi').trim().toLowerCase() : '';
  const searchLamb   = byId('rekap-search-lamb')   ? value('rekap-search-lamb').trim().toLowerCase()   : '';
  const searchBrand  = byId('rekap-search-brand')  ? value('rekap-search-brand').trim().toLowerCase()  : '';
  const filterJalur  = byId('rekap-filter-jalur')  ? value('rekap-filter-jalur')                       : '';
  const filterStatus = byId('rekap-filter-status') ? value('rekap-filter-status')                      : '';
  const filterType   = byId('rekap-filter-type')   ? value('rekap-filter-type')                        : '';

  // Dynamic summary statistics across all buses
  const totalBuses = buses.length;
  let berjalanCount = 0;
  let prosesCount = 0;
  let bookingCount = 0;
  let noneCount = 0;

  buses.forEach((bus) => {
    const normBusNopol = String(bus.noPolisi || '').replace(/\s+/g, ' ').toUpperCase();
    const activeForBus = brandings.filter((b) => {
      const normBrandingNopol = getBrandingNoPolisi(b).replace(/\s+/g, ' ').toUpperCase();
      return normBrandingNopol === normBusNopol && isActive(b);
    });

    if (!activeForBus.length) {
      noneCount++;
    } else {
      activeForBus.forEach((b) => {
        const st = effectiveStatus(b);
        if (st === 'BERJALAN') berjalanCount++;
        else if (st === 'PROSES') prosesCount++;
        else if (st === 'BOOKING') bookingCount++;
      });
    }
  });

  if (byId('rekap-stat-total'))    byId('rekap-stat-total').textContent = totalBuses;
  if (byId('rekap-stat-berjalan')) byId('rekap-stat-berjalan').textContent = berjalanCount;
  if (byId('rekap-stat-proses'))   byId('rekap-stat-proses').textContent = prosesCount;
  if (byId('rekap-stat-booking'))  byId('rekap-stat-booking').textContent = bookingCount;
  if (byId('rekap-stat-none'))     byId('rekap-stat-none').textContent = noneCount;

  const rows = [];
  buses.forEach((bus, busIdx) => {
    const normBusNopol = String(bus.noPolisi || '').replace(/\s+/g, ' ').toUpperCase();
    const busBrandings = brandings.filter((b) => {
      const normBrandingNopol = getBrandingNoPolisi(b).replace(/\s+/g, ' ').toUpperCase();
      return normBrandingNopol === normBusNopol && isActive(b);
    });

    const entries = busBrandings.length > 0
      ? busBrandings.map((b) => ({ bus, branding: b, status: effectiveStatus(b), _busIdx: busIdx }))
      : [{ bus, branding: null, status: 'NONE', _busIdx: busIdx }];

    entries.forEach((row) => {
      if (filterJalur && bus.jalurBus !== filterJalur) return;
      if (filterStatus) {
        if (filterStatus === 'NONE') {
          if (row.status !== 'NONE') return;
        } else {
          if (row.status !== filterStatus) return;
        }
      }
      if (filterType) {
        const rType = row.branding ? getBrandingJenis(row.branding) : '';
        if (rType !== filterType) return;
      }
      if (searchPolisi && !String(bus.noPolisi || '').toLowerCase().includes(searchPolisi)) return;
      if (searchLamb   && !String(bus.noLamb   || '').toLowerCase().includes(searchLamb))  return;
      if (searchBrand) {
        const bName = row.branding ? getBrandingBrand(row.branding).toLowerCase() : '';
        if (!bName.includes(searchBrand)) return;
      }
      rows.push(row);
    });
  });
  return rows;
}

function renderRekap() {
  const tbody = byId('rekap-branding-body');
  if (!tbody) return;
  const rows = buildRekapRows();
  const sorted = sortState.rekap.key
    ? applySort(rows, sortState.rekap.key, sortState.rekap.dir, getRekapSortValue)
    : rows;
  lastRekapRows = sorted;

  tbody.innerHTML = sorted.length
    ? sorted.map((row, i) => {
        const { bus, branding, status } = row;
        let statusBadge = '';
        if (status === 'BERJALAN') {
          statusBadge = '<span class="status-chip status-berjalan">Berjalan</span>';
        } else if (status === 'PROSES') {
          statusBadge = '<span class="status-chip status-proses">Proses</span>';
        } else if (status === 'BOOKING') {
          statusBadge = '<span class="status-chip status-booking">Booking</span>';
        } else if (status === 'SELESAI') {
          statusBadge = '<span class="status-chip status-selesai">Selesai</span>';
        } else {
          statusBadge = '<span class="status-chip status-none">Belum Ada Branding</span>';
        }

        const typeStr = branding ? getBrandingJenis(branding) : '—';
        const brandStr = branding ? getBrandingBrand(branding) : '—';
        const startDateStr = branding ? formatDate(branding.tanggalMulai || branding['Tanggal Mulai']) : '—';
        const dateStr = branding ? formatDate(branding.tanggalSelesai || branding['Akhir Penayangan']) : '—';
        const durationMonths = branding ? getContractDurationMonths(branding) : null;
        const durationStr = durationMonths === null ? '—' : `${durationMonths} Bulan`;
        const refStr = branding ? (branding.referensi || branding.pks || branding.keterangan || '—') : '—';
        const updatedBy = branding?.updatedBy || '—';
        const updatedAt = branding ? getAuditTimestampParts(branding.updatedAt) : null;

        return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(bus.jalurBus || '—')}</td>
          <td>${escapeHtml(String(bus.noLamb || '—'))}</td>
          <td>${statusBadge}</td>
          <td>${escapeHtml(bus.noPolisi || '—')}</td>
          <td>${escapeHtml(typeStr)}</td>
          <td>${escapeHtml(brandStr)}</td>
          <td>${escapeHtml(startDateStr)}</td>
          <td>${escapeHtml(dateStr)}</td>
          <td>${escapeHtml(durationStr)}</td>
          <td>${escapeHtml(refStr)}</td>
          <td class="rekap-audit-cell">${escapeHtml(updatedBy)}</td>
          <td class="rekap-audit-cell">${updatedAt ? `${escapeHtml(updatedAt.date)}<br><span class="rekap-audit-time">${escapeHtml(updatedAt.time)}</span>` : '—'}</td>
        </tr>`;
      }).join('')
    : emptyRow(13, 'Belum ada data bus yang sesuai filter/pencarian.');
  updateSortHeaders('rekap-branding-table', sortState.rekap);
}

function getRekapActiveFilterText() {
  const parts = [];
  const searchPolisi = byId('rekap-search-polisi') ? value('rekap-search-polisi').trim() : '';
  const searchLamb   = byId('rekap-search-lamb')   ? value('rekap-search-lamb').trim()   : '';
  const searchBrand  = byId('rekap-search-brand')  ? value('rekap-search-brand').trim()  : '';
  const filterJalur  = byId('rekap-filter-jalur')  ? value('rekap-filter-jalur')         : '';
  const filterStatus = byId('rekap-filter-status') ? value('rekap-filter-status')        : '';
  const filterType   = byId('rekap-filter-type')   ? value('rekap-filter-type')          : '';

  if (filterJalur)  parts.push(`Jalur: ${filterJalur}`);
  if (filterStatus) parts.push(`Status: ${filterStatus === 'NONE' ? 'Belum Ada Branding' : filterStatus}`);
  if (filterType)   parts.push(`Type: ${filterType}`);
  if (searchPolisi) parts.push(`Cari Nopol: ${searchPolisi}`);
  if (searchLamb)   parts.push(`Cari No. Lamb: ${searchLamb}`);
  if (searchBrand)  parts.push(`Cari Brand: ${searchBrand}`);

  return parts.length ? parts.join(' | ') : 'Semua Data';
}

function exportRekapPdf(rows) {
  if (!rows || !rows.length) {
    showNotice('Tidak ada data untuk diexport.', 'error');
    return;
  }

  const activeFilterText = getRekapActiveFilterText();
  const exportDateText = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const tableData = rows.map((row, i) => {
    const { bus, branding, status } = row;
    const statusText = status === 'BERJALAN' ? 'Berjalan'
      : status === 'PROSES' ? 'Proses'
      : status === 'BOOKING' ? 'Booking'
      : status === 'SELESAI' ? 'Selesai'
      : 'Belum Ada Branding';
    const typeText = branding ? getBrandingJenis(branding) : '—';
    const brandText = branding ? getBrandingBrand(branding) : '—';
    const startText = branding ? formatDate(branding.tanggalMulai || branding['Tanggal Mulai']) : '—';
    const endText = branding ? formatDate(branding.tanggalSelesai || branding['Akhir Penayangan']) : '—';
    const durationMonths = branding ? getContractDurationMonths(branding) : null;
    const durationText = durationMonths === null ? '—' : `${durationMonths} Bulan`;
    const refText = branding ? (branding.referensi || branding.pks || branding.keterangan || '—') : '—';
    return [
      i + 1,
      bus.jalurBus || '—',
      String(bus.noLamb || '—'),
      statusText,
      bus.noPolisi || '—',
      typeText,
      brandText,
      startText,
      endText,
      durationText,
      refText,
    ];
  });

  if (window.jspdf && window.jspdf.jsPDF) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(14, 74, 49);
      doc.text('REKAP BRANDING ARMADA TRANS JOGJA', 14, 15);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 89, 71);
      doc.text(`Tanggal Export: ${exportDateText}`, 14, 21);
      doc.text(`Filter yang aktif: ${activeFilterText}`, 14, 25.5);
      doc.text(`Jumlah hasil: ${rows.length} baris`, 14, 30);

      doc.autoTable({
        head: [['NO', 'JALUR', 'No. Lamb', 'Status', 'No Polisi', 'Type', 'Nama Brand', 'Awal Penayangan', 'Akhir Penayangan', 'Durasi Kontrak', 'Referensi']],
        body: tableData,
        startY: 34,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
        headStyles: { fillColor: [14, 74, 49], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: [246, 249, 247] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 18 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 28 },
          4: { halign: 'center', cellWidth: 26 },
          5: { cellWidth: 26 },
          6: { cellWidth: 46 },
          7: { halign: 'center', cellWidth: 30 },
          8: { halign: 'center', cellWidth: 30 },
          9: { halign: 'center', cellWidth: 24 },
          10: { cellWidth: 'auto' },
        },
        showHeader: 'everyPage',
        margin: { top: 15, left: 14, right: 14, bottom: 15 },
      });

      doc.save(`rekap-branding-${today()}.pdf`);
      showNotice('Export PDF berhasil diunduh.');
      return;
    } catch (err) {
      console.warn('jsPDF error, falling back to print window:', err);
    }
  }

  // Fallback print
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showNotice('Izinkan popup browser untuk mencetak PDF.', 'error');
    return;
  }
  printWindow.document.write(`<!doctype html><html><head><title>REKAP BRANDING ARMADA TRANS JOGJA</title>
  <style>
    body { font-family: sans-serif; padding: 20px; color: #1a2e22; }
    h2 { color: #0E4A31; margin-bottom: 6px; }
    .meta { font-size: 12px; color: #555; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #0E4A31; color: #fff; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  </style></head><body>
  <h2>REKAP BRANDING ARMADA TRANS JOGJA</h2>
  <div class="meta">
    <div><strong>Tanggal Export:</strong> ${exportDateText}</div>
    <div><strong>Filter yang aktif:</strong> ${escapeHtml(activeFilterText)}</div>
    <div><strong>Jumlah hasil:</strong> ${rows.length} baris</div>
  </div>
  <table>
    <thead>
      <tr><th>NO</th><th>JALUR</th><th>No. Lamb</th><th>Status</th><th>No Polisi</th><th>Type</th><th>Nama Brand</th><th>Awal Penayangan</th><th>Akhir Penayangan</th><th>Durasi Kontrak</th><th>Referensi</th></tr>
    </thead>
    <tbody>
      ${tableData.map((r) => `<tr>${r.map((c, idx) => `<td style="${idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 4 || idx === 7 || idx === 8 || idx === 9 ? 'text-align:center;' : ''}">${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <script>window.onload = function() { window.print(); };<\/script>
  </body></html>`);
  printWindow.document.close();
}

function exportRekapCsv(rows) {
  if (!rows || !rows.length) {
    showNotice('Tidak ada data untuk diexport.', 'error');
    return;
  }
  const headers = ['NO', 'JALUR', 'No. Lamb', 'Status', 'No Polisi', 'Type', 'Nama Brand', 'Awal Penayangan', 'Akhir Penayangan', 'Durasi Kontrak', 'Referensi'];
  const data = rows.map((row, i) => {
    const { bus, branding, status } = row;
    const statusText = status === 'BERJALAN' ? 'Berjalan'
      : status === 'PROSES' ? 'Proses'
      : status === 'BOOKING' ? 'Booking'
      : status === 'SELESAI' ? 'Selesai'
      : 'Belum Ada Branding';
    const typeText = branding ? getBrandingJenis(branding) : '—';
    const brandText = branding ? getBrandingBrand(branding) : '—';
    const startText = branding ? formatDate(branding.tanggalMulai || branding['Tanggal Mulai']) : '—';
    const endText = branding ? formatDate(branding.tanggalSelesai || branding['Akhir Penayangan']) : '—';
    const durationMonths = branding ? getContractDurationMonths(branding) : null;
    const durationText = durationMonths === null ? '—' : `${durationMonths} Bulan`;
    const refText = branding ? (branding.referensi || branding.pks || branding.keterangan || '—') : '—';
    return [
      i + 1,
      bus.jalurBus || '',
      bus.noLamb || '',
      statusText,
      bus.noPolisi || '',
      typeText,
      brandText,
      startText,
      endText,
      durationText,
      refText,
    ];
  });
  downloadCsv(`rekap-branding-${today()}.csv`, [headers, ...data]);
  showNotice('Export CSV berhasil diunduh.');
}

// ============================================================
// DASHBOARD
// ============================================================

const chartAnimationDuration = 820;
const chartAnimationEasing = (progress) => 1 - ((1 - progress) ** 3);

function runChartAnimation(key, drawFrame) {
  const state = window.__dashboardChartAnimations || (window.__dashboardChartAnimations = {});
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    if (state[key]) cancelAnimationFrame(state[key]);
    delete state[key];
    drawFrame(1);
    return;
  }
  const start = performance.now();
  const previousFrame = state[key];
  if (previousFrame) cancelAnimationFrame(previousFrame);
  const frame = (timestamp) => {
    const progress = Math.min((timestamp - start) / chartAnimationDuration, 1);
    drawFrame(chartAnimationEasing(progress));
    if (progress < 1) {
      state[key] = requestAnimationFrame(frame);
    } else {
      delete state[key];
    }
  };
  state[key] = requestAnimationFrame(frame);
}

function prepareCanvas(canvas, fallbackWidth, fallbackHeight) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || fallbackWidth;
  const height = canvas.clientHeight || fallbackHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function dashboardVisualToken(token, fallback) {
  const dashboard = byId('dashboard');
  return dashboard ? (getComputedStyle(dashboard).getPropertyValue(token).trim() || fallback) : fallback;
}

function drawDonutChart(canvasId, items, total) {
  const canvas = byId(canvasId);
  if (!canvas) return;
  const { ctx, width, height } = prepareCanvas(canvas, 210, 210);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 8;
  const innerRadius = radius * 0.62;
  const previous = window.__dashboardDonutValues || new Map();
  const target = new Map(items.map((item) => [item.name, item.count]));
  window.__dashboardDonutItems = items;
  const hovered = window.__dashboardDonutHover || null;
  const render = (progress) => {
    ctx.clearRect(0, 0, width, height);
    const animatedItems = items.map((item) => ({
      ...item,
      count: (previous.get(item.name) || 0) + ((item.count - (previous.get(item.name) || 0)) * progress),
    }));
    const animatedTotal = animatedItems.reduce((sum, item) => sum + item.count, 0);
    if (!animatedItems.length || animatedTotal <= 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.arc(centerX, centerY, innerRadius, 2 * Math.PI, 0, true);
      ctx.fillStyle = dashboardVisualToken('--color-border', '#e2e8f0');
      ctx.fill();
      return;
    }
    let startAngle = -Math.PI / 2;
    animatedItems.forEach((item) => {
      const sliceAngle = (item.count / animatedTotal) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const isHovered = hovered === item.name;
      const drawRadius = isHovered ? radius + 3 : radius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, drawRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeStyle = dashboardVisualToken('--color-surface', '#ffffff');
      ctx.stroke();
      startAngle = endAngle;
    });
  };
  runChartAnimation('donut', render);
  window.__dashboardDonutValues = target;
  if (!canvas.dataset.interactive) {
    canvas.dataset.interactive = 'true';
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left - width / 2;
      const y = event.clientY - rect.top - height / 2;
      const distance = Math.sqrt((x ** 2) + (y ** 2));
      if (distance < innerRadius || distance > radius + 8) {
        if (window.__dashboardDonutHover) {
          window.__dashboardDonutHover = null;
          drawDonutChart(canvasId, items, total);
        }
        canvas.removeAttribute('title');
        return;
      }
      let angle = Math.atan2(y, x) + (Math.PI / 2);
      if (angle < 0) angle += 2 * Math.PI;
      const currentItems = window.__dashboardDonutItems || [];
      const currentTotal = currentItems.reduce((sum, item) => sum + item.count, 0);
      let cursor = 0;
      const hoveredItem = currentItems.find((item) => {
        cursor += (item.count / currentTotal) * 2 * Math.PI;
        return angle <= cursor;
      });
      const nextHover = hoveredItem ? hoveredItem.name : null;
      if (nextHover !== window.__dashboardDonutHover) {
        window.__dashboardDonutHover = nextHover;
        drawDonutChart(canvasId, items, total);
      }
      if (hoveredItem) canvas.title = `${hoveredItem.name}: ${hoveredItem.count} bus (${hoveredItem.percentage}%)`;
    });
    canvas.addEventListener('mouseleave', () => {
      window.__dashboardDonutHover = null;
      canvas.removeAttribute('title');
      drawDonutChart(canvasId, items, total);
    });
  }
}

function drawJalurChart(canvasId, routeData) {
  const canvas = byId(canvasId);
  if (!canvas) return;
  const { ctx, width } = prepareCanvas(canvas, 600, 220);
  const rect = canvas.parentElement.getBoundingClientRect();
  const chartWidth = rect.width || width;
  const height = 220;
  const routes = Object.keys(routeData).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  if (!routes.length) {
    ctx.clearRect(0, 0, chartWidth, height);
    ctx.fillStyle = dashboardVisualToken('--color-ink-muted', '#a0aec0');
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data jalur untuk ditampilkan', chartWidth / 2, height / 2);
    return;
  }
  const values = routes.map((r) => routeData[r] || 0);
  const maxVal = Math.max(...values, 4);
  const paddingLeft = 36, paddingRight = 16, paddingTop = 24, paddingBottom = 34;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const gridSteps = 4;
  const previous = window.__dashboardRouteValues || {};
  const hovered = window.__dashboardRouteHover || null;
  window.__dashboardRouteData = { ...routeData };
  const render = (progress) => {
    ctx.clearRect(0, 0, chartWidth, height);
    ctx.strokeStyle = dashboardVisualToken('--color-border', '#e7ebe8');
    ctx.lineWidth = 0.75;
    for (let i = 0; i <= gridSteps; i += 1) {
      const y = paddingTop + (chartHeight / gridSteps) * i;
      const val = Math.round(maxVal - (maxVal / gridSteps) * i);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(chartWidth - paddingRight, y);
      ctx.stroke();
      ctx.fillStyle = dashboardVisualToken('--color-ink-muted', '#73877e');
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), paddingLeft - 8, y + 4);
    }
    const slotWidth = plotWidth / routes.length;
    const barWidth = Math.min(36, slotWidth * 0.62);
    routes.forEach((route, idx) => {
      const targetValue = routeData[route] || 0;
      const val = (previous[route] || 0) + ((targetValue - (previous[route] || 0)) * progress);
      const barHeight = maxVal > 0 ? (val / maxVal) * chartHeight : 0;
      const x = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
      const y = paddingTop + chartHeight - barHeight;
      const isHovered = hovered === route;
      ctx.fillStyle = isHovered
        ? dashboardVisualToken('--color-primary-light', '#174f39')
        : dashboardVisualToken('--color-primary', '#0E4A31');
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, Math.max(barHeight, 2), [4, 4, 0, 0]);
      ctx.fill();
      if (targetValue > 0) {
        ctx.fillStyle = dashboardVisualToken('--color-primary', '#0E4A31');
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(targetValue), x + barWidth / 2, y - 6);
      }
      ctx.fillStyle = dashboardVisualToken('--color-ink-secondary', '#4a5f56');
      ctx.font = '11.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(route || '—', x + barWidth / 2, height - 10);
    });
  };
  runChartAnimation('jalur', render);
  window.__dashboardRouteValues = { ...routeData };
  if (!canvas.dataset.interactive) {
    canvas.dataset.interactive = 'true';
    canvas.addEventListener('mousemove', (event) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const slotWidth = plotWidth / routes.length;
      const index = Math.floor((x - paddingLeft) / slotWidth);
      const nextHover = index >= 0 && index < routes.length ? routes[index] : null;
      if (nextHover !== window.__dashboardRouteHover) {
        window.__dashboardRouteHover = nextHover;
        drawJalurChart(canvasId, routeData);
      }
      const value = nextHover ? (window.__dashboardRouteData || {})[nextHover] : null;
      canvas.title = nextHover ? `${nextHover}: ${value} bus` : '';
    });
    canvas.addEventListener('mouseleave', () => {
      window.__dashboardRouteHover = null;
      canvas.removeAttribute('title');
      drawJalurChart(canvasId, routeData);
    });
  }
}

function renderDashboard() {
  const filters = currentBrandingFilters('dashboard');
  const scopedBuses = buses.filter((bus) => !filters.route || bus.jalurBus === filters.route);
  const scopedBrandings = brandings.filter((branding) => brandingMatches(branding, filters));
  const activeBrandings = scopedBrandings.filter(isActive);
  const runningBrandings = scopedBrandings.filter((branding) => effectiveStatus(branding) === 'BERJALAN');
  const busBrandingMap = new Map();
  activeBrandings.forEach((branding) => {
    const nopol = getBrandingNoPolisi(branding);
    if (!nopol) return;
    if (!busBrandingMap.has(nopol)) {
      busBrandingMap.set(nopol, branding);
    } else {
      const existing = busBrandingMap.get(nopol);
      if (getBrandingJenis(existing) !== 'Full Body' && getBrandingJenis(branding) === 'Full Body') {
        busBrandingMap.set(nopol, branding);
      }
    }
  });
  const totalBuses = scopedBuses.length;
  const totalBrandedBuses = busBrandingMap.size;
  const availableBuses = Math.max(totalBuses - totalBrandedBuses, 0);
  const occupancyPct = totalBuses > 0 ? (totalBrandedBuses / totalBuses) * 100 : 0;
  const occupancyFormatted = `${occupancyPct.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const fullBodyCount = [...busBrandingMap.values()].filter((b) => getBrandingJenis(b) === 'Full Body').length;
  const backBodyCount = [...busBrandingMap.values()].filter((b) => getBrandingJenis(b) === 'Back Body').length;
  const sideBodyCount = [...busBrandingMap.values()].filter((b) => getBrandingJenis(b) === 'Side Body').length;
  byId('kpi-total-bus').textContent = totalBuses;
  byId('kpi-active-branding').textContent = totalBrandedBuses;
  byId('kpi-available').textContent = availableBuses;
  byId('kpi-occupancy').textContent = occupancyFormatted;
  byId('kpi-full').textContent = fullBodyCount;
  byId('kpi-back').textContent = backBodyCount;
  byId('kpi-side').textContent = sideBodyCount;
  if (byId('chart-pt-total')) byId('chart-pt-total').textContent = totalBrandedBuses;
  if (byId('chart-pt-center')) byId('chart-pt-center').textContent = totalBrandedBuses;
  const ptCountMap = new Map();
  busBrandingMap.forEach((branding) => {
    const ptName = getBrandingPT(branding);
    ptCountMap.set(ptName, (ptCountMap.get(ptName) || 0) + 1);
  });
  const sortedPTs = [...ptCountMap.entries()]
    .map(([name, count], index) => ({ name, count, percentage: totalBrandedBuses > 0 ? ((count / totalBrandedBuses) * 100).toFixed(1) : '0', color: PT_PALETTE[index % PT_PALETTE.length] }))
    .sort((a, b) => b.count - a.count);
  sortedPTs.forEach((item, index) => { item.color = PT_PALETTE[index % PT_PALETTE.length]; });
  drawDonutChart('chart-pt', sortedPTs, totalBrandedBuses);
  const legendContainer = byId('chart-pt-legend');
  if (legendContainer) {
    legendContainer.innerHTML = sortedPTs.length
      ? sortedPTs.map((item) => `<div class="chart-legend-item" title="${escapeHtml(item.name)}: ${item.count} bus (${item.percentage}%)"><span class="chart-legend-dot" style="background-color: ${item.color}"></span><span class="chart-legend-label">${escapeHtml(item.name)}</span><div class="chart-legend-stat"><span class="chart-legend-value">${item.count} bus</span><span>(${item.percentage}%)</span></div></div>`).join('')
      : '<p class="empty-state">Belum ada data PT untuk ditampilkan.</p>';
  }
  const routeCountMap = {};
  busBrandingMap.forEach((branding) => {
    const route = getBrandingRoute(branding) || 'Lainnya';
    routeCountMap[route] = (routeCountMap[route] || 0) + 1;
  });
  drawJalurChart('chart-jalur', routeCountMap);
  const estimatedRevenue = renderDashboardRevenue(scopedBrandings);
  const revenueKpi = byId('kpi-estimated-revenue');
  if (revenueKpi) {
    const compactRevenue = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format((Number(estimatedRevenue) || 0) / 1_000_000_000);
    revenueKpi.textContent = `Rp ${compactRevenue} M`;
    const fullRevenue = typeof window.formatRupiah === 'function'
      ? window.formatRupiah(estimatedRevenue)
      : `Rp ${Number(estimatedRevenue || 0).toLocaleString('id-ID')}`;
    revenueKpi.title = fullRevenue;
    revenueKpi.setAttribute('aria-label', `${fullRevenue} estimasi pendapatan`);
  }
  renderDashboardCalendar();
  renderDashboardExpirations(filters);
  const dashboardActiveBrandings = runningBrandings.slice(0, 5);
  byId('dashboard-branding-body').innerHTML = dashboardActiveBrandings.length
    ? dashboardActiveBrandings.map((branding, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(getBrandingRoute(branding))}</td>
        <td>${escapeHtml(String(branding.noLamb || '—'))}</td>
        <td><span class="status-chip status-${effectiveStatus(branding).toLowerCase()}">${escapeHtml(effectiveStatus(branding))}</span></td>
        <td>${escapeHtml(getBrandingNoPolisi(branding))}</td>
        <td>${escapeHtml(branding.tipeBus || '—')}</td>
        <td>${escapeHtml(getBrandingBrand(branding))}</td>
        <td>${escapeHtml(formatDate(branding.tanggalSelesai || branding['Akhir Penayangan']))}</td>
        <td>${escapeHtml(getBrandingJenis(branding))}</td>
        <td>${escapeHtml(branding.keterangan || '—')}</td>
      </tr>`).join('')
    : emptyRow(10, 'Belum ada branding berstatus Berjalan yang sesuai filter.');
}

function renderDashboardRevenue(items) {
  const totalElement = byId('dashboard-revenue-total');
  const canvas = byId('dashboard-revenue-chart');
  if (!totalElement || !canvas || typeof window.calculateDashboardRevenue !== 'function') return 0;

  const year = new Date().getFullYear();
  const revenue = window.calculateDashboardRevenue(items, year);
  totalElement.textContent = window.formatRupiah(revenue.total);
  const context = canvas.getContext('2d');
  if (!context) return revenue.total;
  const yScale = typeof window.revenueChartYScale === 'function'
    ? window.revenueChartYScale(revenue.months)
    : {
        beginAtZero: true,
        ticks: { callback: (value) => window.formatRupiah(value) }
      };
  const chartText = dashboardVisualToken('--color-ink-muted', '#73877e');
  const chartGrid = dashboardVisualToken('--color-border', '#e3e8e3');

  if (window.__dashboardRevenueChart) window.__dashboardRevenueChart.destroy();
  window.__dashboardRevenueChart = new Chart(context, {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [{
        label: 'Pendapatan Branding',
        data: revenue.months,
        backgroundColor: dashboardVisualToken('--color-primary', '#0E4A31'),
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: dashboardVisualToken('--color-surface-raised', '#242f2a'),
          titleColor: dashboardVisualToken('--color-ink', '#1b2b25'),
          bodyColor: dashboardVisualToken('--color-ink', '#1b2b25'),
          borderColor: dashboardVisualToken('--color-border-strong', '#ccd7d1'),
          borderWidth: 1,
          padding: 8
        }
      },
      scales: {
        y: {
          ...yScale,
          ticks: { ...yScale.ticks, color: chartText },
          grid: { ...yScale.grid, color: chartGrid },
        },
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: chartText, maxRotation: 0, autoSkip: false }
        }
      }
    }
  });
  return revenue.total;
}

function dashboardCalendarFilters() {
  return {
    companies: dashboardCalendarCompanies,
    type: value('dashboard-calendar-type'),
    bus: value('dashboard-calendar-bus'),
  };
}

function renderDashboardCompanyOptions(companies) {
  const container = byId('dashboard-calendar-company-options');
  const summary = byId('dashboard-calendar-company-summary');
  if (!container || !summary) return;
  const companyNames = [...new Set(companies)].sort((a, b) => a.localeCompare(b, 'id'));
  const available = new Set(companyNames);
  [...dashboardCalendarCompanies].forEach((company) => {
    if (!available.has(company)) dashboardCalendarCompanies.delete(company);
  });
  summary.textContent = dashboardCalendarCompanies.size
    ? `${dashboardCalendarCompanies.size} Company`
    : 'Semua Company';
  container.innerHTML = `
    <label class="dashboard-company-option">
      <input type="checkbox" data-calendar-company-all ${dashboardCalendarCompanies.size ? '' : 'checked'} />
      <span>Semua Company</span>
    </label>
    ${companyNames.map((company) => `<label class="dashboard-company-option">
      <input type="checkbox" data-calendar-company="${escapeHtml(company)}" ${dashboardCalendarCompanies.has(company) ? 'checked' : ''} />
      <span>${escapeHtml(company)}</span>
    </label>`).join('')}`;
}

function renderDashboardCalendar() {
  const content = byId('dashboard-calendar-content');
  if (!content) return;
  const year = dashboardCalendarMonth.getFullYear();
  const month = dashboardCalendarMonth.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
  const companyNames = brandings.map(getBrandingPT);
  renderDashboardCompanyOptions(companyNames);
  const filters = dashboardCalendarFilters();
  const busByNoPolisi = new Map(buses.map((bus) => [bus.noPolisi, bus]));
  const label = byId('dashboard-calendar-month-label');
  if (label) label.textContent = dashboardCalendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const candidateItems = brandings.flatMap((branding) => {
    const start = parseToIsoDate(branding.tanggalMulai || branding['Tanggal Mulai']);
    const end = parseToIsoDate(branding.tanggalSelesai || branding['Akhir Penayangan']);
    if (!start || !end || !overlapsMonth(start, end, year, month)) return [];
    const clippedStart = start < monthStart ? monthStart : start;
    const clippedEnd = end > monthEnd ? monthEnd : end;
    return [{
      branding,
      company: getBrandingPT(branding),
      noPolisi: getBrandingNoPolisi(branding),
      noLamb: busByNoPolisi.get(getBrandingNoPolisi(branding))?.noLamb || branding.noLamb || '',
      type: getBrandingJenis(branding),
      startDay: Number(clippedStart.slice(8, 10)),
      endDay: Number(clippedEnd.slice(8, 10)),
    }];
  });
  const items = filterCalendarRecords(candidateItems, filters).sort((a, b) => a.company.localeCompare(b.company, 'id')
    || a.noPolisi.localeCompare(b.noPolisi, 'id')
    || getBrandingBrand(a.branding).localeCompare(getBrandingBrand(b.branding), 'id'));

  if (!items.length) {
    content.innerHTML = '<p class="dashboard-calendar-empty">Tidak ada branding yang sesuai dengan periode dan filter ini.</p>';
    return;
  }

  const companies = groupCalendarRecordsByCompanyAndBus(items);
  const dayHeadings = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, month, day);
    const weekday = date.toLocaleDateString('id-ID', { weekday: 'short' });
    return `<span title="${escapeHtml(`${weekday}, ${day} ${MONTHS[month]} ${year}`)}">${day}</span>`;
  }).join('');
  const companyRows = [...companies.entries()].map(([company, companyBuses]) => {
    const companyItems = [...companyBuses.values()];
    const brandingCount = companyItems.reduce((total, bus) => total + bus.records.length, 0);
    const expanded = expandedCalendarCompanies.has(company);
    const previewItems = companyItems.flatMap((bus) => bus.records);
    const preview = calendarPreviewLanes(previewItems);
    const previewBars = preview.visible.map(({ branding, startDay, endDay, laneIndex }) => {
      const noPolisi = getBrandingNoPolisi(branding);
      const bus = companyItems.find((item) => item.noPolisi === noPolisi);
      const brand = getBrandingBrand(branding) || 'Branding';
      const type = getBrandingJenis(branding);
      const start = parseToIsoDate(branding.tanggalMulai || branding['Tanggal Mulai']);
      const end = parseToIsoDate(branding.tanggalSelesai || branding['Akhir Penayangan']);
      const left = ((startDay - 1) / dayCount) * 100;
      const width = ((endDay - startDay + 1) / dayCount) * 100;
      return `<button type="button" class="dashboard-calendar-bar is-preview" data-dashboard-branding-id="${escapeHtml(branding.id)}" style="left:${left}%;width:${width}%;top:${laneIndex * 22 + 3}px" title="${escapeHtml(`${brand} · ${company} · ${noPolisi} · ${bus?.noLamb || '—'} · ${type} · ${formatDate(start)}–${formatDate(end)}`)}" aria-label="Buka detail ${escapeHtml(brand)} di ${escapeHtml(company)}, bus ${escapeHtml(noPolisi)}"></button>`;
    }).join('');
    const busRows = expanded ? companyItems.map((bus) => {
      const segments = assignCalendarLanes(bus.records);
      const laneCount = Math.max(...segments.map((segment) => segment.laneIndex + 1), 1);
      const bars = segments.map(({ branding, startDay, endDay, laneIndex }) => {
        const brand = getBrandingBrand(branding) || 'Branding';
        const type = getBrandingJenis(branding);
        const barLeft = ((startDay - 1) / dayCount) * 100;
        const barWidth = ((endDay - startDay + 1) / dayCount) * 100;
        const start = parseToIsoDate(branding.tanggalMulai || branding['Tanggal Mulai']);
        const end = parseToIsoDate(branding.tanggalSelesai || branding['Akhir Penayangan']);
        return `<button type="button" class="dashboard-calendar-bar" data-dashboard-branding-id="${escapeHtml(branding.id)}" style="left:${barLeft}%;width:${barWidth}%;top:${laneIndex * 27 + 3}px" title="${escapeHtml(`${brand} · ${company} · ${bus.noPolisi} · ${bus.noLamb} · ${type} · ${formatDate(start)}–${formatDate(end)}`)}" aria-label="Buka detail ${escapeHtml(brand)}, ${escapeHtml(type)}, bus ${escapeHtml(bus.noPolisi)}"><span>${escapeHtml(brand)} · ${escapeHtml(type)}</span></button>`;
      }).join('');
      const recordLabels = bus.records.map((item) => `${getBrandingBrand(item.branding) || 'Branding'} · ${getBrandingJenis(item.branding)}`).join(' / ');
      return `<div class="dashboard-calendar-row">
        <div class="dashboard-calendar-row-label">
          <strong>${escapeHtml(bus.noPolisi || 'Bus belum ditentukan')}</strong>
          <small>${escapeHtml(bus.noLamb)} · ${escapeHtml(recordLabels)}</small>
        </div>
        <div class="dashboard-calendar-track" style="height:${laneCount * 27 + 6}px">${bars}</div>
        <span class="dashboard-calendar-count-spacer" aria-hidden="true"></span>
      </div>`;
    }).join('') : '';
    const previewLaneCount = Math.min(2, Math.max(...preview.visible.map((item) => item.laneIndex + 1), 1));
    return `<section class="dashboard-calendar-company-group${expanded ? ' is-expanded' : ''}">
      <div class="dashboard-calendar-company-header">
        <button type="button" class="dashboard-calendar-company-toggle" data-calendar-company-toggle="${escapeHtml(company)}" aria-expanded="${expanded}">
          <span class="dashboard-calendar-company-chevron${expanded ? ' is-expanded' : ' is-collapsed'}" aria-hidden="true">▸</span>
          <span class="dashboard-calendar-company-name">${escapeHtml(company)}</span>
        </button>
        <div class="dashboard-calendar-company-preview dashboard-calendar-track" style="height:${previewLaneCount * 22 + 8}px" aria-label="${brandingCount} branding dalam timeline bulan ini">
          ${previewBars}
          ${preview.more ? `<span class="dashboard-calendar-preview-more">+ ${preview.more} more</span>` : ''}
        </div>
        <span class="dashboard-calendar-company-count">${brandingCount} Branding</span>
      </div>
      ${expanded ? `<div class="dashboard-calendar-company-body">${busRows}</div>` : ''}
    </section>`;
  }).join('');
  content.innerHTML = `<div class="dashboard-calendar-scroll"><div class="dashboard-calendar-grid" style="--calendar-days:${dayCount}">
    <div class="dashboard-calendar-date-label">Company / Bus</div><div class="dashboard-calendar-days">${dayHeadings}</div><span class="dashboard-calendar-count-spacer" aria-hidden="true"></span>
    ${companyRows}
  </div></div>`;
}

function renderDashboardExpirations() {
  const body = byId('dashboard-expiration-body');
  if (!body) return;
  const filters = arguments[0] || currentBrandingFilters('dashboard');
  const records = brandings.filter((branding) => brandingMatches(branding, filters)).flatMap((branding) => {
    if (effectiveStatus(branding) === 'SELESAI') return [];
    const end = parseToIsoDate(branding.tanggalSelesai || branding['Akhir Penayangan']);
    const daysRemaining = end ? daysUntil(end) : null;
    const bucket = expirationBucket(daysRemaining);
    return bucket ? [{ branding, end, daysRemaining, bucket }] : [];
  }).sort((a, b) => a.daysRemaining - b.daysRemaining
    || getBrandingBrand(a.branding).localeCompare(getBrandingBrand(b.branding), 'id'));
  const counts = {
    seven: records.filter((item) => item.bucket === 'seven').length,
    thirty: records.filter((item) => item.bucket === 'thirty').length,
    expired: records.filter((item) => item.bucket === 'expired').length,
  };
  byId('dashboard-expiration-seven').textContent = counts.seven;
  byId('dashboard-expiration-thirty').textContent = counts.thirty;
  byId('dashboard-expiration-expired').textContent = counts.expired;
  const visibleRecords = records.slice(0, 5);
  body.innerHTML = visibleRecords.length
    ? visibleRecords.map(({ branding, end, daysRemaining, bucket }) => {
      const noPolisi = getBrandingNoPolisi(branding);
      const bus = buses.find((item) => item.noPolisi === noPolisi);
      const noLamb = branding.noLamb || bus?.noLamb || '—';
      const dayLabel = daysRemaining < 0 ? `${Math.abs(daysRemaining)} hari lalu`
        : daysRemaining === 0 ? 'Hari ini' : `${daysRemaining} hari`;
      const expirationLabel = bucket === 'expired' ? 'Expired'
        : bucket === 'seven' ? 'Akan Berakhir' : '≤ 30 Hari';
      return `<tr>
        <td><button type="button" class="dashboard-expiration-open" data-dashboard-branding-id="${escapeHtml(branding.id)}">${escapeHtml(getBrandingPT(branding))} / ${escapeHtml(getBrandingBrand(branding) || 'Branding')}</button></td>
        <td>${escapeHtml(noPolisi || '—')}</td><td>${escapeHtml(String(noLamb))}</td>
        <td>${escapeHtml(getBrandingJenis(branding))}</td><td>${escapeHtml(formatDate(end))}</td>
        <td><span class="dashboard-expiration-state ${bucket === 'expired' ? 'status-expired' : bucket === 'seven' ? 'status-soon' : 'status-upcoming'}" title="${escapeHtml(expirationLabel)}">${escapeHtml(dayLabel)}</span></td>
        <td><span class="status-chip status-${effectiveStatus(branding).toLowerCase()}">${escapeHtml(effectiveStatus(branding))}</span></td>
      </tr>`;
    }).join('')
    : emptyRow(7, 'Tidak ada branding yang jatuh tempo dalam kategori ini.');
}

// ============================================================
// BOOKING BUS LIST
// ============================================================

function renderBookingBuses() {
  const jenisBranding = value('booking-type');
  const tanggalMulai = value('start-date');
  const tanggalSelesai = value('end-date');
  const ready = jenisBranding && tanggalMulai && tanggalSelesai && tanggalMulai <= tanggalSelesai;
  const query = value('booking-bus-search').trim().toLowerCase();
  const availableBuses = buses.filter((bus) => `${bus.noLamb || ''} ${bus.noPolisi || ''}`.toLowerCase().includes(query));
  const list = byId('booking-bus-list');
  list.innerHTML = availableBuses.map((bus) => {
    let disabled = !ready;
    let reason = !ready ? 'Pilih jenis dan periode penayangan terlebih dahulu' : 'Tersedia';
    if (ready) {
      const { disabled: disabledTypes, conflictMap } = getDisabledTypes(bus, tanggalMulai, tanggalSelesai);
      if (disabledTypes.has(jenisBranding)) {
        disabled = true;
        reason = buildConflictReason([...conflictMap.keys()]);
      }
    }
    if (disabled) selectedBookingBusIds.delete(bus.noPolisi);
    return `<label class="bus-option${disabled ? ' is-disabled' : ''}"><input type="checkbox" value="${escapeHtml(bus.noPolisi)}" data-bus-checkbox${disabled ? ' disabled' : ''}${selectedBookingBusIds.has(bus.noPolisi) ? ' checked' : ''} /><span class="bus-option-main"><strong>${escapeHtml(String(bus.noLamb || '—'))}</strong><span>${escapeHtml(bus.noPolisi)}</span></span><small>${escapeHtml(reason)}</small></label>`;
  }).join('');
  if (!availableBuses.length) list.innerHTML = '<p class="bus-list-empty">Bus tidak ditemukan.</p>';
  byId('booking-selection-count').textContent = `${selectedBookingBusIds.size} bus dipilih`;
}

// ============================================================
// FILTER OPTIONS + RENDER ALL
// ============================================================

function updateFilterOptions() {
  const routes = [...configuredValues('jalur', buses.map((bus) => bus.jalurBus)), ...buses.map((bus) => bus.jalurBus)];
  const types = brandings.map((branding) => branding.jenisBranding).concat(configuredValues('brandingTypes', BRANDING_TYPES));
  const brands = brandings.map((branding) => branding.namaBrand);
  const years = brandings.map((branding) => (branding.tanggalSelesai || '').slice(0, 4)).filter(Boolean);
  ['master-route', 'branding-route', 'history-route', 'dashboard-route'].forEach((id) =>
    setOptions(id, routes, id === 'master-route' ? 'Semua Jalur Bus' : 'Semua Jalur'));
  const trayekFilter = byId('master-trayek');
  const currentTrayek = trayekFilter.value;
  trayekFilter.innerHTML = `<option value="">Semua Trayek</option><option value="__unset__">Kode trayek belum tersedia</option>${TRAYEK_MASTER.map((trayek) =>
    `<option value="${escapeHtml(trayek.code)}">${escapeHtml(trayek.code)} — ${escapeHtml(trayek.name)}</option>`
  ).join('')}`;
  trayekFilter.value = currentTrayek === '__unset__' || TRAYEK_MASTER.some((trayek) => trayek.code === currentTrayek) ? currentTrayek : '';
  ['branding-type', 'history-type', 'dashboard-type'].forEach((id) => setOptions(id, types, 'Semua Jenis'));
  ['branding-brand', 'history-brand', 'dashboard-brand'].forEach((id) => setOptions(id, brands, 'Semua Brand'));
  setOptions('dashboard-calendar-type', brandings.map(getBrandingJenis).concat(configuredValues('brandingTypes', BRANDING_TYPES)), 'Semua Type');
  const calendarBusSelect = byId('dashboard-calendar-bus');
  if (calendarBusSelect) {
    const selectedBus = calendarBusSelect.value;
    const busChoices = [...new Set([
      ...buses.map((bus) => bus.noPolisi),
      ...brandings.map(getBrandingNoPolisi),
    ].filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'id'));
    calendarBusSelect.innerHTML = `<option value="">Semua Bus</option>${busChoices.map((noPolisi) => {
      const bus = buses.find((item) => item.noPolisi === noPolisi);
      const label = bus?.noLamb ? `${bus.noPolisi} · ${bus.noLamb}` : noPolisi;
      return `<option value="${escapeHtml(noPolisi)}">${escapeHtml(label)}</option>`;
    }).join('')}`;
    calendarBusSelect.value = busChoices.includes(selectedBus) ? selectedBus : '';
  }
  ['branding-status', 'dashboard-status'].forEach((id) => setOptions(id, BRANDING_STATUSES, 'Semua Status'));
  setOptions('rekap-filter-jalur', routes, 'Semua Jalur');
  setOptions('history-year', years, 'Semua Tahun');
  const monthSelect = byId('history-month');
  const currentMonth = monthSelect.value;
  monthSelect.innerHTML = `<option value="">Semua Bulan</option>${MONTHS.map((month, index) => `<option value="${String(index + 1).padStart(2, '0')}">${month}</option>`).join('')}`;
  monthSelect.value = [...monthSelect.options].some((option) => option.value === currentMonth) ? currentMonth : '';
}

function renderAll() {
  updateFilterOptions();
  renderMasterBus();
  renderBrandings();
  renderHistory();
  renderDashboard();
  renderBookingBuses();
  renderRekap();
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadData() {
  const [busSnapshot, brandingSnapshot] = await Promise.all([getDocs(collection(db, 'buses')), getDocs(collection(db, 'brandings'))]);
  buses = busSnapshot.docs.map((snapshot) => ({ ...snapshot.data(), noPolisi: snapshot.data().noPolisi || snapshot.id })).sort((a, b) => String(a.noPolisi).localeCompare(String(b.noPolisi), 'id'));
  brandings = brandingSnapshot.docs.map((snapshot) => ({ ...snapshot.data(), id: snapshot.id })).sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')));
  window.__brandingDashboardData = { buses, brandings };
  window.dispatchEvent(new CustomEvent('branding-dashboard-data-ready', { detail: { buses, brandings } }));
  window.__brandingMasterDefaults = {
    busTypes: [...new Set(buses.map((bus) => String(bus.tipeBus || '').trim()).filter(Boolean))],
    jalur: [...new Set(buses.map((bus) => String(bus.jalurBus || '').trim()).filter(Boolean))],
    brandingTypes: BRANDING_TYPES,
  };
  renderAll();
  refreshManagedDropdowns();
}

async function refreshData(successMessage) {
  try {
    await loadData();
    if (successMessage) showNotice(successMessage);
  } catch (error) {
    console.error('Gagal membaca Firestore:', error);
    showNotice('Firebase gagal memuat data. Periksa login dan Firestore Rules.', 'error');
  }
}

// ============================================================
// IMPORT / EXPORT
// ============================================================

async function importBusCsv(file) {
  if (!file) return;
  if (!can('masterBus.edit')) throw new Error('Anda tidak memiliki izin mengimpor Master Bus.');
  const rows = parseCsv(await file.text());
  const headerIndex = rows.findIndex((row) => row.some((header) => header.trim().toLowerCase() === 'no polisi'));
  if (headerIndex === -1) throw new Error('Header "No Polisi" tidak ditemukan. Gunakan format master-bus.csv.');
  const headers = rows[headerIndex];
  const column = (...names) => headers.findIndex((header) => names.some((name) => header.trim().toLowerCase() === name.toLowerCase()));
  const required = [
    ['No'], ['No Polisi'], ['No Lamb', 'No. Lamb'], ['Tipe Bus'],
    ['Ket'], ['Warna Bus'], ['Jalur Bus'], ['Karoseri'],
  ];
  if (required.some((names) => column(...names) === -1)) throw new Error('Kolom CSV tidak sesuai format master-bus.csv.');
  const routeColumn = column('Kode Trayek', 'Trayek Code', 'Trayek');
  const importMap = new Map();
  const routeErrors = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const noPolisi = row[column('No Polisi')]?.trim();
    if (!noPolisi) return;
    const trayekCode = routeColumn === -1 ? '' : (row[routeColumn] || '').trim();
    const trayek = trayekCode ? findTrayek(trayekCode) : null;
    if (trayekCode && !trayek) {
      routeErrors.push(`Baris ${headerIndex + index + 2}: Kode trayek '${trayekCode}' tidak ditemukan dalam master trayek.`);
      return;
    }
    const bus = {
      no: row[column('No')] || '',
      noPolisi,
      noLamb: row[column('No Lamb', 'No. Lamb')] || '',
      tipeBus: row[column('Tipe Bus')] || '',
      ket: row[column('Ket')] || '',
      warnaBus: row[column('Warna Bus')] || '',
      jalurBus: row[column('Jalur Bus')] || '',
      karoseri: row[column('Karoseri')] || '',
    };
    if (trayek) bus.kodeTrayek = trayek.code;
    importMap.set(noPolisi, bus);
  });
  if (routeErrors.length) throw new Error(`Validasi Kode Trayek gagal:\n${routeErrors.slice(0, 8).join('\n')}${routeErrors.length > 8 ? '\n...dan lainnya.' : ''}`);
  const items = [...importMap.values()];
  if (!items.length) throw new Error('Tidak ada baris bus yang valid untuk diimport.');
  const confirm = await showConfirmModal('Import Master Bus', `Import atau update ${items.length} bus ke Firestore?\nData branding tidak akan diubah.`, 'Import Bus');
  if (!confirm) return;
  for (let start = 0; start < items.length; start += 450) {
    const batch = writeBatch(db);
    items.slice(start, start + 450).forEach((bus) => batch.set(doc(db, 'buses', bus.noPolisi), bus, { merge: true }));
    await batch.commit();
  }
  await refreshData();
  showNotice(`${items.length} bus berhasil diimport atau diperbarui.`);
}

const MASTER_BUS_CSV_COLUMNS = ['No', 'No Polisi', 'No Lamb', 'Tipe Bus', 'Kode Trayek', 'Ket', 'Warna Bus', 'Jalur Bus', 'Karoseri'];

function exportMasterBusCsv() {
  const data = buses.map((bus, index) => [
    bus.no || index + 1,
    bus.noPolisi || '',
    bus.noLamb || '',
    bus.tipeBus || '',
    busTrayekCode(bus),
    bus.ket || '',
    bus.warnaBus || '',
    bus.jalurBus || '',
    bus.karoseri || '',
  ]);
  downloadCsv(`master-bus-${today()}.csv`, [MASTER_BUS_CSV_COLUMNS, ...data]);
  showNotice('Export Master Bus berhasil diunduh.');
}

function downloadMasterBusTemplate() {
  downloadCsv('template-import-master-bus.csv', [MASTER_BUS_CSV_COLUMNS]);
}

function exportBrandingCsv(items, filename) {
  const data = items.map((branding, index) => [branding.id, index + 1, branding.jalurBus, branding.noLamb, branding.no || '', branding.noLamb || '', effectiveStatus(branding), branding.noPolisi, branding.tipeBus, branding.namaBrand, branding.namaPT || '', branding.tanggalBooking || '', branding.tanggalMulai || '', formatDate(branding.tanggalSelesai), branding.jenisBranding, branding.keterangan]);
  downloadCsv(filename, [BRANDING_CSV_COLUMNS, ...data]);
}

function downloadBrandingTemplateCsv() {
  downloadCsv('template-import-branding.csv', [BRANDING_CSV_COLUMNS]);
}

async function importBrandingCsv(file) {
  if (!file) return;
  if (!can('branding.import')) throw new Error('Anda tidak memiliki izin mengimpor Data Branding.');
  if (window.__brandingPricingShared === false) throw new Error('Simpan Pricelist Branding bersama terlebih dahulu sebelum mengimpor data.');
  const rows = parseCsv(await file.text());
  const normalizeHeader = (header) => String(header || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const noPolisiHeaders = ['No Polisi', 'Nomor Polisi', 'Plat Nomor', 'Nopol'].map(normalizeHeader);
  const brandingTypeHeaders = ['Jenis Branding', 'Space Iklan', 'Jenis Iklan'].map(normalizeHeader);
  const headerIndex = rows.findIndex((row) => {
    const normalizedHeaders = row.map(normalizeHeader);
    return normalizedHeaders.some((header) => noPolisiHeaders.includes(header))
      && normalizedHeaders.some((header) => brandingTypeHeaders.includes(header));
  });
  if (headerIndex === -1) throw new Error('Header "No Polisi" atau "Jenis Branding" tidak ditemukan. Gunakan template yang disediakan.');
  const headers = rows[headerIndex];
  const column = (...names) => headers.findIndex((header) => names.some((name) => normalizeHeader(header) === normalizeHeader(name)));
  const idCol = column('ID Branding', 'ID');
  const nopolCol = column('No Polisi', 'Nomor Polisi', 'Plat Nomor', 'Nopol');
  const typeCol = column('Jenis Branding', 'Space Iklan', 'Jenis Iklan');
  const endCol = column('Akhir Penayangan', 'Tanggal Selesai', 'Tanggal Akhir', 'Tgl Akhir');
  const startCol = column('Tanggal Mulai', 'Mulai Penayangan', 'Awal Penayangan', 'Tanggal Awal', 'Tgl Mulai');
  const bookCol = column('Tanggal Booking', 'Tgl Booking');
  if (nopolCol === -1 || typeCol === -1) throw new Error('Kolom CSV tidak sesuai format template.');
  const updates = [];
  const creates = [];
  let errors = [];
  const missingStartDates = [];
  const pricingWarnings = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const rowNum = index + headerIndex + 2;
    if (!row.some(Boolean)) return;
    const id = idCol !== -1 ? row[idCol]?.trim() : '';
    const noPolisi = row[nopolCol]?.trim();
    const jenisBranding = row[typeCol]?.trim();
    const rawStartDate = startCol !== -1 ? row[startCol]?.trim() : '';
    const rawEndDate = endCol !== -1 ? row[endCol]?.trim() : '';
    const tanggalMulai = rawStartDate ? parseToIsoDate(rawStartDate) : '';
    const tanggalSelesai = rawEndDate ? parseToIsoDate(rawEndDate) : '';
    if (!noPolisi || !jenisBranding) { errors.push(`Baris ${rowNum}: No Polisi dan Jenis Branding wajib diisi.`); return; }
    const bus = buses.find((b) => b.noPolisi === noPolisi);
    if (!bus && !id) { errors.push(`Baris ${rowNum}: No Polisi ${noPolisi} tidak ditemukan di Master Bus.`); return; }
    if (tanggalMulai && tanggalSelesai && tanggalMulai > tanggalSelesai) { errors.push(`Baris ${rowNum}: Tanggal mulai > Tanggal akhir.`); return; }
    const conflict = getBusConflict(bus || { noPolisi }, jenisBranding, tanggalMulai, tanggalSelesai, id);
    if (conflict && !id) { errors.push(`Baris ${rowNum}: Bentrok dengan branding ${conflict.jenisBranding} (ID: ${conflict.id}).`); return; }
    const record = {
      noPolisi, jenisBranding, tanggalSelesai, tanggalMulai: tanggalMulai || '',
      tanggalBooking: bookCol !== -1 ? row[bookCol]?.trim() : '',
      namaBrand: column('Nama Brand') !== -1 ? row[column('Nama Brand')]?.trim() : '',
      namaPT: column('Nama PT') !== -1 ? row[column('Nama PT')]?.trim() : '',
      status: column('Status') !== -1 ? row[column('Status')]?.trim() : 'BOOKING',
      keterangan: column('Keterangan') !== -1 ? row[column('Keterangan')]?.trim() : '',
      no: bus?.no || row[column('No', 'NO')]?.trim() || '', noLamb: bus?.noLamb || row[column('No. Lamb', 'No Lamb')]?.trim() || '',
      tipeBus: bus?.tipeBus || row[column('Type')]?.trim() || '',
      jalurBus: bus?.jalurBus || row[column('JALUR', 'Jalur Bus')]?.trim() || '',
      ...auditFields(),
    };
    record.pricingSnapshot = getPricingSnapshot(record);
    if (!tanggalMulai) missingStartDates.push({ rowNum, noPolisi });
    const pricingReason = getBookingPricingReason(record);
    if (pricingReason) pricingWarnings.push({ rowNum, noPolisi, reason: pricingReason });
    if (id) updates.push({ id, ...record }); else creates.push(record);
  });
  if (errors.length > 0) {
    await showConfirmModal('Validasi Error', `Ditemukan ${errors.length} error pada CSV:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...dan lainnya.' : ''}\n\nPerbaiki file CSV dan coba lagi.`, 'Tutup', true);
    return;
  }
  if (updates.length === 0 && creates.length === 0) throw new Error('Tidak ada baris branding yang valid untuk diimport.');
  const confirm = await showConfirmModal('Konfirmasi Import', `File divalidasi.\n\nTotal data baru: ${creates.length}\nData akan diperbarui: ${updates.length}\nTotal operasi: ${creates.length + updates.length}\n\nLanjutkan import?`, 'Import');
  if (!confirm) return;
  showNotice('Menyimpan...', 'success');
  const allOps = [...creates.map((c) => ({ type: 'create', data: c })), ...updates.map((u) => ({ type: 'update', data: u }))];
  for (let start = 0; start < allOps.length; start += 450) {
    const batch = writeBatch(db);
    allOps.slice(start, start + 450).forEach((op) => {
      if (op.type === 'create') batch.set(doc(collection(db, 'brandings')), op.data);
      else { const { id, ...data } = op.data; batch.set(doc(db, 'brandings', id), data, { merge: true }); }
    });
    await batch.commit();
  }
  await refreshData();
  if (missingStartDates.length) {
    console.warn('[Import Branding] Tanggal mulai tidak ditemukan; booking ini tidak dapat dihitung di Pendapatan Branding:', missingStartDates);
  }
  const warnings = [
    missingStartDates.length ? `${missingStartDates.length} baris tidak memiliki tanggal mulai.` : '',
    pricingWarnings.length ? `${pricingWarnings.length} baris belum memiliki tier harga; lihat Status Harga di Pendapatan Branding.` : '',
  ].filter(Boolean);
  if (pricingWarnings.length) console.warn('[Import Branding] Tier harga belum tersedia:', pricingWarnings);
  showNotice(`Import berhasil. ${creates.length} data baru dan ${updates.length} diperbarui.${warnings.length ? ` ${warnings.join(' ')}` : ''}`);
}

// ============================================================
// BOOKING SAVE
// ============================================================

async function saveBooking(event) {
  event.preventDefault();
  if (!can('booking.create')) { showNotice('Anda tidak memiliki izin membuat Booking.', 'error'); return; }
  if (window.__brandingPricingShared === false) { showNotice('Simpan Pricelist Branding bersama terlebih dahulu sebelum membuat Booking.', 'error'); return; }
  const form = event.currentTarget;
  const formData = new FormData(form);
  const selectedBusIds = [...selectedBookingBusIds];
  const tanggalMulai = formData.get('tanggalMulai');
  const tanggalSelesai = formData.get('tanggalSelesai');
  const jenisBranding = formData.get('jenisBranding');
  if (tanggalMulai > tanggalSelesai) { showNotice('Tanggal mulai tidak boleh setelah tanggal akhir.', 'error'); return; }
  if (!selectedBusIds.length) { showNotice('Pilih minimal satu bus yang tersedia.', 'error'); return; }
  const selectedBuses = buses.filter((bus) => selectedBusIds.includes(bus.noPolisi));
  // Backend conflict re-validation before saving
  const conflictingBuses = selectedBuses.filter((bus) => busHasConflict(bus, jenisBranding, tanggalMulai, tanggalSelesai));
  if (conflictingBuses.length) { showNotice(`Conflict terdeteksi pada ${conflictingBuses.length} bus. Pilih ulang bus yang tersedia.`, 'error'); renderBookingBuses(); return; }
  const saveButton = byId('save-booking');
  saveButton.disabled = true;
  try {
    const pricingWarnings = [];
    const batch = writeBatch(db);
    selectedBuses.forEach((bus) => {
      const record = { no: bus.no || '', noPolisi: bus.noPolisi, noLamb: bus.noLamb || '', tipeBus: bus.tipeBus || '', jalurBus: bus.jalurBus || '', namaBrand: formData.get('namaBrand').trim(), namaPT: formData.get('namaPT').trim(), jenisBranding, tanggalBooking: formData.get('tanggalBooking'), tanggalMulai, tanggalSelesai, status: formData.get('status'), keterangan: formData.get('keterangan').trim(), ...auditFields() };
      record.pricingSnapshot = getPricingSnapshot(record);
      const pricingReason = getBookingPricingReason(record);
      if (pricingReason) pricingWarnings.push({ noPolisi: bus.noPolisi, reason: pricingReason });
      batch.set(doc(collection(db, 'brandings')), record);
    });
    await batch.commit();
    form.reset();
    byId('booking-date').value = today();
    selectedBookingBusIds = new Set();
    byId('booking-bus-search').value = '';
    await refreshData();
    if (pricingWarnings.length) console.warn('[Booking Branding] Tier harga belum tersedia:', pricingWarnings);
    showNotice(`${selectedBuses.length} record branding berhasil disimpan.${pricingWarnings.length ? ` ${pricingWarnings.length} record belum memiliki tier harga; lihat Status Harga di Pendapatan Branding.` : ''}`);
  } catch (error) {
    console.error('Gagal menyimpan booking:', error);
    showNotice('Booking gagal disimpan. Periksa koneksi Firebase dan Firestore Rules.', 'error');
  } finally {
    saveButton.disabled = false;
  }
}

// ============================================================
// BUS MODAL
// ============================================================

function openBusModal(bus) {
  const modal = byId('bus-edit-modal');
  const form = byId('bus-edit-form');
  const isNew = !bus;
  const source = bus || {};
  form.dataset.busId = source.noPolisi || '';
  form.dataset.isNew = String(isNew);
  ['no', 'noPolisi', 'noLamb', 'ket', 'warnaBus', 'karoseri'].forEach((field) => { form.elements[field].value = source[field] || ''; });
  const setBusOption = (select, category, fallback, selected, placeholder) => {
    const configured = configuredValues(category, fallback);
    const options = [...new Set([...configured, ...(selected ? [selected] : [])])];
    select.innerHTML = `<option value="">${placeholder}</option>${options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
    select.value = selected || '';
  };
  setBusOption(form.elements.tipeBus, 'busTypes', buses.map((item) => item.tipeBus).filter(Boolean), source.tipeBus || '', 'Pilih tipe bus');
  setBusOption(form.elements.jalurBus, 'jalur', buses.map((item) => item.jalurBus).filter(Boolean), source.jalurBus || '', 'Pilih jalur');
  form.elements.noPolisi.readOnly = !isNew;
  byId('bus-modal-title').textContent = isNew ? 'Tambah Bus' : 'Edit Bus';
  byId('bus-modal-note').textContent = isNew
    ? 'Pilih Kode Trayek jika Jalur Bus bukan kode rute. Nama Trayek akan diisi otomatis.'
    : 'No Polisi adalah identifier dokumen Firestore dan dikunci agar perubahan tidak membuat dokumen bus baru.';
  renderTrayekOptions(form.elements.kodeTrayek, busTrayekCode(source));
  const selectedTrayek = busTrayek(source);
  byId('bus-trayek-name').value = selectedTrayek?.name || '';
  byId('bus-trayek-warning').hidden = Boolean(selectedTrayek);
  byId('save-bus-edit').textContent = isNew ? 'Tambah Bus' : 'Simpan Perubahan';
  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.setAttribute('open', '');
}

function closeBusModal() {
  const modal = byId('bus-edit-modal');
  if (typeof modal.close === 'function') modal.close();
  else modal.removeAttribute('open');
}

async function saveBusEdit(event) {
  event.preventDefault();
  if (!can('masterBus.edit')) { showNotice('Anda tidak memiliki izin mengubah Master Bus.', 'error'); return; }
  const form = event.currentTarget;
  const isNew = form.dataset.isNew === 'true';
  const formData = new FormData(form);
  const busId = isNew ? String(formData.get('noPolisi') || '').trim() : form.dataset.busId;
  const trayek = findTrayek(formData.get('kodeTrayek'));
  if (!busId) {
    showNotice('No Polisi wajib diisi.', 'error');
    return;
  }
  if (isNew && buses.some((bus) => bus.noPolisi === busId)) {
    showNotice(`Bus dengan No Polisi ${busId} sudah terdaftar.`, 'error');
    return;
  }
  if (formData.get('kodeTrayek') && !trayek) {
    showNotice('Kode Trayek tidak ditemukan dalam master trayek. Pilih kode yang tersedia.', 'error');
    return;
  }
  const updatedBus = {
    no: String(formData.get('no') || '').trim(),
    noPolisi: busId,
    noLamb: String(formData.get('noLamb') || '').trim(),
    tipeBus: String(formData.get('tipeBus') || '').trim(),
    kodeTrayek: trayek?.code || '',
    ket: String(formData.get('ket') || '').trim(),
    warnaBus: String(formData.get('warnaBus') || '').trim(),
    jalurBus: String(formData.get('jalurBus') || '').trim(),
    karoseri: String(formData.get('karoseri') || '').trim(),
  };
  const saveButton = byId('save-bus-edit');
  saveButton.disabled = true;
  try {
    await setDoc(doc(db, 'buses', busId), updatedBus, { merge: true });
    closeBusModal();
    await refreshData();
    showNotice(isNew ? `Data bus ${busId} berhasil ditambahkan.` : `Data bus ${busId} berhasil diperbarui.`);
  } catch (error) {
    console.error('Gagal memperbarui bus:', error);
    showNotice('Data bus gagal diperbarui. Periksa Firestore Rules.', 'error');
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteBus(bus) {
  if (!can('masterBus.edit')) { showNotice('Anda tidak memiliki izin menghapus Master Bus.', 'error'); return; }
  const relatedBrandings = brandings.filter((branding) => branding.noPolisi === bus.noPolisi);
  const warning = relatedBrandings.length ? `\n\nPeringatan: ${relatedBrandings.length} data branding terkait tetap ada dan tidak akan dihapus.` : '';
  const confirm = await showConfirmModal('Hapus Master Bus?', `Hapus bus ${bus.noPolisi} dari Master Bus?${warning}`, 'Hapus Data', true);
  if (!confirm) return;
  try {
    await deleteDoc(doc(db, 'buses', bus.noPolisi));
    await refreshData();
    showNotice(`Bus ${bus.noPolisi} berhasil dihapus. Data branding tidak diubah.`);
  } catch (error) {
    console.error('Gagal menghapus bus:', error);
    showNotice('Bus gagal dihapus. Periksa Firestore Rules.', 'error');
  }
}

// ============================================================
// BRANDING MODAL
// ============================================================

function openBrandingModal(branding) {
  const modal = byId('branding-edit-modal');
  const form = byId('branding-edit-form');
  const busSelect = byId('edit-branding-bus');
  form.dataset.brandingId = branding.id;
  const busOptions = buses.map((bus) => `<option value="${escapeHtml(bus.noPolisi)}">${escapeHtml(`${bus.noLamb || '—'} | ${bus.noPolisi}`)}</option>`);
  if (!buses.some((bus) => bus.noPolisi === branding.noPolisi)) busOptions.unshift(`<option value="${escapeHtml(branding.noPolisi)}">${escapeHtml(`${branding.noLamb || '—'} | ${branding.noPolisi} (master bus tidak ditemukan)`)}</option>`);
  busSelect.innerHTML = busOptions.join('');
  ['namaBrand', 'namaPT', 'jenisBranding', 'tanggalBooking', 'tanggalMulai', 'tanggalSelesai', 'status', 'keterangan'].forEach((field) => { form.elements[field].value = branding[field] || ''; });
  busSelect.value = branding.noPolisi;
  byId('branding-edit-error').textContent = '';
  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.setAttribute('open', '');
}

function closeBrandingModal() {
  const modal = byId('branding-edit-modal');
  if (typeof modal.close === 'function') modal.close();
  else modal.removeAttribute('open');
}

async function saveBrandingEdit(event) {
  event.preventDefault();
  if (!can('branding.edit')) { showNotice('Anda tidak memiliki izin mengubah Data Branding.', 'error'); return; }
  if (window.__brandingPricingShared === false) { showNotice('Simpan Pricelist Branding bersama terlebih dahulu sebelum mengubah data.', 'error'); return; }
  const form = event.currentTarget;
  const brandingId = form.dataset.brandingId;
  const formData = new FormData(form);
  const errorElement = byId('branding-edit-error');
  const tanggalMulai = formData.get('tanggalMulai');
  const tanggalSelesai = formData.get('tanggalSelesai');
  const jenisBranding = formData.get('jenisBranding');
  const existingBranding = brandings.find((item) => item.id === brandingId);
  const selectedNoPolisi = formData.get('noPolisi');
  const bus = buses.find((item) => item.noPolisi === selectedNoPolisi) || (existingBranding?.noPolisi === selectedNoPolisi ? existingBranding : null);
  if (tanggalMulai > tanggalSelesai) { errorElement.textContent = 'Tanggal mulai tidak boleh setelah tanggal akhir.'; return; }
  if (!bus) { errorElement.textContent = 'Bus pilihan tidak tersedia di Master Bus.'; return; }
  // Conflict check excluding current record
  const conflict = getBusConflict(bus, jenisBranding, tanggalMulai, tanggalSelesai, brandingId);
  if (conflict) { errorElement.textContent = `Bentrok dengan branding ${conflict.namaBrand || 'lain'} (${conflict.jenisBranding}) pada bus ${bus.noPolisi}.`; return; }
  errorElement.textContent = '';
  const saveButton = byId('save-branding-edit');
  saveButton.disabled = true;
  try {
    const updatedBranding = { no: bus.no || '', noPolisi: bus.noPolisi, noLamb: bus.noLamb || '', tipeBus: bus.tipeBus || '', jalurBus: bus.jalurBus || '', namaBrand: formData.get('namaBrand').trim(), namaPT: formData.get('namaPT').trim(), jenisBranding, tanggalBooking: formData.get('tanggalBooking'), tanggalMulai, tanggalSelesai, status: formData.get('status'), keterangan: formData.get('keterangan').trim(), ...auditFields() };
    updatedBranding.pricingSnapshot = getPricingSnapshot(updatedBranding);
    const pricingReason = getBookingPricingReason(updatedBranding);
    await setDoc(doc(db, 'brandings', brandingId), updatedBranding, { merge: true });
    closeBrandingModal();
    await refreshData();
    showNotice(`Data branding berhasil diperbarui.${pricingReason ? ' Tier harga belum tersedia; lihat Status Harga di Pendapatan Branding.' : ''}`);
  } catch (error) {
    console.error('Gagal memperbarui branding:', error);
    errorElement.textContent = 'Data branding gagal diperbarui. Periksa Firestore Rules.';
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteBranding(branding) {
  if (!can('branding.edit')) { showNotice('Anda tidak memiliki izin menghapus Data Branding.', 'error'); return; }
  const confirm = await showConfirmModal('Hapus Branding?', `Hapus branding "${branding.namaBrand}" pada bus ${branding.noPolisi}?\nData yang dihapus tidak dapat dikembalikan.`, 'Hapus Data', true);
  if (!confirm) return;
  try {
    await deleteDoc(doc(db, 'brandings', branding.id));
    await refreshData();
    showNotice(`Branding ${branding.namaBrand} pada bus ${branding.noPolisi} berhasil dihapus.`);
  } catch (error) {
    console.error('Gagal menghapus branding:', error);
    showNotice('Branding gagal dihapus. Periksa Firestore Rules.', 'error');
  }
}

// ============================================================
// EVENT BINDING
// ============================================================

function bindSortHandler(tableId, state, renderFn) {
  const table = document.querySelector(`#${tableId}`);
  if (!table) return;
  table.querySelector('thead')?.addEventListener('click', (event) => {
    const th = event.target.closest('th[data-sort-key]');
    if (!th) return;
    const key = th.dataset.sortKey;
    if (state.key === key) { state.dir = state.dir === 'asc' ? 'desc' : 'asc'; }
    else { state.key = key; state.dir = 'asc'; }
    renderFn();
  });
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  byId('booking-date').value = today();
  byId('refresh-buses').addEventListener('click', () => refreshData('Data bus diperbarui.'));
  byId('refresh-brandings').addEventListener('click', () => refreshData('Data branding diperbarui.'));
  byId('add-master-bus').addEventListener('click', () => openBusModal(null));
  byId('bus-csv-file').addEventListener('change', async (event) => {
    try { await importBusCsv(event.target.files[0]); } catch (error) { showNotice(error.message, 'error'); } finally { event.target.value = ''; }
  });
  byId('download-master-bus-template').addEventListener('click', downloadMasterBusTemplate);
  byId('export-master-buses').addEventListener('click', exportMasterBusCsv);
  byId('master-search').addEventListener('input', renderMasterBus);
  byId('master-route').addEventListener('change', renderMasterBus);
  byId('master-trayek').addEventListener('change', renderMasterBus);
  byId('master-bus-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const bus = buses.find((item) => item.noPolisi === button.dataset.busId);
    if (!bus) return;
    if (button.dataset.action === 'edit') openBusModal(bus);
    if (button.dataset.action === 'delete') deleteBus(bus);
  });
  byId('bus-edit-form').addEventListener('submit', saveBusEdit);
  byId('bus-trayek').addEventListener('change', () => {
    const trayek = findTrayek(byId('bus-trayek').value);
    byId('bus-trayek-name').value = trayek?.name || '';
    byId('bus-trayek-warning').hidden = Boolean(trayek);
  });
  byId('close-bus-modal').addEventListener('click', closeBusModal);
  byId('cancel-bus-edit').addEventListener('click', closeBusModal);
  ['branding-route', 'branding-status', 'branding-type', 'branding-brand'].forEach((id) => byId(id).addEventListener('change', renderBrandings));
  byId('branding-search').addEventListener('input', renderBrandings);
  byId('branding-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-branding-action]');
    if (!button) return;
    const branding = brandings.find((item) => item.id === button.dataset.brandingId);
    if (!branding) return;
    if (button.dataset.brandingAction === 'edit') openBrandingModal(branding);
    if (button.dataset.brandingAction === 'delete') deleteBranding(branding);
  });
  byId('branding-edit-form').addEventListener('submit', saveBrandingEdit);
  byId('close-branding-modal').addEventListener('click', closeBrandingModal);
  byId('cancel-branding-edit').addEventListener('click', closeBrandingModal);
  ['dashboard-route', 'dashboard-status', 'dashboard-type', 'dashboard-brand'].forEach((id) => byId(id).addEventListener('change', renderDashboard));
  ['dashboard-calendar-type', 'dashboard-calendar-bus'].forEach((id) =>
    byId(id).addEventListener('change', renderDashboardCalendar));
  window.addEventListener('branding-pricing-updated', renderDashboard);
  window.addEventListener('dashboard-theme-change', renderDashboard);
  byId('dashboard-calendar-previous').addEventListener('click', () => {
    dashboardCalendarMonth = new Date(dashboardCalendarMonth.getFullYear(), dashboardCalendarMonth.getMonth() - 1, 1);
    renderDashboardCalendar();
  });
  byId('dashboard-calendar-next').addEventListener('click', () => {
    dashboardCalendarMonth = new Date(dashboardCalendarMonth.getFullYear(), dashboardCalendarMonth.getMonth() + 1, 1);
    renderDashboardCalendar();
  });
  byId('dashboard-calendar-company-options').addEventListener('change', (event) => {
    if (event.target.matches('[data-calendar-company-all]')) {
      dashboardCalendarCompanies.clear();
    } else {
      const checkbox = event.target.closest('[data-calendar-company]');
      if (!checkbox) return;
      if (checkbox.checked) dashboardCalendarCompanies.add(checkbox.dataset.calendarCompany);
      else dashboardCalendarCompanies.delete(checkbox.dataset.calendarCompany);
    }
    renderDashboardCalendar();
  });
  byId('dashboard-calendar-content').addEventListener('click', (event) => {
    const companyToggle = event.target.closest('[data-calendar-company-toggle]');
    if (companyToggle) {
      const company = companyToggle.dataset.calendarCompanyToggle;
      if (expandedCalendarCompanies.has(company)) expandedCalendarCompanies.delete(company);
      else expandedCalendarCompanies.add(company);
      renderDashboardCalendar();
      return;
    }
    const button = event.target.closest('[data-dashboard-branding-id]');
    if (!button) return;
    const branding = brandings.find((item) => item.id === button.dataset.dashboardBrandingId);
    if (branding) openBrandingModal(branding);
  });
  byId('dashboard-expiration-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-dashboard-branding-id]');
    if (!button) return;
    const branding = brandings.find((item) => item.id === button.dataset.dashboardBrandingId);
    if (branding) openBrandingModal(branding);
  });
  ['history-year', 'history-month', 'history-route', 'history-brand', 'history-type'].forEach((id) => byId(id).addEventListener('change', renderHistory));
  ['booking-type', 'start-date', 'end-date'].forEach((id) => byId(id).addEventListener('change', renderBookingBuses));
  byId('booking-bus-search').addEventListener('input', renderBookingBuses);
  byId('booking-bus-list').addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-bus-checkbox]');
    if (!checkbox) return;
    if (checkbox.checked) selectedBookingBusIds.add(checkbox.value);
    else selectedBookingBusIds.delete(checkbox.value);
    renderBookingBuses();
  });
  byId('select-visible-buses').addEventListener('click', () => {
    byId('booking-bus-list').querySelectorAll('[data-bus-checkbox]:not(:disabled)').forEach((checkbox) => selectedBookingBusIds.add(checkbox.value));
    renderBookingBuses();
  });
  byId('clear-visible-buses').addEventListener('click', () => {
    byId('booking-bus-list').querySelectorAll('[data-bus-checkbox]').forEach((checkbox) => selectedBookingBusIds.delete(checkbox.value));
    renderBookingBuses();
  });
  byId('clear-all-buses').addEventListener('click', () => { selectedBookingBusIds = new Set(); renderBookingBuses(); });
  byId('booking-form').addEventListener('submit', saveBooking);
  byId('export-brandings').addEventListener('click', () => exportBrandingCsv(filteredBrandings(), 'data-branding-trans-jogja.csv'));
  byId('export-history').addEventListener('click', () => exportBrandingCsv(filteredHistory(), 'history-branding-trans-jogja.csv'));
  byId('download-branding-template')?.addEventListener('click', downloadBrandingTemplateCsv);
  byId('branding-csv-file')?.addEventListener('change', async (event) => {
    try { await importBrandingCsv(event.target.files[0]); } catch (error) { showNotice(error.message, 'error'); } finally { event.target.value = ''; }
  });

  // Sorting handlers
  bindSortHandler('master-bus-table',     sortState.masterBus, renderMasterBus);
  bindSortHandler('branding-table',       sortState.branding,  renderBrandings);
  bindSortHandler('history-table',        sortState.history,   renderHistory);
  bindSortHandler('rekap-branding-table', sortState.rekap,     renderRekap);

  // Rekap Branding filters & exports
  byId('rekap-search-polisi')?.addEventListener('input',  renderRekap);
  byId('rekap-search-lamb')?.addEventListener('input',    renderRekap);
  byId('rekap-search-brand')?.addEventListener('input',   renderRekap);
  byId('rekap-filter-jalur')?.addEventListener('change',  renderRekap);
  byId('rekap-filter-status')?.addEventListener('change', renderRekap);
  byId('rekap-filter-type')?.addEventListener('change',   renderRekap);
  byId('export-rekap-pdf')?.addEventListener('click',     () => exportRekapPdf(lastRekapRows));
  byId('export-rekap-csv')?.addEventListener('click',     () => exportRekapCsv(lastRekapRows));

  window.addEventListener('hashchange', () => {
    if (window.location.hash.slice(1) === 'rekap-branding') {
      renderRekap();
    }
  });
}

export async function initialiseDataFeatures(firestore, user) {
  db = firestore;
  currentUser = user;
  window.refreshAdminManagedDropdowns = refreshManagedDropdowns;
  window.__brandingMasterDefaults = {
    busTypes: [...new Set(buses.map((bus) => String(bus.tipeBus || '').trim()).filter(Boolean))],
    jalur: [...new Set(buses.map((bus) => String(bus.jalurBus || '').trim()).filter(Boolean))],
    brandingTypes: BRANDING_TYPES,
  };
  bindEvents();
  await refreshData();
}
