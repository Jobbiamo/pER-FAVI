import { data, save } from '../store.js';
import { $, $$, esc, today, addDays, diffDays, fmtDate, relDay, urgency } from '../util.js';
import { evType } from '../model.js';
import { editEvent, editDeadline, editTask, caseLabel, quickAdd } from '../forms.js';
import { rerender } from '../app.js';

export function lastContact(caseId) {
  const l = data.log.filter((x) => x.caseId === caseId).sort((a, b) => b.date.localeCompare(a.date))[0];
  const e = data.events.filter((x) => x.caseId === caseId && x.date <= today() && x.done).sort((a, b) => b.date.localeCompare(a.date))[0];
  const d = [l?.date, e?.date].filter(Boolean).sort().at(-1);
  return d || null;
}

export function eventRow(e, { showDate = false } = {}) {
  const [, label, ico] = evType(e.type);
  const uvm = e.type === 'uvm' ? data.uvm.find((u) => u.eventId === e.id || (u.caseId === e.caseId && u.date === e.date)) : null;
  return `<div class="item ev ${e.done ? 'done' : ''}" data-ev="${e.id}">
    <button class="tick ${e.done ? 'on' : ''}" data-tick-ev="${e.id}" aria-label="Fatto"></button>
    <div class="ev-time">${showDate ? `<small>${fmtDate(e.date, 'day')}</small>` : ''}<b>${esc(e.time || '')}</b></div>
    <div class="grow"><div class="t">${ico} ${esc(label)}${e.caseId ? ` · <span class="case-tag">${esc(caseLabel(e.caseId))}</span>` : ''}</div>
      <div class="s">${esc([e.place, e.notes].filter(Boolean).join(' · '))}</div>
      ${uvm ? `<a class="mini-link" href="#/uvm/${uvm.id}">Preparazione UVM ${uvm.checklist.filter((c) => c.done).length}/${uvm.checklist.length} →</a>` : ''}</div>
  </div>`;
}
export function deadlineRow(d) {
  const u = d.done ? 'done' : urgency(d.date);
  return `<div class="item dl u-${u}" data-dl="${d.id}">
    <button class="tick ${d.done ? 'on' : ''}" data-tick-dl="${d.id}" aria-label="Fatto"></button>
    <div class="grow"><div class="t">${esc(d.title)}${d.caseId ? ` · <span class="case-tag">${esc(caseLabel(d.caseId))}</span>` : ''}</div>
      <div class="s">${fmtDate(d.date, 'day')} · <b>${relDay(d.date)}</b></div></div>
  </div>`;
}
export function taskRow(t) {
  return `<div class="item task ${t.done ? 'done' : ''}" data-tk="${t.id}">
    <button class="tick ${t.done ? 'on' : ''}" data-tick-tk="${t.id}" aria-label="Fatto"></button>
    <div class="grow"><div class="t">${esc(t.text)}</div>
      <div class="s">${t.caseId ? `<span class="case-tag">${esc(caseLabel(t.caseId))}</span>` : ''}${t.due ? ` entro ${fmtDate(t.due, 'dm')}` : ''}</div></div>
  </div>`;
}

/** Collega tick e tocchi delle righe (usato in più pagine) */
export function bindRows(root) {
  $$('[data-tick-ev]', root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const x = data.events.find((v) => v.id === b.dataset.tickEv); x.done = !x.done; save(); rerender(); }));
  $$('[data-tick-dl]', root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const x = data.deadlines.find((v) => v.id === b.dataset.tickDl); x.done = !x.done; save(); rerender(); }));
  $$('[data-tick-tk]', root).forEach((b) => (b.onclick = (e) => {
    e.stopPropagation(); const x = data.tasks.find((v) => v.id === b.dataset.tickTk); x.done = !x.done; x.doneAt = x.done ? today() : null;
    b.classList.toggle('on', x.done); b.closest('.item').classList.toggle('done', x.done); save(); setTimeout(rerender, 350);
  }));
  $$('[data-ev]', root).forEach((r) => (r.onclick = (e) => { if (e.target.closest('a')) return; editEvent(data.events.find((v) => v.id === r.dataset.ev)); }));
  $$('[data-dl]', root).forEach((r) => (r.onclick = () => editDeadline(data.deadlines.find((v) => v.id === r.dataset.dl))));
  $$('[data-tk]', root).forEach((r) => (r.onclick = () => editTask(data.tasks.find((v) => v.id === r.dataset.tk))));
}

