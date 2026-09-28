// Moduli di inserimento / modifica (si aprono dal basso)
import { data, save } from './store.js';
import { $, $$, esc, uid, today, addDays, addMonths, nowTime, sheet, confirmSheet, toast, field, area, select, chips, bindChips, formData, fmtDate, gcalLink } from './util.js';
import { AREAS, CASE_STATUS, EVENT_TYPES, LOG_KINDS, AXES, AXIS_STATUS, ROLES, DEADLINE_TEMPLATES, evType } from './model.js';
import { rerender } from './app.js';

export const caseById = (id) => data.cases.find((c) => c.id === id);
export const caseLabel = (id) => caseById(id)?.code || '';
const caseOpts = (withNone = true) => [...(withNone ? [['', '— nessun caso —']] : []), ...data.cases.filter((c) => c.status !== 'chiuso').sort((a, b) => a.code.localeCompare(b.code)).map((c) => [c.id, c.code])];

function done(close, msg) { save(); close(); rerender(); if (msg) toast(msg); }

// ---------------- Menu "+" ----------------
export function quickAdd(defaults = {}) {
  sheet({
    title: 'Aggiungi',
    body: `<div class="quick-grid">
      <button data-q="event"><span>🗓️</span>Appuntamento</button>
      <button data-q="deadline"><span>⏰</span>Scadenza</button>
      <button data-q="task"><span>✅</span>Cosa da fare</button>
      <button data-q="log"><span>📝</span>Nota su un caso</button>
      <button data-q="uvm"><span>🧩</span>UVM</button>
      <button data-q="case"><span>👤</span>Nuovo caso</button>
      <button data-q="km"><span>🚗</span>Chilometri</button>
      <button data-q="contact"><span>📇</span>Contatto</button>
    </div>`,
    onMount: (s, close) => $$('[data-q]', s).forEach((b) => (b.onclick = () => {
      close();
      setTimeout(() => ({ event: editEvent, deadline: editDeadline, task: editTask, log: editLog, uvm: newUvm, case: editCase, km: editKm, contact: editContact })[b.dataset.q](null, defaults), 180);
    })),
  });
}

