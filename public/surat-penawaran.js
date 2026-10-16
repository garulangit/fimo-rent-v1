import {
  buildOfferPricingRows,
  canCombineOfferRecords,
  eligibleOfferRecords,
  formatOfferCurrency,
  formatOfferDate,
  getOfferRecordData,
  offerRecordLabel,
} from './surat-penawaran-model.js';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character]);

const PRICE_DURATIONS = [1, 3, 6, 12];
const TERMS = [
  'Sticker dibuat tidak menutupi bagian dari lampu rem bus.',
  'Tulisan & Logo Trans Jogja di bagian body bus tidak boleh tertutupi oleh sticker.',
  'PT.AMI memberikan standar logo Trans Jogja yang mencakup logo, warna, slogan, dan elemen grafis lainnya yang mencerminkan identitas TransJogja yang wajib diikuti oleh mitra.',
  'Desain Branding dari mitra harus sesuai dengan Panduan Identitas Visual TransJogja yang telah ditetapkan, termasuk penggunaan warna, font, dan proporsi dan dimensi logo Trans Jogja.',
  'Sebelum pemasangan branding, mitra wajib melampirkan mock up desain yang akan dipasang di badan bus sebagai bahan lampiran yang akan mendapatkan persetujuan dari PT.AMI.',
  'Mitra wajib untuk melampirkan Surat Izin Pemasangan beserta jadwal pemasangan branding di bus dengan nomor lambung yang sudah disepakati.',
  'Pastikan branding terlihat jelas dan terbaca dengan baik, serta posisinya sesuai dengan desain yang telah disetujui.',
  'Apabila ada ketidaksesuaian dari desain yang sudah disetujui dengan pemasangan, maka PT.AMI dapat sewaktu-waktu meminta revisi atau perubahan kepada sticker yang sudah dipasang, dengan biaya seluruhnya ditanggung oleh mitra.',
  'Setelah masa berlaku pemasangan branding selesai, mitra diwajibkan untuk melepas sticker branding tanpa merusak cat asli dari bus TransJogja.',
  'Apabila pihak mitra dalam proses pelepasan merusak badan bus TransJogja, maka pihak TransJogja berhak meminta pertanggungjawaban dari pihak mitra dengan biaya ditanggung sepenuhnya oleh pihak mitra.',
];
const APPENDIX_PAGES = [
  {
    title: 'Keterangan Logo TransJogja',
    paragraphs: [
      'Font logo Trans Jogja: Montila Extended Extra-Bold.',
      'Round putih: 145 cm x 30 cm. Logo di dalam round: 128 cm x 24 cm.',
      'Ukuran pemasangan: jarak atas logo ke jendela 23 cm; jarak bawah ke body 87 cm; batas kanan ke garis pintu 105 cm.',
    ],
    images: ['image4.png'],
  },
  {
    title: 'Area Tanpa Pemasangan Branding',
    paragraphs: [
      'Area bagian depan bus tidak digunakan untuk pemasangan branding.',
      'Area pintu samping tidak digunakan untuk branding. Lebar pintu 120 cm, tinggi pintu 193 cm, dan tinggi pintu sampai body atas 210 cm.',
      'Kaca samping hanya boleh dibranding maksimal 10% dari luas kaca.',
      'Gambar kendaraan di bawah mempertahankan ukuran dan penandaan pada lampiran sumber.',
    ],
    images: ['image2.png'],
  },
  {
    title: 'Tempat Iklan di Bagian Kiri Body',
    paragraphs: [
      'Area iklan mengikuti bidang panel pada gambar sumber. Elemen identitas Trans Jogja, pintu, lampu, dan bagian operasional harus tetap terlihat.',
      'Dimensi yang ditandai pada gambar sumber antara lain 322 cm, 133 cm, 26 cm, 118 cm, dan 48 cm.',
    ],
    images: ['image2.png'],
  },
  {
    title: 'Tempat Iklan di Bagian Kanan Body',
    paragraphs: [
      'Penempatan iklan mengikuti batas panel pada gambar sumber; elemen logo Trans Jogja dan area pintu harus dipertahankan.',
      'Dimensi yang ditandai pada gambar sumber antara lain 128 cm, 145 cm, 30 cm, 118 cm, 48 cm, dan 26 cm.',
    ],
    images: ['image3.png'],
  },
  {
    title: 'Tempat Iklan di Bagian Belakang Bus',
    paragraphs: [
      'Area penempatan pada bagian belakang bus harus mengikuti panel kendaraan dan mock up yang disetujui PT AMI.',
      'Ukuran yang tercantum pada lampiran sumber: 190 cm, 130 cm, dan 208 cm. Area lampu rem, identitas armada, serta elemen operasional tidak boleh tertutup.',
      'Mock up pemasangan tetap harus diajukan untuk persetujuan PT AMI sebelum produksi dan pemasangan sticker.',
      'Contoh aset logo di bawah berasal dari lampiran sumber dan harus mengikuti panduan identitas TransJogja.',
    ],
    images: ['image19.png', 'image28.png'],
  },
];

