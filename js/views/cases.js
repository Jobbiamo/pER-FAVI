import { data, save } from '../store.js';
import { $, $$, esc, today, diffDays, fmtDate, relDay, urgency } from '../util.js';
import { AREAS, AXES, LOG_KINDS } from '../model.js';
import { editCase, editLog, editDeadline, editTask, editEvent, newUvm, caseById } from '../forms.js';
import { lastContact, deadlineRow, taskRow, eventRow, bindRows } from './today.js';
import { rerender } from '../app.js';

let q = '', fArea = '', fStatus = 'aperti';

export function renderCases(main) {
  const T = today();
  const list = data.cases
    .filter((c) => (fStatus === 'aperti' ? c.status !== 'chiuso' : fStatus === 'chiusi' ? c.status === 'chiuso' : true))
    .filter((c) => !fArea || c.area === fArea)
    .filter((c) => !q || `${c.code} ${c.area} ${c.nextStep}`.toLowerCase().includes(q.toLowerCase()))
    .map((c) => {
      const next = data.deadlines.filter((d) => d.caseId === c.id && !d.done).sort((a, b) => a.date.localeCompare(b.date))[0];
      return { c, next, last: lastContact(c.id) };
    })
    .sort((a, b) => (a.next?.date || '9999').localeCompare(b.next?.date || '9999') || a.c.code.localeCompare(b.c.code));
  const areas = [...new Set(data.cases.map((c) => c.area))];

  main.innerHTML = `
    <div class="page-h"><h1>Casi</h1><button class="btn primary small" data-new>+ Nuovo</button></div>
    <div class="search"><input type="search" id="q" placeholder="Cerca iniziali, codice, area…" value="${esc(q)}"></div>
    <div class="filters">
      ${[['aperti', 'Aperti'], ['chiusi', 'Chiusi'], ['tutti', 'Tutti']].map(([k, l]) => `<button class="chip ${fStatus === k ? 'on' : ''}" data-st="${k}">${l}</button>`).join('')}
      <span class="sep"></span>
      <button class="chip ${!fArea ? 'on' : ''}" data-ar="">Tutte le aree</button>
      ${areas.map((a) => `<button class="chip ${fArea === a ? 'on' : ''}" data-ar="${esc(a)}">${esc(a)}</button>`).join('')}
    </div>
    <div class="case-list">
      ${list.length ? list.map(({ c, next, last }) => {
        const stale = c.status === 'attivo' && (!last || diffDays(last, T) >= data.settings.staleDays);
        return `<a class="case-card" href="#/caso/${c.id}">
          <div class="cc-top"><span class="case-code">${esc(c.code)}</span><span class="badge">${esc(c.area)}</span>${c.budget ? '<span class="badge bds">Budget di Salute</span>' : ''}${c.status !== 'attivo' ? `<span class="badge muted">${esc(c.status)}</span>` : ''}</div>
          ${c.nextStep ? `<div class="cc-next">➜ ${esc(c.nextStep)}</div>` : ''}
          <div class="cc-meta">
            ${next ? `<span class="u-${urgency(next.date)}">⏰ ${esc(next.title)} · ${relDay(next.date)}</span>` : '<span class="muted">nessuna scadenza</span>'}
            <span class="${stale ? 'stale' : 'muted'}">👤 ${last ? relDay(last) : 'mai'}</span>
          </div>
          <div class="axes-mini">${AXES.map(([k]) => `<i class="ax ax-${(c.axes?.[k]?.status || 'none').replace(' ', '-')}" title="${k}"></i>`).join('')}</div>
        </a>`;
      }).join('') : `<div class="empty-big"><p>Nessun caso ${q || fArea ? 'trovato' : 'ancora'}.</p><button class="btn primary" data-new2>+ Aggiungi il primo caso</button></div>`}
    </div>`;
  const qi = $('#q', main);
  qi.oninput = () => { q = qi.value; renderCases(main); const el = $('#q', main); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
  $$('[data-st]', main).forEach((b) => (b.onclick = () => { fStatus = b.dataset.st; renderCases(main); }));
  $$('[data-ar]', main).forEach((b) => (b.onclick = () => { fArea = b.dataset.ar; renderCases(main); }));
  $('[data-new]', main).onclick = () => editCase();
  $('[data-new2]', main)?.addEventListener('click', () => editCase());
  void AREAS;
}

export function renderCase(main, id) {
  const c = caseById(id);
  if (!c) { main.innerHTML = '<p class="empty">Caso non trovato.</p><p class="center"><a class="link" href="#/casi">Torna ai casi</a></p>'; return; }
  const T = today();
  const log = data.log.filter((l) => l.caseId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const dls = data.deadlines.filter((d) => d.caseId === c.id).sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
  const tasks = data.tasks.filter((t) => t.caseId === c.id && !t.done);
  const evs = data.events.filter((e) => e.caseId === c.id && e.date >= T).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const uvms = data.uvm.filter((u) => u.caseId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const last = lastContact(c.id);
  const kind = (k) => (LOG_KINDS.find((x) => x[0] === k) || ['', '📝'])[1];

  main.innerHTML = `
    <div class="case-head">
      <a class="back" href="#/casi">‹ Casi</a>
      <div class="ch-row"><h1>${esc(c.code)}</h1><button class="icon-btn" data-edit aria-label="Modifica">✏️</button></div>
      <div class="ch-badges"><span class="badge">${esc(c.area)}</span>${c.budget ? '<span class="badge bds">Budget di Salute</span>' : ''}<span class="badge muted">${esc(c.status)}</span></div>
      <p class="muted small">Ultimo contatto: <b>${last ? relDay(last) : 'nessuno'}</b></p>
      ${c.nextStep ? `<div class="next-step">➜ <b>Prossimo passo:</b> ${esc(c.nextStep)}</div>` : ''}
    </div>
    <div class="action-row">
      <button data-a="log">📝<span>Nota</span></button>
      <button data-a="ev">🗓️<span>Appunt.</span></button>
      <button data-a="dl">⏰<span>Scadenza</span></button>
      <button data-a="tk">✅<span>Da fare</span></button>
      <button data-a="uvm">🧩<span>UVM</span></button>
    </div>

    <section class="card">
      <h2>Progetto</h2>
      <div class="axes">${AXES.map(([k, l]) => { const a = c.axes?.[k] || {}; return `<div class="axis axs-${(a.status || 'none').replace(' ', '-')}"><b>${l}</b><span>${esc(a.status || 'non definito')}</span>${a.note ? `<small>${esc(a.note)}</small>` : ''}</div>`; }).join('')}</div>
    </section>

    ${evs.length || dls.length || tasks.length ? `<section class="card"><h2>In programma</h2>
      ${evs.map((e) => eventRow(e, { showDate: true })).join('')}
      ${dls.filter((d) => !d.done).map(deadlineRow).join('')}
      ${tasks.map(taskRow).join('')}
    </section>` : ''}

    <section class="card">
      <div class="card-h"><h2>Diario</h2><button class="link" data-a="log">+ Nota</button></div>
      ${log.length ? `<div class="timeline">${log.map((l) => `<div class="tl" data-log="${l.id}"><div class="tl-d">${fmtDate(l.date, 'dm')}<small>${new Date(l.date).getFullYear()}</small></div><div class="tl-b"><span class="tl-k">${kind(l.kind)}</span><p>${esc(l.text)}</p></div></div>`).join('')}</div>` : '<p class="empty">Nessuna nota. Registra colloqui, telefonate e visite per ricordare a che punto sei.</p>'}
    </section>

    ${uvms.length ? `<section class="card"><h2>UVM</h2>${uvms.map((u) => `<a class="item" href="#/uvm/${u.id}"><div class="grow"><div class="t">🧩 ${fmtDate(u.date, 'day')} ${esc(u.time || '')}</div><div class="s">${u.status === 'svolta' ? 'Svolta' : `Preparazione ${u.checklist.filter((x) => x.done).length}/${u.checklist.length}`}</div></div><span class="chev">›</span></a>`).join('')}</section>` : ''}

    ${(c.refs || []).length ? `<section class="card"><h2>Rete</h2>${c.refs.map((r) => `<div class="item"><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.role)}</div></div>${r.phone ? `<a class="btn small" href="tel:${esc(r.phone.replace(/\s/g, ''))}">📞</a>` : ''}</div>`).join('')}</section>` : ''}

    ${dls.some((d) => d.done) ? `<details class="card"><summary>Scadenze completate (${dls.filter((d) => d.done).length})</summary>${dls.filter((d) => d.done).map(deadlineRow).join('')}</details>` : ''}
    ${c.notes ? `<section class="card"><h2>Note</h2><p>${esc(c.notes)}</p></section>` : ''}
  `;
  bindRows(main);
  $('[data-edit]', main).onclick = () => editCase(c);
  $$('[data-a]', main).forEach((b) => (b.onclick = () => ({
    log: () => editLog(null, { caseId: c.id }), ev: () => editEvent(null, { caseId: c.id }), dl: () => editDeadline(null, { caseId: c.id }),
    tk: () => editTask(null, { caseId: c.id }), uvm: () => newUvm(null, { caseId: c.id }),
  })[b.dataset.a]()));
  $$('[data-log]', main).forEach((r) => (r.onclick = () => editLog(data.log.find((l) => l.id === r.dataset.log))));
  void save; void rerender;
}
