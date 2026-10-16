import {
  calculateConfirmationQuote,
  confirmationCompanies,
  confirmationField,
  confirmationRecordId,
  confirmationRecordLabel,
  eligibleConfirmationRecords,
  formatConfirmationCurrency,
  mapConfirmationRecord,
  confirmationTerbilang,
} from './surat-konfirmasi-model.js';

const $ = (selector) => document.querySelector(selector);
const state = {
  records: [],
  buses: [],
  selectedIds: new Set(),
  imageData: '',
  canCreate: false,
  initialized: false,
};

const TERMS = [
  'Sticker dibuat tidak menutupi bagian dari lampu rem bus.',
  'Tulisan & Logo Trans Jogja di bagian body bus tidak boleh tertutupi oleh sticker.',
  'PT.AMI memberikan standar logo Trans Jogja yang mencakup logo, warna, slogan, dan elemen grafis lainnya yang mencerminkan identitas TransJogja yang wajib diikuti oleh mitra.',
  'Desain Branding dari mitra harus sesuai dengan Panduan Identitas Visual TransJogja yang telah ditetapkan, termasuk penggunaan warna, font, dan proporsi dan dimensi logo Trans Jogja.',
  'Sebelum pemasangan branding, mitra wajib melampirkan mock up desain yang akan dipasang di badan bus sebagai bahan lampiran yang akan mendapatkan persetujuan dari PT.AMI',
  'Mitra wajib untuk melampirkan Surat Izin Pemasangan beserta jadwal pemasangan branding di bus dengan nomor lambung yang sudah disepakati',
  'Pastikan branding terlihat jelas dan terbaca dengan baik, serta posisinya sesuai dengan desain yang telah disetujui.',
  'Apabila ada ketidaksesuaian dari desain yang sudah disetujui dengan pemasangan, maka PT.AMI dapat sewaktu-waktu meminta revisi atau perubahan kepada sticker yang sudah dipasang, dengan biaya seluruhnya ditanggung oleh mitra.',
  'Setelah masa berlaku pemasangan branding selesai, mitra diwajibkan untuk melepas sticker branding tanpa merusak cat asli dari bus TransJogja',
  'Apabila pihak mitra dalam proses pelepasan merusak badan bus TransJogja, maka pihak TransJogja berhak meminta pertanggungjawaban dari pihak mitra dengan biaya ditanggung sepenuhnya oleh pihak mitra.',
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function getSourceRecords() {
  return eligibleConfirmationRecords(state.records, $('#confirmation-source').value);
}

function getRecordsForCompany() {
  const company = $('#confirmation-company').value;
  if (!company) return [];
  return getSourceRecords().filter((record) => confirmationField(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT') === company);
}

function getMappedRecord(record, index) {
  let context = {};
  let contextError = '';
  try {
    if (typeof window.getBrandingPricingContext === 'function') context = window.getBrandingPricingContext(record) || {};
  } catch (error) {
    contextError = error.message || 'Konteks harga gagal dibaca.';
  }
  return mapConfirmationRecord(record, state.buses, {
    getPricingContext: () => context,
    getDuration: (source, pricingContext) => {
      const dateDuration = typeof window.getContractDurationMonths === 'function'
        ? window.getContractDurationMonths(source)
        : null;
      return Number.isInteger(dateDuration) && dateDuration > 0
        ? dateDuration
        : pricingContext.duration;
    },
    getPrice: (mediaBus, space, duration) => {
      if (contextError) return { reason: `Gagal membaca konteks harga aktif: ${contextError}` };
      if (typeof window.getBrandingPriceTier !== 'function') {
        return { reason: 'Resolver pricelist aktif belum tersedia.' };
      }
      return window.getBrandingPriceTier(mediaBus, space, duration);
    },
  }, index);
}

function getSelectedItems() {
  const companyRecords = getRecordsForCompany();
  return companyRecords
    .map((record, index) => ({ record, index, id: confirmationRecordId(record, index) }))
    .filter(({ id }) => state.selectedIds.has(id))
    .map(({ record, index }) => getMappedRecord(record, index));
}

function setMessage(text, type = '') {
  const element = $('#confirmation-message');
  element.textContent = text;
  element.classList.toggle('is-error', type === 'error');
  element.classList.toggle('is-success', type === 'success');
  element.classList.toggle('is-info', type === 'info');
}

function renderCompanies(selected = $('#confirmation-company').value) {
  const select = $('#confirmation-company');
  const companies = confirmationCompanies(getSourceRecords());
  select.innerHTML = '<option value="">Pilih instansi</option>'
    + companies.map((company) => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join('');
  select.value = companies.includes(selected) ? selected : '';
  if (selected && select.value !== selected) state.selectedIds.clear();
}

function recordSearchText(record) {
  return [
    confirmationField(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT'),
    confirmationField(record, 'namaBrand', 'Nama Brand', 'brand'),
    confirmationField(record, 'noPolisi', 'No Polisi', 'no_polisi'),
    confirmationField(record, 'noLamb', 'No Lamb', 'no_lamb'),
    confirmationField(record, 'referensi', 'pks', 'keterangan', 'Keterangan'),
    record.id,
  ].join(' ').toLocaleLowerCase('id');
}

function renderRecordOptions() {
  const container = $('#confirmation-record-options');
  const companyRecords = getRecordsForCompany();
  const query = $('#confirmation-search').value.trim().toLocaleLowerCase('id');
  const matches = companyRecords
    .map((record, index) => ({ record, index, id: confirmationRecordId(record, index) }))
    .filter(({ record }) => !query || recordSearchText(record).includes(query));
  $('#confirmation-record-empty').textContent = !companyRecords.length
    ? 'Pilih instansi untuk melihat data yang dapat dimasukkan ke surat.'
    : matches.length ? '' : 'Data tidak ditemukan untuk pencarian ini.';
  container.innerHTML = matches.map(({ record, index, id }) => {
    const mapped = getMappedRecord(record, index);
    const selected = state.selectedIds.has(id);
    const price = mapped.basePriceCents === null
      ? `<small class="confirmation-price-error">${escapeHtml(mapped.pricingError)}</small>`
      : `<small>${escapeHtml(formatConfirmationCurrency(mapped.basePriceCents))} / ${mapped.duration} bulan</small>`;
    return `<button class="confirmation-record-choice${selected ? ' is-selected' : ''}" type="button" data-record-id="${escapeHtml(id)}" aria-pressed="${selected}">
      <span><strong>${escapeHtml(confirmationRecordLabel(record))}</strong><small>${escapeHtml(mapped.tipeBus || mapped.mediaBus || 'Tipe bus belum tersedia')} · ${escapeHtml(mapped.space || 'Space belum tersedia')}</small></span>
      <span class="confirmation-record-price">${price}</span>
    </button>`;
  }).join('');
}

function renderSelectedItems() {
  const items = getSelectedItems();
  $('#confirmation-selected-count').textContent = String(items.length);
  $('#confirmation-selected-body').innerHTML = items.length
    ? items.map((item) => `<tr>
        <td>${escapeHtml(item.namaBrand || '—')}<small>${escapeHtml(item.namaPT || '—')}</small></td>
        <td>${escapeHtml(item.noPolisi || '—')}<small>${escapeHtml(item.noLamb || '—')} · ${escapeHtml(item.jalur || '—')}</small></td>
        <td>${escapeHtml(item.mediaBus || item.tipeBus || '—')}<small>${escapeHtml(item.space || '—')} · ${item.duration ? `${item.duration} bulan` : 'Durasi belum tersedia'}</small></td>
        <td>${item.basePriceCents === null ? `<span class="confirmation-price-error">${escapeHtml(item.pricingError)}</span>` : escapeHtml(formatConfirmationCurrency(item.basePriceCents))}</td>
        <td><button class="confirmation-remove-record secondary" type="button" data-record-id="${escapeHtml(item.id)}" aria-label="Hapus ${escapeHtml(item.noPolisi || item.namaBrand)}">Hapus</button></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty-state">Pilih data Booking/Branding.</td></tr>';
}

function formatDate(value) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function getDocumentData() {
  return {
    number: $('#confirmation-number').value,
    attachment: $('#confirmation-attachment').value,
    subject: $('#confirmation-subject').value,
    date: $('#confirmation-date').value,
    referenceNumber: $('#confirmation-reference-number').value,
    referenceDate: $('#confirmation-reference-date').value,
    referenceSubject: $('#confirmation-reference-subject').value,
    company: $('#confirmation-company').value,
    recipientPosition: $('#confirmation-recipient-position').value,
    recipientName: $('#confirmation-recipient-name').value,
    recipientLocation: $('#confirmation-recipient-location').value,
    campaign: $('#confirmation-campaign').value,
    items: getSelectedItems(),
  };
}

function renderPricingRows(quote) {
  if (!quote.rows.length) return '<tr><td colspan="7">Belum ada data harga.</td></tr>';
  return quote.rows.map((row, index) => `<tr>
    <td>${index + 1}</td><td>${escapeHtml(row.mediaBus)}</td><td>${escapeHtml(row.space)}</td>
    <td>${row.quantity} Unit</td><td>${row.duration} Bulan</td>
    <td>${escapeHtml(formatConfirmationCurrency(row.basePriceCents))}</td>
    <td>${escapeHtml(formatConfirmationCurrency(row.totalCents))}</td>
  </tr>`).join('');
}

function renderPreview() {
  if (!$('#confirmation-pages')) return;
  const data = getDocumentData();
  const quote = calculateConfirmationQuote(data.items);
  const unavailable = quote.errors.length > 0;
  const totals = unavailable
    ? '<p class="confirmation-preview-error">Harga belum dapat dihitung untuk seluruh armada yang dipilih.</p>'
    : !data.items.length
      ? '<p class="confirmation-preview-error">Pilih data Booking/Branding untuk menghitung harga dan PPN.</p>'
    : `<div class="confirmation-total-row"><span>Jumlah Harga Sebelum PPN</span><strong>${escapeHtml(formatConfirmationCurrency(quote.baseTotalCents))}</strong></div>
       <div class="confirmation-total-row"><span>PPN 11%</span><strong>${escapeHtml(formatConfirmationCurrency(quote.ppnCents))}</strong></div>
       <div class="confirmation-total-row is-grand"><span>Jumlah Total</span><strong>${escapeHtml(formatConfirmationCurrency(quote.grandTotalCents))}</strong></div>
       <p class="confirmation-terbilang"><strong>Terbilang:</strong> ${escapeHtml(confirmationTerbilang(quote.grandTotalCents))}</p>`;
  const firstTermCount = quote.rows.length > 3 ? 1 : 3;
  const pageOneTerms = TERMS.slice(0, firstTermCount);
  const pageTwoTerms = TERMS.slice(firstTermCount);
  const introductoryParagraph = `Menindaklanjuti surat No : ${data.referenceNumber || '[Nomor surat referensi]'} tanggal ${formatDate(data.referenceDate)}${data.referenceSubject ? ` tentang ${data.referenceSubject}` : ''}${data.campaign ? ` terkait ${data.campaign}` : ''}, berikut kami sampaikan harga branding bus Trans Jogja sebagai berikut:`;
  const sheet = (content, pageNumber) => `<article class="confirmation-sheet" aria-label="Pratinjau halaman ${pageNumber}">
    <div class="confirmation-sheet-content">${content}</div>
  </article>`;
  const metadata = `<div class="confirmation-document-meta">
    <p>Nomor: ${escapeHtml(data.number || '[Nomor surat]')}</p><p>Lampiran: ${escapeHtml(data.attachment)}</p><p>Perihal: ${escapeHtml(data.subject || '[Perihal]')}</p>
  </div>
  <div class="confirmation-recipient"><p>Kepada yth</p><p>${escapeHtml(data.recipientPosition || '[Jabatan penerima]')}</p><p>${escapeHtml(data.company || '[Instansi / calon mitra]')}</p><p>${escapeHtml(data.recipientName || '[Nama penerima]')}</p><p>${escapeHtml(data.recipientLocation || '[Lokasi penerima]')}</p></div>
  <p class="confirmation-subject-line"><strong>Hal:</strong> ${escapeHtml(data.subject || '[Perihal]')}</p>
  <p>Dengan hormat.</p><p>${escapeHtml(introductoryParagraph)}</p>
  <p class="confirmation-table-caption">Rincian harga (belum termasuk PPN):</p>`;
  const pricingTable = `<table class="confirmation-pricing-table"><thead><tr><th>No</th><th>Media Bus</th><th>Space</th><th>Quantity</th><th>Periode</th><th>Harga Satuan</th><th>Jumlah Total</th></tr></thead><tbody>${renderPricingRows(quote)}</tbody></table>
    ${totals}<p class="confirmation-price-terms">Harga di atas merupakan harga sebelum PPN dan tidak termasuk biaya produksi, maintenance, biaya pasang sticker, bongkar pasang sticker, dan perizinan.</p>
    <p class="confirmation-terms-heading">Adapun ketentuan sebagai berikut:</p>
    <ol class="confirmation-terms">${pageOneTerms.map((term) => `<li>${escapeHtml(term)}</li>`).join('')}</ol>`;
  const pageTwo = `<p class="confirmation-continuation">Ketentuan (lanjutan):</p><ol class="confirmation-terms" start="${firstTermCount + 1}">${pageTwoTerms.map((term) => `<li>${escapeHtml(term)}</li>`).join('')}</ol>
    <p>Demikian kami sampaikan surat ini. Untuk tindak lanjut Perjanjian Kerjasama (PKS) atau negosiasi agar menghubungi Danny Indra – 082 233 290 871. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.</p>
    <div class="confirmation-signature"><p>Yogyakarta, ${escapeHtml(formatDate(data.date))}</p><p>PT. Anindya Mitra Internasional</p><div class="confirmation-signature-space"></div><p><strong>Priyatno Bambang Hernowo</strong><br>Direktur Utama</p></div>`;
  $('#confirmation-pages').innerHTML = sheet(metadata + pricingTable, 1) + sheet(pageTwo, 2);
  $('#confirmation-preview-status').textContent = unavailable
    ? 'Harga perlu dilengkapi'
    : `${quote.rows.length} kelompok harga · 2 halaman`;
  updatePdfAvailability(quote);
}

function getValidationError(data, quote) {
  if (!state.canCreate) return 'Akun ini hanya memiliki izin melihat. Izin surat.create diperlukan untuk mengunduh PDF.';
  if (!data.number.trim()) return 'Nomor surat wajib diisi.';
  if (!data.subject.trim()) return 'Perihal wajib diisi.';
  if (!data.date) return 'Tanggal surat wajib diisi.';
  if (!data.referenceNumber.trim()) return 'Nomor surat referensi wajib diisi.';
  if (!data.referenceDate) return 'Tanggal surat referensi wajib diisi.';
  if (!data.company) return 'Pilih instansi/calon mitra dari data yang tersedia.';
  if (!data.recipientPosition.trim() || !data.recipientName.trim() || !data.recipientLocation.trim()) {
    return 'Lengkapi jabatan, nama, dan lokasi/alamat penerima. Data penerima tidak akan dibuat otomatis.';
  }
  if (!data.items.length) return 'Pilih setidaknya satu data Booking/Branding.';
  if (quote.errors.length) return `Harga aktif belum tersedia untuk seluruh data terpilih: ${quote.errors.join(' ')}`;
  return '';
}

function updatePdfAvailability(quote = calculateConfirmationQuote(getSelectedItems())) {
  $('#confirmation-pdf').disabled = Boolean(getValidationError(getDocumentData(), quote)) || !state.imageData;
}

function renderAll() {
  renderRecordOptions();
  renderSelectedItems();
  renderPreview();
}

function bindEvents() {
  $('#confirmation-form').addEventListener('input', renderPreview);
  $('#confirmation-refresh').addEventListener('click', () => {
    renderAll();
    setMessage('Pratinjau telah diperbarui.', 'success');
  });
  $('#confirmation-source').addEventListener('change', () => {
    state.selectedIds.clear();
    renderCompanies('');
    renderAll();
  });
  $('#confirmation-company').addEventListener('change', () => {
    state.selectedIds.clear();
    renderAll();
  });
  $('#confirmation-search').addEventListener('input', renderRecordOptions);
  $('#confirmation-record-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-record-id]');
    if (!button) return;
    const id = button.dataset.recordId;
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    renderAll();
  });
  $('#confirmation-selected-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-record-id]');
    if (!button) return;
    state.selectedIds.delete(button.dataset.recordId);
    renderAll();
  });
  $('#confirmation-pdf').addEventListener('click', downloadPdf);
}

function validateAndPrepare() {
  const data = getDocumentData();
  const quote = calculateConfirmationQuote(data.items);
  const error = getValidationError(data, quote);
  if (error) throw new Error(error);
  return { data, quote };
}

async function loadLetterhead() {
  const response = await fetch(new URL('./assets/surat-konfirmasi/image1.png', import.meta.url));
  if (!response.ok) throw new Error(`Gagal memuat kop surat resmi (HTTP ${response.status}).`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca aset kop surat resmi.'));
    reader.readAsDataURL(blob);
  });
}

function drawBackground(doc, imageData) {
  doc.addImage(imageData, 'PNG', 0, 0, 210, 297);
}

function drawParagraph(doc, text, x, y, width, options = {}) {
  const fontSize = options.fontSize || 9;
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(String(text || ''), width);
  doc.text(lines, x, y);
  return y + (lines.length * (fontSize * 0.42)) + (options.gap ?? 2);
}

function ensurePageSpace(doc, stateRef, needed, imageData, minimumY = 264) {
  if (stateRef.y + needed <= minimumY) return false;
  doc.addPage('a4', 'portrait');
  drawBackground(doc, imageData);
  stateRef.y = 39;
  return true;
}

export function renderConfirmationPdf(doc, data, quote, imageData) {
  drawBackground(doc, imageData);
  const margin = 25;
  const width = 160;
  const position = { y: 39 };
  const rightX = margin + width;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nomor: ${data.number}`, margin, position.y);
  doc.text(`Lampiran: ${data.attachment || '-'}`, margin, position.y + 4.5);
  doc.text(`Perihal: ${data.subject}`, margin, position.y + 9);
  position.y += 18;
  position.y = drawParagraph(doc, 'Kepada yth', margin, position.y, width, { gap: 0 });
  position.y = drawParagraph(doc, data.recipientPosition, margin, position.y, width, { gap: 0 });
  position.y = drawParagraph(doc, data.company, margin, position.y, width, { gap: 0 });
  position.y = drawParagraph(doc, data.recipientName, margin, position.y, width, { gap: 0 });
  position.y = drawParagraph(doc, data.recipientLocation, margin, position.y, width, { gap: 3 });
  position.y = drawParagraph(doc, `Hal: ${data.subject}`, margin, position.y, width, { bold: true, gap: 3 });
  position.y = drawParagraph(doc, 'Dengan hormat.', margin, position.y, width, { gap: 2 });
  const referenceSubject = data.referenceSubject ? ` tentang ${data.referenceSubject}` : '';
  const campaign = data.campaign ? ` terkait ${data.campaign}` : '';
  position.y = drawParagraph(
    doc,
    `Menindaklanjuti surat No : ${data.referenceNumber} tanggal ${formatDate(data.referenceDate)}${referenceSubject}${campaign}, berikut kami sampaikan harga branding bus Trans Jogja sebagai berikut:`,
    margin, position.y, width, { gap: 2 },
  );
  position.y = drawParagraph(doc, 'Rincian harga (belum termasuk PPN):', margin, position.y, width, { bold: true, gap: 1 });

  doc.autoTable({
    startY: position.y,
    margin: { left: margin, right: margin, bottom: 34 },
    tableWidth: width,
    theme: 'grid',
    head: [['No', 'Media Bus', 'Space', 'Quantity', 'Periode', 'Harga Satuan', 'Jumlah Total']],
    body: quote.rows.map((row, index) => [
      String(index + 1), row.mediaBus, row.space, `${row.quantity} Unit`,
      `${row.duration} Bulan`, formatConfirmationCurrency(row.basePriceCents), formatConfirmationCurrency(row.totalCents),
    ]),
    styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [14, 74, 49], textColor: [255, 255, 255], fontSize: 6.3 },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 29 }, 2: { cellWidth: 22 },
      3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: 17, halign: 'center' },
      5: { cellWidth: 34, halign: 'right' }, 6: { cellWidth: 35, halign: 'right' },
    },
    foot: [],
    willDrawPage: () => {
      if (doc.getNumberOfPages() > 1) drawBackground(doc, imageData);
    },
  });
  position.y = doc.lastAutoTable.finalY + 3;
  ensurePageSpace(doc, position, 38, imageData);
  position.y = drawParagraph(doc, `Jumlah Harga Sebelum PPN: ${formatConfirmationCurrency(quote.baseTotalCents)}`, margin, position.y, width);
  position.y = drawParagraph(doc, `PPN 11%: ${formatConfirmationCurrency(quote.ppnCents)}`, margin, position.y, width);
  position.y = drawParagraph(doc, `Jumlah Total: ${formatConfirmationCurrency(quote.grandTotalCents)}`, margin, position.y, width, { bold: true });
  position.y = drawParagraph(doc, `Terbilang: ${confirmationTerbilang(quote.grandTotalCents)}`, margin, position.y, width, { gap: 3 });
  position.y = drawParagraph(doc, 'Harga di atas merupakan harga sebelum PPN dan tidak termasuk biaya produksi, maintenance, biaya pasang sticker, bongkar pasang sticker, dan perizinan. Adapun ketentuan sebagai berikut:', margin, position.y, width, { gap: 2 });

  TERMS.forEach((term, index) => {
    const lines = doc.splitTextToSize(`${index + 1}. ${term}`, width - 5);
    const required = (lines.length * 3.7) + 3;
    const continued = ensurePageSpace(doc, position, required, imageData);
    if (continued && index > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Ketentuan (lanjutan):', margin, position.y);
      position.y += 6;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(lines, margin + 4, position.y);
    position.y += required;
  });

  const closing = 'Demikian kami sampaikan surat ini. Untuk tindak lanjut Perjanjian Kerjasama (PKS) atau negosiasi agar menghubungi Danny Indra – 082 233 290 871. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.';
  ensurePageSpace(doc, position, 53, imageData);
  position.y = drawParagraph(doc, closing, margin, position.y, width, { gap: 8 });
  const signatureX = rightX - 58;
  position.y = Math.max(position.y, 207);
  doc.text(`Yogyakarta, ${formatDate(data.date)}`, signatureX, position.y);
  doc.text('PT. Anindya Mitra Internasional', signatureX, position.y + 5);
  doc.text('Priyatno Bambang Hernowo', signatureX, position.y + 34);
  doc.text('Direktur Utama', signatureX, position.y + 39);
  return doc.getNumberOfPages();
}

async function downloadPdf() {
  try {
    const { data, quote } = validateAndPrepare();
    if (!window.jspdf?.jsPDF) throw new Error('Generator PDF A4 belum tersedia.');
    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageCount = renderConfirmationPdf(doc, data, quote, state.imageData);
    const safeCompany = data.company.replace(/[<>:"/\\|?*]/g, '-').trim() || 'Instansi';
    doc.save(`Surat-Konfirmasi-${safeCompany}-${data.date}.pdf`);
    setMessage(`PDF A4 berhasil dibuat (${pageCount} halaman). Data sumber tidak diubah.`, 'success');
  } catch (error) {
    setMessage(error.message || 'PDF Surat Konfirmasi gagal dibuat.', 'error');
  }
}

export async function initialiseSuratKonfirmasiFeatures() {
  if (state.initialized) return;
  state.initialized = true;
  state.canCreate = typeof window.can !== 'function' || window.can('surat.create');
  const today = new Date();
  const dateInput = $('#confirmation-date');
  dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  $('#confirmation-record-options').setAttribute('aria-disabled', String(!state.canCreate));
  if (!state.canCreate) {
    $('#confirmation-form').querySelectorAll('input,select,button').forEach((control) => { control.disabled = true; });
    $('#confirmation-refresh').disabled = true;
    setMessage('Akun Anda hanya memiliki izin melihat. Izin surat.create diperlukan untuk mengisi dan mengunduh surat.', 'info');
  }
  bindEvents();
  const data = window.__brandingDashboardData || {};
  state.records = Array.isArray(data.brandings) ? data.brandings : [];
  state.buses = Array.isArray(data.buses) ? data.buses : [];
  renderCompanies('');
  renderAll();
  window.addEventListener('branding-dashboard-data-ready', (event) => {
    state.records = Array.isArray(event.detail?.brandings) ? event.detail.brandings : [];
    state.buses = Array.isArray(event.detail?.buses) ? event.detail.buses : state.buses;
    renderCompanies();
    renderAll();
  });
  window.addEventListener('branding-pricing-updated', renderAll);
  setMessage('Memuat aset kop surat resmi...', 'info');
  try {
    state.imageData = await loadLetterhead();
    renderPreview();
    setMessage('');
  } catch (error) {
    console.error('Gagal memuat aset Surat Konfirmasi:', error);
    setMessage(error.message || 'Aset kop surat resmi gagal dimuat.', 'error');
  }
}
