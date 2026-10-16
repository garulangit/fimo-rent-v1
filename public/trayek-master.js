export const TRAYEK_MASTER = Object.freeze([
  Object.freeze({ code: '1A', name: 'Malioboro - Prambaman' }),
  Object.freeze({ code: '1B', name: 'Bandara Adi Sucipto - Taman Pintar' }),
  Object.freeze({ code: '2A', name: 'Terminal Condongcatur - XT Square via Malioboro' }),
  Object.freeze({ code: '2B', name: 'Terminal Condongcatur - XT Square' }),
  Object.freeze({ code: '3A', name: 'Bandara Adi Sucipto - Terminal Ngabean' }),
  Object.freeze({ code: '3B', name: 'Terminal Giwangan - Terminal Condongcatur' }),
  Object.freeze({ code: '4A', name: 'Terminal Giwangan - Condongcatur via UGM' }),
  Object.freeze({ code: '4B', name: 'Condongcatur - Terminal Giwangan via UGM' }),
  Object.freeze({ code: '5A', name: 'Terminal Jombor - Janti' }),
  Object.freeze({ code: '5B', name: 'Terminal Jombor -Bandara Adi Sucipto' }),
  Object.freeze({ code: '6', name: 'Gamping - Malioboro' }),
  Object.freeze({ code: '8', name: 'Terminal Jombor - Terminal Ngabean' }),
  Object.freeze({ code: '9', name: 'Terminal Jombor - Terminal Giwangan' }),
  Object.freeze({ code: '10', name: 'Gamping - Kusumanegara' }),
  Object.freeze({ code: '11', name: 'Terminal Giwangan - RS Panti Rapih' }),
  Object.freeze({ code: '12', name: 'Condongcatur - Pakem' }),
  Object.freeze({ code: '13', name: 'TGP Stadion Godean - Malioboro' }),
  Object.freeze({ code: '14', name: 'Bandara Adi Sucipto - Terminal Pakem' }),
  Object.freeze({ code: '15', name: 'Terminal Palbapang - Malioboro' }),
  Object.freeze({ code: 'L-1', name: 'Terminal Jombor - Malioboro' }),
  Object.freeze({ code: 'CAD AMI', name: 'Bus Cadangan PT AMI' }),
  Object.freeze({ code: 'CAD JTT', name: 'Bus Cadangan PT JTT' }),
]);

export function findTrayek(code) {
  const normalized = String(code || '').trim().toLocaleUpperCase('id');
  return TRAYEK_MASTER.find((trayek) => trayek.code.toLocaleUpperCase('id') === normalized) || null;
}

export function busTrayekCode(bus = {}) {
  if (String(bus.kodeTrayek || '').trim()) return findTrayek(bus.kodeTrayek)?.code || '';
  if (String(bus.trayekCode || '').trim()) return findTrayek(bus.trayekCode)?.code || '';
  const jalurCode = bus.jalurBus || bus['Jalur Bus'] || bus.jalur || bus.JALUR;
  return findTrayek(jalurCode)?.code || '';
}

export function busTrayek(bus = {}) {
  return findTrayek(busTrayekCode(bus));
}

export function trayekLabel(code) {
  const trayek = findTrayek(code);
  return trayek ? `${trayek.code} — ${trayek.name}` : '';
}