export function renderToday(main) {
  const T = today();
  const h = new Date().getHours();
  const greet = h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const name = data.settings.name ? `, ${esc(data.settings.name)}` : '';
  const evs = data.events.filter((e) => e.date === T).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const late = data.deadlines.filter((d) => !d.done && d.date < T).sort((a, b) => a.date.localeCompare(b.date));
  const soon = data.deadlines.filter((d) => !d.done && d.date >= T && d.date <= addDays(T, 14)).sort((a, b) => a.date.localeCompare(b.date));
  const tasks = data.tasks.filter((t) => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const stale = data.cases.filter((c) => c.status === 'attivo').map((c) => ({ c, last: lastContact(c.id) }))
    .filter((x) => !x.last || diffDays(x.last, T) >= (data.settings.staleDays || 30)).sort((a, b) => (a.last || '').localeCompare(b.last || ''));
  const nextUvm = data.uvm.filter((u) => u.status !== 'svolta' && u.date >= T).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const tomorrow = data.events.filter((e) => e.date === addDays(T, 1)).length;

  main.innerHTML = `
    <section class="hero">
      <p class="hero-date">${fmtDate(T, 'long')}</p>
      <h1>${greet}${name}</h1>
      <div class="hero-stats">
        <div><b>${evs.length}</b><span>oggi</span></div>
        <div class="${late.length ? 'warn' : ''}"><b>${late.length + soon.filter((d) => diffDays(T, d.date) <= 3).length}</b><span>scadenze urgenti</span></div>
        <div><b>${tasks.length}</b><span>da fare</span></div>
      </div>
    </section>

    ${late.length ? `<section class="card alert-card"><h2>⚠️ Scadenze passate</h2>${late.map(deadlineRow).join('')}</section>` : ''}

    <section class="card">
      <div class="card-h"><h2>Oggi</h2><button class="link" data-add-ev>+ Aggiungi</button></div>
      ${evs.length ? evs.map((e) => eventRow(e)).join('') : `<p class="empty">Nessun appuntamento oggi.${tomorrow ? ` Domani: ${tomorrow}.` : ''}</p>`}
    </section>

    <section class="card">
      <div class="card-h"><h2>Scadenze (14 giorni)</h2><button class="link" data-add-dl>+ Aggiungi</button></div>
      ${soon.length ? soon.map(deadlineRow).join('') : '<p class="empty">Niente in scadenza nelle prossime 2 settimane. 🌿</p>'}
    </section>

    <section class="card">
      <div class="card-h"><h2>Cose da fare</h2><button class="link" data-add-tk>+ Aggiungi</button></div>
      ${tasks.length ? tasks.slice(0, 12).map(taskRow).join('') : '<p class="empty">Tutto fatto!</p>'}
    </section>

    ${nextUvm.length ? `<section class="card"><div class="card-h"><h2>🧩 Prossime UVM</h2><a class="link" href="#/uvm">Tutte</a></div>
      ${nextUvm.map((u) => { const n = u.checklist.filter((c) => c.done).length; return `<a class="item uvm-row" href="#/uvm/${u.id}"><div class="grow"><div class="t">${esc(caseLabel(u.caseId))} · ${fmtDate(u.date, 'day')} ${esc(u.time || '')}</div>
        <div class="progress"><span style="width:${(n / (u.checklist.length || 1)) * 100}%"></span></div><div class="s">Preparazione ${n}/${u.checklist.length} · ${relDay(u.date)}</div></div><span class="chev">›</span></a>`; }).join('')}</section>` : ''}

    ${stale.length ? `<section class="card"><div class="card-h"><h2>👀 Da ricontattare</h2><span class="muted small">nessun contatto da ${data.settings.staleDays} giorni</span></div>
      ${stale.slice(0, 8).map(({ c, last }) => `<a class="item" href="#/caso/${c.id}"><div class="grow"><div class="t"><span class="case-tag">${esc(c.code)}</span> ${esc(c.area)}</div><div class="s">${last ? 'ultimo contatto ' + relDay(last) : 'nessun contatto registrato'}</div></div><span class="chev">›</span></a>`).join('')}</section>` : ''}
  `;
  bindRows(main);
  $('[data-add-ev]', main).onclick = () => editEvent(null, { date: T });
  $('[data-add-dl]', main).onclick = () => editDeadline();
  $('[data-add-tk]', main).onclick = () => editTask();
  void quickAdd;
}
