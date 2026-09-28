// ============================================================
//  Agenda Sociale – avvio, blocco con PIN, navigazione
// ============================================================
import { hasVault, createVault, unlock, lock, isUnlocked, data, saveNow, wipe, importBackup } from './store.js';
import { $, $$, esc, sheet, closeAllSheets, toast, confirmSheet } from './util.js';
import { emptyData, demoData } from './model.js';
import { quickAdd } from './forms.js';
import { renderToday } from './views/today.js';
import { renderAgenda } from './views/agenda.js';
import { renderCases, renderCase } from './views/cases.js';
import { renderUvmList, renderUvm } from './views/uvm.js';
import { renderMore, renderContacts, renderKm, renderTraining, renderChecklists, renderLoad, renderSettings } from './views/more.js';

const main = () => $('#main');
const ROUTES = {
  oggi: () => renderToday(main()),
  agenda: (a) => renderAgenda(main(), a[0]),
  casi: () => renderCases(main()),
  caso: (a) => renderCase(main(), a[0]),
  uvm: (a) => (a[0] ? renderUvm(main(), a[0]) : renderUvmList(main())),
  altro: () => renderMore(main()),
  rubrica: () => renderContacts(main()),
  km: () => renderKm(main()),
  formazione: () => renderTraining(main()),
  checklist: () => renderChecklists(main()),
  carico: () => renderLoad(main()),
  impostazioni: () => renderSettings(main()),
};
const TAB_OF = { caso: 'casi', rubrica: 'altro', km: 'altro', formazione: 'altro', checklist: 'altro', carico: 'altro', impostazioni: 'altro' };

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, ...args] = h.split('/').map(decodeURIComponent);
  return { name: ROUTES[name] ? name : 'oggi', args };
}

let lastRoute = '';
export function rerender() {
  if (!isUnlocked()) return;
  const { name, args } = route();
  const same = lastRoute === location.hash;
  const y = window.scrollY;
  lastRoute = location.hash;
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === (TAB_OF[name] || name)));
  ROUTES[name](args);
  window.scrollTo(0, same ? y : 0);
}

