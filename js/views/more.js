import { data, save, exportBackup, importBackup, changePin, wipe, saveNow } from '../store.js';
import { $, $$, esc, uid, today, fmtDate, fmtNum, fmtEuro, toast, sheet, confirmSheet, num, parseISO, diffDays, toISO } from '../util.js';
import { AXES } from '../model.js';
import { editContact, editKm, editTraining, caseLabel } from '../forms.js';
import { rerender, lockNow, askPin } from '../app.js';

export function renderMore(main) {
  const credits = data.training.filter((t) => inTriennium(t.date)).reduce((s, t) => s + (t.credits || 0), 0);
  const monthKm = data.km.filter((k) => k.date.slice(0, 7) === today().slice(0, 7)).reduce((s, k) => s + (k.km || 0), 0);
  const item = (href, ico, t, s) => `<a class="menu-item" href="${href}"><span class="mi-ico">${ico}</span><div class="grow"><b>${t}</b><small>${s}</small></div><span class="chev">›</span></a>`;
  main.innerHTML = `
    <div class="page-h"><h1>Altro</h1></div>
    <div class="menu">
      ${item('#/rubrica', '📇', 'Rubrica della rete', `${data.contacts.length} contatti · CSM, SerDP, coop…`)}
      ${item('#/km', '🚗', 'Chilometri', `${fmtNum(monthKm)} km questo mese`)}
      ${item('#/formazione', '🎓', 'Crediti formativi', `${fmtNum(credits)} / ${data.settings.credits} nel triennio`)}
      ${item('#/checklist', '☑️', 'Checklist', 'visita domiciliare, relazione, primo colloquio…')}
      ${item('#/carico', '📊', 'Carico di lavoro', 'casi per area, scadenze, attività')}
      ${item('#/impostazioni', '⚙️', 'Impostazioni e backup', 'PIN, blocco automatico, copia di sicurezza')}
    </div>
    <button class="btn wide lock-btn" data-lock>🔒 Blocca ora</button>
    <p class="muted small center">I dati sono cifrati e salvati solo su questo telefono.</p>`;
  $('[data-lock]', main).onclick = lockNow;
}

