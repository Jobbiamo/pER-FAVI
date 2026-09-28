import { data } from '../store.js';
import { $, $$, esc, today, addDays, parseISO, toISO, fmtDate, dayShort } from '../util.js';
import { editEvent, editDeadline } from '../forms.js';
import { eventRow, deadlineRow, bindRows } from './today.js';

function monday(iso) { const d = parseISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); }

export function renderAgenda(main, dateParam) {
  const T = today();
  const sel = dateParam || T;
  const mon = monday(sel);
  const days = [...Array(7)].map((_, i) => addDays(mon, i));
  const count = (d) => data.events.filter((e) => e.date === d).length + data.deadlines.filter((x) => !x.done && x.date === d).length;
  const evs = data.events.filter((e) => e.date === sel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const dls = data.deadlines.filter((d) => d.date === sel);
  // settimana: lista compatta degli altri giorni
  const week = days.filter((d) => d !== sel).map((d) => ({ d, evs: data.events.filter((e) => e.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || '')) })).filter((x) => x.evs.length);

  main.innerHTML = `
    <div class="page-h"><h1>Agenda</h1><span class="muted">${fmtDate(mon, 'month')}</span></div>
    <div class="week-nav">
      <a class="icon-btn" href="#/agenda/${addDays(mon, -7)}" aria-label="Settimana precedente">‹</a>
      <div class="week">${days.map((d) => `<a href="#/agenda/${d}" class="day ${d === sel ? 'sel' : ''} ${d === T ? 'today' : ''}"><small>${dayShort(d)}</small><b>${parseISO(d).getDate()}</b>${count(d) ? `<i>${count(d)}</i>` : '<i class="empty-dot"></i>'}</a>`).join('')}</div>
      <a class="icon-btn" href="#/agenda/${addDays(mon, 7)}" aria-label="Settimana successiva">›</a>
    </div>
    ${sel !== T ? `<p class="center"><a class="link" href="#/agenda/${T}">Torna a oggi</a></p>` : ''}
    <section class="card">
      <div class="card-h"><h2>${fmtDate(sel, 'long')}</h2><button class="link" data-add>+ Appuntamento</button></div>
      ${dls.length ? `<div class="sub-h">Scadenze</div>${dls.map(deadlineRow).join('')}` : ''}
      ${evs.length ? evs.map((e) => eventRow(e)).join('') : '<p class="empty">Nessun appuntamento.</p>'}
    </section>
    ${week.length ? `<section class="card"><h2>Resto della settimana</h2>${week.map((w) => `<div class="sub-h">${fmtDate(w.d, 'long')}</div>${w.evs.map((e) => eventRow(e)).join('')}`).join('')}</section>` : ''}
    <section class="card">
      <div class="card-h"><h2>Prossime scadenze</h2><button class="link" data-add-dl>+ Scadenza</button></div>
      ${(() => { const up = data.deadlines.filter((d) => !d.done && d.date >= T).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15); return up.length ? up.map(deadlineRow).join('') : '<p class="empty">Nessuna scadenza.</p>'; })()}
    </section>`;
  bindRows(main);
  $('[data-add]', main).onclick = () => editEvent(null, { date: sel });
  $('[data-add-dl]', main).onclick = () => editDeadline();
  // scorrimento a sinistra/destra per cambiare settimana
  let x0 = null;
  const wk = $('.week', main);
  wk.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  wk.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) location.hash = '#/agenda/' + addDays(sel, dx < 0 ? 7 : -7); x0 = null; });
  void $$; void esc;
}