// ---------------- Appuntamento ----------------
export function editEvent(ev, def = {}) {
  const isNew = !ev;
  ev = ev || { type: def.type || 'colloquio', caseId: def.caseId || '', date: def.date || today(), time: def.time || '09:00', duration: 45, place: '', notes: '', done: false };
  sheet({
    title: isNew ? 'Nuovo appuntamento' : 'Appuntamento', full: true,
    body: `<form id="f">
      <div class="fld"><span>Tipo</span>${chips('type', EVENT_TYPES.map(([k, l, i]) => [k, `${i} ${l}`]), ev.type)}</div>
      ${select('Caso', 'caseId', caseOpts(), ev.caseId)}
      <div class="row2">${field('Data', 'date', ev.date, { type: 'date' })}${field('Ora', 'time', ev.time, { type: 'time' })}</div>
      <div class="row2">${field('Durata (min)', 'duration', ev.duration, { type: 'number', attrs: 'inputmode="numeric" step="5"' })}${field('Luogo', 'place', ev.place, { ph: 'es. CSM, domicilio' })}</div>
      ${area('Note (senza dati sensibili)', 'notes', ev.notes, { rows: 2 })}
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn" data-cal title="Aggiungi a Google Calendar">📅 Calendario</button><button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      bindChips(s);
      const f = $('#f', s);
      const read = () => { const o = formData(f); o.duration = o.duration || 30; return o; };
      $('[data-save]', s).onclick = () => {
        const o = read();
        if (!o.date) return toast('Inserisci la data', 'err');
        if (isNew) data.events.push({ id: uid(), done: false, ...o }); else Object.assign(ev, o);
        if (o.type === 'uvm' && isNew && o.caseId && !data.uvm.some((u) => u.caseId === o.caseId && u.date === o.date)) {
          data.uvm.push(newUvmObj(o.caseId, o.date, o.time, o.place));
        }
        done(close, 'Appuntamento salvato');
      };
      $('[data-cal]', s).onclick = () => {
        const o = read();
        window.open(gcalLink({ title: `${evType(o.type)[1]}${o.caseId ? ' ' + caseLabel(o.caseId) : ''}`, date: o.date, time: o.time, duration: o.duration, place: o.place }), '_blank');
      };
      $('[data-del]', s)?.addEventListener('click', async () => {
        if (!(await confirmSheet('Eliminare questo appuntamento?'))) return;
        data.events = data.events.filter((x) => x !== ev); done(close, 'Eliminato');
      });
    },
  });
}

// ---------------- Scadenza ----------------
export function editDeadline(dl, def = {}) {
  const isNew = !dl;
  dl = dl || { caseId: def.caseId || '', title: '', date: addDays(today(), 7), type: 'altro', done: false, notes: '' };
  sheet({
    title: isNew ? 'Nuova scadenza' : 'Scadenza', full: true,
    body: `<form id="f">
      ${isNew ? `<div class="fld"><span>Scelta rapida</span><div class="tpl-list">${DEADLINE_TEMPLATES.map((t, i) => `<button type="button" class="chip" data-tpl="${i}">${esc(t.title)} <small>${t.months ? `+${t.months} mesi` : `+${t.days} gg`}</small></button>`).join('')}</div></div>` : ''}
      ${field('Cosa scade', 'title', dl.title, { ph: 'es. Verifica progetto' })}
      ${select('Caso', 'caseId', caseOpts(), dl.caseId)}
      ${field('Data', 'date', dl.date, { type: 'date' })}
      ${area('Note', 'notes', dl.notes, { rows: 2 })}
      <label class="check"><input type="checkbox" name="done" ${dl.done ? 'checked' : ''}> Fatto</label>
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn" data-cal>📅 Calendario</button><button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      const f = $('#f', s);
      $$('[data-tpl]', s).forEach((b) => (b.onclick = () => {
        const t = DEADLINE_TEMPLATES[b.dataset.tpl];
        f.title.value = t.title;
        f.date.value = t.months ? addMonths(today(), t.months) : addDays(today(), t.days);
        dl.type = t.type;
        $$('[data-tpl]', s).forEach((x) => x.classList.remove('on')); b.classList.add('on');
      }));
      $('[data-save]', s).onclick = () => {
        const o = formData(f);
        if (!o.title || !o.date) return toast('Scrivi cosa scade e la data', 'err');
        if (isNew) data.deadlines.push({ id: uid(), type: dl.type, ...o }); else Object.assign(dl, o);
        done(close, 'Scadenza salvata');
      };
      $('[data-cal]', s).onclick = () => {
        const o = formData(f);
        window.open(gcalLink({ title: `⏰ ${o.title}${o.caseId ? ' – ' + caseLabel(o.caseId) : ''}`, date: o.date, allDay: true, details: 'Promemoria da Agenda Sociale' }), '_blank');
      };
      $('[data-del]', s)?.addEventListener('click', async () => {
        if (!(await confirmSheet('Eliminare questa scadenza?'))) return;
        data.deadlines = data.deadlines.filter((x) => x !== dl); done(close, 'Eliminata');
      });
    },
  });
}