// ---------------- Tastierino PIN ----------------
function pinPad(title, sub = '') {
  return `<div class="pin-wrap"><div class="pin-logo"><img src="icons/icon-192.png" alt=""></div>
    <h2>${esc(title)}</h2>${sub ? `<p class="pin-sub">${sub}</p>` : ''}
    <div class="pin-dots"></div><p class="pin-err"></p>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}<button data-del aria-label="Cancella">⌫</button><button data-n="0">0</button><button data-ok aria-label="Conferma">OK</button></div></div>`;
}
/** Collega un tastierino; onDone(pin) → true per chiudere */
function bindPad(root, onDone, { min = 4, max = 8 } = {}) {
  let pin = '';
  const dots = $('.pin-dots', root), err = $('.pin-err', root);
  const draw = () => { dots.innerHTML = [...Array(Math.max(min, pin.length))].map((_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
  const submit = async () => {
    if (pin.length < min) { err.textContent = `Almeno ${min} cifre`; return; }
    const p = pin; pin = ''; draw();
    const r = await onDone(p);
    if (r === false) { root.classList.add('shake'); setTimeout(() => root.classList.remove('shake'), 400); }
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    err.textContent = '';
    if (b.dataset.n && pin.length < max) pin += b.dataset.n;
    if (b.hasAttribute('data-del')) pin = pin.slice(0, -1);
    if (b.hasAttribute('data-ok')) return submit();
    draw();
  });
  root.tabIndex = 0;
  root.addEventListener('keydown', (e) => {
    if (/^\d$/.test(e.key) && pin.length < max) { pin += e.key; draw(); }
    else if (e.key === 'Backspace') { pin = pin.slice(0, -1); draw(); }
    else if (e.key === 'Enter') submit();
  });
  draw();
  setTimeout(() => root.focus(), 50);
  return { error: (m) => { err.textContent = m; } };
}

/** Chiede un PIN in una finestra (per cambio PIN / ripristino) */
export function askPin(title) {
  return new Promise((resolve) => {
    let val = null;
    sheet({
      title, body: pinPad(title), full: true,
      onMount: (s, close) => { $('.pin-wrap h2', s).remove(); $('.pin-logo', s).remove(); bindPad($('.pin-wrap', s), (p) => { val = p; close(); return true; }); },
      onClose: () => resolve(val),
    });
  });
}

// ---------------- Schermate di avvio ----------------
const screen = () => $('#screen');
function showScreen(html) { $('#app').hidden = true; const s = screen(); s.hidden = false; s.innerHTML = html; return s; }
function hideScreen() { screen().hidden = true; screen().innerHTML = ''; $('#app').hidden = false; }

let fails = 0, waitUntil = 0;
function showLock() {
  closeAllSheets();
  const s = showScreen(`${pinPad('Agenda Sociale', 'Inserisci il PIN')}<button class="link forgot" data-forgot>Ho dimenticato il PIN</button>`);
  const pad = bindPad($('.pin-wrap', s), async (p) => {
    if (Date.now() < waitUntil) { pad.error(`Riprova tra ${Math.ceil((waitUntil - Date.now()) / 1000)} secondi`); return false; }
    $('.pin-sub', s).textContent = 'Apertura…';
    const ok = await unlock(p);
    $('.pin-sub', s).textContent = 'Inserisci il PIN';
    if (!ok) { fails++; if (fails >= 5) waitUntil = Date.now() + 30000 * (fails - 4); pad.error('PIN errato'); return false; }
    fails = 0; hideScreen(); startSession(); return true;
  });
  $('[data-forgot]', s).onclick = () => sheet({
    title: 'PIN dimenticato',
    body: `<p>Per proteggere i dati, sono <b>cifrati con il PIN</b>: senza PIN nessuno può leggerli, nemmeno noi.</p>
      <p>Puoi <b>ripristinare un backup</b> (ti servirà il PIN di quando lo hai creato) oppure <b>cancellare tutto</b> e ripartire.</p>`,
    actions: '<label class="btn file-btn">📥 Ripristina backup<input type="file" id="rf" accept=".json" hidden></label><button class="btn danger" data-wipe>Cancella tutto</button>',
    onMount: (sh, close) => {
      $('[data-wipe]', sh).onclick = async () => { if (await confirmSheet('Cancellare definitivamente tutti i dati?', 'Cancella tutto')) { await wipe(); close(); location.reload(); } };
      $('#rf', sh).onchange = async (e) => {
        try {
          const blob = JSON.parse(await e.target.files[0].text());
          const pin = await askPin('PIN del backup'); if (!pin) return;
          await importBackup(blob, pin); close(); hideScreen(); startSession(); toast('Backup ripristinato');
        } catch (err) { toast(err.message || 'File non valido', 'err'); }
      };
    },
  });
}

function showSetup() {
  const s = showScreen(`<div class="welcome">
    <img src="icons/icon-192.png" class="w-logo" alt="">
    <h1>Agenda Sociale</h1>
    <p class="w-sub">Appuntamenti, scadenze, UVM e casi — tutto in un posto, solo sul tuo telefono.</p>
    <ul class="w-points"><li>🔒 Dati <b>cifrati</b> e protetti da PIN</li><li>📵 Niente cloud: restano <b>solo su questo telefono</b></li><li>👤 Casi indicati solo con <b>iniziali o codici</b></li><li>📅 Promemoria nel calendario del telefono</li></ul>
    <button class="btn primary wide" data-start>Inizia</button>
    <label class="link center file-link">Ho già un backup<input type="file" id="rf" accept=".json" hidden></label></div>`);
  $('#rf', s).onchange = async (e) => {
    try {
      const blob = JSON.parse(await e.target.files[0].text());
      const pin = await askPin('PIN del backup'); if (!pin) return;
      await importBackup(blob, pin); hideScreen(); startSession(); toast('Backup ripristinato');
    } catch (err) { toast(err.message || 'File non valido', 'err'); }
  };
  $('[data-start]', s).onclick = () => {
    let first = null;
    const s2 = showScreen(pinPad('Scegli un PIN', 'Da 4 a 8 cifre. Ti servirà ogni volta che apri l\'app.'));
    const pad = bindPad($('.pin-wrap', s2), async (p) => {
      if (!first) { first = p; $('h2', s2).textContent = 'Ripeti il PIN'; $('.pin-sub', s2).textContent = 'Per sicurezza, inseriscilo di nuovo.'; return true; }
      if (p !== first) { first = null; $('h2', s2).textContent = 'Scegli un PIN'; pad.error('I PIN non coincidono, riprova'); return false; }
      const s3 = showScreen(`<div class="welcome"><h1>Come vuoi iniziare?</h1>
        <button class="choice" data-demo><b>🧪 Con qualche esempio</b><span>Casi, appuntamenti e una UVM di prova per vedere come funziona. Si cancellano con un tocco.</span></button>
        <button class="choice" data-empty><b>📄 Vuota</b><span>Parti subito con i tuoi dati.</span></button>
        <p class="muted small center">⚠️ Se dimentichi il PIN i dati non si possono recuperare: fai ogni tanto un backup (Altro → Impostazioni).</p></div>`);
      const go = async (d) => { await createVault(p, d); hideScreen(); startSession(); };
      $('[data-demo]', s3).onclick = () => go(demoData());
      $('[data-empty]', s3).onclick = () => go(emptyData());
      return true;
    });
  };
}

// ---------------- Sessione e blocco automatico ----------------
let lastActivity = Date.now(), hiddenAt = null, timer = null;
export function lockNow() { saveNow().finally(() => { lock(); showLock(); }); }
function startSession() {
  lastActivity = Date.now();
  // migrazione leggera
  for (const k of Object.keys(emptyData())) if (data[k] === undefined) data[k] = emptyData()[k];
  for (const k of Object.keys(emptyData().settings)) if (data.settings[k] === undefined) data.settings[k] = emptyData().settings[k];
  if (!location.hash) location.hash = '#/oggi';
  rerender();
  clearInterval(timer);
  timer = setInterval(() => { if (isUnlocked() && Date.now() - lastActivity > data.settings.autolock * 60000) lockNow(); }, 15000);
}
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); if (isUnlocked()) saveNow(); }
  else if (hiddenAt && isUnlocked() && Date.now() - hiddenAt > data.settings.autolock * 60000) lockNow();
});
window.addEventListener('hashchange', () => { closeAllSheets(); rerender(); });

// ---------------- Avvio ----------------
async function boot() {
  $('#fab').onclick = () => quickAdd();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (await hasVault()) showLock(); else showSetup();
}
boot();