const FORM_FIELDS = [
  'offer-number', 'offer-attachment', 'offer-subject', 'offer-date',
  'offer-recipient', 'offer-recipient-title', 'offer-company',
  'offer-location', 'offer-reference',
];

let initialized = false;
let state = {
  source: 'Booking',
  records: [],
  selected: new Map(),
  assets: {},
  creating: false,
};

function getField(record, ...keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function getOfferRecord(record) {
  if (typeof window.calculateBookingFinancials !== 'function') {
    return getOfferRecordData(record);
  }
  return getOfferRecordData(record, window.calculateBookingFinancials(record));
}

function selectedRecords() {
  return [...state.selected.values()];
}

function getCurrentPricingRows() {
  const catalog = typeof window.getBrandingPricingCatalog === 'function'
    ? window.getBrandingPricingCatalog()
    : [];
  const categories = [...new Set(selectedRecords().map((record) => getOfferRecord(record).mediaBus).filter(Boolean))];
  return buildOfferPricingRows(
    catalog,
    (mediaBus, space, duration) => typeof window.getBrandingPriceTier === 'function'
      ? window.getBrandingPriceTier(mediaBus, space, duration)
      : null,
    categories,
  );
}

function getInputValues() {
  return Object.fromEntries(FORM_FIELDS.map((id) => [id, $(`#${id}`)?.value || '']));
}

function setMessage(text, kind = 'info') {
  const message = $('#offer-message');
  if (!message) return;
  message.textContent = text;
  message.className = `offer-message${kind === 'error' ? ' is-error' : kind === 'success' ? ' is-success' : ''}`;
}

function showRecordStatus(record) {
  return getField(record, 'status', 'Status') || '—';
}

function renderSourceRecords() {
  const container = $('#offer-record-options');
  const empty = $('#offer-record-empty');
  if (!container || !empty) return;
  const query = ($('#offer-search')?.value || '').trim().toLocaleLowerCase('id');
  const records = eligibleOfferRecords(state.records, state.source).filter((record) =>
    !query || offerRecordLabel(record).includes(query));
  container.innerHTML = records.map((record) => {
    const id = getField(record, 'id', 'ID Branding', 'noPolisi', 'No Polisi');
    const key = `${state.source}:${id}`;
    const chosen = state.selected.has(key);
    const company = getField(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT') || 'Perusahaan belum diisi';
    const brand = getField(record, 'namaBrand', 'Nama Brand', 'brand') || 'Branding';
    const bus = getField(record, 'noPolisi', 'No Polisi', 'no_polisi') || 'No Polisi belum tersedia';
    const noLamb = getField(record, 'noLamb', 'No Lamb', 'no_lamb');
    const type = getField(record, 'jenisBranding', 'Jenis Branding', 'jenis_branding', 'type');
    return `<button type="button" class="offer-record-choice${chosen ? ' is-selected' : ''}" data-offer-record-key="${escapeHtml(key)}" aria-pressed="${chosen}"${state.creating ? '' : ' disabled'}>
      <span><strong>${escapeHtml(company)}</strong><small>${escapeHtml(brand)} · ${escapeHtml(showRecordStatus(record))}</small></span>
      <span class="offer-record-bus"><strong>${escapeHtml(bus)}</strong><small>${escapeHtml(noLamb ? `No Lamb ${noLamb}` : type)}</small></span>
    </button>`;
  }).join('');
  empty.hidden = records.length > 0;
  empty.textContent = !state.records.length
    ? 'Data Booking/Branding belum berhasil dimuat.'
    : records.length
      ? ''
      : 'Tidak ada data yang sesuai sumber, status, dan pencarian.';
}

function renderSelectedRecords() {
  const tbody = $('#offer-selected-body');
  if (!tbody) return;
  const selected = selectedRecords();
  $('#offer-selected-count').textContent = String(selected.length);
  if (!selected.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Pilih data Booking/Branding.</td></tr>';
    return;
  }
  tbody.innerHTML = selected.map((entry, index) => {
    const data = getOfferRecord(entry.record);
    const price = data.pricingReason
      ? `<span class="offer-price-error" title="${escapeHtml(data.pricingReason)}">Harga belum tersedia</span>`
      : `${escapeHtml(formatOfferCurrency(data.basePrice))}<small>${escapeHtml(formatOfferCurrency(data.monthlyRevenue))} / bulan · ${data.duration ? `${data.duration} bulan` : 'Durasi belum valid'}</small>`;
    return `<tr>
      <td>${escapeHtml(data.company || '—')}<small>${escapeHtml(data.brand || '—')}</small></td>
      <td>${escapeHtml(data.noPolisi || '—')}<small>${escapeHtml(data.noLamb ? `No Lamb ${data.noLamb}` : '—')}</small></td>
      <td>${escapeHtml(data.type || '—')}<small>${escapeHtml(data.busType || 'Tipe bus belum tersedia')} · ${data.duration ? `${data.duration} bulan` : 'Durasi belum valid'}</small></td>
      <td>${price}</td>
      <td><button type="button" class="secondary offer-remove-record" data-offer-remove="${index}" aria-label="Hapus ${escapeHtml(data.noPolisi || 'data')}"${state.creating ? '' : ' disabled'}>Hapus</button></td>
    </tr>`;
  }).join('');
}

function updateAutofilledLetterFields() {
  const first = selectedRecords()[0];
  if (!first) {
    ['offer-company', 'offer-reference'].forEach((id) => {
      const input = $(`#${id}`);
      if (input.dataset.autofilled === 'true') input.value = '';
      input.dataset.autofilled = 'false';
    });
    const subject = $('#offer-subject');
    if (subject.dataset.autofilled === 'true' && !subject.dataset.userEdited) subject.value = '';
    subject.dataset.autofilled = 'false';
    return;
  }
  const record = first.record;
  const companyField = $('#offer-company');
  const company = getField(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT');
  if (company && (!companyField.value || companyField.dataset.autofilled === 'true')) {
    companyField.value = company;
    companyField.dataset.autofilled = 'true';
  }
  const referenceField = $('#offer-reference');
  const reference = getField(record, 'referensi', 'pks', 'keterangan', 'Keterangan');
  if (reference && (!referenceField.value || referenceField.dataset.autofilled === 'true')) {
    referenceField.value = reference;
    referenceField.dataset.autofilled = 'true';
  }
  const subjectField = $('#offer-subject');
  if (!subjectField.dataset.userEdited) {
    subjectField.value = `Surat Penawaran Kerja Sama Branding Bus Trans Jogja${company ? ` - ${company}` : ''}`;
    subjectField.dataset.autofilled = 'true';
  }
}

function formatPricingPreview() {
  const rows = getCurrentPricingRows();
  const ppn = typeof window.getBrandingPpnConfiguration === 'function' ? window.getBrandingPpnConfiguration() : null;
  const ppnLabel = ppn?.enabled === false ? 'PPN nonaktif' : `PPN ${Number(ppn?.percent ?? 11)}%`;
  const data = rows.map((row, index) => `<tr>
    <td>${index + 1}</td><td>${escapeHtml(row.mediaBus)}</td><td>${escapeHtml(row.spaceIklan)}</td>
    ${row.prices.map((price) => `<td>${escapeHtml(formatOfferCurrency(price))}</td>`).join('')}
  </tr>`).join('');
  return `<div class="offer-preview-table-wrap"><p><b>Harga Exclude ${escapeHtml(ppnLabel)}</b></p><table class="offer-preview-table offer-pricing-preview">
    <thead><tr><th>No</th><th>Media Bus</th><th>Space Iklan</th>${PRICE_DURATIONS.map((duration) => `<th>${duration} Bulan</th>`).join('')}</tr></thead>
    <tbody>${data || '<tr><td colspan="7">Pricelist aktif belum tersedia.</td></tr>'}</tbody>
  </table></div>`;
}

function renderPreview() {
  const container = $('#offer-pages');
  if (!container) return;
  const inputs = getInputValues();
  const selected = selectedRecords().map((entry) => getOfferRecord(entry.record));
  const company = inputs['offer-company'] || selected[0]?.company || '[Perusahaan / Instansi]';
  const subject = inputs['offer-subject'] || '[Perihal surat]';
  const date = formatOfferDate(inputs['offer-date']);
  const itemRows = selected.map((item) => `<tr>
    <td>${escapeHtml(item.noPolisi || '—')}<small>${escapeHtml(item.noLamb ? `No Lamb ${item.noLamb}` : '')}</small></td>
    <td>${escapeHtml(item.brand || 'Branding')}<small>${escapeHtml([item.type, item.busType, item.startDate && item.endDate ? `${formatOfferDate(item.startDate)} - ${formatOfferDate(item.endDate)}` : ''].filter(Boolean).join(' · '))}</small></td>
    <td>${item.duration ? `${item.duration} Bulan` : '—'}</td>
    <td>${escapeHtml(formatOfferCurrency(item.basePrice))}<small>${escapeHtml(formatOfferCurrency(item.monthlyRevenue))} / bln</small></td>
    <td>${escapeHtml(formatOfferCurrency(item.ppn))}</td>
    <td>${escapeHtml(formatOfferCurrency(item.totalWithPpn))}</td>
  </tr>`).join('');
  const pages = [
    `<div class="offer-sheet offer-letter-sheet">
      <div class="offer-sheet-content">
        <div class="offer-document-meta"><p><b>Nomor:</b> ${escapeHtml(inputs['offer-number'])}</p><p><b>Lampiran:</b> ${escapeHtml(inputs['offer-attachment'])}</p><p><b>Perihal:</b> ${escapeHtml(subject)}</p></div>
        <div class="offer-recipient-preview"><p>Kepada Yth.</p><p>${escapeHtml(inputs['offer-recipient-title'] || '[Jabatan penerima]')}</p><p><b>${escapeHtml(company)}</b></p><p>${escapeHtml(inputs['offer-recipient'] || '[Nama penerima]')}</p><p>Di ${escapeHtml(inputs['offer-location'] || 'Tempat')}</p></div>
        <p>Dengan hormat,</p>
        <p>Sehubungan dengan komitmen PT Anindya Mitra Internasional dalam menghadirkan kolaborasi strategis bernilai tambah, kami mengajukan penawaran kerja sama branding armada Bus Trans Jogja kepada ${escapeHtml(company)} sebagai media promosi bergerak yang efektif dan berkelanjutan. Berikut kami sampaikan harga branding Bus Trans Jogja sebagai berikut:</p>
        ${formatPricingPreview()}
      </div>
    </div>`,
    `<div class="offer-sheet offer-letter-sheet">
      <div class="offer-sheet-content offer-letter-second-page">
        <h4>Data armada / branding yang ditawarkan</h4>
        <div class="offer-preview-table-wrap"><table class="offer-preview-table">
          <thead><tr><th>No Polisi / Lambung</th><th>Branding</th><th>Durasi</th><th>Harga Kontrak / Bulan</th><th>PPN</th><th>Total</th></tr></thead>
          <tbody>${itemRows || '<tr><td colspan="6">Pilih data Booking/Branding untuk mengisi tabel.</td></tr>'}</tbody>
        </table></div>
        <p><b>Referensi:</b> ${escapeHtml(inputs['offer-reference'] || '—')}</p>
        <h4>Dengan keterangan dan ketentuan sebagai berikut:</h4>
        <ol>${TERMS.map((term) => `<li>${escapeHtml(term)}</li>`).join('')}</ol>
        <p>Untuk informasi lebih lanjut mengenai ketersediaan armada serta tindak lanjut PKS maupun proses negosiasi, dapat menghubungi Danny Indra melalui nomor 0822-3329-0871.</p>
        <p>Demikian kami sampaikan surat ini. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.</p>
        <p class="offer-preview-date">${escapeHtml(date)}</p><p>PT Anindya Mitra Internasional</p>
        <div class="offer-signature-space"></div><p><b>Priyatno Bambang Hernowo</b><br>Direktur Utama</p>
      </div>
    </div>`,
    ...APPENDIX_PAGES.map((page) => `<div class="offer-sheet offer-appendix-sheet"><div class="offer-sheet-content">
      <p class="offer-appendix-label">LAMPIRAN</p><h4>${escapeHtml(page.title)}</h4>
      ${page.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      <div class="offer-appendix-images">${page.images.map((image) => `<img src="assets/surat-penawaran/${escapeHtml(image)}" alt="${escapeHtml(page.title)}" />`).join('')}</div>
    </div></div>`),
  ];
  container.innerHTML = pages.join('');
  const status = $('#offer-preview-status');
  if (status) status.textContent = `${selected.length} data terpilih · 7 halaman`;
}

function escapePdfText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ');
}

function addWrappedText(doc, text, x, y, width, options = {}) {
  const fontSize = options.fontSize || 9;
  const lineHeight = options.lineHeight || 4.2;
  doc.setFont(options.font || 'helvetica', options.style || 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(35, 45, 40);
  const lines = doc.splitTextToSize(escapePdfText(text), width);
  doc.text(lines, x, y, { lineHeightFactor: lineHeight / (fontSize * 0.352777778) });
  return y + (lines.length * lineHeight);
}

function addPageBackground(doc, asset) {
  doc.addImage(asset.data, 'PNG', 0, 0, 210, 297);
}

function currencyForPdf(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? 'Belum diatur'
    : `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value))}`;
}

function drawOfferRateTable(doc, startY, rows, ppnLabel) {
  const body = rows.map((row, index) => [
    String(index + 1),
    row.mediaBus,
    row.spaceIklan,
    ...row.prices.map((price) => currencyForPdf(price)),
  ]);
  doc.autoTable({
    startY,
    head: [
      [
        { content: 'NO', rowSpan: 2 },
        { content: 'MEDIA BUS', rowSpan: 2 },
        { content: 'SPACE IKLAN', rowSpan: 2 },
        { content: `HARGA EXCL ${ppnLabel}`, colSpan: 4 },
      ],
      ['1 BULAN', '3 BULAN', '6 BULAN', '12 BULAN'],
    ],
    body: body.length ? body : [['—', '—', 'Belum tersedia', '—', '—', '—', '—']],
    theme: 'grid',
    margin: { left: 25, right: 25 },
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 1.4, textColor: [35, 45, 40], overflow: 'linebreak' },
    headStyles: { fillColor: [14, 74, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 30 }, 2: { cellWidth: 27 }, 3: { cellWidth: 23.5 }, 4: { cellWidth: 23.5 }, 5: { cellWidth: 23.5 }, 6: { cellWidth: 23.5 } },
    rowPageBreak: 'avoid',
    tableWidth: 159,
  });
  return doc.lastAutoTable?.finalY || startY;
}

function drawOfferItemsTable(doc, startY, items) {
  doc.autoTable({
    startY,
    head: [['No Polisi / Lambung', 'Branding', 'Durasi', 'Harga Kontrak / Bulan', 'PPN', 'Total']],
    body: items.map((item) => [
      [item.noPolisi || '—', item.noLamb ? `No Lamb ${item.noLamb}` : ''].filter(Boolean).join('\n'),
      [item.brand || 'Branding', item.type, item.busType, item.startDate && item.endDate ? `${formatOfferDate(item.startDate)} - ${formatOfferDate(item.endDate)}` : ''].filter(Boolean).join('\n'),
      item.duration ? `${item.duration} bulan` : '—',
      [currencyForPdf(item.basePrice), `${currencyForPdf(item.monthlyRevenue)} / bulan`].join('\n'),
      currencyForPdf(item.ppn),
      currencyForPdf(item.totalWithPpn),
    ]),
    theme: 'grid',
    margin: { left: 25, right: 25 },
    styles: { font: 'helvetica', fontSize: 7.1, cellPadding: 1.3, textColor: [35, 45, 40], overflow: 'linebreak' },
    headStyles: { fillColor: [14, 74, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 32 }, 2: { cellWidth: 17 }, 3: { cellWidth: 27 }, 4: { cellWidth: 24 }, 5: { cellWidth: 29 } },
    rowPageBreak: 'avoid',
    tableWidth: 159,
  });
  return doc.lastAutoTable?.finalY || startY;
}

function addContainedImage(doc, asset, x, y, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / asset.width, maxHeight / asset.height);
  const width = asset.width * ratio;
  const height = asset.height * ratio;
  doc.addImage(asset.data, 'PNG', x + (maxWidth - width) / 2, y, width, height);
  return height;
}

export function renderOfferPdf(doc, input, selectedItems, pricingRows, assets) {
  if (!doc || typeof doc.autoTable !== 'function') throw new Error('Komponen PDF tabel tidak tersedia.');
  if (!assets?.['image1.png']) throw new Error('Kop surat resmi belum berhasil dimuat.');
  const background = assets['image1.png'];

  addPageBackground(doc, background);
  let y = 43;
  y = addWrappedText(doc, `Nomor: ${input['offer-number']}`, 25, y, 160, { fontSize: 9, lineHeight: 4.5 });
  y = addWrappedText(doc, `Lampiran: ${input['offer-attachment']}`, 25, y + 1, 160, { fontSize: 9, lineHeight: 4.5 });
  y = addWrappedText(doc, `Perihal: ${input['offer-subject']}`, 25, y + 1, 160, { fontSize: 9, lineHeight: 4.5, style: 'bold' }) + 4;
  y = addWrappedText(doc, 'Kepada Yth.', 25, y, 150, { fontSize: 9, lineHeight: 4.5 });
  y = addWrappedText(doc, input['offer-recipient-title'] || 'Branch Manager', 25, y, 150, { fontSize: 9, lineHeight: 4.5 });
  y = addWrappedText(doc, input['offer-company'], 25, y, 150, { fontSize: 9, lineHeight: 4.5, style: 'bold' });
  if (input['offer-recipient']) y = addWrappedText(doc, input['offer-recipient'], 25, y, 150, { fontSize: 9, lineHeight: 4.5 });
  y = addWrappedText(doc, `Di ${input['offer-location'] || 'Tempat'}`, 25, y, 150, { fontSize: 9, lineHeight: 4.5 }) + 3;
  y = addWrappedText(doc, 'Dengan hormat,', 25, y, 160, { fontSize: 9, lineHeight: 4.5 }) + 1;
  const intro = `Sehubungan dengan komitmen PT Anindya Mitra Internasional dalam menghadirkan kolaborasi strategis bernilai tambah, kami mengajukan penawaran kerja sama branding armada Bus Trans Jogja kepada ${input['offer-company']} sebagai media promosi bergerak yang efektif dan berkelanjutan, guna meningkatkan visibilitas merek. Berikut kami sampaikan harga branding Bus Trans Jogja sebagai berikut:`;
  y = addWrappedText(doc, intro, 25, y, 159, { fontSize: 8.5, lineHeight: 4.2 }) + 3;
  const ppn = typeof window.getBrandingPpnConfiguration === 'function' ? window.getBrandingPpnConfiguration() : null;
  const ppnLabel = ppn?.enabled === false ? 'PPN nonaktif' : `PPN ${Number(ppn?.percent ?? 11)}%`;
  y = addWrappedText(doc, `Harga Exclude ${ppnLabel}`, 25, y, 160, { fontSize: 8.5, lineHeight: 4.2, style: 'bold' }) + 1;
  const ratesEnd = drawOfferRateTable(doc, y, pricingRows, ppnLabel);
  if (doc.getNumberOfPages() !== 1 || ratesEnd > 260) {
    throw new Error('Pricelist tidak muat pada halaman surat template. Kurangi kategori media pada data terpilih atau tinjau konfigurasi Pricelist.');
  }

  doc.addPage('a4', 'portrait');
  addPageBackground(doc, background);
  y = 43;
  y = addWrappedText(doc, 'Data armada / branding yang ditawarkan', 25, y, 160, { fontSize: 9, lineHeight: 4.5, style: 'bold' }) + 2;
  y = drawOfferItemsTable(doc, y, selectedItems) + 4;
  if (doc.getNumberOfPages() !== 2 || y > 193) {
    throw new Error('Data terpilih terlalu panjang untuk halaman surat template. Kurangi jumlah armada atau buat penawaran terpisah.');
  }
  y = addWrappedText(doc, `Referensi: ${input['offer-reference'] || '—'}`, 25, y, 160, { fontSize: 8, lineHeight: 4.1 }) + 2;
  y = addWrappedText(doc, 'Dengan keterangan dan ketentuan sebagai berikut:', 25, y, 160, { fontSize: 8.3, lineHeight: 4.2, style: 'bold' }) + 1;
  TERMS.forEach((term, index) => {
    y = addWrappedText(doc, `${index + 1}. ${term}`, 27, y, 157, { fontSize: 7.6, lineHeight: 3.65 });
    if (y > 248) throw new Error('Ketentuan surat tidak muat pada halaman template. Ringkas perihal atau kurangi data terpilih.');
  });
  y += 1;
  y = addWrappedText(doc, 'Untuk informasi lebih lanjut mengenai ketersediaan armada serta tindak lanjut Perjanjian Kerja Sama (PKS) maupun proses negosiasi, dapat menghubungi Danny Indra melalui nomor 0822-3329-0871.', 25, y, 159, { fontSize: 7.6, lineHeight: 3.7 }) + 2;
  y = addWrappedText(doc, 'Demikian kami sampaikan surat ini. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.', 25, y, 159, { fontSize: 7.6, lineHeight: 3.7 }) + 4;
  if (y > 248) throw new Error('Isi surat tidak muat pada halaman template. Kurangi data terpilih.');
  doc.text(`Yogyakarta, ${formatOfferDate(input['offer-date'])}`, 125, y);
  y += 5;
  doc.text('PT Anindya Mitra Internasional', 125, y);
  y += 25;
  doc.setFont('helvetica', 'bold');
  doc.text('Priyatno Bambang Hernowo', 125, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Direktur Utama', 125, y + 4);
  if (doc.getNumberOfPages() !== 2) throw new Error('Isi surat melewati dua halaman utama template.');

  APPENDIX_PAGES.forEach((page) => {
    doc.addPage('a4', 'portrait');
    addPageBackground(doc, background);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(14, 74, 49);
    doc.text('LAMPIRAN', 25, 43);
    doc.setFontSize(12);
    doc.text(page.title, 25, 51);
    let appendixY = 60;
    page.paragraphs.forEach((paragraph) => {
      appendixY = addWrappedText(doc, paragraph, 25, appendixY, 159, { fontSize: 8.2, lineHeight: 4.1 }) + 2;
    });
    let imageY = Math.max(appendixY + 2, 100);
    const images = page.images.map((file) => assets[file]).filter(Boolean);
    if (images.length === 1) {
      addContainedImage(doc, images[0], 25, imageY, 160, Math.min(125, 265 - imageY));
    } else if (images.length > 1) {
      images.forEach((asset, index) => {
        const imageWidth = index === 0 ? 160 : 62;
        const imageHeight = index === 0 ? 60 : 45;
        const x = index === 0 ? 25 : 25 + ((index - 1) * 78);
        const yImage = index === 0 ? imageY : imageY + 64;
        addContainedImage(doc, asset, x, yImage, imageWidth, imageHeight);
      });
    }
    if (doc.getNumberOfPages() > 7) throw new Error('Lampiran melewati tujuh halaman A4.');
  });
  if (doc.getNumberOfPages() !== 7) throw new Error('PDF tidak sesuai template tujuh halaman A4.');
  return doc;
}

async function loadAsset(filename) {
  const url = new URL(`./assets/surat-penawaran/${filename}`, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Aset dokumen tidak dapat dimuat: ${filename}`);
  const blob = await response.blob();
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Aset dokumen gagal dibaca: ${filename}`));
    reader.readAsDataURL(blob);
  });
  const image = new Image();
  image.src = data;
  await image.decode();
  return { data, width: image.naturalWidth, height: image.naturalHeight };
}

