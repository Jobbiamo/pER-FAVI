// Dati di base e liste modificabili
import { uid, today, addDays, addMonths } from './util.js';

export const AREAS = ['Salute mentale', 'Dipendenze', 'Disabilità', 'Adulti fragili', 'Grave emarginazione', 'Anziani', 'Famiglia/minori', 'Altro'];
export const CASE_STATUS = [['attivo', 'Attivo'], ['monitoraggio', 'Monitoraggio'], ['sospeso', 'Sospeso'], ['chiuso', 'Chiuso']];
export const EVENT_TYPES = [
  ['colloquio', 'Colloquio', '💬'], ['visita', 'Visita domiciliare', '🏠'], ['uvm', 'UVM', '🧩'], ['equipe', 'Équipe / CSM', '👥'],
  ['telefonata', 'Telefonata', '📞'], ['udienza', 'Udienza / tribunale', '⚖️'], ['riunione', 'Riunione', '🗓️'], ['formazione', 'Formazione', '🎓'], ['altro', 'Altro', '📌'],
];
export const evType = (k) => EVENT_TYPES.find((t) => t[0] === k) || EVENT_TYPES.at(-1);
export const LOG_KINDS = [['colloquio', '💬 Colloquio'], ['visita', '🏠 Visita'], ['telefonata', '📞 Telefonata'], ['email', '✉️ Email'], ['equipe', '👥 Équipe'], ['uvm', '🧩 UVM'], ['nota', '📝 Nota']];
export const AXES = [['casa', '🏠 Casa / abitare'], ['lavoro', '💼 Lavoro / formazione'], ['socialita', '🤝 Socialità / relazioni']];
export const AXIS_STATUS = [['', '—'], ['da avviare', 'Da avviare'], ['in corso', 'In corso'], ['raggiunto', 'Raggiunto'], ['critico', 'Critico']];
export const ROLES = ['Psichiatra CSM', 'Infermiere/case manager CSM', 'Psicologo', 'Educatore', 'Medico di base', 'SerDP', 'Cooperativa', 'Amministratore di sostegno', 'Familiare di riferimento', 'Avvocato', 'Tribunale / giudice tutelare', 'Centro per l\'impiego', 'Casa / ACER', 'Altro'];

/** Scadenze tipiche proposte con un tocco (tutte modificabili) */
export const DEADLINE_TEMPLATES = [
  { title: 'Verifica progetto personalizzato', months: 6, type: 'verifica' },
  { title: 'Verifica Budget di Salute', months: 6, type: 'verifica' },
  { title: 'Relazione sociale da consegnare', days: 14, type: 'relazione' },
  { title: 'Relazione per giudice tutelare / AdS', days: 30, type: 'relazione' },
  { title: 'Rinnovo contributo economico', months: 12, type: 'rinnovo' },
  { title: 'Scadenza tirocinio / inserimento lavorativo', months: 6, type: 'rinnovo' },
  { title: 'Rinnovo ISEE', months: 12, type: 'documenti' },
  { title: 'Documenti da raccogliere', days: 7, type: 'documenti' },
];

/** Checklist di preparazione UVM (area adulti / salute mentale) */
export const UVM_CHECKLIST = [
  'Scheda di presentazione del caso aggiornata',
  'Relazione sociale',
  'Confronto preliminare con psichiatra / referente CSM',
  'Situazione economica e ISEE verificati',
  'Documentazione invalidità / L.104 (se presente)',
  'Obiettivi e desideri raccolti con la persona',
  'Sentita la famiglia / amministratore di sostegno',
  'Convocati tutti i partecipanti',
  'Proposta sugli assi: casa, lavoro/formazione, socialità',
  'Bozza di obiettivi e indicatori di verifica',
];
export const UVM_AFTER = ['Verbale inviato / firmato', 'Cartella sociale ufficiale aggiornata', 'Comunicato l\'esito alla persona'];

export const CHECKLISTS = {
  'Visita domiciliare': ['Avvisato il/la collega (dove vado, a che ora)', 'Indirizzo e recapito verificati', 'Cosa osservare: casa, igiene, farmaci, rete', 'Documenti da portare / firmare', 'Dopo: nota nel diario del caso'],
  'Relazione sociale': ['Raccolti fatti e date', 'Sentiti i servizi coinvolti (CSM, SerDP, MMG…)', 'Distinti fatti, dichiarazioni e valutazione professionale', 'Proposta di intervento', 'Revisione e firma', 'Protocollo / invio'],
  'Primo colloquio': ['Motivo dell\'accesso', 'Situazione abitativa, economica, lavorativa', 'Rete familiare e sociale', 'Servizi già coinvolti', 'Consenso privacy', 'Prossimo appuntamento fissato'],
};

export function emptyData() {
  return {
    v: 1,
    settings: { name: '', autolock: 3, staleDays: 30, kmRate: 0.35, trienniumStart: 2026, credits: 60, deont: 15, checklists: structuredClone(CHECKLISTS), uvmChecklist: [...UVM_CHECKLIST] },
    cases: [], events: [], deadlines: [], tasks: [], log: [], uvm: [], contacts: [], km: [], training: [],
    createdAt: today(),
  };
}