// ---------------- Cosa da fare ----------------
export function editTask(tk, def = {}) {
  const isNew = !tk;
  tk = tk || { caseId: def.caseId || '', text: '', due: '', done: false };
  sheet({
    title: isNew ? 'Cosa da fare' : 'Modifica',
    body: `<form id="f">
      ${area('Cosa devi fare', 'text', tk.text, { rows: 2, ph: 'es. Chiamare il CSM' })}
      ${select('Caso', 'caseId', caseOpts(), tk.caseId)}
      ${field('Entro (facoltativo)', 'due', tk.due, { type: 'date' })}
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      setTimeout(() => $('textarea', s).focus(), 250);
      $('[data-save]', s).onclick = () => {
        const o = formData($('#f', s));
        if (!o.text) return toast('Scrivi cosa devi fare', 'err');
        if (isNew) data.tasks.push({ id: uid(), done: false, createdAt: today(), ...o }); else Object.assign(tk, o);
        done(close, 'Salvato');
      };
      $('[data-del]', s)?.addEventListener('click', () => { data.tasks = data.tasks.filter((x) => x !== tk); done(close); });
    },
  });
}

// ---------------- Nota nel diario del caso ----------------
export function editLog(lg, def = {}) {
  const isNew = !lg;
  lg = lg || { caseId: def.caseId || '', date: today(), kind: 'colloquio', text: '' };
  sheet({
    title: isNew ? 'Nota sul caso' : 'Modifica nota',
    body: `<form id="f">
      ${select('Caso', 'caseId', caseOpts(false), lg.caseId)}
      <div class="fld"><span>Tipo</span>${chips('kind', LOG_KINDS, lg.kind)}</div>
      ${field('Data', 'date', lg.date, { type: 'date' })}
      ${area('Cosa è successo', 'text', lg.text, { rows: 4, ph: 'Scrivi in breve, senza dati sensibili' })}
      <p class="hint">💡 Puoi dettare con il microfono della tastiera.</p>
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      bindChips(s);
      if (!data.cases.length) { $('.sheet-body', s).innerHTML = '<p>Prima crea almeno un caso.</p>'; $('[data-save]', s).remove(); return; }
      $('[data-save]', s).onclick = () => {
        const o = formData($('#f', s));
        if (!o.caseId || !o.text) return toast('Scegli il caso e scrivi la nota', 'err');
        if (isNew) data.log.push({ id: uid(), ...o }); else Object.assign(lg, o);
        done(close, 'Nota salvata');
      };
      $('[data-del]', s)?.addEventListener('click', async () => {
        if (!(await confirmSheet('Eliminare questa nota?'))) return;
        data.log = data.log.filter((x) => x !== lg); done(close);
      });
    },
  });
}

