const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function dateParts(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return dateParts(value.toDate());
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return { year: value.getFullYear(), month: value.getMonth() + 1 };
    }
    if (typeof value.seconds === 'number') return dateParts(new Date(value.seconds * 1000));
  }

  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
  if (match) {
    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? { year, month }
      : null;
  }
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? { year, month }
      : null;
  }
  match = text.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (match) {
    const month = MONTH_NAMES.findIndex((name) => name.toLowerCase() === match[2].toLowerCase()) + 1;
    const year = Number(match[3]);
    return month ? { year, month } : null;
  }
  return null;
}

export function brandingPeriod(branding) {
  const parts = dateParts(branding.tanggalMulai || branding['Tanggal Mulai']);
  if (!parts) return { key: 'undated', year: null, month: null, label: 'Tanggal awal belum tersedia' };
  return {
    key: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
    year: parts.year,
    month: parts.month,
    label: `${MONTH_NAMES[parts.month - 1]} ${parts.year}`,
  };
}

export function groupAdminPeriods(groups) {
  const yearMap = new Map();
  const undated = [];
  groups.forEach((group) => {
    if (!group.period || group.period.year === null) {
      undated.push(group);
      return;
    }
    if (!yearMap.has(group.period.year)) yearMap.set(group.period.year, new Map());
    const months = yearMap.get(group.period.year);
    if (!months.has(group.period.key)) {
      months.set(group.period.key, {
        ...group.period,
        groups: [],
      });
    }
    months.get(group.period.key).groups.push(group);
  });

  const years = [...yearMap.entries()]
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, monthMap]) => ({
      year,
      months: [...monthMap.values()]
        .sort((monthA, monthB) => monthA.month - monthB.month),
    }));
  return { years, undated };
}

export function filterAdminPeriodGroups(groups, search) {
  const query = String(search || '').trim().toLocaleLowerCase('id');
  if (!query) return groups;
  return groups.filter((group) => `${group.namaBrand || ''} ${group.namaPT || ''} ${[...(group.busSet || [])].join(' ')}`
    .toLocaleLowerCase('id')
    .includes(query));
}