async function loadAssets() {
  const names = new Set(['image1.png', ...APPENDIX_PAGES.flatMap((page) => page.images)]);
  const loaded = await Promise.all([...names].map(async (name) => [name, await loadAsset(name)]));
  return Object.fromEntries(loaded);
}

function getSelectedData() {
  return selectedRecords().map((entry) => ({ record: entry.record, data: getOfferRecord(entry.record) }));
}

function validateForExport(input, selected) {
  const missing = [];
  if (!input['offer-number'].trim()) missing.push('nomor surat');
  if (!input['offer-subject'].trim()) missing.push('perihal');
  if (!input['offer-date']) missing.push('tanggal surat');
  if (!input['offer-company'].trim()) missing.push('perusahaan/instansi');
  if (!selected.length) missing.push('minimal satu data Booking/Branding');
  const invalidPricing = selected.find(({ data }) => data.pricingReason || !Number.isInteger(data.duration) || data.duration < 1);
  if (invalidPricing) {
    throw new Error(`Harga atau durasi data ${invalidPricing.data.noPolisi || 'terpilih'} belum valid: ${invalidPricing.data.pricingReason || 'durasi kontrak tidak valid.'}`);
  }
  const selectedCompanies = [...new Set(selected.map(({ data }) => data.company.toLocaleLowerCase('id')).filter(Boolean))];
  if (selectedCompanies.length > 1 || (selectedCompanies.length === 1 && input['offer-company'].trim().toLocaleLowerCase('id') !== selectedCompanies[0])) {
    throw new Error('Perusahaan pada informasi surat harus sama dengan perusahaan pada seluruh data yang dipilih.');
  }
  if (missing.length) throw new Error(`Lengkapi ${missing.join(', ')} sebelum mengunduh PDF.`);
}

