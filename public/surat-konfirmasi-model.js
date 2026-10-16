import { busTrayek, busTrayekCode } from './trayek-master.js';

const PPN_PERCENT = 11;
const PPN_BASIS_POINTS = 1100;

export function confirmationField(record, ...keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function confirmationRecordId(record, index = 0) {
  if (record?.id) return String(record.id);
  const plate = String(record?.noPolisi || record?.['No Polisi'] || '').trim();
  const noLamb = String(record?.noLamb || record?.['No Lamb'] || '').trim();
  return `${plate || noLamb || 'confirmation-record'}-${index}`;
}

export function eligibleConfirmationRecords(records = [], source = 'Booking') {
  return records.filter((record) => {
    const status = confirmationField(record, 'status', 'Status').toLocaleUpperCase('id');
    if (source === 'Booking') return status === 'BOOKING';
    if (source === 'Branding') return ['PROSES', 'BERJALAN', 'SELESAI'].includes(status);
    return false;
  });
}

export function confirmationCompanies(records = []) {
  return [...new Set(records
    .map((record) => confirmationField(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT'))
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'id'));
}

export function confirmationRecordLabel(record) {
  const noLamb = confirmationField(record, 'noLamb', 'No Lamb', 'no_lamb') || 'No Lamb —';
  const noPolisi = confirmationField(record, 'noPolisi', 'No Polisi', 'no_polisi') || 'No Polisi —';
  const brand = confirmationField(record, 'namaBrand', 'Nama Brand', 'brand') || 'Brand tanpa nama';
  return `${noLamb} · ${noPolisi} — ${brand}`;
}

function normalizedPlate(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLocaleUpperCase('id');
}

export function findConfirmationMasterBus(record, buses = []) {
  const plate = normalizedPlate(confirmationField(record, 'noPolisi', 'No Polisi', 'no_polisi'));
  if (plate) {
    const exact = buses.find((bus) => normalizedPlate(confirmationField(bus, 'noPolisi', 'No Polisi', 'no_polisi')) === plate);
    if (exact) return exact;
  }
  const noLamb = confirmationField(record, 'noLamb', 'No Lamb', 'no_lamb');
  if (!noLamb) return null;
  const matches = buses.filter((bus) => confirmationField(bus, 'noLamb', 'No Lamb', 'no_lamb') === noLamb);
  return matches.length === 1 ? matches[0] : null;
}

export function mapConfirmationRecord(record, buses = [], helpers = {}, index = 0) {
  const masterBus = findConfirmationMasterBus(record, buses);
  const financialContext = typeof helpers.getPricingContext === 'function'
    ? helpers.getPricingContext(record)
    : {};
  const duration = Number(typeof helpers.getDuration === 'function'
    ? helpers.getDuration(record, financialContext)
    : financialContext.duration);
  const mediaBus = String(financialContext.mediaBus || '');
  const space = String(financialContext.space || '');
  let priceResult = { reason: 'Jenis media, space, atau durasi belum tersedia.' };
  if (mediaBus && space && Number.isInteger(duration) && duration > 0 && typeof helpers.getPrice === 'function') {
    priceResult = helpers.getPrice(mediaBus, space, duration) || priceResult;
  }
  const rawPrice = priceResult.price;
  const basePrice = Number(rawPrice);
  const hasPrice = rawPrice !== undefined && rawPrice !== null && rawPrice !== ''
    && !priceResult.reason && Number.isFinite(basePrice) && basePrice >= 0;
  const trayek = busTrayek(masterBus || {});
  return {
    id: confirmationRecordId(record, index),
    sourceRecord: record,
    namaPT: confirmationField(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT'),
    namaBrand: confirmationField(record, 'namaBrand', 'Nama Brand', 'brand'),
    noPolisi: confirmationField(record, 'noPolisi', 'No Polisi', 'no_polisi'),
    noLamb: confirmationField(record, 'noLamb', 'No Lamb', 'no_lamb'),
    jalur: confirmationField(masterBus, 'jalurBus', 'Jalur Bus', 'jalur', 'JALUR')
      || confirmationField(record, 'jalurBus', 'Jalur Bus', 'jalur', 'JALUR')
      || busTrayekCode(masterBus || {}),
    trayek: trayek?.name || 'Kode trayek belum tersedia',
    tipeBus: confirmationField(masterBus, 'tipeBus', 'Tipe Bus', 'type')
      || confirmationField(record, 'tipeBus', 'Tipe Bus', 'type'),
    mediaBus,
    space,
    duration: Number.isInteger(duration) && duration > 0 ? duration : null,
    basePrice: hasPrice ? basePrice : null,
    basePriceCents: hasPrice && Number.isSafeInteger(Math.round(basePrice * 100)) ? Math.round(basePrice * 100) : null,
    pricingError: hasPrice && Number.isSafeInteger(Math.round(basePrice * 100))
      ? ''
      : String(priceResult.reason || 'Harga tidak tersedia atau melampaui batas perhitungan aman.'),
  };
}

export function calculateConfirmationQuote(items = []) {
  const errors = items.filter((item) => item.basePriceCents === null || !Number.isSafeInteger(item.basePriceCents))
    .map((item) => `${item.noPolisi || item.namaBrand || item.id}: ${item.pricingError || 'Harga tidak valid.'}`);
  const grouped = new Map();
  for (const item of items) {
    if (item.basePriceCents === null || !Number.isSafeInteger(item.basePriceCents)) continue;
    const key = [
      item.mediaBus.toLocaleLowerCase('id'),
      item.space.toLocaleLowerCase('id'),
      item.duration,
      item.basePriceCents,
    ].join('\u0000');
    const existing = grouped.get(key);
    if (existing) existing.quantity += 1;
    else grouped.set(key, { ...item, quantity: 1 });
  }
  const rows = [...grouped.values()].map((row) => ({
    ...row,
    totalCents: row.basePriceCents * row.quantity,
  })).filter((row) => {
    if (Number.isSafeInteger(row.totalCents)) return true;
    errors.push(`${row.noPolisi || row.namaBrand || row.id}: Jumlah harga melampaui batas perhitungan aman.`);
    return false;
  });
  const baseTotalCents = rows.reduce((total, row) => total + row.totalCents, 0);
  if (!Number.isSafeInteger(baseTotalCents)) {
    errors.push('Nominal dasar melampaui batas perhitungan aman.');
    return { rows, errors, ppnPercent: PPN_PERCENT, baseTotalCents: null, ppnCents: null, grandTotalCents: null };
  }
  const ppnCents = Number((BigInt(baseTotalCents) * BigInt(PPN_BASIS_POINTS) + 5000n) / 10000n);
  if (!Number.isSafeInteger(ppnCents) || !Number.isSafeInteger(baseTotalCents + ppnCents)) {
    errors.push('Nominal total melampaui batas perhitungan aman.');
  }
  return {
    rows,
    errors,
    ppnPercent: PPN_PERCENT,
    baseTotalCents,
    ppnCents,
    grandTotalCents: baseTotalCents + ppnCents,
  };
}

function integerToIndonesianWords(value) {
  const number = Math.floor(value);
  if (number === 0) return 'nol';
  if (number < 0) return `minus ${integerToIndonesianWords(-number)}`;
  if (number < 12) return [
    'nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh',
    'delapan', 'sembilan', 'sepuluh', 'sebelas',
  ][number];
  if (number < 20) return `${integerToIndonesianWords(number - 10)} belas`;
  if (number < 100) return `${integerToIndonesianWords(Math.floor(number / 10))} puluh${number % 10 ? ` ${integerToIndonesianWords(number % 10)}` : ''}`;
  if (number < 200) return `seratus${number % 100 ? ` ${integerToIndonesianWords(number % 100)}` : ''}`;
  if (number < 1000) return `${integerToIndonesianWords(Math.floor(number / 100))} ratus${number % 100 ? ` ${integerToIndonesianWords(number % 100)}` : ''}`;

  const groups = [
    [1_000_000_000_000, 'triliun'],
    [1_000_000_000, 'miliar'],
    [1_000_000, 'juta'],
    [1_000, 'ribu'],
  ];
  for (const [unit, label] of groups) {
    if (number >= unit) {
      const count = Math.floor(number / unit);
      const words = unit === 1000 && count === 1 ? 'seribu' : `${integerToIndonesianWords(count)} ${label}`;
      return `${words}${number % unit ? ` ${integerToIndonesianWords(number % unit)}` : ''}`;
    }
  }
  throw new RangeError('Nominal terbilang melebihi batas yang didukung.');
}

export function confirmationTerbilang(totalCents) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new RangeError('Total untuk terbilang harus berupa nominal non-negatif yang valid.');
  }
  const rupiah = Math.floor(totalCents / 100);
  const sen = totalCents % 100;
  const words = integerToIndonesianWords(rupiah);
  return `${words} rupiah${sen ? ` ${integerToIndonesianWords(sen)} sen` : ''}`
    .split(' ')
    .map((word) => word.replace(/^./, (first) => first.toLocaleUpperCase('id')))
    .join(' ');
}

export function formatConfirmationCurrency(cents) {
  if (!Number.isSafeInteger(cents)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