// ---------------- Caso ----------------
export function editCase(c, def = {}) {
  const isNew = !c;
  c = c || { code: '', area: def.area || 'Salute mentale', status: 'attivo', refs: [], axes: {}, budget: false, nextStep: '', notes: '' };
  const refRow = (r = {}) => `<div class="ref-row"><select data-r="role">${ROLES.map((x) => `<option ${x === r.role ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><input data-r="name" placeholder="Nome / servizio" value="${esc(r.name || '')}"><input data-r="phone" placeholder="Telefono" inputmode="tel" value="${esc(r.phone || '')}"><button type="button" class="icon-btn" data-rm>✕</button></div>`;
  sheet({
    title: isNew ? 'Nuovo caso' : 'Modifica caso', full: true,
    body: `<form id="f">
      <p class="privacy-note">🔒 Usa solo <b>iniziali o un codice</b> (es. "A.B." o il numero della cartella). Non scrivere nomi completi, diagnosi o indirizzi.</p>
      ${field('Iniziali / codice', 'code', c.code, { ph: 'es. A.B. oppure 2024/015' })}
      ${select('Area', 'area', AREAS, c.area)}
      <div class="fld"><span>Stato</span>${chips('status', CASE_STATUS, c.status)}</div>
      <label class="check"><input type="checkbox" name="budget" ${c.budget ? 'checked' : ''}> Progetto con Budget di Salute</label>
      <h4>Progetto – i tre assi</h4>
      ${AXES.map(([k, l]) => `<div class="axis-edit"><b>${l}</b>${select('Stato', 'ax_' + k, AXIS_STATUS, c.axes?.[k]?.status || '')}${field('Nota breve', 'axn_' + k, c.axes?.[k]?.note || '')}</div>`).join('')}
      ${field('Prossimo passo', 'nextStep', c.nextStep, { ph: 'es. Contattare coop. per tirocinio' })}
      <h4>Rete di riferimento</h4>
      <div id="refs">${(c.refs || []).map(refRow).join('')}</div>
      <button type="button" class="btn small" id="addref">+ Aggiungi riferimento</button>
      ${area('Note', 'notes', c.notes, { rows: 2 })}
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      bindChips(s);
      const bindRm = () => $$('[data-rm]', s).forEach((b) => (b.onclick = () => b.parentElement.remove()));
      bindRm();
      $('#addref', s).onclick = () => { $('#refs', s).insertAdjacentHTML('beforeend', refRow()); bindRm(); };
      $('[data-save]', s).onclick = () => {
        const f = $('#f', s); const o = formData(f);
        if (!o.code) return toast('Inserisci iniziali o codice', 'err');
        const axes = {}; for (const [k] of AXES) { axes[k] = { status: o['ax_' + k], note: o['axn_' + k] }; delete o['ax_' + k]; delete o['axn_' + k]; }
        const refs = $$('.ref-row', s).map((r) => ({ role: $('[data-r=role]', r).value, name: $('[data-r=name]', r).value.trim(), phone: $('[data-r=phone]', r).value.trim() })).filter((r) => r.name || r.phone);
        const obj = { ...o, axes, refs };
        if (isNew) { const nc = { id: uid(), createdAt: today(), ...obj }; data.cases.push(nc); save(); close(); location.hash = '#/caso/' + nc.id; toast('Caso creato'); }
        else { Object.assign(c, obj); done(close, 'Caso salvato'); }
      };
      $('[data-del]', s)?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Eliminare il caso ${c.code} con tutte le sue note, scadenze e UVM? In alternativa puoi impostarlo come "Chiuso".`))) return;
        for (const k of ['log', 'deadlines', 'tasks', 'uvm']) data[k] = data[k].filter((x) => x.caseId !== c.id);
        data.events.forEach((e) => { if (e.caseId === c.id) e.caseId = ''; });
        data.cases = data.cases.filter((x) => x !== c);
        save(); close(); location.hash = '#/casi'; toast('Caso eliminato');
      });
    },
  });
}

// ---------------- UVM ----------------
export function newUvmObj(caseId, date, time, place) {
  return { id: uid(), caseId, date, time: time || '10:00', place: place || '', participants: '', checklist: data.settings.uvmChecklist.map((t) => ({ text: t, done: false })), notes: '', decisions: '', status: 'preparazione', verifyMonths: 6 };
}
export function newUvm(_x, def = {}) {
  sheet({
    title: 'Nuova UVM',
    body: `<form id="f">
      ${select('Caso', 'caseId', caseOpts(false), def.caseId || '')}
      <div class="row2">${field('Data', 'date', addDays(today(), 7), { type: 'date' })}${field('Ora', 'time', '10:00', { type: 'time' })}</div>
      ${field('Luogo', 'place', '', { ph: 'es. Casa della Salute, CSM' })}
      ${field('Partecipanti', 'participants', '', { ph: 'es. psichiatra CSM, educatore, MMG' })}
      <p class="hint">Verrà creata la checklist di preparazione e l'appuntamento in agenda.</p>
    </form>`,
    actions: '<button class="btn primary" data-save>Crea UVM</button>',
    onMount: (s, close) => {
      if (!data.cases.length) { $('.sheet-body', s).innerHTML = '<p>Prima crea almeno un caso.</p>'; $('[data-save]', s).remove(); return; }
      $('[data-save]', s).onclick = () => {
        const o = formData($('#f', s));
        if (!o.caseId || !o.date) return toast('Scegli caso e data', 'err');
        const u = newUvmObj(o.caseId, o.date, o.time, o.place); u.participants = o.participants;
        const ev = { id: uid(), type: 'uvm', caseId: o.caseId, date: o.date, time: o.time, duration: 60, place: o.place, notes: '', done: false };
        u.eventId = ev.id;
        data.uvm.push(u); data.events.push(ev);
        save(); close(); location.hash = '#/uvm/' + u.id; toast('UVM creata');
      };
    },
  });
}

// ---------------- Contatto ----------------
export function editContact(ct) {
  const isNew = !ct;
  ct = ct || { name: '', org: '', role: '', phone: '', email: '', notes: '' };
  sheet({
    title: isNew ? 'Nuovo contatto' : 'Contatto',
    body: `<form id="f">
      ${field('Nome / servizio', 'name', ct.name, { ph: 'es. CSM Correggio – Dr. Rossi' })}
      <div class="row2">${field('Ente', 'org', ct.org, { ph: 'es. Ausl RE' })}${field('Ruolo', 'role', ct.role, { ph: 'es. psichiatra' })}</div>
      <div class="row2">${field('Telefono', 'phone', ct.phone, { type: 'tel' })}${field('Email', 'email', ct.email, { type: 'email' })}</div>
      ${area('Note', 'notes', ct.notes, { rows: 2, ph: 'orari, interno, chi chiedere…' })}
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      $('[data-save]', s).onclick = () => {
        const o = formData($('#f', s));
        if (!o.name) return toast('Inserisci il nome', 'err');
        if (isNew) data.contacts.push({ id: uid(), ...o }); else Object.assign(ct, o);
        done(close, 'Contatto salvato');
      };
      $('[data-del]', s)?.addEventListener('click', async () => {
        if (!(await confirmSheet('Eliminare il contatto?'))) return;
        data.contacts = data.contacts.filter((x) => x !== ct); done(close);
      });
    },
  });
}

