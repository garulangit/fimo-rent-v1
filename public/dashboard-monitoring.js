function dateKeyParts(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month, day };
}

function toDayNumber(parts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

export function daysUntil(dateIso, now = new Date()) {
  const date = dateKeyParts(dateIso);
  if (!date) return null;
  const today = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
  return toDayNumber(date) - toDayNumber(today);
}

export function overlapsMonth(startIso, endIso, year, monthIndex) {
  const start = dateKeyParts(startIso);
  const end = dateKeyParts(endIso);
  if (!start || !end || toDayNumber(end) < toDayNumber(start)) return false;
  const monthStart = { year, month: monthIndex + 1, day: 1 };
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const monthEnd = {
    year: nextMonth.getFullYear(),
    month: nextMonth.getMonth() + 1,
    day: 0,
  };
  return toDayNumber(start) <= toDayNumber(monthEnd)
    && toDayNumber(end) >= toDayNumber(monthStart);
}

export function expirationBucket(daysRemaining) {
  if (!Number.isInteger(daysRemaining)) return '';
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 7) return 'seven';
  if (daysRemaining <= 30) return 'thirty';
  return '';
}

export function filterCalendarRecords(records, filters) {
  return records.filter((item) => (!filters.companies.size || filters.companies.has(item.company))
    && (!filters.type || filters.type === item.type)
    && (!filters.bus || filters.bus === item.noPolisi));
}

export function groupCalendarRecordsByCompanyAndBus(records) {
  const companies = new Map();
  records.forEach((item) => {
    if (!companies.has(item.company)) companies.set(item.company, new Map());
    const companyBuses = companies.get(item.company);
    const busKey = item.noPolisi || `__missing__${item.branding.id}`;
    if (!companyBuses.has(busKey)) {
      companyBuses.set(busKey, {
        noPolisi: item.noPolisi,
        noLamb: item.noLamb || '—',
        records: [],
      });
    }
    companyBuses.get(busKey).records.push(item);
  });
  return companies;
}

export function assignCalendarLanes(records) {
  const laneEnds = [];
  return records.map((record) => {
    const lane = laneEnds.findIndex((laneEnd) => laneEnd < record.startDay);
    const laneIndex = lane === -1 ? laneEnds.length : lane;
    laneEnds[laneIndex] = record.endDay;
    return { ...record, laneIndex };
  });
}

export function calendarPreviewLanes(records, maxLanes = 2) {
  const sorted = [...records].sort((a, b) => a.startDay - b.startDay || a.endDay - b.endDay);
  const assigned = assignCalendarLanes(sorted);
  const visible = assigned.filter((record) => record.laneIndex < maxLanes);
  return { visible, more: assigned.length - visible.length };
}