// ---------------- Rubrica ----------------
let rq = '';
export function renderContacts(main) {
  const list = data.contacts.filter((c) => !rq || `${c.name} ${c.org} ${c.role} ${c.notes}`.toLowerCase().includes(rq.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  main.innerHTML = `
    <div class="page-h"><a class="back" href="#/altro">‹</a><h1>Rubrica</h1><button class="btn primary small" data-new>+ Nuovo</button></div>
    <div class="search"><input type="search" id="rq" placeholder="Cerca servizio, persona, ruolo…" value="${esc(rq)}"></div>
    <section class="card">${list.length ? list.map((c) => `<div class="item contact" data-id="${c.id}"><div class="avatar">${esc((c.name[0] || '?').toUpperCase())}</div>
      <div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc([c.role, c.org].filter(Boolean).join(' · '))}</div>${c.notes ? `<div class="s">${esc(c.notes)}</div>` : ''}</div>
      ${c.phone ? `<a class="round-btn" href="tel:${esc(c.phone.replace(/\s/g, ''))}" aria-label="Chiama">📞</a>` : ''}${c.email ? `<a class="round-btn" href="mailto:${esc(c.email)}" aria-label="Email">✉️</a>` : ''}</div>`).join('') : '<p class="empty">Aggiungi i numeri che usi di più: CSM, SerDP, medici, cooperative, comunità, tribunale.</p>'}</section>`;
  const i = $('#rq', main); i.oninput = () => { rq = i.value; renderContacts(main); const e = $('#rq', main); e.focus(); e.setSelectionRange(e.value.length, e.value.length); };
  $('[data-new]', main).onclick = () => editContact();
  $$('.contact', main).forEach((r) => (r.onclick = (e) => { if (e.target.closest('a')) return; editContact(data.contacts.find((c) => c.id === r.dataset.id)); }));
}

// ---------------- Chilometri ----------------
let kmMonth = null;
export function renderKm(main) {
  kmMonth = kmMonth || today().slice(0, 7);
  const months = [...new Set([today().slice(0, 7), ...data.km.map((k) => k.date.slice(0, 7))])].sort().reverse();
  const list = data.km.filter((k) => k.date.startsWith(kmMonth)).sort((a, b) => b.date.localeCompare(a.date));
  const tot = list.reduce((s, k) => s + (k.km || 0), 0);
  const rate = data.settings.kmRate || 0;
  main.innerHTML = `
    <div class="page-h"><a class="back" href="#/altro">‹</a><h1>Chilometri</h1><button class="btn primary small" data-new>+ Viaggio</button></div>
    <div class="filters">${months.map((m) => `<button class="chip ${m === kmMonth ? 'on' : ''}" data-m="${m}">${fmtDate(m + '-01', 'month')}</button>`).join('')}</div>
    <section class="card km-sum"><div><b>${fmtNum(tot)}</b><span>km</span></div><div><b>${list.length}</b><span>viaggi</span></div><div><b>${fmtEuro(tot * rate)}</b><span>a ${fmtNum(rate, 2)} €/km</span></div></section>
    <section class="card">${list.length ? list.map((k) => `<div class="item" data-id="${k.id}"><div class="grow"><div class="t">${esc(k.from)} → ${esc(k.to)}</div><div class="s">${fmtDate(k.date, 'day')}${k.caseId ? ' · ' + esc(caseLabel(k.caseId)) : ''}${k.note ? ' · ' + esc(k.note) : ''}</div></div><b>${fmtNum(k.km)} km</b></div>`).join('') : '<p class="empty">Nessun viaggio in questo mese.</p>'}</section>
    ${list.length ? '<button class="btn wide" data-share>📤 Condividi riepilogo del mese</button>' : ''}
    <p class="muted small center">Tariffa €/km modificabile in Impostazioni (dipende dal tuo ente).</p>`;
  $$('[data-m]', main).forEach((b) => (b.onclick = () => { kmMonth = b.dataset.m; renderKm(main); }));
  $('[data-new]', main).onclick = () => editKm();
  $$('[data-id]', main).forEach((r) => (r.onclick = () => editKm(data.km.find((k) => k.id === r.dataset.id))));
  $('[data-share]', main)?.addEventListener('click', async () => {
    const txt = `Riepilogo chilometri – ${fmtDate(kmMonth + '-01', 'month')}\n\n` + [...list].reverse().map((k) => `${fmtDate(k.date)}  ${k.from} → ${k.to}  ${fmtNum(k.km)} km${k.note ? ' (' + k.note + ')' : ''}`).join('\n') + `\n\nTotale: ${fmtNum(tot)} km${rate ? ` – ${fmtEuro(tot * rate)}` : ''}`;
    try { if (navigator.share) await navigator.share({ title: 'Riepilogo km', text: txt }); else { await navigator.clipboard.writeText(txt); toast('Copiato negli appunti'); } } catch { /* annullato */ }
  });
}

// ---------------- Crediti formativi ----------------
function inTriennium(date) { const y = Number(date.slice(0, 4)); const s = data.settings.trienniumStart; return y >= s && y <= s + 2; }
export function renderTraining(main) {
  const s = data.settings;
  const list = data.training.filter((t) => inTriennium(t.date)).sort((a, b) => b.date.localeCompare(a.date));
  const tot = list.reduce((a, t) => a + (t.credits || 0), 0);
  const deo = list.filter((t) => t.deont).reduce((a, t) => a + (t.credits || 0), 0);
  const end = `${s.trienniumStart + 2}-12-31`;
  const left = diffDays(today(), end);
  const bar = (v, max, cls = '') => `<div class="progress big ${cls}"><span style="width:${Math.min(100, (v / max) * 100)}%"></span></div>`;
  main.innerHTML = `
    <div class="page-h"><a class="back" href="#/altro">‹</a><h1>Formazione</h1><button class="btn primary small" data-new>+ Corso</button></div>
    <section class="card">
      <h2>Triennio ${s.trienniumStart}–${s.trienniumStart + 2}</h2>
      <p><b>${fmtNum(tot)}</b> / ${s.credits} crediti totali</p>${bar(tot, s.credits)}
      <p class="mt"><b>${fmtNum(deo)}</b> / ${s.deont} crediti deontologici</p>${bar(deo, s.deont, 'violet')}
      <p class="muted small mt">${tot >= s.credits && deo >= s.deont ? '✔ Obbligo formativo raggiunto!' : `Mancano ${fmtNum(Math.max(0, s.credits - tot))} crediti (di cui ${fmtNum(Math.max(0, s.deont - deo))} deontologici). ${left > 0 ? `Tempo: ${Math.round(left / 30)} mesi.` : ''}`}</p>
      <p class="muted small">I crediti deontologici in più valgono anche come generici, non il contrario. Verifica sempre sulla piattaforma dell'Ordine.</p>
    </section>
    <section class="card">${list.length ? list.map((t) => `<div class="item" data-id="${t.id}"><div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${fmtDate(t.date)}${t.provider ? ' · ' + esc(t.provider) : ''}${t.deont ? ' · <b class="violet-txt">deontologico</b>' : ''}</div></div><b>${fmtNum(t.credits)}</b></div>`).join('') : '<p class="empty">Registra i corsi man mano: così sai sempre quanti crediti ti mancano.</p>'}</section>`;
  $('[data-new]', main).onclick = () => editTraining();
  $$('[data-id]', main).forEach((r) => (r.onclick = () => editTraining(data.training.find((t) => t.id === r.dataset.id))));
}

// ---------------- Checklist ----------------
export function renderChecklists(main) {
  const cl = data.settings.checklists;
  main.innerHTML = `
    <div class="page-h"><a class="back" href="#/altro">‹</a><h1>Checklist</h1><button class="btn primary small" data-new>+ Nuova</button></div>
    <p class="muted small intro">Promemoria da spuntare quando prepari un'attività. Tocca una checklist per usarla o modificarla.</p>
    <section class="card">${Object.keys(cl).map((k) => `<button class="item wide-btn" data-k="${esc(k)}"><div class="grow"><div class="t">☑️ ${esc(k)}</div><div class="s">${cl[k].length} voci</div></div><span class="chev">›</span></button>`).join('')}
      <button class="item wide-btn" data-uvm><div class="grow"><div class="t">🧩 Preparazione UVM (modello)</div><div class="s">${data.settings.uvmChecklist.length} voci · usata per ogni nuova UVM</div></div><span class="chev">›</span></button></section>`;
  const open = (title, items, onSave, onDelete) => {
    const state = items.map((t) => ({ t, on: false }));
    sheet({
      title, full: true,
      body: `<div class="checklist" id="cl">${state.map((x, i) => `<label class="ck"><input type="checkbox" data-i="${i}"><span>${esc(x.t)}</span></label>`).join('')}</div>
        <details class="mt"><summary>Modifica le voci</summary><textarea id="edit" rows="8">${esc(items.join('\n'))}</textarea><p class="hint">Una voce per riga.</p></details>`,
      actions: `${onDelete ? '<button class="btn danger ghost" data-del>Elimina</button>' : ''}<button class="btn" data-reset>Azzera spunte</button><button class="btn primary" data-save>Salva modifiche</button>`,
      onMount: (s, close) => {
        $$('[data-i]', s).forEach((c) => (c.onchange = () => c.parentElement.classList.toggle('on', c.checked)));
        $('[data-reset]', s).onclick = () => $$('[data-i]', s).forEach((c) => { c.checked = false; c.parentElement.classList.remove('on'); });
        $('[data-save]', s).onclick = () => { onSave($('#edit', s).value.split('\n').map((x) => x.trim()).filter(Boolean)); save(); close(); rerender(); toast('Checklist salvata'); };
        $('[data-del]', s)?.addEventListener('click', async () => { if (await confirmSheet('Eliminare la checklist?')) { onDelete(); save(); close(); rerender(); } });
      },
    });
  };
  $$('[data-k]', main).forEach((b) => (b.onclick = () => open(b.dataset.k, cl[b.dataset.k], (v) => { cl[b.dataset.k] = v; }, () => { delete cl[b.dataset.k]; })));
  $('[data-uvm]', main).onclick = () => open('Preparazione UVM (modello)', data.settings.uvmChecklist, (v) => { data.settings.uvmChecklist = v; });
  $('[data-new]', main).onclick = () => sheet({
    title: 'Nuova checklist', body: '<label class="fld"><span>Nome</span><input id="n" placeholder="es. Inserimento in struttura"></label><label class="fld"><span>Voci (una per riga)</span><textarea id="v" rows="6"></textarea></label>',
    actions: '<button class="btn primary" data-ok>Crea</button>',
    onMount: (s, close) => { $('[data-ok]', s).onclick = () => { const n = $('#n', s).value.trim(); if (!n) return; cl[n] = $('#v', s).value.split('\n').map((x) => x.trim()).filter(Boolean); save(); close(); rerender(); }; },
  });
}

// ---------------- Carico di lavoro ----------------
export function renderLoad(main) {
  const T = today();
  const active = data.cases.filter((c) => c.status !== 'chiuso');
  const byArea = {}; for (const c of active) byArea[c.area] = (byArea[c.area] || 0) + 1;
  const maxA = Math.max(1, ...Object.values(byArea));
  const weeks = [...Array(8)].map((_, i) => { const s = new Date(); s.setDate(s.getDate() - ((s.getDay() + 6) % 7) + i * 7); return toISO(s); });
  const wk = weeks.map((w) => { const end = new Date(parseISO(w)); end.setDate(end.getDate() + 6); const e = toISO(end); return { w, n: data.deadlines.filter((d) => !d.done && d.date >= w && d.date <= e).length + data.events.filter((x) => x.date >= w && x.date <= e).length }; });
  const maxW = Math.max(1, ...wk.map((x) => x.n));
  const last30 = data.log.filter((l) => diffDays(l.date, T) <= 30);
  const kinds = {}; for (const l of last30) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
  const bds = active.filter((c) => c.budget).length;
  const axesCrit = active.filter((c) => AXES.some(([k]) => c.axes?.[k]?.status === 'critico')).length;
  main.innerHTML = `
    <div class="page-h"><a class="back" href="#/altro">‹</a><h1>Carico di lavoro</h1></div>
    <div class="stats"><div><b>${active.length}</b><span>casi aperti</span></div><div><b>${bds}</b><span>con Budget di Salute</span></div><div><b>${axesCrit}</b><span>con un asse critico</span></div><div><b>${last30.length}</b><span>attività in 30 gg</span></div></div>
    <section class="card"><h2>Casi per area</h2>${Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><i><em style="width:${(v / maxA) * 100}%"></em></i><b>${v}</b></div>`).join('') || '<p class="empty">Nessun caso.</p>'}</section>
    <section class="card"><h2>Impegni nelle prossime 8 settimane</h2><p class="muted small">appuntamenti + scadenze</p>
      <div class="vbars">${wk.map((x) => `<div><i style="height:${(x.n / maxW) * 100}%" class="${x.n >= maxW * 0.8 && x.n > 3 ? 'hot' : ''}"></i><b>${x.n}</b><small>${fmtDate(x.w, 'dm')}</small></div>`).join('')}</div></section>
    <section class="card"><h2>Attività ultimi 30 giorni</h2>${Object.entries(kinds).map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><i><em style="width:${(v / Math.max(1, ...Object.values(kinds))) * 100}%"></em></i><b>${v}</b></div>`).join('') || '<p class="empty">Registra le attività nel diario dei casi.</p>'}</section>
    <p class="muted small center">Utile anche da mostrare in supervisione o alla coordinatrice.</p>`;
  void uid;
}

