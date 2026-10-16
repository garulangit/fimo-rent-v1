export const OFFER_DURATIONS = Object.freeze([1, 3, 6, 12]);
export const OFFER_SPACES = Object.freeze(['Left Body', 'Right Body', 'Back Body', 'Full Body']);

const valueFrom = (record, ...keys) => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
};

export function eligibleOfferRecords(records, source) {
  return (Array.isArray(records) ? records : []).filter((record) => {
    const status = valueFrom(record, 'status', 'Status').toLocaleUpperCase('id');
    return source === 'Booking'
      ? status === 'BOOKING'
      : ['PROSES', 'BERJALAN', 'SELESAI'].includes(status);
  });
}

export function offerRecordLabel(record) {
  const company = valueFrom(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT');
  const brand = valueFrom(record, 'namaBrand', 'Nama Brand', 'brand');
  const bus = valueFrom(record, 'noPolisi', 'No Polisi', 'no_polisi');
  const fleet = valueFrom(record, 'noLamb', 'No Lamb', 'no_lamb');
  return [company, brand, bus, fleet, record?.id, valueFrom(record, 'referensi', 'pks', 'keterangan', 'Keterangan')]
    .filter(Boolean).join(' ').toLocaleLowerCase('id');
}

export function buildOfferPricingRows(catalog, getPriceForTier, mediaCategories = []) {
  const configuredCategories = [...new Set((Array.isArray(catalog) ? catalog : [])
    .map((entry) => String(entry?.mediaBus || '').trim())
    .filter(Boolean))];
  const selectedCategories = [...new Set((Array.isArray(mediaCategories) ? mediaCategories : [])
    .map((category) => String(category || '').trim())
    .filter(Boolean))];
  const categories = selectedCategories.length ? selectedCategories : configuredCategories.slice(0, 1);
  return categories.flatMap((mediaBus) => OFFER_SPACES.map((spaceIklan) => ({
    mediaBus,
    spaceIklan,
    prices: OFFER_DURATIONS.map((duration) => {
      const result = getPriceForTier(mediaBus, spaceIklan, duration);
      return result && !result.reason && Number.isFinite(Number(result.price))
        ? Number(result.price)
        : null;
    }),
  })));
}

export function canCombineOfferRecords(existing, candidate) {
  const companies = [...(Array.isArray(existing) ? existing : []), candidate]
    .map((record) => valueFrom(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT').toLocaleLowerCase('id'))
    .filter(Boolean);
  return new Set(companies).size <= 1;
}

export function getOfferRecordData(record, financials = {}) {
  const start = valueFrom(record, 'tanggalMulai', 'Tanggal Mulai');
  const end = valueFrom(record, 'tanggalSelesai', 'Tanggal Selesai', 'Akhir Penayangan', 'tanggalAkhir', 'Tanggal Akhir');
  return {
    id: valueFrom(record, 'id', 'ID Branding', 'noPolisi', 'No Polisi'),
    company: valueFrom(record, 'namaPT', 'Nama PT', 'ptName', 'nama_pt', 'PT'),
    brand: valueFrom(record, 'namaBrand', 'Nama Brand', 'brand'),
    noPolisi: valueFrom(record, 'noPolisi', 'No Polisi', 'no_polisi'),
    noLamb: valueFrom(record, 'noLamb', 'No Lamb', 'no_lamb'),
    mediaBus: String(financials.mediaBus || valueFrom(record, 'mediaBus', 'Media Bus') || ''),
    busType: valueFrom(record, 'tipeBus', 'Tipe Bus'),
    type: valueFrom(record, 'jenisBranding', 'Jenis Branding', 'jenis_branding', 'type'),
    duration: Number(financials.duration) || null,
    startDate: start,
    endDate: end,
    reference: valueFrom(record, 'referensi', 'pks', 'keterangan', 'Keterangan'),
    basePrice: financials.basePrice !== null && financials.basePrice !== undefined && financials.basePrice !== ''
      && Number.isFinite(Number(financials.basePrice)) ? Number(financials.basePrice) : null,
    ppn: financials.ppn !== null && financials.ppn !== undefined && financials.ppn !== ''
      && Number.isFinite(Number(financials.ppn)) ? Number(financials.ppn) : null,
    totalWithPpn: financials.totalWithPpn !== null && financials.totalWithPpn !== undefined && financials.totalWithPpn !== ''
      && Number.isFinite(Number(financials.totalWithPpn)) ? Number(financials.totalWithPpn) : null,
    monthlyRevenue: financials.monthlyRevenue !== null && financials.monthlyRevenue !== undefined && financials.monthlyRevenue !== ''
      && Number.isFinite(Number(financials.monthlyRevenue)) ? Number(financials.monthlyRevenue) : null,
    pricingReason: String(financials.reason || ''),
  };
}

export function formatOfferCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Belum diatur';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatOfferDate(value) {
  if (!value) return '—';
  if (typeof value.toDate === 'function') return formatOfferDate(value.toDate());
  if (typeof value === 'object' && !(value instanceof Date) && Number.isFinite(value.seconds)) {
    return formatOfferDate(new Date(value.seconds * 1000));
  }
  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    const text = String(value).trim();
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    date = dmy
      ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
      : new Date(`${text.slice(0, 10)}T00:00:00`);
  }
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
