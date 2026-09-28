// ============================================================
//  Archivio cifrato sul telefono
//  - I dati stanno SOLO nel telefono (IndexedDB del browser)
//  - Sono cifrati con AES-GCM 256 bit; la chiave deriva dal PIN
//    (PBKDF2-SHA256, 310.000 iterazioni). Senza PIN sono illeggibili.
// ============================================================
const DB_NAME = 'agenda-sociale';
const STORE = 'vault';
const KEY = 'main';
const ITER = 310000;

export let data = null;      // dati in chiaro (solo in memoria, mentre l'app è sbloccata)
let cryptoKey = null;
let salt = null;
let saveTimer = null;

// ---------------- IndexedDB minimale ----------------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(STORE).objectStore(STORE).get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
}
async function idbSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
async function idbDel(k) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

// ---------------- Crittografia ----------------
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin, saltBytes) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptWith(key, saltBytes, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { app: 'agenda-sociale', v: 1, salt: b64(saltBytes), iv: b64(iv), ct: b64(ct), savedAt: new Date().toISOString() };
}
async function decryptWith(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return JSON.parse(dec.decode(pt));
}

// ---------------- API ----------------
export async function hasVault() { return !!(await idbGet(KEY)); }

export async function createVault(pin, initial) {
  salt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(pin, salt);
  data = initial;
  await saveNow();
  try { await navigator.storage?.persist?.(); } catch { /* */ }
}

/** Sblocca con il PIN; restituisce false se il PIN è sbagliato */
export async function unlock(pin) {
  const blob = await idbGet(KEY);
  if (!blob) return false;
  const s = unb64(blob.salt);
  const k = await deriveKey(pin, s);
  try {
    data = await decryptWith(k, blob);
    cryptoKey = k; salt = s;
    try { await navigator.storage?.persist?.(); } catch { /* */ }
    return true;
  } catch { return false; }
}

export function lock() { data = null; cryptoKey = null; clearTimeout(saveTimer); }
export function isUnlocked() { return !!data && !!cryptoKey; }

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
export async function saveNow() {
  clearTimeout(saveTimer);
  if (!cryptoKey || !data) return;
  const blob = await encryptWith(cryptoKey, salt, data);
  await idbSet(KEY, blob);
}

export async function changePin(oldPin, newPin) {
  const blob = await idbGet(KEY);
  const k = await deriveKey(oldPin, unb64(blob.salt));
  try { await decryptWith(k, blob); } catch { return false; }
  salt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(newPin, salt);
  await saveNow();
  return true;
}

/** Backup: il file è cifrato con il PIN attuale */
export async function exportBackup() {
  await saveNow();
  return idbGet(KEY);
}
/** Ripristino: serve il PIN con cui è stato fatto il backup; da quel momento vale quel PIN */
export async function importBackup(blob, pin) {
  if (!blob || blob.app !== 'agenda-sociale') throw new Error('File non valido');
  const k = await deriveKey(pin, unb64(blob.salt));
  let obj;
  try { obj = await decryptWith(k, blob); } catch { throw new Error('PIN del backup errato'); }
  await idbSet(KEY, blob);
  data = obj; cryptoKey = k; salt = unb64(blob.salt);
  return true;
}

export async function wipe() { lock(); await idbDel(KEY); }
