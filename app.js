'use strict';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_TYPES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

let curYear, curMonth, monthData;
let originalDayData = null; // Para la función "Descartar"
let activeDs = null;
let colombiaHolidays = new Map();
let holidaysYear = -1;

function getEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function nextMonday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + (8 - d.getDay()) % 7);
  return d;
}

function getColombiaHolidays(year) {
  const h = new Set();
  const key = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const fixed = (m, d) => h.add(`${year}-${m}-${d}`);
  const puente = (m, d) => h.add(key(nextMonday(new Date(year, m, d))));
  const easterDelta = (easter, offset) => { const d = new Date(easter); d.setDate(d.getDate() + offset); h.add(key(d)); };
  const easterPuente = (easter, offset) => { const d = new Date(easter); d.setDate(d.getDate() + offset); h.add(key(nextMonday(d))); };

  fixed(0, 1); puente(0, 6); puente(2, 19); fixed(4, 1);
  puente(5, 29); fixed(6, 20); fixed(7, 7); puente(7, 15);
  puente(9, 12); puente(10, 1); puente(10, 11);
  fixed(11, 8); fixed(11, 25);

  const easter = getEaster(year);
  easterDelta(easter, -3); easterDelta(easter, -2);
  easterPuente(easter, 39); easterPuente(easter, 60); easterPuente(easter, 68);

  return h;
}

function storageKey(y, m) { return `r07_${y}-${String(m + 1).padStart(2, '0')}`; }

function loadMonth(y, m) {
  const raw = localStorage.getItem(storageKey(y, m));
  return raw ? JSON.parse(raw) : {};
}

function saveMonth() { localStorage.setItem(storageKey(curYear, curMonth), JSON.stringify(monthData)); }

function setField(ds, field, value) {
  if (!monthData[ds]) monthData[ds] = {};
  monthData[ds][field] = value;
  saveMonth();
  renderCalendar();

  const indicator = document.getElementById('save-indicator');
  indicator.classList.add('show');
  setTimeout(() => indicator.classList.remove('show'), 1500);
}

function renderCalendar() {
  document.getElementById('month-title').innerHTML = `R07 ${MONTHS[curMonth]} <span class="title-year">${curYear}</span>`;
  document.getElementById('print-month-title').innerHTML = `R07 ${MONTHS[curMonth]} <span class="print-year">${curYear}</span>`;

  if (curYear !== holidaysYear) {
    colombiaHolidays = getColombiaHolidays(curYear);
    holidaysYear = curYear;
  }

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const firstDow = new Date(curYear, curMonth, 1).getDay();
  const totalDays = new Date(curYear, curMonth + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell no-mobile-head';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= totalDays; d++) {
    const ds = `${curYear}-${curMonth}-${d}`;
    const dow = new Date(curYear, curMonth, d).getDay();
    grid.appendChild(buildDayCell(d, dow, ds));
  }
}

function buildDayCell(d, dow, ds) {
  const cell = document.createElement('div');
  const isHoliday = colombiaHolidays.has(ds);
  const isWeekend = dow === 0 || dow === 6;
  let classes = 'day-cell';
  if (isHoliday) classes += ' holiday';
  else if (isWeekend) classes += ' weekend';
  cell.className = classes;

  const data = monthData[ds] || {};
  const hasData = !!(data.prayerMinutes || data.bibleReading || data.prayerAttendance || data.cultoTime || data.cultoAttendance || data.prayerFrom || data.prayerTo || data.virtualReason);
  let resumen = buildSummaryText(dow, data);

  cell.innerHTML = `
    <div class="day-num">${d}${isHoliday ? '<span class="festivo-tag">Festivo</span>' : ''}</div>
    <div class="day-data${hasData ? ' has-data' : ''}">${resumen}</div>
  `;
  cell.onclick = () => openModal(d, dow, ds);
  return cell;
}

function buildSummaryText(dow, d) {
  // Valor relleno o línea en blanco
  const v = (val, wide) => val
    ? `<b>${val}</b>`
    : `<span class="blank${wide ? ' wide' : ''}"></span>`;

  // Casilla de verificación: X si está seleccionado, línea si no
  const bc = (field, val) => d[field] === val
    ? '<b>X</b>'
    : '<span class="blank"></span>';

  // Radio para selección de hora
  const radios = (field, opts) =>
    `<span class="radio-row">${opts.map(([stored, label]) => {
      const sel = d[field] === stored;
      return `<span class="radio-opt${sel ? ' sel' : ''}"><span class="rdot">${sel ? '●' : '○'}</span>${label}</span>`;
    }).join('')}</span>`;

  const lines = [];

  // Lun, Mié, Vie, Sáb, Dom — oración personal
  if ([0, 1, 3, 5, 6].includes(dow)) {
    lines.push(`Hoy oré ${v(d.prayerMinutes)} min. <br> Y leí ${v(d.bibleReading, true)} en la Biblia`);
  }

  // Mar y Jue — oración grupal
  if (dow === 2 || dow === 4) {
    lines.push(`Hoy me conecté ${bc('prayerAttendance', 'connected')} asistí ${bc('prayerAttendance', 'attended')} a la oración de ${v(d.prayerFrom)} a ${v(d.prayerTo)}`);
    lines.push(`Y leí ${v(d.bibleReading, true)} en la Biblia`);
  }

  // Mié — culto
  if (dow === 3) {
    lines.push(`Hoy me conecté ${bc('cultoAttendance', 'connected')} asistí ${bc('cultoAttendance', 'attended')} al culto de las:`);
    lines.push(radios('cultoTime', [['5:00 PM', '5PM'], ['7:00 PM', '7PM']]));
  }

  // Sáb — culto
  if (dow === 6) {
    lines.push(`Hoy asistí al culto de las:`);
    lines.push(radios('cultoTime', [['1:00 PM', '1PM'], ['3:00 PM', '3PM'], ['5:00 PM', '5PM'], ['7:00 PM', '7PM']]));
    lines.push(`¿Por qué me conecté virtual? ${v(d.virtualReason, true)}`);
  }

  // Dom — culto
  if (dow === 0) {
    lines.push(`Hoy asistí al culto de las:`);
    lines.push(radios('cultoTime', [['7:30 AM', '7:30'], ['9:30 AM', '9:30'], ['11:30 AM', '11:30'], ['1:30 PM', '1:30']]));
    lines.push(`¿Por qué me conecté virtual? ${v(d.virtualReason, true)}`);
  }

  return lines.map(l => `<div class="day-line">${l}</div>`).join('');
}