function bindEvents() {
  $('#offer-source').addEventListener('change', (event) => {
    state.source = event.target.value;
    renderSourceRecords();
  });
  $('#offer-search').addEventListener('input', renderSourceRecords);
  $('#offer-record-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-offer-record-key]');
    if (!button || !state.creating) return;
    const key = button.dataset.offerRecordKey;
    if (state.selected.has(key)) {
      state.selected.delete(key);
    } else {
      const recordId = key.slice(key.indexOf(':') + 1);
      const record = eligibleOfferRecords(state.records, state.source)
        .find((candidate) => getField(candidate, 'id', 'ID Branding', 'noPolisi', 'No Polisi') === recordId);
      if (!record) return;
      const existingRecords = selectedRecords().map((entry) => entry.record);
      if (!canCombineOfferRecords(existingRecords, record)) {
        setMessage('Satu surat hanya dapat memuat data dari satu perusahaan. Hapus pilihan perusahaan lain terlebih dahulu.', 'error');
        return;
      }
      state.selected.set(key, { key, record, source: state.source });
      updateAutofilledLetterFields();
    }
    renderSourceRecords();
    renderSelectedRecords();
    renderPreview();
  });
  $('#offer-selected-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-offer-remove]');
    if (!button || !state.creating) return;
    const entry = selectedRecords()[Number(button.dataset.offerRemove)];
    if (!entry) return;
    state.selected.delete(entry.key);
    updateAutofilledLetterFields();
    renderSourceRecords();
    renderSelectedRecords();
    renderPreview();
  });
  FORM_FIELDS.forEach((id) => {
    const input = $(`#${id}`);
    input.addEventListener('input', () => {
      if (id === 'offer-company' || id === 'offer-reference') input.dataset.autofilled = 'false';
      if (id === 'offer-subject') input.dataset.userEdited = 'true';
      renderPreview();
    });
  });
  $('#offer-preview').addEventListener('click', renderPreview);
  $('#offer-pdf').addEventListener('click', async () => {
    const button = $('#offer-pdf');
    if (!state.creating) return;
    button.disabled = true;
    setMessage('Membuat dokumen PDF A4...', 'info');
    try {
      const input = getInputValues();
      const selected = getSelectedData();
      validateForExport(input, selected);
      if (!window.jspdf?.jsPDF) throw new Error('Library PDF belum tersedia. Muat ulang aplikasi lalu coba lagi.');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      renderOfferPdf(doc, input, selected.map((item) => item.data), getCurrentPricingRows(), state.assets);
      const filename = `surat-penawaran-${(input['offer-company'] || 'trans-jogja').toLocaleLowerCase('id').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;
      doc.save(filename);
      setMessage('PDF tujuh halaman A4 berhasil dibuat. Data Booking/Branding tidak diubah.', 'success');
    } catch (error) {
      console.error('Gagal membuat Surat Penawaran:', error);
      setMessage(error.message || 'PDF gagal dibuat. Periksa data surat dan coba lagi.', 'error');
    } finally {
      button.disabled = !state.creating || !Object.keys(state.assets).length;
    }
  });
}

export async function initialiseSuratPenawaranFeatures() {
  if (initialized) return;
  initialized = true;
  const dateInput = $('#offer-date');
  const today = new Date();
  dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  state.creating = typeof window.can !== 'function' || window.can('surat.create');
  if (!state.creating) {
    $('#offer-form').querySelectorAll('input,select,button').forEach((control) => { control.disabled = true; });
    setMessage('Akun Anda hanya memiliki izin melihat. Izin surat.create diperlukan untuk menyusun dan mengunduh surat.', 'info');
  }
  bindEvents();
  const data = window.__brandingDashboardData || {};
  state.records = Array.isArray(data.brandings) ? data.brandings : [];
  renderSourceRecords();
  renderSelectedRecords();
  renderPreview();
  window.addEventListener('branding-dashboard-data-ready', (event) => {
    state.records = Array.isArray(event.detail?.brandings) ? event.detail.brandings : [];
    renderSourceRecords();
  });
  window.addEventListener('branding-pricing-updated', renderPreview);
  setMessage('Memuat aset template A4...', 'info');
  loadAssets().then((assets) => {
    state.assets = assets;
    $('#offer-pdf').disabled = !state.creating;
    setMessage('');
    renderPreview();
  }).catch((error) => {
    console.error('Gagal memuat aset Surat Penawaran:', error);
    setMessage(error.message || 'Aset template Surat Penawaran gagal dimuat.', 'error');
  });
}
