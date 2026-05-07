'use strict';

// ============================================================
// Supabase — reemplaza estos valores con los de tu proyecto
// supabase.com → Project Settings → API
// ============================================================
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Constantes y estado global
// ============================================================
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

let curYear, curMonth, monthData;
let activeDs = null;
let colombiaHolidays = new Set();
let holidaysYear = -1;
let currentUser = null;

// ============================================================
// Festivos Colombia
// ============================================================
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

// ============================================================
// Almacenamiento: localStorage (caché) + Supabase (fuente de verdad)
// ============================================================
function storageKey(y, m) { return `r07_${y}-${String(m + 1).padStart(2, '0')}`; }

async function loadMonth(y, m) {
  if (currentUser) {
    const prefix = `${y}-${m}-`;
    const { data, error } = await sb
      .from('r07_data')
      .select('day_key, data')
      .eq('user_id', currentUser.id)
      .like('day_key', `${prefix}%`);

    if (!error && data) {
      const obj = {};
      data.forEach(row => { obj[row.day_key] = row.data; });
      try { localStorage.setItem(storageKey(y, m), JSON.stringify(obj)); } catch (e) { }
      return obj;
    }
  }
  // Fallback a localStorage cuando no hay sesión o falla la red
  try {
    const raw = localStorage.getItem(storageKey(y, m));
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveMonthLocal() {
  try { localStorage.setItem(storageKey(curYear, curMonth), JSON.stringify(monthData)); } catch (e) { }
}

function syncDayToSupabase(ds) {
  if (!currentUser) return;
  sb.from('r07_data').upsert(
    { user_id: currentUser.id, day_key: ds, data: monthData[ds] || {}, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,day_key' }
  );
}

function deleteDayFromSupabase(ds) {
  if (!currentUser) return;
  sb.from('r07_data').delete().eq('user_id', currentUser.id).eq('day_key', ds);
}

// ============================================================
// Lógica de la app (setField, render, modal — sin cambios estructurales)
// ============================================================
function setField(ds, field, value) {
  if (!monthData[ds]) monthData[ds] = {};
  monthData[ds][field] = value;
  saveMonthLocal();
  syncDayToSupabase(ds);
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
  const v = (val, wide) => val
    ? `<b>${val}</b>`
    : `<span class="blank${wide ? ' wide' : ''}"></span>`;

  const bc = (field, val) => d[field] === val
    ? '<b>X</b>'
    : '<span class="blank"></span>';

  const radios = (field, opts) =>
    `<span class="radio-row">${opts.map(([stored, label]) => {
      const sel = d[field] === stored;
      return `<span class="radio-opt${sel ? ' sel' : ''}"><span class="rdot">${sel ? '●' : '○'}</span>${label}</span>`;
    }).join('')}</span>`;

  const lines = [];

  if ([0, 1, 3, 5, 6].includes(dow)) {
    lines.push(`Hoy oré ${v(d.prayerMinutes)} min. <br> Y leí ${v(d.bibleReading, true)} en la Biblia`);
  }

  if (dow === 2 || dow === 4) {
    lines.push(`Hoy me conecté ${bc('prayerAttendance', 'connected')} asistí ${bc('prayerAttendance', 'attended')} a la oración de ${v(d.prayerFrom)} a ${v(d.prayerTo)}`);
    lines.push(`Y leí ${v(d.bibleReading, true)} en la Biblia`);
  }

  if (dow === 3) {
    lines.push(`Hoy me conecté ${bc('cultoAttendance', 'connected')} asistí ${bc('cultoAttendance', 'attended')} al culto de las:`);
    lines.push(radios('cultoTime', [['5:00 PM', '5PM'], ['7:00 PM', '7PM']]));
  }

  if (dow === 6) {
    lines.push(`Hoy asistí al culto de las:`);
    lines.push(radios('cultoTime', [['1:00 PM', '1PM'], ['3:00 PM', '3PM'], ['5:00 PM', '5PM'], ['7:00 PM', '7PM']]));
    lines.push(`¿Por qué me conecté virtual? ${v(d.virtualReason, true)}`);
  }

  if (dow === 0) {
    lines.push(`Hoy asistí al culto de las:`);
    lines.push(radios('cultoTime', [['7:30 AM', '7:30 AM'], ['9:30 AM', '9:30 AM'], ['11:30 AM', '11:30 AM'], ['1:30 PM', '1:30 PM']]));
    lines.push(`¿Por qué me conecté virtual? ${v(d.virtualReason, true)}`);
  }

  return lines.map(l => `<div class="day-line">${l}</div>`).join('');
}

function openModal(d, dow, ds) {
  activeDs = ds;

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

  function addTimeSelector(label, field, defaultPeriod = 'AM') {
    const div = document.createElement('div');
    div.className = 'form-group';
    const existing = data[field] || '';
    let selHour = '6', selMin = '00', selPeriod = defaultPeriod;
    if (existing) {
      const m = existing.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (m) { selHour = String(parseInt(m[1])); selMin = m[2].padStart(2, '0'); selPeriod = m[3].toUpperCase(); }
    }
    const hourOpts = Array.from({length: 12}, (_, i) => i + 1)
      .map(h => `<option value="${h}"${String(h) === selHour ? ' selected' : ''}>${h}</option>`).join('');
    const minOpts = ['00', '15', '30', '45']
      .map(m => `<option value="${m}"${m === selMin ? ' selected' : ''}>${m}</option>`).join('');
    const periodOpts = ['AM', 'PM']
      .map(p => `<option value="${p}"${p === selPeriod ? ' selected' : ''}>${p}</option>`).join('');
    div.innerHTML = `<label class="field-label">${label}</label>
      <div class="time-selector">
        <select class="time-hour" onchange="updateTimeField('${ds}','${field}',this.closest('.time-selector'))">${hourOpts}</select>
        <span class="time-sep">:</span>
        <select class="time-min" onchange="updateTimeField('${ds}','${field}',this.closest('.time-selector'))">${minOpts}</select>
        <select class="time-period" onchange="updateTimeField('${ds}','${field}',this.closest('.time-selector'))">${periodOpts}</select>
      </div>`;
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
    addTimeSelector('Desde (Hora)', 'prayerFrom', 'AM');
    addTimeSelector('Hasta (Hora)', 'prayerTo', 'PM');
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

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

function clearDay() {
  if (activeDs) {
    deleteDayFromSupabase(activeDs);
    delete monthData[activeDs];
    saveMonthLocal();
    renderCalendar();
  }
  closeModal();
}

async function shiftMonth(delta) {
  curMonth += delta;
  if (curMonth < 0) { curMonth = 11; curYear--; }
  else if (curMonth > 11) { curMonth = 0; curYear++; }
  monthData = await loadMonth(curYear, curMonth);
  renderCalendar();
}

// ============================================================
// Auth — Google OAuth con Supabase
// ============================================================
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display = '';

  const meta = currentUser.user_metadata || {};
  document.getElementById('user-name').textContent = meta.full_name || meta.name || currentUser.email || '';
  const avatar = document.getElementById('user-avatar');
  if (meta.avatar_url) {
    avatar.src = meta.avatar_url;
    avatar.style.display = 'block';
  } else {
    avatar.style.display = 'none';
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = '';
  document.getElementById('main-app').style.display = 'none';
}

function signInWithGoogle() {
  sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

async function signOut() {
  await sb.auth.signOut();
  monthData = {};
  showAuthScreen();
}

async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
    await init();
  } else {
    showAuthScreen();
  }
}

sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session && !currentUser) {
    currentUser = session.user;
    showApp();
    await init();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
  }
});

// ============================================================
// Compartir como PDF
// ============================================================
async function shareMonth() {
  const filename = `R07_${MONTHS[curMonth]}_${curYear}.pdf`;
  const title = `R07 ${MONTHS[curMonth]} ${curYear}`;

  const shareBtn = document.getElementById('share-btn');
  shareBtn.disabled = true;
  shareBtn.querySelector('span').textContent = 'Generando…';

  // Ocultar elementos que no van en el PDF (igual que impresión)
  const noPrint = document.querySelectorAll('.no-print');
  const printHeader = document.querySelector('.print-header');
  noPrint.forEach(el => el.style.visibility = 'hidden');
  if (printHeader) printHeader.style.display = 'block';

  try {
    const element = document.getElementById('main-app');
    const opt = {
      margin: [8, 8],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    const blob = await html2pdf().from(element).set(opt).outputPdf('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title, files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  } finally {
    noPrint.forEach(el => el.style.visibility = '');
    if (printHeader) printHeader.style.display = '';
    shareBtn.disabled = false;
    shareBtn.querySelector('span').textContent = 'Compartir';
  }
}

// ============================================================
// Inicialización
// ============================================================
function updateTimeField(ds, field, container) {
  const hour = container.querySelector('.time-hour').value;
  const min = container.querySelector('.time-min').value;
  const period = container.querySelector('.time-period').value;
  setField(ds, field, `${hour}:${min} ${period}`);
}

async function init() {
  const now = new Date();
  curYear = now.getFullYear();
  curMonth = now.getMonth();
  monthData = await loadMonth(curYear, curMonth);
  renderCalendar();

  document.getElementById('prev-month').onclick = () => shiftMonth(-1);
  document.getElementById('next-month').onclick = () => shiftMonth(1);
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-clear-btn').onclick = clearDay;
  document.getElementById('modal-save-btn').onclick = closeModal;
  document.getElementById('sign-out-btn').onclick = signOut;
  document.getElementById('share-btn').onclick = shareMonth;
  document.getElementById('print-btn').onclick = () => {
    const prev = document.title;
    document.title = `R07 — ${MONTHS[curMonth]} ${curYear}`;
    window.print();
    document.title = prev;
  };
}

window.setField = setField;
window.updateTimeField = updateTimeField;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('google-sign-in-btn').addEventListener('click', signInWithGoogle);
  checkAuth();
});

// Escalado automático al imprimir
(function setupPrintScale() {
  function getWeekRows() {
    const grid = document.querySelector('.calendar-grid');
    return grid ? Math.ceil(grid.children.length / 7) : 5;
  }

  function applyScale() {
    const app = document.querySelector('.app');
    if (!app) return;
    app.style.zoom = '';
    const rows = getWeekRows();
    if (rows >= 6) app.style.zoom = (5 / rows).toFixed(4);
  }

  function resetScale() {
    const el = document.querySelector('.app');
    if (el) el.style.zoom = '';
  }

  window.addEventListener('beforeprint', applyScale);
  window.addEventListener('afterprint', resetScale);
}());
