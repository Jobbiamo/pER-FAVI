import { data, save } from '../store.js';
import { $, $$, esc, uid, today, addMonths, fmtDate, relDay, toast, sheet, confirmSheet, gcalLink } from '../util.js';
import { UVM_AFTER } from '../model.js';
import { newUvm, caseLabel, caseById } from '../forms.js';
import { rerender } from '../app.js';

export function renderUvmList(main) {
  const T = today();
  const up = data.uvm.filter((u) => u.status !== 'svolta').sort((a, b) => a.date.localeCompare(b.date));
  const past = data.uvm.filter((u) => u.status === 'svolta').sort((a, b) => b.date.localeCompare(a.date));
  const row = (u) => { const n = u.checklist.filter((c) => c.done).length; return `<a class="item uvm-row" href="#/uvm/${u.id}"><div class="grow">
    <div class="t"><span class="case-tag">${esc(caseLabel(u.caseId))}</span> ${fmtDate(u.date, 'day')} ${esc(u.time || '')}</div>
    ${u.status !== 'svolta' ? `<div class="progress ${u.date < T ? 'late' : ''}"><span style="width:${(n / (u.checklist.length || 1)) * 100}%"></span></div><div class="s">Preparazione ${n}/${u.checklist.length} · ${relDay(u.date)}</div>` : `<div class="s">Svolta · verifica ${u.verifyDate ? fmtDate(u.verifyDate, 'dm') : '—'}</div>`}
    </div><span class="chev">›</span></a>`; };
  main.innerHTML = `
    <div class="page-h"><h1>UVM</h1><button class="btn primary small" data-new>+ Nuova</button></div>
    <p class="muted small intro">Unità di Valutazione Multidimensionale: prepara la riunione con la checklist, prendi appunti durante e, alla fine, l'app crea da sola la verifica e i compiti.</p>
    <section class="card"><h2>In programma</h2>${up.length ? up.map(row).join('') : '<p class="empty">Nessuna UVM in programma.</p>'}</section>
    ${past.length ? `<section class="card"><h2>Svolte</h2>${past.map(row).join('')}</section>` : ''}`;
  $('[data-new]', main).onclick = () => newUvm();
}