// ---------------- Impostazioni ----------------
export function renderSettings(main) {
  const s = data.settings;
  main.innerHTML = `
    <div class="page-h"><a class="back" href="#/altro">‹</a><h1>Impostazioni</h1></div>
    <section class="card"><h2>Generale</h2>
      <label class="fld"><span>Il tuo nome (per il saluto)</span><input id="s-name" value="${esc(s.name || '')}"></label>
      <div class="row2"><label class="fld"><span>Blocco automatico (minuti)</span><input id="s-lock" type="number" inputmode="numeric" value="${s.autolock}"></label>
      <label class="fld"><span>"Da ricontattare" dopo (giorni)</span><input id="s-stale" type="number" inputmode="numeric" value="${s.staleDays}"></label></div>
      <div class="row2"><label class="fld"><span>Rimborso €/km</span><input id="s-rate" inputmode="decimal" value="${String(s.kmRate).replace('.', ',')}"></label>
      <label class="fld"><span>Inizio triennio formativo</span><input id="s-tri" type="number" inputmode="numeric" value="${s.trienniumStart}"></label></div>
      <button class="btn primary wide" data-save>Salva</button>
    </section>
    <section class="card"><h2>🔒 Sicurezza</h2>
      <p class="small">I dati sono cifrati (AES-256) con il tuo PIN e restano solo su questo telefono. <b>Se dimentichi il PIN non si possono recuperare</b>: tieni un backup.</p>
      <button class="btn wide" data-pin>Cambia PIN</button>
    </section>
    <section class="card"><h2>💾 Copia di sicurezza</h2>
      <p class="small">Il file di backup è <b>cifrato con il tuo PIN</b>: puoi salvarlo su Google Drive, inviarlo a te stessa o copiarlo sul PC senza rischi. Consigliato una volta a settimana.</p>
      <p class="small muted">Ultimo backup: <b>${s.lastBackup ? fmtDate(s.lastBackup) : 'mai'}</b></p>
      <button class="btn primary wide" data-backup>📤 Crea backup</button>
      <label class="btn wide file-btn">📥 Ripristina da backup<input type="file" id="restore" accept=".json,application/json" hidden></label>
    </section>
    ${data.demo || data.cases.some((c) => c.demo) ? '<section class="card"><h2>Dati di esempio</h2><p class="small">Stai vedendo casi di prova.</p><button class="btn wide" data-demo>Cancella i dati di esempio</button></section>' : ''}
    <section class="card danger-zone"><h2>Zona pericolosa</h2><button class="btn danger wide" data-wipe>Cancella tutti i dati</button></section>
    <section class="card"><h2>ℹ️ Privacy e buone pratiche</h2><ul class="small">
      <li>Usa solo iniziali o codici, mai nomi completi, diagnosi o indirizzi.</li>
      <li>La documentazione ufficiale resta nella cartella sociale del servizio.</li>
      <li>Blocca il telefono con PIN/impronta e attiva il blocco automatico dell'app.</li>
      <li>Verifica con il tuo ente eventuali regole sull'uso di strumenti personali.</li>
    </ul><p class="muted small">Agenda Sociale · versione 1.0</p></section>`;
  $('[data-save]', main).onclick = () => {
    s.name = $('#s-name', main).value.trim();
    s.autolock = Math.max(1, Number($('#s-lock', main).value) || 3);
    s.staleDays = Math.max(7, Number($('#s-stale', main).value) || 30);
    s.kmRate = num($('#s-rate', main).value) ?? s.kmRate;
    s.trienniumStart = Number($('#s-tri', main).value) || s.trienniumStart;
    save(); toast('Impostazioni salvate');
  };
  $('[data-pin]', main).onclick = async () => {
    const oldPin = await askPin('PIN attuale'); if (!oldPin) return;
    const p1 = await askPin('Nuovo PIN (4–8 cifre)'); if (!p1) return;
    const p2 = await askPin('Ripeti il nuovo PIN'); if (p1 !== p2) return toast('I PIN non coincidono', 'err');
    toast(await changePin(oldPin, p1) ? 'PIN cambiato' : 'PIN attuale errato', 'ok');
  };
  $('[data-backup]', main).onclick = async () => {
    s.lastBackup = today(); await saveNow();
    const blob = await exportBackup();
    const name = `agenda-sociale-backup-${today()}.json`;
    const file = new File([JSON.stringify(blob)], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Backup Agenda Sociale' }); toast('Backup pronto'); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
    toast('Backup salvato in Download'); rerender();
  };
  $('#restore', main).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const blob = JSON.parse(await f.text());
      if (!(await confirmSheet('Ripristinare il backup? I dati attuali sul telefono verranno sostituiti.', 'Ripristina'))) return;
      const pin = await askPin('PIN usato quando hai creato il backup'); if (!pin) return;
      await importBackup(blob, pin); toast('Backup ripristinato'); location.hash = '#/oggi'; rerender();
    } catch (err) { toast(err.message || 'File non valido', 'err'); }
  };
  $('[data-demo]', main)?.addEventListener('click', async () => {
    if (!(await confirmSheet('Cancellare tutti i dati di esempio? Restano solo quelli inseriti da te.'))) return;
    for (const k of ['cases', 'events', 'deadlines', 'tasks', 'log', 'uvm', 'contacts', 'km', 'training']) data[k] = data[k].filter((x) => !x.demo);
    delete data.demo;
    save(); toast('Dati di esempio cancellati'); rerender();
  });
  $('[data-wipe]', main).onclick = async () => {
    if (!(await confirmSheet('Cancellare TUTTI i dati da questo telefono? Senza un backup non si potranno recuperare.', 'Cancella tutto'))) return;
    await wipe(); location.hash = ''; location.reload();
  };
  void lockNow;
}
