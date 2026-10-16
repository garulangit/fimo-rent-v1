import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { busTrayek, busTrayekCode, trayekLabel } from './trayek-master.js';

const defaultFirestoreApi = { collection, doc, getDocs, serverTimestamp, setDoc };
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character]);

let db;
let currentUser;
let brandingRecords = [];
let masterBuses = [];
let savedDocuments = [];
let items = [];
let currentDocumentId = '';
let currentStatus = '';
let activeRow = null;
let initialized = false;
let pricingSourceDirty = false;
let isSaving = false;
let firestoreApi = defaultFirestoreApi;

function field(record, ...names) {
  for (const name of names) {
    const value = record?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function parseDate(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return parseDate(value.toDate());
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
      ].join('-');
    }
    if (typeof value.seconds === 'number') return parseDate(new Date(value.seconds * 1000));
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  return '';
}

function formatDate(value) {
  const iso = parseDate(value);
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function sequenceValue(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 3);
  const number = Number(digits);
  return digits && number > 0 ? String(number).padStart(3, '0') : '';
}

function sequenceFromSaved(value) {
  const text = String(value || '').trim();
  const match = text.match(/^\d{2}\.\d{2}\.(\d{1,3})\/AMI\/U\.6\.10\/NDN\/\d{4}$/i);
  if (match) return sequenceValue(match[1]);
  return sequenceValue(text);
}

function documentNumber() {
  const iso = parseDate($('#nota-document-date').value);
  const sequence = sequenceValue($('#nota-number').value);
  if (!iso || !sequence) return '';
  const [year, month, day] = iso.split('-');
  return `${month}.${day}.${sequence}/AMI/U.6.10/NDN/${year}`;
}

function updateNumberPreview() {
  const number = documentNumber();
  $('#nota-number-preview').textContent = number || 'Pilih tanggal surat dan nomor urut.';
  const generatedNumber = $('#nota-document [data-nota-number]');
  if (generatedNumber) generatedNumber.textContent = number || '[nomor nota dinas]';
  const signatureDate = $('#nota-document .nota-doc-signature > p:first-child');
  if (signatureDate) signatureDate.textContent = `Yogyakarta, ${formatDate($('#nota-document-date').value)}`;
  $('#nota-generate').disabled = !canGenerate() || currentStatus === 'FINAL';
}

function formatCurrency(value) {
  const formatted = typeof window.formatRupiah === 'function'
    ? window.formatRupiah(value)
    : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  return formatted.replace(/^Rp\s*/i, 'Rp. ');
}

function formatAuditDate(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function'
    ? value.toDate()
    : value instanceof Date
      ? value
      : typeof value.seconds === 'number'
        ? new Date(value.seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta',
  }).format(date);
}

function showMessage(text, type = 'error') {
  const message = $('#nota-message');
  message.textContent = text;
  message.classList.toggle('is-success', type === 'success');
}

function setStatus(status) {
  currentStatus = status;
  const statusElement = $('#nota-status');
  statusElement.textContent = status || 'Belum dibuat';
  statusElement.dataset.status = status || '';
  const isFinal = status === 'FINAL';
  const isLocked = isFinal || isSaving;
  const hasDocument = Boolean($('#nota-document').innerHTML.trim());
  $('#nota-document').contentEditable = String(hasDocument && !isLocked);
  $('#nota-toolbar').hidden = !hasDocument || isLocked;
  $('#nota-save').disabled = isLocked;
  $('#nota-finalize').disabled = isLocked;
  $('#nota-generate').disabled = isLocked || !canGenerate();
  $('#nota-print').disabled = !hasDocument;
  $('#nota-pdf').disabled = !hasDocument;
  $('#nota-preview-action').disabled = !hasDocument;
  document.querySelectorAll('#nota-form input, #nota-form select').forEach((input) => { input.disabled = isLocked; });
  $('#nota-add-row').disabled = isLocked;
  $('#nota-remove-row').disabled = isLocked;
  $('#nota-move-row-up').disabled = isLocked;
  $('#nota-move-row-down').disabled = isLocked;
}

function getSourceRecords() {
  const source = $('#nota-source').value;
  return brandingRecords.filter((record) => {
    const status = field(record, 'status', 'Status').toLocaleUpperCase('id');
    if (source === 'Booking') return status === 'BOOKING';
    if (source === 'Branding') return ['PROSES', 'BERJALAN', 'SELESAI'].includes(status);
    return false;
  });
}