export function renderUvm(main, id) {
  const u = data.uvm.find((x) => x.id === id);
  if (!u) { main.innerHTML = '<p class="empty">UVM non trovata.</p>'; return; }
  const c = caseById(u.caseId);
  const n = u.checklist.filter((x) => x.done).length;
  const doneAll = n === u.checklist.length;
  const closed = u.status === 'svolta';

  main.innerHTML = `
    <div class="case-head">
      <a class="back" href="#/uvm">‹ UVM</a>
      <div class="ch-row"><h1>🧩 UVM ${c ? esc(c.code) : ''}</h1>${c ? `<a class="btn small" href="#/caso/${c.id}">Caso ›</a>` : ''}</div>
      <p><b>${fmtDate(u.date, 'full')}</b> ${esc(u.time || '')}${u.place ? ` · ${esc(u.place)}` : ''} <span class="muted">(${relDay(u.date)})</span></p>
      ${closed ? '<span class="badge ok">✔ Svolta</span>' : ''}
    </div>

    <section class="card">
      <div class="card-h"><h2>1 · Preparazione</h2><span class="${doneAll ? 'ok-txt' : 'muted'} small">${n}/${u.checklist.length}</span></div>
      <div class="progress big"><span style="width:${(n / (u.checklist.length || 1)) * 100}%"></span></div>
      <div class="checklist">${u.checklist.map((it, i) => `<label class="ck ${it.done ? 'on' : ''}"><input type="checkbox" data-ck="${i}" ${it.done ? 'checked' : ''}><span>${esc(it.text)}</span><button class="icon-btn small" data-rmck="${i}" aria-label="Rimuovi">✕</button></label>`).join('')}</div>
      <div class="add-inline"><input id="newck" placeholder="Aggiungi voce alla checklist…"><button class="btn small" data-addck>+</button></div>
    </section>

    <section class="card">
      <h2>Partecipanti</h2>
      <textarea id="participants" rows="2" placeholder="es. psichiatra CSM, educatore coop., MMG, familiare">${esc(u.participants || '')}</textarea>
    </section>

    <section class="card">
      <h2>2 · Durante la riunione</h2>
      <textarea id="notes" rows="6" placeholder="Appunti veloci (anche dettati col microfono della tastiera)…">${esc(u.notes || '')}</textarea>
      <h3>Decisioni prese</h3>
      <textarea id="decisions" rows="4" placeholder="Una decisione per riga, es.&#10;- Avvio tirocinio in coop. da novembre&#10;- Educatore 2 ore/settimana">${esc(u.decisions || '')}</textarea>
      <p class="hint">Si salva da solo mentre scrivi.</p>
    </section>

    <section class="card">
      <h2>3 · Chiusura</h2>
      ${closed ? `<p>UVM chiusa il ${fmtDate(u.closedAt || u.date)}. Verifica del progetto programmata: <b>${u.verifyDate ? fmtDate(u.verifyDate, 'full') : '—'}</b>.</p>
        ${u.verifyDate ? `<a class="btn" target="_blank" href="${gcalLink({ title: `🧩 Verifica progetto ${c?.code || ''}`, date: u.verifyDate, allDay: true })}">📅 Aggiungi verifica al calendario</a>` : ''}
        <button class="btn ghost" data-reopen>Riapri</button>`
      : `<p class="muted small">Alla chiusura: la UVM viene segnata come svolta, si crea la <b>scadenza di verifica</b>, i compiti dopo-riunione e una nota nel diario del caso.</p>
        <div class="row2"><label class="fld"><span>Verifica tra (mesi)</span><input type="number" id="vm" value="${u.verifyMonths || 6}" min="1" max="24" inputmode="numeric"></label>
        <label class="fld"><span>Data verifica</span><input type="date" id="vd" value="${addMonths(u.date, u.verifyMonths || 6)}"></label></div>
        <label class="check"><input type="checkbox" id="mktasks" checked> Crea compiti per ogni decisione</label>
        <button class="btn primary wide" data-close-uvm>✔ Concludi UVM</button>`}
    </section>
    <p class="center"><button class="link danger" data-del>Elimina UVM</button></p>`;

  const persist = () => { save(); };
  $$('[data-ck]', main).forEach((cb) => (cb.onchange = () => { u.checklist[cb.dataset.ck].done = cb.checked; persist(); renderUvm(main, id); }));
  $$('[data-rmck]', main).forEach((b) => (b.onclick = (e) => { e.preventDefault(); u.checklist.splice(Number(b.dataset.rmck), 1); persist(); renderUvm(main, id); }));
  const addCk = () => { const v = $('#newck', main).value.trim(); if (!v) return; u.checklist.push({ text: v, done: false }); persist(); renderUvm(main, id); };
  $('[data-addck]', main).onclick = addCk;
  $('#newck', main).onkeydown = (e) => { if (e.key === 'Enter') addCk(); };
  for (const k of ['participants', 'notes', 'decisions']) $('#' + k, main).oninput = (e) => { u[k] = e.target.value; persist(); };
  const vm = $('#vm', main), vd = $('#vd', main);
  if (vm) vm.oninput = () => { const m = Number(vm.value) || 6; vd.value = addMonths(u.date, m); };
  $('[data-close-uvm]', main)?.addEventListener('click', () => {
    u.status = 'svolta'; u.closedAt = today(); u.verifyMonths = Number(vm.value) || 6; u.verifyDate = vd.value || addMonths(u.date, u.verifyMonths);
    data.deadlines.push({ id: uid(), caseId: u.caseId, title: 'Verifica progetto (da UVM)', date: u.verifyDate, type: 'verifica', done: false, notes: '' });
    for (const t of UVM_AFTER) data.tasks.push({ id: uid(), caseId: u.caseId, text: t, done: false, createdAt: today() });
    if ($('#mktasks', main)?.checked) {
      (u.decisions || '').split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean).forEach((t) => data.tasks.push({ id: uid(), caseId: u.caseId, text: t, done: false, createdAt: today() }));
    }
    const ev = data.events.find((e) => e.id === u.eventId); if (ev) ev.done = true;
    data.log.push({ id: uid(), caseId: u.caseId, date: u.date, kind: 'uvm', text: `UVM svolta.${u.decisions ? ' Decisioni: ' + u.decisions.replace(/\n+/g, '; ') : ''}` });
    save(); toast('UVM conclusa: verifica e compiti creati'); rerender();
    sheet({
      title: 'Promemoria nel calendario?', body: `<p>Vuoi aggiungere la verifica del <b>${fmtDate(u.verifyDate, 'full')}</b> al calendario del telefono? Così ti arriva la notifica.</p>`,
      actions: `<button class="btn" data-close>No, grazie</button><a class="btn primary" target="_blank" data-close href="${gcalLink({ title: `🧩 Verifica progetto ${c?.code || ''}`, date: u.verifyDate, allDay: true })}">📅 Aggiungi</a>`,
    });
  });
  $('[data-reopen]', main)?.addEventListener('click', () => { u.status = 'preparazione'; save(); rerender(); });
  $('[data-del]', main).onclick = async () => {
    if (!(await confirmSheet('Eliminare questa UVM?'))) return;
    data.uvm = data.uvm.filter((x) => x !== u); save(); location.hash = '#/uvm';
  };
}