function openModal(d, dow, ds) {
  activeDs = ds;
  // Respaldar datos actuales por si decide descartar
  originalDayData = monthData[ds] ? JSON.parse(JSON.stringify(monthData[ds])) : null;

  document.getElementById('modal-title').textContent = `${DAY_NAMES[dow]}, ${d} de ${MONTHS[curMonth]}`;
  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  const data = monthData[ds] || {};

  function addInput(label, field, placeholder, inputType = 'text') {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `<label class="field-label">${label}</label>
                     <input type="${inputType}" placeholder="${placeholder}" value="${data[field] || ''}" oninput="setField('${ds}', '${field}', this.value)">`;
    body.appendChild(div);
  }

  function addRadio(label, field, options) {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `<label class="field-label">${label}</label><div class="radio-group"></div>`;
    const group = div.querySelector('.radio-group');
    options.forEach(opt => {
      const lbl = document.createElement('label');
      lbl.className = 'radio-label';
      lbl.innerHTML = `<input type="radio" name="${field}" ${data[field] === opt.v ? 'checked' : ''} onchange="setField('${ds}', '${field}', '${opt.v}')"> ${opt.l}`;
      group.appendChild(lbl);
    });
    body.appendChild(div);
  }

  if ([0, 1, 3, 5, 6].includes(dow)) {
    addInput('Hoy oré (minutos)', 'prayerMinutes', 'ej. 30 o 60', 'number');
    addInput('Y leí en la Biblia', 'bibleReading', 'ej. Mateo 5:1-24 o Salmo 23');
  }

  if (dow === 2 || dow === 4) {
    addRadio('Asistencia Oración', 'prayerAttendance', [{ v: 'connected', l: 'Me conecté' }, { v: 'attended', l: 'Asistí' }]);
    addInput('Desde (Hora)', 'prayerFrom', 'ej. 6:00 AM');
    addInput('Hasta (Hora)', 'prayerTo', 'ej. 7:00 PM');
    addInput('Y leí en la Biblia', 'bibleReading', 'ej. Josué 1');
  } else if (dow === 3) {
    addRadio('Al culto de las:', 'cultoTime', [{ v: '5:00 PM', l: '5:00 PM' }, { v: '7:00 PM', l: '7:00 PM' }]);
    addRadio('Asistencia:', 'cultoAttendance', [{ v: 'connected', l: 'Me conecté' }, { v: 'attended', l: 'Asistí' }]);
  } else if (dow === 6 || dow === 0) {
    const hours = dow === 6 ?
      [{ v: '1:00 PM', l: '1 PM' }, { v: '3:00 PM', l: '3 PM' }, { v: '5:00 PM', l: '5 PM' }, { v: '7:00 PM', l: '7 PM' }] :
      [{ v: '7:30 AM', l: '7:30 AM' }, { v: '9:30 AM', l: '9:30 AM' }, { v: '11:30 AM', l: '11:30 AM' }, { v: '1:30 PM', l: '1:30 PM' }];
    addRadio('Hoy asistí al culto de las:', 'cultoTime', hours);
    addRadio('Modalidad:', 'prayerAttendance', [{ v: 'connected', l: 'Virtual' }, { v: 'attended', l: 'Presencial' }]);
    addInput('¿Por qué me conecté virtual?', 'virtualReason', 'ej. Estaba de viaje o enfermo');
  }

  document.getElementById('modal-overlay').classList.add('open');
}

function discardChanges() {
  if (activeDs) {
    if (originalDayData) {
      monthData[activeDs] = originalDayData;
    } else {
      delete monthData[activeDs];
    }
    saveMonth();
    renderCalendar();
  }
  closeModal();
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

function init() {
  const now = new Date(); curYear = now.getFullYear(); curMonth = now.getMonth();
  monthData = loadMonth(curYear, curMonth);
  renderCalendar();

  document.getElementById('prev-month').onclick = () => { curMonth--; if (curMonth < 0) { curMonth = 11; curYear--; } monthData = loadMonth(curYear, curMonth); renderCalendar(); };
  document.getElementById('next-month').onclick = () => { curMonth++; if (curMonth > 11) { curMonth = 0; curYear++; } monthData = loadMonth(curYear, curMonth); renderCalendar(); };
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-save-btn').onclick = closeModal;
  document.getElementById('modal-discard-btn').onclick = discardChanges;
  document.getElementById('print-btn').onclick = () => {
    const prev = document.title;
    document.title = `R07 — ${MONTHS[curMonth]} ${curYear}`;
    window.print();
    document.title = prev;
  };
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(localStorage)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `R07_Respaldo.json`; a.click();
    };
  }
}

window.setField = setField;
document.addEventListener('DOMContentLoaded', init);