// ---------------- Chilometri ----------------
export function editKm(k, def = {}) {
  const isNew = !k;
  const last = [...data.km].sort((a, b) => b.date.localeCompare(a.date))[0];
  k = k || { date: today(), from: last?.from || 'Ufficio', to: '', km: null, caseId: def.caseId || '', note: '' };
  sheet({
    title: isNew ? 'Chilometri' : 'Modifica viaggio',
    body: `<form id="f">
      ${field('Data', 'date', k.date, { type: 'date' })}
      <div class="row2">${field('Da', 'from', k.from)}${field('A', 'to', k.to, { ph: 'es. domicilio A.B.' })}</div>
      ${field('Km totali', 'km', k.km, { type: 'number', attrs: 'inputmode="decimal" step="0.1"' })}
      <label class="check"><input type="checkbox" name="ar" ${isNew ? 'checked' : ''}> Andata e ritorno (raddoppia)</label>
      ${select('Caso', 'caseId', caseOpts(), k.caseId)}
      ${field('Nota', 'note', k.note)}
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      $('[data-save]', s).onclick = () => {
        const o = formData($('#f', s));
        if (!o.km) return toast('Inserisci i km', 'err');
        if (o.ar) { o.km *= 2; o.note = [o.note, 'andata e ritorno'].filter(Boolean).join(' – '); }
        delete o.ar;
        if (isNew) data.km.push({ id: uid(), ...o }); else Object.assign(k, o);
        done(close, 'Viaggio salvato');
      };
      $('[data-del]', s)?.addEventListener('click', () => { data.km = data.km.filter((x) => x !== k); done(close); });
    },
  });
}

// ---------------- Formazione ----------------
export function editTraining(t) {
  const isNew = !t;
  t = t || { date: today(), title: '', credits: null, deont: false, provider: '' };
  sheet({
    title: isNew ? 'Corso / evento formativo' : 'Modifica',
    body: `<form id="f">
      ${field('Titolo', 'title', t.title)}
      <div class="row2">${field('Data', 'date', t.date, { type: 'date' })}${field('Crediti', 'credits', t.credits, { type: 'number', attrs: 'inputmode="decimal" step="0.5"' })}</div>
      ${field('Ente organizzatore', 'provider', t.provider)}
      <label class="check"><input type="checkbox" name="deont" ${t.deont ? 'checked' : ''}> Crediti deontologici</label>
    </form>`,
    actions: `${!isNew ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn primary" data-save>Salva</button>`,
    onMount: (s, close) => {
      $('[data-save]', s).onclick = () => {
        const o = formData($('#f', s));
        if (!o.title || !o.credits) return toast('Titolo e crediti', 'err');
        if (isNew) data.training.push({ id: uid(), ...o }); else Object.assign(t, o);
        done(close, 'Salvato');
      };
      $('[data-del]', s)?.addEventListener('click', () => { data.training = data.training.filter((x) => x !== t); done(close); });
    },
  });
}

export { fmtDate, nowTime };