function getOrganizations() {
  return [...new Set(getSourceRecords().map((record) => field(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT')).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'id'));
}

function renderOrganizations(selected = $('#nota-organization').value) {
  const select = $('#nota-organization');
  select.innerHTML = '<option value="">Pilih instansi</option>'
    + getOrganizations().map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  select.value = [...select.options].some((option) => option.value === selected) ? selected : '';
}

function recordLabel(record) {
  const noLamb = field(record, 'noLamb', 'No Lamb', 'no_lamb') || 'No Lamb —';
  const noPolisi = field(record, 'noPolisi', 'No Polisi', 'no_polisi') || 'No Polisi —';
  const brand = field(record, 'namaBrand', 'Nama Brand', 'brand') || 'Brand tanpa nama';
  return `${noLamb} · ${noPolisi} — ${brand}`;
}

function findMasterBus(record) {
  const noPolisi = field(record, 'noPolisi', 'No Polisi', 'no_polisi');
  const exact = masterBuses.find((bus) => field(bus, 'noPolisi', 'No Polisi', 'no_polisi') === noPolisi);
  if (exact) return exact;
  const noLamb = field(record, 'noLamb', 'No Lamb', 'no_lamb');
  if (!noLamb) return null;
  const matches = masterBuses.filter((bus) => field(bus, 'noLamb', 'No Lamb', 'no_lamb') === noLamb);
  return matches.length === 1 ? matches[0] : null;
}

function refreshSelectedItemRoutes() {
  if (!items.length || currentStatus === 'FINAL') return;
  let changed = false;
  items = items.map((item) => {
    const sourceRecord = brandingRecords.find((record) => record.id === item.sourceId) || item;
    const masterBus = findMasterBus(sourceRecord);
    const trayek = busTrayek(masterBus || {});
    const routeCode = busTrayekCode(masterBus || {});
    const routeName = trayek?.name || '';
    if (item.trayekCode === routeCode && item.trayekName === routeName) return item;
    changed = true;
    return {
      ...item,
      trayekCode: routeCode,
      trayekName: routeName,
      trayek: trayek?.name || 'Kode trayek belum tersedia',
      trayekMissing: !trayek,
    };
  });
  if (!changed) return;
  renderItemQueue();
  renderRecordSummary();
  if ($('#nota-document').innerHTML.trim()) {
    pricingSourceDirty = true;
    markEdited();
    showMessage('Trayek Master Bus berubah. Generate ulang tabel sebelum menyimpan.');
  }
}

function filteredRecords() {
  const organization = $('#nota-organization').value;
  const search = $('#nota-record-search').value.trim().toLocaleLowerCase('id');
  return getSourceRecords().filter((record) => {
    const company = field(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT');
    if (organization && company !== organization) return false;
    const text = [
      recordLabel(record),
      field(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT'),
      field(record, 'jalurBus', 'Jalur Bus', 'jalur'),
      field(record, 'referensi', 'pks', 'keterangan', 'Keterangan'),
    ].join(' ').toLocaleLowerCase('id');
    return !search || text.includes(search);
  });
}

function renderRecordOptions() {
  const container = $('#nota-record-options');
  const empty = $('#nota-record-empty');
  const source = $('#nota-source').value;
  const organization = $('#nota-organization').value;
  const matchingOrganization = getSourceRecords().filter((record) =>
    field(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT') === organization);
  const records = source && organization ? filteredRecords() : [];
  container.innerHTML = records.map((record) => {
    const selected = items.some((item) => item.sourceId === record.id);
    return `<label class="nota-record-option">
      <input type="checkbox" data-source-record="${escapeHtml(record.id)}" ${selected ? 'checked' : ''} ${currentStatus === 'FINAL' ? 'disabled' : ''} />
      <span><strong>${escapeHtml(recordLabel(record))}</strong><small>${escapeHtml(field(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT') || 'Instansi —')} · ${escapeHtml(field(record, 'status', 'Status') || 'Status —')} · ${escapeHtml(field(record, 'tanggalMulai', 'Tanggal Mulai') || 'Tanggal —')}</small></span>
    </label>`;
  }).join('');
  if (!source || !organization) {
    empty.textContent = 'Pilih sumber data dan instansi untuk melihat data.';
    empty.hidden = false;
  } else if (!matchingOrganization.length) {
    empty.textContent = `Belum ada data ${source} untuk instansi ini.`;
    empty.hidden = false;
  } else if (!records.length) {
    empty.textContent = 'Tidak ada data yang cocok dengan pencarian.';
    empty.hidden = false;
  } else {
    empty.hidden = true;
  }
  renderRecordSummary();
}

function canGenerate() {
  return Boolean($('#nota-source')?.value
    && $('#nota-organization')?.value
    && items.length
    && sequenceValue($('#nota-number')?.value)
    && parseDate($('#nota-document-date')?.value)
    && $('#nota-reference')?.value.trim()
    && parseDate($('#nota-reference-date')?.value));
}

function getFinancials(record) {
  if (typeof window.calculateBookingFinancials !== 'function') {
    throw new Error('Fungsi perhitungan harga booking belum tersedia.');
  }
  return window.calculateBookingFinancials(record);
}

function makeItem(record) {
  const financials = getFinancials(record);
  const duration = Number(financials.duration);
  const basePrice = Number(financials.basePrice);
  const monthlyPrice = Number(financials.monthlyRevenue ?? (basePrice / duration));
  if (financials.reason || !Number.isInteger(duration) || duration < 1 || !Number.isFinite(basePrice) || !Number.isFinite(monthlyPrice)) {
    throw new Error(financials.reason || 'Harga untuk data ini belum dapat dihitung.');
  }
  const ppnRate = basePrice > 0 && Number.isFinite(Number(financials.ppn))
    ? Number(financials.ppn) / basePrice * 100
    : 0;
  const startDate = parseDate(field(record, 'tanggalMulai', 'Tanggal Mulai'));
  const endDate = parseDate(field(record, 'tanggalSelesai', 'Tanggal Selesai', 'Akhir Penayangan', 'tanggalAkhir', 'Tanggal Akhir'));
  const masterBus = findMasterBus(record);
  const route = busTrayek(masterBus || {});
  const routeCode = busTrayekCode(masterBus || {});
  return {
    sourceId: record.id,
    namaPT: field(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT'),
    namaBrand: field(record, 'namaBrand', 'Nama Brand', 'brand'),
    no: field(record, 'no', 'No'),
    noPolisi: field(record, 'noPolisi', 'No Polisi', 'no_polisi'),
    noLamb: field(record, 'noLamb', 'No Lamb', 'no_lamb'),
    jalur: field(record, 'jalurBus', 'Jalur Bus', 'jalur', 'JALUR'),
    trayekCode: routeCode,
    trayekName: route?.name || '',
    trayek: route?.name || 'Kode trayek belum tersedia',
    trayekMissing: !route,
    tipeBus: field(record, 'tipeBus', 'Tipe Bus', 'type'),
    jenisBranding: field(record, 'jenisBranding', 'Jenis Branding', 'jenis_branding', 'type'),
    reference: field(record, 'referensi', 'pks', 'keterangan', 'Keterangan'),
    mediaBus: financials.mediaBus || field(record, 'tipeBus', 'Tipe Bus', 'type'),
    startDate,
    endDate,
    duration,
    monthlyPrice,
    basePrice,
    ppn: Number(financials.ppn) || 0,
    ppnRate,
    status: field(record, 'status', 'Status').toLocaleUpperCase('id'),
    source: $('#nota-source').value,
  };
}

function renderRecordSummary() {
  const summary = $('#nota-data-summary');
  const source = $('#nota-source').value;
  const available = filteredRecords().length;
  const message = !source || !$('#nota-organization').value
    ? 'Pilih sumber dan instansi untuk melihat data.'
    : items.length
      ? `${items.length} data dipilih untuk Nota Dinas. Harga satuan menggunakan nilai dasar bulanan sebelum PPN.`
      : `Silakan pilih minimal satu data ${source}.`;
  summary.innerHTML = `<p class="nota-summary-empty">${escapeHtml(message)}${items.length ? ` (${available} hasil sesuai pencarian).` : ''}</p>`;
  renderItemQueue();
}

function renderItemQueue() {
  const tbody = $('#nota-items-body');
  $('#nota-generate').disabled = !canGenerate() || currentStatus === 'FINAL';
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Silakan pilih minimal satu data Booking/Branding.</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((item, index) => `<tr>
    <td>${index + 1}</td>
    <td>${escapeHtml(`${item.namaPT || '—'} / ${item.namaBrand || '—'}`)}</td>
    <td>${escapeHtml(`${item.noLamb || '—'} · ${item.noPolisi || '—'}`)}</td>
    <td>${item.duration} Bulan</td>
    <td>${formatCurrency(item.monthlyPrice)}</td>
    <td><div class="nota-item-actions">
      <button type="button" class="secondary" data-item-move="${index}" data-direction="-1" aria-label="Pindah item ke atas" ${index === 0 || currentStatus === 'FINAL' ? 'disabled' : ''}>↑</button>
      <button type="button" class="secondary" data-item-move="${index}" data-direction="1" aria-label="Pindah item ke bawah" ${index === items.length - 1 || currentStatus === 'FINAL' ? 'disabled' : ''}>↓</button>
      <button type="button" class="secondary" data-item-remove="${index}" ${currentStatus === 'FINAL' ? 'disabled' : ''}>Hapus</button>
    </div></td>
  </tr>`).join('');
  $('#nota-record-options').querySelectorAll('[data-source-record]').forEach((checkbox) => {
    checkbox.checked = items.some((item) => item.sourceId === checkbox.dataset.sourceRecord);
    checkbox.disabled = currentStatus === 'FINAL';
  });
}

function overallPeriod() {
  const dates = items.flatMap((item) => [item.startDate, item.endDate]).filter(Boolean).sort();
  return {
    start: dates[0] || '',
    end: dates[dates.length - 1] || '',
  };
}

function documentRows() {
  return items.map((item, index) => `<tr data-nota-item-row data-ppn-rate="${item.ppnRate}" data-base-price="${item.basePrice}" data-original-duration="${item.duration}">
    <td>${index + 1}</td>
    <td>${escapeHtml(item.jalur || '—')}</td>
    <td>${escapeHtml(item.noLamb || '—')}</td>
    <td>${escapeHtml(item.noPolisi || '—')}</td>
    <td>${escapeHtml(item.trayek || '—')}</td>
    <td>${escapeHtml(item.namaBrand || '—')}</td>
    <td>${item.duration} Bulan</td>
    <td>${formatCurrency(item.monthlyPrice)}</td>
  </tr>`).join('');
}

function buildPaymentCopy(totalAmount) {
  const period = overallPeriod();
  const periodText = period.start && period.end ? `untuk periode ${formatDate(period.start)} sampai dengan ${formatDate(period.end)} ` : '';
  const deadlines = [...document.querySelectorAll('[data-term-deadline]')].map((input) => input.value.trim());
  if (Number($('#nota-payment-method').value) === 3) {
    return `Pembayaran ${periodText}dilakukan dengan metode 3x termin dengan rincian sebagai berikut:<br>${deadlines.map((deadline, index) =>
      `Termin ${index + 1} — paling lambat: ${escapeHtml(deadline || '[isi batas pembayaran]')}`).join('<br>')}`;
  }
  return `Pembayaran ${periodText}dilakukan dengan metode 1x pembayaran senilai ${formatCurrency(totalAmount)} dan dilakukan paling lambat ${escapeHtml(deadlines[0] || '[isi batas pembayaran]')}.`;
}

function createDocumentHtml() {
  const period = overallPeriod();
  const companyNames = [...new Set(items.map((item) => item.namaPT).filter(Boolean))].join(', ') || $('#nota-organization').value;
  const brands = [...new Set(items.map((item) => item.namaBrand).filter(Boolean))].join(', ') || '—';
  const types = [...new Set(items.map((item) => item.jenisBranding).filter(Boolean))].join(', ') || '—';
  const durations = [...new Set(items.map((item) => item.duration))];
  const durationText = durations.length === 1 ? `${durations[0]} Bulan` : 'sesuai rincian pada tabel';
  const reference = escapeHtml($('#nota-reference').value.trim());
  const referenceDate = formatDate($('#nota-reference-date').value);
  const amount = items.reduce((sum, item) => sum + item.basePrice + item.ppn, 0);
  const percentage = items.length && items.every((item) => item.ppnRate === items[0].ppnRate)
    ? ` ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(items[0].ppnRate)}%`
    : '';
  const date = formatDate($('#nota-document-date').value);
  const number = documentNumber();
  return `<h1 class="nota-doc-title">Nota Dinas</h1>
    <div class="nota-doc-meta">
      <p>Nomor: <span data-nota-number>${escapeHtml(number || '[nomor nota dinas]')}</span></p>
      <p>Yth: Legal PT Anindya Mitra Internasional</p>
      <p>Dari: Manajer Unit Transportasi</p>
      <p>Hal: Permohonan Pembuatan Perjanjian</p>
    </div>
    <p class="nota-doc-body">Salam sejahtera,</p>
    <p class="nota-doc-body">Menindaklanjuti surat No: ${reference} tanggal ${escapeHtml(referenceDate)} perihal permohonan kerja sama branding bus Trans Jogja, mohon dibuatkan surat perjanjian kerja sama pemasangan branding antara PT Anindya Mitra Internasional dengan ${escapeHtml(companyNames)} untuk jangka waktu ${durationText}${period.start && period.end ? ` yang dimulai dari ${escapeHtml(formatDate(period.start))} sampai dengan ${escapeHtml(formatDate(period.end))}` : ''}, iklan bus Trans Jogja ${escapeHtml(types)} dengan materi ${escapeHtml(brands)}, dengan rincian branding sebagai berikut:</p>
    <div class="nota-doc-table-wrap"><table class="nota-doc-table">
      <thead><tr><th>No.</th><th>Jalur</th><th>Lambung</th><th>No Pol</th><th>Trayek</th><th>Materi</th><th>Durasi</th><th>Harga Satuan/1 Bulan</th></tr></thead>
      <tbody>${documentRows()}</tbody>
      <tfoot><tr><td colspan="7">PPN${percentage}</td><td data-nota-tax>${formatCurrency(0)}</td></tr><tr><td colspan="7">TOTAL</td><td data-nota-total>${formatCurrency(amount)}</td></tr></tfoot>
    </table></div>
    <p class="nota-doc-payment" data-nota-payment>${buildPaymentCopy(amount)}</p>
    <p class="nota-doc-closing">Demikian surat permohonan ini kami sampaikan, atas bantuan dan kerjasamanya kami ucapkan terima kasih.</p>
    <div class="nota-doc-signature">
      <p>Yogyakarta, ${escapeHtml(date)}</p>
      <p>Hormat kami,</p>
      <p class="signature-gap"><br></p>
      <p><strong>Wahyu Saktiaji</strong></p>
      <p><em>Manajer Transportasi</em></p>
    </div>`;
}

function renderPaymentTerms(values = []) {
  const container = $('#nota-payment-terms');
  const count = Number($('#nota-payment-method').value);
  if (![1, 3].includes(count)) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = Array.from({ length: count }, (_, index) => `<label class="nota-term-row">
    <strong>${count === 1 ? 'Pembayaran 1' : `Termin ${index + 1}`}</strong>
    <input type="text" data-term-deadline="${index + 1}" value="${escapeHtml(values[index] || '')}" placeholder="Paling lambat: tanggal / ketentuan" aria-label="Batas pembayaran ${count === 1 ? 'pembayaran 1' : `termin ${index + 1}`}" />
  </label>`).join('');
  container.querySelectorAll('[data-term-deadline]').forEach((input) => input.addEventListener('input', updatePaymentCopy));
}

function updatePaymentCopy() {
  const paymentNode = $('#nota-document [data-nota-payment]');
  if (!paymentNode) return;
  const total = Number($('#nota-document [data-nota-total]')?.dataset.amount || 0);
  paymentNode.innerHTML = buildPaymentCopy(total);
  markEdited();
}

function updateDocumentTotals() {
  const table = $('#nota-document .nota-doc-table');
  if (!table) return;
  const lines = [...table.querySelectorAll('tbody tr[data-nota-item-row]')];
  let baseTotal = 0;
  let taxTotal = 0;
  const rates = [];
  lines.forEach((row, index) => {
    const cells = row.cells;
    if (!cells || cells.length < 8) return;
    const durationMatch = cells[6].textContent.match(/\d+/);
    const duration = Math.max(1, Number(durationMatch?.[0]) || 1);
    const monthlyPrice = Number(cells[7].textContent.replace(/[^\d-]/g, '')) || 0;
    const originalMonthlyPrice = Number(row.dataset.basePrice) / Number(row.dataset.originalDuration);
    const lineTotal = Number.isFinite(originalMonthlyPrice)
      && duration === Number(row.dataset.originalDuration)
      && monthlyPrice === Math.round(originalMonthlyPrice)
      ? Number(row.dataset.basePrice)
      : monthlyPrice * duration;
    const rate = Number(row.dataset.ppnRate) || 0;
    baseTotal += lineTotal;
    taxTotal += lineTotal * rate / 100;
    rates.push(rate);
    cells[0].textContent = String(index + 1);
  });
  const taxCell = table.querySelector('[data-nota-tax]');
  const totalCell = table.querySelector('[data-nota-total]');
  if (taxCell) {
    taxCell.textContent = formatCurrency(taxTotal);
    taxCell.dataset.amount = String(taxTotal);
    const label = taxCell.parentElement?.cells[0];
    if (label) {
      const uniqueRates = [...new Set(rates)];
      label.textContent = uniqueRates.length === 1
        ? `PPN ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(uniqueRates[0])}%`
        : 'PPN';
    }
  }
  if (totalCell) {
    totalCell.textContent = formatCurrency(baseTotal + taxTotal);
    totalCell.dataset.amount = String(baseTotal + taxTotal);
  }
  if (taxCell) taxCell.dataset.amount = String(taxTotal);
  const paymentNode = $('#nota-document [data-nota-payment]');
  if (paymentNode) paymentNode.innerHTML = buildPaymentCopy(baseTotal + taxTotal);
}

function markEdited() {
  if (currentStatus === 'FINAL' || !$('#nota-document').innerHTML.trim()) return;
  if (currentStatus !== 'DRAFT') setStatus('EDITED');
}

function sanitizeHtml(html) {
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const allowed = new Set(['DIV', 'P', 'H1', 'BR', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD']);
  const classes = new Set(['nota-doc-title', 'nota-doc-meta', 'nota-doc-body', 'nota-doc-table-wrap', 'nota-doc-table', 'nota-doc-payment', 'nota-doc-closing', 'nota-doc-signature', 'signature-gap']);
  const root = parsed.body.firstElementChild;
  [...root.querySelectorAll('*')].reverse().forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(parsed.createTextNode(element.textContent || ''));
      return;
    }
    [...element.attributes].forEach((attribute) => {
      if (attribute.name === 'class' && classes.has(attribute.value)) return;
      if (['colspan', 'rowspan'].includes(attribute.name) && /^\d+$/.test(attribute.value)) return;
      if (attribute.name === 'data-nota-item-row' && element.tagName === 'TR') return;
      if (attribute.name === 'data-ppn-rate' && element.tagName === 'TR' && Number.isFinite(Number(attribute.value))) return;
      if (attribute.name === 'data-base-price' && element.tagName === 'TR' && Number.isFinite(Number(attribute.value))) return;
      if (attribute.name === 'data-original-duration' && element.tagName === 'TR' && Number.isInteger(Number(attribute.value))) return;
      if (attribute.name === 'data-nota-tax' && element.tagName === 'TD') return;
      if (attribute.name === 'data-nota-total' && element.tagName === 'TD') return;
      if (attribute.name === 'data-nota-payment' && element.tagName === 'P') return;
      if (attribute.name === 'data-nota-number' && element.tagName === 'SPAN') return;
      if (attribute.name === 'data-amount' && element.tagName === 'TD' && Number.isFinite(Number(attribute.value))) return;
      if (attribute.name === 'style' && element.tagName === 'P' && /^text-align:\s*(left|center|right|justify)\s*;?$/i.test(attribute.value)) return;
      element.removeAttribute(attribute.name);
    });
  });
  return root.innerHTML;
}

function validateCore() {
  const required = [
    ['#nota-document-date', 'Tanggal surat wajib diisi.'],
    ['#nota-number', 'Nomor urut nota dinas wajib diisi.'],
    ['#nota-organization', 'Instansi wajib dipilih dari data booking/branding.'],
    ['#nota-reference', 'Referensi surat wajib diisi.'],
    ['#nota-reference-date', 'Tanggal surat referensi wajib diisi.'],
    ['#nota-source', 'Sumber data wajib dipilih.'],
  ];
  for (const [selector, text] of required) {
    if (!$(selector).value.trim()) {
      showMessage(text);
      $(selector).focus();
      return false;
    }
  }
  if (!sequenceValue($('#nota-number').value)) {
    showMessage('Nomor urut harus berisi angka 1 sampai 999.');
    $('#nota-number').focus();
    return false;
  }
  if (!items.length) {
    showMessage('Silakan pilih minimal satu data Booking/Branding.');
    $('#nota-record-options').focus();
    return false;
  }
  if (!items.some((item) => item.sourceId)) {
    showMessage('Silakan pilih data booking atau branding sebagai referensi.');
    $('#nota-record-options').focus();
    return false;
  }
  if (items.some((item) => item.namaPT !== $('#nota-organization').value || item.source !== $('#nota-source').value)) {
    showMessage('Pastikan semua item berasal dari instansi dan sumber data yang dipilih.');
    $('#nota-record-options').focus();
    return false;
  }
  const number = documentNumber().toLocaleLowerCase('id');
  const duplicate = savedDocuments.find((entry) => entry.id !== currentDocumentId
    && String(entry.nomorNotaDinas || '').trim().toLocaleLowerCase('id') === number);
  if (duplicate) {
    showMessage('Nomor nota dinas sudah digunakan. Gunakan nomor yang berbeda.');
    $('#nota-number').focus();
    return false;
  }
  return true;
}

function validateFinal() {
  if (!validateCore()) return false;
  if (!parseDate($('#nota-document-date').value)) {
    showMessage('Tanggal surat wajib diisi.');
    $('#nota-document-date').focus();
    return false;
  }
  const method = Number($('#nota-payment-method').value);
  if (![1, 3].includes(method)) {
    showMessage('Metode pembayaran wajib dipilih.');
    $('#nota-payment-method').focus();
    return false;
  }
  const missing = [...document.querySelectorAll('[data-term-deadline]')].find((input) => !input.value.trim());
  if (missing) {
    showMessage(`Batas pembayaran ${method === 1 ? 'wajib diisi.' : `termin ${missing.dataset.termDeadline} wajib diisi.`}`);
    missing.focus();
    return false;
  }
  if (!$('#nota-document').querySelector('tbody tr[data-nota-item-row]')) {
    showMessage('Tabel nota dinas harus memiliki minimal satu item.');
    return false;
  }
  if (pricingSourceDirty) {
    showMessage('Data surat atau item berubah. Generate ulang tabel agar isi Nota Dinas sesuai.');
    $('#nota-generate').focus();
    return false;
  }
  return true;
}

function currentFormData() {
  const source = $('#nota-source').value;
  const docDate = $('#nota-document-date').value;
  const sourceDataIds = items.map((item) => item.sourceId).filter(Boolean);
  return {
    nomorNotaDinas: documentNumber(),
    nomorUrut: sequenceValue($('#nota-number').value),
    instansi: $('#nota-organization').value,
    referenceLetter: $('#nota-reference').value.trim(),
    referenceLetterDate: $('#nota-reference-date').value,
    source,
    sourceDataIds,
    sourceDataId: sourceDataIds[0] || '',
    bookingIds: source === 'Booking' ? sourceDataIds : [],
    brandingIds: source === 'Branding' ? sourceDataIds : [],
    bookingId: source === 'Booking' ? (sourceDataIds[0] || '') : '',
    brandingId: source === 'Branding' ? (sourceDataIds[0] || '') : '',
    paymentMethod: $('#nota-payment-method').value,
    paymentTerms: [...document.querySelectorAll('[data-term-deadline]')].map((input) => input.value.trim()),
    documentDate: docDate,
    generatedItems: items,
    documentContent: sanitizeHtml($('#nota-document').innerHTML),
    status: currentStatus || 'DRAFT',
    updatedBy: currentUser?.email || currentUser?.displayName || currentUser?.uid || '',
    updatedAt: firestoreApi.serverTimestamp(),
  };
}

function toSavedOption(documentData) {
  const number = documentData.nomorNotaDinas || 'Tanpa nomor';
  const organization = documentData.instansi || 'Instansi tidak diketahui';
  const status = documentData.status || 'DRAFT';
  return `${number} · ${organization} · ${status}`;
}

async function loadSavedDocuments() {
  try {
    const snapshot = await firestoreApi.getDocs(firestoreApi.collection(db, 'notaDinas'));
    savedDocuments = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
    savedDocuments.sort((a, b) => String(b.updatedAt?.seconds || b.createdAt?.seconds || '').localeCompare(String(a.updatedAt?.seconds || a.createdAt?.seconds || '')));
    const select = $('#nota-saved-list');
    select.innerHTML = '<option value="">Pilih nota dinas tersimpan</option>'
      + savedDocuments.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(toSavedOption(entry))}</option>`).join('');
  } catch (error) {
    console.error('Gagal memuat Nota Dinas:', error);
    showMessage('Nota Dinas tersimpan gagal dimuat. Periksa Firestore Rules.', 'error');
  }
}

async function saveDocument(finalize = false) {
  if (finalize ? !validateFinal() : !validateCore()) return;
  if (pricingSourceDirty) {
    showMessage('Data surat atau item berubah. Generate ulang tabel sebelum menyimpan.');
    $('#nota-generate').focus();
    return;
  }
  if (finalize && !$('#nota-document').innerHTML.trim()) {
    showMessage('Generate tabel sebelum melakukan finalisasi.');
    $('#nota-generate').focus();
    return;
  }
  const saveButton = finalize ? $('#nota-finalize') : $('#nota-save');
  saveButton.disabled = true;
  const previousStatus = currentStatus;
  let newDocumentId = '';
  isSaving = true;
  setStatus(currentStatus);
  const data = currentFormData();
  if (finalize) data.status = 'FINAL';
  try {
    if (currentDocumentId) {
      await firestoreApi.setDoc(firestoreApi.doc(db, 'notaDinas', currentDocumentId), data, { merge: true });
    } else {
      const reference = firestoreApi.doc(firestoreApi.collection(db, 'notaDinas'));
      newDocumentId = reference.id;
      const createdAt = firestoreApi.serverTimestamp();
      await firestoreApi.setDoc(reference, { ...data, createdBy: data.updatedBy, createdAt });
      currentDocumentId = newDocumentId;
    }
    setStatus(finalize ? 'FINAL' : currentStatus || 'DRAFT');
    const userLabel = currentUser?.email || currentUser?.displayName || currentUser?.uid || 'Pengguna';
    $('#nota-audit').textContent = `Terakhir diubah oleh ${userLabel} · ${formatAuditDate(new Date())}`;
    showMessage(finalize ? 'Nota Dinas berhasil difinalisasi.' : 'Draft Nota Dinas berhasil disimpan.', 'success');
    await loadSavedDocuments();
    $('#nota-saved-list').value = currentDocumentId;
  } catch (error) {
    console.error('Gagal menyimpan Nota Dinas:', error);
    currentStatus = previousStatus;
    setStatus(previousStatus);
    showMessage('Nota Dinas gagal disimpan. Periksa akses Firestore dan coba lagi.');
  } finally {
    isSaving = false;
    setStatus(currentStatus);
  }
}

function renderSavedDocument(documentData) {
  currentDocumentId = documentData.id;
  pricingSourceDirty = false;
  currentStatus = documentData.status || 'DRAFT';
  $('#nota-document-date').value = parseDate(documentData.documentDate);
  $('#nota-number').value = sequenceFromSaved(documentData.nomorUrut || documentData.nomorNotaDinas);
  $('#nota-reference').value = documentData.referenceLetter || '';
  $('#nota-reference-date').value = parseDate(documentData.referenceLetterDate);
  $('#nota-source').value = documentData.source || (documentData.bookingId ? 'Booking' : 'Branding');
  items = Array.isArray(documentData.generatedItems) ? documentData.generatedItems : Array.isArray(documentData.items) ? documentData.items : [];
  renderOrganizations(documentData.instansi || '');
  $('#nota-record-search').value = '';
  renderRecordOptions();
  renderItemQueue();
  $('#nota-payment-method').value = documentData.paymentMethod || '';
  renderPaymentTerms(documentData.paymentTerms || []);
  $('#nota-document').innerHTML = sanitizeHtml(documentData.documentContent || '');
  setStatus(currentStatus);
  updateDocumentTotals();
  updateNumberPreview();
  const updatedBy = documentData.updatedBy || documentData.createdBy || '—';
  const updatedAt = formatAuditDate(documentData.updatedAt || documentData.createdAt);
  $('#nota-audit').textContent = updatedAt ? `Dibuat/diubah oleh ${updatedBy} · ${updatedAt}` : `Dibuat/diubah oleh ${updatedBy}`;
  $('#nota-saved-list').value = documentData.id;
  $('#nota-message').textContent = '';
  renderRecordSummary();
}

function resetForm() {
  $('#nota-form').reset();
  currentDocumentId = '';
  currentStatus = '';
  activeRow = null;
  pricingSourceDirty = false;
  isSaving = false;
  items = [];
  $('#nota-record-options').innerHTML = '';
  $('#nota-record-empty').textContent = 'Pilih sumber data dan instansi untuk melihat data.';
  $('#nota-record-empty').hidden = false;
  $('#nota-data-summary').innerHTML = '<p class="nota-summary-empty">Pilih sumber dan instansi untuk melihat data.</p>';
  $('#nota-document').innerHTML = '';
  $('#nota-document-date').value = localToday();
  $('#nota-audit').textContent = '';
  $('#nota-payment-terms').innerHTML = '';
  $('#nota-message').textContent = '';
  $('#nota-saved-list').value = '';
  renderOrganizations('');
  renderRecordOptions();
  renderItemQueue();
  updateNumberPreview();
  setStatus('');
}

function addDocumentRow() {
  const body = $('#nota-document .nota-doc-table tbody');
  if (!body) {
    showMessage('Generate tabel terlebih dahulu.');
    return;
  }
  const first = body.querySelector('tr[data-nota-item-row]');
  let row;
  if (first) {
    row = first.cloneNode(true);
    [...row.cells].forEach((cell) => { cell.textContent = '—'; });
    row.cells[0].textContent = String(body.rows.length + 1);
    row.cells[6].textContent = '1 Bulan';
    row.cells[7].textContent = formatCurrency(0);
  } else {
    row = document.createElement('tr');
    row.dataset.notaItemRow = '';
    row.dataset.ppnRate = String(items[0]?.ppnRate || 0);
    ['1', '—', '—', '—', '—', '—', '1 Bulan', formatCurrency(0)].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
  }
  row.dataset.notaItemRow = '';
  body.append(row);
  activeRow = row;
  updateDocumentTotals();
  markEdited();
}

function removeDocumentRow() {
  const body = $('#nota-document .nota-doc-table tbody');
  if (!body?.rows.length) return;
  const row = activeRow?.parentElement === body ? activeRow : body.lastElementChild;
  row.remove();
  activeRow = null;
  updateDocumentTotals();
  markEdited();
}

function moveDocumentRow(direction) {
  const body = $('#nota-document .nota-doc-table tbody');
  if (!body?.rows.length) return;
  const row = activeRow?.parentElement === body ? activeRow : body.lastElementChild;
  const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
  if (!sibling) return;
  if (direction < 0) body.insertBefore(row, sibling);
  else body.insertBefore(sibling, row);
  activeRow = row;
  updateDocumentTotals();
  markEdited();
}

function bindEvents() {
  $('#nota-form').addEventListener('submit', (event) => event.preventDefault());
  $('#nota-source').addEventListener('change', () => {
    items = [];
    $('#nota-organization').value = '';
    $('#nota-record-search').value = '';
    renderOrganizations('');
    renderRecordOptions();
    sourceChanged();
  });
  $('#nota-organization').addEventListener('change', () => {
    items = [];
    $('#nota-record-search').value = '';
    renderRecordOptions();
    sourceChanged();
  });
  $('#nota-record-search').addEventListener('input', renderRecordOptions);
  $('#nota-record-options').addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-source-record]');
    if (!checkbox) return;
    const sourceRecord = filteredRecords().find((record) => record.id === checkbox.dataset.sourceRecord);
    if (!sourceRecord) {
      checkbox.checked = false;
      showMessage('Data sumber tidak lagi sesuai dengan pilihan instansi dan sumber.');
      return;
    }
    if (checkbox.checked) {
      try {
        const item = makeItem(sourceRecord);
        if (!items.some((entry) => entry.sourceId === item.sourceId)) items.push(item);
      } catch (error) {
        checkbox.checked = false;
        showMessage(error.message);
        return;
      }
    } else {
      items = items.filter((item) => item.sourceId !== checkbox.dataset.sourceRecord);
    }
    renderRecordSummary();
    if ($('#nota-document').innerHTML.trim()) {
      pricingSourceDirty = true;
      markEdited();
      showMessage('Pilihan data berubah. Generate ulang tabel sebelum menyimpan.');
    } else {
      showMessage(items.length ? 'Pilihan data diperbarui.' : 'Silakan pilih minimal satu data Booking/Branding.', items.length ? 'success' : 'error');
    }
  });
  $('#nota-items-body').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-item-remove]');
    const move = event.target.closest('[data-item-move]');
    if (remove) items.splice(Number(remove.dataset.itemRemove), 1);
    if (move) {
      const index = Number(move.dataset.itemMove);
      const target = index + Number(move.dataset.direction);
      if (target >= 0 && target < items.length) [items[index], items[target]] = [items[target], items[index]];
    }
    if (remove || move) {
      renderItemQueue();
      renderRecordSummary();
      if ($('#nota-document').innerHTML.trim()) {
        pricingSourceDirty = true;
        markEdited();
        showMessage('Daftar item berubah. Generate ulang tabel sebelum menyimpan.');
      }
    }
  });
  $('#nota-generate').addEventListener('click', () => {
    if (!validateCore()) return;
    if ($('#nota-document').innerHTML.trim() && !window.confirm('Membuat ulang tabel akan mengganti isi dokumen yang sedang diedit. Lanjutkan?')) return;
    $('#nota-document').innerHTML = createDocumentHtml();
    pricingSourceDirty = false;
    setStatus('GENERATED');
    updateDocumentTotals();
    showMessage('Draft Nota Dinas berhasil dibuat. Periksa dan edit sebelum disimpan atau difinalisasi.', 'success');
    $('#nota-document').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#nota-payment-method').addEventListener('change', () => {
    const currentDeadlines = [...document.querySelectorAll('[data-term-deadline]')].map((input) => input.value);
    renderPaymentTerms(currentDeadlines);
    updatePaymentCopy();
  });
  $('#nota-document-date').addEventListener('input', () => {
    updateNumberPreview();
    markEdited();
  });
  $('#nota-document-date').addEventListener('change', () => {
    updateNumberPreview();
    markEdited();
  });
  $('#nota-number').addEventListener('input', () => {
    const sanitized = $('#nota-number').value.replace(/\D/g, '').slice(0, 3);
    if ($('#nota-number').value !== sanitized) $('#nota-number').value = sanitized;
    updateNumberPreview();
    markEdited();
  });
  $('#nota-number').addEventListener('blur', () => {
    const sequence = sequenceValue($('#nota-number').value);
    if (sequence) $('#nota-number').value = sequence;
    updateNumberPreview();
  });
  $('#nota-document').addEventListener('focusin', (event) => {
    activeRow = event.target.closest('tr[data-nota-item-row]');
  });
  $('#nota-document').addEventListener('input', (event) => {
    if (event.target.closest('.nota-doc-table')) updateDocumentTotals();
    markEdited();
  });
  ['#nota-reference', '#nota-reference-date'].forEach((selector) => {
    $(selector).addEventListener('input', () => {
      if ($('#nota-document').innerHTML.trim()) {
        pricingSourceDirty = true;
        markEdited();
        showMessage('Informasi surat atau sumber berubah. Generate ulang tabel sebelum menyimpan.');
      }
    });
    $(selector).addEventListener('change', () => {
      if ($('#nota-document').innerHTML.trim()) {
        pricingSourceDirty = true;
        markEdited();
        showMessage('Informasi surat atau sumber berubah. Generate ulang tabel sebelum menyimpan.');
      }
    });
  });
  $('#nota-toolbar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-command]');
    if (button) {
      $('#nota-document').focus();
      document.execCommand(button.dataset.command, false);
      markEdited();
    }
  });
  $('#nota-add-row').addEventListener('click', addDocumentRow);
  $('#nota-remove-row').addEventListener('click', removeDocumentRow);
  $('#nota-move-row-up').addEventListener('click', () => moveDocumentRow(-1));
  $('#nota-move-row-down').addEventListener('click', () => moveDocumentRow(1));
  $('#nota-save').addEventListener('click', () => saveDocument(false));
  $('#nota-finalize').addEventListener('click', () => saveDocument(true));
  $('#nota-preview-action').addEventListener('click', () => $('#nota-document').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('#nota-print').addEventListener('click', () => window.print());
  $('#nota-pdf').addEventListener('click', () => window.print());
  $('#nota-new').addEventListener('click', resetForm);
  $('#nota-load').addEventListener('click', () => {
    const documentData = savedDocuments.find((entry) => entry.id === $('#nota-saved-list').value);
    if (!documentData) {
      showMessage('Pilih Nota Dinas yang akan dibuka.');
      return;
    }
    renderSavedDocument(documentData);
  });
}

function sourceChanged() {
  renderItemQueue();
  renderRecordSummary();
  if ($('#nota-document').innerHTML.trim()) {
    pricingSourceDirty = true;
    markEdited();
    showMessage('Sumber atau instansi berubah. Generate ulang tabel sebelum menyimpan.');
  } else {
    showMessage('');
  }
}

export async function initialiseNotaDinasFeatures(firestore, user, firestoreOperations = defaultFirestoreApi) {
  db = firestore;
  currentUser = user;
  firestoreApi = firestoreOperations;
  if (!initialized) {
    bindEvents();
    window.addEventListener('branding-dashboard-data-ready', (event) => {
      brandingRecords = Array.isArray(event.detail?.brandings) ? event.detail.brandings : [];
      masterBuses = Array.isArray(event.detail?.buses) ? event.detail.buses : [];
      refreshSelectedItemRoutes();
      renderOrganizations();
      renderRecordOptions();
    });
    initialized = true;
  }
  const data = window.__brandingDashboardData;
  brandingRecords = Array.isArray(data?.brandings) ? data.brandings : [];
  masterBuses = Array.isArray(data?.buses) ? data.buses : [];
  if (!currentDocumentId && !$('#nota-document-date').value) $('#nota-document-date').value = localToday();
  renderOrganizations();
  renderRecordOptions();
  updateNumberPreview();
  setStatus(currentStatus);
  await loadSavedDocuments();
}