/** Esempi per provare l'app (si cancellano da Impostazioni) */
export function demoData() {
  const d = emptyData();
  d.demo = true;
  const T = today();
  const c = (code, area, extra = {}) => { const x = { id: uid(), code, area, status: 'attivo', refs: [], axes: {}, budget: false, nextStep: '', notes: '', createdAt: addDays(T, -120), demo: true, ...extra }; d.cases.push(x); return x; };
  const a = c('A.B.', 'Salute mentale', { budget: true, nextStep: 'Cercare borsa lavoro presso coop. agricola', axes: { casa: { status: 'in corso', note: 'Appartamento supportato' }, lavoro: { status: 'da avviare', note: '' }, socialita: { status: 'in corso', note: 'Centro diurno 2 v/sett' } }, refs: [{ role: 'Psichiatra CSM', name: 'Dr. Rossi', phone: '0522 000000' }, { role: 'Educatore', name: 'Luca (coop.)', phone: '' }] });
  const b = c('M.F.', 'Dipendenze', { nextStep: 'Rinnovo contributo affitto', refs: [{ role: 'SerDP', name: 'Dr.ssa Bianchi', phone: '' }] });
  const e = c('G.L.', 'Salute mentale', { status: 'monitoraggio', nextStep: 'Verifica tirocinio' });
  const f = c('S.P.', 'Adulti fragili', { nextStep: 'Ricorso amministratore di sostegno' });
  d.events.push(
    { id: uid(), type: 'colloquio', caseId: a.id, date: T, time: '09:30', duration: 45, place: 'Servizio sociale', notes: '', done: false },
    { id: uid(), type: 'equipe', caseId: null, date: T, time: '11:00', duration: 90, place: 'CSM Correggio', notes: 'Équipe integrata mensile', done: false },
    { id: uid(), type: 'visita', caseId: f.id, date: T, time: '15:00', duration: 60, place: 'Domicilio', notes: '', done: false },
    { id: uid(), type: 'uvm', caseId: e.id, date: addDays(T, 2), time: '10:00', duration: 60, place: 'Casa della Salute', notes: '', done: false },
    { id: uid(), type: 'telefonata', caseId: b.id, date: addDays(T, 1), time: '12:00', duration: 15, place: '', notes: 'Richiamare per documenti ISEE', done: false },
  );
  d.deadlines.push(
    { id: uid(), caseId: a.id, title: 'Verifica Budget di Salute', date: addDays(T, 5), type: 'verifica', done: false, notes: '' },
    { id: uid(), caseId: f.id, title: 'Relazione per ricorso AdS', date: addDays(T, 2), type: 'relazione', done: false, notes: '' },
    { id: uid(), caseId: b.id, title: 'Rinnovo contributo affitto', date: addDays(T, 12), type: 'rinnovo', done: false, notes: '' },
    { id: uid(), caseId: null, title: 'Consegna statistiche trimestrali', date: addDays(T, -1), type: 'altro', done: false, notes: '' },
  );
  d.tasks.push(
    { id: uid(), caseId: a.id, text: 'Chiamare coop. per borsa lavoro', done: false, createdAt: T },
    { id: uid(), caseId: null, text: 'Aggiornare cartella sociale dopo équipe', done: false, createdAt: T },
    { id: uid(), caseId: f.id, text: 'Chiedere certificato medico al MMG', done: false, createdAt: T },
  );
  d.log.push(
    { id: uid(), caseId: a.id, date: addDays(T, -7), kind: 'colloquio', text: 'Colloquio: umore stabile, interesse per lavoro all\'aperto.' },
    { id: uid(), caseId: b.id, date: addDays(T, -40), kind: 'telefonata', text: 'Aggiornamento dal SerDP: percorso regolare.' },
    { id: uid(), caseId: e.id, date: addDays(T, -12), kind: 'visita', text: 'Visita domiciliare: casa in ordine.' },
    { id: uid(), caseId: f.id, date: addDays(T, -3), kind: 'nota', text: 'Difficoltà nella gestione del denaro: valutare AdS.' },
  );
  d.uvm.push({ id: uid(), caseId: e.id, eventId: d.events[3].id, date: addDays(T, 2), time: '10:00', place: 'Casa della Salute', participants: 'Psichiatra CSM, educatore coop., MMG', checklist: d.settings.uvmChecklist.map((t, i) => ({ text: t, done: i < 3 })), notes: '', decisions: '', status: 'preparazione', verifyMonths: 6 });
  d.contacts.push(
    { id: uid(), name: 'CSM Correggio', org: 'Ausl Reggio Emilia', role: 'Centro Salute Mentale', phone: '', email: '', notes: 'Inserisci il numero corretto' },
    { id: uid(), name: 'SerDP', org: 'Ausl Reggio Emilia', role: 'Dipendenze', phone: '', email: '', notes: '' },
  );
  d.km.push({ id: uid(), date: addDays(T, -3), from: 'Ufficio', to: 'Domicilio S.P.', km: 14, caseId: f.id, note: 'andata e ritorno' });
  d.training.push({ id: uid(), date: addDays(T, -60), title: 'Corso deontologia e privacy', credits: 5, deont: true, provider: 'Ordine AS Emilia-Romagna' });
  for (const k of ['cases', 'events', 'deadlines', 'tasks', 'log', 'uvm', 'contacts', 'km', 'training']) d[k].forEach((x) => { x.demo = true; });
  return d;
}
export { addMonths };
