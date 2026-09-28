// Utility comuni: date, testo, finestre a comparsa dal basso, notifiche
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
export const pad = (n) => String(n).padStart(2, '0');
export function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function today() { return toISO(new Date()); }
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
export function addMonths(iso, n) { const d = parseISO(iso); const day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() < day) d.setDate(0); return toISO(d); }
export function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
export function nowTime() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const DAYS_S = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MONTHS_S = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function fmtDate(iso, style = 'short') {
  if (!iso) return '';
  const d = parseISO(iso);
  switch (style) {
    case 'long': return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    case 'full': return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case 'day': return `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
    case 'month': return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case 'dm': return `${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
    default: return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
}
export const dayShort = (iso) => DAYS_S[parseISO(iso).getDay()];

/** "oggi", "domani", "tra 3 giorni", "2 giorni fa" */
export function relDay(iso) {
  const n = diffDays(today(), iso);
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n === -1) return 'ieri';
  if (n > 1) return n <= 30 ? `tra ${n} giorni` : fmtDate(iso, 'dm');
  return -n <= 60 ? `${-n} giorni fa` : fmtDate(iso, 'dm');
}
/** classe di urgenza per le scadenze */
export function urgency(iso) {
  const n = diffDays(today(), iso);
  if (n < 0) return 'late';
  if (n <= 3) return 'red';
  if (n <= 7) return 'orange';
  return 'ok';
}
export function num(v) { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; }
export function fmtNum(n, d = 1) { return n == null ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: d }); }
export function fmtEuro(n) { return (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }

/** Link per aggiungere un evento a Google Calendar (app Calendario su Android) */
export function gcalLink({ title, date, time, duration = 60, details = '', place = '', allDay = false }) {
  const d = date.replaceAll('-', '');
  let dates;
  if (allDay || !time) dates = `${d}/${addDays(date, 1).replaceAll('-', '')}`;
  else {
    const [h, m] = time.split(':').map(Number);
    const start = new Date(parseISO(date)); start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + duration * 60000);
    const f = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    dates = `${f(start)}/${f(end)}`;
  }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates, details, location: place, ctz: 'Europe/Rome' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// ---------------- Toast ----------------
export function toast(msg, type = 'ok') {
  let box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('hide'), 2300);
  setTimeout(() => el.remove(), 2800);
}

// ---------------- Finestra dal basso (bottom sheet) ----------------
const stack = [];
export function sheet({ title, body, onMount, actions = '', full = false, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet ${full ? 'full' : ''}" role="dialog">
    <div class="sheet-grab"></div>
    <div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Chiudi">✕</button></div>
    <div class="sheet-body">${body}</div>
    ${actions ? `<div class="sheet-actions">${actions}</div>` : ''}
  </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.classList.remove('open');
    setTimeout(() => { wrap.remove(); if (!$('.sheet-backdrop')) document.body.classList.remove('no-scroll'); }, 200);
    const i = stack.indexOf(close); if (i >= 0) stack.splice(i, 1);
    onClose?.();
  };
  stack.push(close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  $$('[data-close]', wrap).forEach((b) => b.addEventListener('click', close));
  onMount?.($('.sheet', wrap), close);
  return close;
}
export function closeAllSheets() { [...stack].reverse().forEach((c) => c()); }

export function confirmSheet(msg, okText = 'Elimina', danger = true) {
  return new Promise((resolve) => {
    let res = false;
    sheet({
      title: 'Sei sicura?', body: `<p>${esc(msg)}</p>`,
      actions: `<button class="btn" data-close>Annulla</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okText)}</button>`,
      onMount: (s, cl) => { $('[data-ok]', s).onclick = () => { res = true; cl(); }; },
      onClose: () => resolve(res),
    });
  });
}

// ---------------- Campi dei moduli ----------------
export function field(label, name, value = '', { type = 'text', ph = '', attrs = '', cls = '' } = {}) {
  return `<label class="fld ${cls}"><span>${esc(label)}</span><input type="${type}" name="${name}" value="${esc(value ?? '')}" placeholder="${esc(ph)}" ${attrs}></label>`;
}
export function area(label, name, value = '', { rows = 3, ph = '', cls = '' } = {}) {
  return `<label class="fld ${cls}"><span>${esc(label)}</span><textarea name="${name}" rows="${rows}" placeholder="${esc(ph)}">${esc(value ?? '')}</textarea></label>`;
}
export function select(label, name, opts, value = '', { cls = '' } = {}) {
  return `<label class="fld ${cls}"><span>${esc(label)}</span><select name="${name}">${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
}
export function chips(name, opts, value) {
  return `<div class="chips-select" data-name="${name}">${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<button type="button" class="chip ${String(v) === String(value) ? 'on' : ''}" data-v="${esc(v)}">${esc(t)}</button>`; }).join('')}<input type="hidden" name="${name}" value="${esc(value ?? '')}"></div>`;
}
export function bindChips(root) {
  $$('.chips-select', root).forEach((g) => {
    const inp = $('input', g);
    $$('.chip', g).forEach((c) => c.addEventListener('click', () => {
      $$('.chip', g).forEach((x) => x.classList.remove('on'));
      c.classList.add('on'); inp.value = c.dataset.v;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  });
}
export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number') o[el.name] = num(el.value);
    else o[el.name] = el.value.trim();
  }
  return o;
}
